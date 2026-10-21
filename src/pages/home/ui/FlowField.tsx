import { useEffect, useRef } from 'react';

import { useReducedMotion } from '@/shared/hooks';

import styles from './HomePage.module.css';

/** The four series hues — the same the charts and the mark use. */
const COLOURS = ['#2f6fdf', '#1baf7a', '#5b93f0', '#eb6834'];
const COUNT = 70;
/** The ledger rules behind the motion, this far apart. */
const RULE_GAP = 46;

interface Particle {
  x: number;
  y: number;
  speed: number;
  colour: string;
  phase: number;
  radius: number;
}

/**
 * The moving ground behind the sign-in: points drifting left to right along faint ledger rules,
 * each leaving a short trail — figures flowing through the books.
 *
 * Pure decoration, so it is hidden from assistive technology, stops entirely for anyone who has
 * asked for less motion (one still frame of the rules is drawn instead), and pauses while the tab
 * is not being looked at rather than spending a laptop's battery on nobody.
 */
export function FlowField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const still = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = Array.from({ length: COUNT }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.0006 + Math.random() * 0.0016,
      colour: COLOURS[i % COLOURS.length],
      phase: Math.random() * Math.PI * 2,
      radius: 0.6 + Math.random() * 1.6,
    }));

    const rules = () => {
      context.strokeStyle = 'rgba(91, 147, 240, 0.05)';
      context.lineWidth = 1;
      for (let y = 0; y < canvas.height; y += RULE_GAP * ratio) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
      }
    };

    if (still) {
      rules();
      return () => window.removeEventListener('resize', resize);
    }

    let frame = 0;
    const tick = (time: number) => {
      // A translucent wash rather than a clear: what was drawn fades over a few frames, so each
      // point leaves a trail behind it.
      context.fillStyle = 'rgba(10, 12, 16, 0.12)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalAlpha = 0.65;
      for (const p of particles) {
        p.x += p.speed;
        p.y += Math.sin(p.phase + time / 1400 + p.x * 6) * 0.0012;
        if (p.x > 1.02) {
          p.x = -0.02;
          p.y = Math.random();
        }
        context.beginPath();
        context.fillStyle = p.colour;
        context.arc(p.x * canvas.width, p.y * canvas.height, p.radius * ratio, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      rules();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
    };
  }, [still]);

  return <canvas ref={canvasRef} className={styles.flow} aria-hidden="true" />;
}
