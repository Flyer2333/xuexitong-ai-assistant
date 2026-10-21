import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
const temp = resolve(import.meta.dirname,'../artifacts/quiet-hours');
await mkdir(temp, { recursive: true });
const browser = await chromium.launchPersistentContext(resolve(temp, 'profile'), { channel: 'chrome', headless: true, viewport: { width: 1280, height: 850 } });
const observations = [];
const tree = '<div id="coursetree"><ul><li><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">second</span></div></li></ul></div><button id="next">下一节</button>';
const quiz = '<main id="content"><div class="TiMu"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span>1+1?</div><ul class="Zy_ulTop"><li><span class="num_option choice1">A</span><a class="after">2</a></li><li><span class="num_option choice1">B</span><a class="after">3</a></li></ul></div><a class="btnSubmit workBtnIndex">提交</a></main>';
function init({ time, delay }) {
    window.unsafeWindow = window;
    const nativeNow = Date.now.bind(Date);
    let baseTime = time, anchor = nativeNow();
    window.__setTime = time => { baseTime = time; anchor = nativeNow(); };
    Date.now = () => baseTime + nativeNow() - anchor;
    window.__gm = {'xxt-quiet-enabled':true,'xxt-ai-config':{provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true}};
    window.GM_getValue = (key, fallback) => window.__gm[key] ?? fallback;
    window.GM_setValue = (key, value) => { window.__gm[key] = structuredClone(value); };
    window.__counts = { model: 0, submit: 0, next: 0, abort: 0 };
    window.GM_xmlhttpRequest = config => {
        let aborted = false;
        if (config.method === 'POST') window.__counts.model++;
        setTimeout(() => { if (!aborted) config.onload({ status: 200, responseText: JSON.stringify(config.method === 'GET' ? { ok: true } :
            { answers: [{ id: 'q1', choices: ['A'], readable: true, confidence: 1, explanation: 'Synthetic answer.' }] }) }); }, delay || 0);
        return { abort() { aborted = true; window.__counts.abort++; config.onabort?.(); } };
    };
    document.querySelectorAll('.num_option').forEach(marker => marker.onclick = () => marker.classList.add('check_answer'));
    const submit = document.querySelector('.btnSubmit');
    if (submit) submit.onclick = () => { window.__counts.submit++; document.getElementById('content').innerHTML = '<p>满分:100</p><p>最终成绩 100 分</p>'; };
    document.getElementById('next').onclick = () => {
        window.__counts.next++;
        document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');
        document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');
        document.getElementById('content')?.replaceChildren();
    };
    window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' });
}
async function openPage({ time, delay, video = false } = {}) {
    const page = await browser.newPage();
    const sampleRate = 8000, dataLength = sampleRate * 2 * 120;
    const wav = Buffer.alloc(44 + dataLength);
    wav.write('RIFF'); wav.writeUInt32LE(36 + dataLength, 4); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(dataLength, 40);
    await page.route('**/*', route => route.fulfill(route.request().url().endsWith('media.wav') ? { contentType: 'audio/wav', body: wav } :
        { contentType: 'text/html; charset=utf-8', body: `<div class="prev_title" title="${video ? '视频' : '学习检测'}"></div>${tree}${video ? '<video id="video_html5_api" src="/media.wav" muted controls width="500" height="300"></video>' : quiz}` }));
    await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=quiet');
    await page.evaluate(init, { time, delay });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => { window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' }); });
    return page;
}
const night = Date.parse('2026-10-12T15:00:00Z');
const morning = Date.parse('2026-10-12T23:00:00Z');
try {
    let page = await openPage({ time: night });
    await page.locator('[data-action="start"]').click();
    await page.waitForTimeout(1300);
    assert.deepEqual(await page.evaluate(() => window.__counts), { model: 0, submit: 0, next: 0, abort: 0 });
    await page.evaluate(time => window.__setTime(time), morning);
    await page.waitForFunction(() => window.__counts.next === 1, null, { timeout: 8000 });
    observations.push({ name: 'queued at 23:00, resumes at 07:00', counts: await page.evaluate(() => window.__counts) });
    await page.close();

    page = await openPage({ time: night });
    await page.locator('[data-action="start"]').click();
    await page.locator('[data-action="stop"]').click();
    await page.evaluate(time => window.__setTime(time), morning);
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.__counts.model), 0);
    observations.push({ name: 'manual stop cancels morning resume', counts: await page.evaluate(() => window.__counts) });
    await page.close();

    page = await openPage({ time: night - 10000, delay: 2500 });
    await page.locator('[data-action="start"]').click();
    await page.waitForFunction(() => window.__counts.model === 1);
    await page.evaluate(time => window.__setTime(time), night);
    await page.waitForFunction(() => window.__counts.abort === 1);
    await page.waitForTimeout(2600);
    assert.equal(await page.evaluate(() => window.__counts.submit), 0);
    await page.evaluate(time => window.__setTime(time), morning);
    await page.waitForFunction(() => window.__counts.next === 1, null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__counts.model), 2);
    observations.push({ name: '23:00 aborts pending model and prevents stale submit', counts: await page.evaluate(() => window.__counts) });
    await page.close();

    page = await openPage({ time: night - 10000, video: true });
    await page.locator('[data-action="start"]').click();
    await page.waitForFunction(() => !document.querySelector('video').paused && document.querySelector('video').currentTime > 0.2);
    await page.evaluate(time => window.__setTime(time), night);
    await page.waitForFunction(() => document.querySelector('video').paused);
    await page.evaluate(time => window.__setTime(time), morning);
    await page.waitForFunction(() => !document.querySelector('video').paused);
    observations.push({ name: 'native HTMLVideoElement pauses at 23:00 and resumes after 07:00', counts: await page.evaluate(() => window.__counts) });
    await page.close();

    page = await openPage({ time: Date.parse('2026-10-13T04:00:00Z') });
    await page.evaluate(()=>GM_setValue('xxt-ai-vision-enabled',false));await page.locator('[data-action="connect"]').click();
    await page.waitForFunction(() => /AI 连接测试通过/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
    await page.getByRole('dialog').getByText('知道了',{exact:true}).click();const rect = await page.locator('[data-xxt-codex-panel]').boundingBox();
    await page.screenshot({ path: resolve(temp, 'quiet-ui.png'), clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
    assert.equal(await page.locator('[data-xxt-codex-panel]').getAttribute('data-skin'), 'default');
    assert.equal(await page.locator('[data-setting="quiet"]').isChecked(), true);
    await page.locator('.xxt-fold').click(); assert.equal(await page.locator('.xxt-body').isVisible(), false);
    await page.locator('.xxt-fold').click(); assert.equal(await page.locator('.xxt-body').isVisible(), true);
    observations.push({ name: 'public default theme, quiet setting defaults on, panel folds', screenshot: 'quiet-ui.png' });
    await page.close();
    await writeFile(resolve(temp, 'observations.json'), JSON.stringify(observations, null, 2));
    console.log('Quiet hours, native video, pending model cancellation, morning resume, and UI checks passed. Time and model replies are controlled fixtures; no live course operations.');
} finally { await browser.close(); }

