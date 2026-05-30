"use client";

import { useEffect, useRef, useState } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

const COLORS = ["#fbbf24", "#fde68a", "#67e8f9", "#fca5a5", "#ffffff"];

export default function ChampionFireworks({ playKey }: { playKey: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!playKey) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const seenKey = `superleague:champion-fireworks:${playKey}`;
    if (window.sessionStorage.getItem(seenKey)) return;

    window.sessionStorage.setItem(seenKey, "1");
    setActive(true);
  }, [playKey]);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let particles: Particle[] = [];
    const durationMs = 3200;
    const start = performance.now();
    let lastBurstAt = start - 999;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const spawnBurst = () => {
      const burstX = canvas.width * (0.15 + Math.random() * 0.7);
      const burstY = canvas.height * (0.12 + Math.random() * 0.38);
      const count = 34 + Math.floor(Math.random() * 18);

      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.22;
        const speed = 1.6 + Math.random() * 3.8;
        particles.push({
          x: burstX,
          y: burstY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.4,
          life: 0,
          maxLife: 40 + Math.random() * 22,
          size: 1.6 + Math.random() * 2.8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
      }
    };

    const render = (now: number) => {
      const elapsed = now - start;
      context.clearRect(0, 0, canvas.width, canvas.height);

      if (elapsed - lastBurstAt > 320 && elapsed < durationMs - 300) {
        spawnBurst();
        lastBurstAt = elapsed;
      }

      particles = particles.filter((particle) => particle.life < particle.maxLife);

      for (const particle of particles) {
        particle.life += 1;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.04;
        particle.vx *= 0.992;

        const alpha = 1 - particle.life / particle.maxLife;
        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;

      if (elapsed < durationMs || particles.length > 0) {
        animationFrame = window.requestAnimationFrame(render);
      } else {
        setActive(false);
      }
    };

    resize();
    spawnBurst();
    window.addEventListener("resize", resize);
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70]"
    />
  );
}
