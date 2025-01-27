from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load Whisper model
model = whisper.load_model("base")  # You can choose different model sizes: tiny, base, small, medium, large

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']

    # Create a temporary file to store the audio
    with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio:
        audio_file.save(temp_audio.name)

        try:
            # Transcribe the audio using Whisper
            result = model.transcribe(temp_audio.name)

            # Return the transcription
            return jsonify({
                'text': result['text'],
                'success': True
            })
        except Exception as e:
            return jsonify({
                'error': str(e),
                'success': False
            }), 500
        finally:
            # Clean up the temporary file
            os.unlink(temp_audio.name)

if __name__ == '__main__':
    app.run(debug=True)

# Requirements.txt contents:
# flask
# flask-cors
# openai-whisper
# torch
# ffmpeg-python
