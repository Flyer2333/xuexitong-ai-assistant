import { resolve } from 'node:path';
import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

let bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
const html = await readFile(new URL('./fixtures/video-quiz-recovery.html', import.meta.url), 'utf8');
const style = (await readFile(new URL('./fixtures/video-quiz-layout.html', import.meta.url), 'utf8')).match(/<style>[\s\S]*?<\/style>/)[0];
const legacy = false;
const temp = resolve(import.meta.dirname,'../artifacts/submission-recovery'); await mkdir(temp, { recursive: true });
const browser = await chromium.launchPersistentContext(`${temp}/profile`, { channel: 'chrome', headless: true, viewport: { width: 1400, height: 1000 } });
const observations = [];
async function scenario({ cross = false, mode = 'stale', ignored = 0 } = {}) {
    const page = await browser.newPage(), seen = { model: 0, clicks: 0, accepted: 0, continued: 0, selected: [] };
    await page.exposeFunction('__record', (kind, value) => { if (kind === 'selected') seen.selected.push(value); else seen[kind]++; });
    const tree = '<div class="prev_title" title="安全知识">安全知识</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div></div><button class="prev_white">2 学习检测</button>';
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: route.request().url().includes('/video/') ? style + html :
        tree + (cross ? '<iframe src="https://mooc1-1.chaoxing.com/ananas/modules/video/recovery" style="width:950px;height:650px"></iframe>' : style + html) }));
    await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=recovery');
    const reader = cross ? page.frames().find(f => f.url().includes('/video/')) : page.mainFrame();
    const init = ({ mode }) => {
        window.unsafeWindow = window; window.__gm = { 'xxt-codex-token': 'b'.repeat(64), 'xxt-quiet-enabled': false };
        window.__gm['xxt-ai-config'] = {provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true};
        window.__offset = 0; const now = Date.now.bind(Date); Date.now = () => now() + window.__offset;
        window.__seeded = false; window.__model = 0; window.__accepted = 0; window.__clicks = 0;
        window.GM_getValue = (key, fallback) => {
            if (key.startsWith('xxt-video-quiz:') && !window.__seeded && ['stale', 'wrong', 'correct', 'pending', 'history'].includes(mode)) {
                window.__seeded = true;
                window.__gm[key] = { phase: 'submitted', at: Date.now() - 3600000, choices: ['A'], submissions: 1 };
                if (mode === 'history') {
                    const question = XxtVideoQuiz.extract(XxtVideoQuiz.find(document)).question;
                    window.__gm[key].attempts = [{ questions: [question], answers: [{ id: question.id, choices: ['A'] }], finalScore: 0, maxScore: 1 }];
                }
            }
            return window.__gm[key] ?? fallback;
        };
        window.GM_setValue = (key, value) => { window.__gm[key] = structuredClone(value); };
        window.GM_xmlhttpRequest = config => {
            const payload = config.data && JSON.parse(config.data);
            if (payload) { window.__model++; window.__record('model'); }
            setTimeout(() => config.onload({ status: 200, responseText: JSON.stringify(payload ? { answers: payload.questions.map(q => ({ id: q.id, choices: ['B'], readable: true, confidence: 1, explanation: 'Synthetic recovery answer.' })) } : { ok: true }) }), 100);
            return { abort() { config.onabort?.(); } };
        };
    };
    await page.evaluate(init, { mode }); if (cross) await reader.evaluate(init, { mode });
    await reader.evaluate(({ mode, ignored }) => {
        window.__success = () => {
            document.getElementById('videoquiz-submitting').style.display = 'none'; document.getElementById('videoquiz-submit').style.display = 'none';
            document.getElementById('spanNotBackPoint').style.display = 'none'; document.getElementById('rightNum').textContent = '1';
            document.getElementById('spanHas').textContent = '恭喜你，答对了！'; document.getElementById('videoquiz-continue').style.display = 'inline';
        };
        document.getElementById('videoquiz-submit').onclick = () => {
            window.__clicks++; window.__record('clicks');
            if (window.__clicks <= ignored) return;
            window.__accepted++; window.__record('accepted');
            window.__record('selected', [...document.querySelectorAll('.tkRadio input')].flatMap((x, i) => x.checked ? [String.fromCharCode(65 + i)] : []));
            document.getElementById('videoquiz-submit').style.display = 'none'; document.getElementById('videoquiz-submitting').style.display = 'inline';
            setTimeout(window.__success, mode === 'restart-pending' ? 1200 : 200);
        };
        document.getElementById('videoquiz-continue').onclick = () => { window.__record('continued'); document.querySelector('[data-popup]').remove(); };
        if (mode === 'wrong') {
            document.getElementById('spanNotBackPoint').textContent = '真遗憾，再接再厉！正确答案：B'; document.getElementById('spanNotBackPoint').style.display = 'inline';
        }
        if (mode === 'correct') window.__success();
        if (mode === 'pending') {
            document.getElementById('videoquiz-submit').style.display = 'none'; document.getElementById('videoquiz-submitting').style.display = 'inline';
        }
    }, { mode, ignored });
    await page.addScriptTag({ content: bundle }); if (cross) await reader.addScriptTag({ content: bundle });
    for (const f of cross ? [page.mainFrame(), reader] : [reader]) await f.evaluate(() => { window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' }); });
    await page.locator('[data-action="start"]').click();
    if (legacy) {
        await reader.waitForFunction(() => window.__seeded); await page.waitForTimeout(250);
        await reader.evaluate(() => { window.__offset += 21000; });
        await page.waitForFunction(() => /页面响应超时/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent || ''));
        assert.equal(seen.model, 0); assert.equal(seen.clicks, 0);
    } else if (mode === 'pending') {
        await page.waitForTimeout(2700);
        assert.equal(seen.clicks, 0, 'A visible judging indicator cannot be recovered by sending another submit.');
        await reader.evaluate(() => window.__success());
        await reader.waitForFunction(() => !document.querySelector('[data-popup]'));
    } else if (mode === 'stopped') {
        await reader.waitForFunction(() => window.__clicks === 1);
        await page.locator('[data-action="stop"]').click(); await page.waitForTimeout(2600);
        assert.equal(seen.clicks, 1); assert.equal(seen.continued, 0);
    } else if (mode === 'unresponsive') {
        await reader.waitForFunction(() => window.__clicks === 2, null, { timeout: 7000 });
        await reader.evaluate(() => { window.__offset += 21000; });
        await page.waitForFunction(() => /未收到判题反馈/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent || ''));
        assert.equal(seen.clicks, 2); assert.equal(seen.accepted, 0);
        assert(await reader.evaluate(() => Object.values(window.__gm).some(x => x?.phase === 'unconfirmed')));
    } else {
        if (mode === 'restart-pending') {
            await reader.waitForFunction(() => window.__accepted === 1);
            await page.locator('[data-action="start"]').click();
        }
        await reader.waitForFunction(() => !document.querySelector('[data-popup]'), null, { timeout: 8000 });
        assert.equal(seen.continued, 1);
        if (mode === 'correct') { assert.equal(seen.model, 0); assert.equal(seen.clicks, 0); }
        else {
            assert.equal(seen.clicks, ignored + 1); assert.equal(seen.accepted, 1); assert.deepEqual(seen.selected, [['B']]);
            if (mode === 'wrong') assert.equal(seen.model, 0); else assert.equal(seen.model, 1);
        }
    }
    observations.push({ mode, cross, ignored, legacy, ...seen }); await page.close();
}
try {
    if (legacy) await scenario();
    else {
        await scenario(); await scenario({ cross: true }); await scenario({ mode: 'history' });
        await scenario({ mode: 'wrong' }); await scenario({ mode: 'correct' }); await scenario({ mode: 'pending', cross: true });
        await scenario({ mode: 'active', ignored: 1 }); await scenario({ mode: 'stopped', ignored: 1 });
        await scenario({ mode: 'unresponsive', ignored: 999 }); await scenario({ mode: 'restart-pending', cross: true });
    }
    await writeFile(`${temp}/${legacy ? 'legacy-' : ''}observations.json`, JSON.stringify(observations, null, 2));
    console.log(`${observations.length} ${legacy ? 'stale submitted timeout reproduced' : 'submission recovery cases passed'}; synthetic DOM fixture, synthetic state/feedback/model.`);
} finally { await browser.close(); }
