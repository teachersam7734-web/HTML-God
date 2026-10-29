// shell-writes.mjs: the deliverable files a Bash or PowerShell command clearly writes, read from the command text, so
// the Stop hook (gate-claim) sees edits made through the shell as well as through Write and Edit.
//
// Recognised (paths with a web extension only):
//   redirection          cmd > out.html, cmd >> app.js, cmd | tee [-a] page.html, cmd | Tee-Object [-FilePath] x.css
//   in-place edits       sed -i ..., perl -pi -e ..., replacing the files named on the line
//   PowerShell writes    Set-Content / Add-Content / Out-File [-Path|-FilePath|-LiteralPath] x.html (or first argument)
//   copies and moves     cp / mv / Copy-Item / Move-Item / copy / move: the destination
//   build scripts        node|python|deno|bun <script> where the script name says build, inline, pack, bundle, single
//                        or render: the value of --out, -o, --outfile, --output, and else the last argument when
//                        there are two or more and it is a web file (inline.mjs src/index.html dist/page.html)
//   esbuild              --outfile=x.js
//   inline code          node -e / python -c with writeFileSync('x.html' ...), open('x.html', 'w')
// Not recognised (documented limit): a script that writes files it does not name on its command line (node build.mjs
// with the paths inside it), editors, git checkout and the like. Those edits are invisible to the Stop hook; run the
// gate after them anyway, or list the files in the command.
import path from 'node:path';

export const WEB_OUT = /\.(?:html?|css|m?js|cjs|jsx|tsx?|svelte|vue|glsl|frag|vert|wgsl|svg|json)$/i;
const unq = s => String(s || '').replace(/^["']|["']$/g, '');
const words = s => [...String(s).matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]);

export function shellWrites(cmd, cwd = process.cwd()) {
  const out = new Set();
  const add = p => { p = unq(p).replace(/[),;]+$/, ''); if (p && WEB_OUT.test(p) && !/^(?:\/dev\/null|NUL|\$null)$/i.test(p) && !/^[a-z]+:\/\//i.test(p)) out.add(path.resolve(cwd, p)); };
  const text = String(cmd || '');
  for (const seg of text.split(/\r?\n|;|&&|\|\|/)) {
    // redirection (not 2> or &> to a log, not >& fd duplication)
    for (const m of seg.matchAll(/(?<![0-9&<>=-])>>?\s*("[^"]+"|'[^']+'|[^\s|;&<>()]+)/g)) add(m[1]);
    const stages = seg.split(/\|(?!\|)/).map(s => s.trim());
    for (const st of stages) {
      const w = words(st); const c = (w[0] || '').toLowerCase();
      if (c === 'tee' || c === 'tee-object') { for (let i = 1; i < w.length; i++) if (!w[i].startsWith('-') || /^-(?:filepath|literalpath|path)$/i.test(w[i - 1] || '')) add(w[i]); }
      else if (c === 'sed' && w.some(x => /^-i|^--in-place|^-[a-z]*i/.test(x) && !/^-[a-z]*e$/.test(x))) w.slice(1).forEach(add);
      else if (c === 'perl' && w.some(x => /^-[a-z]*i/.test(x))) w.slice(1).forEach(add);
      else if (/^(?:set-content|add-content|out-file|sc|ac)$/.test(c)) {
        const named = w.findIndex(x => /^-(?:path|filepath|literalpath)$/i.test(x));
        if (named > 0) add(w[named + 1]); else { const first = w.slice(1).find(x => !x.startsWith('-')); if (first) add(first); }
      } else if (/^(?:cp|mv|copy-item|move-item|copy|move|cpi|mi|install)$/.test(c)) {
        const named = w.findIndex(x => /^-destination$/i.test(x));
        if (named > 0) add(w[named + 1]); else { const args = w.slice(1).filter(x => !x.startsWith('-')); if (args.length >= 2) add(args[args.length - 1]); }
      } else if (/^(?:node|deno|bun|python[\d.]*|py|npx)$/.test(c)) {
        const evalIdx = w.findIndex(x => /^(?:-e|--eval|-p|--print|-c)$/.test(x));
        if (evalIdx > 0) {
          const code = w.slice(evalIdx + 1).join(' ');
          for (const m of code.matchAll(/(?:writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream)\(\s*["'`]([^"'`]+)["'`]/g)) add(m[1]);
          for (const m of code.matchAll(/\bopen\(\s*["']([^"']+)["']\s*,\s*["'][wa]/g)) add(m[1]);
          for (const m of code.matchAll(/\.write_text\(|Path\(\s*["']([^"']+)["']\s*\)\.write_(?:text|bytes)\(/g)) if (m[1]) add(m[1]);
          continue;
        }
        const script = w.slice(1).find(x => !x.startsWith('-') && x !== 'run') || '';
        const esb = /\besbuild\b/.test(st);
        for (let i = 1; i < w.length; i++) {
          const m = /^(?:--outfile|--out|--output|-o)(?:=(.+))?$/.exec(w[i]);
          if (m) add(m[1] ?? w[i + 1]);
        }
        if (!esb && /(?:build|inline|pack|bundle|single|render)[\w.-]*\.(?:m?js|cjs|ts|py)$/i.test(path.basename(script))) {
          const named = w.some(x => /^(?:--outfile|--out|--output|-o)(?:=|$)/.test(x));
          // input then output: inline.mjs src/index.html dist/page.html, build-single.mjs build.json out.html
          const positional = w.slice(w.indexOf(script) + 1).filter(x => !x.startsWith('-'));
          if (!named && positional.length >= 2) add(positional[positional.length - 1]);
        }
      } else if (c === 'esbuild') {
        for (const x of w) { const m = /^--outfile=(.+)$/.exec(x); if (m) add(m[1]); }
      }
    }
  }
  return [...out];
}
