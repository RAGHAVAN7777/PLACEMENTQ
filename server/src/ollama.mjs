import { config } from './config.mjs';

let inferenceQueue = Promise.resolve();

async function request(pathname, init = {}, timeoutMs = config.ollamaTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.ollamaBaseUrl}${pathname}`, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
    // Keep the timeout active while the model generates the response body.
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getOllamaStatus() {
  try {
    const data = await request('/api/tags', {}, 10000);
    const models = Array.isArray(data.models) ? data.models.map((item) => item.name).filter((name) => typeof name === 'string') : [];
    const modelName = config.ollamaModel.includes(':') ? config.ollamaModel : `${config.ollamaModel}:latest`;
    const installed = models.includes(config.ollamaModel) || models.includes(modelName);
    let details = null;
    if (installed) {
      try {
        const payload = await request('/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config.ollamaModel }) }, 8000);
        if (payload) {
          details = { capabilities: payload.capabilities || [], family: payload.details?.family || null, parameterSize: payload.details?.parameter_size || null, quantization: payload.details?.quantization_level || null };
        }
      } catch { /* status remains useful */ }
    }
    const ready = installed && (!details?.capabilities?.length || details.capabilities.includes('completion'));
    return { reachable: true, installed, ready, mode: ready ? 'local-model' : 'local-practice', model: config.ollamaModel, endpoint: config.ollamaBaseUrl, models, details, digest: data.models?.find((item) => item.name === config.ollamaModel)?.digest || null, settings: { contextSize: config.ollamaContextSize, temperature: 0.1, thinking: false, maxConcurrentInference: 1 },
      setup: { check: 'ollama list', pull: `ollama pull ${config.ollamaModel}`, start: 'ollama serve' },
      message: ready ? 'Local model is ready.' : installed ? 'This installed model does not advertise text completion. Select a completion-capable model in OLLAMA_MODEL.' : `Ollama is running, but ${config.ollamaModel} is not installed. Run: ollama pull ${config.ollamaModel}. Resume extraction and practice interviews remain available.` };
  } catch (error) {
    return { reachable: false, installed: false, ready: false, mode: 'local-practice', model: config.ollamaModel, endpoint: config.ollamaBaseUrl, models: [], details: null,
      setup: { check: 'ollama list', pull: `ollama pull ${config.ollamaModel}`, start: 'ollama serve' },
      message: `Ollama is not reachable at ${config.ollamaBaseUrl}. After installing Ollama, start it and run: ollama pull ${config.ollamaModel}. Resume extraction, GitHub evidence, and practice interviews work now with review-required rubric estimates.` };
  }
}

function extractJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('The model did not return valid JSON.');
  }
}

async function runGenerate({ system, prompt, schema, maxOutputTokens = config.ollamaMaxOutputTokens }) {
  const body = {
    model: config.ollamaModel, stream: false, think: false, system, prompt, format: schema, keep_alive: '10m',
    options: { temperature: 0.1, num_ctx: config.ollamaContextSize, num_predict: maxOutputTokens }
  };
  if (system.length + prompt.length > 11000) throw new Error('The bounded prompt exceeded 11,000 characters. Shorten the source passages.');
  const started = performance.now();
  let lastError;
  for (let attempt = 0; attempt <= config.ollamaMaxRetries; attempt += 1) {
    try {
      const data = await request('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (data.done_reason === 'length') throw new Error('The structured response reached its output limit. Please retry with shorter source text.');
      if (typeof data.response !== 'string' || data.response.length > 40000) throw new Error('The model response was empty or exceeded the output limit.');
      return { output: extractJson(data.response), metrics: { wallMs: Math.round(performance.now() - started), totalDurationNs: data.total_duration, loadDurationNs: data.load_duration, evalDurationNs: data.eval_duration, evalCount: data.eval_count, promptEvalCount: data.prompt_eval_count, contextSize: config.ollamaContextSize }, model: data.model || config.ollamaModel };
    } catch (error) {
      lastError = error;
      if (attempt < config.ollamaMaxRetries) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function generateStructured(input) {
  const status = await getOllamaStatus();
  if (!status.ready) return { available: false, status };
  const job = inferenceQueue.then(() => runGenerate(input));
  inferenceQueue = job.catch(() => undefined);
  try { return { available: true, ...(await job), status }; }
  catch (error) { return { available: false, status: { ...status, installed: true, message: `Local inference failed: ${error.message}` }, error: error.message }; }
}
