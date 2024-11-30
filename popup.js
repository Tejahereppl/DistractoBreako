document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(['studyTopic'], (data) => {
        if (data.studyTopic) {
            document.getElementById('studyTopic').value = data.studyTopic;
        }
    });
});

async function isContentScriptReady(tabId) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
        return response && response.status === 'ready';
    } catch (error) {
        return false;
    }
}

document.getElementById('saveSettings').addEventListener('click', async () => {
    const studyTopic = document.getElementById('studyTopic').value.trim();
    
    if (!studyTopic) {
        showStatus('Please enter a study topic', 'error');
        return;
    }
    
    // Save to Chrome storage
    chrome.storage.sync.set({
        studyTopic: studyTopic
    }, async () => {
        showStatus('Settings saved!', 'success');
        
        // Notify any active tabs that the settings have changed
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs[0]) {
            const isReady = await isContentScriptReady(tabs[0].id);
            if (isReady) {
                try {
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'settingsUpdated',
                        studyTopic: studyTopic
                    });
                } catch (error) {
                    console.log('Failed to send message to content script:', error);
                }
            } else {
                console.log('Content script not ready in current tab');
            }
        }
    });
});

function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.style.color = type === 'error' ? '#dc3545' : 
                               type === 'success' ? '#28a745' : '#666';
    
    // Clear status after 3 seconds
    setTimeout(() => {
        statusElement.textContent = '';
    }, 3000);
}

// Add these to your popup.js for better debugging
console.log('[Study Focus] Popup script loaded');
console.group('Popup Initialization');
console.log('Window location:', window.location.href);
console.log('Extension ID:', chrome.runtime.id);
console.groupEnd();

// Add error catching
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('[Study Focus] Error:', {
        message: msg,
        url: url,
        line: lineNo,
        column: columnNo,
        error: error
    });
    return false;
};