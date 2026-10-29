#!/usr/bin/env node
// build-dash.mjs: write one offline single-file chart page per library (library and data inlined, nothing fetched), as
// tested starting points: Chart.js, ECharts, uPlot (1,000,000 points), D3, Observable Plot, Vega-Lite and deck.gl
// (200,000 WebGL points, no basemap). Each page honours prefers-reduced-motion (Chart.js and ECharts do not by
// themselves), carries a text alternative, uses a palette that passes palette-check.mjs, and names the library, its
// version and licence in a comment (ECharts: Apache-2.0, keep its NOTICE when redistributing).
//
//   node build-dash.mjs <out-folder> [--only chartjs,echarts,uplot,d3,plot,vegalite,deckgl]
//
// Libraries come from SENSEI_NODE_MODULES, else node_modules up from the current folder:
//   npm i -D chart.js echarts uplot d3 @observablehq/plot vega vega-lite vega-embed deck.gl
// A page whose library is missing is skipped and named. Every inlined script has "</script" and "<!--" escaped.
//
// verified: Windows 10, Node 24, chart.js 4.6.1, echarts 6.1.0, uplot 1.6.32, d3 7.9.0, @observablehq/plot 0.6.17,
//           vega 6.4.0, vega-lite 6.5.0, vega-embed 7.3.0, deck.gl 9.4.0, through test-dash.mjs in installed Chrome 155
//           (playwright-core 1.62.1, software GL), strict file://.
// not verified: Firefox and Safari; real GPUs; touch; screen-reader speech; maps with tiles.
// HTML-Sensei's own code. Origin: code-apps/dash/build-dash.cjs in the HTML-Sensei build project's research notes (not shipped), ported to ESM and extended.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function findPkg(name) {
  const bases = [];
  if (process.env.SENSEI_NODE_MODULES) { const e = process.env.SENSEI_NODE_MODULES; bases.push(path.basename(e) === 'node_modules' ? path.dirname(e) : e); }
  bases.push(process.cwd());
  for (const b of bases) {
    let d = path.resolve(b);
    for (;;) {
      const f = path.join(d, 'node_modules', name, 'package.json');
      if (fs.existsSync(f)) return path.dirname(f);
      const up = path.dirname(d); if (up === d) break; d = up;
    }
  }
  return null;
}
const safe = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
function lib(name, rel) {
  const dir = findPkg(name); if (!dir) return null;
  const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  return { code: safe(fs.readFileSync(path.join(dir, rel), 'utf8')), note: `${name} ${pj.version}, ${pj.license || 'see its LICENSE'}` };
}
const tag = (l) => `<script>/* ${l.note}: inlined from the project's node_modules; keep this notice */\n${l.code}</script>`;

// fixed data (seeded), the same on every build
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], SERIES = ['North', 'South', 'West'];
const ROWS = []; MONTHS.forEach((m, i) => SERIES.forEach((s, k) => ROWS.push({ m, s, v: Math.round(40 + 25 * Math.sin(i / 2 + k) + rnd() * 15) })));
// a palette that passes palette-check.mjs on white (light) and #12161c (dark)
const LIGHT = ['#0072B2', '#D55E00', '#009E73'], DARK = ['#56B4E9', '#E69F00', '#009E73'];
const DATA = `<script type="application/json" id="data">${JSON.stringify({ rows: ROWS, months: MONTHS, series: SERIES }).replace(/</g, '\\u003c')}</script>
<script>var D=JSON.parse(document.getElementById('data').textContent),DATA=D.rows,MONTHS=D.months,SERIES=D.series;
var RM=matchMedia('(prefers-reduced-motion: reduce)').matches,DARKMODE=matchMedia('(prefers-color-scheme: dark)').matches;
var PAL=DARKMODE?${JSON.stringify(DARK)}:${JSON.stringify(LIGHT)};
function val(m,s){return DATA.filter(function(r){return r.m===m&&r.s===s})[0].v}</script>`;
const CSS = `<style>:root{--bg:#fff;--fg:#1b1f24;color-scheme:light dark}@media (prefers-color-scheme:dark){:root{--bg:#12161c;--fg:#eef1f5}}
body{margin:16px;background:var(--bg);color:var(--fg);font:16px system-ui,sans-serif}#wrap{width:100%;max-width:900px;height:360px;position:relative}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}</style>`;
const page = (title, body, scripts) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${CSS}</head><body><main><h1>${title}</h1>${body}</main>${DATA}${scripts}</body></html>`;

const PAGES = {
  chartjs: () => { const L = lib('chart.js', 'dist/chart.umd.js'); if (!L) return null;
    return page('Chart.js', `<div id="wrap"><canvas id="c" role="img" aria-label="Monthly units by region, grouped bars. The same data is in the table below."></canvas></div>
<table class="sr-only" id="t"><caption>Monthly units by region</caption></table>`, `${tag(L)}<script>
var ds=SERIES.map(function(s,k){return {label:s,backgroundColor:PAL[k],data:MONTHS.map(function(m){return val(m,s)})}});
document.getElementById('t').insertAdjacentHTML('beforeend','<tr><th scope="col">Month</th>'+SERIES.map(function(s){return '<th scope="col">'+s+'</th>'}).join('')+'</tr>'+MONTHS.map(function(m,i){return '<tr><th scope="row">'+m+'</th>'+ds.map(function(d){return '<td>'+d.data[i]+'</td>'}).join('')+'</tr>'}).join(''));
Chart.defaults.color=getComputedStyle(document.body).color;
/* Chart.js does not read prefers-reduced-motion: decide here */
window.chart=new Chart(document.getElementById('c'),{type:'bar',data:{labels:MONTHS,datasets:ds},options:{responsive:true,maintainAspectRatio:false,animation:RM?false:{duration:900},
 plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,title:{display:true,text:'Units'}}}}});
window.__ready=true;</script>`); },

  echarts: () => { const L = lib('echarts', 'dist/echarts.min.js'); if (!L) return null;
    return page('ECharts', `<div id="wrap"></div>`, `${tag(L)}<script>
var el=document.getElementById('wrap'),ch=echarts.init(el,null,{renderer:'svg'});
/* aria writes a description on the container; decals add pattern fills as a second channel; animation off under reduced motion */
function opt(f){return {color:PAL,textStyle:{color:getComputedStyle(document.body).color},aria:{enabled:true,decal:{show:true},data:{maxCount:12}},
 animation:!RM,animationDuration:900,animationDurationUpdate:900,legend:{bottom:0,textStyle:{color:getComputedStyle(document.body).color}},tooltip:{trigger:'axis'},
 xAxis:{type:'category',data:MONTHS},yAxis:{type:'value',name:'Units'},
 series:SERIES.map(function(s){return {name:s,type:'bar',data:MONTHS.map(function(m){return val(m,s)*f})}})};}
ch.setOption(opt(1));window.ch=ch;window.opt=opt;
new ResizeObserver(function(){ch.resize()}).observe(el);
window.__ready=true;</script>`); },

  uplot: () => { const L = lib('uplot', 'dist/uPlot.iife.min.js'), C = lib('uplot', 'dist/uPlot.min.css'); if (!L) return null;
    return page('uPlot', `<div id="wrap" style="height:auto" role="img" aria-label="A signal of one million points: a slow wave between about minus 55 and 55."></div>`, `<style>${C.code}</style>${tag(L)}<script>
var N=1000000,x=new Float64Array(N),y=new Float64Array(N),s=1;
for(var i=0;i<N;i++){x[i]=i;s=(s*16807)%2147483647;y[i]=Math.sin(i/20000)*50+(s/2147483647-.5)*10;}
var t0=performance.now(),el=document.getElementById('wrap');
window.u=new uPlot({width:Math.min(900,el.clientWidth||innerWidth-32),height:320,scales:{x:{time:false}},series:[{},{label:'signal',stroke:PAL[0],width:1,points:{show:false}}],
 axes:[{stroke:getComputedStyle(document.body).color},{label:'value',stroke:getComputedStyle(document.body).color}]},[x,y],el);
window.__buildMs=performance.now()-t0;
/* uPlot does not follow its container: setSize on resize */
new ResizeObserver(function(){u.setSize({width:Math.min(900,el.clientWidth),height:320})}).observe(el);
window.__ready=true;</script>`); },

  d3: () => { const L = lib('d3', 'dist/d3.min.js'); if (!L) return null;
    return page('D3', `<div id="wrap"></div>`, `${tag(L)}<script>
var W=800,H=320,m={t:10,r:10,b:30,l:40},data=MONTHS.map(function(mm){return {m:mm,v:val(mm,'North')}});
var svg=d3.select('#wrap').append('svg').attr('viewBox','0 0 '+W+' '+H).attr('width','100%').attr('role','group').attr('aria-label','North region units by month');
var x=d3.scaleBand().domain(MONTHS).range([m.l,W-m.r]).padding(.2),y=d3.scaleLinear().domain([0,100]).range([H-m.b,m.t]);
svg.append('g').attr('transform','translate(0,'+(H-m.b)+')').call(d3.axisBottom(x));svg.append('g').attr('transform','translate('+m.l+',0)').call(d3.axisLeft(y));
var bars=svg.selectAll('rect.b').data(data,function(d){return d.m}).join('rect').attr('class','b').attr('x',function(d){return x(d.m)}).attr('width',x.bandwidth())
 .attr('y',y(0)).attr('height',0).attr('fill',PAL[0]).attr('tabindex',0).attr('role','img').attr('aria-label',function(d){return d.m+': '+d.v});
/* from the current height to the new one, never from zero on an update; no transition under reduced motion */
window.grow=function(vals){bars.data(data.map(function(d,i){return {m:d.m,v:vals?vals[i]:d.v}}),function(d){return d.m}).attr('aria-label',function(d){return d.m+': '+d.v})
 .transition().duration(RM?0:800).ease(d3.easeCubicOut).attr('y',function(d){return y(d.v)}).attr('height',function(d){return y(0)-y(d.v)});};
window.grow();window.__ready=true;</script>`); },

  plot: () => { const D3 = lib('d3', 'dist/d3.min.js'), L = lib('@observablehq/plot', 'dist/plot.umd.min.js'); if (!D3 || !L) return null;
    return page('Observable Plot', `<div id="wrap" style="height:auto"></div>`, `${tag(D3)}${tag(L)}<script>
var fig=Plot.plot({width:800,height:320,ariaLabel:'Monthly units by region',color:{range:PAL,legend:true},x:{label:null},y:{grid:true,label:'Units'},marks:[Plot.barY(DATA,{x:'m',y:'v',fill:'s'}),Plot.ruleY([0])]});
/* Plot puts aria-label on <g> elements with no role; axe reports aria-prohibited-attr. role=group makes the label legal */
fig.querySelectorAll('g[aria-label]:not([role])').forEach(function(g){g.setAttribute('role','group')});
document.getElementById('wrap').append(fig);window.__ready=true;</script>`); },

  vegalite: () => { const V = lib('vega', 'build/vega.min.js'), VL = lib('vega-lite', 'build/vega-lite.min.js'), VE = lib('vega-embed', 'build/vega-embed.min.js'); if (!V || !VL || !VE) return null;
    return page('Vega-Lite', `<div id="wrap" style="height:auto"></div>`, `${tag(V)}${tag(VL)}${tag(VE)}<script>
/* $schema is an identifier here, never fetched; data inline; dash as a second channel */
var spec={$schema:'https://vega.github.io/schema/vega-lite/v6.json',width:700,height:260,data:{values:DATA},mark:{type:'line',point:true},
 encoding:{x:{field:'m',type:'ordinal',sort:MONTHS,title:null},y:{field:'v',type:'quantitative',title:'Units'},color:{field:'s',type:'nominal',scale:{range:PAL},title:'Region'},strokeDash:{field:'s',type:'nominal',title:'Region'}},
 description:'Monthly units by region',config:{background:null,axis:{labelColor:getComputedStyle(document.body).color,titleColor:getComputedStyle(document.body).color},legend:{labelColor:getComputedStyle(document.body).color,titleColor:getComputedStyle(document.body).color}}};
vegaEmbed('#wrap',spec,{renderer:'svg',actions:false}).then(function(r){window.view=r.view;window.__ready=true;});</script>`); },

  deckgl: () => { const L = lib('deck.gl', 'dist.min.js'); if (!L) return null;
    return page('deck.gl', `<div id="wrap" style="height:420px;position:relative" role="img" aria-label="200,000 points around San Francisco in two classes, blue and orange. No base map."></div>`, `${tag(L)}<script>
var N=200000,pts=new Array(N),s=3;for(var i=0;i<N;i++){s=(s*16807)%2147483647;var a=s/2147483647;s=(s*16807)%2147483647;var b=s/2147483647;pts[i]={p:[-122+(a-.5)*0.6,37.7+(b-.5)*0.4],v:a};}
function rgb(h){return [1,3,5].map(function(i){return parseInt(h.slice(i,i+2),16)})}
var c0=rgb(PAL[0]).concat(200),c1=rgb(PAL[1]).concat(200);
window.deckgl=new deck.Deck({parent:document.getElementById('wrap'),width:'100%',height:'100%',initialViewState:{longitude:-122,latitude:37.7,zoom:10},controller:true,
 layers:[new deck.ScatterplotLayer({id:'s',data:pts,getPosition:function(d){return d.p},getRadius:20,radiusUnits:'meters',getFillColor:function(d){return d.v>.5?c0:c1},pickable:true})]});
window.__ready=true;</script>`); }
};

export function buildDash(out, only) {
  fs.mkdirSync(out, { recursive: true });
  const done = [], skipped = [];
  for (const [name, make] of Object.entries(PAGES)) {
    if (only && !only.includes(name)) continue;
    const html = make();
    if (!html) { skipped.push(name); continue; }
    fs.writeFileSync(path.join(out, name + '.html'), html);
    done.push({ name, kb: Math.round(Buffer.byteLength(html) / 1024) });
  }
  return { done, skipped };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), oi = a.indexOf('--only');
  const only = oi >= 0 ? a[oi + 1].split(',') : null, out = a.find((x, i) => !x.startsWith('--') && a[i - 1] !== '--only');
  if (!out) { console.error('usage: node build-dash.mjs <out-folder> [--only chartjs,echarts,...]'); process.exitCode = 2; }
  else {
    const r = buildDash(out, only);
    for (const d of r.done) console.log(`wrote ${d.name}.html (${d.kb} KB, information only)`);
    for (const s of r.skipped) console.log(`skipped ${s}: its library is not installed`);
  }
}
