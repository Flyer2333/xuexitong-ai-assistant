import {fileURLToPath} from 'node:url';
import { chromium } from './browser-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
let bundle = await readFile(new URL('../dist/xuexitong-ai-assistant.user.js', import.meta.url), 'utf8');
if (process.argv.includes('--debug')) bundle = bundle
    .replace('function nextStudyStep() {', 'function nextStudyStep() { window.__event?.("steps:"+currentCard+":"+[...stepDone]);')
    .replace('if (task === value) return;', 'if (task === value) return; window.__event?.("task:"+value);');
const temp = fileURLToPath(new URL('../artifacts/page-tasks',import.meta.url));
await mkdir(temp,{recursive:true});
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const wav = Buffer.alloc(44 + 8000 * 2 * 30);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const media = `data:audio/wav;base64,${wav.toString('base64')}`;
const observations = [];
const marker = '<div class="ans-job-icon" aria-label="任务点未完成"></div>';
const videoFrame = (n, cross = false) => `<div class="ans-attach-ct videoContainer" id="ext-gen1050" data-video="${n}">${marker}<iframe class="ans-insertvideo-online" jobid="video-${n}" objectid="object-${n}" src="${cross ? 'https://mooc1-1.chaoxing.com' : ''}/ananas/modules/video/index.html?n=${n}" style="width:850px;height:350px"></iframe></div>`;
async function scenario({ name, mixed = false, lazy = false, unknown = false, lag = false, stop = false, cross = false, replay = false, replayFails = false, stopReplay = false, heal = false, stopRecovery = false, onlyRecovery = false, quietRecovery = false, promptNext = false, unknownAfterResult = false, background = false, noAi = false, popup = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
    const events = [];
    await context.exposeBinding('__event', (_, value) => events.push(value));
    await context.addInitScript(() => {
        window.unsafeWindow = window; window.__offset = 0;
        window.__settlementMessages = [];
        window.addEventListener('message', e => { if (['settle-video','grant-video','stop'].includes(e.data?.type)) window.__settlementMessages.push({type:e.data.type,task:e.data.task,mediaId:e.data.mediaId}); });
        const now = Date.now.bind(Date); Date.now = () => now() + window.__offset;
        window.GM_getValue = (key, fallback) => { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); };
        window.GM_setValue = (key, value) => localStorage.setItem(key, JSON.stringify(value));
        GM_setValue('xxt-ai-config',{provider:'codex',protocol:'codex',baseUrl:'http://127.0.0.1:18763',key:'b'.repeat(64),vision:true}); GM_setValue('xxt-quiet-enabled', false); GM_setValue('xxt-codex-token', 'b'.repeat(64));
        window.GM_xmlhttpRequest = config => {
            const payload = config.data && JSON.parse(config.data);
            if (payload) window.__event('model');
            else window.__event('probe');
            setTimeout(() => config.onload({ status: 200, responseText: JSON.stringify(payload ? { answers: payload.questions.map(q => ({ id: q.id, choices: ['A'], confidence: 1, readable: true, explanation: 'Synthetic' })) } : { ok: true }) }), payload ? 30 : 1200);
            return { abort() {} };
        };
    });
    if (noAi) await context.addInitScript(() => { GM_setValue('xxt-ai-enabled',false); GM_setValue('xxt-ai-config',{}); });
    await context.route('**/*', async route => {
        const u = new URL(route.request().url());
        let body;
        if (u.pathname === '/mycourse/studentstudy') body = `<div class="prev_title">Synthetic multi task chapter</div><div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div><div class="posCatalog_select"><span class="posCatalog_name">second</span></div></div><ul><li id="dct1" cardid="a" class="c1" onclick="changeCard(0)"><div class="prev_white">1 安全知识</div></li><li id="dct2" cardid="b" class="active" onclick="changeCard(1)"><div class="prev_white">2 学习检测</div></li></ul><iframe id="iframe" src="/mooc-ans/knowledge/cards?num=0" style="width:1000px;height:900px"></iframe><button id="next">下一节</button><script>window.changeCard=n=>{__event('card:'+n);document.getElementById('iframe').src='/mooc-ans/knowledge/cards?num='+n};const advance=()=>{__event('next');document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');document.querySelectorAll('.posCatalog_select')[1].classList.add('posCatalog_active');document.getElementById('iframe').remove()};document.getElementById('next').onclick=()=>{if(!${promptNext})return advance();__event('nav-prompt');const d=document.createElement('div');d.setAttribute('role','dialog');d.innerHTML='<p>当前章节还有任务点未完成，是否去完成？</p><button>去学习</button><button class="confirm-next">下一节</button>';document.body.append(d);d.querySelector('.confirm-next').onclick=()=>{__event('nav-confirm');d.remove();advance()}};</script>`;
        else if (u.pathname === '/mooc-ans/knowledge/cards') {
            if (u.searchParams.get('num') === '1') body = '<iframe src="/work?second=1" style="width:850px;height:500px"></iframe>' + (unknownAfterResult ? `<div class="ans-attach-ct" data-unknown>${marker}<p>Unsupported after graded result</p></div>` : '');
            else body = videoFrame(1, cross) + (lazy ? '<div id="late"></div>' : videoFrame(2, cross)) +
                (mixed ? `<div class="ans-attach-ct" data-file>${marker}<button class="file" title="Synthetic.pdf">Synthetic.pdf</button><div id="view"></div></div><div class="ans-attach-ct" data-work>${marker}<iframe src="/work" style="width:850px;height:500px"></iframe></div>` : '') +
                (unknown ? `<div class="ans-attach-ct" data-unknown>${marker}<p>Unsupported required task</p></div>` : '') +
                `<script>window.addEventListener('message',event=>{if(event.data?.testSettlement&&!${replayFails})setTimeout(()=>document.querySelector('[data-video="2"]').classList.add('ans-job-finished'),700);if(event.data?.testEnd){const n=event.data.testEnd;if((!${lag}&&!${replay})||n!==2)document.querySelector('[data-video="'+n+'"]').classList.add('ans-job-finished');if(n===1&&${lazy})setTimeout(()=>{document.getElementById('late').innerHTML=${JSON.stringify(videoFrame(2, cross))}},400)}});
                document.querySelector('.file')?.addEventListener('click',()=>{__event('doc-open');document.getElementById('view').innerHTML='<div role="dialog" class="modal"><button aria-label="关闭">×</button><div class="doc-preview" style="height:260px;overflow:auto"><canvas height="3000"></canvas></div></div>';document.querySelector('.modal button').onclick=()=>{__event('doc-close');document.querySelector('[data-file]').classList.add('ans-job-finished');document.getElementById('view').replaceChildren()}});</script>`;
        } else if (u.pathname.includes('/modules/video/')) body = `<video id="video_html5_api" muted controls style="width:800px;height:300px" ${u.searchParams.get('n') === '1' ? `src="${media}"` : ''}></video><button class="vjs-big-play-button" title="播放视频">播放视频</button><script>const v=document.querySelector('video'),n=${Number(u.searchParams.get('n'))};document.querySelector('button').onclick=()=>{if(!v.src)v.src=${JSON.stringify(media)};v.play();};v.addEventListener('play',()=>__event('play:'+n));if(${replay}&&n===2){const b=document.createElement('button');b.className='vjs-play-control vjs-control vjs-button vjs-paused';b.title='重播';b.type='button';b.setAttribute('aria-disabled','false');b.innerHTML='<span aria-hidden="true" class="vjs-icon-placeholder"></span><span class="vjs-control-text" aria-live="polite">重播</span>';document.body.append(b);v.addEventListener('ended',()=>b.classList.add('vjs-ended'));b.onclick=()=>{__event('replay:'+n);v.play();window.parent.postMessage({testSettlement:true},'*')}}v.addEventListener('ended',()=>{__event('ended:'+n);window.parent.postMessage({testEnd:n},'*')});</script>`;
        else if (u.pathname === '/work') body = `<div class="TiMu"><div class="Zy_TItle"><span class="newZy_TItle">【单选题】</span>${u.searchParams.has('second') ? 'Second card' : 'Inline card'} 1+1?</div><ul class="Zy_ulTop"><li><span class="num_option choice1">A</span><a class="after">2</a></li><li><span class="num_option choice1">B</span><a class="after">3</a></li></ul></div><a class="btnSubmit workBtnIndex">提交</a><script>document.querySelectorAll('.num_option').forEach(x=>x.onclick=()=>x.classList.add('check_answer'));document.querySelector('.btnSubmit').onclick=()=>{__event('submit');window.frameElement.closest('.ans-attach-ct')?.classList.add('ans-job-finished');document.body.innerHTML='<p>满分:100</p><p>最终成绩100分</p>'};</script>`;
        else return route.fulfill({ body: '' });
        await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><style>body{margin:8px}iframe{border:0}li[cardid]{display:inline-block;margin:10px}</style>${body}<script>${bundle.replaceAll('</script', '<\\/script')}\nwindow.html2canvas=async()=>({toDataURL:()=> 'data:image/png;base64,iVBORw0KGgo='});</script>` });
    });
    const page = await context.newPage();
    try {
        await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=synthetic');
        await page.locator('[data-action="start"]').click();
        const first = page.frames().find(frame => frame.url().includes('/modules/video/') && frame.url().includes('n=1'));
        await first.waitForFunction(() => !document.querySelector('video').paused);
        if (noAi) {
            assert.equal(await page.locator('[data-setting="ai-mode"]').inputValue(),'off');
            assert(await page.locator('[data-action="connect"]').isDisabled());
            assert(await page.locator('[data-action="solve"]').isDisabled());
        }
        if (popup) {
            const html = await readFile(new URL('./fixtures/video-quiz-synthetic.html',import.meta.url),'utf8');
            await first.evaluate(html => { const box=document.createElement('section');box.className='ans-videoquiz';box.innerHTML=html;box.querySelector('#videoquiz-continue').style.display='none';document.body.append(box);document.querySelector('video').pause(); },html);
        }
        assert(!events.includes('model')); assert(!events.includes('card:1'));
        if (!popup) await first.evaluate(() => { const v = document.querySelector('video'); v.currentTime = v.duration - 0.05; });
        await page.waitForFunction(() => [...document.querySelectorAll('iframe')].length > 0);
        let second;
        for (let n = 0; n < 40 && !second; n++) { second = page.frames().find(frame => frame.url().includes('/modules/video/') && frame.url().includes('n=2')); if (!second) await page.waitForTimeout(100); }
        assert(second, 'A late second iframe must still be found.');
        await second.waitForFunction(() => !document.querySelector('video').paused && document.querySelector('video').duration > 0, null, { timeout: 10000 });
        assert(!events.includes('model'), 'Inline quiz cannot start after only the first video.');
        assert(!events.includes('doc-open')); assert(!events.includes('card:1')); assert(!events.includes('next'));
        if (stop) {
            await page.locator('[data-action="stop"]').click();
            await second.waitForFunction(() => document.querySelector('video').paused);
            observations.push({ name, events }); return;
        }
        await second.evaluate(() => { const v = document.querySelector('video'); v.currentTime = v.duration - 0.05; });
        await second.waitForFunction(() => document.querySelector('video').ended);
        if (replay) {
            for (let tries=0;tries<80&&!events.includes('replay:2');tries++) await page.waitForTimeout(100);
            assert.equal(events.filter(x=>x==='replay:2').length,1,'Only the ended pending video may be replayed.');
            assert(!events.includes('model'));assert(!events.includes('card:1'));
            if (stopReplay) {
                await page.locator('[data-action="stop"]').click();await page.waitForTimeout(1400);
                assert(!events.includes('model'));assert(!events.includes('card:1'));assert(!events.includes('next'));
                assert.equal(events.filter(x=>x==='replay:2').length,1);observations.push({name,events});return;
            }
            if (replayFails) {
                await page.evaluate(()=>window.__offset+=24000);
                for(let i=0;i<60&&!events.includes('probe');i++)await page.waitForTimeout(100);
                assert.equal(events.filter(x=>x==='probe').length,1);
                await page.waitForTimeout(1600);
                await page.evaluate(()=>window.__offset+=24000);
            }
        }
        if (lag) {
            await page.waitForTimeout(2500); assert(!events.includes('model')); assert(!events.includes('card:1'));
            if (background) {
                for(const frame of page.frames())await frame.evaluate(()=>{
                    Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));window.__offset+=90000;
                });
                await page.waitForTimeout(1800);
                assert(!events.includes('probe'));assert(!events.includes('next'));assert(!events.includes('model'));
            }
            await page.frameLocator('#iframe').locator('[data-video="2"]').evaluate(el => el.classList.add('ans-job-finished'));
            if(background)for(const frame of page.frames())if(!frame.isDetached())await frame.evaluate(()=>{
                Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));
            }).catch(error=>{if(!frame.isDetached())throw error;});
        }
        if (unknown || unknownAfterResult) {
            await page.waitForFunction(()=>/存在无法识别/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
            for (const frame of page.frames()) await frame.evaluate(() => { window.__offset += 23000; });
            for(let i=0;i<60&&!events.includes('probe');i++)await page.waitForTimeout(100);
            assert.equal(events.filter(x=>x==='probe').length,1);
            if(stopRecovery||onlyRecovery||quietRecovery){
                if(stopRecovery)await page.locator('[data-action=stop]').click();
                else if(onlyRecovery)await page.locator('[data-action=solve]').click();
                else await page.evaluate(()=>{GM_setValue('xxt-quiet-enabled',true);XxtCodexCore.quietHoursAt=()=>true;});
                await page.waitForTimeout(2200);
                assert(!events.includes('next'));assert(!events.includes('card:1'));assert(!events.includes('model'));
                observations.push({name,events});return;
            }
            if(heal)await page.frameLocator('#iframe').locator('[data-unknown]').evaluate(el=>el.remove());
            else {
                await page.waitForTimeout(1600);
                await page.waitForFunction(()=>/存在无法识别/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent));
                await page.evaluate(()=>window.__offset+=23000);
            }
        }
        if (mixed) {
            await page.waitForFunction(() => /文献已打开/.test(document.querySelector('[data-xxt-codex-panel] pre').textContent), null, { timeout: 10000 });
            assert(!events.includes('model')); assert(!events.includes('card:1'));
            await page.waitForTimeout(250);
            for (const frame of page.frames()) await frame.evaluate(() => { window.__offset += 58500; });
            await page.waitForTimeout(300); assert(!events.includes('doc-close'));
            for (const frame of page.frames()) await frame.evaluate(() => { window.__offset += 3000; });
        }
        await page.waitForFunction(() => document.querySelectorAll('#coursetree .posCatalog_select')[1].classList.contains('posCatalog_active'), null, { timeout: 20000 });
        assert.equal(events.filter(x => x === 'next').length, 1);
        if(background)assert.equal(events.filter(x=>x==='probe').length,0,'Hidden wall time must not trigger recovery before a fresh completion check.');
        if(promptNext){
            assert.equal(events.filter(x=>x==='nav-confirm').length,1);
            const log=page.locator('[data-skipped-log]');
            assert.match(await log.locator('summary').textContent(),/跳过记录 · [1-9]/);
            await log.locator('summary').click();
            assert.match(await log.locator('ul').textContent(),/first.*无法识别/);
            await page.screenshot({path:`${temp}/recovery-skipped-log.png`});
        }
        if(unknown||unknownAfterResult||replayFails){
            assert.equal(events.filter(x=>x==='probe').length,1,'At most one automatic AI test/restart per chapter.');
            const skipped=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('xxt-skipped:')).flatMap(([,v])=>JSON.parse(v)));
            assert.equal(skipped.length>0,!heal,'Skipped content must be recorded separately, without inventing platform completion.');
        }
        if(replay)assert.equal(events.filter(x=>x==='replay:2').length,1);
        assert.equal(events.filter(x => x === 'model').length, noAi ? 0 : mixed ? 2 : 1, 'Each quiz page needs its own result, even with repeated question IDs.');
        assert(events.indexOf('ended:2') < events.indexOf('card:1'));
        if (mixed) { if (!noAi) assert(events.indexOf('doc-close') < events.indexOf('model')); assert.equal(events.filter(x => x === 'submit').length, noAi ? 0 : 2); }
        if(noAi) {
            assert(!events.includes('probe')); assert(!events.includes('submit'));
            const skipped=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('xxt-skipped:')).flatMap(([,v])=>JSON.parse(v)));
            assert(skipped.some(x=>/不接入 AI/.test(x.reason)));
            await page.screenshot({path:`${temp}/${name}.png`});
        }
        observations.push({ name, events });
    } catch (error) {
        if(replay) for(const frame of page.frames()) console.error(await frame.evaluate(()=>({path:location.pathname,ended:document.querySelector('video')?.ended,replay:document.querySelector('.vjs-play-control')?.outerHTML,messages:window.__settlementMessages})).catch(()=>null));
        console.error(name, JSON.stringify(events));
        console.error(await page.locator('[data-xxt-codex-panel] pre').textContent().catch(() => 'No panel'));
        throw error;
    } finally { await context.close(); }
}
try {
    if(process.argv.includes('--no-ai')) { await scenario({name:'no-ai-videos-documents-two-checks',mixed:true,noAi:true}); await scenario({name:'no-ai-same-origin-popup',noAi:true,popup:true}); await scenario({name:'no-ai-cross-origin-popup',noAi:true,cross:true,popup:true}); await scenario({name:'no-ai-stop-video',noAi:true,stop:true}); }
    else if(process.argv.includes('--background-only')) {await scenario({name:'background-settlement-recheck',lag:true,background:true});}
    else if(process.argv.includes('--result-only')) {await scenario({name:'graded-100-restart-then-skip-unknown',unknownAfterResult:true});}
    else if(process.argv.includes('--navigation-only')) {await scenario({name:'skip-confirms-incomplete-task-next',unknown:true,promptNext:true});await scenario({name:'answers-only-cancels-auto-restart',unknown:true,onlyRecovery:true});}
    else if (process.argv.includes('--settlement-only')) {
        if(!process.argv.includes('--cross-only'))await scenario({name:'same-origin-replay-settles',replay:true});
        await scenario({name:'cross-origin-replay-settles',replay:true,cross:true});
        if(!process.argv.includes('--cross-only')) {
        await scenario({name:'unsettled-replay-pauses-once',replay:true,replayFails:true});
        await scenario({name:'stop-during-replay-settlement',replay:true,stopReplay:true});
        }
    } else {
    await scenario({ name: 'two-video-before-separate-check' });
    if (process.argv.includes('--first-only')) { console.log(JSON.stringify(observations)); process.exitCode = 0; }
    else {
    await scenario({ name: 'videos-document-inline-quiz-and-another-check', mixed: true });
    await scenario({ name: 'late-second-video', lazy: true });
    await scenario({ name: 'platform-marker-delay', lag: true });
    await scenario({name:'background-settlement-recheck',lag:true,background:true});
    await scenario({ name: 'unknown-retry-once-then-skip', unknown: true });
    await scenario({ name: 'stop-during-second-video', stop: true });
    await scenario({ name: 'two-cross-origin-video-workers', cross: true });
    await scenario({name:'same-origin-replay-settles',replay:true});
    await scenario({name:'cross-origin-replay-settles',replay:true,cross:true});
    await scenario({name:'unsettled-replay-pauses-once',replay:true,replayFails:true});
    await scenario({name:'stop-during-replay-settlement',replay:true,stopReplay:true});
    await scenario({name:'restart-recovers-without-skip',unknown:true,heal:true});
    await scenario({name:'manual-stop-cancels-auto-restart',unknown:true,stopRecovery:true});
    await scenario({name:'night-rest-cancels-auto-restart',unknown:true,quietRecovery:true});
    await scenario({name:'skip-confirms-incomplete-task-next',unknown:true,promptNext:true});
    await scenario({name:'graded-100-restart-then-skip-unknown',unknownAfterResult:true});
    }
    }
    await writeFile(`${temp}/observations.json`, JSON.stringify(observations, null, 2));
    console.log(`${observations.length} page-task workflows passed, including actual media end, platform completion barriers, bounded same/cross-origin replay recovery and stop protection. Synthetic site/model/clock.`);
} finally { await browser.close(); }
