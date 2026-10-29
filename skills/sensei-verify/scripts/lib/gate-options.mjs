// gate-options.mjs: the one list of options the page gate (sensei-gate.mjs) accepts, shared by the page gate's own
// parser and by the umbrella (verify.mjs), so the umbrella can forward every page-gate option and refuse anything else.
// Before this list existed the umbrella read `--steps flows.json` as an option of its own, never used it, and wrote a
// PASS with no steps run (QC finding 1). An unknown option is now an error (exit 2) in both scripts.
//
// verified: Windows 10, Node 24, by ../test-gate.mjs (forwarding without `--`, a failing steps file failing the
//           umbrella, an unknown option exiting 2, a missing steps file exiting 2).
// not verified: macOS, Linux.
// Original HTML-Sensei code.

// Options that take a value (the next argument, or `--opt=value`).
export const PAGE_VALUE_OPTS = new Set([
  'project', 'name', 'out', 'stamp', 'mode', 'widths', 'height', 'checks', 'routes', 'steps', 'wait-for', 'settle',
  'axe-path', 'expect-text',
]);
// Options that are switches.
export const PAGE_FLAGS = new Set([
  'allow-external', 'expect-motion', 'gpu', 'lenient-file', 'strict', 'json', 'isolated', 'no-full', 'help',
  'steps-after-routes',
]);

export class OptionError extends Error {}

// Parse argv against a value set and a flag set. Returns { _: positionals, <camelCase>: value }. Throws OptionError on
// an unknown option or a value option with no value, so the caller can print it and exit 2.
export function parseOptions(argv, valueOpts, flagOpts) {
  const o = { _: [] };
  const camel = k => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--') || a === '--') { o._.push(a); continue; }
    let k = a.slice(2), v;
    const eq = k.indexOf('=');
    if (eq >= 0) { v = k.slice(eq + 1); k = k.slice(0, eq); }
    if (flagOpts.has(k)) {
      if (v !== undefined) throw new OptionError(`--${k} is a switch and takes no value`);
      o[camel(k)] = true;
    } else if (valueOpts.has(k)) {
      if (v === undefined) {
        v = argv[++i];
        if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new OptionError(`--${k} needs a value`);
      }
      o[camel(k)] = v;
    } else {
      throw new OptionError(`unknown option --${k}`);
    }
  }
  return o;
}
