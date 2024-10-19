import os
from flask import Flask, render_template, request, redirect, url_for, send_from_directory, session, jsonify, request
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
else:
    RUN_LOCALLY = False
    print("No service account file found, using Application Default Credentials (ADC)...")
    # Use Application Default Credentials (ADC)
    ttsclient = texttospeech.TextToSpeechClient()
    sttclient = speech.SpeechClient()
    gcsclient = storage.Client()
    langclient = LanguageServiceClient()

BUCKET_NAME = 'cot5390project1.appspot.com'
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'm4a'}

# Function to check if file extension is allowed
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
    return blob.public_url

def delete_from_cloud_storage(filename):
    bucket = gcsclient.bucket(BUCKET_NAME)
    blob = bucket.blob(filename)
    bucket.delete_blob(blob)
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

@app.route('/', methods=['GET'])
def home():
    return render_template('index.html')

# REST methods below
@app.route('/api/files', methods=['GET'])
def get_uploaded_files():
    files = list_uploaded_files()
    return jsonify({'message': files})

@app.route('/api/languages', methods=['GET'])
def get_languages():
    return jsonify({'message': list_languages()})

@app.route('/api/upload', methods=['POST'])
def upload_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        upload_to_cloud_storage(file.read(), filename)
        return jsonify({'message': 'File uploaded successfully', 'filename': filename})
    return jsonify({'error': 'File not allowed'}), 400

@app.route('/api/text-to-speech', methods=['POST'])
def text_to_speech():
    data = request.get_json()
    text = data.get('text')
    language = data.get('language')
    gender = data.get('gender')
    response = generate_speech(text, language, gender)
    # Save the audio file
    timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    filename = f"tts_{timestamp}_{language}_{gender}.mp3"
    upload_to_cloud_storage(response.audio_content, filename)
    return jsonify({'message': 'Text converted to speech successfully'})

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

@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    data = request.get_json()
    filename = data.get('filename')
    language = data.get('language')
    converted_text = convert_to_text(filename, language)
    timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    filename = f"stt_{timestamp}_{language}.txt"
    upload_to_cloud_storage(converted_text, filename)
    return jsonify({'message': 'Speech converted to text successfully'})

@app.route('/api/delete-file', methods=['POST'])
def delete_file():
    data = request.get_json()
    filename = data.get('filename')
    delete_from_cloud_storage(filename)
    return jsonify({'message': 'File successfully deleted'})

@app.route('/api/analyze-sentiment', methods=['POST'])
def analyze_sentiment_from_file():
    data = request.get_json()
    filename = data.get('filename')
    language = data.get('language')
    # Get the file from the bucket
    text_to_analyze = ''
    if filename.endswith(".txt"):
        text_to_analyze = download_blob_as_text(BUCKET_NAME, filename)
    else:
        # If the file is audio, convert to text first
        text_to_analyze = convert_to_text(filename, language)
    # Run through sentiment analysis
    document = language_v1.Document(
        content=text_to_analyze,
        type_=language_v1.Document.Type.PLAIN_TEXT,
        language=language
    )
    sentiment = langclient.analyze_sentiment(document=document).document_sentiment.score
    text_sentiment = evaluate_sentiment_score(sentiment)
    print("Analyzing sentiment for", filename, "as", sentiment, "-",text_sentiment)
    return jsonify({'text': text_to_analyze,'sentiment': text_sentiment})

def evaluate_sentiment_score(score):
    if score > 0:
        return "positive"
    elif score < 0:
        return "negative"
    else:
        return "neutral"

def convert_to_text(filename, language):
    audio_content = download_blob_as_bytes(BUCKET_NAME, filename)
    audio = speech.RecognitionAudio(content=audio_content)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.MP3,  # Adjust based on your file type (MP3 assumed here)
        sample_rate_hertz=16000,
        language_code=language
    )
    response = sttclient.recognize(config=config, audio=audio)
    transcript = ""
    for result in response.results:
        transcript += result.alternatives[0].transcript
    return transcript

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

if __name__ == '__main__':
    app.run(debug=True)
