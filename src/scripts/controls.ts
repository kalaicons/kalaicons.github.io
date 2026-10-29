// Color and size controls, shared by the toolbar, the Style sheet and the icon panel.
import { $, $$, themeText } from './common';
import { GLOBAL_STOPS, PANEL_STOPS } from '../lib/stops';

export { GLOBAL_STOPS, PANEL_STOPS };

export function parseHex(raw: string): string | null {
  const s = raw.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) return '#' + [...s].map((c) => c + c).join('').toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(s)) return '#' + s.toUpperCase();
  return null;
}

export interface Control<T> { render(value: T): void }

export function colorControl(el: HTMLElement, onChange: (color: string | null) => void): Control<string | null> {
  const picker = $<HTMLInputElement>('input[type=color]', el);
  const fill = $('.picker-fill', el);
  const field = $('.hex-field', el);
  const hex = $<HTMLInputElement>('.hex', el);
  const err = $('.hex-err', el);
  const swatches = $$<HTMLButtonElement>('.swatch', el);
  let value: string | null = null;

  const setError = (on: boolean) => {
    field.classList.toggle('invalid', on);
    err.hidden = !on;
    hex.setAttribute('aria-invalid', String(on));
  };
  function render(v: string | null) {
    value = v;
    const shown = v ?? themeText();
    fill.style.background = shown;
    picker.value = shown.length === 7 ? shown.toLowerCase() : '#000000';
    if (document.activeElement !== hex) { hex.value = v ? v.slice(1) : ''; setError(false); }
    const match = swatches.find((s) => (s.dataset.value || null) === v) ?? null;
    swatches.forEach((s) => {
      s.setAttribute('aria-checked', String(s === match));
      s.tabIndex = s === (match ?? swatches[0]) ? 0 : -1;
    });
  }
  picker.addEventListener('input', () => onChange(picker.value.toUpperCase()));
  hex.addEventListener('input', () => {
    const s = hex.value.trim().replace(/^#/, '');
    if (!s) return setError(false);
    const parsed = parseHex(s);
    if (parsed) { setError(false); onChange(parsed); }
    else setError(/[^0-9a-f]/i.test(s) || s.length > 6);
  });
  const commit = () => {
    const s = hex.value.trim();
    if (!s) { setError(false); onChange(null); return; }
    if (parseHex(s)) { setError(false); hex.value = parseHex(s)!.slice(1); }
    else setError(true); // the last valid color stays applied
  };
  hex.addEventListener('blur', commit);
  hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  swatches.forEach((s, i) => {
    s.addEventListener('click', () => onChange(s.dataset.value || null));
    s.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = swatches[(i + step + swatches.length) % swatches.length];
      next.focus();
      onChange(next.dataset.value || null);
    });
  });
  document.addEventListener('themechange', () => render(value));
  return { render };
}

export function sizeControl(el: HTMLElement, onChange: (size: number) => void): Control<number> {
  const stops = el.dataset.stops!.split(',').map(Number);
  const range = $<HTMLInputElement>('.range', el);
  const out = $('.size-val', el);
  const cell = el.closest('.size-cell') ?? el;
  function render(size: number) {
    const i = Math.max(0, stops.indexOf(size));
    range.value = String(i);
    out.textContent = `${size}px`;
    range.setAttribute('aria-valuetext', `${size}px`);
    range.style.setProperty('--fill', `${(i / (stops.length - 1)) * 100}%`);
  }
  range.addEventListener('input', () => onChange(stops[Number(range.value)]));
  range.addEventListener('pointerdown', () => cell.classList.add('dragging'));
  addEventListener('pointerup', () => cell.classList.remove('dragging'));
  return { render };
}

// The panel's stops differ from the toolbar's (no 40): use the nearest one, rounding up.
export function snap(size: number, stops = PANEL_STOPS) {
  return stops.reduce((best, s) => (Math.abs(s - size) <= Math.abs(best - size) ? s : best), stops[0]);
}
