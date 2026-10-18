import { parentPort } from 'node:worker_threads';
import { extractResume } from './resume-parser.mjs';
parentPort.on('message', async payload => {
  try { parentPort.postMessage({ result: await extractResume(payload) }); }
  catch (error) { parentPort.postMessage({ error: { message:error.message, status:error.status || 422, code:error.code || 'resume_parse_failed' } }); }
});
