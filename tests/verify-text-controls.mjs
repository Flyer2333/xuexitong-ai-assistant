import {chromium} from './browser-runtime.mjs';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const dom=await readFile(new URL('../src/dom.js',import.meta.url),'utf8'),core=await readFile(new URL('../src/core.cjs',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.setContent('<div id="fixture"></div>');await page.addScriptTag({content:core});await page.addScriptTag({content:dom});
 const result=await page.evaluate(async()=>{
  const fixture=document.querySelector('#fixture');
  const form=(value='')=>`<div class="TiMu"><div class="newZy_TItle">填空题</div><div class="Zy_TItle">填写两个字</div><input type="text" value="${value}"><textarea></textarea></div>`;
  fixture.innerHTML=form();let entries=XxtCodexDom.extract(document);if(entries[0].question.type!=='blank'||entries[0].question.slots!==2)throw Error('bad parse');
  let events=0;fixture.addEventListener('input',()=>events++);await XxtCodexDom.applyAnswers(entries,[{id:'q1',texts:['甲','乙']}]);
  if(fixture.querySelector('input').value!=='甲'||fixture.querySelector('textarea').value!=='乙'||events!==2)throw Error('bad fill/events');
  await XxtCodexDom.applyAnswers(entries,[{id:'q1',texts:['丙','丁']}]);if(fixture.querySelector('input').value!=='丙')throw Error('own retry blocked');
  fixture.querySelector('input').value='用户手动修改';let blocked=false;try{await XxtCodexDom.applyAnswers(entries,[{id:'q1',texts:['戊','己']}]);}catch{blocked=true;}if(!blocked||fixture.querySelector('input').value!=='用户手动修改')throw Error('manual overwritten');
  fixture.innerHTML=form('原有内容');entries=XxtCodexDom.extract(document);blocked=false;try{await XxtCodexDom.applyAnswers(entries,[{id:'q1',texts:['甲','乙']}]);}catch{blocked=true;}if(!blocked)throw Error('initial overwritten');
  fixture.innerHTML='<div class="TiMu"><div class="newZy_TItle">简答题</div><div class="Zy_TItle">解释</div><div contenteditable="true">rich</div></div>';
  if(XxtCodexDom.extract(document)[0].question.type!=='unsupported')throw Error('rich editor guessed');return{ordinary:true,events,ownedRetry:true,manualProtected:true,richUnsupported:true};
 });assert.equal(result.events,4);console.log('Native blank fields, input/change events, owned retries, initial/manual input protection and rich-editor rejection passed. Synthetic DOM, not live course.');
}finally{await browser.close();}
