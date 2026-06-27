chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateReply") {
    generateReply(request.context)
      .then(reply => sendResponse({ success: true, reply: reply }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates we will send a response asynchronously
  }
});

async function generateReply(context) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['apiKey', 'prompt'], async function(items) {
      try {
        if (!items.apiKey) {
          reject(new Error("API Key not set. Please set it in the extension options."));
          return;
        }

        const apiKey = items.apiKey.trim();
        const systemPrompt = items.prompt.replace('{context}', context);
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
        
        let attempts = 0;
        let response;
        let errorData;

        while (attempts < 3) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: systemPrompt
                  }]
                }],
                generationConfig: {
                  temperature: 0.8,
                  maxOutputTokens: 50,
                }
              })
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
              errorData = await response.json();
              if (response.status === 503 || response.status === 429) {
                attempts++;
                if (attempts < 3) {
                  console.log(`High demand, retrying in ${attempts * 2} seconds...`);
                  await new Promise(r => setTimeout(r, attempts * 2000));
                  continue;
                }
              }
              console.error("Gemini API Error:", errorData);
              const msg = (errorData && errorData.error && errorData.error.message) ? errorData.error.message : "Check your API key.";
              throw new Error("Google AI Error: " + msg);
            }
            
            break; // Success
          } catch(e) {
            if (attempts >= 2) throw e;
            attempts++;
            await new Promise(r => setTimeout(r, attempts * 2000));
          }
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0].content.parts[0].text) {
          resolve(data.candidates[0].content.parts[0].text.trim());
        } else {
          throw new Error("Unexpected response format from Gemini.");
        }
      } catch (e) {
        reject(e);
      }
    });
  });
}
