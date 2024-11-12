let uploadedFiles = []
let languages = []

const startRecording = document.getElementById('startRecording');
const stopRecording = document.getElementById('stopRecording');
const uploadRecording = document.getElementById('uploadRecording');
const audioPlayback = document.getElementById('audioPlayback');
let mediaRecorder;
let audioChunks = [];
let audioBlob;

// Fetch list of uploaded files from API
async function loadUploadedFiles() {
    try {
        const response = await fetch('/api/files/v2');
        if (!response.ok) {
            throw new Error('Failed to fetch files');
        }
        const data = JSON.parse(await response.text())
        uploadedFiles = data.message;  // Store the files into the local array
    } catch (error) {
        console.error('Error fetching the files:', error);
    }
    displayFiles(uploadedFiles);
}

function displayFiles(files) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';  // Clear any existing list
    let textFiles = []
    let imageFiles = []
    let image_dir = '/static/img/'

    for (let file of files) {
        if (file.endsWith('.txt')) {
            textFiles.push(file);
        } else {
            imageFiles.push(file);
        }
    }

    const table = document.createElement('table');
    i=0
    //Generating elements for image files
    imageFiles.forEach(file => {
        const tablerow = document.createElement('tr');
        const tabledata = document.createElement('td');
        tabledata.style.display = 'flex';
        tabledata.style.alignItems = 'center';
        tabledata.style.marginBottom = '10px';

        // Create and configure the audio element
        const audioElement = document.createElement('audio');
        audioElement.controls = true;
        audioElement.src = file;

        // Extract the file name from the file URL
        const filename = file.substring(file.lastIndexOf('/') + 1);

        const trashIcon = document.createElement('img');
        trashIcon.src = image_dir + 'trash.png';  // Replace with the actual path to your icon
        trashIcon.alt = 'Delete file';
        trashIcon.style.cursor = 'pointer';
        trashIcon.style.width = '30px';  // Adjust the size as needed
        trashIcon.style.marginLeft = '10px';
        trashIcon.onclick = () => {
            deleteFile(filename);
        };

        const anchor = document.createElement('a');
        anchor.href = file;
        anchor.text = filename
        tabledata.append(trashIcon, audioElement, anchor);
        tablerow.appendChild(tabledata);
        table.appendChild(tablerow)
        i++
    });

    //Generating elements for text files
    textFiles.forEach(file => {
        const tablerow = document.createElement('tr');
        const tabledata = document.createElement('td');
        tabledata.style.display = 'flex';
        tabledata.style.alignItems = 'center';
        tabledata.style.marginBottom = '10px';

        const filename = file.substring(file.lastIndexOf('/') + 1);

        const trashIcon = document.createElement('img');
        trashIcon.src = image_dir + 'trash.png';  // Replace with the actual path to your icon
        trashIcon.alt = 'Delete file';
        trashIcon.style.cursor = 'pointer';
        trashIcon.style.width = '30px';  // Adjust the size as needed
        trashIcon.style.marginLeft = '10px';
        trashIcon.onclick = () => {
            deleteFile(filename);
        };

        const textLink = document.createElement('a');
        textLink.href = file;
        textLink.text = file.substring(file.lastIndexOf('/') + 1);
        textLink.target = "_new"

        tabledata.append(trashIcon, textLink);
        tablerow.appendChild(tabledata);
        table.appendChild(tablerow)
        i++
    })
    fileList.appendChild(table)
}

// Start audio recording
startRecording.addEventListener('click', async () => {
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
        uploadRecording.disabled = false;
    };

    startRecording.disabled = true;
    stopRecording.disabled = false;
});

// Stop audio recording
stopRecording.addEventListener('click', () => {
    mediaRecorder.stop();
    startRecording.disabled = false;
    stopRecording.disabled = true;
});

// Upload recorded audio
uploadRecording.addEventListener('click', async () => {
    showLoadingOverlay()
    const formData = new FormData();
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');  // Generate a timestamp
    formData.append('file', audioBlob, `recording_${timestamp}.wav`);
    formData.append('prompt', document.getElementById('prompt').value);

    const response = await fetch('/api/upload/v2', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        await playAudioResponse(response)
        await loadUploadedFiles(); // Reload file list
    } else {
        alert('Request failed with status: ' + response.status);
    }
    hideLoadingOverlay();
    startRecording.disabled = false;
    stopRecording.disabled = true;
    uploadRecording.disabled = true;
});

// Upload audio file
document.getElementById('uploadFile').addEventListener('click', async () => {
    showLoadingOverlay()
    const fileInput = document.getElementById('audioFileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file to upload');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('prompt', document.getElementById('prompt').value);

    const response = await fetch('/api/upload/v2', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        playAudioResponse(response)
        await loadUploadedFiles(); // Reload file list
    } else {
        alert('Request failed with status: ' + response.status);
    }
    document.getElementById('audioFileInput').value = ''
    hideLoadingOverlay()
});

async function playAudioResponse(response) {

    const audioUrl = `data:${response.mimeType};base64,${response.audioContent}`;
    const audioElement = document.getElementById('responseAudioPlayback')
    audioElement.src = audioUrl;
    audioElement.disabled = false
    audioElement.play();
}

// Function to call the API for converting audio to text
async function convertAudioToText(filename) {
    showLoadingOverlay()
    let language = document.getElementById('languageSelectForSTT').value
    const response = await fetch('/api/speech-to-text/v2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, language})
    });
    const result = await response.json();

    if (response.ok) {
        await loadUploadedFiles(); // Reload file list
    } else {
        alert('Request failed with status: ' + response.status);
    }
    hideLoadingOverlay()
}

async function deleteFile(filename) {
    showLoadingOverlay()
    const response = await fetch('/api/delete-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename})
    });
    hideLoadingOverlay()
    loadUploadedFiles()
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
});