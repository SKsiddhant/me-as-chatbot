const defaultPrompt = `You are simulating my exact texting style for an Instagram DM.

RULES:
1. MAX 5 WORDS. Keep it very short.
2. NO proper grammar. NO punctuation.
3. Language: Hinglish (Hindi + English slang).
4. Vibe: Casual, dramatic, playful, stubborn.
5. Signature words to use: "Ni ni", "essa", "Hoiiii", "Oi", "Areee", "Sed", "Yesss".
6. Repeat letters for drama: "Jaoooo", "lifee".
7. NEVER sound like an AI. NEVER be polite or formal.
8. Use 😭😭 or 🙂 if it fits.

Context of the chat:
{context}

Respond as me. Output ONLY the raw message I would send, absolutely nothing else. No quotes.`;

function restore_options() {
  chrome.storage.sync.get({
    apiKey: '',
    prompt: defaultPrompt
  }, function(items) {
    document.getElementById('apiKey').value = items.apiKey;
    document.getElementById('prompt').value = items.prompt;
  });
}

function save_options() {
  var key = document.getElementById('apiKey').value;
  var promptStr = document.getElementById('prompt').value;
  
  chrome.storage.sync.set({
    apiKey: key,
    prompt: promptStr
  }, function() {
    var status = document.getElementById('status');
    status.style.display = 'block';
    setTimeout(function() {
      status.style.display = 'none';
    }, 2000);
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('saveBtn').addEventListener('click', save_options);
