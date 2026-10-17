import {fileURLToPath} from 'node:url';
import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
let bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
if (process.argv.includes('--debug')) bundle = bundle
    .replace('function nextStudyStep() {', 'function nextStudyStep() { window.__event?.("steps:"+currentCard+":"+[...stepDone]);')
    .replace('if (task === value) return;', 'if (task === value) return; window.__event?.("task:"+value);');
const temp = fileURLToPath(new URL('../artifacts/page-tasks',import.meta.url));
await mkdir(temp,{recursive:true});
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const wav = Buffer.alloc(44 + 8000 * 2 * 30);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const media = `data:audio/wav;base64,${wav.toString('base64')}`;
const observations = [];
const marker = '<div class="ans-job-icon" aria-label="任务点未完成"></div>';
const videoFrame = (n, cross = false) => `<div class="ans-attach-ct videoContainer" id="ext-gen1050" data-video="${n}">${marker}<iframe class="ans-insertvideo-online" jobid="video-${n}" objectid="object-${n}" src="${cross ? 'https://mooc1-1.chaoxing.com' : ''}/ananas/modules/video/index.html?n=${n}" style="width:850px;height:350px"></iframe></div>`;
async function scenario({ name, mixed = false, lazy = false, unknown = false, lag = false, stop = false, cross = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
    const events = [];
    await context.exposeBinding('__event', (_, value) => events.push(value));
    await context.addInitScript(() => {
        window.unsafeWindow = window; window.__offset = 0;
        const now = Date.now.bind(Date); Date.now = () => now() + window.__offset;
        window.GM_getValue = (key, fallback) => { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); };
        window.GM_setValue = (key, value) => localStorage.setItem(key, JSON.stringify(value));
        GM_setValue('xxt-ai-config',{provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true}); GM_setValue('xxt-quiet-enabled', false); GM_setValue('xxt-codex-token', 'b'.repeat(64));
        window.GM_xmlhttpRequest = config => {
            const payload = config.data && JSON.parse(config.data);
            if (payload) window.__event('model');
            setTimeout(() => config.onload({ status: 200, responseText: JSON.stringify(payload ? { answers: payload.questions.map(q => ({ id: q.id, choices: ['A'], confidence: 1, readable: true, explanation: 'Synthetic' })) } : { ok: true }) }), 30);
            return { abort() {} };
        };
    });
    await context.route('**/*', async route => {
        const u = new URL(route.request().url());
        let body;
        if (u.pathname === '/mycourse/studentstudy') body = `<div class="prev_title">Synthetic multi task chapter</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">second</span></div></div><ul><li id="dct1" cardid="a" class="c1" onclick="changeCard(0)"><div class="prev_white">1 安全知识</div></li><li id="dct2" cardid="b" class="active" onclick="changeCard(1)"><div class="prev_white">2 学习检测</div></li></ul><iframe id="iframe" src="/mooc-ans/knowledge/cards?num=0" style="width:1000px;height:900px"></iframe><button id="next">下一节</button><script>window.changeCard=n=>{__event('card:'+n);document.getElementById('iframe').src='/mooc-ans/knowledge/cards?num='+n};document.getElementById('next').onclick=()=>{__event('next');document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');document.getElementById('iframe').remove()};</script>`;
        else if (u.pathname === '/mooc-ans/knowledge/cards') {
            if (u.searchParams.get('num') === '1') body = '<iframe src="/work?second=1" style="width:850px;height:500px"></iframe>';
            else body = videoFrame(1, cross) + (lazy ? '<div id="late"></div>' : videoFrame(2, cross)) +
                (mixed ? `<div class="ans-attach-ct" data-file>${marker}<button class="file" title="Synthetic.pdf">Synthetic.pdf</button><div id="view"></div></div><div class="ans-attach-ct" data-work>${marker}<iframe src="/work" style="width:850px;height:500px"></iframe></div>` : '') +
                (unknown ? `<div class="ans-attach-ct" data-unknown>${marker}<p>Unsupported required task</p></div>` : '') +
                `<script>window.addEventListener('message',event=>{if(event.data?.testEnd){const n=event.data.testEnd;if(!${lag}||n!==2)document.querySelector('[data-video="'+n+'"]').classList.add('ans-job-finished');if(n===1&&${lazy})setTimeout(()=>{document.getElementById('late').innerHTML=${JSON.stringify(videoFrame(2, cross))}},400)}});
                document.querySelector('.file')?.addEventListener('click',()=>{__event('doc-open');document.getElementById('view').innerHTML='<div role="dialog" class="modal"><button aria-label="关闭">×</button><div class="doc-preview" style="height:260px;overflow:auto"><canvas height="3000"></canvas></div></div>';document.querySelector('.modal button').onclick=()=>{__event('doc-close');document.querySelector('[data-file]').classList.add('ans-job-finished');document.getElementById('view').replaceChildren()}});</script>`;
        } else if (u.pathname.includes('/modules/video/')) body = `<video id="video_html5_api" muted controls style="width:800px;height:300px" ${u.searchParams.get('n') === '1' ? `src="${media}"` : ''}></video><button class="vjs-big-play-button" title="播放视频">播放视频</button><script>const v=document.querySelector('video'),n=${Number(u.searchParams.get('n'))};document.querySelector('button').onclick=()=>{if(!v.src)v.src=${JSON.stringify(media)};v.play();};v.addEventListener('play',()=>__event('play:'+n));v.addEventListener('ended',()=>{__event('ended:'+n);window.parent.postMessage({testEnd:n},'*')});</script>`;
        else if (u.pathname === '/work') body = `<div class="TiMu"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span>${u.searchParams.has('second') ? 'Second card' : 'Inline card'} 1+1?</div><ul class="Zy_ulTop"><li><span class="num_option choice1">A</span><a class="after">2</a></li><li><span class="num_option choice1">B</span><a class="after">3</a></li></ul></div><a class="btnSubmit workBtnIndex">提交</a><script>document.querySelectorAll('.num_option').forEach(x=>x.onclick=()=>x.classList.add('check_answer'));document.querySelector('.btnSubmit').onclick=()=>{__event('submit');window.frameElement.closest('.ans-attach-ct')?.classList.add('ans-job-finished');document.body.innerHTML='<p>满分:100</p><p>最终成绩100分</p>'};</script>`;
        else return route.fulfill({ body: '' });
        await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><style>body{margin:8px}iframe{border:0}li[cardid]{display:inline-block;margin:10px}</style>${body}<script>${bundle.replaceAll('</script', '<\\/script')}\nwindow.html2canvas=async()=>({toDataURL:()=> 'data:image/png;base64,iVBORw0KGgo='});</script>` });
    });
    const page = await context.newPage();
    try {
        await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=synthetic');
        await page.locator('[data-action="start"]').click();
        const first = page.frames().find(frame => frame.url().includes('/modules/video/') && frame.url().includes('n=1'));
        await first.waitForFunction(() => !document.querySelector('video').paused);
        assert(!events.includes('model')); assert(!events.includes('card:1'));
        await first.evaluate(() => { const v = document.querySelector('video'); v.currentTime = v.duration - 0.05; });
        await page.waitForFunction(() => [...document.querySelectorAll('iframe')].length > 0);
        let second;
        for (let n = 0; n < 40 && !second; n++) { second = page.frames().find(frame => frame.url().includes('/modules/video/') && frame.url().includes('n=2')); if (!second) await page.waitForTimeout(100); }
        assert(second, 'A late second iframe must still be found.');
        await second.waitForFunction(() => !document.querySelector('video').paused && document.querySelector('video').duration > 0, null, { timeout: 10000 });
        assert(!events.includes('model'), 'Inline quiz cannot start after only the first video.');
        assert(!events.includes('doc-open')); assert(!events.includes('card:1')); assert(!events.includes('next'));
        if (stop) {
            await page.locator('[data-action="stop"]').click();
            await second.waitForFunction(() => document.querySelector('video').paused);
            observations.push({ name, events }); return;
        }
        await second.evaluate(() => { const v = document.querySelector('video'); v.currentTime = v.duration - 0.05; });
        await second.waitForFunction(() => document.querySelector('video').ended);
        if (lag) {
            await page.waitForTimeout(2500); assert(!events.includes('model')); assert(!events.includes('card:1'));
            await page.frameLocator('#iframe').locator('[data-video="2"]').evaluate(el => el.classList.add('ans-job-finished'));
        }
        if (unknown) {
            for (const frame of page.frames()) await frame.evaluate(() => { window.__offset += 23000; });
            await page.waitForFunction(() => /已暂停/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
            assert(!events.includes('card:1')); assert(!events.includes('next'));
            observations.push({ name, events }); return;
        }
        if (mixed) {
            await page.waitForFunction(() => /文献已打开/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent), null, { timeout: 10000 });
            assert(!events.includes('model')); assert(!events.includes('card:1'));
            await page.waitForTimeout(250);
            for (const frame of page.frames()) await frame.evaluate(() => { window.__offset += 58500; });
            await page.waitForTimeout(300); assert(!events.includes('doc-close'));
            for (const frame of page.frames()) await frame.evaluate(() => { window.__offset += 3000; });
        }
        await page.waitForFunction(() => document.querySelectorAll('#coursetree .posCatalog_select')[1].classList.contains('posCatalog_active'), null, { timeout: 20000 });
        assert.equal(events.filter(x => x === 'next').length, 1);
        assert.equal(events.filter(x => x === 'model').length, mixed ? 2 : 1, 'Each quiz page needs its own result, even with repeated question IDs.');
        assert(events.indexOf('ended:2') < events.indexOf('card:1'));
        if (mixed) { assert(events.indexOf('doc-close') < events.indexOf('model')); assert.equal(events.filter(x => x === 'submit').length, 2); }
        observations.push({ name, events });
    } catch (error) {
        console.error(name, JSON.stringify(events));
        console.error(await page.locator('[data-xxt-codex-panel] pre').textContent().catch(() => 'No panel'));
        throw error;
    } finally { await context.close(); }
}
try {
    await scenario({ name: 'two-video-before-separate-check' });
    if (process.argv.includes('--first-only')) { console.log(JSON.stringify(observations)); process.exitCode = 0; }
    else {
    await scenario({ name: 'videos-document-inline-quiz-and-another-check', mixed: true });
    await scenario({ name: 'late-second-video', lazy: true });
    await scenario({ name: 'platform-marker-delay', lag: true });
    await scenario({ name: 'unsupported-required-task-pauses', unknown: true });
    await scenario({ name: 'stop-during-second-video', stop: true });
    await scenario({ name: 'two-cross-origin-video-workers', cross: true });
    }
    await writeFile(`${temp}/observations.json`, JSON.stringify(observations, null, 2));
    console.log(`${observations.length} page-task workflows passed: all media, mixed document/check, separate cards, late media, platform completion barrier, unsupported-task stop, manual stop. Actual HTMLMediaElement events; synthetic site/model/clock.`);
} finally { await browser.close(); }
