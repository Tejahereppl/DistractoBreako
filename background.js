const BLOCKED_SITES = [
    'youtube.com',
    'facebook.com',
    'twitter.com',
    'linkedin.com',
    'instagram.com',
    'reddit.com'
];

// Initialize IndexedDB
const dbName = "StudyFocusDB";
const dbVersion = 1;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Store for analyzed pages
            if (!db.objectStoreNames.contains('analyzedPages')) {
                const pagesStore = db.createObjectStore('analyzedPages', { keyPath: 'url' });
                pagesStore.createIndex('timestamp', 'timestamp', { unique: false });
                pagesStore.createIndex('isRelevant', 'isRelevant', { unique: false });
            }
            
            // Store for navigation history
            if (!db.objectStoreNames.contains('navigationHistory')) {
                const historyStore = db.createObjectStore('navigationHistory', { keyPath: 'id', autoIncrement: true });
                historyStore.createIndex('url', 'url', { unique: false });
                historyStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Track navigation events
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (details.frameId === 0) { // Main frame only
        const db = await initDB();
        const transaction = db.transaction(['navigationHistory'], 'readwrite');
        const store = transaction.objectStore('navigationHistory');
        
        store.add({
            url: details.url,
            timestamp: Date.now(),
            tabId: details.tabId
        });
    }
});

// Listen for content analysis results
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'contentAnalysis') {
        (async () => {
            try {
                const aiAnalysis = await analyzeWithChromeAI(message.content);
                
                if (!aiAnalysis.isRelevant) {
                    await chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'showWarning',
                        reason: aiAnalysis.detailedSummary.fullReason,
                        summary: aiAnalysis.detailedSummary.fullSummary,
                        duration: 5000
                    });
                    
                    setTimeout(() => {
                        chrome.tabs.remove(sender.tab.id).catch(err => 
                            console.error('Failed to close tab:', err)
                        );
                    }, 5000);
                } else {
                    await chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'showPopup',
                        message: `Page is relevant to your studies!\n${aiAnalysis.summary}`,
                        duration: 2000
                    });
                }
            } catch (error) {
                console.error('Error in content analysis:', error);
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: 'showPopup',
                    message: 'Error analyzing page content',
                    duration: 3000
                });
            }
        })();
        
        return true;
    }
});

async function analyzeWithChromeAI(content) {
    try {
        console.log('Checking AI capabilities...');
        const capabilities = await ai.languageModel.capabilities();
        
        if (capabilities.available === "no") {
            throw new Error("Chrome AI model not available");
        }

        const session = await ai.languageModel.create();
        
        // More structured prompt for clearer responses
        const prompt = `Analyze this webpage content and determine if it's relevant to the study topic "${content.studyTopic}".
        
        Provide your analysis in this exact JSON format:
        {
            "relevanceScore": (a number between 0 and 1),
            "summary": "Write a clear 2-3 sentence summary of the content here",
            "explanation": "Provide a detailed explanation of why this content is or isn't relevant to the study topic"
        }

        Content to analyze: ${content.text.substring(0, 1000)}`;

        console.log('Sending prompt to AI...');
        const result = await session.prompt(prompt);

        let analysisResult;
        try {
            const cleanResult = result.trim().replace(/```json|```/g, '');
            analysisResult = JSON.parse(cleanResult);
            
            // Store analysis details
            const analysis = {
                isRelevant: analysisResult.relevanceScore >= 0.6,
                summary: analysisResult.summary,
                reason: analysisResult.explanation,
                confidence: analysisResult.relevanceScore,
                detailedSummary: {
                    topic: content.studyTopic,
                    pageTitle: content.title,
                    analysisTime: new Date().toISOString(),
                    fullReason: analysisResult.explanation,
                    fullSummary: analysisResult.summary
                }
            };

            // Log for debugging
            console.log('Analysis result:', analysis);

            return analysis;

        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            throw parseError;
        }
    } catch (error) {
        console.error('Chrome AI Analysis failed:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        return {
            isRelevant: true, // Fail open
            summary: "Content analysis unavailable",
            reason: `Unable to analyze content: ${error.message}`,
            confidence: 0,
            detailedSummary: {
                topic: content.studyTopic,
                pageTitle: content.title,
                analysisTime: new Date().toISOString(),
                fullReason: "Analysis failed",
                fullSummary: "Analysis could not be performed"
            }
        };
    }
}