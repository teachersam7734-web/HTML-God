(()=>{
 const el=document.getElementById('courseIntro'),v=el.querySelector('video'),skip=el.querySelector('button');
 let done=false,frame=0,stallTimer=0,ending=false;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const lock=()=>{const a=document.getElementById('app');if(a)a.inert=!done;document.documentElement.style.overflow=done?'':'hidden'};
 function finish(immediate=false){if(done||ending)return;ending=true;cancelAnimationFrame(frame);clearTimeout(stallTimer);v.pause();el.classList.add('leaving');setTimeout(()=>{done=true;ending=false;el.hidden=true;lock();document.querySelector('#main,.landing h1,.hero h1')?.focus?.({preventScroll:true})},immediate||reduced?0:850)}
 function run(){if(done||ending)return;const t=v.currentTime;el.style.setProperty('--intro-time',Math.min(1,t/7.5));el.classList.toggle('burst',t>6.65);if(t>7.25){finish();return}frame=requestAnimationFrame(run)}
 function begin(){if(window.__SKIP_COURSE_INTRO__){finish(true);return}lock();el.classList.toggle('reduced',reduced);if(reduced){v.removeAttribute('autoplay');v.pause();skip.textContent='Enter the course →';return}v.muted=true;v.play().then(()=>{frame=requestAnimationFrame(run)}).catch(()=>{el.classList.add('paused');skip.textContent='Enter the course →'});stallTimer=setTimeout(()=>{if(!done&&v.currentTime<.1){el.classList.add('paused');skip.textContent='Enter the course →'}},3500)}
 v.addEventListener('loadeddata',()=>{try{const c=document.createElement('canvas');c.width=2;c.height=2;const x=c.getContext('2d');x.drawImage(v,0,0,2,2);if(x.getImageData(0,0,1,1).data[3]===255)v.style.mixBlendMode='screen'}catch{}});
 skip.addEventListener('click',()=>finish());v.addEventListener('ended',()=>finish());v.addEventListener('error',()=>{skip.textContent='Enter the course →';el.classList.add('paused')});
 document.addEventListener('keydown',e=>{if(!done&&e.key==='Escape'){e.preventDefault();finish()}});
 document.addEventListener('visibilitychange',()=>{if(done||ending||reduced)return;if(document.hidden){v.pause();el.classList.add('paused')}else{el.classList.remove('paused');v.play().catch(()=>{})}});
 function replayButton(){const main=document.querySelector('#main');if(location.hash.includes('/settings')&&main&&!document.getElementById('introReplay')){const b=document.createElement('button');b.id='introReplay';b.className='btn secondary';b.textContent='Replay the course introduction';b.style.marginTop='20px';b.onclick=()=>window.CourseIntro.replay();main.appendChild(b)}}
 window.CourseIntro={finish,replay(){done=false;ending=false;el.hidden=false;el.classList.remove('leaving','burst','paused');v.currentTime=0;skip.textContent='Skip intro ↗';begin()}};
 window.addEventListener('hashchange',()=>setTimeout(replayButton,20));window.addEventListener('DOMContentLoaded',()=>{lock();replayButton()});begin();
})();
