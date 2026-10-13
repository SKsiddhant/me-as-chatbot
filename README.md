# me as chatbot — AI Copilot for Instagram & WhatsApp Web

A Chrome extension (Manifest V3) that adds an **✨ AI Reply** button to Instagram DMs and WhatsApp Web.
It sends the last ~10 visible messages to Google Gemini with your personality prompt and drops a draft
reply into the message box. You still press send yourself.

## Install

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** and choose the `instagram-ai-copilot` folder.
3. Click the extension icon, paste a Gemini API key (free from Google AI Studio), edit the prompt, **Save**.

## Privacy

- The recent chat text in the open conversation is sent to Google's Gemini API each time you click the button.
  Nothing is sent otherwise, and nothing goes anywhere except `generativelanguage.googleapis.com`.
- Your API key is stored in this browser only (`chrome.storage.local`), not synced to other devices, and is
  sent in a request header rather than the URL.

## Tests

```bash
npm test      # logic of the background worker, with a mocked chrome + fetch (Node 20+)
```
