import {chromium} from './browser-runtime.mjs';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),legacy=process.env.XXT_VIDEO_MUTE_BUNDLE,bundle=await readFile(legacy||resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8'),out=resolve(root,'output/playwright/video-mute');await mkdir(out,{recursive:true});
const wav=Buffer.alloc(44+16000*5);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);const media='data:audio/wav;base64,'+wav.toString('base64');
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']}),observations=[];
try{for(const mode of ['late-stopped','player-reset','shared-toggle','cross-origin','replacement','inline']){
 const context=await browser.newContext({viewport:{width:1400,height:1000}}),events=[];await context.exposeBinding('__event',(_,e)=>events.push(e));
 await context.addInitScript(()=>{window.unsafeWindow=window;window.GM_getValue=(k,d)=>{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)};window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));GM_setValue('xxt-ai-enabled',false);GM_setValue('xxt-quiet-enabled',false);GM_setValue('xxt-video-muted',true);window.GM_xmlhttpRequest=()=>{throw Error('No model calls allowed')};});
 const player=`<div id="holder"></div><button id="manual-play">手动播放</button><script>function addVideo(){const v=document.createElement('video');v.id='video_html5_api';v.controls=true;v.style='width:800px;height:300px';v.src=${JSON.stringify(media)};v.addEventListener('play',()=>{v.dataset.playMuted=String(v.muted);__event('play-muted:'+v.muted)});document.querySelector('#holder').replaceChildren(v)}document.querySelector('#manual-play').onclick=()=>document.querySelector('video').play();setTimeout(addVideo,180);</script>`;
 await context.route('**/*',route=>{const u=new URL(route.request().url());const h=u.pathname==='/mycourse/studentstudy'?`<div id="coursetree"></div>${mode==='inline'?player:`<iframe id="iframe" src="${mode==='cross-origin'?'https://mooc1-1.chaoxing.com':''}/ananas/modules/video/index.html" style="width:1000px;height:500px"></iframe>`}`:u.pathname==='/ananas/modules/video/index.html'?player:'';return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html>${h}<script>${bundle.replaceAll('</script','<\\/script')}</script>`})});
 const page=await context.newPage();await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=fixture-mute');
 const owner=mode==='inline'?page.mainFrame():page.frames().find(f=>f.url().includes('/modules/video/'));await owner.waitForFunction(()=>document.querySelector('video')?.readyState>0);
 assert(await owner.locator('video').evaluate(v=>v.paused),'Mute synchronization must not start a stopped player');
 const checkbox=page.locator('[data-setting=muted]');
 if(mode==='shared-toggle')await checkbox.uncheck();
 if(mode==='replacement'){await owner.evaluate(()=>addVideo());await owner.waitForFunction(()=>document.querySelector('video').readyState>0);}
 await owner.locator('#manual-play').click();await owner.waitForFunction(()=>!document.querySelector('video').paused);
 if(mode==='player-reset')await owner.evaluate(()=>{document.querySelector('video').muted=false});
 if(legacy&&mode!=='shared-toggle'){
  await page.waitForTimeout(900);assert.equal(await owner.locator('video').evaluate(v=>v.muted),false,'Old stopped-video mute omission must reproduce');
 }else{
  await owner.waitForFunction(expect=>document.querySelector('video').muted===expect,mode!=='shared-toggle');
  await owner.waitForFunction(expect=>document.querySelector('video').dataset.playMuted===String(expect),mode!=='shared-toggle');
  if(mode==='shared-toggle'){
   await owner.evaluate(()=>{document.querySelector('video').muted=true});await page.waitForTimeout(800);
   assert(await owner.locator('video').evaluate(v=>v.muted),'Unchecked assistant mute must not undo native manual mute');
   await owner.evaluate(()=>document.querySelector('video').pause());await checkbox.check();await page.waitForTimeout(800);
   assert(await owner.locator('video').evaluate(v=>v.muted&&v.paused));await owner.locator('#manual-play').click();await owner.waitForFunction(()=>document.querySelector('video').dataset.playMuted==='true');assert(events.includes('play-muted:true'));
  }
 }
 observations.push({mode,events,muted:await owner.locator('video').evaluate(v=>v.muted)});await context.close();
}}finally{await browser.close()}
await writeFile(resolve(out,legacy?'before.json':'observations.json'),JSON.stringify({scope:'Isolated native videos, manual play only, stopped automation; no live course progress or model calls',legacy:!!legacy,observations},null,2)+'\n');console.log(legacy?'Stopped/manual video mute omission reproduced':'Video mute: delayed, reset, shared toggle, cross-origin, replacement and inline stopped playback passed.');
