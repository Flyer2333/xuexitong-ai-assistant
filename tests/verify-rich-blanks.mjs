import {chromium} from './browser-runtime.mjs';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),bundle=await readFile(resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});const observations=[];
// Sanitized reproduction of the observed .Zy_ulTk/.blankItemDiv/.InpDIV/
// hidden .textDIV iframe + answerEditor textarea contract. No course data.
async function open(mode='normal'){
 const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<style>.blankItemDiv{min-height:60px}.InpDIV{min-height:35px;border:1px solid #bbb} .textDIV{display:none}</style><form id="work"><main></main></form>'}));await p.goto('https://mooc1.chaoxing.com/work/doHomeWorkNew');
 await p.evaluate(mode=>{
  window.unsafeWindow=window;window.__mode=mode;window.__submits=[];window.__models=0;window.__aborts=0;window.__next=0;window.__syncs=0;window.__gm={'xxt-quiet-enabled':false,'xxt-ai-enabled':true,'xxt-ai-config':{provider:'custom',protocol:'chat',baseUrl:'https://text.invalid/v1',model:'text-only',key:'fixture-key',vision:false}};
  window.GM_getValue=(k,d)=>__gm[k]??d;window.GM_setValue=(k,v)=>__gm[k]=structuredClone(v);window.GM_xmlhttpRequest=s=>{__models++;const body=JSON.parse(s.data);if(typeof body.messages[0].content!=='string')throw Error('Editor iframe must not become question imagery');const qs=JSON.parse(body.messages[0].content.split('题目：')[1].split('\n之前的平台反馈')[0]);let stopped=false;setTimeout(()=>{if(!stopped)s.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify({answers:qs.map(q=>({id:q.id,texts:Array.from({length:q.slots},(_,i)=>'首次答案'+(i+1)),choices:[],confidence:0.55,readable:true,explanation:'fixture'}))})}}]})});},mode==='pending'?800:30);return{abort(){stopped=true;__aborts++;s.onabort?.();}};};
  window.__counts=[5,2,1];window.__refs=__counts.map((n,q)=>Array.from({length:n},(_,i)=>`参考${q+1}-${i+1}，保留逗号`));
  const title=q=>`<div class="Zy_TItle"><span class="newZy_TItle">【填空题】</span>测试第${q+1}题，依次填写各空。</div>`;
  const main=document.querySelector('main');
  window.__form=()=>{
   window.UE={instants:{}};main.innerHTML=__counts.map((n,q)=>`<div class="TiMu" data="2">${title(q)}<ul class="Zy_ulTk">${Array.from({length:n},(_,i)=>`<div class="blankItemDiv"><span class="tiankong">第${i+1}空：</span><div class="blankItemInp"><div id="inpDivFixture${q}${i}" class="InpDIV"></div><div class="textDIV"><iframe></iframe><textarea name="answerEditorFixture${q}${i}" id="answerEditorFixture${q}${i}" style="display:none"></textarea></div></div></div>`).join('')}</ul></div>`).join('')+'<button type="button" class="btnSubmit workBtnIndex">提交</button>';
   for(const [i,item]of [...main.querySelectorAll('.blankItemDiv')].entries()){
    const field=item.querySelector('textarea'),preview=item.querySelector('.InpDIV'),frame=item.querySelector('iframe');frame.contentDocument.body.contentEditable='true';
    const e={key:field.id,iframe:frame,textarea:field,body:frame.contentDocument.body,isReady:mode!=='hung',options:{},getContent(){return this.body.innerHTML;},setContent(v){this.body.innerHTML=v;this.fireEvent('contentChange');},fireEvent(){preview.innerHTML=this.body.innerHTML;},sync(){__syncs++;field.value=this.getContent();}};UE.instants['ueditorInstant'+i]=e;
    preview.onclick=()=>{preview.style.display='none';item.querySelector('.textDIV').style.display='block';if(mode==='lazy')setTimeout(()=>e.isReady=true,40);};
    if(mode==='lazy')e.isReady=false;
    if(mode==='manual'&&i===0){e.setContent('<p>人工内容</p>');e.sync();}
    if(mode==='readonly'&&i===0)e.options.readonly=true;
   }
   main.querySelector('.btnSubmit').onclick=()=>{
    const values=__counts.map((n,q)=>Array.from({length:n},(_,i)=>{const t=document.querySelector(`#answerEditorFixture${q}${i}`),d=document.createElement('template');d.innerHTML=t.value;return d.content.textContent;}));__submits.push(values);
    const full=__submits.length>1;main.innerHTML=`<div>任务点已完成 最终成绩 ${full?100:50} 分 满分：100</div>`+__counts.map((n,q)=>`<div class="TiMu">${title(q)}<div class="reference">正确答案：${__refs[q].map((v,i)=>mode==='lazy'?'第'+(i+1)+'空：'+v:q===0?'第'+'一二三四五'[i]+'空：'+v:q===1?'（'+(i+1)+'）'+v:v).join(' ')}</div><div>我的答案：已提交</div></div>`).join('')+(full?'<button type="button" id="next">下一节</button>':`<button type="button" id="redo">重做${mode==="no-count"?"":"（剩余 3 次）"}</button>`);
    if(full)document.querySelector('#next').onclick=()=>__next++;else document.querySelector('#redo').onclick=()=>__form();
   };
  };__form();
 },mode);await p.addScriptTag({content:bundle});return p;
}
try{
 for(const mode of ['normal','lazy','no-count']){
  const p=await open(mode);assert.deepEqual(await p.evaluate(()=>XxtCodexDom.extract(document).map(e=>[e.question.type,e.question.slots,e.question.requiresVision])),[['blank',5,false],['blank',2,false],['blank',1,false]]);
  await p.locator('[data-action=start]').click();try{await p.waitForFunction(()=>__next===1,null,{timeout:18000});}catch(e){console.log(await p.evaluate(()=>({status:document.querySelector('pre').textContent,submits:__submits,models:__models,states:Object.keys(__gm)})));throw e;}
  const result=await p.evaluate(()=>({submits:__submits,refs:__refs,models:__models,next:__next,syncs:__syncs,finalScore:XxtCodexDom.readResult(document).finalScore}));assert.equal(result.models,1,'Reference retry must not need another AI answer');assert.equal(result.submits.length,2,'50/100 despite 已完成 must trigger one reference retry');assert.deepEqual(result.submits[0],[5,2,1].map(n=>Array.from({length:n},(_,i)=>'首次答案'+(i+1))));assert.deepEqual(result.submits[1],result.refs);assert.equal(result.finalScore,100);assert(result.syncs>=16);observations.push({mode,...result});await p.close();
 }
 for(const mode of ['manual','readonly','hung']){
  const p=await open(mode);const before=Date.now();await p.locator('[data-action=start]').click();await p.waitForFunction(()=>/手动输入|不可编辑|未能就绪/.test(document.querySelector('pre').textContent),null,{timeout:7000});assert(Date.now()-before<6500);assert.equal(await p.evaluate(()=>__submits.length),0);if(mode==='manual')assert.equal(await p.locator('.InpDIV').first().textContent(),'人工内容');await p.locator('[data-action=stop]').click();observations.push({mode,submit:0,bounded:true});await p.close();
 }
 const p=await open('hung');await p.locator('[data-action=start]').click();await p.waitForFunction(()=>__models===1);await p.locator('[data-action=stop]').click();await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>__submits.length),0);observations.push({mode:'stop-editor',submit:0});await p.close();
 const pending=await open('pending');await pending.locator('[data-action=start]').click();await pending.waitForFunction(()=>__models===1);await pending.locator('[data-action=stop]').click();await pending.waitForTimeout(2200);
 const cancelled=await pending.evaluate(()=>({models:__models,aborts:__aborts,submits:__submits.length,next:__next}));assert.deepEqual(cancelled,{models:1,aborts:1,submits:0,next:0});assert.equal(await pending.locator('#answerEditorFixture00').inputValue(),'');observations.push({mode:'stop-pending-model',...cancelled});await pending.close();
 await mkdir(resolve(root,'artifacts/rich-blanks'),{recursive:true});await writeFile(resolve(root,'artifacts/rich-blanks/observations.json'),JSON.stringify({scope:'Observed DOM contract reproduced in isolation; UEditor API simulated; no real API or course submission',observations},null,2));console.log('Rich blanks: 5+2+1 slots, existing/lazy UEditor sync, first AI answer -> actual 50/100 fixture score -> verbatim reference retry -> 100/100; manual/read-only/hung/stop guards passed.');
}finally{await browser.close();}


