let isInitialized = false;

function initializeContentScript() {
    if (isInitialized) return;
    
    // Create and inject the popup styles
    const style = document.createElement('style');
    style.textContent = `
        .study-focus-popup {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-family: Arial, sans-serif;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        }

        .study-focus-popup.blocked-site {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #dc3545;
            font-size: 1.2em;
            text-align: center;
            padding: 20px 30px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
            border: 2px solid #fff;
        }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    // Send ready message to background script
    chrome.runtime.sendMessage({ type: 'contentScriptReady' });
    
    isInitialized = true;
}

// Initialize when the document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    initializeContentScript();
}

function extractPageContent() {
    const content = {
        title: document.title,
        mainContent: document.body.innerText,
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText).join(' '),
        metaDescription: document.querySelector('meta[name="description"]')?.content || '',
        url: window.location.href
    };

    // Clean and prepare content
    const cleanContent = {
        text: `
            Title: ${content.title}
            URL: ${content.url}
            Headings: ${content.headings}
            Description: ${content.metaDescription}
            Main Content: ${content.mainContent.slice(0, 5000)} // Limit content length
        `,
        metadata: {
            url: content.url,
            timestamp: Date.now()
        }
    };

    return cleanContent;
}

// Listen for DOM content loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Get study settings
    chrome.storage.sync.get(['studyTopic'], async (data) => {
        if (data.studyTopic) {
            const content = extractPageContent();
            content.studyTopic = data.studyTopic;
            
            // Send content for analysis
            chrome.runtime.sendMessage({
                type: 'contentAnalysis',
                content: content
            });
        }
    });
});

// Handle warning display
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'showWarning') {
        showWarningOverlay(message.reason, message.summary);
    }
});

function showWarningOverlay(reason, summary) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 0, 0, 0.9);
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: Arial, sans-serif;
        text-align: center;
        padding: 20px;
    `;
    
    overlay.innerHTML = `
        <h1>⚠️ Focus Warning ⚠️</h1>
        <p><strong>This page appears to be off-topic:</strong></p>
        <p>${reason}</p>
        <div style="margin: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
            <h3>Page Summary:</h3>
            <p>${summary}</p>
        </div>
        <p>This tab will close in 5 seconds.</p>
        <p>Remember to stay focused on your studies!</p>
    `;
    
    document.body.appendChild(overlay);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'showPopup' || message.type === 'showWarning') {
        showPopup(message.message, message.duration, message.type === 'showWarning');
        // Send acknowledgment
        sendResponse({ received: true });
        return true;
    }
});

function showPopup(message, duration, isWarning = false) {
    // Remove any existing popups
    const existingPopup = document.querySelector('.study-focus-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'study-focus-popup';
    
    if (message.includes('blocked site')) {
        popup.className += ' blocked-site';
        // Create a more structured message for blocked sites
        const messageHTML = `
            <strong>⚠️ Study Focus Alert ⚠️</strong><br><br>
            ${message}
        `;
        popup.innerHTML = messageHTML;
    } else {
        popup.textContent = message;
        if (isWarning) {
            popup.style.backgroundColor = '#dc3545';
        }
    }

    document.body.appendChild(popup);

    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => popup.remove(), 300);
    }, duration - 300);
}

// Add this to your existing message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ping') {
        sendResponse({ status: 'ready' });
        return true;
    }
    // ... existing message handling code ...
});

// Add immediate logging
console.log('%c[Study Focus] Content Script Loaded', 'color: blue; font-weight: bold');

// Log URL and document state
console.log('[Study Focus] URL:', window.location.href);
console.log('[Study Focus] Document State:', document.readyState);

// Add a visible element to verify script is running
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Study Focus] DOM fully loaded');
    
    // Create a test element
    const testDiv = document.createElement('div');
    testDiv.style.position = 'fixed';
    testDiv.style.top = '0';
    testDiv.style.right = '0';
    testDiv.style.background = 'red';
    testDiv.style.padding = '5px';
    testDiv.style.color = 'white';
    testDiv.style.zIndex = '9999';
    testDiv.textContent = 'Study Focus Active';
    
    document.body.appendChild(testDiv);
});

// Test storage access
chrome.storage.sync.get(['studyTopic'], (data) => {
    console.log('[Study Focus] Current study topic:', data.studyTopic);
});