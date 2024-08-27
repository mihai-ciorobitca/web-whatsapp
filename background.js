chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startScript") {
        chrome.storage.local.get(['warmup', 'messageTemplate', 'minInterval', 'maxInterval', 'intervalUnit'], (result) => {
            const { warmup = false, messageTemplate = '', minInterval = 0, maxInterval = 0, intervalUnit = 'seconds' } = result;

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length === 0) {
                    console.error('No active tab found');
                    sendResponse({ error: 'No active tab found' });
                    return;
                }

                const tabId = tabs[0].id;
                if (!tabId) {
                    console.error('Tab ID is undefined');
                    sendResponse({ error: 'Tab ID is undefined' });
                    return;
                }

                chrome.scripting.executeScript({
                    target: { tabId },
                    function: mainFunction,
                    args: [warmup, messageTemplate, minInterval, maxInterval, intervalUnit]
                }).then(() => {
                    sendResponse({ status: 'Script started' });
                }).catch(error => {
                    console.error('Error injecting script:', error);
                    sendResponse({ error: 'Script injection failed' });
                });

                return true;
            });
        });
    } else if (request.action === "stopScript") {
        chrome.storage.local.set({ running: false });
        console.log("Stop script message received");
    }
});

function mainFunction(warmup, messageTemplate, minInterval, maxInterval, intervalUnit) {
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
            buttonPin.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
        chrome.storage.local.get(['warmup', 'sending', 'sent', 'running'], async (result) => {
            let { warmup, sending, sent, running } = result;
            while (running) {
                try {
                    if (sending.length === 0) {
                        chrome.storage.local.set({ running: false });
                        chrome.runtime.sendMessage({ action: "updatePopup", status: "Stopped", nextMessageTime: "N/A" });
                        return;
                    }

                    let currentNumber = sending.shift();
                    const formattedMessage = messageTemplate.replace("{name}", currentNumber.name || '');

                    if (warmup) {
                        sending.push(currentNumber);
                    } else {
                        sent.push(currentNumber);
                    }

                    await openOwnConversation();
                    await delay(2000);
                    await sendMessage(currentNumber.number);
                    await delay(2000);
                    await switchConversation();
                    await delay(2000);
                    await sendMessage(formattedMessage);

                    const randomDelay = getRandomInterval(minInterval, maxInterval, intervalUnit);
                    const nextMessageTime = new Date(Date.now() + randomDelay).toLocaleTimeString();

                    chrome.storage.local.set({ sending, sent, nextMessageTime });
                    chrome.runtime.sendMessage({ action: "updatePopup", status: "Running...", nextMessageTime });

                    await delay(randomDelay);

                } catch (error) {
                    console.error('Error processing messages:', error);
                    chrome.storage.local.set({ running: false });
                }
            }
        });
    }
    processMessages();
}
