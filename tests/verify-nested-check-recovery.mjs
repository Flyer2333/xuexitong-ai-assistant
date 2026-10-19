import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const legacy=false;
const bundle=await readFile(new URL('../dist/xuexitong-ai-assistant.user.js',import.meta.url),'utf8');
const temp=fileURLToPath(new URL('../artifacts/nested-check-recovery',import.meta.url));await mkdir(temp,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),observations=[];
async function scenario(mode='persistent',generic=false) {
    const context=await browser.newContext({viewport:{width:1400,height:1100}}),events=[];
    await context.exposeBinding('__record',(_,event)=>events.push(event));
    await context.addInitScript(()=>{
        window.unsafeWindow=window;
        window.GM_getValue=(key,fallback)=>{const value=localStorage.getItem(key);return value===null?fallback:JSON.parse(value)};
        window.GM_setValue=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
        GM_setValue('xxt-ai-config',{provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true});GM_setValue('xxt-codex-token','b'.repeat(64));GM_setValue('xxt-quiet-enabled',false);
        window.GM_xmlhttpRequest=c=>{const payload=c.data&&JSON.parse(c.data);__record(payload?'model':'probe');
            setTimeout(()=>c.onload({status:200,responseText:JSON.stringify(payload?{answers:payload.questions.map(q=>({id:q.id,choices:['A'],readable:true,confidence:1,explanation:'Synthetic.'}))}:{ok:true})}),20);
            return {abort(){c.onabort?.()}};
        };
    });
    await context.route('**/*',async route=>{
        const url=new URL(route.request().url());let html;
        if(url.pathname==='/mycourse/studentstudy')html=`<div class="prev_title">Fixture</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">next</span></div></div><li id="dct1" cardid="knowledge" onclick="changeCard(0)"><span class="prev_white">安全知识</span></li><li id="dct2" cardid="check" onclick="changeCard(1)"><span class="prev_white">学习检测</span></li><iframe id="iframe" src="/mooc-ans/knowledge/cards?num=0" style="width:1000px;height:1600px"></iframe><button id="next" ${mode==='manual'?'disabled':''}>下一节</button><script>window.changeCard=n=>{document.querySelector('#iframe').src='/mooc-ans/knowledge/cards?num='+n};document.querySelector('#next').onclick=()=>{__record('navigation-prompt');const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.innerHTML='<p>当前章节还有任务点未完成，是否去完成？</p><button>去学习</button><button class="confirm-next">下一节</button>';document.body.append(dialog);dialog.querySelector('.confirm-next').onclick=()=>{__record('confirm-next');document.querySelectorAll('.posCatalog_select')[0].classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');dialog.remove();document.querySelector('#iframe').remove()}}</script>`;
        else if(url.pathname==='/mooc-ans/knowledge/cards'&&url.searchParams.get('num')==='0')html='<p>Knowledge content without required tasks</p>';
        else if(url.pathname==='/mooc-ans/knowledge/cards')html=`<div class="ans-attach-ct"><span class="ans-job-icon" aria-label="任务点未完成"></span><iframe src="${generic?'/assessment-loader':'/ananas/modules/work/index.html'}" style="width:950px;height:1500px"></iframe></div>`;
        else if(['/ananas/modules/work/index.html','/assessment-loader'].includes(url.pathname))html='<iframe src="/mooc-ans/work/doHomeWorkNew" style="width:900px;height:1400px"></iframe>';
        else if(url.pathname==='/mooc-ans/work/doHomeWorkNew')html=`<h3>Fixture chapter check</h3><p>题量:5 满分:100.0</p>${Array.from({length:5},(_,i)=>`<div class="TiMu newTiMu"><div class="Zy_TItle"><span class="newZy_TItle">【${i<2?'多选题':'判断题'}】</span><span class="font-cxsecret fontLabel">Synthetic question ${i+1}?</span></div><ul class="Zy_ulTop" ${i<2?'aria-hidden="true"':''}>${['A','B'].map(key=>`<li><span class="num_option_dx choice${i+1}">${key}</span><a class="after">${key==='A'?'对':'错'}</a></li>`).join('')}</ul></div>`).join('')}<a class="btnSubmit workBtnIndex">提交</a><script>document.querySelectorAll('.num_option_dx').forEach(e=>e.onclick=()=>e.classList.add('check_answer'));document.querySelector('.btnSubmit').onclick=()=>{__record('submit');window.parent.frameElement.closest('.ans-attach-ct').classList.add('ans-job-finished');window.top.document.querySelector('#next').disabled=false;document.body.innerHTML='<p>满分:100</p><p>最终成绩100分</p>'}</script>`;
        else return route.fulfill({body:''});
        // The legacy probe starts at the user's already-open check. The current
        // scenarios also exercise the preceding knowledge-to-check transition.
        if(legacy&&url.pathname==='/mycourse/studentstudy')html=html.replace('id="iframe" src="/mooc-ans/knowledge/cards?num=0"','id="iframe" src="/mooc-ans/knowledge/cards?num=1"');
        if(url.pathname==='/mycourse/studentstudy')html+=`<script>const unfinishedClick=document.querySelector('#next').onclick;document.querySelector('#next').onclick=()=>{if(!document.querySelector('#iframe').contentDocument.querySelector('.ans-job-finished'))return unfinishedClick();__record('next');document.querySelectorAll('.posCatalog_select')[0].classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');document.querySelector('#iframe').remove()}</script>`;
        await route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html>${html}<script>${bundle.replaceAll('</script','<\\/script')}\nwindow.html2canvas=async()=>{const n=GM_getValue('fixture:capture',0)+1;GM_setValue('fixture:capture',n);__record('capture:'+n);if(!${generic}&&GM_getValue('fixture:fail',true)&&(${JSON.stringify(mode)}!=='transient'||n===1))throw new Error('题目图片准备超时');return {toDataURL:()=> 'data:image/png;base64,iVBORw0KGgo='}}</script>`});
    });
    const page=await context.newPage();
    try {
        await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=fixture');
        await page.locator('[data-action=start]').click();
        if(legacy) {
            await page.waitForFunction(()=>/平台仍有任务点未完成/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
            assert(!events.includes('model'));assert(!events.includes('navigation-prompt'));assert.equal(events.filter(x=>x==='probe').length,1);
        } else {
            if(mode==='manual') {
                await page.waitForFunction(()=>/下一节按钮不可用/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent),null,{timeout:12000});
                assert(!events.includes('model'));
                await page.evaluate(()=>localStorage.setItem('fixture:fail','false'));
                await page.locator('[data-action=start]').click();
            }
            await page.waitForFunction(()=>document.querySelectorAll('.posCatalog_select')[1].classList.contains('posCatalog_active'),null,{timeout:12000}).catch(async error=>{console.error({mode,generic,events,status:await page.locator('[data-xxt-codex-panel] pre').textContent()});throw error});
            assert.equal(events.filter(x=>x==='navigation-prompt').length,mode==='persistent'?1:0);
            assert.equal(events.filter(x=>x==='confirm-next').length,mode==='persistent'?1:0);
            assert.equal(events.filter(x=>x==='probe').length,generic?0:1);
            assert.equal(events.filter(x=>x==='model').length,mode==='persistent'&&!generic?0:1);
            assert.equal(events.filter(x=>x==='submit').length,mode==='persistent'&&!generic?0:1);
        }
        const logs=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('xxt-skipped:')).flatMap(k=>JSON.parse(localStorage.getItem(k))));
        assert.equal(logs.length,mode==='persistent'||mode==='manual'?1:0);
        const status=await page.locator('[data-xxt-codex-panel] pre').textContent();
        observations.push({mode,generic,events,status,logs:logs.map(x=>({reason:x.reason}))});
    } finally {await context.close()}
}
try {
    await scenario();
    if(!legacy){await scenario('transient');await scenario('manual');await scenario('normal',true)}
    await writeFile(`${temp}/${legacy?'legacy':'fixed'}.json`,JSON.stringify(observations,null,2));
    console.log(legacy?'0.3.22 nested failed-check stall reproduced after one recovery probe.':`${observations.length} nested-check recovery scenarios passed. Synthetic site/capture/model; actual nested layout shape.`);
} finally {await browser.close()}
