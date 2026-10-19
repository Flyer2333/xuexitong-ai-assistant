import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from './browser-runtime.mjs';

// Isolated player with its public control contract; actual HTMLMediaElement events.
const [jquery, player] = await Promise.all(['../vendor/jquery-3.6.0.min.js','../src/player.js'].map(p=>readFile(new URL(p,import.meta.url),'utf8')));
const wav=Buffer.alloc(44+8000*2*20);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try {
    const page=await browser.newPage();
    await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<div class="prev_title">视频</div><div id="coursetree"><ul><li><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">first</span></div></li></ul></div><video id="video_html5_api" muted src="data:audio/wav;base64,${wav.toString('base64')}" style="width:640px;height:300px"></video>`}));
    await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await page.evaluate(()=>{
        window.flags={hold:false,quiz:false,quiet:false}; window.playCalls=0;
        window.XxtCodexControl={getPlaybackRate:()=>1,getMuted:()=>true,shouldHold:()=>flags.hold,hasVideoQuiz:()=>flags.quiz,isQuietHours:()=>flags.quiet,finishVideo:()=>true};
        const video=document.querySelector('video'),play=video.play.bind(video);
        video.play=()=>{window.playCalls++;return play();};
    });
    await page.addScriptTag({content:jquery});await page.addScriptTag({content:player});
    await page.waitForFunction(()=>window.app&& !document.querySelector('video').paused);
    // Pause event alone should recover promptly, without relying on the polling interval.
    await page.evaluate(()=>{app._clearCheckInterval();app._guardLastResumeTs=0;document.querySelector('video').pause();});
    await page.waitForFunction(()=>!document.querySelector('video').paused);
    for(const flag of ['quiz','quiet','hold']) {
        const before=await page.evaluate(flag=>{flags[flag]=true;app._guardLastResumeTs=0;document.querySelector('video').pause();window.dispatchEvent(new Event('focus'));return playCalls;},flag);
        await page.waitForTimeout(400);
        assert.equal(await page.evaluate(()=>playCalls),before,`${flag} must prevent deferred/focus resume`);
        await page.evaluate(flag=>{flags[flag]=false;app._guardLastResumeTs=0;app._tryResumePlayback('test-release');},flag);
        await page.waitForFunction(()=>!document.querySelector('video').paused);
    }
    await page.evaluate(()=>{document.querySelector('video').currentTime=19.99;});
    await page.waitForFunction(()=>document.querySelector('video').ended);
    const before=await page.evaluate(()=>{app._isPlaying=true;app._guardLastResumeTs=0;const before=playCalls;app._tryResumePlayback('late-focus');window.dispatchEvent(new Event('focus'));return before;});
    await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>playCalls),before,'A stale playing flag must not replay ended media');
    await page.evaluate(()=>app.destroy());
    console.log('Player pause-event recovery and quiz/quiet/hold/ended guards passed with actual media; synthetic control flags.');
} finally {await browser.close();}
