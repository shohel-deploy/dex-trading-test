import { useEffect, useRef } from 'react';

type Star = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  r: number;
  phase: number;
  twinkle: number;
  bright: boolean;
};

const LINK = 96;
const MOUSE_REACH = 200;

/**
 * Aerospace field: stars drift, ease around the cursor, and join any neighbor inside a set distance.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let alive = true;
    let bucketCols = 0;
    let bucketRows = 0;
    let buckets: number[][] = [];
    const mouse = { x: 0, y: 0, on: false };

    const place = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(250, Math.min(500, Math.round((width * height) / 9000)));
      stars = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const pace = 0.28 + Math.random() * 0.42;
        const bright = Math.random() < 0.14;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          baseVx: Math.cos(angle) * pace,
          baseVy: Math.sin(angle) * pace,
          vx: Math.cos(angle) * pace,
          vy: Math.sin(angle) * pace,
          r: bright ? 1.4 + Math.random() * 0.9 : 0.45 + Math.random() * 0.7,
          phase: Math.random() * Math.PI * 2,
          twinkle: 0.8 + Math.random() * 1.8,
          bright,
        };
      });
    };

    const onMove = (event: PointerEvent): void => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      mouse.on = true;
    };
    const onLeave = (): void => {
      mouse.on = false;
    };

    const paint = (now: number): void => {
      if (!alive) return;
      const time = now / 1000;

      if (!reduce) {
        for (const star of stars) {
          star.vx += (star.baseVx - star.vx) * 0.045;
          star.vy += (star.baseVy - star.vy) * 0.045;
          if (mouse.on) {
            const dx = star.x - mouse.x;
            const dy = star.y - mouse.y;
            const dist = Math.hypot(dx, dy);
            if (dist < MOUSE_REACH && dist > 0.5) {
              const push = (1 - dist / MOUSE_REACH) * 1.35;
              star.vx += (dx / dist) * push;
              star.vy += (dy / dist) * push;
            }
          }
          star.x += star.vx;
          star.y += star.vy;
          if (star.x < -24) star.x = width + 24;
          else if (star.x > width + 24) star.x = -24;
          if (star.y < -24) star.y = height + 24;
          else if (star.y > height + 24) star.y = -24;
        }
      }

      const cols = Math.max(1, Math.ceil(width / LINK));
      const rows = Math.max(1, Math.ceil(height / LINK));
      const cells = cols * rows;
      if (cols !== bucketCols || rows !== bucketRows || buckets.length !== cells) {
        buckets = Array.from({ length: cells }, () => []);
        bucketCols = cols;
        bucketRows = rows;
      } else {
        for (let i = 0; i < cells; i++) buckets[i]!.length = 0;
      }
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i]!;
        const col = Math.min(cols - 1, Math.max(0, Math.floor(star.x / LINK)));
        const row = Math.min(rows - 1, Math.max(0, Math.floor(star.y / LINK)));
        buckets[row * cols + col]!.push(i);
      }

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 0.7;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const here = buckets[row * cols + col]!;
          for (let nr = row; nr <= Math.min(rows - 1, row + 1); nr++) {
            for (let nc = col - 1; nc <= col + 1; nc++) {
              if (nc < 0 || nc >= cols) continue;
              if (nr === row && nc < col) continue;
              const there = buckets[nr * cols + nc]!;
              for (const i of here) {
                for (const j of there) {
                  if (i >= j) continue;
                  const a = stars[i]!;
                  const b = stars[j]!;
                  const dx = a.x - b.x;
                  const dy = a.y - b.y;
                  if (Math.abs(dx) > LINK || Math.abs(dy) > LINK) continue;
                  const dist = Math.hypot(dx, dy);
                  if (dist > LINK) continue;
                  const alpha = (1 - dist / LINK) * 0.5;
                  ctx.strokeStyle = `rgba(198, 220, 242, ${alpha})`;
                  ctx.beginPath();
                  ctx.moveTo(a.x, a.y);
                  ctx.lineTo(b.x, b.y);
                  ctx.stroke();
                }
              }
            }
          }
        }
      }

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i]!;
        const x = star.x;
        const y = star.y;
        const wave = reduce ? 0.8 : 0.5 + 0.5 * Math.sin(time * star.twinkle + star.phase);
        const alpha = star.bright ? 0.6 + wave * 0.4 : 0.42 + wave * 0.5;
        if (star.bright) {
          ctx.fillStyle = `rgba(186, 214, 255, ${alpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(x, y, star.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(236, 244, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduce) frame = requestAnimationFrame(paint);
    };

    place();
    frame = requestAnimationFrame(paint);
    window.addEventListener('resize', place);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} className="atmosphere-stars" />;
}
