/* Chaoxing topic reading: ordinary navigation, foreground dwell, and an owned tab.
 * A visited/yellow catalogue entry is never evidence of 90 seconds of reading.
 * No platform timing requests, synthetic activity, or visibility overrides are used.
 */
(() => {
    'use strict';
    const D = XxtCodexDom;
    const param = 'xxtReading';
    const dwell = 90000;
    const key = (id, kind) => `xxt-topic:${id}:${kind}`;
    const read = (id, kind, fallback) => GM_getValue(key(id, kind), fallback);
    const write = (id, kind, value) => GM_setValue(key(id, kind), value);
    const quiet = () => GM_getValue('xxt-quiet-enabled', true) && XxtCodexCore.quietHoursAt();
    function url(value, base = location.href) {
        try {
            const u = new URL(String(value), base);
            return u.protocol === 'https:' && /(^|\.)chaoxing\.com$/.test(u.hostname) ? u : null;
        } catch { return null; }
    }
    function readingUrl(value, base) {
        const u = url(value, base);
        return u && (/^\/mooc-ans\/zt\/portal\/[^/]+\/?$/.test(u.pathname) ||
            (u.pathname === '/mooc-ans/ztnodedetailcontroller/visitnodedetail' &&
                u.searchParams.get('courseId') && u.searchParams.get('knowledgeId'))) ? u : null;
    }
    const isReaderPage = () => !!readingUrl(location.href);
    function find(win, depth = 0) {
        if (depth > 6) return [];
        const entries = [];
        try {
            const doc = win.document;
            if (/\/mooc-ans\/coursedata\/readjobv2\/show\/?$/.test(doc.location.pathname)) {
                for (const row of doc.querySelectorAll('.readZT')) {
                    const controls = [...row.querySelectorAll('span,a,button,[role="option"]')]
                        .filter(el => D.enabled(el) && D.text(el) === '去阅读');
                    const control = D.unique(controls.filter(el => !controls.some(other => other !== el && other.contains(el))));
                    if (control) entries.push({ element: control, win, label: D.text(row.querySelector('.ztTitle')) || '专题阅读' });
                }
            }
            for (const frame of doc.querySelectorAll('iframe')) if (D.visible(frame)) entries.push(...find(frame.contentWindow, depth + 1));
        } catch {}
        return entries;
    }
    function catalogue(doc) {
        const unique = new Map();
        for (const anchor of doc.querySelectorAll('li.course_section a[href]')) {
            const u = readingUrl(anchor.getAttribute('href'), doc.baseURI);
            if (!u || u.pathname !== '/mooc-ans/ztnodedetailcontroller/visitnodedetail') continue;
            const book = u.searchParams.get('courseId'), id = u.searchParams.get('knowledgeId');
            const identity = `${book}/${id}`;
            if (!unique.has(identity)) unique.set(identity, { id, book, anchor, label: D.text(anchor) });
        }
        return [...unique.values()];
    }
    function createOwner({ notify, assertCurrent }) {
        let current = null, opening = null, failure = null, generation = 0;
        function control(running) {
            if (current) write(current.id, 'control', { running, at: Date.now() });
        }
        function cancel() {
            generation++; failure = null;
            control(false);
            try { current?.handle?.close(); } catch {}
            if (current) current.handle = null;
        }
        async function open(entry) {
            const run = generation;
            const guard = () => { if (generation !== run) throw new Error('专题阅读打开操作已取消'); assertCurrent(); };
            const config = read(current.id, 'config', null);
            function launch(u) {
                guard();
                if (current.handle) return null;
                const id = current.id;
                write(id, 'config', { ...config, target: u.href, created: Date.now() });
                u.searchParams.set(param, id);
                current.openedAt = Date.now();
                current.handle = GM_openInTab(u.href, { active: true, insert: true, setParent: true });
                if (!current.handle) throw new Error('无法打开专题阅读标签页，请检查油猴的新标签权限');
                return null;
            }
            if (config.target) {
                const target = readingUrl(config.target);
                if (!target) throw new Error('专题阅读任务地址无效');
                launch(target); return;
            }
            // This observed span has a site click handler rather than an href. Intercept
            // only topic-reader URLs during this one click; restore every wrapped window.
            const restorers = [];
            let win = entry.win;
            for (let depth = 0; win && depth < 8; depth++) {
                try {
                    const targetWindow = win, original = win.open;
                    const wrapped = function (value, ...args) {
                        const target = readingUrl(value, entry.element.ownerDocument.baseURI);
                        if (target) return launch(target);
                        return original.call(this, value, ...args);
                    };
                    targetWindow.open = wrapped;
                    restorers.push(() => { if (targetWindow.open === wrapped) targetWindow.open = original; });
                } catch {}
                if (win === win.parent) break;
                win = win.parent;
            }
            try {
                guard(); entry.element.click();
                const until = Date.now() + 8000;
                while (!current.handle && Date.now() < until) { guard(); await D.delay(100); }
                if (!current.handle) throw new Error('未捕获到受支持的专题阅读地址，已暂停，请保留阅读页供核对');
            } finally { for (const restore of restorers.reverse()) restore(); }
        }
        async function step(entry, task) {
            if (failure) { const error = failure; failure = null; throw error; }
            if (current && current.task !== task) { cancel(); current = null; }
            if (!current) {
                const ownerKey = `xxt-topic-owner:${task}:${entry.label}`;
                let id = GM_getValue(ownerKey, '');
                if (!id || !read(id, 'config', null)) {
                    id = crypto.randomUUID(); GM_setValue(ownerKey, id);
                    write(id, 'config', { task, title: entry.label });
                }
                current = { id, task, handle: null, openedAt: 0 };
                const prior = read(id, 'progress', null);
                if (prior?.state === 'error') { prior.state = 'loading'; delete prior.error; write(id, 'progress', prior); }
            }
            control(true);
            let progress = read(current.id, 'progress', null);
            if (progress?.state === 'done') {
                cancel();
                if (document.visibilityState !== 'visible') { notify('专题目录已全部停留90秒，请返回原课程标签页继续'); return false; }
                return true;
            }
            if (progress?.state === 'error') throw new Error(progress.error || '专题目录或正文无法识别，已暂停');
            if (current.handle?.closed) throw new Error('专题阅读标签页提前关闭，进度已保存；点击开始自动可继续');
            if (!current.handle && !opening) {
                const run = generation;
                opening = open(entry).catch(error => { if (generation === run) failure = error; }).finally(() => { opening = null; });
            }
            if (!progress && current.openedAt && Date.now() - current.openedAt > 30000)
                throw new Error('阅读页未接入脚本，请确认阅读页也启用了新版脚本');
            const total = progress?.items?.length || 0, done = progress?.done?.length || 0;
            notify(progress?.paused ? `专题阅读已暂停（${done}/${total}），可在阅读页继续` :
                `专题阅读 ${done}/${total || '?'}；${progress?.label || entry.label}，本项 ${Math.floor((progress?.elapsed || 0) / 1000)}/90 秒；请保持阅读页在前台`);
            return false;
        }
        return { step, cancel, rest: () => { generation++; failure = null; control(false); } };
    }
    function bootReader() {
        if (window !== window.top || !isReaderPage() || typeof GM_getValue !== 'function') return;
        const id = new URL(location.href).searchParams.get(param);
        if (!/^[a-f0-9-]{36}$/.test(id || '') || !read(id, 'config', null)) return;
        const config = read(id, 'config', null), target = readingUrl(config.target);
        if (!target || target.origin !== location.origin) return;
        const sessionKey = `xxt-topic-tab:${id}`;
        const instance = sessionStorage.getItem(sessionKey) || crypto.randomUUID();
        sessionStorage.setItem(sessionKey, instance);
        let state = read(id, 'progress', { done: [], elapsed: 0, state: 'loading' });
        let last = performance.now(), ended = false, saveAt = 0, navigating = false, errorAt = 0;
        const box = document.createElement('section'); box.setAttribute('data-xxt-topic-reader', 'true');
        box.style.cssText = 'position:fixed;right:18px;bottom:18px;max-width:330px;z-index:2147483646;border:1px solid #c7d2fe;border-radius:15px;padding:14px;background:#f8fafc;color:#334155;box-shadow:0 6px 24px #17255424;font:14px/1.7 sans-serif';
        const title = document.createElement('strong'); title.textContent = '学习助手 · 专题阅读';
        const output = document.createElement('div'), button = document.createElement('button'); button.textContent = '暂停阅读';
        button.style.cssText = 'margin-top:8px;padding:6px 16px;border:1px solid #c7d2fe;border-radius:8px;color:#334155;background:white;cursor:pointer';
        box.append(title, output, button); document.body.append(box);
        function save(force = false) {
            if (!force && Date.now() - saveAt < 1000) return;
            saveAt = Date.now(); state.at = saveAt; state.lease = instance; write(id, 'progress', state);
        }
        function status(text) { output.textContent = text; button.textContent = state.paused ? '继续阅读' : '暂停阅读'; }
        function fail(text) { state.state = 'error'; state.error = text; save(true); status(text); }
        function openItem(entry) {
            const u = readingUrl(entry.anchor.href);
            if (!u || u.origin !== target.origin) { fail('目录地址不属于当前专题，已暂停'); return; }
            const resume = state.current === entry.id && !state.done.includes(entry.id);
            state.current = entry.id; state.label = entry.label; state.elapsed = resume ? state.elapsed || 0 : 0; state.state = 'navigating';
            save(true); navigating = true;
            u.searchParams.set(param, id); entry.anchor.href = u.href;
            // Floated children give the observed anchor a zero-sized bounding box.
            (entry.anchor.querySelector('.chapterText') || entry.anchor).click();
        }
        button.addEventListener('click', () => { state.paused = !state.paused; last = performance.now(); save(true); });
        const resetClock = () => { last = performance.now(); };
        document.addEventListener('visibilitychange', resetClock);
        window.addEventListener('blur', resetClock); window.addEventListener('focus', resetClock);
        function tick() {
            if (ended || navigating) return;
            const now = performance.now(), delta = Math.min(1500, Math.max(0, now - last)); last = now;
            const other = read(id, 'progress', null);
            if (other?.lease && other.lease !== instance && Date.now() - other.at < 10000) {
                status('另一个标签页正在处理此阅读任务，本页不重复计时'); return;
            }
            const control = read(id, 'control', null);
            if (quiet()) { status('夜间休息中，07:00后继续（北京时间）'); save(); return; }
            // Chromium may throttle the background course tab's timers to once/minute.
            // pagehide/Stop cancels explicitly; tolerate that normal heartbeat delay.
            if (!control?.running || Date.now() - control.at > 120000) { status('原课程已暂停或关闭，等待从原课程恢复'); save(); return; }
            if (document.visibilityState !== 'visible' || !document.hasFocus()) { status('请保持阅读页在前台，本项计时已暂停'); save(); return; }
            if (state.paused) { status('专题阅读已暂停，点击继续阅读可恢复'); save(); return; }
            const entries = catalogue(document);
            const signature = entries.map(entry => `${entry.book}/${entry.id}`);
            if (!entries.length || !document.getElementById('courseMainBox')) {
                errorAt ||= Date.now();
                if (Date.now() - errorAt > 20000) fail('没有识别到专题目录或正文，已暂停');
                else status('等待专题目录与正文加载…');
                save(); return;
            }
            if (new Set(entries.map(entry => entry.book)).size !== 1 ||
                (state.items && JSON.stringify(state.items) !== JSON.stringify(signature))) {
                fail('专题目录发生变化，已暂停，避免遗漏章节'); return;
            }
            state.items = signature; state.done ||= [];
            const next = entries.find(entry => !state.done.includes(entry.id));
            if (!next) { state.state = 'done'; state.elapsed = 0; save(true); status(`全部 ${entries.length} 项均已停留90秒，正在返回课程（平台时长以实际记录为准）`); return; }
            const here = new URL(location.href);
            const currentId = here.searchParams.get('knowledgeId');
            if (currentId !== next.id || state.current !== next.id) { openItem(next); return; }
            const content = document.getElementById('caContentBox');
            const heading = document.getElementById('nodeTitleEle');
            if (!content || !D.visible(content) || !heading || !D.text(heading)) {
                errorAt ||= Date.now();
                if (Date.now() - errorAt > 20000) fail('当前专题小节正文未加载，已暂停');
                else { status('等待当前小节正文加载，尚未计时…'); save(); }
                return;
            }
            errorAt = 0;
            // The first post-navigation observation establishes readiness, not dwell.
            if (state.state !== 'reading') state.state = 'reading';
            else state.elapsed = Math.min(dwell, (state.elapsed || 0) + delta);
            state.label = next.label;
            status(`${state.done.length + 1}/${entries.length} · ${next.label} · ${Math.floor(state.elapsed / 1000)}/90秒（仅前台计时）`);
            if (state.elapsed >= dwell) {
                state.done.push(next.id); save(true);
                const following = entries.find(entry => !state.done.includes(entry.id));
                if (following) openItem(following);
                else { state.state = 'done'; save(true); status(`全部 ${entries.length} 项已停留90秒，正在返回课程`); }
            } else save();
        }
        const timer = setInterval(() => { try { tick(); } catch (error) { fail(error.message); } }, 500);
        window.addEventListener('pagehide', () => { ended = true; clearInterval(timer); if (!navigating && state.lease === instance) save(true); }, { once: true });
        tick();
    }
    globalThis.XxtTopicReading = { find, catalogue, readingUrl, createOwner, isReaderPage };
    bootReader();
})();
