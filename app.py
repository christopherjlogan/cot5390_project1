import os
import io
from flask import Flask, render_template, request, redirect, url_for, send_from_directory, session
from werkzeug.utils import secure_filename
from datetime import datetime
from typing import Sequence
from google.oauth2 import service_account
from google.cloud import storage, speech, texttospeech

# Create a Flask app
app = Flask(__name__)
app.secret_key = 'COT5930'

SERVICE_ACCOUNT_FILE = "credentials/service-account.json"
# Check if the service account file exists
if os.path.exists(SERVICE_ACCOUNT_FILE):
    print("Service account file found, loading credentials...")
    credentials = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE)
    ttsclient = texttospeech.TextToSpeechClient(credentials=credentials)
    sttclient = speech.SpeechClient(credentials=credentials)
    gcsclient = storage.Client(credentials=credentials)
else:
    print("No service account file found, using Application Default Credentials (ADC)...")
    # Use Application Default Credentials (ADC)
    ttsclient = texttospeech.TextToSpeechClient()
    sttclient = speech.SpeechClient()
    gcsclient = storage.Client()

# Set the upload folder and allowed extensions
UPLOAD_FOLDER = '/uploads'
BUCKET_NAME = 'cot5390project1.appspot.com'
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg'}

# Ensure the upload directory exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Function to check if file extension is allowed
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_uploaded_files(folder):
    bucket = gcsclient.get_bucket(BUCKET_NAME)  # Get the bucket
    blobs = bucket.list_blobs(prefix=folder)  # List files with the folder path prefix

    files = []
    for blob in blobs:
        # Exclude the folder itself from the list, only add files
        if not blob.name.endswith("/"):
            files.append(blob.name)
    return files

def upload_to_cloud_storage(file, filename, folder):
    bucket = gcsclient.get_bucket(BUCKET_NAME)
    blob = bucket.blob(f"{folder}/{filename}")
    blob.upload_from_file(file)
    return blob.public_url

def unique_languages_from_voices(voices: Sequence[texttospeech.Voice]):
    language_list = []
    for voice in voices:
        for language_code in voice.language_codes:
            if language_code not in language_list:  # Check for uniqueness
                language_list.append(language_code)
    return language_list

def list_languages():
    response = ttsclient.list_voices()
    languages = unique_languages_from_voices(response.voices)
    print(f" Languages: {len(languages)} ".center(60, "-"))
    for i, language in enumerate(sorted(languages)):
        print(f"{language:>10}", end="\n" if i % 5 == 4 else "")
    return languages

# Route to display the HTML page with audio files
@app.route('/')
def index():
    # Get the list of uploaded audio files
    files = get_uploaded_files(UPLOAD_FOLDER)
    languages = list_languages()
    transcript = session.pop('transcript', '')
    return render_template('index.html', files=files, languages=languages, transcript=transcript)

# Route to handle file uploads
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return redirect(request.url)

    file = request.files['file']
    if file and allowed_file(file.filename):
        # Use a timestamp-based filename
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        ext = file.filename.rsplit('.', 1)[1].lower()  # Get file extension
        filename = f"recording_{timestamp}.{ext}"
        filename = secure_filename(filename)  # Secure the filename

        # Save the file
        #file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        public_url = upload_to_cloud_storage(file, filename, UPLOAD_FOLDER)

    return redirect(url_for('index'))

@app.route('/text-to-speech', methods=['POST'])
def text_to_speech():
    text_input = request.form['text']
    selected_language = request.form['language']
    selected_gender = request.form['gender']

    # Set the text input for synthesis

    synthesis_input = texttospeech.SynthesisInput(text=text_input)

    # Set the voice parameters, using the selected language
    voice = texttospeech.VoiceSelectionParams(
        language_code=selected_language,
        ssml_gender=selected_gender
    )

    # Select the audio format
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    # Perform the text-to-speech request
    response = ttsclient.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    # Save the audio file
    timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    filename = f"tts_{timestamp}_{selected_language}_{selected_gender}.mp3"
    upload_to_cloud_storage(response.audio_content, filename, UPLOAD_FOLDER)

    return redirect(url_for('index'))

def download_blob_as_bytes(bucket_name, blob_name):
    """Downloads a blob from the bucket as bytes."""
    client = storage.Client()
    bucket = client.get_bucket(bucket_name)
    blob = bucket.blob(blob_name)

    return blob.download_as_bytes()

@app.route('/speech-to-text', methods=['POST'])
def speech_to_text():
    filename = request.form['filename']
    file_path = f"{UPLOAD_FOLDER}/{filename}"

    # Download the audio file from Google Cloud Storage
    file_content = download_blob_as_bytes(BUCKET_NAME, file_path)

    # Configure the audio and recognition settings
    audio = speech.RecognitionAudio(content=file_content)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.MP3,  # Adjust based on your file type (MP3 assumed here)
        sample_rate_hertz=16000,  # Adjust if necessary
        language_code="en-US"
    )

    # Perform speech recognition
    response = sttclient.recognize(config=config, audio=audio)

    # Extract the transcribed text
    transcript = ""
    for result in response.results:
        transcript += result.alternatives[0].transcript
    print(f"Transcribed text for {filename}: {transcript}")

    session['transcript'] = transcript  # Store transcript in session
    return redirect(url_for('index'))

# Route to serve uploaded files dynamically
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    app.run(debug=True)