import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),legacy=process.env.XXT_DOC_BUNDLE;
const bundle=await readFile(legacy||resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
const out=resolve(root,'output/playwright/completed-documents');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),observations=[];
try{for(const mode of ['class-only','aria-only','cross-origin','mixed','optional-sibling','nested-sibling']){
 const context=await browser.newContext({viewport:{width:1400,height:1000}}),events=[];
 await context.exposeBinding('__event',(_,e)=>events.push(e));
 await context.addInitScript(()=>{
  window.unsafeWindow=window;window.__offset=0;const now=Date.now.bind(Date);Date.now=()=>now()+__offset;
  window.GM_getValue=(k,d)=>{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)};
  window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  GM_setValue('xxt-quiet-enabled',false);GM_setValue('xxt-ai-enabled',false);
  window.GM_xmlhttpRequest=()=>{throw Error('No model requests permitted')};
 });
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());let h='';
  const pending=['mixed','optional-sibling','nested-sibling'].includes(mode);
  const complete=`<div class="ans-attach-ct ${mode==='aria-only'?'':'ans-job-finished'}" data-file="done"><div class="ans-job-icon" ${mode==='aria-only'?'aria-label="任务点已完成"':''}></div><iframe class="ans-attach-online insertdoc-online-pdf" src="${mode==='cross-origin'?'https://mooc1-1.chaoxing.com':''}/ananas/modules/pdf/index.html?n=done" style="width:800px;height:220px"></iframe></div>`;
  const other=pending?`<div class="ans-attach-ct" data-file="pending">${mode==='optional-sibling'?'':'<div class="ans-job-icon"></div>'}<iframe class="ans-attach-online insertdoc-online-pdf" src="/ananas/modules/pdf/index.html?n=pending" style="width:800px;height:220px"></iframe></div>`:'';
  if(u.pathname==='/mycourse/studentstudy')h=`<div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">第一章</span></div><div class="posCatalog_select"><span class="posCatalog_name">下一章</span></div></div><iframe id="iframe" src="/mooc-ans/knowledge/cards" style="width:1000px;height:650px"></iframe><button id="next">下一节</button><script>document.querySelector('#next').onclick=()=>{__event('next');document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');document.querySelector('#iframe').remove()}</script>`;
  else if(u.pathname==='/mooc-ans/knowledge/cards')h=mode==='nested-sibling'?`<div class="ans-attach-ct"><div class="ans-job-icon"></div>${complete}${other}</div>`:complete+other;
  else if(u.pathname.includes('/modules/pdf/'))h='<div style="height:1800px">Synthetic document only</div>';
  else return route.fulfill({body:''});
  return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html>${h}<script>${bundle.replaceAll('</script','<\\/script')}
  const open=XxtCodexDocuments.open;XxtCodexDocuments.open=async(entry,...args)=>{__event('open:'+new URL(entry.element.src||location.href).searchParams.get('n'));return open(entry,...args)};</script>`});
 });
 const page=await context.newPage();await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=fixture-done');
 await page.frameLocator('#iframe').locator('[data-file=done] iframe').waitFor();
 await page.locator('[data-action=start]').click();
 if(legacy){
  await page.waitForTimeout(1300);assert(events.includes('open:done'),'Old version should reread a completed document');
 }else if(['mixed','optional-sibling','nested-sibling'].includes(mode)){
  await page.waitForFunction(()=>document.querySelector('[data-xxt-codex-panel] pre').textContent.includes('文献已打开'));
  assert(events.includes('open:pending'));assert(!events.includes('open:done'));assert(!events.includes('next'));
  for(const frame of page.frames())await frame.evaluate(()=>window.__offset+=61000);
  await page.waitForFunction(()=>document.querySelector('[data-xxt-codex-panel] pre').textContent.includes('文档内部已滚到底')||document.querySelector('[data-xxt-codex-panel] pre').textContent.includes('平台确认')||document.querySelectorAll('.posCatalog_select')[1].classList.contains('posCatalog_active'));
  if(mode==='optional-sibling')await page.waitForFunction(()=>document.querySelectorAll('.posCatalog_select')[1].classList.contains('posCatalog_active'));
  else {assert(!events.includes('next'),'Pending required marker must still block navigation');await page.locator('[data-action=stop]').click();}
 }else{
  await page.waitForFunction(()=>document.querySelectorAll('.posCatalog_select')[1].classList.contains('posCatalog_active'),null,{timeout:7000});
  assert(!events.some(e=>e.startsWith('open:')),'Completed documents must not be reopened or reread');
 }
 observations.push({mode,events});await context.close();
}}finally{await browser.close()}
await writeFile(resolve(out,legacy?'before.json':'observations.json'),JSON.stringify({scope:'User-supplied completion DOM contract; isolated viewers and accelerated dwell only, no real course changes',legacy:!!legacy,observations},null,2)+'\n');
console.log(legacy?'Old completed-document rereading reproduced':'Completed document class/aria/cross-origin skip and mixed/optional/nested ownership passed.');
