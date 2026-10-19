import {chromium} from './browser-runtime.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const bundle=await readFile(new URL('../dist/xuexitong-ai-assistant.user.js',import.meta.url),'utf8');
const errorHtml=await readFile(new URL('./fixtures/video-line-error.html',import.meta.url),'utf8');
const temp=fileURLToPath(new URL('../artifacts/video-line-recovery',import.meta.url));await mkdir(temp,{recursive:true});
const audio=Buffer.alloc(44+8000*30*2);audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(8000,24);audio.writeUInt32LE(16000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(audio.length-44,40);
const browser=await chromium.launch({channel:'chrome',headless:true}),observations=[];
async function scenario(mode,{cross=false}={}) {
    const events=[],context=await browser.newContext({viewport:{width:1400,height:1100}});
    await context.exposeBinding('__record',(_,event)=>events.push(event));
    await context.addInitScript(()=>{
        window.unsafeWindow=window;window.__offset=0;const nativeNow=Date.now.bind(Date);
        Date.now=()=>Date.parse('2026-10-19T04:00:00Z')+(nativeNow()-window.__anchor)+__offset;window.__anchor=nativeNow();
        window.GM_getValue=(k,f)=>{const value=localStorage.getItem(k);return value===null?f:JSON.parse(value)};
        window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));GM_setValue('xxt-ai-config',{provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true});GM_setValue('xxt-codex-token','b'.repeat(64));GM_setValue('xxt-quiet-enabled',true);
        window.GM_xmlhttpRequest=c=>{const payload=c.data&&JSON.parse(c.data);__record(payload?'model':'probe');setTimeout(()=>c.onload({status:200,responseText:JSON.stringify(payload?{answers:payload.questions.map(q=>({id:q.id,choices:['A'],readable:true,confidence:1,explanation:'Synthetic.'}))}:{ok:true})}),20);return{abort(){c.onabort?.()}}};
    });
    await context.route('**/*',async r=>{
        const u=new URL(r.request().url());let html;
        if(u.pathname==='/media') {
            const range=r.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
            if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),audio.length-1):audio.length-1;return r.fulfill({status:206,contentType:'audio/wav',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${audio.length}`},body:audio.subarray(start,end+1)})}
            return r.fulfill({contentType:'audio/wav',headers:{'Accept-Ranges':'bytes'},body:audio});
        }
        if(u.pathname==='/mycourse/studentstudy')html=`<div class="prev_title">Fixture</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">next</span></div></div><li id="dct1" cardid="knowledge" onclick="change(0)"><span class="prev_white">安全知识</span></li><li id="dct2" cardid="check" onclick="change(1)"><span class="prev_white">学习检测</span></li><iframe id="iframe" src="/mooc-ans/knowledge/cards?num=0" style="width:1000px;height:650px"></iframe><button id="next">下一节</button><script>window.change=n=>{__record('card:'+n);document.querySelector('#iframe').src='/mooc-ans/knowledge/cards?num='+n};document.querySelector('#next').onclick=()=>{__record('next');document.querySelectorAll('.posCatalog_select')[0].classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');document.querySelector('#iframe').remove()}</script>`;
        else if(u.pathname==='/mooc-ans/knowledge/cards')html=u.searchParams.get('num')==='0'?`<div class="ans-attach-ct"><span class="ans-job-icon" aria-label="任务点未完成"></span><iframe src="https://${cross?'media':'mooc1'}.chaoxing.com/ananas/modules/video/index.html" style="width:900px;height:550px"></iframe></div><script>window.addEventListener('message',e=>{if(e.data?.fixtureEnd)document.querySelector('.ans-attach-ct').classList.add('ans-job-finished')})</script>`:'<iframe src="/work" style="width:850px;height:500px"></iframe>';
        else if(u.pathname==='/ananas/modules/video/index.html') {
            const panel=mode==='healthy'?'':mode==='disabled'?errorHtml:errorHtml.replace('checked disabled','checked');
            html=`<div class="video-js"><video muted controls src="/media?route=initial" style="width:850px;height:300px"></video><button class="vjs-big-play-button">播放视频</button>${panel}</div><aside><label><input type="radio" name="unrelated" onclick="__record('unrelated')">公网1</label></aside><script>const v=document.querySelector('video');document.querySelector('.vjs-big-play-button').onclick=()=>v.play();v.addEventListener('ended',()=>{__record('ended');window.parent.postMessage({fixtureEnd:true},'*')});document.querySelectorAll('[name="ans-vjserrdisplay-opt"]').forEach((input,index)=>input.onclick=()=>{const n=index+1;__record('line:'+n);const success=${JSON.stringify(mode)}==='first'||n===2&&${JSON.stringify(mode)}!=='exhausted';if(success){const panel=document.querySelector('.vjs-error-display');panel.style.display='none';panel.setAttribute('aria-hidden','true');v.src='/media?route='+n;v.play()}else{input.checked=true;input.disabled=true;v.src='/media?route='+n;v.play()}});</script>`;
        } else if(u.pathname==='/work')html='<div class="TiMu"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span>Fixture?</div><ul class="Zy_ulTop"><li><span class="num_option choice1">A</span><a class="after">yes</a></li><li><span class="num_option choice1">B</span><a class="after">no</a></li></ul></div><a class="btnSubmit workBtnIndex">提交</a><script>document.querySelectorAll(".num_option").forEach(e=>e.onclick=()=>e.classList.add("check_answer"));document.querySelector(".btnSubmit").onclick=()=>{__record("submit");document.body.innerHTML="<p>满分:100</p><p>最终成绩100分</p>"}</script>';
        else return r.fulfill({body:''});
        await r.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html>${html}<script>${bundle.replaceAll('</script','<\\/script')}\nwindow.html2canvas=async()=>({toDataURL:()=> 'data:image/png;base64,iVBORw0KGgo='});</script>`});
    });
    const page=await context.newPage();
    try {
        await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=fixture');await page.locator('[data-action=start]').click();
        const videoFrame=page.frames().find(f=>f.url().includes('/modules/video/'));
        const advance=async ms=>{for(const f of page.frames())await f.evaluate(ms=>window.__offset+=ms,ms)};
        if(mode==='healthy'){await videoFrame.waitForFunction(()=>!document.querySelector('video').paused);await page.locator('[data-action=stop]').click();}
        else {
            await page.waitForFunction(()=>/已选择公网/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
            if(mode==='stop'||mode==='night') {
                if(mode==='stop')await page.locator('[data-action=stop]').click();else await advance(13*60*60*1000);
                await advance(9000);await page.waitForTimeout(1000);
                assert.deepEqual(events.filter(e=>e.startsWith('line:')),['line:1']);assert(!events.includes('probe'));assert(!events.includes('model'));
            } else {
                if(mode==='fallback'||mode==='exhausted'){await advance(9000);await page.waitForFunction(()=>/已选择公网2/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));}
                if(mode==='exhausted') {
                    await advance(9000);await page.waitForFunction(()=>document.querySelectorAll('.posCatalog_select')[1].classList.contains('posCatalog_active'),null,{timeout:12000});
                    assert.equal(events.filter(e=>e==='probe').length,1);
                    assert.deepEqual(events.filter(e=>e.startsWith('line:')),['line:1','line:2']);
                    const logs=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('xxt-skipped:')).flatMap(k=>JSON.parse(localStorage.getItem(k))));assert(logs.some(x=>x.reason.includes('公网1/公网2')));
                } else {
                    await videoFrame.waitForFunction(()=>{const v=document.querySelector('video'),p=document.querySelector('.vjs-error-display');return !v.paused&&v.currentTime>0.1&&(!p||getComputedStyle(p).display==='none')});
                    assert(!events.includes('card:1'));assert(!events.includes('model'));assert(!events.includes('next'));
                    await videoFrame.evaluate(()=>{const v=document.querySelector('video');v.currentTime=v.duration-0.05});
                    await page.waitForFunction(()=>document.querySelectorAll('.posCatalog_select')[1].classList.contains('posCatalog_active'),null,{timeout:12000});
                    assert.equal(events.filter(e=>e==='model').length,1);assert.equal(events.filter(e=>e==='submit').length,1);assert(!events.includes('probe'));
                    assert.deepEqual(events.filter(e=>e.startsWith('line:')),mode==='first'?['line:1']:mode==='disabled'?['line:2']:['line:1','line:2']);
                }
            }
        }
        assert(!events.includes('unrelated'));observations.push({mode,cross,events});
    } catch(error){console.error({mode,cross,events,status:await page.locator('[data-xxt-codex-panel] pre').textContent(),media:await Promise.all(page.frames().filter(f=>f.url().includes('/modules/video/')).map(f=>f.evaluate(()=>{const v=document.querySelector('video');return {time:v.currentTime,duration:v.duration,paused:v.paused,ended:v.ended,src:v.currentSrc}})))});throw error}finally{await context.close()}
}
try {
    await scenario('first');await scenario('fallback');await scenario('disabled');await scenario('healthy');await scenario('stop');await scenario('night');await scenario('fallback',{cross:true});await scenario('exhausted');
    await writeFile(`${temp}/observations.json`,JSON.stringify(observations,null,2));console.log('8 video-line workflows passed: ordered fallback, disabled first, real native progress/check handoff, healthy/stop/night protection, cross-origin recovery and exhaustion. Synthetic platform/model/clock.');
}finally{await browser.close()}
