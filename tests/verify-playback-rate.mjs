import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const bundle = await readFile(resolve(root, 'dist/xuexitong-ai-assistant.user.js'), 'utf8');
const temp = resolve(import.meta.dirname,'../artifacts/playback-rate'); await mkdir(temp, { recursive: true });
const browser = await chromium.launchPersistentContext(resolve(temp, 'profile'), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 1050 }, args: ['--autoplay-policy=no-user-gesture-required'] });
const wav = Buffer.alloc(44 + 8000 * 2 * 120);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const uri = 'data:audio/wav;base64,' + wav.toString('base64');
const observations = [];
const tree = '<div class="prev_title" title="安全知识">安全知识</div><div id="coursetree"><ul><li><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">second</span></div></li></ul></div><button id="next">下一节</button>';
const video = `<video id="video_html5_api" muted controls src="${uri}" style="width:750px;height:420px"></video>`;
async function setup({ cross = false, saved, night = false } = {}) {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: route.request().url().includes('/video/') ? video :
        tree + '<main id="media">' + (cross ? '<iframe src="https://mooc1-1.chaoxing.com/video/first" style="width:850px;height:600px" allow="autoplay"></iframe>' : video) + '</main>' }));
    await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=speed');
    const init = ({ saved, night, reset }) => {
        window.unsafeWindow = window;
        if (reset) sessionStorage.removeItem('test-speed-values');
        window.__gm = JSON.parse(sessionStorage.getItem('test-speed-values') || '{}');
        if (saved !== undefined) window.__gm['xxt-playback-rate'] = saved;
        window.__gm['xxt-quiet-enabled'] = night;
        window.__gm['xxt-ai-config'] = {provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true}; window.GM_getValue = (key, fallback) => window.__gm[key] ?? fallback;
        window.GM_setValue = (key, value) => { window.__gm[key] = structuredClone(value); sessionStorage.setItem('test-speed-values', JSON.stringify(window.__gm)); };
        window.GM_xmlhttpRequest = () => { throw new Error('No model calls are expected in a playback setting test.'); };
    };
    const configure = async (reset = true) => {
        await page.evaluate(init, { saved: reset ? saved : undefined, night, reset });
        if (cross) {
            const frame = page.frames().find(frame => frame.url().includes('/video/'));
            await frame.evaluate(init, { night, reset: true }); await frame.addScriptTag({ content: bundle });
        }
        await page.addScriptTag({ content: bundle });
        await page.evaluate(({ cross, video }) => {
            document.getElementById('next').onclick = () => {
                document.querySelector('.posCatalog_active').classList.remove('posCatalog_active'); document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');
                if (cross) document.querySelector('#media iframe').src = 'https://mooc1-1.chaoxing.com/video/second'; else document.getElementById('media').innerHTML = video;
            };
        }, { cross, video });
        return cross ? page.frames().find(frame => frame.url().includes('/video/')) : page.mainFrame();
    };
    return { page, reader: await configure(), configure, init };
}
async function playing(frame, rate) {
    await frame.waitForFunction(rate => { const v = document.querySelector('video'); return v && !v.paused && v.currentTime > 0.02 && v.playbackRate === rate; }, rate, { timeout: 10000 });
}
try {
    for (const cross of [false, true]) {
        let { page, reader, configure, init } = await setup({ cross });
        const select = page.locator('[data-setting="playback-rate"]');
        assert.equal(await select.inputValue(), '1');
        assert.equal(await select.locator('option[value="1"]').textContent(), '1×（建议）');
        assert.deepEqual(await select.locator('option').evaluateAll(options => options.map(option => option.value)), ['1', '1.25', '1.5', '1.75', '2']);
        await page.locator('[data-action="start"]').click(); await playing(reader, 1);
        await select.selectOption('1.5'); await playing(reader, 1.5);
        if (!cross) {
            const rect = await page.locator('[data-xxt-codex-panel]').boundingBox();
            await page.screenshot({ path: resolve(temp, 'speed-preview.png') });
        }
        await select.selectOption('2'); await playing(reader, 2);
        await page.locator('#next').click();
        if (cross) {
            await page.waitForTimeout(300); reader = page.frames().find(frame => frame.url().includes('/video/second'));
            await reader.evaluate(init, { night: false, reset: true }); await reader.addScriptTag({ content: bundle });
        }
        await playing(reader, 2);
        await page.locator('[data-action="stop"]').click();
        await reader.waitForFunction(() => document.querySelector('video').paused);
        await select.selectOption('1.25'); await page.waitForTimeout(200);
        assert.equal(await reader.evaluate(() => document.querySelector('video').paused), true, 'Changing a setting must not start a stopped video.');
        assert.equal(await reader.evaluate(() => document.querySelector('video').playbackRate), 2, 'Stopped media is left untouched until restart.');
        await page.locator('[data-action="start"]').click(); await playing(reader, 1.25);
        await page.locator('[data-action="stop"]').click();
        await page.reload(); reader = await configure(false);
        assert.equal(await page.locator('[data-setting="playback-rate"]').inputValue(), '1.25', 'Selection survives refresh.');
        await page.locator('[data-action="start"]').click(); await playing(reader, 1.25);
        await page.locator('[data-action="stop"]').click();
        observations.push({ cross, default: 1, rates: [1.5, 2, 1.25], navigation: true, stoppedGuard: true, refresh: true }); await page.close();
    }
    let { page } = await setup({ saved: 'invalid' });
    assert.equal(await page.locator('[data-setting="playback-rate"]').inputValue(), '1');
    observations.push({ invalidSavedValue: 'falls back to 1' }); await page.close();
    ({ page } = await setup({ night: true }));
    await page.evaluate(() => { XxtCodexCore.quietHoursAt = () => true; });
    await page.locator('[data-action="start"]').click(); await page.waitForTimeout(500);
    const before = await page.evaluate(() => { const v = document.querySelector('video'); v.pause(); return v.playbackRate; });
    await page.locator('[data-setting="playback-rate"]').selectOption('2'); await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => { const v = document.querySelector('video'); return [v.paused, v.playbackRate, window.__gm['xxt-playback-rate']]; }), [true, before, 2]);
    observations.push({ night: 'setting saved without operating media' }); await page.close();
    await writeFile(resolve(temp, 'observations.json'), JSON.stringify(observations, null, 2));
    console.log('Playback selection passed on native local/cross-origin media: recommendation, live rate changes, navigation, refresh persistence, stop/night guards and invalid saved value. No model or live course calls.');
} finally { await browser.close(); }
