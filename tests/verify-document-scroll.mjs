import {fileURLToPath} from 'node:url';
import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Structure observed read-only in the user's Edge course on 2026-10-16.
// URLs/content below are synthetic; no signed source URL, course identifiers or model requests.
let bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
if (process.argv.includes('--debug')) bundle = bundle
    .replace('notify(`正在打开文献：${entry.label}`);', 'window.__docEvents.push({open:entry.id,task,at:Date.now(),completed:[...completed]}); notify(`正在打开文献：${entry.label}`);')
    .replace("if (data.type === 'document-finished') {", "if (data.type === 'document-finished') { window.__docEvents.push({received:data.documentIds,at:Date.now(),assets:pageInventory().documents.map(x=>({id:x.id,file:x.entry?.id,inline:x.entry?.inline,tag:x.entry?.element.tagName,same:x.root===event.source,desc:descendant(x.root,event.source)}))});");
const temp = fileURLToPath(new URL('../artifacts/document-scroll',import.meta.url));
await mkdir(temp, { recursive: true });
const context = await chromium.launchPersistentContext(`${temp}/profile`, { channel: 'chrome', headless: true });
const observations = [];
function init() {
    window.__docEvents = [];
    window.unsafeWindow = window;
    window.__offset = 0;
    const now = Date.now.bind(Date); Date.now = () => now() + window.__offset;
    window.__gm = {'xxt-quiet-enabled':false,'xxt-ai-config':{provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true}};
    window.GM_getValue = (key, fallback) => window.__gm[key] ?? fallback;
    window.GM_setValue = (key, value) => { window.__gm[key] = structuredClone(value); };
    window.__documentGranted = false;
    window.addEventListener('message', event => {
        if (event.data?.source === 'xxt-codex-0.3' && event.data.type === 'grant-document') window.__documentGranted = true;
    });
    window.__calls = 0;
    window.GM_xmlhttpRequest = config => {
        if (config.method === 'POST') window.__calls++;
        setTimeout(() => config.onload({ status: 200, responseText: JSON.stringify(config.method === 'GET' ? { ok: true } : {
            answers: [{ id: 'q1', choices: ['A'], readable: true, confidence: 1, explanation: 'Synthetic test answer.' }]
        }) }), 0);
        return { abort() {} };
    };
}
async function fixture({ cross = true, quiz = false, lazy = false, opaque = false, short = false } = {}) {
    const page = await context.newPage();
    const host = cross ? 'pan-yz.chaoxing.com' : 'mooc1.chaoxing.com';
    const course = '<div class="prev_title" title="安全知识">安全知识</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">second</span></div></div><button id="next">下一节</button>' +
        (quiz ? '<button class="prev_white" id="check">2 学习检测</button>' : '') +
        '<iframe id="iframe" src="/mooc-ans/knowledge/cards" style="width:900px;height:600px"></iframe><main id="view"></main><div style="height:2000px">Outside reader</div>';
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        // Use a client redirect so Playwright also intercepts the destination; HTTP redirects
        // are handled as one routed chain and would escape this synthetic page handler.
        if (url.pathname === '/mooc-ans/screen/file') return route.fulfill({ contentType: 'text/html', body: `<script>location.replace('https://${host}/screen/v2/file_fixture')</script>` });
        const body = url.pathname.includes('/knowledge/cards') ? '<iframe class="ans-attach-online insertdoc-online-pdf" src="/ananas/modules/pdf/index.html" style="width:850px;height:550px"></iframe>' :
            url.pathname.includes('/modules/pdf/') ? '<div id="docContainer"><div id="img"><iframe id="panView" title="文档" src="/mooc-ans/screen/file" style="width:800px;height:500px"></iframe></div></div>' :
            url.pathname.includes('/screen/v2/') ? `<!doctype html><style>body{margin:0;overflow:auto}li{height:${short ? 100 : 900}px;list-style:none}ul{margin:0;padding:0}</style><div class="fileBox"><ul>${Array.from({ length: short ? 1 : 11 }, (_, i) => `<li id="anchor${i + 1}">Synthetic page ${i + 1}</li>`).join('')}</ul></div><div class="preview-dialog__footer"><input id="zoomSlider" type="range"></div>` : course;
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body });
    });
    await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=synthetic');
    const cards = page.frames().find(f => f.url().includes('/knowledge/cards'));
    const pdf = page.frames().find(f => f.url().includes('/modules/pdf/'));
    const leaf = page.frames().find(f => f.url().includes('/screen/v2/'));
    assert(cards && pdf && leaf, 'All three observed reader layers loaded.');
    await leaf.waitForFunction(() => !!document.getElementById('anchor1'));
    for (const frame of page.frames()) { await frame.evaluate(init); if (!(opaque && frame === leaf)) await frame.addScriptTag({ content: bundle }); }
    await page.evaluate(() => {
        window.__next = 0; window.__checks = 0; window.__submits = 0; window.__bottomAtNavigation = null;
        document.getElementById('next').onclick = () => {
            window.__next++; document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');
            document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');
            setTimeout(() => { document.getElementById('iframe').hidden = true; }, 1000);
        };
        document.getElementById('check')?.addEventListener('click', () => {
            window.__checks++;
            document.querySelector('.prev_title').title = '学习检测';
            document.getElementById('view').innerHTML = '<div class="TiMu"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span>1+1?</div><ul class="Zy_ulTop"><li><span class="num_option choice1">A</span><a class="after">2</a></li><li><span class="num_option choice1">B</span><a class="after">3</a></li></ul></div><a class="btnSubmit workBtnIndex">提交</a>';
            document.querySelectorAll('.num_option').forEach(x => x.onclick = () => x.classList.add('check_answer'));
            document.querySelector('.btnSubmit').onclick = () => { window.__submits++; document.getElementById('view').innerHTML = '<p>满分:100</p><p>最终成绩 100 分</p>'; };
        });
        window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' });
    });
    if (lazy) await leaf.evaluate(() => {
        window.__grown = false;
        window.addEventListener('scroll', () => {
            const e = document.scrollingElement;
            if (!window.__grown && e.scrollTop >= e.scrollHeight - e.clientHeight - 3) {
                window.__grown = true; const li = document.createElement('li'); li.id = 'anchor12'; li.textContent = 'Lazy page';
                document.querySelector('.fileBox ul').append(li);
            }
        });
    });
    return { page, cards, pdf, leaf };
}
const position = frame => frame.evaluate(() => {
    const e = document.scrollingElement; return { top: e.scrollTop, max: Math.max(0, e.scrollHeight - e.clientHeight), grown: !!window.__grown };
});
try {
    if (!process.argv.includes('--workflow-only')) {
    for (const cross of [false, true]) {
        const f = await fixture({ cross, lazy: true });
        await f.page.evaluate(() => window.scrollTo(0, 200));
        const outside = await f.page.evaluate(() => window.scrollY);
        const read = p => f.cards.evaluate(async progress => {
            const entry = XxtCodexDocuments.find(document)[0];
            return await XxtCodexDocuments.scroll(document, progress, entry.element);
        }, p);
        const partial = await read(0.5); const half = await position(f.leaf);
        if (!(half.top > 0 && half.top < half.max)) console.log(JSON.stringify({ cross, partial, half, frames: f.page.frames().map(x => new URL(x.url()).pathname) }));
        assert.equal(partial.unavailable, 0);
        assert(half.top > 0 && half.top < half.max, 'Reader internal scrollbar moved partially.');
        await read(1); await f.leaf.waitForFunction(() => window.__grown);
        const result = await read(1), end = await position(f.leaf);
        assert.equal(result.unavailable, 0); assert(result.count > 0 && result.bottom);
        assert(Math.abs(end.max - end.top) <= 2, 'New lazy page is included at the actual bottom.');
        assert.equal(await f.page.evaluate(() => window.scrollY), outside, 'Course page was not scrolled.');
        observations.push({ case: cross ? 'cross-origin nested lazy reader' : 'same-origin nested lazy reader', half, end, result });
        await f.page.close();
    }
    {
        const f = await fixture({ short: true });
        const result = await f.pdf.evaluate(() => XxtCodexDocuments.scroll(document, 1, document.getElementById('panView')));
        assert(result.bottom && result.count > 0 && !result.unavailable);
        observations.push({ case: 'short document already fits', result }); await f.page.close();
    }
    {
        const f = await fixture({ opaque: true });
        const result = await f.pdf.evaluate(() => XxtCodexDocuments.scroll(document, 1, document.getElementById('panView')));
        assert.equal(result.unavailable, 1); assert.equal(result.bottom, false);
        observations.push({ case: 'unresponsive child is not verified', result }); await f.page.close();
    }
    {
        const f = await fixture();
        await f.leaf.evaluate(() => {
            window.__gm['xxt-quiet-enabled'] = true;
            XxtCodexCore.quietHoursAt = () => true;
        });
        const result = await f.pdf.evaluate(() => XxtCodexDocuments.scroll(document, 1, document.getElementById('panView')));
        assert.equal(result.unavailable, 1); assert.equal((await position(f.leaf)).top, 0);
        observations.push({ case: 'night rest rejects reader scrolling', result }); await f.page.close();
    }
    }
    for (const quiz of process.argv.includes('--workflow-only') ? [false] : [false, true]) {
        const f = await fixture({ quiz, lazy: true });
        await f.page.locator('[data-action="start"]').click();
        await f.page.waitForFunction(() => /文献已打开/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent));
        const owners = await Promise.all(f.page.frames().map(frame => frame.evaluate(() => window.__documentGranted)));
        // The coordinator now reads an accessible file itself when no worker has
        // claimed it yet. Zero remote owners is valid; two are never valid.
        assert(owners.filter(Boolean).length <= 1, 'At most one nested reader is granted the task.');
        for (const frame of f.page.frames()) await frame.evaluate(() => { window.__offset += 49000; });
        await f.leaf.waitForFunction(() => document.scrollingElement.scrollTop > 0);
        assert.equal(await f.page.evaluate(() => window.__next), 0, 'No early exit before 60 seconds.');
        for (const frame of f.page.frames()) await frame.evaluate(() => { window.__offset += 12000; });
        await f.page.waitForFunction(() => window.__next === 1, null, { timeout: 16000 }).catch(async error => {
            for (const frame of f.page.frames()) console.log(JSON.stringify({ path: new URL(frame.url()).pathname,
                state: await frame.evaluate(() => ({ status: document.querySelector('[data-xxt-codex-panel] pre')?.textContent,
                    next: window.__next, checks: window.__checks, docs: Object.keys(window.__gm).filter(k => k.startsWith('xxt-documents:')),
                    docEvents: window.__docEvents, values: Object.fromEntries(Object.entries(window.__gm).filter(([k]) => k.startsWith('xxt-documents:'))),
                    top: document.scrollingElement?.scrollTop, height: document.scrollingElement?.scrollHeight })) }));
            throw error;
        });
        const end = await position(f.leaf);
        if (!(end.grown && end.max - end.top <= 2)) {
            console.log('Scroll workflow did not verify the leaf', JSON.stringify({ quiz, end, owners }));
            for (const frame of f.page.frames()) console.log(JSON.stringify({ path: new URL(frame.url()).pathname,
                info: await frame.evaluate(() => ({ status: document.querySelector('[data-xxt-codex-panel] pre')?.textContent,
                    entries: XxtCodexDocuments.find(document).map(x => x.id), rects: [...document.querySelectorAll('iframe')].map(x => ({ src: x.getAttribute('src'), rect: x.getBoundingClientRect().toJSON() })) })) }));
        }
        assert(end.grown && end.max - end.top <= 2, 'Workflow reached lazy last page before leaving.');
        const counts = await f.page.evaluate(() => ({ next: window.__next, checks: window.__checks, submits: window.__submits, calls: window.__calls }));
        assert.equal(counts.checks, quiz ? 1 : 0); assert.equal(counts.submits, quiz ? 1 : 0);
        observations.push({ case: quiz ? '60s -> chapter check -> next' : '60s -> next without check', end, counts });
        await f.page.close();
    }
    {
        const f = await fixture();
        await f.page.locator('[data-action="start"]').click();
        await f.page.waitForFunction(() => /文献已打开/.test(document.querySelector('[data-xxt-codex-panel] pre')?.textContent));
        await f.page.locator('[data-action="stop"]').click();
        await f.page.waitForTimeout(300);
        const before = await position(f.leaf);
        for (const frame of f.page.frames()) await frame.evaluate(() => { window.__offset += 65000; });
        await f.page.waitForTimeout(1000);
        assert.equal((await position(f.leaf)).top, before.top); assert.equal(await f.page.evaluate(() => window.__next), 0);
        observations.push({ case: 'stop cancels further scroll and navigation', before }); await f.page.close();
    }
    await writeFile(`${temp}/observations.json`, JSON.stringify(observations, null, 2));
    console.log(`${observations.length} document scroll cases passed. Real reader structure; synthetic pages, clock and model. No course task completion claimed.`);
} finally { await context.close(); }
