// lint/licence.mjs: decides whether text about to be written breaks the licence rules (doctrine 4).
//   never-ship source + code, written into a plugin                     -> block
//   never-ship source + code, written into a user project, no notice    -> warn (keep the copyright notice)
//   ideas-only marker, or ideas-only origin + code, anywhere           -> block
//   non-commercial licence text + code: commercial mode block, personal mode warn
// Markdown and plain text are judged per fenced code block, so prose, catalogues and notice templates pass.
import fs from 'node:fs';
import path from 'node:path';
import { NEVER_SHIP, IDEAS_ONLY, NONCOMMERCIAL } from '../ledger.mjs';
import { finding } from '../gate.mjs';

// Something that reads as program code rather than a sentence or a bare notice.
const CODE = /\bexport\s+(default|const|function|class)\b|\bimport\s+[\w{*][^;\n]*\bfrom\s+['"]|\buse(State|Effect|Ref|Memo|Frame)\s*\(|gl_FragColor|\bprecision\s+(high|medium|low)p\b|\bvoid\s+main(Image)?\s*\(|\bfunction\s*\w*\s*\([^)]*\)\s*\{|=>\s*[{(]|className=|@keyframes|\b(const|let|var)\s+\w+\s*=|<(div|section|canvas|svg)\b[^>]*>/;

const PROSE_EXT = new Set(['.md', '.markdown', '.mdx', '.txt', '.rst']);

export function chunks(text, file) {
  const ext = file ? path.extname(file).toLowerCase() : '';
  if (!PROSE_EXT.has(ext)) return [text];
  return [...text.matchAll(/^(```|~~~)[^\n]*\n([\s\S]*?)^\1/gm)].map(m => m[2]);
}

// A file is in a plugin path when any folder above it holds .claude-plugin/ (a plugin or marketplace root,
// which gets redistributed).
export function pluginRootOf(file) {
  if (!file) return null;
  let dir = path.dirname(path.resolve(file));
  for (;;) {
    if (fs.existsSync(path.join(dir, '.claude-plugin'))) return dir;
    const up = path.dirname(dir); if (up === dir) return null; dir = up;
  }
}

// A Shadertoy-shaped shader: the mainImage entry point with Shadertoy's built-in uniforms. Copied Shadertoy code
// keeps both even when the URL is gone.
const SHADERTOY_MAIN = /\bvoid\s+mainImage\s*\(\s*out\s+vec4\s+\w+\s*,\s*(?:in\s+)?vec2\s+\w+\s*\)/;
const SHADERTOY_UNIFORM = /\bi(?:Time|Resolution|Mouse|Frame|TimeDelta|Date|ChannelResolution|Channel[0-3])\b/;
export const shadertoyShaped = c => SHADERTOY_MAIN.test(c) && SHADERTOY_UNIFORM.test(c);

// A react-bits-shaped component: the registry's folder layout, or a React component named like one of its
// distinctive components. Only judged for plugin paths (React Bits code is fine in a user's project with its notice).
const REACT_BITS_PATH = /[\\/](?:content|ts-default|ts-tailwind|tailwind)[\\/](?:Animations|Backgrounds|Components|TextAnimations)[\\/][A-Z]\w+[\\/]/;
const REACT_BITS_NAMES = ['Ballpit', 'Hyperspeed', 'LiquidChrome', 'Iridescence', 'FaultyTerminal', 'DarkVeil', 'GridDistortion', 'PixelTransition',
  'ClickSpark', 'StarBorder', 'DecryptedText', 'ShinyText', 'BlurText', 'FuzzyText', 'TrueFocus', 'ScrambledText', 'TextPressure', 'VariableProximity',
  'SplashCursor', 'BlobCursor', 'LetterGlitch', 'MetaBalls', 'PixelTrail', 'GlareHover', 'MagnetLines', 'Balatro', 'RippleGrid', 'LiquidEther',
  'PrismaticBurst', 'GradientBlinds', 'ElectricBorder', 'LogoLoop', 'CardSwap', 'FlowingMenu', 'InfiniteMenu', 'CircularGallery', 'MagicBento',
  'ChromaGrid', 'TiltedCard', 'GooeyNav', 'PixelCard', 'SpotlightCard', 'ScrollStack', 'ScrollVelocity', 'CurvedLoop', 'TargetCursor', 'ShapeBlur',
  'GlitchText', 'RotatingText', 'CircularText', 'GradualBlur', 'FloatingLines', 'LightPillar', 'PixelBlast'];
const REACT_USE = /\buse(?:State|Effect|Ref|Memo|Frame|LayoutEffect)\s*\(|from\s+['"]react['"]|className=|<\/?[A-Z]\w*[\s>]/;
export function reactBitsShaped(c, file) {
  if (file && REACT_BITS_PATH.test(file) && REACT_USE.test(c)) return 'registry folder ' + file.match(REACT_BITS_PATH)[0];
  if (!REACT_USE.test(c)) return null;
  const m = c.match(new RegExp(String.raw`(?:export\s+default\s+)?(?:function\s+(${REACT_BITS_NAMES.join('|')})\s*\(|(?:const|let)\s+(${REACT_BITS_NAMES.join('|')})\s*(?::[^=]+)?=\s*(?:\(|React\.|forwardRef|memo))`));
  return m ? `component ${m[1] || m[2]}` : null;
}

// A source URL on a comment line that says the code is original and only the idea came from there.
const CREDIT = /\b(?:inspired\s+by|idea\s+(?:from|after)|ideas?\s+only|technique\s+(?:from|inspired|after)|based\s+on\s+the\s+idea|after\s+the\s+idea|own\s+code)\b/i;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*|#|<!--|--)/;
const creditOnly = (c, re) => {
  const lines = c.split('\n').filter(l => re.test(l));
  return lines.length > 0 && lines.every(l => (COMMENT_LINE.test(l) || /\/\/|\/\*/.test(l.slice(0, l.search(re)))) && CREDIT.test(l));
};

export function scanLicence(text, { file = null, inPlugin = null, mode = 'commercial' } = {}) {
  const plugin = inPlugin ?? !!pluginRootOf(file);
  const out = [];
  for (const c of chunks(String(text || ''), file)) {
    const code = CODE.test(c);
    for (const s of IDEAS_ONLY) {
      const mk = s.markers.find(r => r.test(c)); const og = s.origins.find(r => r.test(c));
      const shape = s.id === 'shadertoy' && shadertoyShaped(c);
      if (!mk && og && code && !shape && creditOnly(c, og)) {
        out.push(finding(`idea-credit:${s.id}`, 'warn', `${s.name} is credited as the source of an idea; the code here must be original.`,
          { fix: `Keep the credit line, and record it in .sensei/licences.json with use "idea" (node lib/ledger.mjs add --id ${s.id} --licence "ideas only" --use idea).` }));
        continue;
      }
      if (!mk && !og && shape) {
        out.push(finding(`ideas-only:${s.id}`, plugin ? 'block' : 'warn',
          `This shader has Shadertoy's shape (mainImage with iTime, iResolution or iChannel). Shadertoy code is ideas only (${s.why})${plugin ? ' and may not ship in a plugin' : ''}.`,
          { fix: plugin ? 'Write the shader from the idea with your own entry point and uniforms (main, uTime, uResolution), or keep it out of the plugin.' : 'If this was copied from Shadertoy, replace it with an original implementation; if it is your own, rename the entry point and uniforms so nobody mistakes it for a copy, and record any inspiration with use "idea".',
            evidence: [String(c.match(SHADERTOY_MAIN)[0])] }));
        continue;
      }
      if (mk || (og && code)) out.push(finding(`ideas-only:${s.id}`, 'block',
        `${s.name} is ideas only (${s.why}). Its code may not be copied into any file, project or plugin.`,
        { fix: 'Write an original implementation from the idea, remove the copied lines and the source link from the code, and record the source in .sensei/licences.json with use "idea".', evidence: [String(c.match(mk || og)[0])] }));
    }
    if (!code) continue;
    if (plugin) {
      const rb = reactBitsShaped(c, file);
      if (rb) out.push(finding('never-ship:react-bits', 'block',
        `This looks like React Bits code (${rb}) written into a plugin path (${file || 'this file'}), even without a URL. React Bits may be used in a user's project but never shipped in a plugin (MIT plus Commons Clause).`,
        { fix: 'Keep the plugin to the catalogue, the fetch-and-port procedure and the notice template; fetch the real component into the user project at build time. If this is original code, give it a name of its own.', evidence: [rb] }));
    }
    for (const s of NEVER_SHIP) {
      const og = s.origins.find(r => r.test(c)); const nt = s.notice && s.notice.test(c);
      if (!og && !nt) continue;
      if (plugin) out.push(finding(`never-ship:${s.id}`, 'block',
        `${s.name} code is being written into a plugin path (${file || 'this file'}). It may be used in a user's project but never shipped in the plugin (${s.why}).`,
        { fix: 'Keep the plugin to the catalogue, the fetch-and-port procedure and the notice template; fetch the real component into the user project at build time instead.', evidence: [String(c.match(og || s.notice)[0])] }));
      else if (!nt) out.push(finding(`notice-missing:${s.id}`, 'warn',
        `${s.name} code in a project file without its copyright notice.`,
        { fix: 'Keep the original copyright and licence notice in a header comment and add a row to .sensei/licences.json (use "fetched" or "ported", notice "header").' }));
    }
    for (const n of NONCOMMERCIAL) if (n.re.test(c)) out.push(finding(`noncommercial:${n.id}`, mode === 'commercial' ? 'block' : 'warn',
      `Code under a non-commercial licence (${c.match(n.re)[0]}) ${mode === 'commercial' ? 'cannot go into a commercial project' : 'is fine for personal use only'}.`,
      { fix: mode === 'commercial' ? 'Re-implement from the idea, or set licence_mode to "personal" in .sensei/profile.json if this project will never be sold.' : 'Record it in .sensei/licences.json so it is caught if the project turns commercial.' }));
  }
  const seen = new Set();
  return out.filter(f => !seen.has(f.id) && seen.add(f.id));
}
