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
        let inputField = await waitForElement("[aria-placeholder='Type a message']"); //document.querySelector("._ak1r").querySelector("[role='textbox']")
        inputField.focus();
        document.execCommand('insertText', false, message);
        await delay(3000);
        let sendButton = await waitForElement("[aria-label='Send']"); //document.querySelector("._ak1r").querySelector("[data-icon='send']").parentElement.click()
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
        await delay(3000);
        let chatList = await waitForElement("[role='application']");
        let chatButton = await waitForElement("li", 10000, chatList);
        chatButton.click();
        await delay(3000);
    } catch (error) {
        console.error('Error in switchConversation:', error);
    }
}

async function processMessages() {
    try {
        // Set processing flag to true to indicate processMessages is running
        await new Promise((resolve, reject) => {
            chrome.storage.local.set({ processing: true }, () => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve();
            });
        });

        const result = await new Promise((resolve, reject) => {
            chrome.storage.local.get(['sending', 'sent', 'warmup', 'running', 'messageTemplate', 'minInterval', 'maxInterval', 'intervalUnit'], (result) => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve(result);
            });
        });

        let { sending = [], sent = [], warmup = false, running = false, messageTemplate = '', minInterval = 0, maxInterval = 0, intervalUnit = 'seconds' } = result;

        // Check if we should stop
        if (sending.length === 0 || !running) {
            await new Promise((resolve, reject) => {
                chrome.storage.local.set({ 
                    running: false, 
                    nextMessageTime: 'No upcoming messages', 
                    processing: false 
                }, () => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve();
                });
            });
            chrome.runtime.sendMessage({ action: 'updatePopup' });
            return;
        }

        // Process the first message in the queue
        let currentNumber = sending.shift();

        const messages = messageTemplate.trim().split('\n');
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const formattedMessage = randomMessage.replace("{name}", currentNumber.name || '');

        if (warmup) {
            sending.push(currentNumber);
        } else {
            sent.push(currentNumber);
        }

        // Save updated lists
        await new Promise((resolve, reject) => {
            chrome.storage.local.set({ sending, sent }, () => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve();
            });
        });

        // Calculate random delay
        const minDelay = parseInt(minInterval, 10) * (intervalUnit === 'minutes' ? 60000 : 1000);
        const maxDelay = parseInt(maxInterval, 10) * (intervalUnit === 'minutes' ? 60000 : 1000);
        const delayTime = Math.random() * (maxDelay - minDelay) + minDelay;

        // Calculate next message time
        const nextMessageTime = new Date(Date.now() + delayTime).toISOString();

        // Update next message time in storage
        await new Promise((resolve, reject) => {
            chrome.storage.local.set({ nextMessageTime }, () => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve();
            });
        });

        await openOwnConversation();
        await delay(3000);
        await sendMessage(currentNumber.number);
        await delay(3000);
        await switchConversation();
        await delay(3000);
        await sendMessage(formattedMessage);
        chrome.runtime.sendMessage({ action: 'updatePopup' });

    } catch (error) {
        console.error('Error processing messages:', error);
    } finally {
        // Check again if the sending list is empty and reset running to false if necessary
        const result = await new Promise((resolve, reject) => {
            chrome.storage.local.get(['sending'], (result) => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve(result);
            });
        });

        const { sending } = result;

        if (sending.length === 0) {
            // Set running to false when the process finishes and no more messages are pending
            await new Promise((resolve, reject) => {
                chrome.storage.local.set({ running: false, processing: false, nextMessageTime: 'No upcoming messages' }, () => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve();
                });
            });
        } else {
            // If not done, set processing to false but leave running true for the next cycle
            await new Promise((resolve, reject) => {
                chrome.storage.local.set({ processing: false }, () => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve();
                });
            });
        }
    }
}

async function checkAndSendMessage() {
    try {
        const result = await new Promise((resolve, reject) => {
            chrome.storage.local.get(['running', 'nextMessageTime', 'sending', 'processing'], (result) => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve(result);
            });
        });

        // Correctly reference variables from the `result` object
        const { running, nextMessageTime, sending, processing } = result;
        console.log('Current state:', { running, nextMessageTime, sending, processing });

        // Exit if processMessages is already running
        if (processing) {
            console.log('processMessages is already running, skipping execution.');
            return;
        }

        if (running && sending.length > 0) {
            const now = new Date();
            if (nextMessageTime && nextMessageTime !== 'No upcoming messages') {
                const nextMessageDate = new Date(nextMessageTime);

                // Check if nextMessageDate is valid
                if (isNaN(nextMessageDate.getTime())) {
                    console.error('Invalid nextMessageTime:', nextMessageTime);
                    return; // Early exit if the date is invalid
                }

                if (nextMessageDate <= now) {
                    //await chrome.storage.local.set({ nextMessageTime: null });
                    await processMessages();
                }
            }
        }
    } catch (error) {
        console.error('Error in checkAndSendMessage:', error);
        // Handle cleanup if necessary
        await chrome.storage.local.set({ running: false });
    }
}

// Start the interval to check for messages
setInterval(checkAndSendMessage, 1000);
