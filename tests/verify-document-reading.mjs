import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
const temp = resolve(import.meta.dirname,'../artifacts/document-reading');
await mkdir(temp, { recursive: true });
const browser = await chromium.launchPersistentContext(resolve(temp, 'profile'), { channel: 'chrome', headless: true, viewport: { width: 1440, height: 1100 } });
const observations = [];
function init() {
    window.unsafeWindow = window;
    const nativeNow = Date.now.bind(Date);
    window.__offset = 0;
    Date.now = () => nativeNow() + window.__offset;
    window.__gm = { 'xxt-codex-token': 'b'.repeat(64), 'xxt-quiet-enabled': false };
        window.__gm['xxt-ai-config'] = {provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true};
    window.GM_getValue = (key, fallback) => window.__gm[key] ?? fallback;
    window.GM_setValue = (key, value) => { window.__gm[key] = structuredClone(value); };
    window.__opens = 0; window.__modelCalls = 0; window.__closes = 0;
    window.GM_openInTab = url => {
        window.__opens++;
        const popup = window.open(url, '_blank');
        window.__popup = popup;
        return { get closed() { return popup.closed; }, close() { window.__closes++; popup.close(); } };
    };
    window.GM_xmlhttpRequest = config => {
        if (config.method === 'POST') window.__modelCalls++;
        setTimeout(() => config.onload({ status: 200, responseText: JSON.stringify(config.method === 'GET' ? { ok: true } : {
            answers: [{ id: 'q1', choices: ['A'], readable: true, confidence: 1, explanation: 'Synthetic quiz answer.' }]
        }) }), 0);
        return { abort() {} };
    };
}
async function scenario({ mode = 'tab', quiz = false, child = false, stopped = false, files = 1, unknown = false } = {}) {
    const page = await browser.newPage();
    const filename = mode === 'modal' ? 'reading.docx' : 'reading.pdf';
    const links = Array.from({ length: files }, (_, index) => mode === 'modal' ? `<button class="file" data-index="${index}">${index}-${filename}</button>` :
        `<a class="file" href="https://mooc1-1.chaoxing.com/materials/${index}-${filename}">${index}-${filename}</a>`).join('');
    const courseHtml = '<div class="prev_title" title="文献阅读">文献阅读</div><div id="coursetree"><ul><li><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">second</span></div></li></ul></div><button id="next">下一节</button>' +
        (quiz ? '<button class="prev_white" id="check">2 章节测验</button>' : '') +
        (child ? '<iframe id="card" src="https://mooc1-1.chaoxing.com/reading/card" style="width:900px;height:550px"></iframe>' : `<main id="files">${unknown ? '<p>Unrecognized article</p>' : mode === 'inline' ? '<iframe src="https://mooc1-1.chaoxing.com/ananas/modules/pdf/index.html" style="width:850px;height:400px"></iframe>' : links}</main><main id="view"></main>`);
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: route.request().url().includes('/modules/pdf/') ? '<!doctype html><div style="height:2500px">Document pages</div>' : route.request().url().includes('/materials/') ? '<p>Document viewer fixture</p>' :
        route.request().url().includes('/reading/card') ? `<main id="files">${links}</main><main id="view"></main>` : courseHtml }));
    await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=documents');
    const owner = page.mainFrame();
    const reader = child ? page.frames().find(frame => frame.url().includes('/reading/card')) : owner;
    await owner.evaluate(init);
    if (child) await reader.evaluate(init);
    await reader.evaluate(mode => { window.__gm['xxt-document-open-mode'] = mode === 'tab' ? 'tab' : 'modal'; }, mode);
    await owner.evaluate(() => {
        window.__next = 0; window.__checks = 0; window.__submits = 0;
        window.__documentFinished = false;
        window.addEventListener('message', event => {
            if (event.data?.source === 'xxt-codex-0.3' && event.data.type === 'document-finished') window.__documentFinished = true;
        });
        document.getElementById('next').onclick = () => {
            window.__next++;
            document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');
            document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');
            document.getElementById('files')?.remove(); document.getElementById('card')?.remove();
            document.getElementById('view')?.replaceChildren();
        };
        if (document.getElementById('check')) document.getElementById('check').onclick = () => {
            window.__checks++; document.getElementById('files').hidden = true;
            document.querySelector('.prev_title').title = '章节测验';
            document.getElementById('view').innerHTML = '<div class="TiMu"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span>1+1?</div><ul class="Zy_ulTop"><li><span class="num_option choice1">A</span><a class="after">2</a></li><li><span class="num_option choice1">B</span><a class="after">3</a></li></ul></div><a class="btnSubmit workBtnIndex">提交</a>';
            document.querySelectorAll('li .num_option').forEach(marker => marker.onclick = () => marker.classList.add('check_answer'));
            document.querySelector('.btnSubmit').onclick = () => {
                window.__submits++;
                document.getElementById('view').innerHTML = '<p>满分:100</p><p>最终成绩 100 分</p>';
            };
        };
    });
    if (mode === 'modal') await reader.evaluate(() => {
        document.querySelectorAll('.file').forEach(button => button.onclick = () => {
            window.__opens++;
            document.getElementById('view').innerHTML = '<div role="dialog"><button aria-label="关闭" id="closePreview">×</button><iframe src="https://mooc1-1.chaoxing.com/materials/reading.docx" style="width:600px;height:300px"></iframe></div>';
            document.getElementById('closePreview').onclick = () => { window.__closes++; document.getElementById('view').replaceChildren(); };
        });
    });
    await owner.addScriptTag({ content: bundle });
    if (child) await reader.addScriptTag({ content: bundle });
    await owner.evaluate(() => { window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' }); });
    await owner.locator('[data-action="start"]').click();
    if (unknown) {
        await page.waitForTimeout(1000);
        await owner.evaluate(() => { window.__offset += 3500; });
        await owner.waitForFunction(() => window.__next === 1);
    } else {
        for (let index = 0; index < files; index++) {
            if (mode === 'inline') await owner.waitForFunction(() => /文献已打开/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent || ''));
            else await reader.waitForFunction(count => window.__opens === count, index + 1, { timeout: 10000 });
            await reader.waitForFunction(() => /等待 \d+ 秒后关闭/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent || '') ||
                Object.values(window.__gm).some(value => Array.isArray(value)), null, { timeout: 1000 }).catch(() => {});
            // Give the async open call time to establish its deadline before changing the clock.
            await page.waitForTimeout(250);
            const popupPage = child ? browser.pages().find(candidate => candidate !== page && candidate.url().includes('/materials/')) : null;
            const popupClose = popupPage ? popupPage.waitForEvent('close', { timeout: 8000 }) : null;
            if (stopped) {
                await owner.locator('[data-action="stop"]').click();
                await reader.waitForFunction(() => window.__popup?.closed === true || window.__closes === 1);
                await reader.evaluate(() => { window.__offset += 61000; });
                await page.waitForTimeout(1000);
                assert.equal(await owner.evaluate(() => window.__next), 0);
                break;
            }
            await reader.evaluate(() => { window.__offset += 57500; });
            await page.waitForTimeout(250);
            assert.equal(await reader.evaluate(() => window.__closes), index, 'File must remain open before 60 seconds.');
            assert.equal(await owner.evaluate(() => window.__next), 0);
            await reader.evaluate(() => { window.__offset += 3700; });
            if (popupClose) await popupClose;
            else if (child) {
                await owner.waitForFunction(() => window.__next === 1);
                assert.equal(await owner.evaluate(() => window.__documentFinished), true, 'Document completion is handed to the course before navigation.');
            } else if (mode !== 'inline') await reader.waitForFunction(count => window.__closes === count, index + 1, { timeout: 5000 });
        }
        if (!stopped) {
            await owner.waitForFunction(() => window.__next === 1, null, { timeout: 12000 });
            assert.equal(await owner.evaluate(() => window.__checks), quiz ? 1 : 0);
            assert.equal(await owner.evaluate(() => window.__modelCalls), quiz ? 1 : 0);
            assert.equal(await owner.evaluate(() => window.__submits), quiz ? 1 : 0);
        }
    }
    observations.push({ mode, quiz, child, stopped, files, unknown, next: await owner.evaluate(() => window.__next) });
    await page.close();
}
try {
    if (process.argv.includes('--child-only')) {
        await scenario({ child: true });
        console.log(JSON.stringify(observations));
        await browser.close(); process.exit(0);
    }
    await scenario({ quiz: true });
    await scenario({ mode: 'modal' });
    await scenario({ mode: 'inline' });
    await scenario({ child: true });
    await scenario({ files: 2 });
    await scenario({ stopped: true });
    await scenario({ unknown: true });
    await writeFile(resolve(temp, 'observations.json'), JSON.stringify(observations, null, 2));
    console.log('7 document workflows passed: 60-second retention, inline and modal previews, real popup close, quiz handoff, cross-origin frame, multiple files, stop, unknown-step skip. Time is accelerated; platform task completion is synthetic.');
} finally { await browser.close(); }
