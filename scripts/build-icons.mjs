// Turns the Figma SVG export into clean, recolorable icons (SPEC §7.4) and
// generates icons.json, the SVG sprite and the "Download all" ZIP.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize } from 'svgo';
import { zipSync, strToU8 } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'figma-export');
const OUT = join(root, 'icons');

// Icon order, names and categories in Figma order. Until the Figma sync (D-31)
// exists, this list comes from the export made for the design mockups.
const list = JSON.parse(readFileSync(join(root, 'design/icons-mock.json'), 'utf8'));
const tags = JSON.parse(readFileSync(join(root, 'tags.json'), 'utf8'));

const ROOT_ATTRS = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};
const isBlack = (v) => /^(black|#000|#000000)$/i.test(v);

// Moves the shared stroke settings to the outer <svg> and keeps every part
// looking exactly as in Figma: filled-only parts get stroke="none" so they
// don't inherit the outer stroke.
const done = new WeakSet();
const kalaiPlugin = {
  name: 'kalai',
  fn: () => ({
    element: {
      enter: (node, parent) => {
        // unwrapping a <g> below can make the walker visit its children twice
        if (node.name === 'svg' || done.has(node)) return;
        done.add(node);
        if (node.name === 'defs' || node.name === 'clipPath') {
          parent.children = parent.children.filter((c) => c !== node);
          return;
        }
        const a = node.attributes;
        delete a['clip-path'];
        delete a.id;
        for (const k of ['fill', 'stroke']) if (a[k] && isBlack(a[k])) a[k] = 'currentColor';
        if (a.fill === 'white' || a.stroke === 'white') throw new Error('white paint left in icon');
        const stroked = a.stroke === 'currentColor';
        if (stroked) {
          delete a.stroke;
          for (const k of ['stroke-width', 'stroke-linecap', 'stroke-linejoin']) {
            if (a[k] === ROOT_ATTRS[k]) delete a[k];
          }
        } else if (node.name !== 'g' && !a.stroke) {
          a.stroke = 'none';
        }
        if (a.fill === 'none') delete a.fill;
      },
      exit: (node, parent) => {
        // unwrap the empty <g> left behind by the removed clip-path
        if (node.name === 'g' && Object.keys(node.attributes).length === 0) {
          const i = parent.children.indexOf(node);
          parent.children.splice(i, 1, ...node.children);
        }
      },
    },
  }),
};

function clean(raw) {
  const { data } = optimize(raw, {
    multipass: false,
    floatPrecision: 3,
    plugins: [
      'removeDoctype', 'removeXMLProcInst', 'removeComments', 'removeMetadata',
      'removeEditorsNSData', 'cleanupAttrs', 'removeHiddenElems', 'removeEmptyText',
      kalaiPlugin,
      'cleanupNumericValues', 'removeEmptyContainers',
      // no arcs: turning curves into arcs visibly changed a few icons (e.g. Globe)
      { name: 'convertPathData', params: { makeArcs: false } },
      { name: 'removeAttrs', params: { attrs: ['svg:(width|height|fill)'] } },
      'sortAttrs',
    ],
  });
  const body = data.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  if (/black|#000|white|<title|id=|<text|<image|opacity|<mask/i.test(body)) {
    throw new Error('unexpected content: ' + body.slice(0, 120));
  }
  return body;
}

const svgTag = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg"${size ? ` width="${size}" height="${size}"` : ''} viewBox="0 0 24 24" ` +
  Object.entries(ROOT_ATTRS).map(([k, v]) => `${k}="${v}"`).join(' ') + '>';

// --- build ---------------------------------------------------------------
const files = readdirSync(SRC).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));
const names = list.map((i) => i.name);
const problems = [];
for (const n of names) if (!files.includes(n)) problems.push(`In the icon list but no SVG: ${n}`);
for (const f of files) if (!names.includes(f)) problems.push(`SVG with no entry in the icon list: ${f}`);
const toCode = (n) => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const seen = new Set();
for (const n of names) {
  const c = toCode(n);
  if (seen.has(c)) problems.push(`Duplicate code name: ${c}`);
  seen.add(c);
  if (!tags[c]?.length) problems.push(`No tags for: ${c}`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
const icons = [];
const zip = {};
const symbols = [];
for (const item of list) {
  const code = toCode(item.name);
  const body = clean(readFileSync(join(SRC, item.name + '.svg'), 'utf8'));
  writeFileSync(join(OUT, code + '.svg'), svgTag(24) + body + '</svg>\n');
  zip[`kalai-icons/${code}.svg`] = strToU8(svgTag(24) + body + '</svg>\n');
  // stroke settings sit on each symbol, since <use> doesn't inherit from the sprite
  symbols.push(svgTag().replace('<svg xmlns="http://www.w3.org/2000/svg"', `<symbol id="${code}"`) + body + '</symbol>');
  icons.push({ name: item.name, code, category: item.category, tags: tags[code], svg: body });
}

const categories = [...new Set(icons.map((i) => i.category))];
const out = { version: '1.0', count: icons.length, categories: categories.length, icons };
writeFileSync(join(root, 'icons.json'), JSON.stringify(out, null, 1) + '\n');

mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public/sprite.svg'), `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>\n`);
zip['kalai-icons/LICENSE'] = strToU8(readFileSync(join(root, 'LICENSE'), 'utf8'));
writeFileSync(join(root, 'public/kalai-icons-svg.zip'), zipSync(zip, { level: 9 }));

console.log(`✓ ${icons.length} icons in ${categories.length} categories → icons/, icons.json, sprite.svg, kalai-icons-svg.zip`);
