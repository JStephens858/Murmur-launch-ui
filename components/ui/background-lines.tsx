"use client";

import * as React from "react";

/**
 * Ambient background: a slowly tumbling 3D wireframe knot drawn as thin
 * line strands on a fixed full-viewport canvas. Stroke colors come from
 * the theme tokens (--brand, --accent-alt) so every theme-lab variant
 * tints its own art. Honors prefers-reduced-motion by rendering a single static
 * frame. Sits behind all content (z-index -1; body background propagates
 * to the root, so the canvas isn't painted over).
 */

const TAU = Math.PI * 2;
const STRANDS = 12;
const SEGMENTS = 220;

function readThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    brand: style.getPropertyValue("--brand").trim() || "#de046c",
    accentAlt: style.getPropertyValue("--accent-alt").trim() || "#8a1e5c",
    dark: document.documentElement.classList.contains("dark"),
  };
}

export default function BackgroundLines() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let colors = readThemeColors();
    let width = 0;
    let height = 0;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const t = now * 0.0000067; // slow tumble
      ctx.clearRect(0, 0, width, height);

      const cx = width * 0.5;
      const cy = height * 0.45;
      const size = Math.min(width, height) * 0.34;
      const rotY = t * TAU;
      const rotX = 0.55 + 0.25 * Math.sin(t * TAU * 0.37);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const gradient = ctx.createLinearGradient(cx - size, 0, cx + size, 0);
      gradient.addColorStop(0, colors.brand);
      gradient.addColorStop(1, colors.accentAlt);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.globalAlpha = colors.dark ? 0.08 : 0.06;

      const breathe = 0.32 + 0.03 * Math.sin(t * TAU * 0.61);

      for (let i = 0; i < STRANDS; i++) {
        const off = (i / (STRANDS - 1) - 0.5) * 0.38;
        ctx.beginPath();
        for (let j = 0; j <= SEGMENTS; j++) {
          const u = (j / SEGMENTS) * TAU;
          // (3,2) torus-knot-style curve; strand offset fans it into a tube
          const tube = breathe + off * 0.22;
          const r = 1 + tube * Math.cos(3 * u + off * 2);
          let x = r * Math.cos(2 * u);
          let y = r * Math.sin(2 * u);
          let z = tube * Math.sin(3 * u + off * 2) + off * 0.6;

          // rotate around Y, then X
          const x1 = x * cosY + z * sinY;
          const z1 = -x * sinY + z * cosY;
          const y1 = y * cosX + z1 * sinX;
          const z2 = -y * sinX + z1 * cosX;

          // perspective projection
          const p = 3 / (3 - z2);
          const px = cx + x1 * p * size;
          const py = cy + y1 * p * size;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    };

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    resize();
    if (reducedMotion) {
      draw(12000);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      if (reducedMotion) draw(12000);
    };
    window.addEventListener("resize", onResize);

    // Re-read colors when the theme class or theme-lab attribute changes.
    const observer = new MutationObserver(() => {
      colors = readThemeColors();
      if (reducedMotion) draw(12000);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
