import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const bundle=await readFile(new URL('../dist/xuexitong-ai-assistant.user.js',import.meta.url),'utf8');
const actualQuestion=await readFile(new URL('./fixtures/chapter-check-2026-10-19.html',import.meta.url),'utf8');
const temp=fileURLToPath(new URL('../artifacts/optional-doc-check',import.meta.url));await mkdir(temp,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const observations=[];
async function scenario({kind='inline',required=false,actual=false,optionalFailure=false,samePage=false,mixedFailure=false}={}) {
    const context=await browser.newContext({viewport:{width:1400,height:1100}}),events=[];
    await context.exposeBinding('__record',(_,v)=>events.push(v));
    await context.addInitScript(()=>{
        window.unsafeWindow=window;window.__offset=0;const now=Date.now.bind(Date);Date.now=()=>now()+__offset;
        window.GM_getValue=(k,f)=>{const x=localStorage.getItem(k);return x===null?f:JSON.parse(x)};
        window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
        GM_setValue('xxt-ai-config',{provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true});GM_setValue('xxt-codex-token','b'.repeat(64));GM_setValue('xxt-quiet-enabled',false);
        window.GM_xmlhttpRequest=c=>{const p=c.data&&JSON.parse(c.data);__record(p?'model':'probe');
            setTimeout(()=>c.onload({status:200,responseText:JSON.stringify(p?{answers:p.questions.map(q=>({id:q.id,choices:['A'],readable:true,confidence:1,explanation:'Synthetic.'}))}:{ok:true})}),30);
            return {abort(){c.onabort?.()}}};
    });
    const icon='<span class="ans-job-icon" aria-label="任务点未完成"></span>';
    const quiz=(actual?actualQuestion:`<div class="TiMu"><div class="Zy_TItle"><span class="newZy_TItle">【多选题】</span>Fixture image question?</div><ul class="Zy_ulTop"><li><span class="num_option choice1">A</span><a class="after">Option A</a></li><li><span class="num_option choice1">B</span><a class="after">Option B</a></li></ul></div>`)+`<a class="btnSubmit workBtnIndex">提交</a><script>document.querySelectorAll('.num_option,.num_option_dx').forEach(e=>e.onclick=()=>e.classList.add('check_answer'));document.querySelector('.btnSubmit').onclick=()=>{__record('submit');window.frameElement?.closest('.ans-attach-ct')?.classList.add('ans-job-finished');if(window.parent!==window.top)window.parent.frameElement?.closest('.ans-attach-ct')?.classList.add('ans-job-finished');document.body.innerHTML='<p>满分:100</p><p>最终成绩100分</p>'}</script>`;
    await context.route('**/*',async r=>{
        const u=new URL(r.request().url());let body;
        if(u.pathname==='/mycourse/studentstudy') body=`<div class="prev_title">Fixture</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">next</span></div></div><li id="dct1" cardid="knowledge" onclick="change(0)"><span class="prev_white">安全知识</span></li>${samePage?'':'<li id="dct2" cardid="quiz" onclick="change(1)"><span class="prev_white">学习检测</span></li>'}<iframe id="iframe" src="/mooc-ans/knowledge/cards?num=0" style="width:950px;height:850px"></iframe><button id="next">下一节</button><script>window.change=n=>{__record('card:'+n);document.querySelector('#iframe').src='/mooc-ans/knowledge/cards?num='+n};document.querySelector('#next').onclick=()=>{__record('next');document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');document.querySelector('#iframe').remove()}</script>`;
        else if(u.pathname==='/mooc-ans/knowledge/cards'&&u.searchParams.get('num')==='0') body=`<p>拓展资料</p><div class="ans-attach-ct" data-file>${required?icon:''}<button class="file" title="Extra.pdf">Extra.pdf</button><div id="preview"></div></div><script>document.querySelector('.file').onclick=()=>{__record('open');document.querySelector('#preview').innerHTML='<div role="dialog" class="modal"><button aria-label="关闭">×</button><div class="doc-preview" style="height:220px;overflow:auto"><canvas height="1800"></canvas></div></div>';document.querySelector('.modal button').onclick=()=>{__record('close');document.querySelector('#preview').replaceChildren()}}</script>`;
        else if(u.pathname==='/mooc-ans/knowledge/cards') body=`<div class="ans-attach-ct">${icon}${kind==='inline'?quiz:`<iframe src="${actual?'/ananas/modules/work/index.html':kind==='opaque'?'/assessment-render':'/work'}" jobid="work-fixture" _src="/mooc-ans/api/work" style="width:850px;height:700px"></iframe>`}</div>`;
        else if(u.pathname==='/ananas/modules/work/index.html') body='<iframe src="/mooc-ans/api/work" style="width:820px;height:650px"></iframe>';
        else if(['/work','/assessment-render','/mooc-ans/api/work'].includes(u.pathname)) body=quiz;
        else return r.fulfill({body:''});
        if(mixedFailure&&u.pathname==='/mooc-ans/knowledge/cards'&&u.searchParams.get('num')==='0')body+=`<div class="ans-attach-ct" data-optional><button class="file" title="Optional.pdf">Optional.pdf</button><div id="optional-preview"></div></div><script>document.querySelector('[data-optional] .file').onclick=()=>{__record('open-optional');document.querySelector('#optional-preview').innerHTML='<div role="dialog" class="modal"><button aria-label="关闭">×</button><div class="doc-preview" style="height:220px;overflow:auto"><canvas height="1800"></canvas></div></div>';document.querySelector('#optional-preview button').onclick=()=>{__record('close-optional');document.querySelector('#optional-preview').replaceChildren()}}</script>`;
        if(samePage&&u.pathname==='/mooc-ans/knowledge/cards'&&u.searchParams.get('num')==='0')body+=`<div class="ans-attach-ct">${icon}<iframe src="/work" style="width:850px;height:700px"></iframe></div>`;
        await r.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html>${body}<script>${bundle.replaceAll('</script','<\\/script')}\nwindow.html2canvas=async()=>({toDataURL:()=> 'data:image/png;base64,iVBORw0KGgo='});</script>`});
    });
    const page=await context.newPage();
    try {
        await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=fixture');await page.locator('[data-action=start]').click();
        await page.waitForFunction(()=>/文献已打开/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
        assert(!events.includes('model'));
        if(optionalFailure)await page.evaluate(()=>{XxtCodexDocuments.scroll=async()=>({count:0,unavailable:true,bottom:false});});
        if(mixedFailure)for(const frame of page.frames())await frame.evaluate(()=>{const original=XxtCodexDocuments.scroll;XxtCodexDocuments.scroll=async(...args)=>{if(args[0]?.querySelector?.('[data-file] .modal'))throw new Error('Required preview failed');return original(...args)}});
        for(const f of page.frames())await f.evaluate(()=>window.__offset+=61000);
        if(mixedFailure) {
            // Required file keeps failing; bounded recovery skips only that file,
            // then the separate optional material must still actually be read.
            await page.waitForFunction(()=>/文献已打开：Optional.pdf/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent),null,{timeout:12000}).catch(async error=>{console.error({events,status:await page.locator('[data-xxt-codex-panel] pre').textContent()});throw error});
            for(const f of page.frames())await f.evaluate(()=>window.__offset+=61000);
            await page.waitForFunction(()=>document.querySelectorAll('#coursetree .posCatalog_select')[1].classList.contains('posCatalog_active'),null,{timeout:9000});
            assert(events.includes('open-optional'));assert(events.includes('close-optional'));
            assert.equal(events.filter(x=>x==='probe').length,1);
            assert.equal(events.filter(x=>x==='submit').length,1);
            const logs=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('xxt-skipped:')).flatMap(k=>JSON.parse(localStorage.getItem(k))));
            assert(logs.length>0);assert(logs.every(item=>!item.reason.includes('Optional.pdf')));
        } else if(required) {
            await page.waitForFunction(()=>/正在等待平台确认/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
            assert(!events.includes('card:1'));assert(!events.includes('model'));await page.locator('[data-action=stop]').click();
        } else {
            await page.waitForFunction(()=>document.querySelectorAll('#coursetree .posCatalog_select')[1].classList.contains('posCatalog_active'),null,{timeout:9000}).catch(async error=>{
                console.error({kind,events,status:await page.locator('[data-xxt-codex-panel] pre').textContent()});throw error;
            });
            assert.equal(events.filter(x=>x==='submit').length,1);assert.equal(events.filter(x=>x==='model').length,1);
            assert(!events.includes('probe'),'Optional material and the pending quiz must not trigger recovery.');
            assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('xxt-skipped:')).length),0);
        }
        observations.push({kind,required,actual,optionalFailure,samePage,mixedFailure,events});
    } finally {await context.close()}
}
try {
    if(process.argv.includes('--mixed-only'))await scenario({required:true,mixedFailure:true});
    else {
        await scenario({kind:'inline'});
        if(!process.argv.includes('--first-only')) {await scenario({kind:'opaque'});await scenario({kind:'work'});await scenario({kind:'work',actual:true});await scenario({required:true});await scenario({optionalFailure:true});await scenario({samePage:true});await scenario({required:true,mixedFailure:true});}
    }
    await writeFile(`${temp}/observations.json`,JSON.stringify(observations,null,2));console.log(`${observations.length} optional-document/check ownership workflows passed (synthetic site/model/clock).`);
} finally {await browser.close()}
