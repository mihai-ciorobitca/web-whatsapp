chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startScript') {
        chrome.storage.local.set({ running: true }, async () => {
            const result = await new Promise((resolve, reject) => {
                chrome.storage.local.get(['minInterval', 'maxInterval', 'intervalUnit'], (result) => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve(result);
                });
            });

            const { minInterval, maxInterval, intervalUnit = 'seconds'  } = result;
            const minDelay = parseInt(minInterval, 10) * (intervalUnit === 'minutes' ? 60000 : 1000);
            const maxDelay = parseInt(maxInterval, 10) * (intervalUnit === 'minutes' ? 60000 : 1000);
            const delayTime = Math.random() * (maxDelay - minDelay) + minDelay;

            const nextMessageTime = new Date(Date.now() + delayTime).toISOString();
            chrome.storage.local.set({ nextMessageTime }, () => {
                chrome.runtime.sendMessage({ action: 'updatePopup' });
                sendResponse({ status: 'started' });
            });
        });
        return true;
    } else if (message.action === 'stopScript') {
        chrome.storage.local.set({ running: false, nextMessageTime: 'No upcoming messages' }, () => {
            chrome.runtime.sendMessage({ action: 'updatePopup' });
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
    } else if (message.action === 'startBreak') {
        chrome.storage.local.get(['breakDuration'], (result) => {
            const breakDuration = parseInt(result.breakDuration, 10) || 0;
            const breakEndTime = Date.now() + breakDuration * 60000;
    
            // The next message will be sent after the break and the random delay
            const nextMessageTime = new Date(breakEndTime).toISOString();
    
            // Set running to false and update nextMessageTime during the break
            chrome.storage.local.set({ 
                nextMessageTime 
            }, () => {
                chrome.runtime.sendMessage({ action: 'updatePopup' });
                sendResponse({ status: 'breakStarted' });
            });
        });
        return true;
    }      
});
