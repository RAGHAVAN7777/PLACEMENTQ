import test from 'node:test';
import assert from 'node:assert/strict';
process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:9';
process.env.OLLAMA_MAX_RETRIES = '0';
const { config } = await import('../src/config.mjs');
const { generateStructured, selectActiveModel } = await import('../src/ollama.mjs');

test('model switching validates availability and queued calls retain their selected model', async () => {
  const previous = config.ollamaModel;
  const originalFetch = globalThis.fetch;
  const generated = [];
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: 'first:latest' }, { name: 'second:latest' }] });
    if (url.endsWith('/api/show')) return Response.json({ capabilities: ['completion'] });
    const body = JSON.parse(init.body);
    generated.push(body.model);
    return Response.json({ response: '{"ok":true}', model: body.model });
  };
  try {
    await selectActiveModel('first:latest');
    await assert.rejects(selectActiveModel('missing:latest'), error => error.status === 400);
    assert.equal(config.ollamaModel, 'first:latest');
    const pending = generateStructured({ system: 'Test', prompt: 'Test', schema: {} });
    await selectActiveModel('second:latest');
    const pinned = await generateStructured({ model: 'first:latest', system: 'Test', prompt: 'Test', schema: {} });
    assert.equal((await pending).model, 'first:latest');
    assert.equal(pinned.model, 'first:latest');
    assert.deepEqual(generated, ['first:latest', 'first:latest']);
  } finally { globalThis.fetch = originalFetch; config.ollamaModel = previous; }
});
