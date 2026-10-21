import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const legacy=!!process.env.XXT_LEGACY_GRADE_BUNDLE;
const bundle=await readFile(process.env.XXT_LEGACY_GRADE_BUNDLE||resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true}),observations=[];
try{for(const mode of legacy?['reload-grade']:['reload-grade','stop','loading','unavailable']){
 const context=await browser.newContext({viewport:{width:1400,height:1000}}),events=[];
 let submitted=false,loads=0,release;
 const gate=new Promise(r=>release=r);
 await context.exposeBinding('__gradeEvent',(_,v)=>{events.push(v);if(v==='confirmed')submitted=true});
 await context.addInitScript(()=>{
  window.unsafeWindow=window;const now=Date.now.bind(Date);Date.now=()=>now()+Number(localStorage.getItem('fixture-offset')||0);
  window.GM_getValue=(k,d)=>{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)};
  window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  GM_setValue('xxt-quiet-enabled',false);GM_setValue('xxt-ai-enabled',true);
  GM_setValue('xxt-ai-config',{provider:'custom',protocol:'chat',baseUrl:'https://fixture.invalid/v1',model:'fixture-text',key:'fixture-key'});
  window.GM_xmlhttpRequest=s=>{const b=s.data&&JSON.parse(s.data),text=b?.messages?.[0]?.content;
   const qs=text?.includes('题目：')?JSON.parse(text.split('题目：')[1].split('\n之前的平台反馈')[0]):null;
   if(qs)__gradeEvent('model');setTimeout(()=>s.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify(qs?{answers:qs.map(q=>({id:q.id,texts:['候选一','候选二'],choices:[],confidence:0.55,readable:true,explanation:'fixture'}))}:{ok:true})}}]})}),20);
   return {abort(){s.onabort?.()}};
  };
 });
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());let h='';
  if(u.pathname==='/mycourse/studentstudy')h='<div class="prev_title">测试</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">测试章节</span></div><div class="posCatalog_select"><span class="posCatalog_name">下一章</span></div></div><iframe id="iframe" src="/mooc-ans/knowledge/cards" style="width:1000px;height:900px"></iframe><button id="next">下一节</button><script>document.querySelector("#next").onclick=()=>{__gradeEvent("next");document.querySelector(".posCatalog_active").classList.remove("posCatalog_active");document.querySelectorAll(".posCatalog_select")[1].classList.add("posCatalog_active");document.querySelector("#iframe").remove()}</script>';
  else if(u.pathname==='/mooc-ans/knowledge/cards')h='<div class="ans-attach-ct"><span class="ans-job-icon" aria-label="任务点未完成"></span><iframe src="/ananas/modules/work/index.html" style="width:950px;height:800px"></iframe></div>';
  else if(u.pathname==='/ananas/modules/work/index.html')h='<iframe src="/mooc-ans/work/doHomeWorkNew?workId=fixture-grade" style="width:900px;height:700px"></iframe>';
  else if(u.pathname==='/mooc-ans/work/doHomeWorkNew'){
   loads++;if(mode==='loading'&&loads===1)await gate;
   if(submitted&&mode!=='unavailable')h='<h3>测验结果</h3><p>题量:1 <span>满分:100.0</span></p><div class="DividerBox"><div class="dividerCon"><span class="ans_number">第1次作答<i></i></span><span class="achievement">本次成绩<i>70.8</i>分</span></div></div><div class="TiMu"><div class="Zy_TItle">填空结果</div><div>我的答案：</div><div>第一空：候选一</div><div>第二空：候选二</div></div><script>__gradeEvent("grade");window.parent.frameElement.closest(".ans-attach-ct").classList.add("ans-job-finished")</script>';
   else h='<div class="TiMu"><div class="Zy_TItle"><span class="newZy_TItle">【填空题】</span>依次填写两空。</div><input type="text"><textarea></textarea></div><button class="btnSubmit workBtnIndex">提交</button><script>document.querySelector(".btnSubmit").onclick=()=>{__gradeEvent("submit");const d=document.createElement("div");d.innerHTML="<p>确认提交？</p><button>提交</button><button>取消</button>";document.body.append(d);d.querySelector("button").onclick=()=>{__gradeEvent("confirmed");d.remove()}}</script>';
  }else return route.fulfill({body:''});
  await route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html>'+h+`<script>${bundle.replaceAll('</script','<\\/script')}</script>`});
 });
 const p=await context.newPage();await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=fixture-grade',{waitUntil:'domcontentloaded'});
 if(mode!=='loading')await p.frameLocator('#iframe').frameLocator('iframe').frameLocator('iframe').locator('.btnSubmit').waitFor();
 await p.locator('[data-action=start]').click();
 if(mode==='loading'){
  await p.waitForFunction(()=>/等待.*加载/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
  await p.evaluate(()=>localStorage.setItem('fixture-offset','25000'));await p.waitForTimeout(1300);
  assert(!events.includes('model')&&!events.includes('next'),'Loading quiz must not be skipped after the old 20s deadline');release();
 }
 await p.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('xxt-check:')&&JSON.parse(localStorage.getItem(k)).confirmed),null,{timeout:12000});
 if(mode==='stop')await p.locator('[data-action=stop]').click();
 await p.evaluate(()=>localStorage.setItem('fixture-offset',String(Number(localStorage.getItem('fixture-offset')||0)+31000)));
 if(legacy){await p.waitForTimeout(1500);assert.equal(loads,1);assert(!events.includes('grade'));console.log('Old grade wait cannot reload a confirmed submission',events);}
 else if(mode==='stop'){
  await p.waitForTimeout(1300);assert.equal(loads,1);assert(!events.includes('next'));
  await p.locator('[data-action=start]').click();
  await p.waitForFunction(()=>document.querySelectorAll('.posCatalog_select')[1].classList.contains('posCatalog_active'),null,{timeout:10000});
 }else if(mode==='unavailable'){
  await p.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('xxt-check:')&&JSON.parse(localStorage.getItem(k)).gradeReloaded),null,{timeout:8000});
  await p.frameLocator('#iframe').frameLocator('iframe').frameLocator('iframe').locator('.btnSubmit').waitFor();
  await p.waitForTimeout(800);await p.evaluate(()=>localStorage.setItem('fixture-offset','93000'));
  await p.waitForFunction(()=>/成绩仍未加载/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent),null,{timeout:8000});
  await p.locator('[data-action=stop]').click();assert.equal(loads,2,'Grade reload must be bounded');
 }else await p.waitForFunction(()=>document.querySelectorAll('.posCatalog_select')[1].classList.contains('posCatalog_active'),null,{timeout:10000});
 if(!legacy){assert.equal(events.filter(x=>x==='submit').length,1);assert.equal(events.filter(x=>x==='model').length,1);assert.equal(loads,2);if(mode!=='unavailable')assert.equal(events.filter(x=>x==='grade').length,1);}
 observations.push({mode,events,loads});console.log(mode,events,loads);release();await context.close();
 }}finally{await browser.close()}
await mkdir(resolve(root,'artifacts/grade-recovery'),{recursive:true});await writeFile(resolve(root,'artifacts/grade-recovery',legacy?'legacy.json':'observations.json'),JSON.stringify({scope:'Isolated nested frames, simulated model/platform and accelerated clock; actual score header structure retained',observations},null,2));
console.log(legacy?'Legacy missing-grade reproduction passed':'Grade refresh, loading wait, manual stop and bounded retries passed; one answer request and one submit per case.');
