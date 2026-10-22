import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),legacy=process.env.XXT_START_BUNDLE;
const bundle=await readFile(legacy||resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
const out=resolve(root,'output/playwright/start-after-test');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),observations=[];
const form=`<div class="TiMu newTiMu"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span>隔离测试题</div><ul class="Zy_ulTop w-top"><li><span class="num_option choice1" data="A">A</span><a class="after">选项一</a></li><li><span class="num_option choice1" data="B">B</span><a class="after">选项二</a></li></ul></div><a class="btnSubmit workBtnIndex">提交</a>`;
try{for(const mode of ['test-then-redo','failed-test-then-redo','pending-test-stop','delayed-scheduler']){
 const context=await browser.newContext({viewport:{width:1500,height:1000}}),events=[];
 await context.exposeBinding('__event',(_,e)=>events.push(e));
 await context.addInitScript(({mode})=>{
  window.unsafeWindow=window;
  window.GM_getValue=(k,d)=>{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)};
  window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  GM_setValue('xxt-quiet-enabled',false);GM_setValue('xxt-ai-enabled',true);
  GM_setValue('xxt-ai-config',{provider:'custom',protocol:'chat',baseUrl:'https://fixture.invalid/v1',model:'fixture-text',key:'fixture-key'});
  const interval=window.setInterval.bind(window);
  window.setInterval=(fn,ms,...args)=>interval(()=>{if(ms!==700||!window.__delayScheduler)fn(...args)},ms);
  window.GM_xmlhttpRequest=s=>{
   if(s.method!=='POST'){s.onload?.({status:200,responseText:'{}'});return{abort(){}};}
   const payload=JSON.parse(s.data),text=payload.messages?.[0]?.content;
   const qs=text?.includes('题目：')?JSON.parse(text.split('题目：')[1].split('\n之前的平台反馈')[0]):null;
   const probe=!qs;__event(probe?'probe':'model');let aborted=false;
   if(mode==='pending-test-stop'&&probe)return{abort(){aborted=true;__event('abort');s.onabort?.()}};
   setTimeout(()=>{if(aborted)return;if(mode==='failed-test-then-redo'&&probe){s.onerror?.();return;}
    s.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify(qs?{answers:qs.map(q=>({id:q.id,choices:['A'],confidence:1,readable:true,explanation:'隔离响应'}))}:{ok:true})}}]})});
   },probe?40:300);
   return{abort(){aborted=true;__event('abort');s.onabort?.()}};
  };
 },{mode});
 await context.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">隔离章节</span></div></div><div id="content">${mode.includes('redo')?'<p>满分:100</p><p>最终成绩60分</p><button id="redo">重做（剩余1次）</button>':form}</div><script>
 const wire=()=>{document.querySelectorAll('.num_option').forEach(e=>e.onclick=()=>e.classList.add('check_answer'));document.querySelector('.btnSubmit').onclick=()=>{__event('submit');document.getElementById('content').innerHTML='<p>满分:100</p><p>最终成绩100分</p>'}};
 document.querySelector('#redo')?.addEventListener('click',()=>{__event('redo');document.getElementById('content').innerHTML=${JSON.stringify(form)};wire()});if(!document.querySelector('#redo'))wire();
 </script><script>${bundle.replaceAll('</script','<\\/script')}</script>`}));
 const page=await context.newPage();await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=fixture-start');
 const panel=page.locator('[data-xxt-codex-panel]');
 if(mode!=='delayed-scheduler'){
  await panel.locator('[data-action=connect]').click();
  if(mode==='pending-test-stop'){
   await page.waitForFunction(()=>document.querySelector('[data-action=connect]').disabled);
   await panel.locator('[data-action=stop]').click();
  }
  await page.waitForFunction(()=>!document.querySelector('[data-action=connect]').disabled);
  if(mode!=='pending-test-stop')await page.locator('dialog.xxt-test-result').getByRole('button',{name:'知道了',exact:true}).click();
 }
 assert(!events.includes('model'));assert(!events.includes('submit'));
 if(mode==='delayed-scheduler')await page.evaluate(()=>window.__delayScheduler=true);
 await panel.locator('[data-action=start]').click();
 if(legacy){
  await page.waitForTimeout(2200);
  if(mode.includes('redo'))assert(events.includes('redo'));
  if(mode==='pending-test-stop')assert(events.includes('submit'));
  else assert(!events.includes('model'),'Old bundle should reproduce the stalled dispatch');
 }else{
  if(mode==='delayed-scheduler'){
   await page.waitForFunction(()=>!document.querySelector('.btnSubmit'),null,{timeout:4000});
   assert(events.includes('model'));assert(events.includes('submit'));
   await page.evaluate(()=>window.__delayScheduler=false);
  }
  await page.waitForFunction(()=>document.querySelector('[data-xxt-codex-panel] pre').textContent.includes('最终成绩 100'),null,{timeout:8000}).catch(async error=>{console.error({mode,events,status:await panel.locator('pre').textContent()});throw error});
  assert.equal(events.filter(e=>e==='model').length,1);assert.equal(events.filter(e=>e==='submit').length,1);
  await panel.locator('[data-action=stop]').click();
  const count=events.length;await page.waitForTimeout(900);assert.equal(events.length,count,'Stop must remain stopped');
 }
 observations.push({mode,events,status:await panel.locator('pre').textContent()});
 if(!legacy&&mode==='test-then-redo')await page.screenshot({path:resolve(out,'fixed.png')});
 await context.close();
}}finally{await browser.close()}
await writeFile(resolve(out,legacy?'before.json':'observations.json'),JSON.stringify({scope:'Isolated DOM and simulated model only; lifecycle leak and delayed scheduler reproduction, no live course submissions',legacy:!!legacy,observations},null,2)+'\n');
console.log(legacy?'Old request-handle leak and delayed dispatch reproduced':'Start after completed/failed/cancelled test and delayed timer passed; one model call and submit each.');
