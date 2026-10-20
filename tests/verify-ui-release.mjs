import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),bundle=await readFile(resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
await mkdir(resolve(root,'artifacts/ui-1.2.0'),{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}});
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<div id="coursetree"><div class="posCatalog_active"><span class="posCatalog_name">UI fixture</span></div></div>'}));
 await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=ui');
 await page.evaluate(()=>{
  window.unsafeWindow=window;window.__gm={'xxt-quiet-enabled':false,'xxt-ai-enabled':true};window.__requests=[];window.__opened=[];
  const realNow=Date.now;window.__offset=0;Date.now=()=>realNow()+__offset;
  window.GM_getValue=(k,d)=>__gm[k]??d;window.GM_setValue=(k,v)=>__gm[k]=structuredClone(v);window.GM_openInTab=(...a)=>__opened.push(a);
  const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(v,...args){window.__code=v;return fill.call(this,v,...args);};
  window.GM_xmlhttpRequest=spec=>{
   __requests.push({url:spec.url,body:spec.data,headers:spec.headers});
   const update=spec.url.includes('/dist/release.json');
   setTimeout(()=>spec.onload(update?{status:200,responseText:JSON.stringify({version:'9.0.0',date:'2026-10-20',changes:['仅最新更新内容']})}:window.__fail?{status:401,responseText:'private provider error'}:{status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify({code:window.__wrong?'000000':__code})}}]})}),10);return {abort(){spec.onabort?.();}};
  };
 });
 await page.addScriptTag({content:bundle});
 const main=page.locator('[data-ai-settings]');await main.locator('summary').click();
 for(const [field,value]of Object.entries({provider:'custom',baseUrl:'https://text.example.invalid/v1',model:'text-model',key:'test-secret-one'})){
  const e=main.locator(`[data-ai-field=${field}]`);if(field==='provider')await e.selectOption(value);else await e.fill(value);
 }
 await main.locator('[data-ai-save]').click();const manager=page.locator('[data-saved-profiles]');assert(!(await manager.getAttribute('open')));await manager.locator('summary').click();
 assert.equal(await manager.locator('.xxt-profile').count(),1);assert(!(await manager.textContent()).includes('test-secret-one'));
 await main.locator('[data-ai-field=model]').fill('image-model');await main.locator('[data-ai-field=key]').fill('test-secret-two');await main.locator('[data-ai-save]').click();assert.equal(await manager.locator('.xxt-profile').count(),2);
 await manager.locator('.xxt-profile').first().getByText('用于文字',{exact:true}).click();assert.equal(await main.locator('[data-ai-field=model]').inputValue(),'text-model');
 await manager.locator('.xxt-profile').last().getByText('用于图片',{exact:true}).click();assert(await page.locator('[data-setting=vision-enabled]').isChecked());
 const image=page.locator('[data-vision-settings]');await image.locator('summary').click();
 for(const skin of ['default','nailoong','naiwa']){
  await page.getByRole('button',{name:skin==='default'?'默认':skin==='nailoong'?'奶龙':'奶蛙',exact:true}).click();
  await image.getByText('测试图片识别（可能计费）',{exact:true}).click();const result=page.getByRole('dialog');await result.waitFor();assert.equal(await result.getAttribute('data-image-test-result'),'success');
  if(skin!=='default')assert.equal(await result.locator('img').count(),1);
  await result.screenshot({path:resolve(root,`artifacts/ui-1.2.0/test-${skin}.png`)});await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.textContent==='测试图片识别（可能计费）');
 }
 await page.evaluate(()=>window.__wrong=true);await image.getByText('测试图片识别（可能计费）',{exact:true}).click();assert.equal(await page.getByRole('dialog').getAttribute('data-image-test-result'),'failure');await page.getByRole('dialog').getByText('知道了').click();
 await page.evaluate(()=>{window.__fail=true;window.__wrong=false;});await page.locator('[data-action=connect]').click();await page.waitForFunction(()=>!document.querySelector('[data-api-warning]').hidden);
 await page.evaluate(()=>document.querySelector('[data-xxt-codex-panel] pre').textContent='正在播放下一项视频…');assert(await page.locator('[data-api-warning]').isVisible());assert((await page.locator('[data-warning-countdown]').textContent()).includes('60s'));
 await page.evaluate(()=>{window.__offset+=59000;document.dispatchEvent(new Event('visibilitychange'));});assert((await page.locator('[data-warning-countdown]').textContent()).includes('1s'));
 await page.evaluate(()=>{window.__offset+=1500;document.dispatchEvent(new Event('visibilitychange'));});assert(await page.locator('[data-api-warning]').isHidden());
 await manager.locator('.xxt-profile').first().getByText('删除配置').click();assert.equal(await page.evaluate(()=>__gm['xxt-ai-config'].key),'');assert.equal(await manager.locator('.xxt-profile').count(),1);
 const updates=page.locator('[data-xxt-updates]');if((await updates.getAttribute('open'))===null)await updates.locator(':scope > summary').click();await updates.getByText('检查更新',{exact:true}).click();const banner=page.locator('[data-update-banner]');await banner.waitFor({state:'visible'});
 assert((await banner.textContent()).includes('9.0.0'));await banner.getByText('稍后提醒',{exact:true}).click();assert(await banner.isHidden());
 await page.evaluate(()=>window.__offset+=6*60*60*1000+1000);await updates.getByText('检查更新',{exact:true}).click();await banner.waitFor({state:'visible'});await banner.getByRole('button',{name:'关闭本版本更新提示'}).click();assert(await banner.isHidden());
 await updates.getByText('检查更新',{exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-update-check]').disabled);assert(await banner.isHidden());assert.equal(await page.evaluate(()=>__opened.length),0);
 await page.setViewportSize({width:360,height:900});await page.locator('[data-action=connect]').click();await page.locator('[data-xxt-codex-panel]').screenshot({path:resolve(root,'artifacts/ui-1.2.0/status-narrow.png')});
 console.log('Saved profiles, masked metadata, slot selection/deletion, three-theme image success/failure dialogs, Escape focus, API warning countdown, update dismiss/snooze and narrow rendering passed. Synthetic API only.');
}finally{await browser.close();}
