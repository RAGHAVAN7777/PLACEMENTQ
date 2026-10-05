import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(SERVER_DIR, '..');

function loadLocalEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadLocalEnv();

const ollamaUrl = new URL(process.env.OLLAMA_BASE_URL || 'http://localhost:11434');
if (!['localhost', '127.0.0.1', '[::1]'].includes(ollamaUrl.hostname) || ollamaUrl.protocol !== 'http:' || ollamaUrl.username || ollamaUrl.password) throw new Error('OLLAMA_BASE_URL must be an HTTP loopback endpoint on this machine.');

const integer = (name, fallback, min, max) => {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export const config = Object.freeze({
  host: process.env.PLACEMENTIQ_HOST || '127.0.0.1',
  port: integer('PLACEMENTIQ_PORT', 8787, 1, 65535),
  dataDir: path.resolve(REPO_ROOT, process.env.PLACEMENTIQ_DATA_DIR || 'server/data/runtime'),
  ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, ''),
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen3:4b-instruct',
  ollamaContextSize: integer('OLLAMA_CONTEXT_SIZE', 4096, 2048, 16384),
  ollamaTimeoutMs: integer('OLLAMA_TIMEOUT_MS', 120000, 5000, 300000),
  ollamaMaxRetries: integer('OLLAMA_MAX_RETRIES', 1, 0, 2),
  ollamaMaxOutputTokens: integer('OLLAMA_MAX_OUTPUT_TOKENS', 900, 128, 2048),
  githubToken: process.env.GITHUB_TOKEN || '',
  githubTimeoutMs: integer('GITHUB_TIMEOUT_MS', 15000, 3000, 60000),
  maxResumeBytes: 8 * 1024 * 1024,
  maxResumeTextChars: 50000,
  maxRepoTextChars: 120000,
  maxAnswerChars: 4000,
  targetQuestions: 6,
  maxFollowUps: 2
});
