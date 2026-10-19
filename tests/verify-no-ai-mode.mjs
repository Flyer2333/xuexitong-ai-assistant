import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle=await readFile(new URL('../dist/xuexitong-ai-assistant.user.js',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext();
await context.addInitScript(()=>{
 window.unsafeWindow=window;
 window.GM_getValue=(k,d)=>localStorage.getItem(k)===null?d:JSON.parse(localStorage.getItem(k));
 window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
 window.GM_xmlhttpRequest=()=>{window.__requests=(window.__requests||0)+1;throw Error('Unexpected network request');};
});
await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">Mode fixture</span></div></div>'}));
const page=await context.newPage();
async function load(){await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=no-ai');await page.addScriptTag({content:bundle});}
try {
 await load();
 const mode=page.locator('[data-setting="ai-mode"]');
 assert.equal(await mode.inputValue(),'off');
 assert(await page.locator('[data-action="connect"]').isDisabled());
 assert(await page.locator('[data-action="solve"]').isDisabled());
 await page.evaluate(()=>GM_setValue('xxt-ai-config',{provider:'deepseek',protocol:'chat',key:'synthetic-key',model:'deepseek-flash',baseUrl:'https://api.deepseek.com/v1'}));
 await load();assert.equal(await mode.inputValue(),'on','Existing configured users retain AI mode.');
 await mode.selectOption('off');
 assert.equal(await page.evaluate(()=>GM_getValue('xxt-ai-config').key),'synthetic-key');
 await load();assert.equal(await mode.inputValue(),'off','An explicit opt-out survives refresh despite a saved key.');
 await page.evaluate(()=>{GM_setValue('xxt-quiet-enabled',true);XxtCodexCore.quietHoursAt=()=>true;});
 await page.locator('[data-action="start"]').click();
 assert.match(await page.locator('pre').textContent(),/夜间休息/);
 await page.locator('[data-action="stop"]').click();
 await page.evaluate(()=>XxtCodexCore.quietHoursAt=()=>false);
 await page.waitForTimeout(1600);
 assert(!await page.evaluate(()=>Object.entries(sessionStorage).some(([k,v])=>k.startsWith('xxt-auto:')&&v==='1')),'Manual stop cancels morning resume.');
 assert.equal(await page.evaluate(()=>window.__requests||0),0);
 await mode.selectOption('on');assert(await page.locator('[data-action="connect"]').isEnabled());
 assert.equal(await page.evaluate(()=>GM_getValue('xxt-ai-config').model),'deepseek-flash');
 await mode.selectOption('off');
 await mkdir(new URL('../artifacts/no-ai/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('../artifacts/no-ai/mode.png',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:')});
 await page.evaluate(()=>{
  GM_setValue('xxt-quiet-enabled',false);
  const result=document.createElement('main');result.innerHTML='<p>满分:100</p><p>最终成绩50分</p><button id="redo-fixture">重做（剩余100次）</button><button id="next-fixture">下一节</button>';
  document.body.append(result);window.__redos=0;window.__next=0;
  document.querySelector('#redo-fixture').onclick=()=>window.__redos++;
  document.querySelector('#next-fixture').onclick=()=>{window.__next++;result.remove();};
 });
 await page.locator('[data-action="start"]').click();
 await page.waitForFunction(()=>window.__next===1);
 assert.equal(await page.evaluate(()=>window.__redos),0,'No-AI mode must preserve a non-perfect grade without opening redo.');
 assert.equal(await page.evaluate(()=>window.__requests||0),0);
 await page.locator('[data-action="stop"]').click();
 console.log('No-AI defaults, existing-key migration, opt-out persistence, credential retention, mode return, quiet hours, manual stop and no-redo grade continuation passed; zero model requests. Synthetic page.');
} finally {await browser.close();}
