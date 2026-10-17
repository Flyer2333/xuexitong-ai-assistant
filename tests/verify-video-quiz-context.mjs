import { resolve } from 'node:path';
import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

let bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
const captured = await readFile(new URL('./fixtures/video-quiz-synthetic.html', import.meta.url), 'utf8');
const style = (await readFile(new URL('./fixtures/video-quiz-layout.html', import.meta.url), 'utf8')).match(/<style>[\s\S]*?<\/style>/)[0];
const legacy = false;
const temp = resolve(import.meta.dirname,'../artifacts/video-quiz-context'); await mkdir(temp, { recursive: true });
const browser = await chromium.launchPersistentContext(`${temp}/profile`, { channel: 'chrome', headless: true, viewport: { width: 1400, height: 1000 }, args: ['--autoplay-policy=no-user-gesture-required'] });
const wav = Buffer.alloc(44 + 8000 * 2 * 120);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const observations = [];
async function scenario({ action = 'scroll-model', cross = true } = {}) {
    const page = await browser.newPage(), seen = { requests: [], submitted: [], continued: 0, view: [] };
    await page.exposeFunction('__record', (kind, data) => { if (kind === 'continued') seen.continued++; else seen[kind].push(data); });
    const popup = style + '<style>.ans-videoquiz-continue,.tkTopic_oper .spanNot,.tkTopic_oper .spanNotBack,.bntWhiteBorder,.tkTopic_oper .spanHref,.tkParsing{display:none}</style>' + `<section class="ans-videoquiz" data-popup>${captured}</section>`;
    const media = `<video id="video_html5_api" muted controls src="data:audio/wav;base64,${wav.toString('base64')}" style="height:180px;width:800px"></video>`;
    const course = '<div class="prev_title" title="安全知识">安全知识</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">second</span></div></div><button class="prev_white">2 学习检测</button>';
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: route.request().url().includes('/video/') ? media + popup :
        course + (cross ? '<iframe id="reader" src="https://mooc1-1.chaoxing.com/ananas/modules/video/context" style="width:950px;height:750px"></iframe>' : media + popup) + '<div style="height:2400px">Below player</div>' }));
    await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=context-fixture');
    const reader = cross ? page.frames().find(f => f.url().includes('/video/')) : page.mainFrame();
    const init = () => {
        window.unsafeWindow = window; window.__gm = { 'xxt-codex-token': 'b'.repeat(64), 'xxt-quiet-enabled': false };
        window.__gm['xxt-ai-config'] = {provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true};
        window.GM_getValue = (key, fallback) => window.__gm[key] ?? fallback;
        window.GM_setValue = (key, value) => { window.__gm[key] = structuredClone(value); };
        window.__requestCount = 0;
        window.GM_xmlhttpRequest = config => {
            const payload = config.data && JSON.parse(config.data); const index = payload ? ++window.__requestCount : 0;
            if (payload) window.__record('requests', { index, text: payload.questions[0].text });
            const timer = setTimeout(() => config.onload({ status: 200, responseText: JSON.stringify(payload ? { answers: payload.questions.map(q => ({ id: q.id, choices: index === 1 ? ['A'] : ['B'], readable: true, confidence: 1, explanation: 'Synthetic context candidate.' })) } : { ok: true }) }), payload ? 1500 : 0);
            return { abort() { clearTimeout(timer); config.onabort?.(); } };
        };
        window.__inViewport = null;
        new IntersectionObserver(entries => { window.__inViewport = entries.some(e => e.isIntersecting); window.__record('view', window.__inViewport); }).observe(document.documentElement);
    };
    await page.evaluate(init); if (cross) await reader.evaluate(init);
    await page.evaluate(() => { window.addEventListener('message', e => { if (e.data?.testScrollAway) window.scrollTo(0, 2300); }); });
    await reader.evaluate(({ action }) => {
        document.querySelector('.tkTopic_title').textContent = '单选题';
        document.querySelector('.tkItem_title').textContent = 'Context fixture first question';
        const inputs = [...document.querySelectorAll('.tkRadio input')]; inputs.forEach(e => { e.type = 'radio'; });
        if (action === 'scroll-select') inputs.forEach(e => e.addEventListener('change', () => window.top.postMessage({ testScrollAway: true }, '*')));
        document.getElementById('videoquiz-submit').onclick = () => {
            window.__record('submitted', { text: document.querySelector('.tkItem_title').textContent,
                choices: inputs.flatMap((e, i) => e.checked ? [String.fromCharCode(65 + i)] : []) });
            document.getElementById('videoquiz-submit').style.display = 'none';
            document.getElementById('rightNum').textContent = '1'; document.getElementById('spanHas').textContent = '答对了';
            document.getElementById('spanHas').style.display = 'inline'; document.getElementById('videoquiz-continue').style.display = 'inline';
        };
        document.getElementById('videoquiz-continue').onclick = () => { window.__record('continued'); document.querySelector('[data-popup]').remove(); };
    }, { action });
    await page.addScriptTag({ content: bundle }); if (cross) await reader.addScriptTag({ content: bundle });
    for (const f of cross ? [page.mainFrame(), reader] : [reader]) await f.evaluate(() => { window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' }); document.querySelector('video')?.pause(); });
    await page.locator('[data-action="start"]').click();
    await reader.waitForFunction(() => window.__requestCount >= 1);
    if (action === 'scroll-model') {
        await page.evaluate(() => window.scrollTo(0, 2300));
        await reader.waitForFunction(() => window.__inViewport === false, null, { timeout: 4000, polling: 50 }).catch(async error => {
            console.log(JSON.stringify({ action, cross, seen, top: await page.evaluate(() => ({ y: scrollY, height: document.scrollingElement.scrollHeight, frame: document.querySelector('iframe')?.getBoundingClientRect().toJSON() })),
                local: await reader.evaluate(() => ({ view: window.__inViewport, width: innerWidth, height: innerHeight, root: document.documentElement.getBoundingClientRect().toJSON() })) }));
            throw error;
        });
    } else if (action === 'restart') {
        await page.locator('[data-action="start"]').click();
    } else if (action === 'chapter') {
        await reader.evaluate(() => { document.querySelector('.tkItem_title').textContent = 'Context fixture NEW chapter question'; });
        await page.evaluate(() => { document.querySelector('.posCatalog_active').classList.remove('posCatalog_active'); document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active'); });
    } else if (action === 'stop') await page.locator('[data-action="stop"]').click();
    else if (action === 'detach') await page.evaluate(() => document.getElementById('reader').remove());
    else if (action === 'hide') await page.evaluate(() => { document.getElementById('reader').style.display = 'none'; });
    if (legacy) {
        await page.waitForFunction(() => /视频弹题页面已切换/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent || ''), null, { timeout: 8000 });
        assert.equal(seen.submitted.length, 0); assert.equal(seen.continued, 0);
    } else if (['stop', 'detach', 'hide'].includes(action)) {
        await page.waitForTimeout(2100);
        assert.equal(seen.submitted.length, 0); assert.equal(seen.continued, 0);
    } else {
        // RAF polling is suspended in an offscreen iframe, even when the DOM action
        // has completed. Use timer polling to observe the deliberately offscreen test.
        await reader.waitForFunction(() => !document.querySelector('[data-popup]'), null, { timeout: 11000, polling: 50 }).catch(async error => {
            console.log(JSON.stringify({ action, cross, seen, status: await page.locator('[data-xxt-codex-panel] pre').textContent(),
                local: await reader.evaluate(() => ({ status: document.querySelector('[data-xxt-codex-panel] pre')?.textContent, view: window.__inViewport,
                    selected: [...document.querySelectorAll('input:checked')].map(e => e.value), records: Object.entries(window.__gm).filter(([k]) => k.startsWith('xxt-video-quiz:')) })) }));
            throw error;
        });
        assert.equal(seen.submitted.length, 1); assert.equal(seen.continued, 1);
        if (action === 'restart' || action === 'chapter') {
            assert.deepEqual(seen.submitted[0].choices, ['B'], 'An obsolete first response must not submit.');
            if (action === 'chapter') assert(seen.submitted[0].text.includes('NEW chapter'));
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await reader.waitForFunction(() => !document.querySelector('video').paused && document.querySelector('video').currentTime > .05);
        const status = await page.locator('[data-xxt-codex-panel] pre').textContent(); assert(!/页面已切换|取消旧答案/.test(status));
    }
    if (action.startsWith('scroll')) assert(seen.view.includes(false), 'A real IntersectionObserver recorded the offscreen transition.');
    observations.push({ action, cross, legacy, ...seen }); await page.close();
}
try {
    if (legacy) { await scenario({ action: 'scroll-select' }); await scenario({ action: 'restart', cross: false }); }
    else {
        await scenario(); await scenario({ action: 'scroll-select' });
        await scenario({ action: 'restart', cross: false }); await scenario({ action: 'restart' });
        await scenario({ action: 'chapter', cross: false }); await scenario({ action: 'chapter' });
        await scenario({ action: 'stop' }); await scenario({ action: 'detach' }); await scenario({ action: 'hide' });
    }
    await writeFile(`${temp}/${legacy ? 'legacy-' : ''}observations.json`, JSON.stringify(observations, null, 2));
    console.log(`${observations.length} ${legacy ? 'legacy false pauses reproduced' : 'video context cases passed'} with actual IntersectionObserver and native media; synthetic model/course only.`);
} finally { await browser.close(); }
