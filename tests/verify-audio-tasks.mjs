import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle=await readFile(process.env.XXT_AUDIO_BUNDLE||new URL('../dist/xuexitong-ai-assistant.user.js',import.meta.url),'utf8');
const out=new URL(process.env.XXT_AUDIO_OUTPUT||'../output/playwright/audio/',import.meta.url);await mkdir(out,{recursive:true});
const wav=Buffer.alloc(44+8000*2*3);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const media=`data:audio/wav;base64,${wav.toString('base64')}`;
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const observations=[];
const names=['1.传感器的定义.m4a','2.传感器的组成.m4a'];
// Sanitized live DOM contract: each audio iframe owns a different task point;
// both children reuse audio_html5_api. The empty hidden audio is not a task.
const frame=(n,cross=false)=>`<div class="ans-attach-ct" aria-label="${names[n-1]}" data-audio="${n}"><div class="ans-job-icon" tabindex="0" aria-label="任务点未完成" role="option"></div><iframe class="ans-attach-online ans-insertaudio" module="insertaudio" name="${names[n-1]}" jobid="audio-${n}" objectid="object-${n}" src="${cross?'https://mooc1-1.chaoxing.com':''}/ananas/modules/audio/index_new.html?n=${n}" style="width:800px;height:220px"></iframe></div>`;
async function scenario({name,cross=false,late=false,stop=false,quiet=false,lag=false,early=false,missing=false,unmuted=false,manual=false}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),events=[];
 await context.exposeBinding('__event',(_,e)=>events.push(e));
 await context.addInitScript(()=>{
  window.unsafeWindow=window;window.__offset=0;const now=Date.now.bind(Date);Date.now=()=>now()+window.__offset;
  window.GM_getValue=(k,f)=>{const s=localStorage.getItem(k);return s===null?f:JSON.parse(s)};
  window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  GM_setValue('xxt-ai-enabled',false);GM_setValue('xxt-quiet-enabled',false);GM_setValue('xxt-video-muted',true);
  window.GM_xmlhttpRequest=c=>{__event('unexpected-request');c.onerror?.({});return {abort(){}}};
 });
 if(unmuted)await context.addInitScript(()=>GM_setValue('xxt-video-muted',false));
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());let body='';
  if(u.pathname==='/mycourse/studentstudy')body=`<div class="prev_title">Synthetic audio chapter</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">audio</span></div><div class="posCatalog_select"><span class="posCatalog_name">next</span></div></div><ul><li id="dct1" cardid="audio"><div class="prev_white">1 音频</div></li></ul><iframe id="iframe" src="/mooc-ans/knowledge/cards?num=0" style="width:1000px;height:650px"></iframe><button id="next">下一节</button><script>document.getElementById('next').onclick=()=>{__event('next');document.querySelector('#iframe')?.remove();document.querySelector('.posCatalog_active')?.classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active')}</script>`;
  else if(u.pathname==='/mooc-ans/knowledge/cards')body=frame(1,cross)+(late?`<div class="ans-attach-ct" data-audio="2"><div class="ans-job-icon" aria-label="任务点未完成"></div><div id="late">音频加载中</div></div>`:frame(2,cross))+`<script>window.addEventListener('message',e=>{if(e.data?.syntheticEnded){const n=e.data.syntheticEnded;${lag||missing?"if(n!==2)":""}document.querySelector('[data-audio="'+n+'"]').querySelector('.ans-job-icon').setAttribute('aria-label','任务点已完成');if(n===1&&${late})setTimeout(()=>document.querySelector('[data-audio="2"]').outerHTML=${JSON.stringify(frame(2,cross))},650)}if(e.data?.syntheticEarly&&${early})document.querySelector('[data-audio="'+e.data.syntheticEarly+'"]').querySelector('.ans-job-icon').setAttribute('aria-label','任务点已完成')})</script>`;
  else if(u.pathname.includes('/modules/audio/')){
   const n=Number(u.searchParams.get('n'));
   body=`<div id="audio" class="video-js vjs-default-skin vjs-paused vjs-audio" role="region" aria-label="音频播放器" style="width:750px;height:180px"><audio id="audio_html5_api" class="vjs-tech" tabindex="-1" preload="none" src="${media}"></audio><div class="ans-audionote">${names[n-1]}</div><button class="vjs-play-control vjs-control vjs-button" title="播放"><span class="vjs-control-text">播放</span></button><span class="vjs-current-time-display">0:00</span><span class="vjs-duration-display">0:03</span></div><div class="audio1_html5" style="display:none"><audio id="audio1_html5_white" preload="metadata"><div class="xaudioplaylist"></div></audio></div><script>const a=document.querySelector('#audio_html5_api');document.querySelector('button').onclick=()=>a.play();a.addEventListener('play',()=>__event('play:${n}'));a.addEventListener('pause',()=>__event('pause:${n}'));a.addEventListener('ended',()=>{__event('ended:${n}');parent.postMessage({syntheticEnded:${n}},'*')});a.addEventListener('timeupdate',()=>{document.querySelector('.vjs-current-time-display').textContent=a.currentTime.toFixed(1);if(a.currentTime>0.2)parent.postMessage({syntheticEarly:${n}},'*')});</script>`;
   body+=`<script>document.querySelector('#audio_html5_api').addEventListener('play',e=>__event('mute-at-play:${n}:'+e.target.muted))</script>`;
  }else return route.fulfill({body:''});
  await route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><style>body{margin:8px}iframe{border:0}audio.vjs-tech{position:absolute;width:0;height:0}</style>${body}<script>${bundle.replaceAll('</script','<\\/script')}</script>`});
 });
 const page=await context.newPage();
 page.on('pageerror',error=>console.error(name,error.message));
 try{
  await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=synthetic-audio');
  await page.locator('[data-action=start]').click();
  const child=async n=>{for(let i=0;i<100;i++){const f=page.frames().find(f=>f.url().includes('/modules/audio/')&&new URL(f.url()).searchParams.get('n')===String(n));if(f)return f;await page.waitForTimeout(100)}throw Error(`Audio iframe ${n} did not load`)};
  const first=await child(1);
  await first.waitForFunction(()=>!document.querySelector('#audio_html5_api').paused);
  assert.equal(await first.evaluate(()=>document.querySelector('#audio_html5_api').muted),!unmuted);
  assert.equal(await first.evaluate(()=>document.querySelector('#audio1_html5_white').paused),true);
  await first.waitForFunction(()=>document.querySelector('#audio_html5_api').currentTime>0.15);
  if(stop||quiet){
   if(quiet)for(const f of page.frames())await f.evaluate(()=>{GM_setValue('xxt-quiet-enabled',true);XxtCodexCore.quietHoursAt=()=>true});
   else await page.locator('[data-action=stop]').click();
   await first.waitForFunction(()=>document.querySelector('#audio_html5_api').paused);
   const at=await first.evaluate(()=>document.querySelector('#audio_html5_api').currentTime);
   await page.waitForTimeout(1500);
   assert.equal(await first.evaluate(()=>document.querySelector('#audio_html5_api').currentTime),at);
   assert(!events.includes('play:2'));assert(!events.includes('next'));
   if(quiet){
    await page.locator('[data-action=stop]').click();
    for(const f of page.frames())await f.evaluate(()=>XxtCodexCore.quietHoursAt=()=>false);
    await page.waitForTimeout(1500);assert.equal(await first.evaluate(()=>document.querySelector('#audio_html5_api').paused),true);
   }else{
    await page.locator('[data-action=start]').click();await first.waitForFunction(()=>!document.querySelector('#audio_html5_api').paused);
   }
   if(quiet){observations.push({name,passed:true,events});return;}
  }
  if(early){await page.waitForTimeout(650);assert(!events.includes('play:2'),'Early green point must not cut off in-progress audio');}
  await first.waitForFunction(()=>document.querySelector('#audio_html5_api').ended);
  const second=await child(2);
  await second.waitForFunction(()=>!document.querySelector('#audio_html5_api').paused);
  assert.equal(await second.evaluate(()=>document.querySelector('#audio_html5_api').muted),!unmuted,'Second audio must inherit mute before native play');
  for(let i=0;i<20&&!events.includes('play:2');i++)await page.waitForTimeout(50);
  assert(events.indexOf('ended:1')<events.indexOf('play:2'));
  assert(!events.includes('next'));
  const view=await page.evaluate(()=>XxtPageTasks.scan(window).videos.map(v=>({id:v.id,kind:v.mediaKind,tag:v.video?.tagName})));
  assert.equal(view.length,2);assert.equal(new Set(view.map(v=>v.id)).size,2);assert(view.every(v=>v.kind==='audio'));if(!cross)assert(view.every(v=>v.tag==='AUDIO'));
  await second.waitForFunction(()=>document.querySelector('#audio_html5_api').ended);
  if(manual){
   await page.locator('[data-action=stop]').click();
   const mute=page.locator('[data-setting=muted]');
   await mute.uncheck();assert.equal(await second.evaluate(()=>document.querySelector('#audio_html5_api').muted),false);
   await mute.check();assert.equal(await second.evaluate(()=>document.querySelector('#audio_html5_api').muted),true);
   await second.getByRole('button',{name:'播放',exact:true}).click();
   await second.waitForFunction(()=>!document.querySelector('#audio_html5_api').paused);
   assert.equal(await second.evaluate(()=>document.querySelector('#audio_html5_api').muted),true);
   await second.evaluate(()=>document.querySelector('#audio_html5_api').pause());
   assert(!events.includes('unexpected-request'));observations.push({name,passed:true,events,manualMuteToggle:true});return;
  }
  if(lag||missing){
   await page.waitForFunction(()=>/音频已播完，等待对应任务点/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
   await page.waitForTimeout(3500);assert(!events.includes('next'));assert.equal(events.filter(e=>e==='play:2').length,1,'Audio must not use video replay recovery');
   if(missing){
    await page.locator('[data-action=stop]').click();await page.waitForTimeout(1500);assert(!events.includes('next'));
    observations.push({name,passed:true,events,inventory:view});return;
   }
   await page.frameLocator('#iframe').locator('[data-audio="2"] .ans-job-icon').evaluate(el=>el.setAttribute('aria-label','任务点已完成'));
  }
  await page.waitForFunction(()=>/音频已播完，任务点已确认/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent)||/下一节|已完成|未发现/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
  for(let i=0;i<100&&!events.includes('next');i++)await page.waitForTimeout(100);
  assert(events.includes('next'),'Only verified completed audio can advance');
  assert(!events.includes('unexpected-request'),'Audio playback must make no model/health requests');
  if(name==='same-origin-natural-end')await page.screenshot({path:new URL('audio-completed.png',out).pathname.slice(process.platform==='win32'?1:0),fullPage:true});
  await page.locator('[data-action=stop]').click();
  observations.push({name,passed:true,events,inventory:view,naturalPlayback:true});
 }catch(error){
  console.error(await page.evaluate(()=>({url:location.pathname,body:document.body?.innerText.slice(0,1000),workflow:typeof XxtCodexControl,gm:typeof GM_getValue})));
  await page.screenshot({path:new URL('failure.png',out).pathname.slice(process.platform==='win32'?1:0)});throw error;
 }finally{
  assert(!events.some(e=>e.startsWith('mute-at-play:')&&!e.endsWith(String(!unmuted))),'Mute preference must already match when each play event fires');
  if(events.includes('unexpected-request'))throw Error('Unexpected model or health request');
  await context.close();
 }
}
try{
 for(const options of [
  {name:'same-origin-natural-end'},
  {name:'cross-origin-natural-end',cross:true},
  {name:'late-second-audio',late:true},
  {name:'manual-stop-and-resume',stop:true},
  {name:'quiet-stop-no-morning-resume',quiet:true},
  {name:'own-marker-late-settlement',lag:true},
  {name:'ended-without-credit-no-replay',missing:true},
  {name:'early-green-await-natural-end',early:true},
  {name:'unmuted-both-audios',unmuted:true},
  {name:'manual-replay-muted-and-toggle-while-stopped',manual:true},
 ]){await scenario(options);console.log(`Audio passed: ${options.name}`);}
}finally{await browser.close();await writeFile(new URL('observations.json',out),JSON.stringify({scope:'Sanitized live audio DOM, isolated pages; natural 3-second playback, no models or real course',observations},null,2)+'\n')}
