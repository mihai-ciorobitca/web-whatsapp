async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomInterval(min, max, unit) {
    const multiplier = unit === 'minutes' ? 60000 : 1000;
    return Math.random() * (max - min) + min * multiplier;
}

async function waitForElement(selector, timeout = 10000, baseElement = document) {
    const start = Date.now();
    let element = null;
    while (!element && (Date.now() - start) < timeout) {
        element = baseElement.querySelector(selector);
        await delay(500);
    }
    if (!element) throw new Error(`Element ${selector} not found within ${timeout}ms`);
    return element;
}

async function sendMessage(message) {
    try {
        let inputField = await waitForElement("[aria-placeholder='Type a message']");
        inputField.focus();
        document.execCommand('insertText', false, message);
        await delay(1000);
        let sendButton = await waitForElement("[aria-label='Send']");
        sendButton.click();
    } catch (error) {
        console.error('Error in sendMessage:', error);
    }
}

async function openOwnConversation() {
    try {
        let pinnedChat = await waitForElement('[data-icon="pinned2"]');
        let buttonPin = pinnedChat.parentElement;
        buttonPin.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        buttonPin.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        buttonPin.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } catch (error) {
        console.error('Error in openOwnConversation:', error);
    }
}

async function switchConversation() {
    try {
        let messagesList = await document.getElementsByClassName("_akbu");
        let lastMessage = await waitForElement("a", 10000, messagesList[messagesList.length - 1]);
        lastMessage.click();
        await delay(2000);
        let chatList = await waitForElement("[role='application']");
        let chatButton = await waitForElement("li", 10000, chatList);
        chatButton.click();
        await delay(1000);
    } catch (error) {
        console.error('Error in switchConversation:', error);
    }
}

async function processMessages() {
    try {
        while (true) {
            // Fetch current state
            const result = await new Promise((resolve, reject) => {
                chrome.storage.local.get(['sending', 'sent', 'warmup', 'running', 'messageTemplate', 'minInterval', 'maxInterval', 'intervalUnit'], (result) => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve(result);
                });
            });

            let { sending = [], sent = [], warmup = false, running = false, messageTemplate = '', minInterval = 0, maxInterval = 0, intervalUnit = 'seconds' } = result;

            // Break the loop if there are no messages to process
            if (sending.length === 0 || !running) {
                break;
            }

            // Process the first message in the queue
            let currentNumber = sending.shift();
            const formattedMessage = messageTemplate.replace("{name}", currentNumber.name || '');
            if (warmup) {
                sending.push(currentNumber);
            } else {
                sent.push(currentNumber);
            }

            await new Promise((resolve, reject) => {
                chrome.storage.local.set({ sending, sent }, () => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve();
                });
            });

            await openOwnConversation();
            await delay(2000);
            await sendMessage(currentNumber.number);
            await delay(2000);
            await switchConversation();
            await delay(2000);
            await sendMessage(formattedMessage);
            chrome.runtime.sendMessage({ action: 'updatePopup' });
        }

        // After all messages have been processed
        await new Promise((resolve, reject) => {
            chrome.storage.local.set({ running: false }, () => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve();
            });
        });
        chrome.runtime.sendMessage({ action: 'updatePopup' });

    } catch (error) {
        console.error('Error processing messages:', error);
        // Ensure that running is set to false and popup is updated even if an error occurs
        await new Promise((resolve, reject) => {
            chrome.storage.local.set({ running: false }, () => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve();
            });
        });
        chrome.runtime.sendMessage({ action: 'updatePopup' });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'processMessages') {
        processMessages();
    }
});
