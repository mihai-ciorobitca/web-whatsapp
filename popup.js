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
}

$(document).ready(() => {
    chrome.storage.local.get(['warmup', 'messageTemplate', 'minInterval', 'maxInterval', 'intervalUnit', 'running', 'nextMessageTime', 'sending', 'sent'], (result) => {
        const { warmup = false, messageTemplate = '', minInterval = '', maxInterval = '', intervalUnit = 'seconds', running = false, sending = [], sent = [] } = result;

        $('#warmup').prop('checked', warmup);
        $('#messageTemplate').val(messageTemplate);
        $('#minInterval').val(minInterval);
        $('#maxInterval').val(maxInterval);
        $('#intervalUnit').val(intervalUnit);
        $('#sending').val(sending.map(n => n.number).join('\n'));
        $('#sent').val(sent.map(n => n.number).join('\n'));

        toggleControls(running);
    });
});

$('#load').on('click', function () {
    const fileInput = $('#fileInput')[0];
    if (!fileInput.files.length) {
        alert('Please select a CSV file.');
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (event) {
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
        chrome.storage.local.set({ sending: numbers, sent: [] }, function () {
            $('#sending').val(numbers.map(n => n.number).join('\n'));
        });
    };
    reader.readAsText(file);
});

$('#start').on('click', () => {
    chrome.storage.local.set({ running: true }, () => {
        toggleControls(true);
        chrome.runtime.sendMessage({ action: "startScript" }, () => {
            console.log('Start script message sent');
        });
    });
});

$('#stop').on('click', () => {
    chrome.storage.local.set({ running: false }, () => {
        toggleControls(false);
        chrome.runtime.sendMessage({ action: "stopScript" }, () => {
            console.log('Stop script message sent');
        });
    });
});

$('#warmup').on('change', () => {
    const warmup = $('#warmup').prop('checked');
    chrome.storage.local.set({ warmup });
});
