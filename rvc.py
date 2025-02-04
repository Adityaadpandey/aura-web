from fastapi import FastAPI, WebSocket
import torch
import soundfile as sf
import librosa
import numpy as np
from TTS.api import TTS
import asyncio

app = FastAPI()

# Load Text-to-Speech (TTS) model
tts = TTS("tts_models/en/ljspeech/tacotron2-DDC", gpu=False)

# Load Retrieval-based Voice Conversion (RVC) Model
rvc_model_path = "/home/aditya/Downloads/March-7th/March-7th.pth"
rvc_model = torch.load(rvc_model_path, map_location="cpu")  # Load model to CPU (use GPU if available)

# Function to generate speech from text
def generate_tts_audio(text, output_path="tts_output.wav"):
    tts.tts_to_file(text=text, file_path=output_path)
    return output_path

# Function to apply RVC voice conversion
def apply_rvc(input_audio_path, output_audio_path="converted_output.wav"):
    # Load the TTS-generated audio
    audio, sr = librosa.load(input_audio_path, sr=44100)
    audio_tensor = torch.tensor(audio).unsqueeze(0)  # Convert to tensor

    # Process the RVC model
    converted_audio = rvc_model(audio_tensor)

    # Save converted audio
    sf.write(output_audio_path, converted_audio.squeeze().numpy(), sr)
    return output_audio_path

# WebSocket API for Streaming Real-Time Audio
@app.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    while True:
        try:
            text = await websocket.receive_text()  # Receive text from the frontend

            # Generate TTS audio
            tts_audio_path = generate_tts_audio(text)

            # Convert voice using RVC
            converted_audio_path = apply_rvc(tts_audio_path)

            # Read audio file and send back in real-time
            with open(converted_audio_path, "rb") as audio_file:
                audio_data = audio_file.read()

            await websocket.send_bytes(audio_data)

        except Exception as e:
            print(f"Error: {e}")
            await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
