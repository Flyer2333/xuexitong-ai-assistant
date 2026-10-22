import {chromium} from './browser-runtime.mjs';
import {resolve} from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),out=root+'/output/playwright/local-feedback';await fs.mkdir(out,{recursive:true});
const html=(await fs.readFile(root+'/tests/ui-preview.html','utf8')).replace('<script src="/dist/xuexitong-ai-assistant.user.js"></script>',''),bundle=await fs.readFile(root+'/dist/xuexitong-ai-assistant.user.js','utf8');
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const width of [1100,360]){
  const page=await browser.newPage({viewport:{width,height:900},timezoneId:'Asia/Shanghai'});await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}));
  await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?data=one');
  await page.evaluate(()=>{
   const c={provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',model:'',key:'a'.repeat(64),vision:true,maxTokens:8192,jsonMode:false,reasoning:''};
   __gm['xxt-ui-preference']='default';__gm['xxt-ai-config']={...c,vision:false};__gm['xxt-ai-vision-config']=c;__gm['xxt-ai-vision-enabled']=true;__gm['xxt-ai-profiles']=[{id:'fixture-codex',config:c,createdAt:Date.now(),lastUsedAt:null}];
   window.__mode='ok';window.__abortCount=0;
   GM_xmlhttpRequest=spec=>{
    __requests.push({url:spec.url,method:spec.method,body:spec.data});let cancelled=false;
    const timer=setTimeout(()=>{
     if(cancelled)return;
     if(spec.url.endsWith('/health')){spec.onload({status:200,responseText:JSON.stringify({ok:true,version:'0.2.0',model:'gpt-6-luna',reasoningEffort:'low'})});return;}
     if(spec.url.endsWith('/solve')){
      const body=JSON.parse(spec.data),q=body.questions[0],image=q.id==='image-probe';
      if(__mode==='hang-text'&&!image||__mode==='hang-image'&&image)return;
      const numbers=q.text.match(/计算 (\d+) \+ (\d+)/);
      let text=image?__testCode:String(Number(numbers[1])+Number(numbers[2]));
      if(__mode==='wrong-image'&&image||__mode==='wrong-text'&&!image)text='incorrect';
      spec.onload({status:200,responseText:JSON.stringify({answers:[{id:q.id,choices:[],texts:[text],readable:true,confidence:1,explanation:'fixture only'}]})});return;
     }
     spec.onload({status:200,responseText:JSON.stringify({version:'1.4.7',date:'2026-10-22',changes:['fixture']})});
    },30);return {abort(){cancelled=true;clearTimeout(timer);__abortCount++;spec.onabort?.();}};
   };
  });
  await page.addScriptTag({content:bundle});await page.emulateMedia({reducedMotion:'reduce'});
  const panel=page.locator('[data-xxt-codex-panel]'),connect=panel.locator('[data-action=connect]'),stop=panel.locator('[data-action=stop]');
  assert.equal(await page.evaluate(()=>__requests.filter(x=>x.url.endsWith('/solve')).length),0);
  await connect.click();let dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.match(await dialog.innerText(),/连接成功，可以开始了/);assert.match(await dialog.innerText(),/文字 · GPT · 测试通过/);assert.match(await dialog.innerText(),/图片 · GPT · 测试通过/);
  assert(!(await dialog.innerText()).includes('尚未验证'));assert(!(await dialog.innerText()).includes('更新本地服务'));assert.match(await dialog.innerText(),/gpt-6-luna · low/);
  assert.equal(await dialog.locator('.xxt-result-art svg').count(),2);assert.equal(await panel.getAttribute('data-skin'),'ai-openai');assert.equal(await page.evaluate(()=>__gm['xxt-ui-preference']),'auto');
  assert.equal(await page.evaluate(()=>__requests.filter(x=>x.url.endsWith('/health')).length),1);assert.equal(await page.evaluate(()=>__requests.filter(x=>x.url.endsWith('/solve')).length),2);assert.equal(await page.evaluate(()=>__requests.filter(x=>x.url.endsWith('/image-test')).length),0);
  assert(await connect.isEnabled());await page.screenshot({path:out+`/one-click-${width}.png`});await dialog.getByRole('button',{name:'知道了',exact:true}).click();
  for(const mode of ['wrong-image','wrong-text']){
   await page.evaluate(m=>{__mode=m;},mode);await connect.click();dialog=page.getByRole('dialog');await dialog.waitFor();
   assert.equal(await dialog.locator('[data-result=success]').count(),1);assert.equal(await dialog.locator('[data-result=failure]').count(),1);assert.match(await dialog.innerText(),mode==='wrong-image'?/图片识别未通过/:/文字测试未通过/);await dialog.getByRole('button',{name:'知道了',exact:true}).click();
  }
  for(const mode of ['hang-text','hang-image']){
   await page.evaluate(m=>{__mode=m;__requests.length=0;},mode);await connect.click();
   await page.waitForFunction(m=>__requests.filter(x=>x.url.endsWith('/solve')).length===(m==='hang-text'?1:2),mode);assert(await connect.isDisabled());const notice=panel.locator('[data-connection-test-wait]');assert(await notice.isVisible());assert.match(await notice.innerText(),/本地 Codex 测试可能需要更长时间，请耐心等待/);assert.match(await notice.innerText(),mode==='hang-text'?/正在验证文字作答/:/文字已通过.*正在验证图片识别/);
   if(mode==='hang-text'){await page.evaluate(()=>{__offset+=65000;});await page.waitForFunction(()=>/已用 6[5-9] 秒/.test(document.querySelector('[data-connection-test-wait]').textContent));assert.equal(await page.getByRole('dialog').count(),0);await page.screenshot({path:out+`/waiting-${width}.png`});}
   await connect.evaluate(b=>b.click());assert.equal(await page.evaluate(()=>__requests.filter(x=>x.url.endsWith('/health')).length),1);
   await stop.click();await page.waitForFunction(()=>!document.querySelector('[data-action=connect]').disabled);assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await notice.count(),0);assert.equal(await page.evaluate(()=>__gm['xxt-image-capability']?.verified),true);
  }
  assert.equal(await page.evaluate(()=>__abortCount),2);
  await page.clock.install({time:new Date('2026-10-22T23:00:00+08:00')});await page.evaluate(()=>{__gm['xxt-quiet-enabled']=true;__requests.length=0;});await connect.click();assert.equal(await page.evaluate(()=>__requests.length),0);assert.equal(await page.getByRole('dialog').count(),0);
  const overflow=await panel.locator('.xxt-body').evaluate(el=>el.scrollWidth-el.clientWidth);assert(overflow<=1);
  results.push({width,oneClickTextAndImage:true,legacySolveCompatible:true,serverModelDisplayed:true,gptTheme:true,partialFailure:true,localWaitVisible:true,elapsedOverMinute:true,progressStages:true,noticeRemovedAfterStop:true,autoThemeFromDefault:true,stopTextAndImage:true,noDuplicateRequests:true,noAutoInferenceOnLoad:true,nightBlocksInference:true,horizontalOverflow:overflow});await page.close();
 }
 const apiThemes=[];
 for(const brand of ['openai','deepseek','claude','gemini','zhipu','kimi','qwen','doubao','xiaomi']){
  const page=await browser.newPage({viewport:{width:1100,height:900}});await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}));await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?brand='+brand+'&data=one');await page.evaluate(()=>{__gm['xxt-ui-preference']='default';});await page.addScriptTag({content:bundle});await page.emulateMedia({reducedMotion:'reduce'});
  const panel=page.locator('[data-xxt-codex-panel]'),connect=panel.locator('[data-action=connect]'),toggle=panel.getByRole('switch');
  for(const initial of ['default','naiwa']){
   if(initial==='naiwa')await panel.locator('[data-skin-choice=naiwa]').click();assert.equal(await panel.getAttribute('data-skin'),initial);
   await connect.click();let dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await panel.getAttribute('data-skin'),'ai-'+brand);assert.equal(await page.locator('[data-connection-test-wait]').count(),0);await dialog.getByRole('button',{name:'知道了',exact:true}).click();
   if(brand==='openai'&&initial==='default'){
    const thumb=panel.locator('.xxt-switch-thumb img');assert.equal(await thumb.getAttribute('data-icon'),'openai');const style=await thumb.evaluate(el=>({filter:getComputedStyle(el).filter,width:getComputedStyle(el).width}));assert.match(style.filter,/brightness\(0\)/);assert.equal(style.width,'13px');await toggle.screenshot({path:out+'/gpt-switch-on.png'});
   }
   await toggle.click();assert.equal(await panel.getAttribute('data-skin'),'default');
  }
  await page.waitForTimeout(100);assert.equal(await panel.getAttribute('data-skin'),'default');
  if(brand==='openai')await toggle.screenshot({path:out+'/gpt-switch-off.png'});
  await page.evaluate(()=>{__fail=true;});await connect.click();const failure=page.getByRole('dialog');await failure.waitFor();assert.equal(await panel.getAttribute('data-skin'),'default');apiThemes.push({brand,autoAfterSuccessFromDefaultAndMascot:true,manualChoiceAfterTestRetained:true,failedTestDoesNotForceTheme:true});await page.close();
 }
 await fs.writeFile(out+'/verification.json',JSON.stringify({scope:'Synthetic GM model answers; old bridge metadata and existing solve contract. No real inference or course submissions.',results,apiThemes},null,2)+'\n');console.log(JSON.stringify({results,apiThemes},null,2));
}finally{await browser.close();}
