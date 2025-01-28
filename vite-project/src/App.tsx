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

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => setMic(stream))
      .catch(() => setMic(null));
  }, []);

  useEffect(() => {
    runningRef.current = isRunning;

    if (!mic) return;

    if (!isRunning) {
      const canvas = document.getElementById("canvas") as HTMLCanvasElement;
      createDefaultCircle(canvas);

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      return;
    }

    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

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
      canvas.width = 600; // Fixed width
      canvas.height = 600; // Fixed height
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      analyser.getByteFrequencyData(frequencyData);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Add gradient background
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 300);
      gradient.addColorStop(0, '#4338ca');
      gradient.addColorStop(1, '#312e81');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
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

      // Add glow effect
      ctx.shadowBlur = 20;
      ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
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
    canvas.width = 600; // Fixed width
    canvas.height = 600; // Fixed height
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Add gradient background
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 300);
    gradient.addColorStop(0, '#4338ca');
    gradient.addColorStop(1, '#312e81');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(255, 255, 255, 0.5)";

    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
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
      if (runningRef.current) {
        tr.start();
      }
    };

    tr.onerror = (event: SpeechRecognitionError) => {
      console.error("Speech recognition error:", event.error);
      setRunning(false);
    };

    tr.start();
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
      setupTranscriber();
    }
  }

  return (
    <div className="w-screen h-screen bg-indigo-950 relative flex items-center justify-center overflow-hidden">
      {/* Main visualization container with centered GIF */}
      <div className="relative w-[600px] h-[600px]" onClick={toggleListening}
      >
        <canvas className="rounded-lg shadow-2xl" id="canvas">
          Your browser does not support the HTML5 canvas tag.
        </canvas>

        {/* Centered GIF with glowing effect overlay */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-16 z-10">
          <div className="relative group">
            {/* Glow effect background */}
            <div className="absolute inset-0 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all duration-300" />

            {/* Status indicator */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-max">
              <p className="text-white text-sm px-4 py-1 rounded-full bg-indigo-600/50 backdrop-blur-sm">
                {isRunning ? "Tap to stop" : "Tap to start"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Results panel */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-2/3 max-w-3xl">
        <div className="bg-indigo-900/50 p-6 rounded-lg backdrop-blur-sm shadow-lg">
          <p className="text-white text-lg leading-relaxed max-h-48 overflow-y-auto">
            {result || "Your speech will appear here..."}
          </p>
        </div>
      </div>

      {/* Answer panel */}
      {ans && (
        <div className="absolute top-8 right-8 w-1/3 max-w-md">
          <div className="bg-indigo-900/50 p-6 rounded-lg backdrop-blur-sm shadow-lg">
            <p className="text-white text-lg leading-relaxed max-h-[60vh] overflow-y-auto">
              {ans}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
