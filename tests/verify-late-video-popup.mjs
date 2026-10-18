import {fileURLToPath} from 'node:url';
import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
const captured = await readFile(new URL('./fixtures/late-video-popup.html', import.meta.url), 'utf8');
const temp = fileURLToPath(new URL('../artifacts/late-video-popup',import.meta.url)); await mkdir(temp, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const wav = Buffer.alloc(44 + 8000 * 2 * 120);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const media = `data:audio/wav;base64,${wav.toString('base64')}`;
const observations = [];
async function scenario({ reload = false, cross = false, stopped = false, quiet = false, missingParent = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const events = [];
    await context.exposeBinding('__event', (_, value) => events.push(value));
    await context.addInitScript(() => {
        window.unsafeWindow = window;
        window.GM_getValue = (k, f) => { const v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); };
        window.GM_setValue = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        GM_setValue('xxt-ai-config',{provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true}); GM_setValue('xxt-quiet-enabled', false); GM_setValue('xxt-codex-token', 'b'.repeat(64));
        window.GM_xmlhttpRequest = c => { const p = c.data && JSON.parse(c.data); if (p) __event('model');
            const t = setTimeout(() => c.onload({ status: 200, responseText: JSON.stringify(p ? { answers: p.questions.map(q => ({ id: q.id, choices: ['A','B','C','D'], confidence: 1, readable: true, explanation: 'Synthetic candidate.' })) } : { ok: true }) }), 50);
            return { abort() { clearTimeout(t); c.onabort?.(); } }; };
    });
    await context.route('**/*', async route => {
        const u = new URL(route.request().url()); let body;
        if (u.pathname === '/mycourse/studentstudy') body = `<div class="prev_title" title="安全知识">安全知识</div><div id="coursetree"><ul><li><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div></li></ul></div><button class="prev_white" id="check">2 学习检测</button><iframe id="iframe" src="/mooc-ans/knowledge/cards" style="width:1000px;height:1000px"></iframe><script>document.getElementById('check').onclick=()=>__event('check');</script>`;
        else if (u.pathname === '/mooc-ans/knowledge/cards') body = [1,2,3,4].map(n => `<div class="ans-attach-ct videoContainer ${n<3?'ans-job-finished':''}" data-n="${n}"><span class="ans-job-icon" aria-label="任务点${n<3?'已':'未'}完成"></span><iframe class="ans-insertvideo-online" objectid="object-${n}" jobid="job-${n}" src="${cross?'https://mooc1-1.chaoxing.com':''}/ananas/modules/video/index.html?n=${n}" style="width:900px;height:550px"></iframe></div>`).join('') + `<script>addEventListener('message', e=>{if(e.data?.completed)document.querySelector('[data-n="'+e.data.completed+'"]').classList.add('ans-job-finished')})</script>`;
        else if (u.pathname.includes('/modules/video/')) body = `<div id="video" class="video-js"><video id="video_html5_api" muted controls src="${media}" style="width:850px;height:300px"></video><main id="overlay"></main></div><script>
            const n=${Number(u.searchParams.get('n'))},v=document.querySelector('video');
            v.addEventListener('play',()=>__event('play:'+n));v.addEventListener('ended',()=>{__event('end:'+n);parent.postMessage({completed:n},'*')});
            window.showPopup=()=>{v.pause();parent.postMessage({completed:n},'*');document.querySelector('#overlay').innerHTML=${JSON.stringify(captured)};
                const p=document.querySelector('.tkTopic');p.querySelectorAll('.spanNot,.spanNotBack,#videoquiz-continue,#knowledgeBack,#viewAnalysis,.tkParsing').forEach(e=>e.style.display='none');
                p.querySelector('#videoquiz-submit').onclick=()=>{__event('submit:'+n);p.querySelector('#videoquiz-submit').style.display='none';p.querySelector('#rightNum').textContent='1';p.querySelector('#spanHas').textContent='答对了';p.querySelector('#videoquiz-continue').style.display='inline'};
                p.querySelector('#videoquiz-continue').onclick=()=>{__event('continue:'+n);p.remove()};};
            </script>`;
        else return route.fulfill({ body: '' });
        await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html>${body}<script>${bundle.replaceAll('</script','<\\/script')}\nwindow.html2canvas=async()=>({toDataURL:()=> 'data:image/png;base64,iVBORw0KGgo='});</script>` });
    });
    const page = await context.newPage();
    try {
        await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=late');
        await page.locator('[data-action="start"]').click();
        let third = page.frames().find(f => f.url().includes('n=3'));
        await third.waitForFunction(() => !document.querySelector('video').paused, null, { timeout: 10000 });
        if (stopped) await page.locator('[data-action="stop"]').click();
        if (reload) { await page.reload(); third = page.frames().find(f => f.url().includes('n=3')); }
        // Deliberately fail only the parent scan: the child's independently
        // observed DOM heartbeat must acquire one lease, even on the same origin.
        if (missingParent) await page.evaluate(() => { XxtVideoQuiz.across = () => []; });
        if (quiet) for (const f of page.frames()) await f.evaluate(() => { GM_setValue('xxt-quiet-enabled', true); XxtCodexCore.quietHoursAt = () => true; });
        await third.evaluate(() => showPopup());
        if (stopped || quiet) {
            await page.waitForTimeout(1800); assert(!events.some(x => x.startsWith('submit:')));
        } else {
            await third.waitForFunction(() => !document.querySelector('.tkTopic'), null, { timeout: 10000, polling: 50 });
            assert.equal(events.filter(x=>x==='submit:3').length,1); assert.equal(events.filter(x=>x==='continue:3').length,1);
            assert(!events.includes('check')); assert(!events.includes('play:4'), 'Fourth video must not start before third has ended.');
            await third.waitForFunction(() => !document.querySelector('video').paused, null, { timeout: 4000 });
            await third.evaluate(()=>{const v=document.querySelector('video');v.currentTime=v.duration-0.03});
            const fourth=page.frames().find(f=>f.url().includes('n=4'));
            await fourth.waitForFunction(()=>!document.querySelector('video').paused,null,{timeout:8000});
            await fourth.evaluate(()=>showPopup());
            await fourth.waitForFunction(()=>!document.querySelector('.tkTopic'),null,{timeout:10000,polling:50});
            assert.equal(events.filter(x=>x==='submit:4').length,1);assert.equal(events.filter(x=>x==='continue:4').length,1);
            assert(!events.includes('check'),'Video popups do not replace the chapter check.');
            await fourth.evaluate(()=>{const v=document.querySelector('video');v.currentTime=v.duration-0.03});
            await page.waitForFunction(()=>document.querySelector('[data-xxt-codex-panel] pre')?.textContent.includes('学习检测'),null,{timeout:10000});
            assert.equal(events.filter(x=>x==='check').length,1);
        }
        observations.push({ reload, cross, stopped, quiet, missingParent, events });
    } catch (error) { console.error(JSON.stringify({reload,cross,stopped,quiet,events,status:await page.locator('[data-xxt-codex-panel] pre').textContent()})); throw error; }
    finally { await context.close(); }
}
async function isolation() {
    const context = await browser.newContext(), page = await context.newPage();
    await page.route('**/*', r=>r.fulfill({contentType:'text/html',body:new URL(r.request().url()).pathname==='/isolation' ? '<!doctype html><body><iframe id="a" src="/a"></iframe><iframe id="b" src="/b"></iframe></body>' : '<!doctype html><body></body>'}));
    await page.goto('https://mooc1.chaoxing.com/isolation');
    await page.addScriptTag({content:await readFile(new URL('../src/dom.js',import.meta.url),'utf8')});
    await page.addScriptTag({content:await readFile(new URL('../src/video-quiz.js',import.meta.url),'utf8')});
    const result = await page.evaluate(html=>{
        const a=document.querySelector('#a').contentDocument,b=document.querySelector('#b').contentDocument;
        for(const doc of [a,b])doc.body.innerHTML='<video></video>'+html;
        const old=XxtVideoQuiz.find(a);
        old.getClientRects=()=>{throw new Error('Synthetic retired document layout failure')};
        const sibling=!!XxtVideoQuiz.find(b);
        document.body.insertAdjacentHTML('afterbegin','<video></video>'+html);
        document.querySelector('.tkTopic').getClientRects=()=>{throw new Error('Synthetic local layout failure')};
        return {sibling,descendants:XxtVideoQuiz.across(window).length};
    },captured);
    assert(result.sibling);assert.equal(result.descendants,1);
    observations.push({isolation:result});await context.close();
}
try {
    if (process.argv.includes('--isolation-only')) { await isolation(); }
    else {
    await scenario();
    if (!process.argv.includes('--first-only')) { await scenario({ cross:true }); await scenario({reload:true}); await scenario({reload:true,stopped:true}); await scenario({quiet:true}); await scenario({missingParent:true}); await isolation(); }
    }
    await writeFile(`${temp}/observations.json`,JSON.stringify(observations,null,2));
    console.log(`${observations.length} late video popup workflows passed (synthetic media/platform/model only).`);
} finally { await browser.close(); }
