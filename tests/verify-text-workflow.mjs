import {chromium} from './browser-runtime.mjs';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const bundle=await readFile(new URL('../dist/xuexitong-ai-assistant.user.js',import.meta.url),'utf8');const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const manual of [false,true]){const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<main><div class="TiMu"><div class="newZy_TItle">填空题</div><div class="Zy_TItle">填写两空</div><input type="text" value="${manual?'人工内容':''}"><textarea></textarea></div><button class="btnSubmit workBtnIndex">提交</button></main>`}));
 await page.goto('https://mooc1.chaoxing.com/work/doHomeWorkNew');await page.evaluate(()=>{
  window.unsafeWindow=window;window.__submitted=0;window.__next=0;window.__models=0;
  window.__gm={'xxt-ai-enabled':true,'xxt-quiet-enabled':false,'xxt-ai-config':{provider:'custom',protocol:'chat',baseUrl:'https://text.invalid/v1',model:'text',key:'fixture-key',vision:false}};
  window.GM_getValue=(k,d)=>__gm[k]??d;window.GM_setValue=(k,v)=>__gm[k]=v;
  window.GM_xmlhttpRequest=spec=>{window.__models++;const body=JSON.parse(spec.data);if(typeof body.messages[0].content!=='string')throw Error('text unexpectedly contains images');let cancel=false;setTimeout(()=>{if(!cancel)spec.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify({answers:[{id:'q1',choices:[],texts:['甲','乙'],readable:true,confidence:1,explanation:'fixture'}]})}}]})});},30);return{abort(){cancel=true;spec.onabort?.();}};};
  document.querySelector('.btnSubmit').onclick=()=>{if(document.querySelector('input').value!=='甲'||document.querySelector('textarea').value!=='乙')throw Error('wrong text');window.__submitted++;document.querySelector('main').innerHTML='<div>最终成绩 100 分 满分：100</div><button id="next">下一节</button>';document.querySelector('#next').onclick=()=>window.__next++;};
 });await page.addScriptTag({content:bundle});await page.locator('[data-action=start]').click();
 if(manual){await page.waitForFunction(()=>document.querySelector('pre').textContent.includes('手动输入'));assert.equal(await page.evaluate(()=>__submitted),0);assert.equal(await page.locator('main input').inputValue(),'人工内容');}
 else{await page.waitForFunction(()=>__next===1);assert.equal(await page.evaluate(()=>__submitted),1);assert.equal(await page.evaluate(()=>__models),1);}
 await page.locator('[data-action=stop]').click();await page.close();}
 console.log('Full blank-question workflow: text-only API -> native fields -> submit -> actual fixture grade -> next; pre-existing input cancels writes and submission. Synthetic site/API.');
}finally{await browser.close();}
