import {chromium} from './browser-runtime.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle=await readFile(new URL('../dist/xuexitong-ai-assistant.user.js',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">分流测试</span></div></div>'}));
 await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=routing');
 await page.evaluate(()=>{
  window.unsafeWindow=window;window.__gm={'xxt-quiet-enabled':false,'xxt-ai-enabled':true};window.__calls=[];
  window.GM_getValue=(k,d)=>window.__gm[k]??d;window.GM_setValue=(k,v)=>window.__gm[k]=structuredClone(v);
  window.GM_xmlhttpRequest=spec=>{const body=JSON.parse(spec.data),prompt=body.messages[0].content;window.__calls.push({url:spec.url,auth:spec.headers.Authorization,body});
   let aborted=false;const text=typeof prompt==='string'?prompt:prompt[0].text;
   const questions=text.includes('题目：')?JSON.parse(text.split('题目：')[1].split('\n之前的平台反馈')[0]):null;
   const value=questions?{answers:questions.map(q=>({id:q.id,choices:['A'],readable:true,confidence:1,explanation:'模拟响应'}))}:{code:window.__drawnCode};
   setTimeout(()=>{if(!aborted)spec.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]})});},window.__slow?1500:20);
   return{abort(){aborted=true;window.__aborts=(window.__aborts||0)+1;spec.onabort?.();}};
  };
  const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__drawnCode=text;return original.call(this,text,...args);};
 });
 await page.addScriptTag({content:bundle});
 const main=page.locator('[data-ai-settings]');await main.locator('summary').click();
 for(const [field,value] of Object.entries({provider:'custom',baseUrl:'https://text.example.invalid/v1',model:'text-model',key:'text-key'})){
  const input=main.locator(`[data-ai-field=${field}]`);if(field==='provider')await input.selectOption(value);else await input.fill(value);
 }
 await main.locator('[data-ai-field=vision]').uncheck();await main.locator('[data-ai-save]').click();
 await page.locator('[data-setting=vision-enabled]').check();const vision=page.locator('[data-vision-settings]');await vision.locator('summary').click();
 for(const [field,value] of Object.entries({provider:'custom',baseUrl:'https://vision.example.invalid/v1',model:'vision-model',key:'vision-key'})){
  const input=vision.locator(`[data-vision-field=${field}]`);if(field==='provider')await input.selectOption(value);else await input.fill(value);
 }
 await vision.locator('[data-vision-save]').click();
 await page.evaluate(async()=>{
  const q=id=>({id,type:'single',text:'二选一',options:[{key:'A',text:'甲'},{key:'B',text:'乙'}]});
  const questions=[q('a'),{...q('b'),imageKey:'img-b'}];
  window.__result=await XxtAi.request('/solve',{questions,images:['data:image/png;base64,aGVsbG8='],imageQuestionIds:['b']}).promise;
 });
 const calls=await page.evaluate(()=>window.__calls);assert.equal(calls.length,2);assert.equal(calls[0].auth,'Bearer text-key');assert.equal(typeof calls[0].body.messages[0].content,'string');
 assert.equal(calls[1].auth,'Bearer vision-key');assert.equal(calls[1].url,'https://vision.example.invalid/v1/chat/completions');assert.equal(calls[1].body.messages[0].content[1].type,'image_url');
 await vision.getByText('测试图片识别（可能计费）',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-vision-settings] [role=status]').textContent.includes('随机数字图片识别通过'));
 const probe=await page.evaluate(()=>({prompt:__calls.at(-1).body.messages[0].content[0].text,code:__drawnCode}));assert(!probe.prompt.includes(probe.code),'Expected answer must not appear in text prompt');
 await page.evaluate(()=>window.__slow=true);await vision.getByText('测试图片识别（可能计费）',{exact:true}).click();await page.locator('[data-action=stop]').click();
 await page.waitForFunction(()=>document.querySelector('[data-vision-settings] [role=status]').textContent.includes('停止'));assert((await page.evaluate(()=>__aborts))>=1);
 await page.locator('[data-setting=ai-mode]').selectOption('off');assert(await vision.isHidden());assert(await main.isHidden());
 console.log('Dual-provider settings, text/image payload routing, private credentials, random image probe and manual-stop cancellation passed. Synthetic model responses; no live API or course claims.');
} finally {await browser.close();}
