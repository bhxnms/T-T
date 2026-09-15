import React from 'react';

/**
 * The login backdrop: an original particle constellation.
 *
 * Slowly drifting lights scattered over a deep navy field; whenever two pass
 * close to each other they link up with a thin line, so the network constantly
 * re-forms — travellers finding each other. Two large brand-colour glows
 * breathe underneath.
 *
 * `ambient` is the login backdrop: the constellation drifts forever.
 * `takeoff` is the sign-in moment: over ~2.2s the whole constellation is pulled
 * into the centre behind the wordmark, arriving as the logo reveals.
 *
 * Fully drawn in code — no imagery, no baked map data.
 *
 * Perf: ≤ 90 particles, O(n²) pair scan per frame is trivial at that size.
 * Under prefers-reduced-motion a single static frame is drawn and no rAF loop
 * is started.
 */

interface Particle {
  x: number;
  y: number;
  /** Drift velocity, px/frame at 60fps — slow on purpose. */
  vx: number;
  vy: number;
  r: number;
  /** Twinkle phase + speed, so the dots don't blink in unison. */
  phase: number;
  twinkle: number;
  /** Per-particle pull strength for the takeoff (slight stagger). */
  pull: number;
}

const DOT_MIN = 0.9;
const DOT_MAX = 2.1;
const LINK_DISTANCE = 130;
const MAX_PARTICLES = 90;

function makeParticle(w: number, h: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.08 + Math.random() * 0.22;
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: DOT_MIN + Math.random() * (DOT_MAX - DOT_MIN),
    phase: Math.random() * Math.PI * 2,
    twinkle: 0.5 + Math.random() * 1.2,
    pull: 0.05 + Math.random() * 0.06,
  };
}

interface ParticleFieldProps {
  variant?: 'ambient' | 'takeoff';
}

export default function ParticleField({ variant = 'ambient' }: ParticleFieldProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const takeoff = variant === 'takeoff';

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let raf = 0;
    let particles: Particle[] = [];
    let start = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Density follows the viewport; a phone gets a sparser sky than a desktop.
      const target = Math.min(MAX_PARTICLES, Math.max(36, Math.round((width * height) / 16000)));
      if (particles.length > target) particles = particles.slice(0, target);
      while (particles.length < target) particles.push(makeParticle(width, height));
    };

    const drawFrame = (now: number, pull: number) => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      // Positions advance (drift; takeoff adds a staggered pull to centre).
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
        if (pull > 0) {
          p.x += (cx - p.x) * pull * p.pull * 2.2;
          p.y += (cy - p.y) * pull * p.pull * 2.2;
        }
      }

      // Links first, dots on top.
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DISTANCE * LINK_DISTANCE) continue;
          const d = Math.sqrt(d2);
          const alpha = (1 - d / LINK_DISTANCE) * 0.35;
          ctx.strokeStyle = `rgba(129, 140, 248, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      const t = now / 1000;
      for (const p of particles) {
        const twinkle = 0.65 + 0.35 * Math.sin(p.phase + t * p.twinkle);
        ctx.fillStyle = `rgba(226, 232, 255, ${(0.75 * twinkle).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (now: number) => {
      if (!start) start = now;
      // takeoff: 0 → 1 over 2200ms, eased in — the constellation gathers
      // behind the wordmark as it reveals.
      const pull = takeoff ? Math.min((now - start) / 2200, 1) ** 2 : 0;
      drawFrame(now, pull);
      raf = requestAnimationFrame(frame);
    };

    const staticFrame = () => {
      resize();
      drawFrame(0, takeoff ? 1 : 0);
    };

    resize();
    window.addEventListener('resize', resize);

    if (reduceMotion) {
      staticFrame();
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [takeoff]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0a0f1f' }} aria-hidden="true">
      {/* Two breathing brand glows under the constellation. */}
      <div
        className="pf-glow pf-glow-a"
        style={{
          position: 'absolute',
          width: '46vw',
          height: '46vw',
          top: '-8%',
          left: '2%',
          borderRadius: '50%',
          filter: 'blur(110px)',
          background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, rgba(99,102,241,0) 70%)',
        }}
      />
      <div
        className="pf-glow pf-glow-b"
        style={{
          position: 'absolute',
          width: '38vw',
          height: '38vw',
          bottom: '-10%',
          right: '4%',
          borderRadius: '50%',
          filter: 'blur(110px)',
          background: 'radial-gradient(circle, rgba(34,211,238,0.28) 0%, rgba(34,211,238,0) 72%)',
        }}
      />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <style>{`
        @keyframes pf-breathe {
          0%, 100% { opacity: 0.75; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        .pf-glow { animation: pf-breathe 9s ease-in-out infinite; }
        .pf-glow-b { animation-delay: -4.5s; }
        @media (prefers-reduced-motion: reduce) {
          .pf-glow { animation: none; }
        }
      `}</style>
    </div>
  );
}
