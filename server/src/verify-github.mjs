import fs from 'node:fs/promises';
import path from 'node:path';

// Public reference repository only; never represents a student's own work.
process.env.PLACEMENTIQ_DATA_DIR = `server/data/test-runtime/github-${Date.now()}`;
const { previewGitHub, inspectRepository } = await import('./github.mjs');
const { REPO_ROOT } = await import('./config.mjs');
const results = { timestamp: new Date().toISOString(), repository: 'pallets/flask', purpose: 'Public reference repository inspection; no authorship claim', success: false };
try {
  const preview = await previewGitHub('https://github.com/pallets/flask');
  const inspection = await inspectRepository(preview.repositories[0]);
  const cached = await inspectRepository(preview.repositories[0]);
  if (!inspection.inspectedFiles.length || !cached.cached) throw new Error('Expected real files and a subsequent cache hit.');
  Object.assign(results, { success: true, files: inspection.inspectedFiles, evidence: inspection.evidence, totalCharacters: inspection.totalChars, treeSha: inspection.treeSha, cacheHit: cached.cached });
  console.log(`Inspected ${inspection.inspectedFiles.length} real files (${inspection.totalChars} characters); cache hit verified.`);
} catch (error) {
  results.error = { code: error.code || 'verification_failed', message: error.message, details: error.details };
  console.error(JSON.stringify(results.error));
  process.exitCode = 1;
}
await fs.writeFile(path.join(REPO_ROOT, 'docs/verification/github-live.json'), JSON.stringify(results, null, 2) + '\n');
