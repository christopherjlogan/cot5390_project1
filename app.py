import os
from flask import Flask, render_template, request, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename
from google.cloud import texttospeech
from datetime import datetime
from typing import Sequence

# Create a Flask app
app = Flask(__name__)

# Set the upload folder and allowed extensions
UPLOAD_FOLDER = 'uploads/'
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg'}

# Ensure the upload directory exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


# Function to check if file extension is allowed
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def unique_languages_from_voices(voices: Sequence[texttospeech.Voice]):
    language_set = set()
    for voice in voices:
        for language_code in voice.language_codes:
            language_set.add(language_code)
    return language_set

def list_languages():
    client = texttospeech.TextToSpeechClient()
    response = client.list_voices()
    languages = unique_languages_from_voices(response.voices)

    print(f" Languages: {len(languages)} ".center(60, "-"))
    for i, language in enumerate(sorted(languages)):
        print(f"{language:>10}", end="\n" if i % 5 == 4 else "")

# Route to display the HTML page with audio files
@app.route('/')
def index():
    # Get the list of uploaded audio files
    files = os.listdir(app.config['UPLOAD_FOLDER'])
    languages = list_languages()
    return render_template('index.html', files=files, languages=languages)


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
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        return redirect(url_for('index'))

    return redirect(url_for('index'))


# Route to generate speech using Google Text-to-Speech API
@app.route('/text-to-speech', methods=['POST'])
def text_to_speech():
    text_input = request.form['text']

    # Initialize Google Cloud Text-to-Speech client
    client = texttospeech.TextToSpeechClient()

    # Set the text input for synthesis
    synthesis_input = texttospeech.SynthesisInput(text=text_input)

    # Select the voice and language
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
    )

    # Select the audio format
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    # Perform the text-to-speech request
    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    # Use a timestamp-based filename
    timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    filename = f"tts_{timestamp}.mp3"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    # Save the audio file
    with open(filepath, "wb") as out:
        out.write(response.audio_content)

    return redirect(url_for('index'))


# Route to serve uploaded files dynamically
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    app.run(debug=True)