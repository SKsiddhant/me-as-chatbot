const MODEL = "gemini-3.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_ATTEMPTS = 3;

// Errors that retrying cannot fix (bad key, blocked prompt, empty answer, missing settings).
class FatalError extends Error {}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateReply") {
    generateReply(request.context)
      .then(reply => sendResponse({ success: true, reply: reply }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates we will send a response asynchronously
  }
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// The API key lives in chrome.storage.local so it is NOT copied to every device signed in to this
// Chrome profile (storage.sync does that). Older versions saved it to sync, so fall back to that.
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey'], (local) => {
      chrome.storage.sync.get(['apiKey', 'prompt'], (sync) => {
        resolve({ apiKey: (local.apiKey || sync.apiKey || '').trim(), prompt: sync.prompt || '' });
      });
    });
  });
}

function extractReply(data) {
  const candidate = data && data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  const text = Array.isArray(parts) ? parts.map(p => p.text || '').join('').trim() : '';
  if (text) return text;
  if (data && data.promptFeedback && data.promptFeedback.blockReason) {
    throw new FatalError("Google AI blocked this request: " + data.promptFeedback.blockReason);
  }
  const why = candidate && candidate.finishReason ? ` (finish reason: ${candidate.finishReason})` : "";
  throw new FatalError("Google AI returned no text" + why + ".");
}

async function generateReply(context) {
  const { apiKey, prompt } = await getSettings();
  if (!apiKey) throw new FatalError("API Key not set. Please set it in the extension options.");
  if (!prompt) throw new FatalError("No personality prompt saved. Open the extension options and click Save.");

  // A function replacer keeps "$&", "$1" etc. in chat messages from being treated as patterns.
  // If the prompt has no {context} placeholder, append the chat so it is never silently dropped.
  const text = prompt.includes('{context}')
    ? prompt.replace('{context}', () => context)
    : `${prompt}\n\nContext of the chat:\n${context}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 50 }
  });

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Header, not "?key=" in the URL, so the key doesn't end up in logs or error messages.
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body,
      });

      if (response.ok) return extractReply(await response.json());

      const errorData = await response.json().catch(() => null);
      const msg = (errorData && errorData.error && errorData.error.message) || `HTTP ${response.status}`;
      const error = new Error("Google AI Error: " + msg);
      // Only overload / rate limit / server errors are worth retrying. A 400/403 (bad key) never is.
      if (response.status === 429 || response.status >= 500) lastError = error;
      else throw new FatalError(error.message);
    } catch (e) {
      if (e instanceof FatalError) throw e;
      lastError = e.name === 'AbortError' ? new Error("The request to Google AI timed out.") : e;
    } finally {
      clearTimeout(timeoutId);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(attempt * 2000);
  }
  throw lastError;
}
