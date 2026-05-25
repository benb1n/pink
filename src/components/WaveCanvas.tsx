import { useEffect, useRef } from 'react';

interface Props {
  playing: boolean;
}

interface Particle {
  x: number;
  y: number;
  baseY: number;
  vx: number;
  size: number;
  opacity: number;
  waveOffset: number;
  speed: number;
}

const PARTICLE_COUNT = 300;
const PINK = { r: 180, g: 60, b: 110 };

function createParticles(w: number, h: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = Math.random() * w;
    // Cluster particles in two wave bands across the screen
    const band = Math.random() < 0.6 ? 0.55 : 0.45;
    const baseY = h * band + (Math.random() - 0.5) * h * 0.25;
    particles.push({
      x,
      y: baseY,
      baseY,
      vx: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2.5 + 0.5,
      opacity: Math.random() * 0.7 + 0.1,
      waveOffset: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.4 + 0.2,
    });
  }
  return particles;
}

export function WaveCanvas({ playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const tRef = useRef(0);
  const playingRef = useRef(playing);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particlesRef.current = createParticles(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let lastFrame = 0;
    const TARGET_FPS = 24;
    const FRAME_MS = 1000 / TARGET_FPS;

    const draw = (timestamp: number) => {
      rafRef.current = requestAnimationFrame(draw);

      // Throttle to TARGET_FPS for battery efficiency
      if (timestamp - lastFrame < FRAME_MS) return;
      lastFrame = timestamp;

      const w = canvas.width;
      const h = canvas.height;
      const isPlaying = playingRef.current;
      const speedMult = isPlaying ? 1 : 0.3;

      tRef.current += 0.008 * speedMult;
      const t = tRef.current;

      ctx.clearRect(0, 0, w, h);

      // Radial glow at wave center
      const grd = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, w * 0.55);
      grd.addColorStop(0, `rgba(${PINK.r},${PINK.g},${PINK.b},${isPlaying ? 0.12 : 0.06})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      for (const p of particlesRef.current) {
        // Wave displacement
        const waveY = Math.sin(p.x * 0.008 + t * p.speed + p.waveOffset) * (h * 0.06)
          + Math.sin(p.x * 0.004 + t * 0.5 + p.waveOffset * 1.3) * (h * 0.03);

        p.y = p.baseY + waveY;
        p.x += p.vx;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        // Fade toward top/bottom edges
        const normY = (p.y / h - 0.5) * 2; // -1..1
        const edgeFade = Math.max(0, 1 - Math.abs(normY) * 2.2);

        const alpha = p.opacity * edgeFade * (isPlaying ? 1 : 0.55);
        if (alpha <= 0.01) continue;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PINK.r},${PINK.g},${PINK.b},${alpha})`;
        ctx.fill();
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
