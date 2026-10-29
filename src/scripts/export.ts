// Copy and download formats (SPEC §7, DESIGN §4.5). With no color picked,
// code uses currentColor (D-35); Data URL and PNG use the theme text color.
import type { Icon } from './search';
import { download, themeText } from './common';

export type Format = 'svg' | 'jsx' | 'vue' | 'dataurl';

function open(color: string, size: number, attr: (k: string) => string = (k) => k) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" ${attr('stroke-width')}="2" ${attr('stroke-linecap')}="round" ${attr('stroke-linejoin')}="round">`;
}
const paint = (icon: Icon, color: string) => icon.svg.replace(/currentColor/g, color);
const lines = (body: string) => body.replace(/></g, '>\n<').split('\n').map((l) => '  ' + l).join('\n');
const camel = (k: string) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export function svgCode(icon: Icon, color: string | null, size: number) {
  const c = color ?? 'currentColor';
  return `${open(c, size)}\n${lines(paint(icon, c))}\n</svg>`;
}

export function jsxCode(icon: Icon, color: string | null, size: number) {
  const c = color ?? 'currentColor';
  const body = paint(icon, c).replace(/ ([a-z]+(?:-[a-z]+)+)=/g, (_, k) => ` ${camel(k)}=`).replace(/ class=/g, ' className=');
  return `${open(c, size, camel)}\n${lines(body)}\n</svg>`;
}

export function dataUrl(icon: Icon, color: string | null, size: number) {
  const c = color ?? themeText();
  const svg = (open(c, size) + paint(icon, c) + '</svg>').replace(/"/g, "'");
  return 'data:image/svg+xml,' + svg.replace(/[\r\n%#()<>?[\\\]^`{|}]/g, encodeURIComponent);
}

export function code(format: Format, icon: Icon, color: string | null, size: number) {
  if (format === 'jsx') return jsxCode(icon, color, size);
  if (format === 'dataurl') return dataUrl(icon, color, size);
  return svgCode(icon, color, size); // SVG and Vue templates use the same markup
}

export function downloadSvg(icon: Icon, color: string | null, size: number) {
  download(new Blob([svgCode(icon, color, size) + '\n'], { type: 'image/svg+xml' }), `kalai-${icon.code}.svg`);
}

export function downloadPng(icon: Icon, color: string | null, size: number) {
  const c = color ?? themeText();
  const svg = open(c, size) + paint(icon, c) + '</svg>';
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d')!.drawImage(img, 0, 0, size, size);
    canvas.toBlob((blob) => blob && download(blob, `kalai-${icon.code}-${size}.png`), 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
