import base64
import os
import vertexai
from flask import Flask, render_template, request, redirect, url_for, send_from_directory, session, jsonify, request
#from google import generativeai as gemini
from vertexai.generative_models import GenerativeModel, Part, SafetySetting
from google.cloud.language_v1 import LanguageServiceClient
from werkzeug.utils import secure_filename
from datetime import datetime
from typing import Sequence
from google.oauth2 import service_account
from google.cloud import storage, speech, texttospeech, language_v1

# Create a Flask app
app = Flask(__name__)
app.secret_key = 'COT5930'

SERVICE_ACCOUNT_FILE = "credentials/service-account.json"
# Check if the service account file exists
if os.path.exists(SERVICE_ACCOUNT_FILE):
    RUN_LOCALLY = True
    print("Service account file found, loading credentials...")
    credentials = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE)
    ttsclient = texttospeech.TextToSpeechClient(credentials=credentials)
    sttclient = speech.SpeechClient(credentials=credentials)
    gcsclient = storage.Client(credentials=credentials)
    langclient = LanguageServiceClient(credentials=credentials)
    vertexai.init(project='cot5390project1', location='us-central1')
    model = GenerativeModel("gemini-1.5-flash-002")
else:
    RUN_LOCALLY = False
    print("No service account file found, using Application Default Credentials (ADC)...")
    # Use Application Default Credentials (ADC)
    ttsclient = texttospeech.TextToSpeechClient()
    sttclient = speech.SpeechClient()
    gcsclient = storage.Client()
    langclient = LanguageServiceClient()
    vertexai.init(project='cot5390project1', location='us-central1')
    model = GenerativeModel("gemini-1.5-flash-002")

BUCKET_NAME = 'cot5390project1.appspot.com'
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'm4a'}

# --------REST methods--------
@app.route('/', methods=['GET'])
# Home page
def home():
    return render_template('index.html')

@app.route('/api/languages', methods=['GET'])
# Get the list of supported languages
def get_languages():
    return jsonify({'message': list_languages()})

@app.route('/api/files/v2', methods=['GET'])
# Get the list of uploaded files
def get_uploaded_files():
    files = list_uploaded_files()
    return jsonify({'message': files})

'''@app.route('/api/upload', methods=['POST'])
# Upload an audio file
def upload_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        upload_to_cloud_storage(file.read(), filename)
        return jsonify({'message': 'File uploaded successfully', 'filename': filename})
    return jsonify({'error': 'File not allowed'}), 400'''

@app.route('/api/upload/v2', methods=['POST'])
# Upload an audio file
def upload_audio_v2():
    print("Running upload audio v2")
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    print("File uploaded was", file)
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        #store the uploaded file into the bucket
        file_url = upload_to_cloud_storage(file.read(), filename)
        #transcribe the file and analyze sentiment
        transcription = transcribe_and_analyze_sentiment(file_url, request.form.get('prompt'))
        #save transcription to a file
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        filename = f"stt_{timestamp}.txt"
        upload_to_cloud_storage(transcription, filename)
        #convert transcription to audio file
        converted_audio = generate_speech(transcription, "en-us", "MALE")
        audio_base64 = base64.b64encode(converted_audio.audio_content).decode('utf-8')
        #return the audio data
        return jsonify({
            "audioContent": audio_base64,
            "mimeType": "audio/mp3"
        })
    return jsonify({'error': 'File not allowed'}), 400

@app.route('/api/delete-file', methods=['POST'])
# Delete an already uploaded file
def delete_file():
    data = request.get_json()
    filename = data.get('filename')
    delete_from_cloud_storage(filename)
    return jsonify({'message': 'File successfully deleted'})

#---Helper functions---
def transcribe_and_analyze_sentiment(file, customprompt):
    print("Transcribing and analyzing sentiment for file ", file)
    if customprompt == "":
        prompt = "Transcribe this audio verbatim and analyze its sentiment as positive, negative, or neutral."
    else:
        prompt = customprompt
    print("Transcribing using prompt: ", prompt)
    audio_file = Part.from_uri(file, mime_type="audio/wav")
    print("Audio file created for transcription")
    contents = [audio_file, prompt]
    print("Model contents created")
    response = model.generate_content(contents)
    print("Transcription response was ", response.text)
    return response.text

def download_blob_as_bytes(bucket_name, blob_name):
    print("Downloading blob as bytes", blob_name, "from bucket", bucket_name)
    bucket = gcsclient.get_bucket(bucket_name)
    blob = bucket.blob(blob_name)
    bytes = blob.download_as_bytes()
    return bytes

def download_blob_as_text(bucket_name, blob_name):
    print("Downloading blob as text", blob_name, "from bucket", bucket_name)
    bucket = gcsclient.get_bucket(bucket_name)
    blob = bucket.blob(blob_name)
    bytes = blob.download_as_text()
    return bytes

# --------Function to check if file extension is allowed--------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def list_uploaded_files():
    bucket = gcsclient.get_bucket(BUCKET_NAME)  # Get the bucket
    blobs = bucket.list_blobs()  # List files with the folder path prefix

    files = []
    for blob in blobs:
        # Exclude the folder itself from the list, only add files
        if not blob.name.endswith("/"):
            files.append(blob.public_url)
    return files

def upload_to_cloud_storage(file_content, filename):
    bucket = gcsclient.bucket(BUCKET_NAME)
    blob = bucket.blob(filename)
    blob.upload_from_string(file_content)
    print(f"File {filename} uploaded to cloud storage bucket {BUCKET_NAME}")
    return blob.public_url

def delete_from_cloud_storage(filename):
    bucket = gcsclient.bucket(BUCKET_NAME)
    blob = bucket.blob(filename)
    blob.delete()
    return True

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
    return languages

def generate_speech(text_input, selected_language, selected_gender):
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
    return response

if __name__ == '__main__':
    app.run(debug=True)
