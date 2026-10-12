// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../instagram-ai-copilot/background.js', import.meta.url), 'utf8');

// Loads background.js against a fake `chrome` + `fetch` and returns its message handler.
function load({ local = {}, sync = {}, responses }) {
  const calls = [];
  let handler;
  const chrome = {
    runtime: { onMessage: { addListener: (fn) => { handler = fn; } } },
    storage: {
      local: { get: (_k, cb) => cb(local) },
      sync: { get: (_k, cb) => cb(sync) },
    },
  };
  const queue = [...responses];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return { ok: next.status < 400, status: next.status, json: async () => next.body };
  };
  const instantSleep = (fn) => { fn(); return 0; };
  new Function('chrome', 'fetch', 'setTimeout', 'clearTimeout', source)(chrome, fetch, instantSleep, () => {});
  const ask = (context) => new Promise((resolve) => handler({ action: 'generateReply', context }, {}, resolve));
  return { ask, calls };
}

const ok = (text) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] } }] } });
const settings = { local: { apiKey: 'KEY123' }, sync: { prompt: 'Reply as me.\n{context}' } };

test('sends the API key in a header, never in the URL', async () => {
  const { ask, calls } = load({ ...settings, responses: [ok(' hey ')] });
  assert.deepEqual(await ask('hi'), { success: true, reply: 'hey' });
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'KEY123');
  assert.ok(!calls[0].url.includes('KEY123') && !calls[0].url.includes('key='));
});

test('falls back to the key saved by older versions in storage.sync', async () => {
  const { ask, calls } = load({ local: {}, sync: { apiKey: 'OLDKEY', prompt: 'p {context}' }, responses: [ok('x')] });
  assert.equal((await ask('c')).success, true);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'OLDKEY');
});

test('a bad key (403) fails immediately instead of retrying', async () => {
  const { ask, calls } = load({ ...settings, responses: [{ status: 403, body: { error: { message: 'API key not valid' } } }] });
  const r = await ask('hi');
  assert.equal(r.success, false);
  assert.match(r.error, /API key not valid/);
  assert.equal(calls.length, 1);
});

test('retries overload (503) and rate limits (429), then succeeds', async () => {
  const busy = { status: 503, body: { error: { message: 'overloaded' } } };
  const { ask, calls } = load({ ...settings, responses: [busy, { ...busy, status: 429 }, ok('finally')] });
  assert.equal((await ask('hi')).reply, 'finally');
  assert.equal(calls.length, 3);
});

test('gives up after 3 attempts and reports the last error', async () => {
  const busy = { status: 503, body: { error: { message: 'overloaded' } } };
  const { ask, calls } = load({ ...settings, responses: [busy, busy, busy] });
  const r = await ask('hi');
  assert.match(r.error, /overloaded/);
  assert.equal(calls.length, 3);
});

test('chat text containing $& or $1 is passed through untouched', async () => {
  const { ask, calls } = load({ ...settings, responses: [ok('k')] });
  await ask("price is $& and $1 and $'");
  const sent = JSON.parse(calls[0].init.body).contents[0].parts[0].text;
  assert.ok(sent.includes("price is $& and $1 and $'"));
});

test('context is appended when the prompt has no {context} placeholder', async () => {
  const { ask, calls } = load({ local: { apiKey: 'K' }, sync: { prompt: 'Be brief.' }, responses: [ok('k')] });
  await ask('they said hi');
  assert.ok(JSON.parse(calls[0].init.body).contents[0].parts[0].text.includes('they said hi'));
});

test('missing key or prompt gives a clear message, not a TypeError', async () => {
  assert.match((await load({ responses: [] }).ask('x')).error, /API Key not set/);
  assert.match((await load({ local: { apiKey: 'K' }, responses: [] }).ask('x')).error, /personality prompt/);
});

test('an empty or blocked answer reports why instead of crashing', async () => {
  const empty = { status: 200, body: { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] } };
  assert.match((await load({ ...settings, responses: [empty] }).ask('x')).error, /MAX_TOKENS/);
  const blocked = { status: 200, body: { promptFeedback: { blockReason: 'SAFETY' } } };
  assert.match((await load({ ...settings, responses: [blocked] }).ask('x')).error, /SAFETY/);
});
