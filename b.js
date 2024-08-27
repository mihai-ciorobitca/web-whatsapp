chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startScript') {
        chrome.storage.local.set({ running: true }, () => {
            sendResponse({ status: 'started' });
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'processMessages' });
            });
        });
        return true;
    } else if (message.action === 'stopScript') {
        chrome.storage.local.set({ running: false }, () => {
            sendResponse({ status: 'stopped' });
        });
        return true;
    } else if (message.action === 'warmupScript') {
        const { warmup } = message;
        chrome.storage.local.set({ warmup: warmup }, () => {
            sendResponse({ status: 'warmup' });
        });
        return true;
    } else if (message.action === 'loadScript') {
        const { numbers } = message;
        chrome.storage.local.set({ sending: numbers, sent: [] }, () => {
            sendResponse({ status: 'load' });
        });
        return true;
    }
});
