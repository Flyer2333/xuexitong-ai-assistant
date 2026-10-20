import {chromium} from './browser-runtime.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const bundle=await readFile(new URL('../dist/xuexitong-ai-assistant.user.js',import.meta.url),'utf8');
const source=await readFile(new URL('../src/fonts.js',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<div class="TiMu"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span><span class="font-cxsecret">长期吸食K粉的显著特征不包括（）。</span><button>AI讲解<svg></svg></button></div><ul class="Zy_ulTop">${['流清鼻涕','背部和后颈会长出毒疮','精神产生错乱，烦躁不安而易激惹','头发稀疏'].map((s,i)=>`<li><span class="num_option_dx">${'ABCD'[i]}</span><span class="after font-cxsecret">${s}</span></li>`).join('')}</ul></div>`}));
 await page.goto('https://mooc1.chaoxing.com/mooc-ans/work/doHomeWorkNew');await page.evaluate(()=>{window.unsafeWindow=window;window.__gm={'xxt-quiet-enabled':false,'xxt-ai-enabled':true,'xxt-ai-config':{provider:'custom',protocol:'chat',baseUrl:'https://text.example.invalid/v1',model:'text-only',key:'test-text-key',vision:false}};window.__calls=[];window.GM_getValue=(k,d)=>__gm[k]??d;window.GM_setValue=(k,v)=>__gm[k]=structuredClone(v);window.GM_xmlhttpRequest=s=>{__calls.push({url:s.url,body:s.data});setTimeout(()=>s.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify({answers:[{id:'q1',choices:['B'],readable:true,confidence:1,explanation:'synthetic'}]})}}]})}),10);return {abort(){}};};});
 await page.addScriptTag({content:bundle});
 // A decorative AI-help icon sits outside the actual question content; it is not question imagery.
 
 await page.locator('[data-action=solve]').click();await page.waitForFunction(()=>__calls.length===1,null,{timeout:5000}).catch(async e=>{console.log(await page.evaluate(()=>({q:XxtCodexDom.extract(document).map(e=>e.question),status:document.querySelector('pre')?.textContent,calls:__calls})));throw e;});const textCall=await page.evaluate(()=>JSON.parse(__calls[0].body));assert.equal(typeof textCall.messages[0].content,'string');assert(!textCall.messages[0].content.includes('obfuscated":true'));assert(textCall.messages[0].content.includes('头发稀疏'));
 await page.evaluate(()=>{document.querySelector('.after').innerHTML='<img src="data:image/png;base64,AA==">';});const visual=await page.evaluate(()=>XxtCodexDom.extract(document)[0].question);assert(visual.options[0].imageKey,'Actual option image still requires vision');
 // Exercise the font adapter independently with an owned mapping and stub parser, not a claimed real platform font.
 const table=JSON.stringify({'abcd1234':20057}),sha=createHash('sha256').update(table).digest('hex');
 await page.evaluate(({table})=>{document.body.innerHTML='<style>@font-face{font-family:font-cxsecret;src:url("data:font/ttf;base64,AQID")}</style><p class="font-cxsecret" id="marked">甲 A</p>';window.XxtFontDependencies={Typr:{parse:()=>[{}],U:{codeToGlyph:()=>1,glyphToPath:()=>({cmds:['M'],crds:[0,0]})}},md5:()=> '0'.repeat(24)+'abcd1234'};window.GM_xmlhttpRequest=s=>{window.__fontRequest=s;setTimeout(()=>s.onload({status:200,finalUrl:s.url,responseText:table}),0);return{abort(){}};};},{table});
 await page.addScriptTag({content:source.replace('fbc6ae3c795a46ca2bd0994e68e7cb90ca4d9a046f335512657760d9a4fdf875',sha)});
 assert(await page.evaluate(()=>XxtFonts.obfuscated(document.querySelector('#marked'))));await page.evaluate(()=>XxtFonts.prepare(document));
 assert.equal(await page.evaluate(()=>XxtFonts.read(document.querySelector('#marked'))),'乙 A');assert.equal(await page.locator('#marked').textContent(),'甲 A','Never mutate course DOM');assert.equal(await page.evaluate(()=>XxtFonts.obfuscated(document.querySelector('#marked'))),false);
 assert.equal(await page.evaluate(()=>__fontRequest.anonymous),true);assert.equal(await page.evaluate(()=>__fontRequest.headers??null),null);
 await page.evaluate(async()=>{document.querySelector('style').textContent='@font-face{font-family:font-cxsecret;src:url("data:font/ttf;base64,AQIE")}';window.XxtFontDependencies.md5=()=> '0'.repeat(24)+'ffffffff';await XxtFonts.prepare(document);});
 assert(await page.evaluate(()=>XxtFonts.obfuscated(document.querySelector('#marked'))),'Unmapped glyphs must retain visual fallback');
 console.log('Readable font-class text uses a text-only model without images; real option images retain vision routing. Owned synthetic glyph mapping validates restore-before-routing and unchanged course DOM; no real font/course acceptance claimed.');
}finally{await browser.close();}
