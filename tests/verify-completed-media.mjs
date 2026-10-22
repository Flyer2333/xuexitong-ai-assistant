import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),legacy=process.env.XXT_COMPLETED_MEDIA_BUNDLE;
const bundle=await readFile(legacy||resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8'),out=resolve(root,'output/playwright/completed-media');await mkdir(out,{recursive:true});
const wav=Buffer.alloc(44+8000*2*30);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const media='data:audio/wav;base64,'+wav.toString('base64');
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']}),observations=[];
try{for(const mode of (legacy?['same-origin','nested-player','cross-origin','explicit-restart']:['same-origin','nested-player','cross-origin','explicit-restart','quiet-resume'])){
 const context=await browser.newContext({viewport:{width:1400,height:1000}}),events=[];
 await context.exposeBinding('__event',(_,e)=>events.push(e));
 await context.addInitScript(()=>{window.unsafeWindow=window;window.GM_getValue=(k,d)=>{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)};window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));GM_setValue('xxt-ai-enabled',false);GM_setValue('xxt-quiet-enabled',false);window.GM_xmlhttpRequest=()=>{throw Error('No model calls allowed')};});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());let h='';
  if(u.pathname==='/mycourse/studentstudy')h=`<div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">视频章</span></div><div class="posCatalog_select"><span class="posCatalog_name">下一章</span></div></div><iframe id="iframe" src="/mooc-ans/knowledge/cards" style="width:1000px;height:600px"></iframe><button id="next">下一节</button><script>document.querySelector('#next').onclick=()=>{__event('next');document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');document.querySelector('#iframe').remove()}</script>`;
  else if(u.pathname==='/mooc-ans/knowledge/cards')h=`<div class="ans-attach-ct videoContainer ${['explicit-restart','quiet-resume'].includes(mode)?'':'ans-job-finished'}"><div class="ans-job-icon ans-job-video ans-job-icon-clear" aria-label="${['explicit-restart','quiet-resume'].includes(mode)?'任务点未完成':'任务点已完成'}">完成条件观看时长需 ≥ 总时长的90%</div><iframe class="ans-attach-online ans-insertvideo-online" src="${mode==='cross-origin'?'https://mooc1-1.chaoxing.com':''}/ananas/modules/video/index.html" style="width:900px;height:450px"></iframe></div>`;
  else if(u.pathname==='/ananas/modules/video/index.html'&&mode==='nested-player'&&!u.searchParams.has('leaf'))h='<iframe src="/ananas/modules/video/index.html?leaf=1" style="width:850px;height:400px"></iframe>';
  else if(u.pathname==='/ananas/modules/video/index.html')h=`<video id="video_html5_api" muted controls src="${media}" style="width:800px;height:350px"></video><script>const v=document.querySelector('video');v.onplay=()=>__event('play');v.onpause=()=>__event('pause');v.onended=()=>__event('ended');v.onloadedmetadata=async()=>{${['explicit-restart','quiet-resume'].includes(mode)?'':'v.currentTime=0.5;await v.play();'}}</script>`;
  else return route.fulfill({body:''});
  return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html>${h}<script>${bundle.replaceAll('</script','<\\/script')}</script>`});
 });
 const page=await context.newPage();await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=fixture-completed-video');
 let player;for(let n=0;n<40&&!player;n++){player=page.frames().find(f=>f.url().includes('/modules/video/')&&(mode!=='nested-player'||f.url().includes('leaf=1')));if(!player)await page.waitForTimeout(100);}
 await player.waitForFunction(()=>document.querySelector('video')?.readyState>0);
 if(!['explicit-restart','quiet-resume'].includes(mode))await player.waitForFunction(()=>document.querySelector('video').currentTime>=0.5&&!document.querySelector('video').paused);
 await page.locator('[data-action=start]').click();
 if(mode==='explicit-restart'){
  await player.waitForFunction(()=>document.querySelector('video').currentTime>0.2);await page.locator('[data-action=stop]').click();
  await page.frameLocator('#iframe').locator('.ans-attach-ct').evaluate(e=>{e.classList.add('ans-job-finished');e.querySelector('.ans-job-icon').setAttribute('aria-label','任务点已完成')});
  await page.locator('[data-action=start]').click();
 }
 if(mode==='quiet-resume'){
  await player.waitForFunction(()=>document.querySelector('video').currentTime>0.2);
  await page.frameLocator('#iframe').locator('.ans-attach-ct').evaluate(e=>e.classList.add('ans-job-finished'));
  for(const f of page.frames())await f.evaluate(()=>{GM_setValue('xxt-quiet-enabled',true);window.__quiet=true;XxtCodexCore.quietHoursAt=()=>window.__quiet});
  await player.waitForFunction(()=>document.querySelector('video').paused);
  for(const f of page.frames())await f.evaluate(()=>window.__quiet=false);
  await player.waitForFunction(()=>!document.querySelector('video').paused,null,{timeout:5000});
  await page.waitForTimeout(900);assert(!events.includes('next'));assert(!events.includes('ended'));
  await page.locator('[data-action=stop]').click();observations.push({mode,events});await context.close();continue;
 }
 if(legacy){await page.waitForTimeout(1600);assert(!events.includes('next'));assert(!events.includes('ended'));}
 else{await page.waitForFunction(()=>document.querySelectorAll('.posCatalog_select')[1].classList.contains('posCatalog_active'),null,{timeout:15000}).catch(async error=>{console.error({mode,events,status:await page.locator('[data-xxt-codex-panel] pre').textContent(),inventory:await page.evaluate(()=>XxtPageTasks.scan(window).videos.map(v=>({id:v.id,native:!!v.video,done:XxtPageTasks.complete(v.container)})))});throw error});assert.equal(events.filter(e=>e==='next').length,1);assert(!events.includes('ended'),'A previously completed video must be skipped before playing to end');}
 observations.push({mode,events});await context.close();
}}finally{await browser.close()}
await writeFile(resolve(out,legacy?'before.json':'observations.json'),JSON.stringify({scope:'User-supplied completed video DOM plus synthetic native media; no real platform progress modified',legacy:!!legacy,observations},null,2)+'\n');console.log(legacy?'Old completed media with restored progress replay reproduced':'Completed media with native progress/autoplay skipped; same/nested/cross-origin and explicit restart passed.');
