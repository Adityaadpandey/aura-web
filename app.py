from flask import Flask
from flask_cors import CORS
import whisper
import numpy as np
import torch
import asyncio
import json
import base64
import io
from concurrent.futures import ThreadPoolExecutor
import websockets
import threading
from pydub import AudioSegment
from fairseq import checkpoint_utils
import logging
import soundfile as sf
from typing import Optional
import os

app = Flask(__name__)
CORS(app)

# Initialize Whisper model
whisper_model = whisper.load_model("base")

# RVC model configuration
class RVCConfig:
    def __init__(self):
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.model_path = "path_to_your_rvc_model.pth"  # Replace with your model path
        self.config_path = "path_to_your_config.json"   # Replace with your config path

config = RVCConfig()

# Load RVC model
def load_rvc_model():
    models, _, _ = checkpoint_utils.load_model_ensemble_and_task(
        [config.model_path],
        arg_overrides={"data": os.path.dirname(config.config_path)}
    )
    model = models[0]
    model.eval()
    model.to(config.device)
    return model

rvc_model = load_rvc_model()

class AudioProcessor:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=2)

    async def process_audio_chunk(self, audio_data: bytes) -> tuple[str, Optional[bytes]]:
        # Convert audio data to format suitable for Whisper
        audio = AudioSegment.from_file(io.BytesIO(audio_data), format="webm")
        audio_array = np.array(audio.get_array_of_samples())

        # Process with Whisper
        result = await asyncio.get_event_loop().run_in_executor(
            self.executor,
            lambda: whisper_model.transcribe(audio_array)
        )

        transcription = result["text"]

        # Process with RVC if transcription is not empty
        converted_audio = None
        if transcription.strip():
            converted_audio = await self.convert_voice(transcription)

        return transcription, converted_audio

    async def convert_voice(self, text: str) -> bytes:
        # Text to speech conversion (you'll need to implement this based on your needs)
        # This is a placeholder for TTS functionality
        speech_array = np.zeros(16000)  # Replace with actual TTS

        # Convert speech to RVC
        with torch.no_grad():
            speech_tensor = torch.FloatTensor(speech_array).to(config.device)
            converted = rvc_model(speech_tensor)
            converted = converted.cpu().numpy()

        # Convert to bytes
        buffer = io.BytesIO()
        sf.write(buffer, converted, 16000, format='WAV')
        return buffer.getvalue()

async def websocket_handler(websocket, path):
    audio_processor = AudioProcessor()
    try:
        async for message in websocket:
            data = json.loads(message)

            if data["type"] == "audio":
                # Decode base64 audio
                audio_bytes = base64.b64decode(data["audio"])

                # Process audio
                transcription, converted_audio = await audio_processor.process_audio_chunk(audio_bytes)

                # Send transcription
                await websocket.send(json.dumps({
                    "type": "transcription",
                    "text": transcription
                }))

                # Send converted audio if available
                if converted_audio:
                    await websocket.send(json.dumps({
                        "type": "audio",
                        "audio": base64.b64encode(converted_audio).decode('utf-8')
                    }))

            elif data["type"] == "end":
                break

    except websockets.exceptions.ConnectionClosed:
        pass

async def run_websocket_server():
    async with websockets.serve(websocket_handler, "localhost", 5000):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_websocket_server())

# Requirements.txt additions:
# websockets
# pydub
# fairseq
# soundfile
# numpy
