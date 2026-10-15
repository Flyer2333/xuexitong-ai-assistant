import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
const temp = resolve(import.meta.dirname,'../artifacts/video-quiz'); await mkdir(temp, { recursive: true });
const browser = await chromium.launchPersistentContext(resolve(temp, 'profile'), { channel: 'chrome', headless: true, viewport: { width: 1450, height: 1100 }, args: ['--autoplay-policy=no-user-gesture-required'] });
const wav = Buffer.alloc(44 + 8000 * 2 * 12);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const media = `data:audio/wav;base64,${wav.toString('base64')}`;
const observations = [];
async function scenario({ child = false, cross = false, type = 'multiple', retry = false, sequential = false, stopped = false, stale = false, generic = false, spinner = false } = {}) {
    const page = await browser.newPage();
    const counts = { model: 0, submit: 0, retry: 0, proceed: 0, check: 0, next: 0 };
    await page.exposeFunction('__record', name => { counts[name]++; });
    const html = '<div class="prev_title" title="安全知识">安全知识</div><div id="coursetree"><ul><li><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">second</span></div></li></ul></div><button class="prev_white" id="check">2 学习检测</button><button id="next">下一节</button>';
    const video = '<div class="video-js"><video id="video_html5_api" controls muted style="width:850px;height:500px"></video><main id="overlay"></main></div>';
    const src = cross ? 'https://mooc1-1.chaoxing.com/ananas/modules/video/index.html' : 'https://mooc1.chaoxing.com/ananas/modules/video/index.html';
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: route.request().url().includes('/ananas/') ? video : html + (child ? `<iframe src="${src}" style="width:950px;height:700px"></iframe>` : video) }));
    await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=videoquiz');
    const owner = page.mainFrame(), reader = child ? page.frames().find(frame => frame.url().includes('/ananas/')) : owner;
    const init = () => {
        window.unsafeWindow = window;
        window.__gm = { 'xxt-codex-token': 'b'.repeat(64), 'xxt-quiet-enabled': false };
        window.__gm['xxt-ai-config'] = {provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true}; window.GM_getValue = (key, fallback) => window.__gm[key] ?? fallback;
        window.GM_setValue = (key, value) => { window.__gm[key] = structuredClone(value); };
        window.GM_xmlhttpRequest = config => {
            if (config.method === 'POST') window.__record('model');
            const payload = config.data ? JSON.parse(config.data) : null;
            setTimeout(() => config.onload({ status: 200, responseText: JSON.stringify(payload ? { answers: payload.questions.map(q => ({ id: q.id,
                choices: window.__wrongFirst ? ['A'] : q.type === 'multiple' ? ['A', 'B', 'C', 'D'] : ['A'], readable: true, confidence: 1, explanation: 'Synthetic answer.' })) } : { ok: true }) }), 1000);
            return { abort() {} };
        };
    };
    await owner.evaluate(init); if (child) await reader.evaluate(init);
    await owner.evaluate(() => {
        window.__check = 0; window.__next = 0;
        document.getElementById('check').onclick = () => { window.__record('check'); window.__check++; document.querySelector('.prev_title').title = '学习检测'; };
        document.getElementById('next').onclick = () => {
            window.__record('next'); window.__next++;
            document.querySelector('.posCatalog_active').classList.remove('posCatalog_active'); document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');
        };
    });
    await reader.evaluate(({ media, type, retry, sequential, generic, spinner }) => {
        const video = document.querySelector('video'); video.src = media; video.load();
        window.__wrongFirst = retry; window.__stage = 0; window.__submits = 0;
        window.__showQuestion = () => {
            video.pause();
            document.getElementById('overlay').innerHTML = '<div data-popup class="' + (generic ? 'unknown-popup-class' : 'ans-videoquiz') + '" style="position:absolute;top:120px;left:25px;width:800px;height:430px;background:#151515;color:white"><h3 class="ans-videoquiz-type">' +
                (type === 'multiple' ? '多选题' : type === 'boolean' ? '判断题' : '单选题') + '</h3><p class="ans-videoquiz-tit">' + (window.__stage ? '第二次弹题：哪些选项正确？' : '视频中弹出的测试题：哪些选项正确？') + '</p><div class="ans-videoquiz-opt">' +
                (type === 'boolean' ? ['对', '错'] : ['选项一', '选项二', '选项三', '选项四']).map((text, index) => '<label style="display:block;padding:10px"><input name="quiz" type="' +
                    (type === 'multiple' ? 'checkbox' : 'radio') + '">' + String.fromCharCode(65 + index) + '、' + text + '</label>').join('') + '</div><div role="button" class="ans-videoquiz-submit">提交</div></div>';
            document.querySelector('.ans-videoquiz-submit').onclick = () => {
                window.__record('submit'); window.__submits++;
                if (retry && window.__submits === 1) {
                    document.querySelector('[data-popup]').insertAdjacentHTML('beforeend', '<div data-quiz-feedback>回答错误，正确答案：ABCD</div><button id="retry">重试</button>');
                    document.getElementById('retry').onclick = () => { window.__record('retry'); window.__wrongFirst = false; window.__showQuestion(); };
                } else {
                    const panel = document.querySelector('[data-popup]');
                    const feedback = () => {
                    panel.innerHTML = '<div data-quiz-feedback>回答正确</div><button id="proceed">继续播放</button>';
                    document.getElementById('proceed').onclick = () => {
                        window.__record('proceed');
                        setTimeout(() => {
                            document.getElementById('overlay').replaceChildren();
                            if (sequential && !window.__stage) { window.__stage++; window.__showQuestion(); }
                        }, 350);
                    };
                    };
                    if (spinner) {
                        panel.textContent = '正在判题，请稍候';
                        setTimeout(() => { window.__earlyResume = !video.paused; }, 300);
                        setTimeout(feedback, 600);
                    } else feedback();
                }
            };
        };
    }, { media, type, retry, sequential, generic, spinner });
    await owner.addScriptTag({ content: bundle }); if (child) await reader.addScriptTag({ content: bundle });
    for (const frame of child ? [owner, reader] : [owner]) await frame.evaluate(() => { window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' }); });
    await reader.evaluate(() => window.__showQuestion());
    await owner.locator('[data-action="start"]').click();
    await page.waitForFunction(() => true);
    await reader.waitForFunction(() => !!window.__gm && document.querySelector('video').paused);
    if (stopped || stale) {
        await reader.waitForFunction(() => document.querySelector('[data-xxt-codex-panel] pre')?.textContent.includes('正在作答') ||
            Object.keys(window.__gm).some(key => key.startsWith('xxt-video-quiz:')) || document.querySelector('input:checked'), null, { timeout: 8000 }).catch(() => {});
        // The model response is intentionally delayed, leaving a meaningful stop/navigation window.
        if (stopped) await owner.locator('[data-action="stop"]').click();
        else await owner.evaluate(() => document.getElementById('next').click());
        await page.waitForTimeout(1400);
        assert.equal(counts.submit, 0, 'Old answers cannot be submitted after stopping or navigating.');
    } else {
        await reader.waitForFunction(() => !document.querySelector('[data-popup]'), null, { timeout: 16000 });
        await reader.waitForFunction(() => document.querySelector('video').currentTime > 0.1 && !document.querySelector('video').paused, null, { timeout: 6000 });
        assert.equal(counts.check, 0, 'An answered video popup must resume video before entering a chapter quiz.');
        assert.equal(counts.next, 0);
        if (spinner) assert.equal(await reader.evaluate(() => window.__earlyResume), false, 'A judging spinner is not permission to resume media.');
        assert.equal(counts.submit, retry || sequential ? 2 : 1);
        assert.equal(counts.model, sequential ? 2 : 1, 'Platform reference answers avoid a second model request on retry.');
        assert.equal(counts.proceed, sequential ? 2 : 1, 'Continue is clicked only once per popup, including delayed closure.');
        await reader.evaluate(() => { const video = document.querySelector('video'); video.currentTime = video.duration - 0.05; });
        await owner.waitForFunction(() => window.__check === 1, null, { timeout: 6500 });
        await owner.locator('[data-action="stop"]').click();
    }
    observations.push({ child, cross, type, retry, sequential, stopped, stale, generic, spinner, counts }); await page.close();
}
try {
    if (process.argv.includes('--targeted')) {
        await scenario({ generic: true, spinner: true }); await scenario({ child: true, cross: true, stale: true });
        await writeFile(resolve(temp, 'targeted-observations.json'), JSON.stringify(observations, null, 2));
        console.log('Generic popup class and cross-origin stale-navigation scenarios passed.');
    } else {
    await scenario(); await scenario({ type: 'single' }); await scenario({ type: 'boolean' });
    await scenario({ child: true }); await scenario({ child: true, cross: true });
    await scenario({ retry: true }); await scenario({ sequential: true });
    await scenario({ stopped: true }); await scenario({ stale: true });
    await scenario({ child: true, cross: true, stopped: true }); await scenario({ child: true, cross: true, stale: true });
    await scenario({ generic: true });
    await writeFile(resolve(temp, 'observations.json'), JSON.stringify(observations, null, 2));
    console.log('12 video popup scenarios passed: native media resumes before chapter check; single/multiple/boolean, same/cross-origin frames, reference-answer retry, sequential popups, stop and stale navigation, generic popup class. Synthetic site/model only.');
    }
} finally { await browser.close(); }
