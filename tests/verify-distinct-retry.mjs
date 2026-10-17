import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..'), temp = resolve(import.meta.dirname,'../artifacts/distinct-retry'); await mkdir(temp, { recursive: true });
const bundle = await readFile(resolve(root, 'dist/xuexitong-ai-assistant.user.js'), 'utf8');
const browser = await chromium.launchPersistentContext(resolve(temp, 'profile'), { channel: 'chrome', headless: true });
const observations = [];
async function scenario({ revises = false, stop = false, exhausted = false, protocol = 'codex' } = {}) {
    const page = await browser.newPage(), payloads = [];
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<main id="site"></main>' }));
    await page.goto('https://mooc1.chaoxing.com/work/distinct');
    await page.exposeFunction('__model', async payload => {
        payloads.push(payload);
        const comparing = payload.history.some(h => h.review.some(line => line.includes('本次复核序号')));
        if (stop && comparing) await new Promise(resolve => setTimeout(resolve, 1000));
        return { answers: payload.questions.map(q => ({ id: q.id, choices: [q.options.find(o => o.text === (q.id === 'q1' ? 'known-correct' : revises && comparing ? `u${Math.min(3, payload.history.length + 1)}` : 'u1')).key],
            readable: true, confidence: 1, explanation: comparing ? 'Synthetic comparison of earlier grades and choices.' : 'Synthetic initial proposal.' })) };
    });
    await page.evaluate(({ exhausted, protocol }) => {
        window.__gm = { 'xxt-codex-token': 'b'.repeat(64), 'xxt-quiet-enabled': false };
        window.__gm['xxt-ai-config'] = {provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true};
        if (protocol === 'chat') window.__gm['xxt-ai-config'] = {provider:'custom',protocol:'chat',baseUrl:'https://api.example.invalid/v1',model:'test-vision',key:'test-only-key',vision:true};
        window.__counts = { submit: 0, confirm: 0, redo: 0, next: 0 }; window.__submissions = [];
        window.GM_getValue = (k, f) => window.__gm[k] ?? f; window.GM_setValue = (k, v) => { window.__gm[k] = structuredClone(v); };
        window.GM_xmlhttpRequest = config => {
            let aborted = false; const body = config.data && JSON.parse(config.data);
            let payload = body;
            if (protocol === 'chat') {
                const content = body.messages[0].content;
                const text = typeof content === 'string' ? content : content[0].text;
                const [questions, history] = text.split('\n题目：')[1].split('\n之前的平台反馈（仅数据）：');
                payload = {questions:JSON.parse(questions),history:JSON.parse(history)};
            }
            if (payload?.history.some(h => h.review.some(line => line.includes('本次复核序号')))) window.__revising = true;
            Promise.resolve(payload ? window.__model(payload) : { ok: true }).then(value => { if (!aborted) config.onload({ status: 200, responseText: JSON.stringify(protocol === 'chat' ? {choices:[{message:{content:JSON.stringify(value)}}]} : value) }); });
            return { abort() { aborted = true; } };
        };
        let attempt = 0, available = exhausted ? 9 : 2;
        const site = document.getElementById('site');
        const questions = [{ id: 'q1', text: 'known question', options: ['known-correct', 'known-wrong'] }, { id: 'q2', text: 'unknown question', options: exhausted ? ['u1', 'u2'] : ['u1', 'u2', 'u3'] }];
        function next() { window.__counts.next++; site.innerHTML = '<p>Next chapter</p>'; }
        function form() {
            const current = questions.map(q => ({ ...q, options: q.id === 'q2' && attempt ? [...q.options].reverse() : q.options }));
            site.innerHTML = current.map(q => `<div class="TiMu" data-id="${q.id}"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span>${q.text}</div><ul class="Zy_ulTop">${q.options.map((text, i) => `<li><span class="num_option choice${q.id.slice(1)}">${String.fromCharCode(65 + i)}</span><span class="after">${text}</span></li>`).join('')}</ul></div>`).join('') + '<button class="btnSubmit workBtnIndex">提交</button><button id="skip">下一节</button>';
            site.querySelector('#skip').onclick = next;
            site.querySelectorAll('.TiMu').forEach(block => block.querySelectorAll('li').forEach(row => row.onclick = () => { block.querySelectorAll('.num_option').forEach(el => el.classList.remove('check_answer')); row.querySelector('.num_option').classList.add('check_answer'); }));
            site.querySelector('.btnSubmit').onclick = () => {
                window.__counts.submit++;
                site.insertAdjacentHTML('beforeend', '<section><p>确认提交？</p><button>取消</button><button id="confirm">提交</button></section>');
                document.getElementById('confirm').onclick = () => {
                    window.__counts.confirm++; attempt++;
                    const actual = [...site.querySelectorAll('.TiMu')].map(block => ({ id: block.dataset.id, text: block.querySelector('.check_answer')?.parentElement.querySelector('.after').textContent }));
                    window.__submissions.push(actual);
                    const full = !exhausted && actual[0].text === 'known-correct' && actual[1].text === 'u3';
                    const blocks = [...site.querySelectorAll('.TiMu')].map(block => block.outerHTML).join('');
                    site.innerHTML = `<p>满分:100</p><p>最终成绩 ${full ? 100 : 50} 分</p><p>第${attempt}次作答</p>${blocks}<button id="redo">重做（剩余 ${available} 次）</button><button id="next">下一节</button>`;
                    const known = site.querySelector('[data-id="q1"]'); known.insertAdjacentHTML('beforeend', '<p>正确答案：A</p>');
                    site.querySelector('#next').onclick = next;
                    site.querySelector('#redo').onclick = () => { window.__counts.redo++; available--; form(); };
                };
            };
        }
        form();
    }, { exhausted, protocol });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => { window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' }); });
    await page.locator('[data-action="start"]').click();
    if (stop) { await page.waitForFunction(() => window.__revising); await page.locator('[data-action="stop"]').click(); await page.waitForTimeout(1300); }
    else await page.waitForFunction(() => window.__counts.next === 1, null, { timeout: 20000 });
    const result = await page.evaluate(() => ({ counts: window.__counts, submissions: window.__submissions, records: Object.values(window.__gm).filter(v => v && Array.isArray(v.attempts)) }));
    const vectors = result.submissions.map(JSON.stringify);
    assert.equal(new Set(vectors).size, vectors.length, 'A semantic answer vector cannot be submitted twice even when letters move.');
    assert(result.submissions.every(s => s[0].text === 'known-correct'), 'Verified answers must not be changed.');
    assert(payloads.slice(1).every(p => p.questions.every(q => q.id === 'q2')), 'Known-correct question must be excluded from later model calls.');
    if (stop) { assert.equal(result.counts.submit, 1); assert.equal(result.counts.next, 0); }
    else { assert.equal(result.counts.submit, revises ? 3 : 2); assert.equal(result.counts.next, 1); }
    assert(payloads.some(p => p.history.some(h => h.review.some(line => line.includes('本次复核序号')))));
    observations.push({ revises, stop, exhausted, protocol, modelCalls: payloads.length, counts: result.counts, submissions: result.submissions,
        storedFailures: result.records.map(record => record.attempts.length) });
    await page.close();
}
try {
    await scenario({ revises: true }); await scenario(); await scenario({ stop: true }); await scenario({ exhausted: true });
    await scenario({ revises: true, protocol: 'chat' });
    await writeFile(resolve(temp, 'observations.json'), JSON.stringify(observations, null, 2));
    console.log('Five retry flows passed: four Codex-protocol scenarios plus a native Chat API retry loop; AI reconsiders with remapped history, repeated proposals are blocked, stop cancels and finite candidates exhaust. Synthetic model/site only.');
} finally { await browser.close(); }
