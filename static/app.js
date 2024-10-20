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
    } catch (error) {
        console.error('Error fetching the files:', error);
    }
    displayFiles(uploadedFiles);
}

function displayFiles(filemap) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';  // Clear any existing list
    let textFiles = []
    let imageFiles = []
    let sentimentFiles = []
    let image_dir = '/static/img/'

    const files = Object.keys(filemap);
    files.forEach(file => {
        if (file.endsWith('.txt')) {
            if (file.indexOf('_sentiment') < 0) {
                textFiles.push(file);
            } else {
                sentimentFiles.push(file);
            }
        } else {
            imageFiles.push(file);
        }
    })

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

        const sentimentIcon = document.createElement('img');
        sentimentIcon.src = image_dir + getSentimentIcon(filemap[file]);
        sentimentIcon.alt = 'Analyze sentiment';
        sentimentIcon.style.cursor = 'pointer';
        sentimentIcon.style.width = '30px';  // Adjust the size as needed
        sentimentIcon.style.marginLeft = '10px';
        sentimentIcon.id = 'sentiment-icon-' + i;
        sentimentIcon.onclick = () => {
            analyzeSentiment(filename, sentimentIcon.id);
        };

        // Create the image that calls the conversion API
        const convertIcon = document.createElement('img');
        convertIcon.src = image_dir + 'speech-to-text.png';  // Replace with the actual path to your icon
        convertIcon.alt = 'Convert to text';
        convertIcon.style.cursor = 'pointer';
        convertIcon.style.width = '30px';  // Adjust the size as needed
        convertIcon.style.marginLeft = '10px';
        convertIcon.onclick = () => {
            convertAudioToText(filename);
        };

        const anchor = document.createElement('a');
        anchor.href = file;
        anchor.text = filename
        tabledata.append(trashIcon, sentimentIcon, convertIcon, audioElement, anchor);
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

        // Create the image for sentiment analysis
        const sentimentIcon = document.createElement('img');
        sentimentIcon.src = image_dir + getSentimentIcon(filemap[file]);
        sentimentIcon.alt = 'Analyze sentiment';
        sentimentIcon.style.cursor = 'pointer';
        sentimentIcon.style.width = '30px';  // Adjust the size as needed
        sentimentIcon.style.marginLeft = '10px';
        sentimentIcon.id = 'sentiment-icon-' + i;
        sentimentIcon.onclick = () => {
            analyzeSentiment(filename, sentimentIcon.id);
        };

        const textLink = document.createElement('a');
        textLink.href = file;
        textLink.text = file.substring(file.lastIndexOf('/') + 1);
        textLink.target = "_new"

        tabledata.append(trashIcon, sentimentIcon, textLink);
        tablerow.appendChild(tabledata);
        table.appendChild(tablerow)
        i++
    })

    //Generating elements for sentiment files
    sentimentFiles.forEach(file => {
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

function getSentimentIcon(sentiment) {
    let value = ''
    switch (sentiment) {
    case 'positive':
        value = 'positive.png'
        break;
    case 'neutral':
        value = 'neutral.png'
        break;
    case 'negative':
        value = 'negative.png'
        break;
    default:
        value = 'sentiment-analysis.png'
    }
    return value
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

    const languageSelectForSTT = document.getElementById('languageSelectForSTT');
    languages.forEach(language => {
        const option = document.createElement('option');
        option.value = language;
        option.textContent = language;
        languageSelectForSTT.appendChild(option)
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
async function convertAudioToText(filename) {
    showLoadingOverlay()
    let language = document.getElementById('languageSelectForSTT').value
    const response = await fetch('/api/speech-to-text', {
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
        alert('Request failed');
    }
    hideLoadingOverlay()
}

async function analyzeSentiment(filename, icon_id) {
    showLoadingOverlay()
    let language = document.getElementById('languageSelectForSTT').value
    const response = await fetch('/api/analyze-sentiment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename})
    });
    const data = JSON.parse(await response.text())

    if (response.ok) {
        sentiment = data.sentiment
        //alert('Analyzed Sentiment: ' + sentiment)
        document.getElementById(icon_id).src='/static/img/' + sentiment + '.png'
    } else {
        alert('Request failed');
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
    loadLanguages();
});