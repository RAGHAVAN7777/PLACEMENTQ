import { config } from './config.mjs';
import { HttpError } from './security.mjs';
import { createHash } from 'node:crypto';

let inferenceQueue = Promise.resolve();
const reusable = new Map();
const preflights = new Map();
let fetchIdentity = globalThis.fetch;

// Classify response bodies without logging candidate text, prompts or raw errors.
export function inferenceFailure(status, body = '') {
  const text = String(body).toLowerCase();
  if (/cuda.*(initializ|shared object)|0xc0000409/.test(text)) return { category:'cuda_initialization', transient:false, message:'The Ollama CUDA runner failed to initialize. Check the local Ollama log and GPU driver/runtime, or set OLLAMA_NUM_GPU=0 for CPU inference and restart the backend.' };
  if (/out of memory|not enough.*memory|requires more.*memory|unable to allocate/.test(text)) return { category:'memory_allocation', transient:false, message:'Ollama reported insufficient memory. Close other model workloads or use a smaller installed model.' };
  if (/unsupported|invalid.*(parameter|option)|does not support/.test(text)) return { category:'unsupported_parameter', transient:false, message:'Ollama rejected a model parameter. Check model compatibility and the installed Ollama version.' };
  if (/not found|does not exist/.test(text) || status===404) return { category:'missing_model', transient:false, message:'The selected Ollama model is not installed.' };
  const transient=[408,429,502,503,504].includes(status) || (status===500 && /temporar|busy|overload|try again/.test(text));
  return {category:transient?'temporarily_unavailable':'runner_failure',transient,message:`Ollama returned HTTP ${status}. Check its local server log for the runner failure; your saved session is unchanged.`};
}

async function request(pathname, init = {}, timeoutMs = config.ollamaTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.ollamaBaseUrl}${pathname}`, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = (await response.text()).slice(0,8192);
      const failure = inferenceFailure(response.status, body);
      throw Object.assign(new Error(failure.message), failure, {httpStatus:response.status});
    }
    // Keep the timeout active while the model generates the response body.
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getOllamaStatus(selectedModel = config.ollamaModel) {
  try {
    const data = await request('/api/tags', {}, 10000);
    const models = Array.isArray(data.models) ? data.models.map((item) => item.name).filter((name) => typeof name === 'string') : [];
    const modelName = selectedModel.includes(':') ? selectedModel : `${selectedModel}:latest`;
    const installed = models.includes(selectedModel) || models.includes(modelName);
    let details = null;
    if (installed) {
      try {
        const payload = await request('/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: selectedModel }) }, 8000);
        if (payload) {
          details = { capabilities: payload.capabilities || [], family: payload.details?.family || null, parameterSize: payload.details?.parameter_size || null, quantization: payload.details?.quantization_level || null };
        }
      } catch { /* status remains useful */ }
    }
    const ready = installed && (!details?.capabilities?.length || details.capabilities.includes('completion'));
    return { reachable: true, installed, ready, mode: ready ? 'local-model' : 'local-practice', model: selectedModel, endpoint: config.ollamaBaseUrl, models, details, digest: data.models?.find((item) => item.name === selectedModel)?.digest || null, settings: { contextSize: config.ollamaContextSize, temperature: 0.1, thinking: false, maxConcurrentInference: 1 },
      setup: { check: 'ollama list', pull: `ollama pull ${selectedModel}`, start: 'ollama serve' },
      message: ready ? 'Local model is ready.' : installed ? 'This installed model does not advertise text completion. Select a completion-capable model in OLLAMA_MODEL.' : `Ollama is running, but ${selectedModel} is not installed. Run: ollama pull ${selectedModel}. Resume extraction and offline Demo Mode remain available.` };
  } catch (error) {
    return { reachable: false, installed: false, ready: false, mode: 'local-practice', model: selectedModel, endpoint: config.ollamaBaseUrl, models: [], details: null,
      setup: { check: 'ollama list', pull: `ollama pull ${selectedModel}`, start: 'ollama serve' },
      message: `Ollama is not reachable at ${config.ollamaBaseUrl}. After installing Ollama, start it and run: ollama pull ${selectedModel}. Resume extraction, GitHub evidence, and offline Demo Mode remain available. Real interviews require a working local model.` };
  }
}

export async function listAvailableModels() {
  const status = await getOllamaStatus();
  try {
    const data = await request('/api/tags', {}, 5000);
    const models = Array.isArray(data.models) ? data.models.map((m) => ({
      name: m.name,
      size: m.size,
      digest: m.digest,
      modifiedAt: m.modified_at,
      details: m.details,
      isActive: m.name === config.ollamaModel || m.name === `${config.ollamaModel}:latest`,
    })) : [];
    return {
      activeModel: config.ollamaModel,
      reachable: status.reachable,
      ready: status.ready,
      models,
    };
  } catch {
    return {
      activeModel: config.ollamaModel,
      reachable: false,
      ready: false,
      models: [],
    };
  }
}

export async function selectActiveModel(modelName) {
  if (typeof modelName !== 'string' || !modelName.trim()) {
    throw new HttpError(400, 'A valid model name must be provided.', 'invalid_model');
  }
  const status = await getOllamaStatus(modelName.trim());
  if (!status.reachable) throw new HttpError(503, 'Ollama is unavailable. The active model was not changed.', 'model_unavailable');
  if (!status.ready) throw new HttpError(400, 'Select an installed completion-capable model.', 'invalid_model');
  config.ollamaModel = modelName.trim();
  return status;
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

async function runGenerate({ model, system, prompt, schema, contextSize = config.ollamaContextSize, maxOutputTokens = config.ollamaMaxOutputTokens }) {
  const body = {
    model, stream: false, think: false, system, prompt, format: schema, keep_alive: '10m',
    options: { temperature: 0.1, num_ctx: contextSize, num_predict: maxOutputTokens, ...(config.ollamaNumGpu !== null ? {num_gpu:config.ollamaNumGpu} : {}) }
  };
  if (system.length + prompt.length > 11000) throw new Error('The bounded prompt exceeded 11,000 characters. Shorten the source passages.');
  const started = performance.now();
  let lastError;
  for (let attempt = 0; attempt <= config.ollamaMaxRetries; attempt += 1) {
    try {
      const data = await request('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (data.done_reason === 'length') throw new Error('The structured response reached its output limit. Please retry with shorter source text.');
      if (typeof data.response !== 'string' || data.response.length > 40000) throw new Error('The model response was empty or exceeded the output limit.');
      const output=extractJson(data.response);
      const metrics={ wallMs: Math.round(performance.now() - started), totalDurationNs: data.total_duration, loadDurationNs: data.load_duration, promptEvalDurationNs:data.prompt_eval_duration, evalDurationNs: data.eval_duration, evalCount: data.eval_count, promptEvalCount: data.prompt_eval_count, contextSize, attempts:attempt+1, requestBytes:Buffer.byteLength(JSON.stringify(body)) };
      console.info('ollama_inference',JSON.stringify({model,...metrics}));
      return { output, metrics, model: data.model || model };
    } catch (error) {
      lastError = error;
      console.warn('ollama_failure',JSON.stringify({model,attempt:attempt+1,httpStatus:error.httpStatus||null,category:error.category||error.name,requestBytes:Buffer.byteLength(JSON.stringify(body)),contextSize,maxOutputTokens,timeoutMs:config.ollamaTimeoutMs,wallMs:Math.round(performance.now()-started),rssBytes:process.memoryUsage().rss}));
      // Timeouts may still be executing remotely; never overlap them with a retry.
      if (!error.transient || attempt >= config.ollamaMaxRetries) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function generateStructured(input) {
  const model = input.model || config.ollamaModel;
  if (fetchIdentity !== globalThis.fetch) { preflights.clear(); reusable.clear(); fetchIdentity=globalThis.fetch; }
  const key=input.cacheScope ? createHash('sha256').update(JSON.stringify([input.cacheScope,model,input.contextSize||config.ollamaContextSize,config.ollamaNumGpu,input.system,input.prompt,input.schema,input.maxOutputTokens])).digest('hex') : null;
  const cached=key && reusable.get(key);
  if(cached && Date.now()-cached.at<15*60*1000) return {...structuredClone(cached.value),metrics:{...cached.value.metrics,wallMs:0,cacheHit:true}};
  const prior=preflights.get(model);
  const status = prior && Date.now()-prior.at<10000 ? prior.status : await getOllamaStatus(model);
  if (!status.ready) return { available: false, status };
  preflights.set(model,{status,at:Date.now()});
  const enqueued=performance.now();
  const job = inferenceQueue.then(async () => { const queueMs=Math.round(performance.now()-enqueued); const result=await runGenerate({ ...input, model });return {...result,metrics:{...result.metrics,queueMs}}; });
  inferenceQueue = job.catch(() => undefined);
  try { const result={ available: true, ...(await job), status }; if(key && input.cacheValidate?.(result.output)){if(reusable.size>=64)reusable.delete(reusable.keys().next().value);reusable.set(key,{at:Date.now(),value:structuredClone(result)});}return result; }
  catch (error) { preflights.delete(model); return { available: false, status: { ...status, installed: true, message: `Local inference failed: ${error.message}` }, error: error.message }; }
}
