import { config } from './config.mjs';
import { getCache, setCache } from './persistence.mjs';
import { HttpError } from './security.mjs';

const API = 'https://api.github.com';
const MANIFESTS = new Set(['package.json', 'requirements.txt', 'pyproject.toml', 'environment.yml', 'pom.xml', 'build.gradle', 'cargo.toml', 'go.mod']);
const SOURCE_EXTENSIONS = new Set(['.py', '.ts', '.tsx', '.js', '.jsx', '.java', '.cpp', '.c', '.sql', '.ipynb']);

const headers = () => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'PlacementIQ-local-assessment',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(config.githubToken ? { Authorization: `Bearer ${config.githubToken}` } : {})
});

async function githubFetch(pathname) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.githubTimeoutMs);
  try {
    const response = await fetch(`${API}${pathname}`, { headers: headers(), signal: controller.signal });
    if (response.status === 429 || response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after'))) {
      const reset = response.headers.get('x-ratelimit-reset');
      const resetAt = reset && Number.isFinite(Number(reset)) ? new Date(Number(reset) * 1000).toISOString() : null;
      const retryAfterSeconds = response.headers.get('retry-after');
      const retryMessage = resetAt ? `Try again after ${resetAt} (UTC)` : retryAfterSeconds ? `Try again in ${retryAfterSeconds} seconds` : 'Try again later';
      throw new HttpError(429, `GitHub rate limit reached. ${retryMessage}, configure GITHUB_TOKEN for a higher limit, or continue without GitHub.`, 'github_rate_limited', { resetAt, retryAfterSeconds });
    }
    if (response.status === 404) throw new HttpError(404, 'The GitHub profile or repository is unavailable, private, or does not exist.', 'github_not_found');
    if (!response.ok) throw new HttpError(response.status, `GitHub returned ${response.status}.`, 'github_unavailable');
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new HttpError(504, 'GitHub took too long to respond.', 'github_timeout');
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'GitHub could not be reached from this machine.', 'github_unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

export function parseGitHubUrl(value) {
  let url;
  try { url = new URL(value.includes('://') ? value : `https://${value}`); } catch { throw new HttpError(400, 'Enter a valid public GitHub profile or repository URL.', 'invalid_github_url'); }
  if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) throw new HttpError(400, 'Only public github.com links are supported.', 'invalid_github_url');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new HttpError(400, 'Use a standard public GitHub URL without credentials or a custom port.', 'invalid_github_url');
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 1 || parts.length > 2) throw new HttpError(400, 'Use a GitHub profile or repository URL.', 'invalid_github_url');
  if (!/^[\w.-]+$/.test(parts[0]) || (parts[1] && !/^[\w.-]+$/.test(parts[1]))) throw new HttpError(400, 'The GitHub URL contains unsupported characters.', 'invalid_github_url');
  return parts.length === 1 ? { type: 'profile', owner: parts[0] } : { type: 'repository', owner: parts[0], repo: parts[1].replace(/\.git$/i, '') };
}

export async function previewGitHub(value) {
  const parsed = parseGitHubUrl(value);
  const cacheKey = `preview:${parsed.type}:${parsed.owner}:${parsed.repo || ''}`.toLowerCase();
  const cached = await getCache(cacheKey);
  if (cached) return { ...cached, cached: true };
  let result;
  if (parsed.type === 'profile') {
    const user = await githubFetch(`/users/${encodeURIComponent(parsed.owner)}`);
    const repos = await githubFetch(`/users/${encodeURIComponent(parsed.owner)}/repos?sort=updated&per_page=30&type=owner`);
    result = {
      type: 'profile', profile: { login: user.login, name: user.name, bio: user.bio },
      repositories: repos.filter((repo) => !repo.fork && !repo.archived).slice(0, 12).map((repo) => ({
        owner: repo.owner.login, name: repo.name, fullName: repo.full_name, description: repo.description,
        language: repo.language, defaultBranch: repo.default_branch, updatedAt: repo.updated_at
      }))
    };
  } else {
    const repo = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`);
    result = { type: 'repository', profile: { login: repo.owner.login }, repositories: [{
      owner: repo.owner.login, name: repo.name, fullName: repo.full_name, description: repo.description,
      language: repo.language, defaultBranch: repo.default_branch, updatedAt: repo.updated_at
    }] };
  }
  await setCache(cacheKey, result);
  return { ...result, cached: false };
}

const extension = (name) => name.includes('.') ? `.${name.split('.').pop().toLowerCase()}` : '';
const priority = (item) => {
  const name = item.path.toLowerCase();
  if (name === 'readme.md') return 0;
  if (MANIFESTS.has(name.split('/').pop())) return 1;
  if (/test|spec/.test(name)) return 2;
  if (SOURCE_EXTENSIONS.has(extension(name))) return 3;
  return 9;
};

function evidenceFromFiles(repository, files) {
  const evidence = [];
  const add = (skill, passage, sourcePath) => {
    if (!evidence.some((item) => item.skill === skill && item.sourcePath === sourcePath)) evidence.push({ skill, passage: passage.slice(0, 320), sourcePath, repository, origin: 'repository', confidence: 'observed-file-content' });
  };
  for (const file of files) {
    const content = file.content;
    const probes = [
      ['Python', /\b(import\s+(pandas|numpy|sklearn|flask|fastapi)|def\s+\w+\s*\()/i],
      ['SQL', /\b(select\s+.+\s+from|create\s+table|join\s+\w+)\b/is],
      ['Machine learning', /\b(train_test_split|fit\s*\(|predict\s*\(|classification|regression|sklearn)\b/i],
      ['React', /\b(from\s+['"]react['"]|useState\s*\(|jsx|tsx)\b/i],
      ['Testing', /\b(describe\s*\(|test\s*\(|pytest|unittest|assert\s+)/i]
    ];
    for (const [skill, pattern] of probes) {
      const match = content.match(pattern);
      if (match) {
        const start = Math.max(0, match.index - 100);
        add(skill, content.slice(start, start + 300).replace(/\s+/g, ' '), file.path);
      }
    }
    if (file.path.toLowerCase().endsWith('package.json')) {
      try {
        const pkg = JSON.parse(content);
        const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).slice(0, 18);
        if (deps.length) add('JavaScript ecosystem', `Dependencies declared: ${deps.join(', ')}`, file.path);
      } catch { /* not valid JSON; inspection record remains */ }
    }
  }
  return evidence;
}

export async function inspectRepository(input) {
  const owner = String(input?.owner || '').trim();
  const repo = String(input?.name || '').trim();
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) throw new HttpError(400, 'Invalid repository selection.', 'invalid_repository');
  const cacheKey = `inspect:${owner}/${repo}`.toLowerCase();
  const cached = await getCache(cacheKey);
  if (cached) return { ...cached, cached: true };
  const metadata = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  const branch = metadata.default_branch;
  const tree = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const candidates = (tree.tree || [])
    .filter((item) => item.type === 'blob' && item.size > 0 && item.size <= 60000 && priority(item) < 9 && !/(^|\/)(node_modules|vendor|dist|build|\.venv|venv|\.git)\//i.test(item.path))
    .sort((a, b) => priority(a) - priority(b) || a.size - b.size)
    .slice(0, 10);
  const files = [];
  let totalChars = 0;
  for (const item of candidates) {
    if (totalChars >= config.maxRepoTextChars) break;
    const blob = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${item.sha}`);
    if (blob.encoding !== 'base64') continue;
    const content = Buffer.from(blob.content, 'base64').toString('utf8').slice(0, Math.min(40000, config.maxRepoTextChars - totalChars));
    if (/\u0000/.test(content)) continue;
    files.push({ path: item.path, size: item.size, sha: item.sha, content });
    totalChars += content.length;
  }
  const fullName = `${metadata.owner.login}/${metadata.name}`;
  const result = {
    repository: { owner: metadata.owner.login, name: metadata.name, fullName, description: metadata.description, language: metadata.language, defaultBranch: branch },
    inspectedFiles: files.map(({ path, size, sha }) => ({ repository: fullName, path, size, sha })),
    evidence: evidenceFromFiles(fullName, files), totalChars,
    treeSha: tree.sha, treeTruncated: Boolean(tree.truncated), inspectedAt: new Date().toISOString(),
    notice: 'Repository evidence shows file contents only; it does not prove authorship or proficiency.'
  };
  await setCache(cacheKey, result);
  return { ...result, cached: false };
}
