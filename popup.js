chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updatePopup') {
        chrome.storage.local.get(['warmup', 'messageTemplate', 'minInterval', 'maxInterval', 'intervalUnit', 'running', 'nextMessageTime', 'sending', 'sent'], (result) => {
            updatePopup(result);
            toggleControls(result.running);
        });
    }
});

function toggleControls(disable) {
    $('#load').prop('disabled', disable);
    $('#start').prop('disabled', disable);
    $('#stop').prop('disabled', !disable);
    $('#fileInput').prop('disabled', disable);
    $('#messageTemplate').prop('disabled', disable);
    $('#minInterval').prop('disabled', disable);
    $('#maxInterval').prop('disabled', disable);
    $('#intervalUnit').prop('disabled', disable);
    $('#status').text(disable ? 'Running' : 'Stopped');
    $('#warmup').prop('disabled', disable);
    $('#breakDuration').prop('disabled', !disable);
    $('#break').prop('disabled', !disable);
}

function updatePopup(result) {
    const { warmup = false, messageTemplate = '', minInterval = '', maxInterval = '', intervalUnit = 'seconds', sending = [], sent = [], nextMessageTime = 'No upcoming messages' } = result;
    $('#warmup').prop('checked', warmup);
    $('#messageTemplate').val(messageTemplate);
    $('#minInterval').val(minInterval);
    $('#maxInterval').val(maxInterval);
    $('#intervalUnit').val(intervalUnit);
    $('#sending').val(sending.map(n => n.number).join('\n'));
    $('#sent').val(sent.map(n => n.number).join('\n'));
    const formattedNextMessageTime = nextMessageTime === 'No upcoming messages'
        ? nextMessageTime
        : new Date(nextMessageTime).toLocaleString();
    $('#nextMessage').text(`Next message at: ${formattedNextMessageTime}`);
}

$(document).ready(() => {
    chrome.storage.local.get(['warmup', 'messageTemplate', 'minInterval', 'maxInterval', 'intervalUnit', 'running', 'nextMessageTime', 'sending', 'sent'], (result) => {
        const { running } = result;
        updatePopup(result);
        toggleControls(running);
    });
})

$('#stop').on('click', () => {
    chrome.runtime.sendMessage({ action: 'stopScript' }, (response) => {
        toggleControls(false);
    });
})


$('#warmup').on('change', () => {
    const warmup = $('#warmup').prop('checked');
    chrome.runtime.sendMessage({ action: 'warmupScript', warmup: warmup }, (response) => {
        console.log(`Warmup set to ${warmup}`);
    });
});

$('#breakDuration').on('input', () => {
    const breakDuration = $('#breakDuration').val();
    chrome.storage.local.set({ breakDuration: breakDuration }, () => {
        console.log('Break duration updated.');
    });
});

$('#break').on('click', () => {
    chrome.runtime.sendMessage({ action: 'startBreak' }, (response) => {
        toggleControls(false);
    });
});

$('#load').on('click', function () {
    try {
        const fileInput = $('#fileInput')[0];
        if (!fileInput.files.length) {
            alert('Please select a CSV file.');
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function (event) {
            try {
                const csvText = event.target.result;
                const rows = csvText.split('\n').map(row => row.trim()).filter(row => row);

                const numbers = rows.map(row => {
                    const [name, number] = row.split(',').map(cell => cell.trim());
                    return { name, number };
                });

                if (numbers.some(item => !item.name || !item.number)) {
                    alert('CSV must have exactly two columns: name and number.');
                    return;
                }

                chrome.storage.local.set({
                    sending: numbers,
                    sent: []
                }, function () {
                    $('#sending').val(numbers.map(n => n.number).join('\n'));
                    $('#sent').val('');
                    $('#fileInput').val('');
                });

            } catch (error) {
                alert('An error occurred while processing the CSV: ' + error.message);
            }
        };

        reader.onerror = function () {
            alert('An error occurred while reading the file.');
        };

        reader.readAsText(file);

    } catch (error) {
        alert('An unexpected error occurred: ' + error.message);
    }
});

// Auto-save message template
$('#messageTemplate').on('input', () => {
    const messageTemplate = $('#messageTemplate').val();
    chrome.storage.local.set({ messageTemplate: messageTemplate }, () => {
        console.log('Message template updated.');
    });
});

// Auto-save min interval
$('#minInterval').on('input', () => {
    const minInterval = $('#minInterval').val();
    chrome.storage.local.set({ minInterval: minInterval }, () => {
        console.log('Min interval updated.');
    });
});

// Auto-save max interval
$('#maxInterval').on('input', () => {
    const maxInterval = $('#maxInterval').val();
    chrome.storage.local.set({ maxInterval: maxInterval }, () => {
        console.log('Max interval updated.');
    });
});

// Auto-save interval unit
$('#intervalUnit').on('change', () => {
    const intervalUnit = $('#intervalUnit').val();
    chrome.storage.local.set({ intervalUnit: intervalUnit }, () => {
        console.log('Interval unit updated.');
    });
});

$('#start').on('click', () => {
    // Validation checks
    const messageTemplate = $('#messageTemplate').val();
    const minInterval = $('#minInterval').val();
    const maxInterval = $('#maxInterval').val();
    const intervalUnit = $('#intervalUnit').val();
    const sending = $('#sending').val();

    if (!messageTemplate || !minInterval || !maxInterval || !intervalUnit || !sending) {
        alert('Please ensure all settings are correctly filled out before starting.');
        return;
    }

    if (parseInt(minInterval, 10) > parseInt(maxInterval, 10)) {
        alert('Min Interval cannot be greater than Max Interval.');
        return;
    }

    chrome.runtime.sendMessage({ action: 'startScript' }, (response) => {
        toggleControls(true);
    });
});


