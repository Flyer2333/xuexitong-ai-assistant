import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from './browser-runtime.mjs';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/updates');await mkdir(out,{recursive:true});
const release=JSON.parse(await readFile(resolve(root,'src/release.json'),'utf8')),bundle=await readFile(resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
const browser=await chromium.launchPersistentContext(resolve(out,'profile'),{channel:process.env.XXT_BROWSER_CHANNEL||'chrome',headless:true,viewport:{width:1100,height:1050}});
const results=[];
try {
 for(const scenario of ['unknown','cellular','wifi','disabled','offline','latest','downgrade','failure','invalid','changed-origin','upgrade']) {
  const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<div id="coursetree"><div class="posCatalog_active"><span class="posCatalog_name">更新测试</span></div></div>'}));
  await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=updates-fixture');
  await page.evaluate(({scenario,release})=>{
   window.unsafeWindow=window;window.__calls=[];window.__opened=[];
   window.__store={'xxt-update-wifi':scenario!=='disabled','xxt-quiet-enabled':false,'xxt-update-notes-seen':scenario==='upgrade'?'1.0.8':release.version};
   window.GM_getValue=(k,f)=>window.__store[k]??f;window.GM_setValue=(k,v)=>window.__store[k]=structuredClone(v);
   Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>scenario!=='offline'});
   const connection=new EventTarget();connection.type=scenario==='unknown'?undefined:scenario==='cellular'?'cellular':'wifi';connection.effectiveType='4g';
   Object.defineProperty(navigator,'connection',{configurable:true,get:()=>connection});
   window.GM_openInTab=(...args)=>window.__opened.push(args);
   window.GM_xmlhttpRequest=spec=>{
    window.__calls.push(spec);const data={version:scenario==='latest'?release.version:scenario==='downgrade'?'1.0.8':`${Number(release.version.split('.')[0])+1}.0.0`,date:'2026-10-18',changes:['仅此新版的变化','<img src=x onerror=alert(1)>']};
    setTimeout(()=>{if(scenario==='failure')spec.onerror();else spec.onload({status:200,finalUrl:scenario==='changed-origin'?'https://untrusted.invalid/manifest':spec.url,responseText:scenario==='invalid'?'not JSON':JSON.stringify(data)});},30);return {abort(){}};
   };
  },{scenario,release});
  await page.addScriptTag({content:bundle});const section=page.locator('[data-xxt-updates]'),status=section.locator('[data-update-status]');
  if(['unknown','cellular','disabled','offline'].includes(scenario)){
   assert.equal(await page.evaluate(()=>window.__calls.length),0);
   await section.locator('summary').first().click();await section.locator('[data-update-check]').click();
   if(scenario==='offline')assert.equal(await page.evaluate(()=>window.__calls.length),0);
   else await page.waitForFunction(()=>window.__calls.length===1);
  } else await page.waitForFunction(()=>window.__calls.length===1);
  if(scenario!=='offline') await page.waitForFunction(()=>!document.querySelector('[data-update-check]').disabled);
  const install=section.locator('[data-update-install]');
  if(['latest','downgrade','failure','invalid','changed-origin','offline'].includes(scenario))assert.equal(await install.isVisible(),false,scenario);
  else {
   assert(await install.isVisible());assert((await section.locator('[data-update-notes]').textContent()).includes(`${Number(release.version.split('.')[0])+1}.0.0`));
   assert.equal(await section.locator('[data-update-notes] img').count(),0,'Remote notes must be text');
   assert.match(await page.locator('[data-update-wait-hint]').textContent(),/1 分钟/);await install.click();assert.match(await status.textContent(),/保留页面等待/);assert.match(await status.textContent(),/确认窗口/);assert.equal(await page.evaluate(()=>window.__opened.length),1);
   const url=await page.evaluate(()=>window.__opened[0][0]);assert.equal(url,'https://raw.githubusercontent.com/Flyer2333/xuexitong-ai-assistant/main/dist/xuexitong-ai-assistant.user.js');
  }
  if(scenario==='wifi') {
   await section.locator('[data-update-auto]').uncheck();await section.locator('[data-update-auto]').check();assert.equal(await page.evaluate(()=>window.__calls.length),1,'Six-hour throttle');
   const spec=await page.evaluate(()=>({anonymous:window.__calls[0].anonymous,headers:window.__calls[0].headers,data:window.__calls[0].data}));assert.equal(spec.anonymous,true);assert(!spec.headers&&!spec.data);
   await page.locator('[data-xxt-codex-panel]').screenshot({path:resolve(out,'update-available.png')});
  }
  if(scenario==='upgrade') {
   await page.evaluate(()=>{window.__store['xxt-update-wifi']=false;document.querySelector('[data-xxt-codex-panel]').remove();});
   await page.addScriptTag({content:bundle});assert.equal(await section.getAttribute('open'),'');
   assert.match(await section.locator('[data-update-notes]').textContent(),new RegExp(release.version.replaceAll('.','\\.')));
   assert(!(await section.locator('[data-update-notes]').textContent()).includes('仅此新版的变化'));
   await section.evaluate(el=>el.scrollIntoView({block:'start'}));
   await page.locator('[data-xxt-codex-panel]').screenshot({path:resolve(out,'installed-latest-notes.png')});
   await section.locator('[data-update-acknowledge]').click();assert.equal(await page.evaluate(()=>window.__store['xxt-update-notes-seen']),release.version);
  }
  results.push({scenario,status:await status.textContent(),calls:await page.evaluate(()=>window.__calls.length)});await page.close();
 }
 await writeFile(resolve(out,'observations.json'),JSON.stringify(results,null,2));console.log('11 update scenarios passed: Wi-Fi policy, manual fallback, offline, no downgrade, failure isolation, escaped notes, fixed install URL, throttle, and newest-only post-update notes. Synthetic network only.');
} finally{await browser.close();}
