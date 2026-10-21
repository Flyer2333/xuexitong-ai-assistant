import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from './browser-runtime.mjs';
const root=resolve(import.meta.dirname,'..'),temp=resolve(root,'artifacts/public-browser');await mkdir(temp,{recursive:true});
const bundle=await readFile(resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
const browser=await chromium.launchPersistentContext(resolve(temp,'profile'),{channel:process.env.XXT_BROWSER_CHANNEL||'chrome',headless:true,viewport:{width:1280,height:950}});
const result=[];
try{
 for(const protocol of ['chat','responses','anthropic','gemini']){
  const page=await browser.newPage();
  await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<div class="prev_title" title="安全知识">安全知识</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">演示章节</span></div></div><div class="ans-videoquiz" style="width:700px;height:400px"><div class="tkTopic"><div class="tkTopic_title">多选题</div><div class="tkTopic_numbar">共 1 题，已答对 <i id="rightNum">0</i> 题</div><div class="tkItem_title">哪些是偶数？</div><label><input type="checkbox">A、2</label><label><input type="checkbox">B、4</label><a id="videoquiz-submit">提交</a><span id="spanHas" style="display:none">恭喜你，答对了！</span><a id="videoquiz-continue" style="display:none">继续学习</a></div></div>'}));
  await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=synthetic');
  await page.evaluate(protocol=>{
   window.unsafeWindow=window;const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(v,...args){window.__drawnCode=String(v);return original.call(this,v,...args);};window.__requests=[];window.__submits=0;window.__continues=0;window.__gm={'xxt-quiet-enabled':false};
   window.GM_getValue=(key,fallback)=>window.__gm[key]??fallback;window.GM_setValue=(key,value)=>{window.__gm[key]=structuredClone(value);};
   window.GM_xmlhttpRequest=spec=>{window.__requests.push(spec.url);const data=JSON.parse(spec.data),raw=JSON.stringify(data);let text;
    if(raw.includes('六位数字'))text=JSON.stringify({code:window.__drawnCode});else if(raw.includes('这是连接测试'))text='{"ok":true}';else{const questionText=raw.match(/vq[a-f0-9]+/)?.[0];text=JSON.stringify({answers:[{id:questionText,choices:['A','B'],readable:true,confidence:1,explanation:'两个均为偶数'}]});}
    const response=protocol==='chat'?{choices:[{message:{content:text}}]}:protocol==='responses'?{output:[{content:[{type:'output_text',text}]}]}:protocol==='anthropic'?{content:[{type:'text',text}]}:{candidates:[{content:{parts:[{text}]}}]};
    setTimeout(()=>spec.onload({status:200,responseText:JSON.stringify(response)}),100);return {abort(){spec.onabort?.();}};};
   document.getElementById('videoquiz-submit').onclick=()=>{window.__submits++;document.querySelectorAll('.ans-videoquiz input[type=checkbox]').forEach(el=>{if(!el.checked)throw Error('Missing answer');});document.getElementById('rightNum').textContent='1';document.getElementById('spanHas').style.display='inline';document.getElementById('videoquiz-submit').style.display='none';document.getElementById('videoquiz-continue').style.display='inline';};
   document.getElementById('videoquiz-continue').onclick=()=>{window.__continues++;document.querySelector('.ans-videoquiz').remove();};
  },protocol);
  await page.addScriptTag({content:bundle});await page.evaluate(()=>{window.html2canvas=async()=>({toDataURL:()=>'data:image/png;base64,aGVsbG8='});});
 await page.locator('[data-setting=ai-mode]').selectOption('on');
  const settings=page.locator('[data-ai-settings]');await settings.locator('summary').click();
  for(const value of ['deepseek','xiaomi','kimi','zhipu','qwen','doubao','siliconflow'])assert.equal(await settings.locator(`[data-ai-field=provider] option[value=${value}]`).count(),1);
  await settings.locator('[data-ai-field=provider]').selectOption('custom');await settings.locator('[data-ai-field=protocol]').selectOption(protocol);
  await settings.locator('[data-ai-field=baseUrl]').fill('https://api.example.invalid/v1');await settings.locator('[data-ai-field=model]').fill('vision-test');await settings.locator('[data-ai-field=key]').fill('test-only-key');await settings.locator('[data-ai-field=purpose]').selectOption('both');await settings.locator('[data-ai-save]').click();
  assert.equal(await settings.locator('[data-ai-field=key]').inputValue(),'');assert(!(await page.locator('body').textContent()).includes('test-only-key'));
  await page.locator('[data-action=connect]').click();await page.waitForFunction(()=>document.querySelector('pre').textContent.includes('连接测试通过'));
  await page.getByRole('dialog').getByText('知道了',{exact:true}).click();await settings.locator('summary').click();
  if(protocol==='chat'){
   await page.screenshot({path:resolve(temp,'public-ui.png')});
   await page.locator('[data-xxt-codex-panel]').screenshot({path:resolve(root,'docs/ui-preview.png')});
  }
  await page.locator('[data-action=start]').click();
  if(protocol==='chat') await page.locator('[data-skin-choice=nailoong]').click();
  try { await page.waitForFunction(()=>window.__continues===1,null,{timeout:12000}); }
  catch(error) { console.error(await page.evaluate(()=>({status:document.querySelector('pre')?.textContent,requests:window.__requests,submits:window.__submits,continues:window.__continues,panel:XxtVideoQuiz.find(document)?.outerHTML,buttons:[...document.querySelectorAll('.tkTopic a')].map(el=>({text:el.textContent,visible:XxtCodexDom.visible(el),style:el.getAttribute('style')}))}))); throw error; }
  await page.locator('[data-action=stop]').click();
  const counts=await page.evaluate(()=>({submits:window.__submits,continues:window.__continues,requests:window.__requests.length}));assert.deepEqual(counts,{submits:1,continues:1,requests:3});
  if(protocol==='chat') { assert.equal(await page.locator('.xxt-head strong').textContent(),'vision-test·学习助手'); await page.locator('[data-skin-choice=default]').click(); }
  assert.equal(await page.locator('.xxt-mascot').count(),0);assert(!(await page.locator('body').textContent()).includes('虹芽'));
  // Changing the destination must not silently reuse the previous provider's secret.
  await settings.locator('summary').click();await settings.locator('[data-ai-field=baseUrl]').fill('https://other.example.invalid/v1');await settings.locator('[data-ai-save]').click();
  assert.match(await settings.locator('[role=status]').textContent(),/API Key/);
  result.push({protocol,...counts});await page.close();
 }
 await writeFile(resolve(temp,'observations.json'),JSON.stringify(result,null,2));
 console.log('Four native provider UI-to-answer flows passed: save/masked key/probe/submit/continue, no mascot, changed endpoint requires a new key. All API responses synthetic.');
}finally{await browser.close();}
