import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from './browser-runtime.mjs';
const root=resolve(import.meta.dirname,'..'),temp=resolve(root,'artifacts/themes');await mkdir(temp,{recursive:true});
const bundle=await readFile(resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
assert.match(bundle,/@name\s+超星学习通自动化脚本（支持接入各种主流AI模型api）/);
const browser=await chromium.launchPersistentContext(resolve(temp,'profile'),{channel:'chrome',headless:true,viewport:{width:1280,height:850}});
const page=await browser.newPage();let external=0;
await page.route('**/*',route=>{if(!route.request().isNavigationRequest())external++;return route.fulfill({contentType:'text/html; charset=utf-8',body:'<style>body{background:#f1f4f8}</style><div id="coursetree"><div class="posCatalog_active"><span class="posCatalog_name">Synthetic UI</span></div></div>'});});
await page.addInitScript(()=>{
 window.unsafeWindow=window;window.__store=JSON.parse(sessionStorage.getItem('theme-store')||'{}');window.__store['xxt-quiet-enabled']=false;
 window.GM_getValue=(k,f)=>window.__store[k]??f;
 window.GM_setValue=(k,v)=>{window.__store[k]=structuredClone(v);sessionStorage.setItem('theme-store',JSON.stringify(window.__store));};
 window.__modelCalls=0;window.GM_xmlhttpRequest=()=>{window.__modelCalls++;throw Error('Theme controls must not request models.');};
});
const observed=[];
try{
 await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=skin-fixture');await page.addScriptTag({content:bundle});
 const panel=page.locator('[data-xxt-codex-panel]'),title=panel.locator('.xxt-head strong'),feedback=panel.locator('[data-feedback-details]');
 assert.equal(await title.textContent(),'学习助手');assert.equal(await panel.getAttribute('data-skin'),'default');
 assert.equal(await feedback.getAttribute('open'),null);assert.equal(await panel.locator('.xxt-feedback-copy').isVisible(),false);
 assert.equal(await panel.locator('.xxt-feedback-links a').count(),2);
 await feedback.locator('summary').click();assert(await panel.locator('.xxt-feedback-copy').isVisible());
 assert.match(await panel.locator('.xxt-feedback-copy').textContent(),/作者自己的实际使用需求/);await feedback.locator('summary').click();
 await page.evaluate(()=>window.__skinPreviews=[]);
 for(const [skin,label] of [['default','学习助手'],['nailoong','奶龙·学习助手'],['naiwa','奶蛙·学习助手']]){
  await panel.locator(`[data-skin-choice=${skin}]`).click();assert.equal(await title.textContent(),label);
  assert.equal(await panel.locator('button[aria-pressed=true]').getAttribute('data-skin-choice'),skin);
  if(skin!=='default')await panel.locator('.xxt-theme-mascot img').evaluate(async image=>{await image.decode();if(!image.naturalWidth)throw Error('Mascot decode failed');});
  const bounds=await panel.evaluate(el=>({overflow:el.querySelector('.xxt-shell').scrollWidth>el.clientWidth,feedback:getComputedStyle(el.querySelector('.xxt-feedback a')).color}));
  if(skin==='naiwa'){
   assert.equal(await panel.evaluate(el=>getComputedStyle(el).getPropertyValue('--button').trim()),'#eac84b');
   const cutout=await panel.locator('.xxt-theme-mascot img').evaluate(image=>{
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let transparent=0,opaque=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;if(pixels[i]>250)opaque++;}
    const style=getComputedStyle(image.parentElement);return{transparent,opaque,border:style.borderTopWidth,background:style.backgroundColor};
   });
   assert(cutout.transparent>1000&&cutout.opaque>1000,'Naiwa must have a real transparent silhouette');
   assert.equal(cutout.border,'0px');assert.equal(cutout.background,'rgba(0, 0, 0, 0)');
  }
  assert(!bounds.overflow);assert.equal(bounds.feedback,'rgb(79, 70, 229)');
  await page.evaluate(()=>window.__skinPreviews.push(document.querySelector('[data-xxt-codex-panel]').cloneNode(true)));
  observed.push({skin,title:label,mascot:skin!=='default',feedbackCollapsed:true});
 }
 assert.equal(await page.evaluate(()=>window.__modelCalls),0);assert.equal(external,0,'Embedded theme pictures must not fetch external resources.');
 // Persisted skin survives remount/reload.
 await page.reload();await page.addScriptTag({content:bundle});assert.equal(await title.textContent(),'奶蛙·学习助手');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await panel.locator('.xxt-theme-mascot img').evaluate(x=>getComputedStyle(x).visibility),'visible');await page.emulateMedia({reducedMotion:'no-preference'});
 // Return to the shipped default for the ordinary UI preview.
 await panel.locator('[data-skin-choice=default]').click();await panel.screenshot({path:resolve(root,'docs/ui-preview.png')});
 // Render a side-by-side comparison without any model calls.
 for(const [skin] of [['default'],['nailoong'],['naiwa']]){
  await panel.locator(`[data-skin-choice=${skin}]`).click();if(skin!=='default')await panel.locator('.xxt-theme-mascot img').evaluate(x=>x.decode());
  await page.evaluate(()=>{window.__skinPreviews ||= [];window.__skinPreviews.push(document.querySelector('[data-xxt-codex-panel]').cloneNode(true));});
 }
 await page.evaluate(()=>{
  const previews=window.__skinPreviews.slice(-3);document.querySelectorAll('[data-xxt-codex-panel],#coursetree').forEach(x=>x.remove());
  document.body.style.cssText='margin:0;background:#f2f4f7;font-family:system-ui,sans-serif;padding:35px 36px;';
  const h=document.createElement('h2');h.textContent='三种外观，同一个学习助手';h.style.cssText='font-size:22px;color:#334155;margin:0 0 96px';document.body.append(h);
  const grid=document.createElement('main');grid.style.cssText='display:grid;grid-template-columns:repeat(3,360px);gap:28px';
  for(const p of previews){p.style.cssText='position:relative;width:360px;text-align:left';p.querySelector('.xxt-body').style.maxHeight='none';grid.append(p);}document.body.append(grid);
 });
 await page.screenshot({path:resolve(root,'docs/themes-preview.png'),fullPage:true});
 // Small viewport remains usable without horizontal overflow.
 await page.setViewportSize({width:360,height:800});await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=skin-fixture');await page.addScriptTag({content:bundle});
 assert(await panel.evaluate(el=>el.getBoundingClientRect().right<=innerWidth&&el.getBoundingClientRect().left>=0));
 await panel.locator('[data-skin-choice=default]').click();await panel.locator('.xxt-fold').click();assert.equal(await panel.locator('.xxt-body').isVisible(),false);await panel.locator('.xxt-fold').click();
 await writeFile(resolve(temp,'observations.json'),JSON.stringify({skins:observed,persistence:true,feedback:true,noModelCalls:true,noExternalImages:true,reducedMotion:true,narrowViewport:true},null,2));
 console.log('Theme UI passed: short titles, three palettes/mascots, saved selection, collapsed feedback, no external image/model requests, reduced motion and narrow viewport.');
}finally{await browser.close();}
