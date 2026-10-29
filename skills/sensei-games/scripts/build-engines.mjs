// build-engines.mjs: writes one offline single-file page per engine (Phaser, PixiJS, Kaplay). Each inlines the engine,
// builds a four-frame atlas at run time with atlas-pack.js, and runs a falling, animated sprite.
// HTML-Sensei's own code, ported from the research lane's code-apps/game/build-engines.cjs.
//
//   node build-engines.mjs --libs DIR [--out DIR]
//     --libs  a folder whose node_modules holds phaser, pixi.js and kaplay (or env GAME_LIBS); nothing is vendored
//             in the plugin: fetch them into the project or a scratch folder with
//             npm i --ignore-scripts phaser pixi.js kaplay
//     --out   where the pages go (default: ./engines-out in the current folder)
//
// Each engine is MIT: the inlined file keeps its own licence banner, and the page gets a ledger row in the project.
// verified: Windows 10, Node 24; phaser 4.2.1, pixi.js 8.22.0, kaplay 3001.0.19; the pages pass test-engines.mjs.
// not verified: Phaser 3 (the research lane used it; the API calls here are the same), engine versions other than these.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LIBS = arg('--libs', process.env.GAME_LIBS);
const OUT = path.resolve(arg('--out', 'engines-out'));
if (!LIBS) { console.error('Give --libs DIR (or GAME_LIBS): a folder with node_modules/phaser, pixi.js and kaplay.'); process.exit(2); }
const pkgDir = (n) => path.join(LIBS, 'node_modules', n);
// Escape </script so an inlined library cannot close its own script element.
const lib = (pkg, rel) => fs.readFileSync(path.join(pkgDir(pkg), rel), 'utf8').replace(/<\/script/gi, '<\\/script');
const version = (pkg) => JSON.parse(fs.readFileSync(path.join(pkgDir(pkg), 'package.json'), 'utf8')).version;
const pack = fs.readFileSync(path.join(HERE, 'atlas-pack.js'), 'utf8');
fs.mkdirSync(OUT, { recursive: true });

const shell = (title, scripts) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>html,body{margin:0;height:100%;background:#000}#game{width:100vw;height:100vh;display:grid;place-items:center}canvas{image-rendering:pixelated}</style></head><body><main id="game" aria-label="${title} test game"></main>${scripts}</body></html>`;
// frame i is an orange square with a white bar at position i
const atlasJs = `<script>${pack}</script><script>
window.makeAtlas = function(){
  var items=[0,1,2,3].map(function(i){return {name:'f'+i,w:32,h:32}});
  var P=AtlasPack.pack(items,{maxW:256,pad:2});
  var cv=document.createElement('canvas'); cv.width=P.w; cv.height=P.h; var x=cv.getContext('2d');
  items.forEach(function(it,i){var f=P.frames[it.name]; x.fillStyle='#ff7a59'; x.fillRect(f.x,f.y,32,32); x.fillStyle='#fff'; x.fillRect(f.x+2+i*7,f.y+2,5,28);});
  items.forEach(function(it){AtlasPack.extrude(x,P.frames[it.name],1)});
  return {canvas:cv,pack:P};
};</script>`;
const w = (n, h) => { fs.writeFileSync(path.join(OUT, n), h); console.log('wrote', path.join(OUT, n), (h.length / 1024).toFixed(0) + ' KB'); };

w('phaser.html', shell('Phaser', `<script>${lib('phaser', 'dist/phaser.min.js')}</script>${atlasJs}<script>
var A=makeAtlas();
var game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:320,height:180,backgroundColor:'#102030',pixelArt:true,
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},physics:{default:'arcade',arcade:{gravity:{y:600}}},
  scene:{create:function(){
    this.textures.addAtlas('hero',A.canvas,A.pack.json);
    this.anims.create({key:'run',frames:this.anims.generateFrameNames('hero',{prefix:'f',start:0,end:3}),frameRate:8,repeat:-1});
    var ground=this.add.rectangle(160,170,320,20,0x274b6d); this.physics.add.existing(ground,true);
    var s=this.physics.add.sprite(160,20,'hero','f0'); s.play('run'); this.physics.add.collider(s,ground);
    /* Phaser does not pause itself when the page is hidden: do it */
    game.events.on('hidden',function(){game.pause();}); game.events.on('visible',function(){game.resume();});
    window.__ph={game:game,scene:this,sprite:s,ground:ground}; window.__ready=true;
  }}});
</script>`));

w('pixi.html', shell('PixiJS', `<script>${lib('pixi.js', 'dist/pixi.min.js')}</script>${atlasJs}<script>
(async function(){
  var A=makeAtlas(); var cv=document.createElement('canvas'); document.getElementById('game').appendChild(cv);
  var app=new PIXI.Application(); await app.init({canvas:cv,width:320,height:180,background:'#102030',preference:'webgl',resolution:1,antialias:false});
  cv.style.width='640px'; cv.style.height='360px';
  var tex=PIXI.Texture.from(A.canvas); tex.source.scaleMode='nearest';
  var sheet=new PIXI.Spritesheet(tex,Object.assign({animations:{run:['f0','f1','f2','f3']}},A.pack.json)); await sheet.parse();
  var spr=new PIXI.AnimatedSprite(sheet.animations.run); spr.animationSpeed=8/60; spr.play(); spr.x=144; spr.y=0; app.stage.addChild(spr);
  var vy=0; app.ticker.add(function(t){ var dt=Math.min(t.deltaMS,250)/1000; vy+=600*dt; spr.y+=vy*dt; if(spr.y>138){spr.y=138;vy=0;} });
  document.addEventListener('visibilitychange',function(){ if(document.hidden) app.ticker.stop(); else app.ticker.start(); });
  window.__px={app:app,spr:spr,sheet:sheet}; window.__ready=true;
})();
</script>`));

w('kaplay.html', shell('Kaplay', `<script>${lib('kaplay', 'dist/kaplay.js')}</script>${atlasJs}<script>
var A=makeAtlas(); var cv=document.createElement('canvas'); document.getElementById('game').appendChild(cv);
var k=kaplay({canvas:cv,width:320,height:180,background:[16,32,48],global:false,debug:false,touchToMouse:true,pixelDensity:1,font:'monospace'});
cv.style.width='640px'; cv.style.height='360px';
/* Kaplay loads sprites from a URL or data URL: copy the atlas frames into one row and slice it */
var strip=document.createElement('canvas'); strip.width=128; strip.height=32; var sx=strip.getContext('2d');
[0,1,2,3].forEach(function(i){var f=A.pack.frames['f'+i]; sx.drawImage(A.canvas,f.x,f.y,32,32,i*32,0,32,32);});
k.loadSprite('hero',strip.toDataURL(),{sliceX:4,anims:{run:{from:0,to:3,loop:true,speed:8}}}).then(function(){
  k.setGravity(600);
  k.scene('main',function(){
    k.add([k.rect(320,20),k.pos(0,160),k.area(),k.body({isStatic:true}),k.color(39,75,109)]);
    var p=k.add([k.sprite('hero',{anim:'run'}),k.pos(144,0),k.area(),k.body()]);
    window.__kp={k:k,p:p};
  });
  k.go('main'); window.__ready=true;
});
</script>`));
fs.writeFileSync(path.join(OUT, 'versions.json'), JSON.stringify({ phaser: version('phaser'), 'pixi.js': version('pixi.js'), kaplay: version('kaplay') }, null, 2));
