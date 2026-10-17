import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..'), temp = resolve(import.meta.dirname,'../artifacts/image-questions');
await mkdir(temp, { recursive: true });
const bundle = await readFile(resolve(root, 'dist/xuexitong-ai-assistant.user.js'), 'utf8');
const fixture = await readFile(resolve(root, 'tests/fixtures/image-question.html'), 'utf8');
const browser = await chromium.launchPersistentContext(resolve(temp, 'profile'), { channel: 'chrome', headless: true, viewport: { width: 1450, height: 1100 } });
const generator = await browser.newPage();
const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
const pngs = await generator.evaluate(colors => colors.map(color => { const c = document.createElement('canvas'); c.width = 100; c.height = 60; const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 100, 60); return c.toDataURL('image/png'); }), colors);
await generator.close();
const observations = [];
async function scenario({ cross = false, broken = false, stop = false, stale = false, preview = false, lazy = false, hungFonts = false, hungCapture = false } = {}) {
    const page = await browser.newPage(), counts = { model: 0, image: 0, submit: 0, confirm: 0, next: 0 }, payloads = [];
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/img/')) {
            const index = Number(url.pathname.match(/(\d+)\.png/)?.[1] || 0);
            return route.fulfill({ status: broken ? 404 : 200, contentType: broken ? 'text/plain' : 'image/png', headers: { 'access-control-allow-origin': 'https://denied.chaoxing.com' },
                body: broken ? 'missing image' : Buffer.from(pngs[index % pngs.length].split(',')[1], 'base64') });
        }
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<style>body{margin:20px}.TiMu{width:720px}.after img{width:100px;height:60px}.Zy_ulTop li{list-style:none;padding:6px}.num_option_dx{display:inline-block;width:32px;padding:8px}.check_answer_dx{background:#aaf}</style><main id="site"></main>' });
    });
    await page.goto('https://mooc1.chaoxing.com/work/doHomeWorkNew');
    await page.exposeFunction('__loadImage', async index => { counts.image++; if (stop) await new Promise(resolve => setTimeout(resolve, 600)); return { status: broken ? 404 : 200, bytes: [...Buffer.from(pngs[index % pngs.length].split(',')[1], 'base64')] }; });
    await page.exposeFunction('__model', async payload => { counts.model++; payloads.push(payload); if (stale) await new Promise(resolve => setTimeout(resolve, 1000)); return { answers: payload.questions.map(q => ({ id: q.id, choices: ['A', 'B'], readable: true, confidence: 1, explanation: 'Synthetic image response.' })) }; });
    await page.exposeFunction('__record', action => { counts[action]++; });
    await page.evaluate(({ html, cross }) => {
        window.unsafeWindow = window; window.__gm = { 'xxt-codex-token': 'b'.repeat(64), 'xxt-quiet-enabled': false };
        window.__gm['xxt-ai-config'] = {provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true};
        window.GM_getValue = (key, fallback) => window.__gm[key] ?? fallback; window.GM_setValue = (key, value) => { window.__gm[key] = structuredClone(value); };
        window.GM_xmlhttpRequest = config => {
            let aborted = false;
            if (config.responseType === 'arraybuffer') {
                if (config.headers?.Authorization) throw new Error('Image request must not include bridge credentials.');
                window.__imageLoading = true;
                window.__loadImage(Number(new URL(config.url).pathname.match(/(\d+)\.png/)?.[1] || 0)).then(result => { if (!aborted) config.onload({ status: result.status,
                    responseHeaders: 'Content-Type: image/png', response: new Uint8Array(result.bytes).buffer }); });
            } else {
                if (config.method === 'POST') window.__modelPending = true;
                Promise.resolve(config.method === 'POST' ? window.__model(JSON.parse(config.data)) : { ok: true }).then(value => { if (!aborted) config.onload({ status: 200, responseText: JSON.stringify(value) }); });
            }
            return { abort() { aborted = true; } };
        };
        const site = document.getElementById('site');
        site.innerHTML = html + '<button class="btnSubmit workBtnIndex">提交</button>';
        const host = cross ? 'https://p.ananas.chaoxing.com' : location.origin;
        document.querySelectorAll('.Zy_ulTop > li').forEach((row, index) => {
            row.querySelector('.after').innerHTML = `<img src="${host}/img/${index}.png">`;
            row.onclick = () => row.querySelector('.num_option_dx').classList.toggle('check_answer_dx');
        });
        document.querySelector('.Zy_TItle').insertAdjacentHTML('beforeend', `<img style="display:block;width:100px;height:60px" src="${host}/img/3.png">`);
        document.querySelector('.btnSubmit').onclick = () => {
            window.__record('submit'); site.insertAdjacentHTML('beforeend', '<section><p>确认提交？</p><button>取消</button><button id="confirm">提交</button></section>');
            document.getElementById('confirm').onclick = () => {
                window.__record('confirm'); site.innerHTML = '<p>满分: 100</p><p>最终成绩 100 分</p><button id="next">下一节</button>';
                document.getElementById('next').onclick = () => { window.__record('next'); site.innerHTML = '<p>Next chapter</p>'; };
            };
        };
    }, { html: fixture, cross });
    await page.waitForFunction(() => [...document.querySelectorAll('.TiMu img')].every(img => img.complete));
    if (lazy) await page.evaluate(data => {
        const image = document.querySelector('.after img'); image.dataset.src = image.src; image.src = data;
    }, pngs[3]);
    await page.addScriptTag({ content: bundle });
    if (hungFonts || hungCapture) await page.evaluate(({ hungFonts }) => {
        const timer = window.setTimeout; window.setTimeout = (fn, ms, ...args) => timer(fn, ms === 8000 || ms === 20000 ? 80 : ms, ...args);
        if (hungFonts) Object.defineProperty(document.fonts, 'ready', { configurable: true, get: () => new Promise(() => {}) });
        else window.html2canvas = () => new Promise(() => {});
    }, { hungFonts });
    await page.locator(`[data-action="${preview ? 'solve' : 'start'}"]`).click();
    if (hungFonts || hungCapture) await page.waitForFunction(() => /字体加载超时|截图生成超时/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent || ''));
    else if (stop) {
        await page.waitForFunction(() => window.__imageLoading); await page.locator('[data-action="stop"]').click(); await page.waitForTimeout(1100);
    } else if (stale) {
        await page.waitForFunction(() => window.__modelPending); await page.evaluate(() => { document.querySelector('.after img').src = '/img/3.png'; }); await page.waitForTimeout(1500);
    } else if (broken) await page.waitForFunction(() => /图片.*(失败|无效|读取)/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent || ''));
    else if (preview) await page.waitForFunction(() => document.querySelector('[data-xxt-codex-panel] pre')?.textContent.includes('Synthetic image response'));
    else await page.waitForFunction(() => !document.getElementById('next') && document.getElementById('site').textContent === 'Next chapter');
    if (broken || stop || stale || preview || hungFonts || hungCapture) assert.equal(counts.submit, 0);
    if (broken || stop || hungFonts || hungCapture) assert.equal(counts.model, 0);
    if (!broken && !stop && !stale && !hungFonts && !hungCapture) {
        assert.equal(counts.model, 1);
        assert(payloads[0].questions[0].options.every(o => o.imageKey && o.text));
        const pixels = await page.evaluate(async data => {
            const img = new Image(); img.src = data; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); const pixels = ctx.getImageData(0, 0, c.width, c.height).data, counts = [0, 0, 0, 0];
            for (let i = 0; i < pixels.length; i += 4) { if (pixels[i] > 230 && pixels[i + 1] < 20 && pixels[i + 2] < 20) counts[0]++; if (pixels[i] < 20 && pixels[i + 1] > 230 && pixels[i + 2] < 20) counts[1]++; if (pixels[i] < 20 && pixels[i + 1] < 20 && pixels[i + 2] > 230) counts[2]++; if (pixels[i] > 230 && pixels[i + 1] > 230 && pixels[i + 2] < 20) counts[3]++; }
            return counts;
        }, payloads[0].images[0]);
        assert(pixels.every(count => count > 500), `Actual html2canvas omitted images: ${pixels}`);
        assert(pixels[3] > 20000, 'Both the yellow stem image and the yellow option must be present.');
        if (!preview) assert.deepEqual({ submit: counts.submit, confirm: counts.confirm, next: counts.next }, { submit: 1, confirm: 1, next: 1 });
        if (cross) assert(counts.image > 0, 'Non-CORS images must exercise the userscript fetch fallback.');
        observations.push({ cross, preview, lazy, counts, coloredPixels: pixels });
        if (!cross && !preview) await writeFile(resolve(temp, 'question-capture.png'), Buffer.from(payloads[0].images[0].split(',')[1], 'base64'));
    } else observations.push({ cross, broken, stop, stale, hungFonts, hungCapture, counts });
    await page.close();
}
try {
    await scenario(); await scenario({ cross: true }); await scenario({ broken: true });
    await scenario({ cross: true, stop: true }); await scenario({ stale: true }); await scenario({ preview: true }); await scenario({ lazy: true });
    await scenario({ hungFonts: true }); await scenario({ hungCapture: true });
    await writeFile(resolve(temp, 'observations.json'), JSON.stringify(observations, null, 2));
    console.log('Nine image-question flows passed: original real html2canvas pixel checks plus bounded font/capture hangs without model calls or submission. Model/site/GM responses are synthetic; no live course or model calls.');
} finally { await browser.close(); }
