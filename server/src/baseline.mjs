import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './config.mjs';
import { HttpError } from './security.mjs';

const BRANCH_ALIASES = Object.freeze({
  ME: 'Mechanical',
  CE: 'Civil',
});

function resolvePythonBinary() {
  if (process.env.PLACEMENTIQ_PYTHON) {
    if (fs.existsSync(process.env.PLACEMENTIQ_PYTHON) || !process.env.PLACEMENTIQ_PYTHON.includes(path.sep)) {
      return process.env.PLACEMENTIQ_PYTHON;
    }
  }
  const venvPython = path.join(REPO_ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

let queue = Promise.resolve();
function invoke(payload) {
  if (payload?.inputs?.branch && BRANCH_ALIASES[payload.inputs.branch]) {
    payload.inputs.branch = BRANCH_ALIASES[payload.inputs.branch];
  }
  return new Promise((resolve, reject) => {
    const python = resolvePythonBinary();
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
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new HttpError(400, 'Expected an inference request.', 'invalid_baseline');
  if (payload.operation !== 'schema' && (!payload.inputs || typeof payload.inputs !== 'object' || Array.isArray(payload.inputs))) throw new HttpError(400, 'Baseline inputs must be an object.', 'invalid_baseline');
  if (payload.operation === 'counterfactual' && (typeof payload.targetProbability !== 'number' || !Number.isFinite(payload.targetProbability) || payload.targetProbability < 0.05 || payload.targetProbability > 0.98)) throw new HttpError(400, 'Target probability must be a number from 0.05 to 0.98.', 'invalid_target');
  const next = queue.catch(() => {}).then(() => invoke(payload));
  queue = next;
  return next;
}
let schema;
export async function baselineSchema() { return schema ||= await baselineInference({ operation: 'schema' }); }
export async function baselineExplain(inputs) { return baselineInference({ operation: 'explain', inputs }); }
export async function baselineCounterfactual(inputs, targetProbability = 0.85) { return baselineInference({ operation: 'counterfactual', inputs, targetProbability }); }

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
  const details=session.resumeDetails;
  const grade=details?.fields?.cgpa;
  if(grade?.value&&/\/\s*10\b|out of\s*10/i.test(grade.value)){const n=Number.parseFloat(grade.value);if(n>=0&&n<=10)candidates.cgpa={value:n,source:grade.origin==='student-correction'?'Candidate correction':session.resume.fileName,passage:grade.sourcePassage,confirmed:grade.origin==='student-correction'};}
  const certificates=details?.certifications?.filter(c=>c.value);
  if(certificates?.length)candidates.certifications_count={value:new Set(certificates.map(c=>c.value.toLowerCase())).size,source:'Named resume certifications; verify total',passage:certificates.map(c=>c.value).join('; '),confirmed:false};
  const internships=session.profile?.experience?.filter(c=>c.confirmed&&/\bintern(?:ship)?\b/i.test(c.name+' '+c.sourcePassage));
  if(!candidates.internships_count&&internships?.length)candidates.internships_count={value:internships.length,source:'Reviewed internship claims; verify distinct roles',passage:internships.map(c=>c.sourcePassage).join('; ').slice(0,500),confirmed:false};
  if(!candidates.branch&&/computer science/i.test(details?.fields?.degree?.value||''))candidates.branch={value:'CSE',source:'Degree label mapped to model category; verify',passage:details.fields.degree.sourcePassage,confirmed:false};
  // Inspected repositories are a lower bound, never a fabricated total or skill score.
  return candidates;
}
