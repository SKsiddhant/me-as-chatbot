let buttonInjected = false;
let currentPlatform = window.location.hostname.includes('whatsapp') ? 'whatsapp' : 'instagram';

function getSelectors() {
  if (currentPlatform === 'whatsapp') {
    return {
      inputBox: 'footer div[contenteditable="true"], #main footer div[contenteditable="true"]',
      messageRows: '#main div[role="row"]',
      textNodes: 'span[dir="ltr"], span.selectable-text'
    };
  } else {
    return {
      inputBox: 'div[contenteditable="true"][role="textbox"]',
      messageRows: 'div[role="row"]',
      textNodes: 'span[dir="auto"], div[dir="auto"]'
    };
  }
}

function injectButton() {
  const selectors = getSelectors();
  const inputBox = document.querySelector(selectors.inputBox);
  
  if (inputBox) {
    const existingBtn = document.getElementById('ai-copilot-reply-btn');
    
    let needsInjection = true;
    if (existingBtn && document.contains(existingBtn)) {
      // Check if it's correctly placed near the CURRENT active input box
      const container = currentPlatform === 'whatsapp' ? (inputBox.closest('footer') || inputBox.parentElement) : inputBox.parentElement.parentElement;
      if (container && container.previousElementSibling && container.previousElementSibling.id === 'ai-copilot-reply-btn') {
        needsInjection = false;
      }
    }

    if (needsInjection) {
      if (existingBtn) existingBtn.remove();

      const btn = document.createElement('button');
      btn.id = 'ai-copilot-reply-btn';
      btn.innerHTML = '✨ AI Reply';
      btn.title = 'Generate a reply based on your style';
      
      btn.addEventListener('click', handleGenerateClick);
      
      if (currentPlatform === 'whatsapp') {
        const container = inputBox.closest('footer') || inputBox.parentElement;
        if (container) {
            container.insertAdjacentElement('beforebegin', btn);
            btn.style.margin = '10px 20px';
            btn.style.alignSelf = 'center';
        }
      } else {
        inputBox.parentElement.parentElement.insertAdjacentElement('beforebegin', btn);
      }
    }
  } else {
    const existingBtn = document.getElementById('ai-copilot-reply-btn');
    if (existingBtn) existingBtn.remove();
  }
}

const observer = new MutationObserver(() => {
  const isValidPage = currentPlatform === 'whatsapp' ? true : window.location.pathname.startsWith('/direct/t/');
  
  if (isValidPage) {
    injectButton();
  } else {
    const btn = document.getElementById('ai-copilot-reply-btn');
    if (btn) btn.remove();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

async function handleGenerateClick(e) {
  e.preventDefault();
  
  const btn = document.getElementById('ai-copilot-reply-btn');
  btn.innerText = '⏳ Thinking...';
  btn.disabled = true;

  const selectors = getSelectors();
  const rows = Array.from(document.querySelectorAll(selectors.messageRows)).slice(-10);
  let contextText = "";
  
  rows.forEach(row => {
    const textNodes = Array.from(row.querySelectorAll(selectors.textNodes))
                           .filter(el => currentPlatform === 'whatsapp' ? el.innerText : (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3));
                           
    if (textNodes.length > 0) {
       if (currentPlatform === 'whatsapp') {
          contextText += textNodes.map(n => n.innerText).join(' ') + "\\n";
       } else {
          contextText += textNodes.map(n => n.textContent).join(' ') + "\\n";
       }
    }
  });

  if (!contextText.trim()) {
    contextText = "No recent messages found.";
  }

  chrome.runtime.sendMessage({
    action: "generateReply", 
    context: contextText
  }, (response) => {
    btn.innerText = '✨ AI Reply';
    btn.disabled = false;
    
    if (response && response.success) {
      injectText(response.reply);
    } else {
      alert("AI Copilot Error: " + (response ? response.error : "Unknown error"));
    }
  });
}

function injectText(text) {
  const selectors = getSelectors();
  const inputBox = document.querySelector(selectors.inputBox);
  if (inputBox) {
    inputBox.focus();
    document.execCommand('insertText', false, text);
  }
}
