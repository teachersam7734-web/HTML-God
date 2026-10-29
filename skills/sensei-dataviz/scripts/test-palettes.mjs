// test-palettes.mjs: the self-test of palette-check.mjs. Known reference values first, then the measured palettes the
// skill's TRAPS cite, then the command line's exit codes. Node only.
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-dataviz/scripts/test-palettes.mjs
//
// verified: Windows 10, Node 24: every check passes.
// not verified: anything about real viewers (the simulation is a model).
// Origin: code-apps/test-palettes.cjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM and extended.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as P from './palette-check.mjs';
import { checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { ok, summary } = checker();
const mins = (r) => Object.fromEntries(Object.entries(r.cvd).map(([k, v]) => [k, v.min]));

ok('contrast: black on white is 21', Math.abs(P.contrast('#000', '#fff') - 21) < 1e-9);
ok('contrast: #767676 on white is the 4.54:1 grey', Math.abs(P.contrast('#767676', '#ffffff') - 4.54) < 0.01, P.contrast('#767676', '#ffffff').toFixed(3));
ok('CIEDE2000 matches the published Sharma, Wu and Dalal test pair (2.0425)', Math.abs(P.dE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < 1e-3);

const OKABE6 = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00'];
const rOk = P.checkCategorical(OKABE6, { bg: '#ffffff' });
console.log('INFO  Okabe-Ito first six on white:', JSON.stringify({ contrast: rOk.contrast, cvd: mins(rOk) }));
ok('Okabe-Ito: orange #E69F00 (2.25) and sky blue #56B4E9 (2.31) fail 3:1 on white', rOk.problems.some((p) => /#E69F00 contrast 2.25/.test(p)) && rOk.problems.some((p) => /#56B4E9 contrast 2.31/.test(p)));
ok('Okabe-Ito: colour-blind safe at the heuristic (closest pairs 22.2, 12.3, 12.5, 11.1)', JSON.stringify(mins(rOk)) === JSON.stringify({ normal: 22.2, protan: 12.3, deutan: 12.5, tritan: 11.1 }), mins(rOk));
const yel = P.checkCategorical(['#F0E442'], { bg: '#ffffff' }), yelDark = P.checkCategorical(['#F0E442'], { bg: '#12161c' });
ok('Okabe-Ito yellow: 1.32 on white, 13.72 on #12161c', yel.contrast[0] === 1.32 && yelDark.contrast[0] === 13.72, [yel.contrast[0], yelDark.contrast[0]]);

const TABLEAU = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];
const rT = P.checkCategorical(TABLEAU, { bg: '#ffffff' });
const tFail = rT.contrast.filter((c) => c < 3).length;
console.log('INFO  Tableau 10 on white:', JSON.stringify({ contrast: rT.contrast, cvd: mins(rT) }));
ok('Tableau 10 collapses under deutan (0.7, red against green) and protan (1.3); five colours fail 3:1 on white (the research said four)', rT.cvd.deutan.min === 0.7 && rT.cvd.protan.min === 1.3 && tFail === 5, { deutan: rT.cvd.deutan, protan: rT.cvd.protan.min, contrastFails: tFail });

const RG = P.checkCategorical(['#d62728', '#2ca02c', '#1f77b4'], { bg: '#ffffff' });
ok('red and green: 48.6 apart for normal vision, 4.8 under deutan (the classic failure is caught)', RG.cvd.normal.min === 48.6 && RG.cvd.deutan.min === 4.8 && !RG.ok, mins(RG));

const SAFE = ['#0072B2', '#D55E00', '#009E73'], SAFE_DARK = ['#56B4E9', '#E69F00', '#009E73'];
ok('the light palette of examples/dashboard.html passes on white', P.checkCategorical(SAFE, { bg: '#ffffff' }).ok);
ok('the dark palette of examples/dashboard.html passes on #12161c', P.checkCategorical(SAFE_DARK, { bg: '#12161c' }).ok);

const sv = P.checkSequential(['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']);
const sr = P.checkSequential(['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']);
ok('viridis five steps: L* 15, 36, 55, 73, 91, monotonic, span 76', sv.monotonic && sv.span === 76 && sv.L.join() === '15,36,55,73,91', sv);
ok('a jet-style rainbow is not monotonic (L* 32, 91, 88, 97, 53)', !sr.monotonic && sr.L.join() === '32,91,88,97,53', sr.L);

const cli = (...a) => spawnSync(process.execPath, [path.join(HERE, 'palette-check.mjs'), ...a], { encoding: 'utf8' }).status;
ok('command line: exit 0 for a passing palette, 1 for a failing one, 2 for bad input', cli(SAFE.join(',')) === 0 && cli(OKABE6.join(',')) === 1 && cli('not-a-colour') === 2);
ok('command line: --sequential passes viridis and fails the rainbow', cli('#440154,#3b528b,#21918c,#5ec962,#fde725', '--sequential') === 0 && cli('#0000ff,#00ffff,#00ff00,#ffff00,#ff0000', '--sequential') === 1);
ok('command line: --min-delta lets a project state its own distance bar', cli(OKABE6.join(','), '--bg', '#12161c', '--min-delta', '12') === 1 && cli(OKABE6.join(','), '--bg', '#12161c', '--min-delta', '11') === 0);
process.exitCode = summary();
