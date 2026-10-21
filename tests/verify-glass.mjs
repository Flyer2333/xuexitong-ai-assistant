import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from './browser-runtime.mjs';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/glass-1.4.1');await mkdir(out,{recursive:true});await mkdir(resolve(root,'docs/themes'),{recursive:true});
const html=(await readFile(resolve(root,'tests/ui-preview.html'),'utf8')).replace('<script src="/dist/xuexitong-ai-assistant.user.js"></script>','');
const bundle=await readFile(resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});const observations=[];
async function open(data='demo',brand='deepseek',width=1100,height=1000){const p=await browser.newPage({viewport:{width,height}});await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));await p.goto(`https://mooc1.chaoxing.com/mycourse/studentstudy?data=${data}&brand=${brand}`);await p.addScriptTag({content:bundle});return p;}
async function bounds(p,label){const b=await p.evaluate(()=>{const panel=document.querySelector('[data-xxt-codex-panel]'),body=panel.querySelector('.xxt-body'),s=panel.querySelector('.xxt-shell').getBoundingClientRect();return{left:s.left,right:s.right,top:s.top,bottom:s.bottom,width:innerWidth,height:innerHeight,overflow:body.scrollWidth-body.clientWidth,scroll:body.scrollHeight>body.clientHeight};});assert(b.left>=0&&b.right<=b.width+1,`${label}: panel outside viewport ${JSON.stringify(b)}`);assert(b.bottom<=b.height+1,`${label}: clipped vertical viewport`);assert(b.overflow<=1,`${label}: horizontal overflow`);observations.push({label,...b});}
try{
 const p=await open();const panel=p.locator('[data-xxt-codex-panel]');
 assert.equal(await panel.locator('.xxt-head strong').textContent(),'学习助手');assert.equal(await panel.locator('.xxt-brand').textContent(),'AI');
 assert.equal(await p.locator('[data-setting=vision-enabled],[data-setting=ai-routing],[data-setting=test-motion]').count(),0);
 await p.locator('[data-saved-profiles] summary').click();
 const role=(id,kind)=>p.locator(`[data-profile-id="fixture-${id}"][data-purpose=${kind}]`);
 assert.equal(await role(1,'text').getAttribute('aria-pressed'),'true');await role(2,'image').click();assert.equal(await role(2,'image').getAttribute('aria-pressed'),'true');
 await role(2,'text').click();assert.equal(await role(1,'text').getAttribute('aria-pressed'),'false');assert.equal(await role(2,'text').getAttribute('aria-pressed'),'true');assert.equal(await role(2,'image').getAttribute('aria-pressed'),'true');
 await role(1,'image').click();assert.equal(await role(2,'image').getAttribute('aria-pressed'),'false');assert.equal(await role(2,'text').getAttribute('aria-pressed'),'true');
 await role(1,'text').click();await p.locator('[data-action=connect]').click();await p.getByRole('dialog').waitFor();assert.equal(await p.locator('[data-test-role]').count(),2);assert.equal(await p.locator('[data-result=failure]').count(),0);assert.equal(await panel.getAttribute('data-skin'),'ai-deepseek');await p.getByRole('dialog').getByRole('button',{name:'知道了',exact:true}).click();
 await panel.locator('[role=switch]').click();assert.equal(await panel.getAttribute('data-skin'),'default');assert.equal(await panel.locator('.xxt-head strong').textContent(),'学习助手');assert.equal(await panel.locator('.xxt-brand').textContent(),'AI');await panel.locator('[role=switch]').click();assert.equal(await panel.getAttribute('data-skin'),'ai-deepseek');
 await p.locator('[data-skin-choice=nailoong]').click();assert.equal(await p.locator('[data-skin-choice=nailoong]').getAttribute('aria-pressed'),'true');await p.locator('[data-skin-choice=nailoong]').click();assert.equal(await panel.getAttribute('data-skin'),'default');
 // A nonvisual catalog model requires an explicit confirmation, with Escape retaining the old assignment.
 await p.evaluate(()=>{const c={...__gm['xxt-ai-config'],model:'deepseek-v4-pro',key:'fixture-key-nonvisual'};__gm['xxt-ai-profiles'].push({id:'nonvisual',config:c,createdAt:Date.now()});document.dispatchEvent(new Event('xxt-profiles-changed'));});
 const nv=p.locator('[data-profile-id=nonvisual][data-purpose=image]');await nv.click();await p.getByRole('dialog',{name:'确认图片用途'}).waitFor();await p.keyboard.press('Escape');assert.equal(await nv.getAttribute('aria-pressed'),'false');await nv.click();await p.getByRole('button',{name:'仍用于图片',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-profile-id=nonvisual][data-purpose=image]').getAttribute('aria-pressed')==='true');assert.equal(await nv.getAttribute('aria-pressed'),'true');assert.equal(await role(1,'image').getAttribute('aria-pressed'),'false');
 await role(1,'image').click();await p.evaluate(()=>window.__wrong=true);await p.locator('[data-action=connect]').click();await p.getByRole('dialog').waitFor();assert.equal(await p.locator('[data-test-role="图片"][data-result=failure]').count(),1);assert.match(await p.getByRole('dialog').textContent(),/图片识别未通过/);await p.keyboard.press('Escape');
 await p.evaluate(()=>{window.__wrong=false;window.__fail=true;});await p.locator('[data-action=connect]').click();await p.getByRole('dialog').waitFor();assert.match(await p.getByRole('dialog').textContent(),/模型 ID 不存在或不可用/);assert(!(await p.getByRole('dialog').textContent()).includes('fixture'));await p.keyboard.press('Escape');
 assert(await p.locator('[data-purpose-feedback]').textContent());await p.close();
 for(const data of ['demo','worst','empty','one','30'])for(const width of [320,1100,1920]){
  const p=await open(data,'deepseek',width,950);await p.locator('[data-saved-profiles] summary').click();await bounds(p,`${data}-${width}`);if(width===320&&['demo','worst'].includes(data))await p.screenshot({path:resolve(out,`${data}-320.png`)});await p.close();
 }
 for(const skin of ['nailoong','naiwa']){const p=await open();await p.locator(`[data-skin-choice=${skin}]`).click();const title=skin==='nailoong'?'奶龙·学习助手':'奶蛙·学习助手';assert.equal(await p.locator('.xxt-head strong').textContent(),title);assert.equal(await p.locator('.xxt-brand').textContent(),'AI');const a=await p.locator('.xxt-theme-mascot').boundingBox(),b=await p.locator('.xxt-fold').boundingBox();assert(a.x+a.width<b.x,'Character must leave a separate fold-button lane');assert.equal(await p.locator('.xxt-theme-mascot').evaluate(el=>getComputedStyle(el).filter),'none');await p.locator('.xxt-fold').click();assert(await p.locator('.xxt-body').isHidden());await p.locator('.xxt-fold').click();const r=await p.locator('[data-xxt-codex-panel]').boundingBox();await p.screenshot({path:resolve(out,skin+'.png'),clip:{x:r.x,y:Math.max(0,r.y-80),width:r.width,height:Math.min(1000-Math.max(0,r.y-80),r.height+80)}});await p.close();}
 const zoom=await open('worst','deepseek',550,475);await zoom.locator('[data-saved-profiles] summary').click();await zoom.evaluate(()=>document.documentElement.style.fontSize='200%');await bounds(zoom,'200-percent-equivalent-viewport');await zoom.screenshot({path:resolve(out,'worst-zoom.png')});await zoom.close();
 for(const brand of ['deepseek','openai','claude','gemini','zhipu','kimi','qwen','doubao','xiaomi']){
  const p=await open('one',brand);await p.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});
  await p.locator('[data-action=connect]').click();await p.getByRole('dialog').waitFor();await p.keyboard.press('Escape');
  const panel=p.locator('[data-xxt-codex-panel]');assert.equal(await panel.getAttribute('data-skin'),'ai-'+brand);assert.equal(await p.locator('.xxt-brand img').count(),1);assert.equal(await p.locator('.xxt-theme-mascot svg clipPath').count(),1);assert((await p.locator('.xxt-theme-mascot').boundingBox()).height>=160);
  const gap=await panel.evaluate(el=>{const body=el.querySelector('.xxt-body'),actions=el.querySelector('.xxt-actions');return actions.getBoundingClientRect().top-body.getBoundingClientRect().top;});assert(gap<=20,'No portrait spacer may push action buttons down');
  await p.mouse.click(30,30);await p.addStyleTag({content:'main,nav{visibility:hidden!important}'});await panel.evaluate(el=>{el.style.top='112px';el.style.bottom='auto';el.style.left='720px';el.style.right='auto';});
  await p.screenshot({path:resolve(out,brand+'.png'),clip:{x:708,y:12,width:384,height:972}});
  await p.screenshot({path:resolve(root,'docs/themes',brand+'.png'),clip:{x:708,y:12,width:384,height:972}});
  observations.push({label:'theme-'+brand,documentScreenshot:{width:384,height:972},actionTopGap:gap});await p.close();
 }
 for(const [width,height] of [[1920,1080],[2880,1600],[640,450]])for(const failure of [false,true]){
  const p=await open('one','deepseek',width,height);await p.emulateMedia({reducedMotion:'reduce'});
  await p.addStyleTag({content:'*{margin:0} dialog{position:absolute;inset:auto;left:0;top:0;width:100vw;height:100vh;margin:0}'});
  await p.evaluate(fail=>{window.__fail=fail;__gm['xxt-ai-vision-enabled']=true;__gm['xxt-ai-vision-config']={...__gm['xxt-ai-config'],vision:true};},failure);
  await p.locator('[data-action=connect]').click();const d=p.getByRole('dialog');await d.waitFor();const b=await d.boundingBox();
  assert(Math.abs(b.x+b.width/2-width/2)<2,'Result must be horizontally centered');assert(Math.abs(b.y+b.height/2-height/2)<2,'Result must be vertically centered');
  const style=await d.evaluate(el=>{const b=getComputedStyle(el,'::backdrop');return{bg:b.backgroundColor,blur:b.backdropFilter,text:el.textContent};});assert.equal(style.bg,'rgba(0, 0, 0, 0)');assert.equal(style.blur,'none');assert(!style.text.includes('不保证'));
  if(width===1920)await p.screenshot({path:resolve(out,failure?'result-centered-failure.png':'result-centered-success.png')});
  observations.push({label:`center-${width}-${height}-${failure}`,bounds:b,backdrop:style.bg});await p.keyboard.press('Escape');await p.close();
 }
 const local=await open();await local.locator('[data-ai-settings] summary').click();await local.locator('[data-ai-field=provider]').selectOption('codex');assert.match(await local.locator('[data-ai-field=key]').getAttribute('placeholder'),/本地.*连接码/);assert.match(await local.locator('[data-ai-key-help]').textContent(),/package.json/);assert.match(await local.locator('[data-ai-key-help]').textContent(),/bridge-token.txt/);assert.match(await local.locator('[data-ai-key-help] a').first().getAttribute('href'),/archive\/refs\/heads\/main.zip$/);await local.locator('[data-ai-field=provider]').selectOption('deepseek');assert(await local.locator('[data-ai-key-help]').isHidden());await local.close();
 await writeFile(resolve(out,'observations.json'),JSON.stringify({scope:'Synthetic GM transport; no real API, credentials or course submissions',observations},null,2));console.log('Glass UI: unique/dual roles, nonvisual confirmation, test success/failure, exclusive skins, nine brands, 15 layout datasets and 200% equivalent viewport passed.');
}finally{await browser.close();}

