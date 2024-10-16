let uploadedFiles = []
let languages = []

const startRecordBtn = document.getElementById('startRecord');
const stopRecordBtn = document.getElementById('stopRecord');
const uploadRecordBtn = document.getElementById('uploadRecord');
const audioPlayback = document.getElementById('audioPlayback');
let mediaRecorder;
let audioChunks = [];
let audioBlob;

// Fetch list of uploaded files from API
async function loadUploadedFiles() {
    try {
        const response = await fetch('/api/files');
        if (!response.ok) {
            throw new Error('Failed to fetch files');
        }
        const data = JSON.parse(await response.text())
        uploadedFiles = data.message;  // Store the files into the local array

        displayFiles(uploadedFiles);
    } catch (error) {
        console.error('Error fetching the files:', error);
    }
}

function displayFiles(files) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';  // Clear any existing list

    files.forEach(file => {
        const listItem = document.createElement('div');
        listItem.style.display = 'flex';
        listItem.style.alignItems = 'center';
        listItem.style.marginBottom = '10px';

        // Create and configure the audio element
        const audioElement = document.createElement('audio');
        audioElement.controls = true;
        audioElement.src = file;

        // Extract the file name from the file URL
        const fileName = file.substring(file.lastIndexOf('/') + 1);

        // Create the image that triggers the conversion API
        const convertIcon = document.createElement('img');
        convertIcon.src = '/static/img/speech-to-text.png';  // Replace with the actual path to your icon
        convertIcon.alt = 'Convert to text';
        convertIcon.style.cursor = 'pointer';
        convertIcon.style.width = '30px';  // Adjust the size as needed
        convertIcon.style.marginLeft = '10px';

        // Add click event to call the conversion API
        convertIcon.onclick = () => {
            convertAudioToText(fileName, document.getElementById('languageSelect').value);
        };

        // Append elements to the list item
        listItem.append(convertIcon, audioElement, document.createTextNode(fileName));
        fileList.appendChild(listItem);
    });
}

// Populate language options from API
async function loadLanguages() {
    try {
        const response = await fetch('/api/languages');
        if (!response.ok) {
            throw new Error('Failed to fetch files');
        }
        const data = JSON.parse(await response.text())
        languages = data.message;  // Store the files into the local array
        await populateLanguageSelect(languages);
    } catch (error) {
        console.error('Error fetching the files:', error);
    }
}

// Populate language dropdown dynamically for supported languages
function populateLanguageSelect(languages) {
    const languageSelect = document.getElementById('languageSelect');
    languages.forEach(language => {
        const option = document.createElement('option');
        option.value = language;
        option.textContent = language;
        languageSelect.appendChild(option)
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
    showLoadingOverlay()
    const formData = new FormData();
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');  // Generate a timestamp
    formData.append('file', audioBlob, `recording_${timestamp}.wav`);

    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        await loadUploadedFiles(); // Reload file list
    } else {
        alert('Request failed');
    }
    hideLoadingOverlay()
});

// Upload audio file
document.getElementById('uploadFileBtn').addEventListener('click', async () => {
    showLoadingOverlay()
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
        document.getElementById('audioFileInput').value = ''
        await loadUploadedFiles(); // Reload file list
    } else {
        alert('Request failed');
    }
    hideLoadingOverlay()
});

// Convert text to speech
document.getElementById('textToSpeechBtn').addEventListener('click', async () => {
    showLoadingOverlay()
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

    if (response.ok) {
        document.getElementById('textToSpeechInput').value = ''
        await loadUploadedFiles(); // Reload file list
    } else {
        alert('Request failed');
    }
    hideLoadingOverlay()
});

// Function to call the API for converting audio to text
async function convertAudioToText(fileName, language) {
    try {
        const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileName, language})
        });

        const result = await response.json();
        if (response.ok) {
            alert(`Conversion successful: ${result.message}`);
        } else {
            alert(`Failed to convert: ${result.error}`);
        }
    } catch (error) {
        console.error('Error converting audio to text:', error);
        alert('An error occurred during conversion.');
    }
}

// Show the overlay
function showLoadingOverlay() {
    document.getElementById('overlay').style.display = 'flex';
}

// Hide the overlay
function hideLoadingOverlay() {
    document.getElementById('overlay').style.display = 'none';
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadUploadedFiles();
    loadLanguages();
});