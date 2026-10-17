import { resolve } from 'node:path';
import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
const html = await readFile(new URL('./fixtures/video-quiz-synthetic.html', import.meta.url), 'utf8');
const style = (await readFile(new URL('./fixtures/video-quiz-layout.html', import.meta.url), 'utf8')).match(/<style>[\s\S]*?<\/style>/)[0];
const temp = resolve(import.meta.dirname,'../artifacts/video-resubmit'); await mkdir(temp, { recursive: true });
const context = await chromium.launchPersistentContext(`${temp}/profile`, { channel: 'chrome', headless: true, viewport: { width: 1450, height: 1100 }, args: ['--autoplay-policy=no-user-gesture-required'] });
const wav = Buffer.alloc(44 + 8000 * 2 * 120);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const media = `<video id="video_html5_api" controls muted src="data:audio/wav;base64,${wav.toString('base64')}" style="width:850px;height:500px"></video>`;
const observations = [];
async function scenario({ cross = false, type = 'single', failureId = 'spanNotBackPoint', reference = true, failCount = 1, review = false, disabled = false, exhausted = false, stop = false, stuck = false, allFailed = false, contradiction = false } = {}) {
    const page = await context.newPage(), state = { requests: [], submits: [], proceed: 0 };
    await page.exposeFunction('__record', (kind, value) => { if (kind === 'proceed') state.proceed++; else state[kind].push(value); });
    const popup = style + '<style>.ans-videoquiz-continue,.tkTopic_oper .spanNot,.tkTopic_oper .spanNotBack,.bntWhiteBorder,.tkTopic_oper .spanHref,.tkParsing {display:none}</style>' + `<section class="ans-videoquiz" data-popup>${html}</section>`;
    const tree = '<div class="prev_title" title="安全知识">安全知识</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div></div><button class="prev_white">2 学习检测</button>';
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: route.request().url().includes('/video/') ? media + popup :
        tree + (cross ? '<iframe src="https://mooc1-1.chaoxing.com/ananas/modules/video/resubmit" style="width:950px;height:700px"></iframe>' : media + popup) }));
    await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=resubmit-fixture');
    const reader = cross ? page.frames().find(f => f.url().includes('/video/')) : page.mainFrame();
    const init = ({ stop }) => {
        window.unsafeWindow = window; window.__offset = 0; const now = Date.now.bind(Date); Date.now = () => now() + window.__offset;
        window.__gm = { 'xxt-codex-token': 'b'.repeat(64), 'xxt-quiet-enabled': false };
        window.__gm['xxt-ai-config'] = {provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true};
        window.GM_getValue = (key, fallback) => window.__gm[key] ?? fallback;
        window.GM_setValue = (key, value) => { window.__gm[key] = structuredClone(value); };
        window.GM_xmlhttpRequest = config => {
            const payload = config.data && JSON.parse(config.data);
            if (payload) window.__record('requests', { history: payload.history });
            const timer = setTimeout(() => config.onload({ status: 200, responseText: JSON.stringify(payload ? { answers: payload.questions.map(q => ({ id: q.id, choices: ['A'], readable: true, confidence: 1, explanation: 'Synthetic repeated candidate.' })) } : { ok: true }) }), stop && payload?.history?.length ? 1500 : 100);
            return { abort() { clearTimeout(timer); config.onabort?.(); } };
        };
    };
    await page.evaluate(init, { stop }); if (cross) await reader.evaluate(init, { stop });
    await reader.evaluate(({ type, failureId, reference, failCount, review, disabled, exhausted, stuck }) => {
        const controls = [...document.querySelectorAll('.tkRadio input')];
        controls.forEach(input => { input.type = type === 'multiple' ? 'checkbox' : 'radio'; });
        document.querySelector('.tkTopic_title').textContent = type === 'multiple' ? '多选题' : '单选题';
        document.querySelector('.tkItem_title').textContent = '测试原题重交：应依据平台反馈重新选择。';
        window.__submits = 0;
        document.getElementById('videoquiz-submit').onclick = () => {
            window.__submits++;
            window.__record('submits', controls.flatMap((input, i) => input.checked ? [String.fromCharCode(65 + i)] : []));
            const submit = document.getElementById('videoquiz-submit'), spinner = document.getElementById('videoquiz-submitting');
            submit.style.display = 'none'; spinner.style.display = 'inline';
            if (stuck && window.__submits > 1) return;
            setTimeout(() => {
                spinner.style.display = 'none';
                if (window.__submits <= failCount) {
                    const wrong = document.getElementById(failureId);
                    // After the first failure the same text/style stays in place. Only the
                    // judging indicator changes on subsequent failures (real template behavior).
                    if (window.__submits === 1) {
                        wrong.textContent = '真遗憾，再接再厉！' + (review ? '请回看 1 分钟' : '') + (reference ? ' 正确答案：' + (type === 'multiple' ? 'BC' : 'B') : '') + (exhausted ? ' 剩余 0 次' : '');
                        wrong.style.display = 'inline';
                    }
                    submit.style.display = 'inline';
                    if (disabled) controls.forEach(input => { input.disabled = true; });
                } else {
                    document.getElementById(failureId).style.display = 'none';
                    document.getElementById('rightNum').textContent = '1';
                    document.getElementById('spanHas').textContent = '恭喜你，答对了！'; document.getElementById('spanHas').style.display = 'inline';
                    document.getElementById('videoquiz-continue').style.display = 'inline';
                }
            }, 200);
        };
        document.getElementById('videoquiz-continue').onclick = () => { window.__record('proceed'); document.querySelector('[data-popup]').remove(); };
    }, { type, failureId, reference, failCount, review, disabled, exhausted, stuck });
    await page.addScriptTag({ content: bundle }); if (cross) await reader.addScriptTag({ content: bundle });
    for (const frame of cross ? [page.mainFrame(), reader] : [reader]) await frame.evaluate(() => { window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' }); document.querySelector('video')?.pause(); });
    await page.locator('[data-action="start"]').click();
    if (stop) {
        await page.waitForFunction(() => true);
        while (state.requests.length < 2) await page.waitForTimeout(50);
        await page.locator('[data-action="stop"]').click(); await page.waitForTimeout(1800);
        assert.equal(state.submits.length, 1); assert.equal(state.proceed, 0);
    } else if (allFailed || contradiction) {
        await page.waitForFunction(() => /组合均已尝试|参考答案已被判错/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent || ''), null, { timeout: 14000 });
        assert.equal(state.submits.length, allFailed ? 4 : 2);
        assert.equal(new Set(state.submits.map(choices => choices.join(''))).size, state.submits.length);
        assert.equal(state.proceed, 0);
    } else if (review || disabled || exhausted) {
        await page.waitForFunction(() => /回看|暂不可重交|次数已用尽/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent || ''), null, { timeout: 8000 });
        assert.equal(state.submits.length, 1); assert.equal(state.proceed, 0);
    } else if (stuck) {
        while (state.submits.length < 2) await page.waitForTimeout(50);
        await reader.evaluate(() => { window.__offset += 21000; });
        await page.waitForFunction(() => /页面响应超时/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent || ''), null, { timeout: 5000 });
        assert.equal(state.submits.length, 2, 'Old failure cannot trigger a third submit while the new response is missing.');
    } else {
        await reader.waitForFunction(() => !document.querySelector('[data-popup]'), null, { timeout: 14000 });
        await reader.waitForFunction(() => !document.querySelector('video').paused && document.querySelector('video').currentTime > .05);
        assert.equal(state.submits.length, failCount + 1); assert.equal(state.proceed, 1);
        assert.equal(new Set(state.submits.map(choices => [...choices].sort().join(''))).size, state.submits.length, 'Every failed retry changes the selected answer.');
        if (reference) assert.deepEqual(state.submits[1], type === 'multiple' ? ['B', 'C'] : ['B']);
        else assert(state.requests.some(r => r.history.length), 'AI receives failed choices and feedback for comparison.');
    }
    observations.push({ cross, type, failureId, reference, failCount, review, disabled, exhausted, stop, stuck, allFailed, contradiction, ...state }); await page.close();
}
try {
    await scenario();
    await scenario({ reference: false, failureId: 'spanNotBack' });
    await scenario({ cross: true, type: 'multiple' });
    await scenario({ reference: false, failCount: 2 });
    await scenario({ reference: false, failCount: 2, stuck: true });
    await scenario({ review: true }); await scenario({ disabled: true }); await scenario({ exhausted: true });
    await scenario({ reference: false, stop: true, cross: true });
    await scenario({ reference: false, failCount: 4, allFailed: true });
    await scenario({ failCount: 2, contradiction: true });
    await writeFile(`${temp}/observations.json`, JSON.stringify(observations, null, 2));
    console.log('11 original-form video retry cases passed: no retry button, single/multiple/cross-origin, references, distinct AI candidates, repeated feedback, pending result, disabled/review/limit guards, stop, finite exhaustion, contradictory reference, continue and native playback. Synthetic course/model only.');
} finally { await context.close(); }
