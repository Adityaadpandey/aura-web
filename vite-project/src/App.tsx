import { useEffect, useRef, useState } from "react";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionError extends Event {
  error: string;
}

interface WebkitSpeechRecognition {
  new(): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionError) => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: WebkitSpeechRecognition;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

function App(): JSX.Element {
  const [mic, setMic] = useState<MediaStream | null>(null);
  const [isRunning, setRunning] = useState<boolean>(false);
  const [transcriber, setTranscriber] = useState<SpeechRecognition | null>(null);
  const [result, setResult] = useState<string>("");
  const runningRef = useRef<boolean>(isRunning);
  const [ans, setAns] = useState<string>("");
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext>();

  // Setup microphone only
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => setMic(stream))
      .catch(() => setMic(null));
  }, []);

  // Handle animation and audio processing
  useEffect(() => {
    runningRef.current = isRunning;

    if (!mic) return;

    if (!isRunning) {
      const canvas = document.getElementById("canvas") as HTMLCanvasElement;
      createDefaultCircle(canvas);

      // Cleanup previous audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      // Cancel previous animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      return;
    }

    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    // Create new audio context
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContextRef.current.createMediaStreamSource(mic);
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const frequencyBufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(frequencyBufferLength);
    const sensitivity = 50;

    function draw(): void {
      if (!runningRef.current) {
        createDefaultCircle(canvas);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      analyser.getByteFrequencyData(frequencyData);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.fillStyle = "white";
      ctx.beginPath();

      const angleOffset = Math.PI / (frequencyBufferLength - 1);
      let offsetHeight = 0;
      let cos = 0;
      let sin = 0;
      let x = 0;
      let y = 0;

      // First wave (outer)
      for (let i = 0; i < frequencyBufferLength; i++) {
        offsetHeight = frequencyData[i] * 200 / 255;
        cos = Math.cos(i * angleOffset);
        sin = Math.sin(i * angleOffset);
        x = centerX + cos * 110 + cos * offsetHeight;
        y = centerY + sin * 110 + sin * offsetHeight;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Second wave (inner)
      for (let i = 0; i < frequencyBufferLength; i++) {
        offsetHeight = frequencyData[i] * sensitivity / 255;
        cos = Math.cos(-i * angleOffset);
        sin = Math.sin(-i * angleOffset);
        x = centerX + cos * 110 + cos * offsetHeight;
        y = centerY + sin * 110 + sin * offsetHeight;
        ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.fill();
    }

    draw();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mic, isRunning]);

  function createDefaultCircle(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.beginPath();
    ctx.fillStyle = "white";
    ctx.arc(centerX, centerY, 100, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
  }

  function setupTranscriber(): void {
    const tr = new window.webkitSpeechRecognition();

    tr.continuous = true;
    tr.interimResults = true;
    tr.lang = "en-US";

    tr.onresult = (event: SpeechRecognitionEvent) => {
      let res = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          res += event.results[i][0].transcript;
        }
      }
      setResult(res);
    };

    tr.onend = () => {
      // Restart if still running
      if (runningRef.current) {
        tr.start();
      }
    };

    tr.onerror = (event: SpeechRecognitionError) => {
      console.error("Speech recognition error:", event.error);
      setRunning(false);
    };

    tr.start(); // Start immediately after setup
    setTranscriber(tr);
  }

  function toggleListening(): void {
    if (isRunning) {
      setRunning(false);
      if (transcriber) {
        transcriber.stop();
        setTranscriber(null);
      }
    } else {
      if (!mic) return;
      setResult("");
      setRunning(true);
      setupTranscriber(); // Setup and start new transcriber
    }
  }

  return (
    <div className="w-screen h-screen bg-slate-900 relative">
      <img
        src="test.gif"
        alt="microphone"
        height={150}
        width={150}
        className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
        onClick={toggleListening}
      />
      <canvas className="w-full h-full" id="canvas">
        Your browser does not support the HTML5 canvas tag.
      </canvas>
      <p id="result" className="absolute bottom-0 left-0 w-screen text-white text-center h-[20%] overflow-y-auto">
        {result}
      </p>
      <p className="absolute top-0 left-0 w-[35%] text-white text-center h-[80%] overflow-y-auto p-10">
        {ans}
      </p>
    </div>
  );
}

export default App;
