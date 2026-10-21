import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const source=await readFile(process.env.XXT_NOTIFY_BUNDLE||resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
const marker='    function notify(value) {';
assert.equal(source.split(marker).length,2,'Expected exactly one notify implementation');
// Expose the private entry point only in this instrumented, isolated copy.
// Both baseline and candidate receive the same hook; shipped source has no hook.
const bundle=source.replace(marker,`    globalThis.__renderProbe = { notify, forward() {
        coordinator = { postMessage(message) { globalThis.__forwarded.push(message); } };
    }, remount() { panel.remove(); panel = null; themeStatus = null; mount(); } };
${marker}`);
const browser=await chromium.launch({channel:'chrome',headless:true});
const scenarios=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><title>Isolated notify rendering</title><p>满分:100</p><p>最终成绩100分</p>'}));
 await page.goto('https://mooc1.chaoxing.com/work/doHomeWorkNew?courseId=fixture-render');
 await page.evaluate(()=>{
  window.unsafeWindow=window;window.__forwarded=[];
  window.__gm={'xxt-quiet-enabled':false,'xxt-ai-enabled':false};
  window.GM_getValue=(key,fallback)=>__gm[key]??fallback;
  window.GM_setValue=(key,value)=>{__gm[key]=structuredClone(value);};
  window.GM_xmlhttpRequest=()=>{throw Error('Render probe must not request a model or remote service');};
  window.__logKey='xxt-skipped:xxt-auto:'+location.origin+'/fixture-render/';
  GM_setValue(__logKey,Array.from({length:25},(_,i)=>({chapter:`第${i+1}章`,reason:'fixture 待复核',status:'pending',at:i})));
 });
 await page.addScriptTag({content:bundle});
 await page.locator('[data-skipped-log] ul li').nth(19).waitFor({state:'attached'});
 await page.evaluate(()=>{
  const panel=document.querySelector('[data-xxt-codex-panel]'),pre=panel.querySelector('pre'),state=panel.querySelector('.xxt-state'),log=panel.querySelector('[data-skipped-log]'),summary=log.querySelector('summary'),list=log.querySelector('ul');
  window.__metrics={};
  const count=key=>__metrics[key]=(__metrics[key]||0)+1;
  const replace=Element.prototype.replaceChildren;
  Element.prototype.replaceChildren=function(...children){if(this===list)count('listRebuilds');return replace.apply(this,children);};
  new MutationObserver(records=>{for(const r of records){
   if(r.target===pre)count('outputWrites');
   if(r.target===state)count('stateWrites');
   if(r.target===summary)count('summaryWrites');
   if(r.target===panel&&r.attributeName==='data-sleeping')count('sleepWrites');
   if(r.target===list)count('listMutations');
  }}).observe(panel,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-sleeping']});
  window.__snapshot=()=>({text:pre.textContent,state:state.textContent,sleep:panel.dataset.sleeping,summary:summary.textContent,rows:[...list.children].map(x=>x.textContent),badge:panel.querySelector('.xxt-status-badge').textContent});
  __renderProbe.forward();__renderProbe.notify('正在播放本节视频…');
 });
 async function measure(name,change,repeats=1){
  await page.evaluate(()=>{__metrics={};__forwarded=[];});
  if(change)await page.evaluate(change);
  // One microtask turn per call lets the existing theme observer run normally.
  await page.evaluate(async repeats=>{for(let i=0;i<repeats;i++){__renderProbe.notify('正在播放本节视频…');await Promise.resolve();}},repeats);
  const result=await page.evaluate(()=>({metrics:__metrics,snapshot:__snapshot(),messages:__forwarded.map(x=>({type:x.type,value:x.value}))}));
  assert.equal(result.messages.length,repeats,'UI deduplication must retain every coordinator status message');
  assert(result.messages.every(x=>x.type==='status'&&x.value==='正在播放本节视频…'));
  scenarios.push({name,repeats,...result});return result;
 }
 const repeat=await measure('100 identical notifications',null,100);
 assert.equal(repeat.snapshot.rows.length,20);assert.match(repeat.snapshot.summary,/25 项/);assert.equal(repeat.snapshot.badge,'正在处理');
 const config=await measure('same text, AI configuration changes',()=>GM_setValue('xxt-ai-enabled',true));
 assert.equal(config.snapshot.state,'学习流程 · 多模型接入');
 const change=await measure('same text, visible skip edited externally',()=>{const rows=GM_getValue(__logKey);rows[24].reason='外部更新';rows[24].status='reviewed';GM_setValue(__logKey,rows);});
 assert.match(change.snapshot.rows[19],/\[已复核\].*外部更新/);assert.match(change.snapshot.summary,/24 项/);
 const old=await measure('same visible rows, older entry reviewed',()=>{const rows=GM_getValue(__logKey);rows[0].status='reviewed';GM_setValue(__logKey,rows);});
 assert.match(old.snapshot.summary,/23 项/);assert.deepEqual(old.snapshot.rows,change.snapshot.rows);
 const metadata=await measure('same rendered contents, metadata changes',()=>{const rows=GM_getValue(__logKey);rows[24].at++;GM_setValue(__logKey,structuredClone(rows));});
 assert.deepEqual(metadata.snapshot,old.snapshot);
 const clear=await measure('same text, skip log cleared',()=>GM_setValue(__logKey,[]));assert.equal(clear.snapshot.rows.length,0);assert.match(clear.snapshot.summary,/0 项/);
 await page.evaluate(async()=>{__renderProbe.notify('夜间休息中');await Promise.resolve();});
 assert.equal((await page.evaluate(()=>__snapshot())).sleep,'true');assert.equal((await page.evaluate(()=>__snapshot())).badge,'夜间休息');
 await measure('wake with unchanged AI configuration');assert.equal((await page.evaluate(()=>__snapshot())).sleep,'false');
 // Replacement panels must be populated even if the value has not changed.
 await page.evaluate(()=>__renderProbe.remount());
 await page.waitForFunction(()=>document.querySelector('[data-xxt-codex-panel] pre')?.textContent==='正在播放本节视频…');
 assert.equal(await page.locator('[data-skipped-log] summary').textContent(),'跳过记录 · 0 项待复核');
 if(process.env.XXT_NOTIFY_BASELINE!=='1'){
  assert.deepEqual(repeat.metrics,{},'Identical notifications should perform no measured DOM writes');
  assert.deepEqual(config.metrics,{stateWrites:1},'Configuration sync is independent of output text');
  assert.equal(change.metrics.listRebuilds,1);assert.equal(old.metrics.listRebuilds||0,0);assert.equal(old.metrics.summaryWrites,1);
  assert.deepEqual(metadata.metrics,{});assert.equal(clear.metrics.listRebuilds,1);
 }
 const out=resolve(process.env.XXT_NOTIFY_OUTPUT||resolve(root,'output/playwright/notify-render.json'));await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify({scope:'Instrumented full bundle in identical isolated fixture; DOM mutation counts, not course speed or CPU time',bundleSha256:createHash('sha256').update(source).digest('hex'),browserVersion:browser.version(),scenarios},null,2)+'\n');
 console.log(`Notify render probe passed: ${scenarios.length} scenarios; 100 identical notifications: ${JSON.stringify(repeat.metrics)}; 100/100 status messages retained.`);
}finally{await browser.close();}
