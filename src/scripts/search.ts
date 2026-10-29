// In-browser search over name, tags and category (SPEC §6, D-18, D-46).
// Ranking: exact name → name starts with → name contains → every word found
// in the name → tags → category → close spelling (typos).

export interface Icon { name: string; code: string; category: string; tags: string[]; svg: string }
export interface Hit { icon: Icon; index: number; rank: number; marks: string }

interface Entry { icon: Icon; index: number; name: string; words: string[]; tags: string[]; cat: string[] }

const norm = (s: string) => s.toLowerCase().replace(/&/g, ' ').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

export function prepare(icons: Icon[]): Entry[] {
  return icons.map((icon, index) => ({
    icon, index,
    name: norm(icon.name),
    words: norm(icon.name).split(' '),
    tags: icon.tags.map((t) => t.toLowerCase()),
    cat: norm(icon.category).split(' '),
  }));
}

// Optimal string alignment distance (counts a swap of two letters as one typo)
function distance(a: string, b: string) {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
function close(token: string, word: string) {
  if (token.length < 4) return false;
  const max = token.length >= 7 ? 2 : 1;
  return distance(token, word) <= max || (word.length > token.length && distance(token, word.slice(0, token.length)) <= max);
}

const prefix = (token: string, list: string[]) => list.some((w) => w.startsWith(token));

function tokenRank(t: string, e: Entry): number {
  if (prefix(t, e.words)) return 3;
  if (prefix(t, e.tags)) return 4;
  if (prefix(t, e.cat)) return 5;
  if (e.words.some((w) => close(t, w))) return 6;
  if (e.tags.some((w) => close(t, w)) || e.cat.some((w) => close(t, w))) return 7;
  return -1;
}

export function search(query: string, entries: Entry[]): Hit[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const hits: Hit[] = [];
  for (const e of entries) {
    let rank: number;
    if (e.name === q) rank = 0;
    else if (e.name.startsWith(q)) rank = 1;
    else if (e.name.includes(q)) rank = 2;
    else {
      rank = 0;
      for (const t of tokens) {
        const r = tokenRank(t, e);
        if (r < 0) { rank = -1; break; }
        rank = Math.max(rank, r);
      }
      if (rank < 0) continue;
    }
    hits.push({ icon: e.icon, index: e.index, rank, marks: highlight(e.icon.code, q, tokens, rank) });
  }
  return hits.sort((a, b) => a.rank - b.rank || a.index - b.index);
}

// Wraps the matched part of the code name in <mark> (DESIGN §4.3).
// Tag-only and typo matches get no highlight.
function highlight(code: string, q: string, tokens: string[], rank: number) {
  if (rank <= 2) {
    const needle = q.replace(/ /g, '-');
    const at = code.indexOf(needle);
    if (at >= 0) return code.slice(0, at) + `<mark>${needle}</mark>` + code.slice(at + needle.length);
  }
  return code.split('-').map((w) => {
    const t = tokens.filter((t) => w.startsWith(t)).sort((a, b) => b.length - a.length)[0];
    return t ? `<mark>${t}</mark>${w.slice(t.length)}` : w;
  }).join('-');
}
