import data from '../../icons.json';

export const icons = data.icons;
export const COUNT = data.count;
export const CATEGORY_COUNT = data.categories;
export const VERSION = 'v' + data.version;

export const DESIGNER_URL = 'https://nathdesign.in/';
export const FIGMA_URL = 'https://www.figma.com/community/file/1071678557813409125/kalai-icons-free-icon-library';
// Set automatically when GitHub builds the site
export const GITHUB_URL = 'https://github.com/' + (process.env.GITHUB_REPOSITORY ?? '');

export const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const url = (path = '') => BASE + path.replace(/^\//, '');

export const slug = (s: string) => s.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const byCode = new Map(icons.map((i) => [i.code, i]));
// Kalai icons used by the interface itself (DESIGN §2)
export function ui(code: string, size = 18, cls = '') {
  const body = byCode.get(code)?.svg ?? '';
  return `<svg class="ui-icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
const wrap = (body: string, size: number) =>
  `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const MOON = (s = 18) => wrap('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>', s);
export const SUN = (s = 18) =>
  wrap('<path d="M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0Z"/><path d="M12 3v1M12 20v1M5.6 5.6l.7.7M17.7 17.7l.7.7M3 12h1M20 12h1M5.6 18.4l.7-.7M17.7 6.3l.7-.7"/>', s);
