#!/usr/bin/env node
// Smoke-test a local HTML artefact in strict file:// mode (no --allow-file-access-from-files), offline.
// Usage: node browser_smoke.cjs artefact.html out-dir
// Playwright: PLAYWRIGHT_MODULE (path or name), else playwright / playwright-core from this folder, the current
// folder, or the global npm root. Browser: BROWSER_EXECUTABLE (path), else BROWSER_CHANNEL, else Chrome, then Edge,
// then Playwright's own Chromium. Each viewport runs twice: normal motion and prefers-reduced-motion.
// verified: Windows 10, Node 24, playwright-core (global), Chrome; not verified: macOS, Linux, Firefox, WebKit.
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{execSync}=require('child_process');

function loadPlaywright(){
  const tried=[];
  const attempt=(spec,opts)=>{try{return require(opts?require.resolve(spec,opts):spec)}catch(e){tried.push(spec);return null}};
  if(process.env.PLAYWRIGHT_MODULE){const m=attempt(process.env.PLAYWRIGHT_MODULE);if(m)return m;}
  const bases=[__dirname,process.cwd()];
  try{bases.push(execSync('npm root -g',{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim())}catch{}
  for(const name of ['playwright','playwright-core'])for(const base of bases){
    const m=attempt(name,{paths:[base]});if(m&&m.chromium)return m;
    const direct=path.join(base,name);if(fs.existsSync(direct)){const d=attempt(direct);if(d&&d.chromium)return d;}
  }
  throw Error('Playwright not found. Install it in the project (npm i -D playwright-core) or set PLAYWRIGHT_MODULE. Tried: '+tried.join(', '));
}

async function launch(chromium){
  if(process.env.BROWSER_EXECUTABLE)return {browser:await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true}),used:process.env.BROWSER_EXECUTABLE};
  const channels=process.env.BROWSER_CHANNEL?[process.env.BROWSER_CHANNEL]:['chrome','msedge',undefined];
  let last;
  for(const channel of channels){try{return {browser:await chromium.launch({channel,headless:true}),used:channel||'playwright-chromium'}}catch(e){last=e}}
  throw last;
}

async function main(){
  const target=path.resolve(process.argv[2]||'');
  const out=path.resolve(process.argv[3]||'browser-smoke');
  if(!process.argv[2]||!fs.existsSync(target))throw Error('HTML not found: '+target);
  fs.mkdirSync(out,{recursive:true});
  const {chromium}=loadPlaywright();
  const {browser,used}=await launch(chromium);
  const results=[];
  for(const [name,viewport,touch] of [['desktop',{width:1440,height:900},false],['mobile',{width:390,height:844},true]])
  for(const motion of ['no-preference','reduce']){
    const context=await browser.newContext({viewport,reducedMotion:motion,hasTouch:touch,isMobile:touch});
    await context.setOffline(true);
    const page=await context.newPage();
    const errors=[],requests=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
    page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
    await page.goto(pathToFileURL(target).href,{waitUntil:'load',timeout:60000});
    const label=name+(motion==='reduce'?'-reduced':'');
    await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});
    const interactions={};
    if(await page.locator('#card').count()){
      // Starter-specific assertions; extend or replace them for a real project.
      await page.locator('#card').click(); interactions.cardFlips=await page.locator('#card').getAttribute('aria-pressed')==='true';
      interactions.answerExposed=(await page.locator('#card .card-back').getAttribute('aria-hidden'))!=='true';
      await page.locator('#card').press('Enter'); interactions.cardFlipsBackByKey=await page.locator('#card').getAttribute('aria-pressed')==='false';
      await page.locator('#reset').click(); await page.locator('#play').click();
      await page.waitForTimeout(2300); interactions.sequenceReachesEnd=(await page.locator('#stage-label').innerText()).includes('Step 3 of 3');
      if(await page.locator('#motion-toggle').count()){
        await page.locator('#motion-toggle').click();
        interactions.motionPauses=await page.evaluate(()=>document.documentElement.dataset.motion==='paused'&&document.getAnimations().every(a=>a.playState!=='running'));
        await page.locator('#motion-toggle').click();
      }
      if(motion==='reduce')interactions.stillUnderReducedMotion=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length===0);
      await page.locator('#reflection').fill('Test note'); await page.locator('#save').click();
      interactions.notesSaved=(await page.locator('#status').innerText()).includes('Saved');
    }
    results.push({name:label,title:await page.title(),errors,externalRequests:requests,interactions,
      bodyText:(await page.locator('body').innerText()).slice(0,1000),
      horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),
      overflowCandidates:await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+2).slice(0,8).map(e=>({tag:e.tagName,class:String(e.className),right:Math.round(e.getBoundingClientRect().right)})))});
    await context.close();
  }
  await browser.close();
  const report={target,browser:used,mode:'file:// strict, offline',results,
    passed:results.every(x=>!x.errors.length&&!x.externalRequests.length&&!x.horizontalOverflow&&Object.values(x.interactions).every(Boolean))};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(!report.passed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
