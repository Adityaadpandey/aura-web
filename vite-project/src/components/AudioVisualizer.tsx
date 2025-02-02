import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    isRunning: boolean;
    mic: MediaStream | null;
}

declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }
}

export function AudioVisualizer({ isRunning, mic }: AudioVisualizerProps): JSX.Element {
    const animationFrameRef = useRef<number>();
    const audioContextRef = useRef<AudioContext>();
    const hueRef = useRef(0);

    useEffect(() => {
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
        analyser.fftSize = 512; // Increased for more detail
        source.connect(analyser);
        const frequencyBufferLength = analyser.frequencyBinCount;
        const frequencyData = new Uint8Array(frequencyBufferLength);
        const sensitivity = 50;

        function draw(): void {
            if (!isRunning) {
                createDefaultCircle(canvas);
                return;
            }

            animationFrameRef.current = requestAnimationFrame(draw);
            canvas.width = 600;
            canvas.height = 600;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            analyser.getByteFrequencyData(frequencyData);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Dynamic background gradient
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 300);
            hueRef.current = (hueRef.current + 0.5) % 360;
            gradient.addColorStop(0, `hsla(${hueRef.current}, 70%, 50%, 0.8)`);
            gradient.addColorStop(1, `hsla(${(hueRef.current + 60) % 360}, 70%, 30%, 0.8)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Calculate average frequency for dynamic effects
            const avgFrequency = frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length;
            const baseRadius = 110 + (avgFrequency * 0.1);

            ctx.lineWidth = 2;
            ctx.strokeStyle = `hsla(${(hueRef.current + 180) % 360}, 70%, 60%, 0.8)`;
            ctx.fillStyle = `hsla(${(hueRef.current + 180) % 360}, 70%, 50%, 0.3)`;
            ctx.beginPath();

            const angleOffset = (2 * Math.PI) / frequencyBufferLength;
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
                x = centerX + cos * baseRadius + cos * offsetHeight;
                y = centerY + sin * baseRadius + sin * offsetHeight;
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
                x = centerX + cos * baseRadius + cos * offsetHeight;
                y = centerY + sin * baseRadius + sin * offsetHeight;
                ctx.lineTo(x, y);
            }

            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Add particle effects
            const particleCount = Math.floor(avgFrequency / 5);
            for (let i = 0; i < particleCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = baseRadius + Math.random() * 50;
                const particleX = centerX + Math.cos(angle) * radius;
                const particleY = centerY + Math.sin(angle) * radius;

                ctx.beginPath();
                ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${(hueRef.current + 120) % 360}, 70%, 60%, ${Math.random() * 0.5 + 0.5})`;
                ctx.fill();
            }

            // Add glow effect
            ctx.shadowBlur = 20 + (avgFrequency * 0.1);
            ctx.shadowColor = `hsla(${(hueRef.current + 180) % 360}, 70%, 60%, 0.5)`;
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

    return (
        <canvas className="rounded-lg shadow-2xl" id="canvas">
            Your browser does not support the HTML5 canvas tag.
        </canvas>
    );
}

function createDefaultCircle(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    canvas.width = 600;
    canvas.height = 600;
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
