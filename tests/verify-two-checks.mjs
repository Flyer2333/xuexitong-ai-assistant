import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const legacy=process.env.XXT_LEGACY_TWO_CHECKS==='1';
if(legacy&&!process.env.XXT_LEGACY_BUNDLE)throw Error('Set XXT_LEGACY_BUNDLE to a frozen old build for defect reproduction');
const bundle=await readFile(legacy?process.env.XXT_LEGACY_BUNDLE:resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});const observations=[];
try{for(const pregraded of [false,true]){
 const context=await browser.newContext({viewport:{width:1400,height:1000}}),events=[];
 await context.exposeBinding('__event',(_,e)=>events.push(e));
 await context.addInitScript(()=>{
  window.unsafeWindow=window;
  window.GM_getValue=(k,d)=>{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)};
  window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  GM_setValue('xxt-quiet-enabled',false);GM_setValue('xxt-ai-enabled',true);
  GM_setValue('xxt-ai-config',{provider:'custom',protocol:'chat',baseUrl:'https://fixture.invalid/v1',model:'fixture-text',key:'fixture-test-key'});
  window.GM_xmlhttpRequest=s=>{let aborted=false;const b=s.data&&JSON.parse(s.data),text=b?.messages?.[0]?.content;
   const qs=text?.includes('题目：')?JSON.parse(text.split('题目：')[1].split('\n之前的平台反馈')[0]):null;
   if(qs)__event('model:'+new URL(location.href).searchParams.get('workId'));
   setTimeout(()=>{if(!aborted)s.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify(qs?{answers:qs.map(q=>({id:q.id,choices:['A'],confidence:1,readable:true,explanation:'fixture'}))}:{ok:true})}}]})});},30);
   return{abort(){aborted=true;s.onabort?.()}};
  };
 });
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());let h='';
  if(u.pathname==='/mycourse/studentstudy')h=`<div class="prev_title">测试</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">同章两个检测</span></div><div class="posCatalog_select"><span class="posCatalog_name">下一章</span></div></div><iframe id="iframe" src="/mooc-ans/knowledge/cards?num=0" style="width:1000px;height:1800px"></iframe><button id="next">下一节</button><script>document.querySelector('#next').onclick=()=>{const d=document.querySelector('#iframe').contentDocument;if(d.querySelectorAll('.ans-job-finished').length!==2){__event('early-next');return}__event('next');document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');document.querySelector('#iframe').remove();}</script>`;
  else if(u.pathname==='/mooc-ans/knowledge/cards')h=[1,2].map(n=>`<div class="ans-attach-ct ${pregraded&&n===1?'ans-job-finished':''}"><span class="ans-job-icon" aria-label="${pregraded&&n===1?'任务点已完成':'任务点未完成'}"></span><iframe src="/ananas/modules/work/index.html?n=${n}" style="width:950px;height:700px"></iframe></div>`).join('');
  else if(u.pathname==='/ananas/modules/work/index.html')h=`<iframe src="/mooc-ans/work/doHomeWorkNew?workId=${u.searchParams.get('n')}" style="width:900px;height:650px"></iframe>`;
  else if(u.pathname==='/mooc-ans/work/doHomeWorkNew'){
   const n=u.searchParams.get('workId');
   h=pregraded&&n==='1'?'<p>满分:100</p><p>最终成绩100分</p>':`<h3>${n==='1'?'课前测':'课后测'}</h3><div class="TiMu"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span>检测${n}题干</div><ul class="Zy_ulTop">${['A','B'].map(k=>`<li><span class="num_option_dx">${k}</span><a class="after">${k}选项</a></li>`).join('')}</ul></div><a class="btnSubmit workBtnIndex">提交</a><script>document.querySelectorAll('.num_option_dx').forEach(e=>e.onclick=()=>e.classList.add('check_answer'));document.querySelector('.btnSubmit').onclick=()=>{__event('submit:${n}');window.parent.frameElement.closest('.ans-attach-ct').classList.add('ans-job-finished');document.body.innerHTML='<p>满分:100</p><p>最终成绩100分</p>';}</script>`;
  }else return route.fulfill({body:''});
  await route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html>'+h+`<script>${bundle.replaceAll('</script','<\\/script')}</script>`});
 });
 const p=await context.newPage();await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=fixture-two-checks');
 await p.frameLocator('#iframe').frameLocator('iframe[src*="n=2"]').frameLocator('iframe').locator('.btnSubmit').waitFor();
 await p.waitForFunction(()=>XxtPageTasks.scan(window).questions.length===2);await p.locator('[data-action=start]').click();
 if(legacy){await p.waitForTimeout(6500);assert(!events.includes('next'));assert(!events.includes('submit:2'));console.log('Legacy reproduced sibling completion leak',pregraded,events);await context.close();continue;}
 await p.waitForFunction(()=>document.querySelectorAll('.posCatalog_select')[1].classList.contains('posCatalog_active'),null,{timeout:12000}).catch(async e=>{console.error(events,await p.locator('[data-xxt-codex-panel] pre').textContent());throw e});
 assert(!events.includes('early-next'));assert.equal(events.filter(x=>x==='submit:2').length,1);assert.equal(events.filter(x=>x==='submit:1').length,pregraded?0:1);assert.equal(events.filter(x=>x==='next').length,1);
 const keys=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('/work:')));assert.equal(keys.length,2);observations.push({pregraded,events,recordCount:keys.length});await context.close();
 }}finally{await browser.close()}
await mkdir(resolve(root,'artifacts/two-checks'),{recursive:true});await writeFile(resolve(root,'artifacts/two-checks',legacy?'legacy.json':'observations.json'),JSON.stringify({legacy,scope:'Synthetic same-origin nested sibling quizzes; no real submissions',observations},null,2));
console.log(legacy?'Legacy defect reproduced':'Two nested quizzes: both fresh and first pregraded passed; independent records, no early navigation or duplicate submit.');
