# Interactive Voice AI Assistant

An interactive voice assistant that uses speech recognition, Gemini AI, and speech synthesis to create an engaging conversation experience with visual audio feedback.

## Features

- Real-time speech recognition
- AI-powered responses using Google's Gemini API
- Cute and friendly voice synthesis
- Interactive audio visualization
- Beautiful UI with smooth animations

## Setup

1. Install dependencies:
```bash
npm install
# or
bun install
```

2. Set up environment variables:
- Copy `.env.example` to `.env`
- Get your Gemini API key from [Google MakerSuite](https://makersuite.google.com/app/apikey)
- Add your API key to the `.env` file:
```
VITE_GEMINI_API_KEY=your_api_key_here
```

3. Run the development server:
```bash
npm run dev
# or
bun dev
```

4. Open your browser to the URL shown in the terminal (usually http://localhost:5173)

## How to Use

1. Click the visualization circle to start listening
2. Speak your question or prompt
3. The app will:
   - Show your speech transcription
   - Generate an AI response using Gemini
   - Speak back the response in a friendly voice
4. Click again to stop listening

## Voice Commands

The assistant can:
- Answer questions
- Provide explanations
- Engage in casual conversation
- Help with tasks
- Tell jokes and stories

The responses are designed to be friendly, helpful, and concise.

## Browser Support

- Chrome (recommended)
- Edge
- Safari (partial support)
- Firefox (partial support)

Note: Speech recognition and synthesis features work best in Chrome.
