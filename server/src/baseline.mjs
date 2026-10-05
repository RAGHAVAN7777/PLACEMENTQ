import { spawn } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT } from './config.mjs';
import { HttpError } from './security.mjs';

let queue = Promise.resolve();
function invoke(payload) {
  return new Promise((resolve, reject) => {
    const python = process.env.PLACEMENTIQ_PYTHON || path.join(REPO_ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const child = spawn(python, [path.join(REPO_ROOT, 'ml/infer.py')], { cwd: REPO_ROOT, windowsHide: true, env: { ...process.env, OMP_NUM_THREADS: '2', OPENBLAS_NUM_THREADS: '2' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '';
    const timer = setTimeout(() => { child.kill(); reject(new HttpError(503, 'The placement model timed out. Your inputs can be retried.', 'baseline_timeout')); }, 60000);
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', () => { clearTimeout(timer); reject(new HttpError(503, 'The saved placement model runtime is unavailable. Configure PLACEMENTIQ_PYTHON or install ml/requirements-inference.txt in .venv.', 'baseline_unavailable')); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) { console.error('Baseline inference:', error.slice(-1500)); return reject(new HttpError(503, 'The saved placement model could not run. Check the Python dependencies; no substitute score was generated.', 'baseline_unavailable')); }
      try {
        const result = JSON.parse(output);
        if (result.errors) return reject(new HttpError(400, 'Confirm every required baseline input.', 'invalid_baseline', result.errors));
        resolve(result);
      } catch { reject(new HttpError(503, 'The placement model returned an invalid response.', 'baseline_response')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(payload));
  });
}
export function baselineInference(payload) {
  const next = queue.catch(() => {}).then(() => invoke(payload));
  queue = next;
  return next;
}
let schema;
export async function baselineSchema() { return schema ||= await baselineInference({ operation: 'schema' }); }

export function resumePrefill(session) {
  if (!session?.resume?.text) return {};
  const text = session.resume.text;
  const candidates = {};
  const add = (key, regex, convert = Number) => {
    const match = text.match(regex);
    if (match) candidates[key] = { value: convert(match[1]), source: session.resume.fileName, passage: match[0], confirmed: false };
  };
  add('cgpa', /(?:CGPA|GPA)\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10|out of 10)/i);
  add('internships_count', /(?:completed\s+)?(\d+)\s+internships\b/i);
  add('projects_count', /(?:completed\s+)?(\d+)\s+(?:technical\s+)?projects\b/i);
  add('backlogs', /(?:active\s+)?backlogs\s*[:=\-]\s*(\d+)/i);
  add('branch', /\b(CSE|IT|ECE|EEE|ME|CE|Mechanical|Civil)\b/, value => ({ ME: 'Mechanical', CE: 'Civil' }[value] || value));
  if (!candidates.projects_count && session.profile?.projects?.length) candidates.projects_count = {
    value: session.profile.projects.length, source: `${session.resume.fileName} (named projects; verify total)`,
    passage: session.profile.projects.map(project => project.sourcePassage).join(' · ').slice(0, 500), confirmed: false,
  };
  return candidates;
}
