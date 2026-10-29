// Easter egg A: the visible icons fall with real physics, pile up at the bottom
// of the window, then fly back to their tiles (DESIGN §4.11). Matter.js is
// loaded only when the easter egg fires, so normal visits never download it.
import { reducedMotion } from './common';

const HOLD = 2800; // ms the pile stays before flying back
const STEP = 1000 / 60; // fixed physics step, so 120 Hz screens don't fall twice as fast
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function lockScroll() {
  const stop = (e: Event) => e.preventDefault();
  document.body.classList.add('locked');
  addEventListener('wheel', stop, { passive: false });
  addEventListener('touchmove', stop, { passive: false });
  return () => {
    document.body.classList.remove('locked');
    removeEventListener('wheel', stop);
    removeEventListener('touchmove', stop);
  };
}

export async function dropIcons(icons: SVGSVGElement[]) {
  const unlock = lockScroll();
  try {
    if (reducedMotion()) await fade(icons);
    else await fall(icons);
  } finally {
    unlock();
  }
}

// Reduced motion: no movement, icons fade out and back in (300ms each)
async function fade(icons: SVGSVGElement[]) {
  const out = icons.map((svg) => svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }));
  await wait(1200);
  await Promise.all(icons.map((svg) => svg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }).finished));
  out.forEach((a) => a.cancel());
}

async function fall(icons: SVGSVGElement[]) {
  const mod: any = await import('matter-js');
  const { Engine, Bodies, Body, Composite } = mod.default ?? mod;

  const engine = Engine.create({ gravity: { x: 0, y: 1.2 } });
  const W = innerWidth, H = innerHeight, T = 200;
  // invisible floor at the bottom of the window and walls at its sides (reaching high above it)
  Composite.add(engine.world, [
    Bodies.rectangle(W / 2, H + T / 2, W + 2 * T, T, { isStatic: true }),
    Bodies.rectangle(-T / 2, 0, T, 4 * H, { isStatic: true }),
    Bodies.rectangle(W + T / 2, 0, T, 4 * H, { isStatic: true }),
  ]);

  const items = icons.map((svg) => {
    const r = svg.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const side = r.width + 8;
    const body = Bodies.rectangle(x, y, side, side, { restitution: 0.45, friction: 0.3, frictionAir: 0.01, density: 0.002 });
    svg.style.position = 'relative';
    svg.style.zIndex = '5';
    svg.style.willChange = 'transform';
    return { svg, x, y, body, delay: 0, added: false };
  });
  // staggered start, top rows first: 0–150ms by height plus up to 100ms random
  const ys = items.map((i) => i.y);
  const top = Math.min(...ys), span = Math.max(...ys) - top || 1;
  items.forEach((i) => (i.delay = ((i.y - top) / span) * 150 + Math.random() * 100));

  await new Promise<void>((done) => {
    const t0 = performance.now();
    let last = t0, acc = 0;
    const frame = (now: number) => {
      const elapsed = now - t0;
      for (const i of items) {
        if (i.added || elapsed < i.delay) continue;
        i.added = true;
        Composite.add(engine.world, i.body);
        Body.setVelocity(i.body, { x: rand(-2, 2), y: 0 });
        Body.setAngularVelocity(i.body, rand(-0.15, 0.15));
      }
      acc += Math.min(now - last, 100);
      last = now;
      while (acc >= STEP) { Engine.update(engine, STEP); acc -= STEP; }
      for (const i of items) {
        const { x, y } = i.body.position;
        i.svg.style.transform = `translate(${x - i.x}px, ${y - i.y}px) rotate(${i.body.angle}rad)`;
      }
      if (elapsed < HOLD) requestAnimationFrame(frame);
      else done();
    };
    requestAnimationFrame(frame);
  });

  // fly back along a curve, rotation easing back to 0
  await Promise.all(items.map((i) => {
    const dx = i.body.position.x - i.x, dy = i.body.position.y - i.y, a = i.body.angle;
    const lift = Math.min(160, Math.hypot(dx, dy) * 0.35);
    const cx = dx * 0.25, cy = Math.min(dy, 0) - lift; // control point above the path
    const frames = Array.from({ length: 11 }, (_, k) => {
      const t = k / 10, u = 1 - t;
      const x = u * u * dx + 2 * u * t * cx, y = u * u * dy + 2 * u * t * cy;
      return { transform: `translate(${x}px, ${y}px) rotate(${a * u}rad)` };
    });
    i.svg.style.transform = '';
    return i.svg.animate(frames, {
      duration: 600, delay: Math.random() * 200, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards',
    }).finished;
  }));

  for (const i of items) i.svg.style.position = i.svg.style.zIndex = i.svg.style.willChange = '';
  Composite.clear(engine.world, false);
  Engine.clear(engine);
}
