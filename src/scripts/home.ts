// Home page: customizer, search, category filter, icon panel, sheets, easter eggs.
import data from '../../icons.json';
import { $, $$, BASE, store, copy, toast, trapFocus, reducedMotion } from './common';
import { prepare, search, type Icon } from './search';
import { code, svgCode, downloadSvg, downloadPng, type Format } from './export';
import { colorControl, sizeControl, parseHex, snap, GLOBAL_STOPS } from './controls';
import { dropIcons } from './drop';

const icons = data.icons as Icon[];
const COUNT = data.count;
const entries = prepare(icons);
const slug = (s: string) => s.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const byCode = new Map(icons.map((icon, i) => [icon.code, { icon, n: i + 1 }]));
const catName = new Map(icons.map((i) => [slug(i.category), i.category]));
const catCount = (s: string) => icons.filter((i) => slug(i.category) === s).length;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const isMobile = () => matchMedia('(max-width: 639px)').matches;
const pageTitle = document.title;

// --- elements -----------------------------------------------------------------
const main = $('#main');
const hero = $('.hero');
const q = $<HTMLInputElement>('#q');
const qClear = $('#q-clear');
const sections = $('#sections');
const results = $('#results');
const resGrid = $('#res-grid');
const secret = $('#secret');
const empty = $('#empty');
const live = $('#live');
const scrim = $('#scrim');
const tiles = $$<HTMLButtonElement>('.tile');
const tileByCode = new Map(tiles.map((t) => [t.dataset.code!, t]));
const homeGrid = new Map(tiles.map((t) => [t, t.parentElement!]));

// --- global customizer (D-20) -------------------------------------------------
interface Look { color: string | null; size: number }
const saved = store.get<Look>('kalai-customizer');
const look: Look = {
  color: saved?.color ? parseHex(saved.color) : null,
  size: saved && GLOBAL_STOPS.includes(saved.size) ? saved.size : 24,
};
const setColor = (c: string | null) => { look.color = c; applyLook(); };
const setSize = (s: number) => { look.size = s; applyLook(); };
const globalControls = [
  colorControl($('[data-color-ctl="g-color"]'), setColor),
  colorControl($('[data-color-ctl="m-color"]'), setColor),
];
const sizeControls = [sizeControl($('[data-size-ctl="g-size"]'), setSize), sizeControl($('[data-size-ctl="m-size"]'), setSize)];

function applyLook() {
  main.style.setProperty('--icon-color', look.color ?? 'var(--text)');
  main.style.setProperty('--icon-size', `${look.size}px`);
  globalControls.forEach((c) => c.render(look.color));
  sizeControls.forEach((c) => c.render(look.size));
  $$('[data-color-chip]').forEach((el) => (el.style.background = look.color ?? 'var(--text)'));
  const val = $('[data-color-val]');
  val.textContent = look.color ?? 'Theme';
  val.classList.toggle('hex-val', !!look.color);
  $('[data-size-val]').textContent = `${look.size}px`;
  store.set('kalai-customizer', look);
}
$$('[data-reset]').forEach((b) => b.addEventListener('click', () => { look.color = null; look.size = 24; applyLook(); }));

// --- search + category (SPEC §6, DESIGN §4.3–4.4) -------------------------------
let query = '';
let category = '';
let list: Icon[] = icons; // what's on screen, in order (for ← / →)
let showingResults = false;

function render() {
  const text = query.trim();
  const cName = catName.get(category) ?? '';
  // move tiles back only when leaving results: moving a tile drops its keyboard focus
  if (showingResults) {
    for (const t of tiles) {
      homeGrid.get(t)!.append(t);
      $('.t-name', t).textContent = t.dataset.code!;
    }
  }
  showingResults = !!text;
  if (!text) {
    sections.hidden = false;
    results.hidden = empty.hidden = true;
    $$('.section').forEach((s) => (s.hidden = !!category && s.dataset.cat !== category));
    list = category ? icons.filter((i) => slug(i.category) === category) : icons;
    live.textContent = category ? `${list.length} icons in ${cName}` : '';
  } else {
    sections.hidden = true;
    let hits = search(text, entries);
    if (category) hits = hits.filter((h) => slug(h.icon.category) === category);
    const isSecret = ['nath', 'kalai'].includes(text.toLowerCase());
    secret.hidden = !isSecret;
    list = hits.map((h) => h.icon);
    for (const h of hits) {
      const t = tileByCode.get(h.icon.code)!;
      $('.t-name', t).innerHTML = h.marks;
      resGrid.append(t);
    }
    const quoted = `“${esc(text)}”`;
    if (!hits.length && !isSecret) {
      results.hidden = true;
      empty.hidden = false;
      $('#empty-title').innerHTML = `No icons for ${quoted}${category ? ` in ${esc(cName)}` : ''}`;
      $('#empty-text').textContent = 'Check the spelling or try a broader word, like “send” or “launch”.' +
        (category ? ` The ${cName} filter is on, so other categories weren't searched.` : '');
      $('#empty-all').hidden = !category;
      $('#empty-clear').className = `btn ${category ? 'btn-secondary' : 'btn-primary'}`;
      live.textContent = `No icons for ${text}`;
    } else {
      empty.hidden = true;
      results.hidden = false;
      if (isSecret) {
        $('#res-title').textContent = 'You found the maker.';
        $('#res-note').textContent = `1 secret result for “${text}” · not one of the ${COUNT}`;
      } else {
        $('#res-title').innerHTML = `<span class="num">${hits.length}</span> ${hits.length === 1 ? 'icon' : 'icons'} for ${quoted}`;
        $('#res-note').textContent = `${category ? `in ${cName}` : 'in all categories'} · best match first`;
      }
      live.textContent = `${hits.length} ${hits.length === 1 ? 'icon' : 'icons'} for ${text}`;
    }
  }
  renderCategory();
  if (!current) history.replaceState(history.state, '', homeUrl());
}

function homeUrl() {
  const p = new URLSearchParams();
  if (query.trim()) p.set('q', query.trim());
  if (category) p.set('category', category);
  const s = p.toString();
  return BASE + (s ? `?${s}` : '');
}

function scrollToResults() {
  const top = hero.getBoundingClientRect().bottom + scrollY - $('.site-header').offsetHeight;
  if (scrollY < top - 1) scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function setQuery(value: string, scroll = true) {
  query = value;
  q.value = value;
  qClear.hidden = !value;
  render();
  if (scroll && value.trim()) scrollToResults();
}
q.addEventListener('input', () => setQuery(q.value));
q.addEventListener('keydown', (e) => { if (e.key === 'Escape' && q.value) { e.preventDefault(); setQuery(''); } });
qClear.addEventListener('click', () => { setQuery(''); q.focus(); });
$$('[data-clear]').forEach((b) => b.addEventListener('click', () => { setQuery(''); q.focus(); }));
$('#empty-all').addEventListener('click', () => setCategory(''));
addEventListener('keydown', (e) => {
  const t = e.target instanceof HTMLElement ? e.target : null;
  if (e.key === '/' && !current && !openSheet && !t?.matches('input, textarea, [contenteditable]')) {
    e.preventDefault();
    q.focus();
  }
});
// the short hint also fits narrow desktops, where search shares its row with the controls
const shortHint = matchMedia('(max-width: 639px), (min-width: 1024px) and (max-width: 1199px)');
const placeholder = () => (q.placeholder = shortHint.matches ? q.dataset.mobilePlaceholder! : 'Search icons, tags, synonyms');
shortHint.addEventListener('change', placeholder);
placeholder();

function setCategory(s: string) {
  category = catName.has(s) ? s : '';
  render();
}
function renderCategory() {
  const label = category ? `${catName.get(category)} · ${catCount(category)}` : `All · ${COUNT}`;
  $$('[data-cat-val]').forEach((el) => { el.textContent = label; el.classList.toggle('active', !!category); });
  $$('[data-cat]').forEach((o) => o.matches('.option') && o.setAttribute('aria-selected', String(o.dataset.cat === category)));
}

// Desktop dropdown (role="listbox", DESIGN §3.3)
const catBtn = $('#cat-btn');
const catMenu = $('#cat-menu');
const catOpts = $$('.option', catMenu);
catOpts.forEach((o, i) => (o.id = `cat-opt-${i}`));
let activeOpt = 0;
function setActive(i: number) {
  activeOpt = (i + catOpts.length) % catOpts.length;
  catOpts.forEach((o, j) => o.classList.toggle('active', j === activeOpt));
  catMenu.setAttribute('aria-activedescendant', catOpts[activeOpt].id);
  catOpts[activeOpt].scrollIntoView({ block: 'nearest' });
}
function openMenu() {
  closePopover();
  catMenu.hidden = false;
  catBtn.setAttribute('aria-expanded', 'true');
  setActive(Math.max(0, catOpts.findIndex((o) => o.dataset.cat === category)));
  catMenu.focus();
}
function closeMenu(focus = true) {
  if (catMenu.hidden) return;
  catMenu.hidden = true;
  catBtn.setAttribute('aria-expanded', 'false');
  if (focus) catBtn.focus();
}
catBtn.addEventListener('click', () => (catMenu.hidden ? openMenu() : closeMenu()));
catOpts.forEach((o, i) => {
  o.addEventListener('click', () => { setCategory(o.dataset.cat!); closeMenu(); });
  o.addEventListener('pointermove', () => activeOpt !== i && setActive(i));
});
catMenu.addEventListener('keydown', (e) => {
  const moves: Record<string, number> = { ArrowDown: activeOpt + 1, ArrowUp: activeOpt - 1, Home: 0, End: catOpts.length - 1 };
  if (e.key in moves) { e.preventDefault(); setActive(moves[e.key]); }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCategory(catOpts[activeOpt].dataset.cat!); closeMenu(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
  else if (e.key === 'Tab') closeMenu(false);
});

// Color popover
const colorBtn = $('#color-btn');
const colorPop = $('#color-pop');
function closePopover(focus = false) {
  if (colorPop.hidden) return;
  colorPop.hidden = true;
  colorBtn.setAttribute('aria-expanded', 'false');
  if (focus) colorBtn.focus();
}
colorBtn.addEventListener('click', () => {
  if (!colorPop.hidden) return closePopover();
  closeMenu(false);
  colorPop.hidden = false;
  colorBtn.setAttribute('aria-expanded', 'true');
  $<HTMLInputElement>('.hex', colorPop).focus();
});
colorPop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePopover(true); } });
addEventListener('pointerdown', (e) => {
  const t = e.target as Node;
  if (!catMenu.hidden && !catMenu.parentElement!.contains(t)) closeMenu(false);
  if (!colorPop.hidden && !colorPop.parentElement!.contains(t)) closePopover();
});

// --- mobile bottom sheets (DESIGN §4.10) ----------------------------------------
let openSheet: HTMLElement | null = null;
let sheetTrigger: HTMLElement | null = null;
let releaseSheet = () => {};
function showSheet(sheet: HTMLElement, trigger: HTMLElement) {
  openSheet = sheet;
  sheetTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  scrim.hidden = sheet.hidden = false;
  document.body.classList.add('locked');
  releaseSheet = trapFocus(sheet);
  ($('[aria-selected="true"]', sheet) ?? $('[data-sheet-close]', sheet)).focus({ preventScroll: true });
}
function hideSheet() {
  if (!openSheet) return;
  openSheet.hidden = scrim.hidden = true;
  openSheet.style.transform = '';
  document.body.classList.remove('locked');
  releaseSheet();
  sheetTrigger?.setAttribute('aria-expanded', 'false');
  sheetTrigger?.focus();
  openSheet = null;
}
const catSheet = $('#sheet-cat');
const styleSheet = $('#sheet-style');
$('#m-cat-btn').addEventListener('click', (e) => showSheet(catSheet, e.currentTarget as HTMLElement));
$('#m-style-btn').addEventListener('click', (e) => showSheet(styleSheet, e.currentTarget as HTMLElement));
$$('.option', catSheet).forEach((o) => o.addEventListener('click', () => { setCategory(o.dataset.cat!); hideSheet(); }));
$$('[data-sheet-close]').forEach((b) => b.addEventListener('click', hideSheet));
for (const sheet of [catSheet, styleSheet]) {
  sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideSheet(); });
  // swipe down on the handle or title to close
  let startY = 0, dy = 0, dragging = false;
  const grip = [$('.grab', sheet), $('.sheet-head', sheet)];
  grip.forEach((g) => g.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; dy = 0; dragging = true; }, { passive: true }));
  sheet.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    if (dy > 80) hideSheet();
    else sheet.style.transform = '';
  });
}

// --- icon panel (D-25, DESIGN §4.5) ------------------------------------------------
const panelWrap = $('#panel-wrap');
const panel = $('#panel');
const codeblock = $('#p-codeblock');
const tabs = $$<HTMLButtonElement>('.tab');
let current: Icon | null = null;
let pLook: Look = { color: null, size: 24 };
let format: Format = 'svg';
let pushed = false;
let releasePanel = () => {};
const pColor = colorControl($('[data-color-ctl="p-color"]'), (c) => { pLook.color = c; renderPanel(); });
const pSize = sizeControl($('[data-size-ctl="p-size"]'), (s) => { pLook.size = s; renderPanel(); });

function renderPanel() {
  if (!current) return;
  panel.style.setProperty('--p-color', pLook.color ?? 'var(--text)');
  pColor.render(pLook.color);
  pSize.render(pLook.size);
  codeblock.textContent = code(format, current, pLook.color, pLook.size);
}

function openPanel(codeName: string, how: 'push' | 'replace' | 'none') {
  const entry = byCode.get(codeName);
  if (!entry) return;
  const { icon, n } = entry;
  if (!current) {
    pLook = { color: look.color, size: snap(look.size) };
    closeMenu(false);
    closePopover();
    hideSheet();
    scrim.hidden = panelWrap.hidden = false;
    document.body.classList.add('locked');
    releasePanel = trapFocus(panel);
    panelWrap.scrollTop = 0;
  }
  if (current) tileByCode.get(current.code)?.classList.remove('selected');
  current = icon;
  tileByCode.get(icon.code)?.classList.add('selected');
  const path = `icon/${icon.code}`;
  $('#p-num').textContent = String(n).padStart(3, '0');
  $('#p-addr').textContent = `/${path}`;
  $('#p-name').textContent = icon.name;
  $('#p-code').textContent = icon.code;
  $('#p-copy-name').setAttribute('aria-label', `Copy code name ${icon.code}`);
  const cat = $<HTMLAnchorElement>('#p-cat');
  cat.textContent = icon.category;
  cat.href = `${BASE}?category=${slug(icon.category)}`;
  cat.dataset.cat = slug(icon.category);
  $('#p-tags').innerHTML = icon.tags.map((t) => `<button class="tag" type="button" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
  $('#p-svg').innerHTML = icon.svg;
  renderPanel();
  if (how === 'push') { history.pushState({ panel: true }, '', BASE + path); pushed = true; }
  else if (how === 'replace') history.replaceState(history.state, '', BASE + path);
  document.title = `${icon.name} icon · Kalai Icons`;
  // no scroll: on phones the sheet is still sliding in from below
  if (!panel.contains(document.activeElement)) $('#p-close').focus({ preventScroll: true });
}

function closePanel(how: 'back' | 'none') {
  if (!current) return;
  const code = current.code;
  tileByCode.get(code)?.classList.remove('selected');
  current = null;
  scrim.hidden = panelWrap.hidden = true;
  document.body.classList.remove('locked');
  releasePanel();
  document.title = pageTitle.includes(' icon · ') ? 'Kalai Icons' : pageTitle;
  if (how === 'back') {
    if (pushed) history.back();
    else history.replaceState(null, '', homeUrl());
  }
  pushed = false;
  const tile = tileByCode.get(code);
  if (tile?.offsetParent) tile.focus({ preventScroll: false });
}

function step(dir: 1 | -1) {
  if (!current || !list.length) return;
  const i = list.findIndex((ic) => ic.code === current!.code);
  const next = list[(i + dir + list.length) % list.length];
  openPanel(next.code, 'replace');
  tileByCode.get(next.code)?.scrollIntoView({ block: 'nearest' });
}

main.addEventListener('click', (e) => {
  const tile = (e.target as HTMLElement).closest<HTMLElement>('.tile');
  if (tile && !dropping) openPanel(tile.dataset.code!, 'push'); // ignored while icons are away
});
$('#p-close').addEventListener('click', () => closePanel('back'));
panelWrap.addEventListener('click', (e) => { if (e.target === panelWrap) closePanel('back'); });
scrim.addEventListener('click', () => (openSheet ? hideSheet() : closePanel('back')));
addEventListener('keydown', (e) => {
  if (!current) return;
  if (e.key === 'Escape') { e.preventDefault(); closePanel('back'); return; }
  const t = e.target instanceof Element ? e.target : null;
  const busy = !!t?.matches('input, [role="radio"], [role="tab"]');
  if (!busy && !isMobile() && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  }
});
$('#p-reset').addEventListener('click', () => { pLook = { color: look.color, size: snap(look.size) }; renderPanel(); });
$('#p-tags').addEventListener('click', (e) => {
  const tag = (e.target as HTMLElement).closest<HTMLElement>('[data-tag]');
  if (!tag) return;
  closePanel('back');
  setTimeout(() => setQuery(tag.dataset.tag!), 0);
});
$('#p-cat').addEventListener('click', (e) => {
  e.preventDefault();
  const s = (e.currentTarget as HTMLElement).dataset.cat!;
  closePanel('back');
  setTimeout(() => { query = ''; q.value = ''; qClear.hidden = true; setCategory(s); scrollToResults(); }, 0);
});

const LABEL: Record<Format, string> = { svg: 'SVG', jsx: 'JSX', vue: 'Vue', dataurl: 'Data URL' };
function selectTab(tab: HTMLButtonElement) {
  format = tab.dataset.format as Format;
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  codeblock.setAttribute('aria-labelledby', tab.id);
  renderPanel();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = tabs[(i + d + tabs.length) % tabs.length];
    next.focus();
    selectTab(next);
  });
});

$('#p-copy-svg').addEventListener('click', () =>
  copy(svgCode(current!, pLook.color, pLook.size), 'Copied! SVG is on your clipboard', codeblock));
$('#p-copy-code').addEventListener('click', () =>
  copy(codeblock.textContent!, `Copied! ${LABEL[format]} is on your clipboard`, codeblock));
$('#p-copy-name').addEventListener('click', () => copy(current!.code, `Copied! <code>${current!.code}</code>`, $('#p-code')));
$('#p-dl-svg').addEventListener('click', () => downloadSvg(current!, pLook.color, pLook.size));
$('#p-dl-png').addEventListener('click', () => downloadPng(current!, pLook.color, pLook.size));
document.addEventListener('themechange', renderPanel);

// --- address bar ---------------------------------------------------------------------
function iconFromPath() {
  const m = location.pathname.slice(BASE.length - 1).match(/^\/icon\/([a-z0-9-]+)\/?$/);
  return m ? m[1] : null;
}
function readQuery() {
  const p = new URLSearchParams(location.search);
  query = p.get('q') ?? '';
  q.value = query;
  qClear.hidden = !query;
  category = catName.has(p.get('category') ?? '') ? p.get('category')! : '';
}
addEventListener('popstate', () => {
  const c = iconFromPath();
  if (c) openPanel(c, 'none');
  else {
    closePanel('none');
    const before = query + '|' + category;
    readQuery();
    if (query + '|' + category !== before) render();
  }
});

// --- easter egg A: tap the dot 3× (D-43, DESIGN §4.11) ------------------------------------
const dot = $('#dot');
let taps = 0, lastTap = 0, dropping = false;
dot.addEventListener('click', () => {
  const now = performance.now();
  taps = now - lastTap <= 1500 ? taps + 1 : 1;
  lastTap = now;
  if (taps < 3) return;
  taps = 0;
  if (dropping || current) return;
  dropping = true;
  dot.classList.add('found');
  toast("You can't connect the dots looking forward. Picking them up…", 'ok', 'star');
  const visible = tiles.filter((t) => {
    if (!t.offsetParent) return false;
    const r = t.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  });
  dropIcons(visible.map((t) => t.querySelector('svg')!)).finally(() => (dropping = false));
});

// --- start ---------------------------------------------------------------------------------
applyLook();
readQuery();
const boot = JSON.parse($('#boot').textContent || '{}');
const start = boot.open ?? iconFromPath();
if (start) openPanel(start, 'none'); // before render(), so the /icon/… address is kept
render();
