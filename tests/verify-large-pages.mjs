import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),bundle=await readFile(resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
const out=resolve(root,'output/playwright/large-pages');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),observations=[];
try{for(const [count,mode] of [[216,'complete'],[256,'complete'],[257,'over-limit'],[256,'stop'],[256,'later-failure']]){
 const context=await browser.newContext({viewport:{width:1450,height:950}}),events=[],batches=[];
 await context.exposeBinding('__event',(_,e)=>events.push(e));await context.exposeBinding('__batch',(_,ids)=>batches.push(ids));
 await context.addInitScript(({mode})=>{
  window.unsafeWindow=window;window.__calls=0;
  window.GM_getValue=(k,d)=>{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)};
  window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  GM_setValue('xxt-quiet-enabled',false);GM_setValue('xxt-ai-enabled',true);
  GM_setValue('xxt-ai-config',{provider:'custom',protocol:'chat',baseUrl:'https://fixture.invalid/v1',model:'fixture-text',key:'fixture-key'});
  window.GM_xmlhttpRequest=s=>{
   if(s.method!=='POST'){s.onload?.({status:200,responseText:'{}'});return{abort(){}};}
   const text=JSON.parse(s.data).messages[0].content,qs=JSON.parse(text.split('题目：')[1].split('\n之前的平台反馈')[0]);
   const n=++window.__calls;__batch(qs.map(q=>q.id));let aborted=false;
   const timer=setTimeout(()=>{if(aborted)return;if(mode==='later-failure'&&n===2){s.onerror?.();return;}
    s.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify({answers:qs.map(q=>({id:q.id,choices:['A'],readable:true,confidence:1,explanation:'fixture'}))})}}]})});
   },mode==='stop'&&n===2?30000:10);
   return{abort(){aborted=true;clearTimeout(timer);__event('abort');s.onabort?.()}};
  };
 },{mode});
 const html=Array.from({length:count},(_,i)=>`<div class="TiMu newTiMu"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span>隔离题 ${i+1}</div><ul class="Zy_ulTop"><li><span class="num_option choice${i+1}">A</span><a class="after">甲</a></li><li><span class="num_option choice${i+1}">B</span><a class="after">乙</a></li></ul></div>`).join('');
 await context.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><style>.TiMu{margin:3px}.Zy_ulTop{display:flex;gap:30px}</style><main>${html}<a class="btnSubmit workBtnIndex">提交</a></main><button id="next">下一节</button><script>
 document.querySelectorAll('.num_option').forEach(e=>e.onclick=()=>e.classList.add('check_answer'));
 document.querySelector('.btnSubmit').onclick=()=>{const n=document.querySelectorAll('.num_option.check_answer').length;__event('selected:'+n);__event('submit');document.querySelector('main').innerHTML='<p>满分:100</p><p>最终成绩100分</p>'};document.querySelector('#next').onclick=()=>{__event('next');document.querySelector('#next').remove()};
 </script><script>${bundle.replaceAll('</script','<\\/script')}</script>`}));
 const page=await context.newPage();await page.goto('https://mooc1.chaoxing.com/mooc-ans/work/doHomeWorkNew?workId=fixture-large');
 await page.locator('[data-action=start]').click();
 if(mode==='complete'){
  await page.waitForFunction(()=>document.querySelector('main').textContent.includes('最终成绩100'),null,{timeout:120000});
  assert.equal(batches.length,Math.ceil(count/16));assert(batches.every(p=>p.length<=16));
  assert.deepEqual(batches.flat(),Array.from({length:count},(_,i)=>'q'+(i+1)));
  assert.equal(events.filter(e=>e==='submit').length,1);assert(events.includes('selected:'+count));
 }else if(mode==='over-limit'){
  await page.waitForFunction(()=>document.querySelector('[data-xxt-codex-panel] pre').textContent.includes('256'));
  assert.equal(batches.length,0);assert(!events.includes('submit'));
 }else if(mode==='stop'){
  await page.waitForFunction(()=>window.__calls===2);await page.locator('[data-action=stop]').click();await page.waitForTimeout(700);
  assert.equal(batches.length,2);assert(events.includes('abort'));assert(!events.includes('submit'));assert.equal(await page.locator('.check_answer').count(),0);
 }else{
  await page.waitForFunction(()=>document.querySelector('[data-xxt-codex-panel] pre').textContent.includes('网络'));
  assert.equal(batches.length,2);assert(!events.includes('submit'));assert.equal(await page.locator('.check_answer').count(),0);
 }
 observations.push({count,mode,batchSizes:batches.map(p=>p.length),events,status:await page.locator('[data-xxt-codex-panel] pre').textContent()});
 await page.locator('[data-action=stop]').click();await context.close();console.log('Large-page case passed:',count,mode);
}}finally{await browser.close()}
await writeFile(resolve(out,'observations.json'),JSON.stringify({scope:'Generated questions and mocked model/platform only; no real 200+ question homework or paid inference verified',observations},null,2)+'\n');
