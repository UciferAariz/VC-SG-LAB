/** Build-size report (dev only): node scripts/build-size.mjs [outFile] — run after npm run build. */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const rows = [];
let js = 0;
let css = 0;
let raw = 0;
function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const b = readFileSync(p);
      const g = gzipSync(b, { level: 9 }).length;
      rows.push([relative('dist', p).split(sep).join('/'), b.length, g]);
      raw += b.length;
      if (p.endsWith('.js')) js += g;
      if (p.endsWith('.css')) css += g;
    }
  }
}
walk('dist');
let out = 'Production build (npm run build), sizes in bytes\n\nfile                                    raw      gzip\n';
for (const [f, r, g] of rows.sort((a, b) => b[1] - a[1])) out += f.padEnd(36) + String(r).padStart(8) + String(g).padStart(10) + '\n';
const kb = (n) => (n / 1024).toFixed(1);
out += `\nJS gzipped:      ${kb(js)} KB\nCSS gzipped:     ${kb(css)} KB\nJS+CSS gzipped:  ${kb(js + css)} KB  (budget 300 KB)\nWhole dist/ uncompressed: ${kb(raw)} KB  (first-load budget 1 MB)\nFonts: system font stacks only; nothing is downloaded.\n`;
if (process.argv[2]) writeFileSync(process.argv[2], out);
console.log(out);
