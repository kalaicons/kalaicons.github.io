// Shared by every page: theme toggle, toasts, copying, dialog focus handling.

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll(sel)] as T[];
export const BASE = document.documentElement.dataset.base || '/';
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const store = {
  get<T>(key: string): T | null {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch { /* private mode */ }
  },
};

// --- theme (D-26) ---------------------------------------------------------
const root = document.documentElement;
const toggle = $<HTMLButtonElement>('#theme-toggle');
function renderTheme() {
  const dark = root.dataset.theme === 'dark';
  $('.moon', toggle).hidden = dark;
  $('.sun', toggle).hidden = !dark;
  toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
}
toggle.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('kalai-theme', root.dataset.theme); } catch { /* ignore */ }
  renderTheme();
  document.dispatchEvent(new Event('themechange'));
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem('kalai-theme'); } catch { /* ignore */ }
  if (saved) return;
  root.dataset.theme = e.matches ? 'dark' : 'light';
  renderTheme();
  document.dispatchEvent(new Event('themechange'));
});
renderTheme();

export const themeText = () => getComputedStyle(root).getPropertyValue('--text').trim().toUpperCase();

// --- toast (DESIGN §3.9) ----------------------------------------------------
let toastEl: HTMLElement | null = null;
let toastTimer = 0;
export function toast(html: string, kind: 'ok' | 'err' = 'ok', icon = kind === 'ok' ? 'check' : 'clear') {
  toastEl?.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', 'status');
  const tpl = $<HTMLTemplateElement>('#toast-icons');
  const ic = tpl.content.querySelector(`[data-k="${icon}"] svg`);
  if (ic) el.append(ic.cloneNode(true));
  const span = document.createElement('span');
  span.innerHTML = html;
  el.append(span);
  document.body.append(el);
  toastEl = el;
  toastTimer = window.setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  }, kind === 'err' ? 3200 : 2000);
}

// Older copy method, for browsers or embedded views that block the Clipboard API
function legacyCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  const active = document.activeElement as HTMLElement | null;
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  active?.focus({ preventScroll: true });
  return ok;
}

export async function copy(text: string, okMessage: string, selectEl?: HTMLElement) {
  try {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      if (!legacyCopy(text)) throw e;
    }
    toast(okMessage);
  } catch {
    toast("Couldn't copy. Select the code and press Ctrl/⌘ + C", 'err');
    if (selectEl) {
      const r = document.createRange();
      r.selectNodeContents(selectEl);
      const s = getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    }
  }
}

// --- dialogs: focus trap and restore -----------------------------------------
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function trapFocus(dialog: HTMLElement) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const els = $$<HTMLElement>(FOCUSABLE, dialog).filter((el) => el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  dialog.addEventListener('keydown', onKey);
  return () => dialog.removeEventListener('keydown', onKey);
}

export function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
