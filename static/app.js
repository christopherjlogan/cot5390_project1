const startRecordBtn = document.getElementById('startRecord');
const stopRecordBtn = document.getElementById('stopRecord');
const uploadRecordBtn = document.getElementById('uploadRecord');
const audioPlayback = document.getElementById('audioPlayback');
const fileList = document.getElementById('fileList');

let mediaRecorder;
let audioChunks = [];
let audioBlob;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadUploadedFiles();
    loadLanguages();
});

// Fetch list of uploaded files from API
async function loadUploadedFiles() {
    const response = await fetch('/api/files');
    const files = await response.json();

    fileList.innerHTML = 'Loading list of files...'; // Clear file list

    files.forEach(file => {
        const listItem = document.createElement('div');
        const audioElement = document.createElement('audio');
        audioElement.controls = true;
        audioElement.src = file;

        const fileName = file.substring(file.lastIndexOf('/') + 1);

        const convertForm = document.createElement('form');
        convertForm.innerHTML = `
            <input type="hidden" name="filename" value="${file}">
            <label for="language">Language:</label>
            <select id="languageSelect-${fileName}" required></select>
            <button type="button" onclick="convertSpeechToText('${fileName}')">Convert to Text</button>
        `;
        listItem.append(audioElement, fileName, convertForm);
        fileList.appendChild(listItem);

        // Populate languages for each file form
        populateLanguageSelect(`languageSelect-${fileName}`);
    });
}

// Populate language options from API
async function loadLanguages() {
    const response = await fetch('/api/languages');
    const languages = await response.json();

    const languageSelect = document.getElementById('languageSelect');
    languages.forEach(language => {
        const option = document.createElement('option');
        option.value = language;
        option.textContent = language;
        languageSelect.appendChild(option);
    });
}

// Populate language dropdown dynamically for uploaded files
async function populateLanguageSelect(selectId) {
    const response = await fetch('/api/languages');
    const languages = await response.json();

    const languageSelect = document.getElementById(selectId);
    languages.forEach(language => {
        const option = document.createElement('option');
        option.value = language;
        option.textContent = language;
        languageSelect.appendChild(option);
    });
}

// Start audio recording
startRecordBtn.addEventListener('click', async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();

    mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        audioChunks = [];
        const audioURL = URL.createObjectURL(audioBlob);
        audioPlayback.src = audioURL;
        uploadRecordBtn.disabled = false;
    };

    startRecordBtn.disabled = true;
    stopRecordBtn.disabled = false;
});

// Stop audio recording
stopRecordBtn.addEventListener('click', () => {
    mediaRecorder.stop();
    startRecordBtn.disabled = false;
    stopRecordBtn.disabled = true;
});

// Upload recorded audio
uploadRecordBtn.addEventListener('click', async () => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');

    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        alert('Recording uploaded successfully');
        loadUploadedFiles(); // Reload file list
    } else {
        alert('Failed to upload recording');
    }
});

// Upload audio file
document.getElementById('uploadFileBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('audioFileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file to upload');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        alert('File uploaded successfully');
        loadUploadedFiles(); // Reload file list
    } else {
        alert('Failed to upload file');
    }
});

// Convert text to speech
document.getElementById('textToSpeechBtn').addEventListener('click', async () => {
    const text = document.getElementById('textToSpeechInput').value;
    const language = document.getElementById('languageSelect').value;
    const gender = document.getElementById('genderSelect').value;

    const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, language, gender })
    });

    const result = await response.json();
    alert(result.message);
});

// Convert uploaded audio to text
async function convertSpeechToText(fileName) {
    const language = document.getElementById(`languageSelect-${fileName}`).value;

    const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: fileName, language })
    });

    const result = await response.json();
    alert(result.message);
}