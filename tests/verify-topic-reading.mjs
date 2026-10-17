import { resolve } from 'node:path';
import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// The selectors and navigation routes are from the supported topic reader template.
// All books, text, IDs, GM storage, focus state and clocks below are synthetic.
const bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
const temp = resolve(import.meta.dirname,'../artifacts/topic-reading');
await mkdir(temp, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const observations = [];
async function scenario({ name, book = 'book1', count = 3, quiz = false, special = '' }) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    await context.addInitScript(() => {
        const nativeOpen = window.open.bind(window);
        window.unsafeWindow = window;
        window.GM_getValue = (key, fallback) => { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); };
        window.GM_setValue = (key, value) => localStorage.setItem(key, JSON.stringify(value));
        window.GM_openInTab = address => {
            const popup = nativeOpen(address, '_blank');
            return { get closed() { return popup.closed; }, close() { popup.close(); } };
        };
        window.GM_xmlhttpRequest = options => {
            if (options.method === 'POST') localStorage.setItem('__models', String(Number(localStorage.getItem('__models') || 0) + 1));
            setTimeout(() => options.onload({ status: 200, responseText: JSON.stringify({ ok: true }) }), 0);
            return { abort() {} };
        };
        if (/\/zt\/portal\/|\/ztnodedetailcontroller\//.test(location.pathname)) {
            // Deterministic foreground and monotonic clock only in this fixture.
            window.__focus = true; window.__visible = true; window.__time = 0;
            document.hasFocus = () => window.__focus;
            Object.defineProperty(document, 'visibilityState', { get: () => window.__visible ? 'visible' : 'hidden' });
            performance.now = () => window.__time;
            const interval = window.setInterval;
            window.setInterval = (fn, ms) => { if (ms === 500) { window.__readerTick = fn; return 999999; } return interval(fn, ms); };
        }
    });
    const ids = Array.from({ length: count }, (_, i) => `${book}-${i + 1}`);
    let launches = 0, next = 0, check = 0;
    await context.exposeBinding('__nav', (_, kind) => { if (kind === 'next') next++; if (kind === 'check') check++; });
    context.on('page', p => { if (p.opener()) launches++; });
    const main = await context.newPage();
    await context.route('**/*', async route => {
        const u = new URL(route.request().url());
        const links = ids.map((id, i) => `<li class="mb15 course_section fix ${id === u.searchParams.get('knowledgeId') ? 'liCur' : ''}"><a class="wh wh3" ${i < 2 ? 'style="color:rgb(250,164,65)"' : ''} href="/mooc-ans/ztnodedetailcontroller/visitnodedetail?courseId=${book}&knowledgeId=${id}&_from_=synthetic"><div class="chapter_index">1.${i + 1}</div><div class="chapterText">${book} section ${i + 1}</div></a></li>`).join('');
        let body;
        if (u.pathname === '/mycourse/studentstudy') body = `<div class="prev_title">阅读</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">阅读</span></div><div class="posCatalog_select"><span class="posCatalog_name">下一章</span></div></div>
            <iframe id="iframe" src="/mooc-ans/knowledge/cards" style="width:900px;height:400px"></iframe><button id="next">下一节</button>${quiz ? '<button class="prev_white" id="check">学习检测</button>' : ''}<main id="view"></main>
            <script>next.onclick=()=>{__nav('next');document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');document.getElementById('iframe').remove();};
            ${quiz ? `document.getElementById('check').onclick=()=>{__nav('check');document.getElementById('iframe').hidden=true;document.querySelector('.prev_title').title='章节测验';document.getElementById('view').innerHTML='<p>满分:100</p><p>最终成绩100分</p>';};` : ''}</script>`;
        else if (u.pathname === '/mooc-ans/knowledge/cards') body = '<iframe src="/ananas/modules/read/indexV2.html" style="width:850px;height:350px"></iframe>';
        else if (u.pathname.includes('/modules/read/')) body = '<iframe id="frame_content" src="/mooc-ans/coursedata/readjobv2/show" style="width:800px;height:300px"></iframe>';
        else if (u.pathname.includes('/readjobv2/show')) body = `<div class="readZT"><div><span class="ztTitle">Synthetic ${book}</span></div><span role="option" onclick="window.open('/mooc-ans/zt/portal/synthetic-${book}?_from_=synthetic')">去阅读</span></div>`;
        else if (/\/zt\/portal\/|\/ztnodedetailcontroller\//.test(u.pathname)) body = `<ul>${links}</ul><div id="courseMainBox">${u.searchParams.has('knowledgeId') ? '<div id="caContentBox"><span id="nodeTitleEle">Synthetic title</span><div id="contentDescriptionBox">Synthetic reading material.</div></div>' : `<div id="knowledge-${ids[0]}">Synthetic initial section.</div>`}</div>`;
        else return route.fulfill({ body: '', contentType: 'text/plain' });
        await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><style>body{margin:10px}.chapter_index,.chapterText{display:inline-block}li{margin-bottom:8px}</style>${body}<script>${bundle.replaceAll('</script', '<\\/script')}</script>` });
    });
    try {
        await main.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=synthetic');
        await main.evaluate(() => { GM_setValue('xxt-quiet-enabled', false); });
        await main.locator('[data-action="start"]').click();
        let reader = await context.waitForEvent('page');
        await reader.waitForURL(u => u.searchParams.get('knowledgeId') === ids[0]);
        await reader.waitForFunction(() => !!window.__readerTick);
        const getId = () => new URL(reader.url()).searchParams.get('xxtReading');
        const progress = () => main.evaluate(id => GM_getValue(`xxt-topic:${id}:progress`, null), getId());
        // A fresh document establishes readiness before any time is credited.
        await reader.evaluate(() => window.__readerTick());
        if (special === 'manual-close') {
            await reader.close();
            await main.waitForFunction(() => /提前关闭/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
            assert.equal(next, 0); observations.push({ name, preserved: true }); return;
        }
        if (special === 'stop') {
            const closed = reader.waitForEvent('close'); await main.locator('[data-action="stop"]').click(); await closed;
            assert.equal(next, 0); observations.push({ name, next }); return;
        }
        if (special === 'manifest') {
            await reader.evaluate(() => { document.querySelector('li.course_section:last-child').remove(); window.__readerTick(); });
            await main.waitForFunction(() => /目录发生变化/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
            assert.equal(next, 0); observations.push({ name, next }); return;
        }
        if (special === 'guards') {
            await reader.evaluate(() => {
                window.__focus = false;
                for (let i = 0; i < 200; i++) { window.__time += 500; window.__readerTick(); }
            });
            assert.equal((await progress()).done.length, 0);
            await reader.evaluate(() => {
                window.__focus = true; window.__visible = false;
                for (let i = 0; i < 200; i++) { window.__time += 500; window.__readerTick(); }
            });
            assert.equal((await progress()).done.length, 0);
            await reader.evaluate(() => {
                window.__visible = true; GM_setValue('xxt-quiet-enabled', true);
                XxtCodexCore.quietHoursAt = () => true;
                for (let i = 0; i < 200; i++) { window.__time += 500; window.__readerTick(); }
                GM_setValue('xxt-quiet-enabled', false);
            });
            assert.equal((await progress()).done.length, 0);
            await reader.locator('[data-xxt-topic-reader] button').click();
            await reader.evaluate(() => { for (let i = 0; i < 200; i++) { window.__time += 500; window.__readerTick(); } });
            assert.equal((await progress()).done.length, 0);
            await reader.locator('[data-xxt-topic-reader] button').click();
        }
        for (let i = 0; i < count; i++) {
            await reader.waitForURL(u => u.searchParams.get('knowledgeId') === ids[i]);
            await reader.waitForFunction(() => !!window.__readerTick);
            await reader.evaluate(() => window.__readerTick());
            if (special === 'heartbeat') await reader.evaluate(() => {
                const id = new URL(location.href).searchParams.get('xxtReading');
                GM_setValue(`xxt-topic:${id}:control`, { running: true, at: Date.now() - 60000 });
            });
            await reader.evaluate(() => { for (let n = 0; n < 178; n++) { window.__time += 500; window.__readerTick(); } });
            assert.equal((await progress()).done.length, i, '89 seconds cannot complete a section, even if already yellow.');
            assert.equal(next, 0, 'The course cannot advance while a topic section remains.');
            if (special === 'refresh' && i === 0) {
                await reader.reload(); await reader.waitForFunction(() => !!window.__readerTick);
                // pagehide saves the 89 seconds; a reload must not erase or add dwell.
                assert(Math.abs((await progress()).elapsed - 89000) < 1);
            }
            if (special === 'parent-refresh' && i === 0) {
                const oldClosed = reader.waitForEvent('close'); await main.reload(); await oldClosed;
                const opened = context.waitForEvent('page'); await main.locator('[data-action="start"]').click(); reader = await opened;
                await reader.waitForURL(u => u.searchParams.get('knowledgeId') === ids[0]);
                await reader.waitForFunction(() => !!window.__readerTick);
                assert.equal((await progress()).elapsed, 89000);
            }
            await reader.evaluate(() => { for (let n = 0; n < 2; n++) { window.__time += 500; window.__readerTick(); } });
        }
        await main.waitForFunction(() => document.querySelectorAll('#coursetree .posCatalog_select')[1].classList.contains('posCatalog_active'), null, { timeout: 10000 });
        assert.equal(next, 1); assert.equal(check, quiz ? 1 : 0);
        assert.equal(await main.evaluate(() => Number(localStorage.getItem('__models') || 0)), 0);
        assert(reader.isClosed(), 'Only the owned reader tab is closed after all sections.');
        observations.push({ name, count, book, quiz, special, next, check, models: 0 });
    } finally { await context.close(); }
}
try {
    await scenario({ name: 'nested-entry-and-full-navigation', quiz: true });
    await scenario({ name: 'different-book-and-catalogue-size', book: 'otherBook', count: 2 });
    await scenario({ name: 'foreground-night-and-manual-pause', count: 1, special: 'guards' });
    await scenario({ name: 'refresh-resumes-dwell', count: 1, special: 'refresh' });
    await scenario({ name: 'early-close-stops-course', special: 'manual-close' });
    await scenario({ name: 'parent-stop-closes-owned-tab', special: 'stop' });
    await scenario({ name: 'background-parent-minute-throttling', count: 1, special: 'heartbeat' });
    await scenario({ name: 'catalogue-change-pauses', special: 'manifest' });
    await scenario({ name: 'parent-refresh-resumes-the-same-job', count: 1, special: 'parent-refresh' });
    await writeFile(`${temp}/observations.json`, JSON.stringify(observations, null, 2));
    console.log('9 topic-reading scenarios passed: nested launch, arbitrary books/catalogues, foreground 90s, quiet/pause, reader/course refresh, early close/stop, minute-throttled parent, changed catalogue, quiz-before-next. Clocks and platform are synthetic; no models called.');
} finally { await browser.close(); }
