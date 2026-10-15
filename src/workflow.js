/* Bounded submit -> grade -> redo -> next workflow, coordinated with the video player. */
(() => {
    'use strict';
    if (typeof GM_getValue !== 'function') return;
    const D = XxtCodexDom;
    const F = XxtCodexDocuments;
    const I = XxtCodexInterruptions;
    const Q = XxtVideoQuiz;
    const nonce = crypto.randomUUID();
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const isTop = pageWindow === pageWindow.top;
    const tabId = sessionStorage.getItem('xxt-codex-tab') || nonce;
    sessionStorage.setItem('xxt-codex-tab', tabId);
    let panel, themeStatus, automatic = false, busy = false, stopped = false, task = '', record = {}, inFlight;
    let messageValue = '展开“AI 接口设置”填写服务商、模型和 Key，再测试 AI。';
    let epoch = 0, frameClaimAt = 0, frameClaimTask = '', grantAt = 0, unloaded = false, parentManaged = false, navigationContent = null;
    let coordinator = null, coordinatorDistance = Infinity, expectedCheckTask = '', expectedVideoTask = '', navigationRequested = false;
    let expectedDocumentTask = '', documentReportedTask = '', openedDocument = null;
    let quietPaused = false, resumeAfterQuiet = false, unknownSince = 0, unknownTask = '';
    const quietNow = () => GM_getValue('xxt-quiet-enabled', true) && XxtCodexCore.quietHoursAt();
    let selectedPlaybackRate = XxtCodexCore.normalizePlaybackRate(GM_getValue('xxt-playback-rate', 1));
    const getPlaybackRate = () => selectedPlaybackRate;
    let remoteVideoTask = '', remoteVideoRate = selectedPlaybackRate, remoteVideo = null, remoteVideoEnded = false, remotePlayBusy = false, remotePlayAttempts = 0, remotePlayAt = 0;
    let remoteMediaId = '', remoteMediaIdentity = '';
    let renderedInPage = null;
    const visibilityObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
        renderedInPage = entries.some(entry => entry.isIntersecting);
    }) : null;
    visibilityObserver?.observe(document.documentElement);
    const frames = new Map();
    const quizFrames = new Map();
    const retiredQuizForms = new Set();
    let quizAuthorized = false;
    const controlledFrames = () => new Map([...frames, ...quizFrames]);
    const hasVideoQuiz = () => Q.across(pageWindow).length > 0 || (coursePage() && [...quizFrames.values()].some(entry => entry.task === courseTask() && Date.now() - entry.at < 4000));
    const pendingConfirmations = new Map();
    let submitRequest = null;
    const completedSenders = new Set();
    const completedTasks = new Set();
    const completedMedia = new Set();
    const completedDocumentSenders = new Set();
    const coursePage = () => !!document.getElementById('coursetree');
    function courseTask() {
        const active = document.querySelector('#coursetree .posCatalog_active');
        const name = active?.querySelector('.posCatalog_name');
        const params = new URLSearchParams(location.search);
        const course = params.get('courseId') || params.get('courseid') || '';
        const clazz = params.get('clazzid') || params.get('clazzId') || '';
        const index = [...document.querySelectorAll('#coursetree .posCatalog_select')].indexOf(active);
        return `${tabId}/${location.origin}/${course}/${clazz}/${index}/${name?.getAttribute('title') || D.text(name)}`;
    }
    function checkStep() {
        const el = document.querySelector('.prev_title');
        return /学习检测|学习测验|章节测验/.test(el?.title || D.text(el));
    }
    function localTask() {
        const params = new URLSearchParams(location.search);
        const work = params.get('workId') || params.get('workid') || params.get('jobid') || '';
        return `local/${tabId || nonce}/${location.origin}/${work || location.pathname}/${D.extract(document).map(entry => entry.question.id).join(',')}`;
    }
    function notify(value) {
        messageValue = value;
        if (panel) panel.querySelector('pre').textContent = value;
        if (themeStatus) { const sleep = /夜间休息|已预约/.test(value); themeStatus.textContent = sleep ? '夜间休息 · 北京时间' : '学习流程 · 多模型接入'; panel.dataset.sleeping = String(sleep); }
        if (coordinator && !coursePage()) post(coordinator, 'status', { task, value });
    }
    function save() { if (task) GM_setValue(`xxt-check:${task}`, record); }
    function setTask(value) {
        if (task === value) return;
        if (coursePage() && task) {
            for (const [source, entry] of quizFrames) {
                retiredQuizForms.add(`${entry.nonce}/${entry.signature}`);
                post(source, 'stop', { target: entry.nonce });
            }
            while (retiredQuizForms.size > 128) retiredQuizForms.delete(retiredQuizForms.values().next().value);
            quizFrames.clear();
        }
        closeDocument(); documentReportedTask = '';
        task = value; record = GM_getValue(`xxt-check:${task}`, {}) || {}; epoch++;
    }
    function post(target, type, data = {}) { target.postMessage({ source: 'xxt-codex-0.3', type, nonce, ...data }, '*'); }
    function ancestorDistance(target) {
        let parent = pageWindow;
        for (let distance = 1; distance <= 8; distance++) {
            if (parent === parent.parent) break;
            parent = parent.parent;
            if (parent === target) return distance;
        }
        return Infinity;
    }
    function broadcast(type, data = {}) {
        let parent = pageWindow;
        for (let depth = 0; depth < 8 && parent !== parent.parent; depth++) {
            parent = parent.parent; post(parent, type, data);
        }
    }
    function report(type, data = {}) { if (coordinator) post(coordinator, type, data); else broadcast(type, data); }
    function chooseCoordinator(source) {
        const distance = ancestorDistance(source);
        if (!Number.isFinite(distance) || distance > coordinatorDistance) return false;
        coordinator = source; coordinatorDistance = distance;
        if (!coursePage() && panel) panel.hidden = true;
        return true;
    }
    function pause(reason) {
        if (quietPaused && quietNow()) { notify('夜间休息中（23:00—07:00，北京时间）'); return; }
        closeDocument();
        cancelConfirmation(); pendingConfirmations.clear();
        automatic = false; stopped = true; epoch++; inFlight?.abort();
        record.paused = true; save(); notify(reason);
        if (coursePage()) { stopPlayer(); for (const [source, entry] of controlledFrames()) post(source, 'stop', { target: entry.nonce }); }
        if (!isTop && !coursePage()) report('pause', { reason, task });
    }
    function request(path, payload) {
        const job = XxtAi.request(path, payload); inFlight = job;
        return job.promise;
    }
    function beforeClick() {
        if (quietNow()) { suspendForQuiet(); throw new Error('夜间休息中，暂停自动操作'); }
        if (stopped || !automatic) throw new Error('自动操作已停止');
        if (!task) throw new Error('检测上下文缺失');
        if (coursePage() && task !== courseTask()) throw new Error('章节已切换，取消旧任务');
        dismissInterruptions();
    }
    function applyMediaRate(video, rate = selectedPlaybackRate) {
        if (video && video.playbackRate !== rate) video.playbackRate = rate;
    }
    function syncPlaybackRate() {
        if (window.app?.configs) window.app.configs.playbackRate = selectedPlaybackRate;
        remoteVideoRate = selectedPlaybackRate;
        if (!automatic || stopped || quietNow()) return;
        const visit = (win, depth = 0) => {
            if (depth > 6) return;
            try {
                for (const video of win.document.querySelectorAll('video')) if (D.visible(video)) applyMediaRate(video);
                for (const frame of win.document.querySelectorAll('iframe')) if (D.visible(frame)) visit(frame.contentWindow, depth + 1);
            } catch {}
        };
        visit(pageWindow);
        if (coursePage()) for (const [source, entry] of controlledFrames()) post(source, 'set-playback-rate', { target: entry.nonce, task: courseTask(), rate: selectedPlaybackRate });
    }
    function changePlaybackRate(value) {
        selectedPlaybackRate = XxtCodexCore.normalizePlaybackRate(value);
        GM_setValue('xxt-playback-rate', selectedPlaybackRate); syncPlaybackRate();
    }
    function dismissInterruptions() {
        if (!automatic || stopped || quietNow()) return;
        I.dismiss(pageWindow);
    }
    async function waitFor(test, timeout = 12000) {
        const end = Date.now() + timeout;
        while (Date.now() < end) { beforeClick(); const value = test(); if (value) return value; await D.delay(200); }
        throw new Error('页面响应超时，已停止，避免重复操作');
    }
    function cancelConfirmation() {
        if (submitRequest && coordinator) post(coordinator, 'confirm-cancel', { task: submitRequest.task, requestId: submitRequest.id });
        submitRequest = null;
    }
    async function finishSubmission(assertCurrent = beforeClick) {
        const pending = { id: crypto.randomUUID(), task, kind: 'submit', confirmed: false };
        submitRequest = pending;
        if (coordinator) post(coordinator, 'confirm-request', { task, requestId: pending.id, kind: pending.kind });
        notify('已点击页面提交，正在等待并确认提交弹窗…');
        try {
            const outcome = await waitFor(() => {
                assertCurrent();
                const result = D.readResult(document);
                if (result) return { result };
                if (pending.confirmed) return { confirmed: true };
                const button = coordinator ? D.confirmation(document) : D.ancestorConfirmation(pageWindow);
                return button ? { button } : null;
            }, 20000);
            assertCurrent();
            if (outcome.button) { beforeClick(); outcome.button.click(); }
            record.confirmed = true; record.at = Date.now(); save();
            notify(`已提交第 ${record.submissions || 1} 轮，等待平台成绩…`);
        } finally { if (submitRequest === pending) cancelConfirmation(); }
    }
    async function finishRedo() {
        const pending = { id: crypto.randomUUID(), task, kind: 'redo', confirmed: false };
        submitRequest = pending;
        if (coordinator) post(coordinator, 'confirm-request', { task, requestId: pending.id, kind: pending.kind });
        notify('已点击重做，正在等待并确认重做弹窗…');
        try {
            const outcome = await waitFor(() => {
                if (pending.confirmed) return { confirmed: true };
                const button = coordinator ? D.confirmation(document, 'redo') : D.ancestorConfirmation(pageWindow, 'redo');
                if (button) return { button };
                if (D.enabled(document.querySelector('.btnSubmit.workBtnIndex')) && D.extract(document).length) return { form: true };
                const result = D.readResult(document);
                return result && result.fingerprint !== record.priorResult ? { result } : null;
            }, 20000);
            beforeClick();
            if (outcome.button) outcome.button.click();
            record.redoConfirmed = true; record.at = Date.now(); save();
            notify('已确认重做，正在等待新一轮题目…');
        } finally { if (submitRequest === pending) cancelConfirmation(); }
    }
    function tickConfirmations() {
        for (const [id, pending] of pendingConfirmations) {
            const owner = frames.get(pending.source);
            if (!automatic || stopped || pending.task !== courseTask() || owner?.nonce !== pending.nonce ||
                owner.kind !== 'check' || !canClaim(pending.source, owner) || Date.now() - pending.at > 20000) {
                pendingConfirmations.delete(id); continue;
            }
            const button = D.ancestorConfirmation(pageWindow, pending.kind);
            if (!button) continue;
            // Remove before clicking: repeated monitor ticks cannot confirm twice.
            pendingConfirmations.delete(id);
            button.click();
            post(pending.source, 'confirm-done', { target: pending.nonce, task: pending.task, requestId: id, kind: pending.kind });
            notify(pending.kind === 'redo' ? '已点击重做确认窗口的确定，等待新题目…' : '已点击确认窗口的提交，等待平台成绩…');
        }
    }
    function showPreviews(images) {
        if (!panel) return;
        const details = panel.querySelector('details'); details.querySelectorAll('img').forEach(img => img.remove());
        for (const data of images) { const img = document.createElement('img'); img.src = data; img.style.width = '100%'; details.append(img); }
    }
    async function solve(submit) {
        if (busy) return;
        busy = true;
        const currentEpoch = epoch;
        const entries = D.extract(document), questions = entries.map(entry => entry.question);
        const signature = JSON.stringify(questions);
        const assertCurrent = () => {
            if (stopped || epoch !== currentEpoch || signature !== JSON.stringify(D.extract(document).map(entry => entry.question))) throw new Error('题目已切换或已停止，取消旧答案');
            if (submit) beforeClick();
        };
        try {
            XxtCodexCore.validateQuestions(questions);
            const learned = XxtCodexCore.recallAnswers(questions, record.knownAnswers || []);
            const pendingEntries = entries.filter(entry => !learned.some(answer => answer.id === entry.question.id));
            const pendingQuestions = pendingEntries.map(entry => entry.question);
            notify(pendingEntries.length ? `正在读取 ${pendingEntries.length} 道题的截图（${learned.length} 道已有平台正确答案）…` : '已读取全部平台正确答案，直接填写…');
            await document.fonts.ready;
            const images = [];
            for (const entry of pendingEntries) {
                assertCurrent();
                if (!D.visible(entry.element)) throw new Error('题目区域不可见');
                const image = await XxtQuestionCapture.capture(entry.element, { guard: assertCurrent,
                    ignoreElements: el => !!el.hasAttribute?.('data-xxt-codex-panel') });
                images.push(image);
            }
            assertCurrent(); showPreviews(images);
            let modelAnswers = [];
            if (pendingQuestions.length) {
                notify('AI 正在阅读题目截图并作答；不确定的题将随机填写…');
                const response = await request('/solve', { questions: pendingQuestions, images, history: (record.history || []).slice(-5) });
                modelAnswers = XxtCodexCore.resolveAnswers(pendingQuestions, response, { randomizeUncertain: submit });
            }
            assertCurrent();
            const answers = questions.map(question => [...learned, ...modelAnswers].find(answer => answer.id === question.id));
            notify(answers.map(answer => `第 ${questions.findIndex(q => q.id === answer.id) + 1} 题：${answer.choices.join('、') || '不确定'}${answer.randomized ? '（随机）' : ''}\n${answer.explanation}`).join('\n\n'));
            if (!submit) return;
            await D.applyAnswers(entries, answers, assertCurrent);
            const button = D.unique([...document.querySelectorAll('.btnSubmit.workBtnIndex')].filter(D.enabled));
            if (!button) throw new Error('提交按钮缺失或不唯一，已停止');
            assertCurrent();
            record.lastAnswers = answers.map(({ id, choices }) => ({ id, choices }));
            record.lastQuestions = questions;
            record.randomized = answers.filter(answer => answer.randomized).map(answer => answer.id);
            record.submissions = (record.submissions || 0) + 1;
            record.phase = 'submitted'; record.confirmed = false; record.at = Date.now(); save();
            button.click();
            await finishSubmission(() => {
                beforeClick();
                if (epoch !== currentEpoch) throw new Error('章节已切换，取消旧提交确认');
            });
        } catch (error) { if (!unloaded) pause(error.message); }
        finally { busy = false; inFlight = null; }
    }
    async function advanceCourse(reason) {
        if (hasVideoQuiz()) { notify('视频弹题尚未结束，等待作答后再切节。'); return; }
        const oldTask = courseTask();
        if (completedTasks.has(oldTask)) return;
        completedTasks.add(oldTask);
        const currentEpoch = epoch;
        const pendingPrompt = D.ancestorNavigationPrompt(pageWindow);
        let next = pendingPrompt ? null : D.findNext(document);
        if (!pendingPrompt && !next && !window.app?.nextUnit) {
            await waitFor(() => D.findNext(document) || window.app?.nextUnit, 5000);
            next = D.findNext(document);
        }
        if (next && !D.enabled(next)) { pause('平台下一节按钮不可用，已停止'); return; }
        notify(`${reason}，正在进入下一节…`);
        beforeClick();
        if (D.readResult(document) || D.extract(document).length || F.find(document).length) navigationContent = { task: oldTask, signature: checkContent(), at: Date.now() };
        let confirmed = false;
        if (pendingPrompt) { pendingPrompt.next.click(); confirmed = true; }
        else if (next) next.click();
        else if (window.app?.nextUnit) window.app.nextUnit();
        else { pause('未找到课程导航，请手动进入下一节'); return; }
        const deadline = Date.now() + 12000;
        while (Date.now() < deadline) {
            if (courseTask() !== oldTask) { frameClaimAt = 0; frameClaimTask = ''; notify('已进入下一节，继续学习。'); return; }
            beforeClick();
            if (currentEpoch !== epoch) throw new Error('切换上下文已变化，取消旧导航确认');
            const prompt = !confirmed && D.ancestorNavigationPrompt(pageWindow);
            if (prompt) {
                beforeClick(); confirmed = true;
                prompt.next.click(); notify('已确认跳过未完成知识任务，正在等待下一节…');
            }
            await D.delay(200);
        }
        pause('平台未切换到下一节，已停止自动操作。');
    }
    async function navigate(reason) {
        beforeClick();
        if (navigationRequested) return;
        navigationRequested = true;
        record.phase = 'done'; record.doneReason = reason; record.at = Date.now(); save();
        if (!isTop && parentManaged) {
            report('finished', { task, reason }); automatic = false; notify(`${reason}，正在进入下一节…`); return;
        }
        if (coursePage()) { await advanceCourse(reason); return; }
        const next = D.findNext(document);
        if (next) {
            if (!D.enabled(next)) throw new Error('平台下一节按钮不可用，已停止');
            next.click(); notify(`${reason}，已点击下一节。`); automatic = false;
        } else if (!isTop) {
            report('finished', { task, reason }); automatic = false; notify(`${reason}，正在进入下一节…`);
        } else if (coursePage()) await advanceCourse(reason);
        else throw new Error('未找到下一节按钮，请手动返回课程');
    }
    async function processResult(result) {
        if (result.ambiguous) throw new Error('结果页有多个重做按钮，已停止');
        if (!result.allCorrect && record.phase === 'redo-clicked' && !record.redoConfirmed && result.fingerprint === record.priorResult) { await finishRedo(); return; }
        // A persisted completion is not proof that the prior navigation message was delivered.
        if (record.phase === 'done' && navigationRequested) return;
        if (record.priorResult === result.fingerprint && ['submitted', 'redo-clicked'].includes(record.phase)) {
            if (Date.now() - record.at > 30000) throw new Error('成绩页没有更新，已停止，避免重复重做');
            return;
        }
        const questions = record.lastQuestions || [];
        let learned = D.readCorrectAnswers(document, questions);
        if (result.allCorrect && record.lastAnswers?.length === questions.length) learned = questions.map(question => ({
            question, choices: record.lastAnswers.find(answer => answer.id === question.id)?.choices || []
        }));
        if (learned.length) {
            record.knownAnswers = [...(record.knownAnswers || []).filter(item => !learned.some(next => next.question.id === item.question.id)), ...learned];
            save();
        }
        const action = XxtCodexCore.nextAction(result);
        if (action === 'advance') { await navigate(`最终成绩 ${result.finalScore}/${result.maxScore}，已全对`); return; }
        if (action === 'skip') { await navigate(result.remaining === 0 ? '平台重做次数已用尽' : '平台未提供可用的重做按钮'); return; }
        if (action === 'pause') throw new Error('平台剩余次数无法识别，已停止');
        if (action !== 'redo') return;
        record.redos = record.redos || 0;
        record.budget = Math.min(record.budget ?? result.remaining, record.redos + result.remaining);
        if (record.redos >= record.budget) { await navigate('已达到平台提供的重做次数上限'); return; }
        record.history = [...(record.history || []), { finalScore: result.finalScore, maxScore: result.maxScore,
            answers: record.lastAnswers || [], review: result.review }].slice(-5);
        beforeClick();
        record.redos++; record.phase = 'redo-clicked'; record.redoConfirmed = false; record.at = Date.now(); record.priorResult = result.fingerprint; save();
        notify(`成绩 ${result.finalScore}/${result.maxScore}，已读取 ${learned.length} 道正确答案，重做（平台剩余 ${result.remaining} 次）…`);
        result.redo.click();
        await finishRedo();
    }
    function closeDocument() {
        const preview = openedDocument;
        openedDocument = null;
        try { preview?.close(); } catch {}
    }
    function findCheckTab() {
        const matches = [...document.querySelectorAll('.prev_white,.prev_title,[role="tab"],button,a,[onclick]')]
            .filter(el => D.enabled(el) && /^(?:\d+\s*)?(学习检测|学习测验|章节测验)$/.test(D.text(el)));
        return D.unique(matches.filter(el => !matches.some(other => other !== el && other.contains(el))));
    }
    async function continueKnowledge(reason) {
        beforeClick();
        if (coursePage()) {
            expectedDocumentTask = ''; expectedVideoTask = '';
            if (expectedCheckTask === courseTask()) return;
            if (findCheckTab()) {
                const prompt = D.ancestorNavigationPrompt(pageWindow);
                if (prompt) {
                    if (!prompt.close) throw new Error('请先关闭未完成任务提示，再开始本节学习检测');
                    prompt.close.click();
                    await waitFor(() => !D.ancestorNavigationPrompt(pageWindow), 3000);
                }
                beforeClick();
                if (globalThis.XxtCodexControl.enterCheckStep(`${reason}，优先进入本节学习检测…`)) return;
            }
            await advanceCourse(`${reason}，未发现学习检测`);
        } else throw new Error('未找到课程导航，请返回课程继续');
    }
    async function afterDocuments() {
        beforeClick();
        if (coursePage()) {
            await continueKnowledge('文献预览已停留 60 秒');
        } else if (coordinator) {
            report('document-finished', { task }); automatic = false;
        } else throw new Error('文献预览已完成，未找到课程导航，请返回课程继续');
    }
    async function readDocuments() {
        if (D.extract(document).length || D.readResult(document) || (coursePage() && expectedCheckTask === courseTask())) return false;
        const entries = F.find(document);
        if (!entries.length || documentReportedTask === task) return false;
        if (coursePage()) expectedDocumentTask = courseTask();
        busy = true;
        const currentEpoch = epoch;
        const assertCurrent = () => {
            beforeClick();
            if (currentEpoch !== epoch || (!coursePage() && renderedInPage === false)) throw new Error('文献阅读页面已切换，取消旧操作');
        };
        const completed = new Set(GM_getValue(`xxt-documents:${task}`, []) || []);
        try {
            for (const entry of entries) {
                if (completed.has(entry.id)) continue;
                assertCurrent();
                if (!entry.element.isConnected) throw new Error('文件入口已变化，取消旧操作');
                notify(`正在打开文献：${entry.label}`);
                openedDocument = await F.open(entry, pageWindow, assertCurrent);
                const preview = openedDocument, deadline = Date.now() + 60000;
                while (Date.now() < deadline) {
                    assertCurrent();
                    if (preview.closed?.()) throw new Error('文件预览提前关闭，已暂停，请重新开始');
                    notify(`文献已打开：${entry.label}，等待 ${Math.ceil((deadline - Date.now()) / 1000)} 秒后关闭…`);
                    F.scroll(document, 1 - (deadline - Date.now()) / 60000);
                    await D.delay(200);
                }
                assertCurrent(); preview.close();
                if (preview.closed) {
                    const closeDeadline = Date.now() + 3000;
                    while (!preview.closed() && Date.now() < closeDeadline) { assertCurrent(); await D.delay(100); }
                    if (!preview.closed()) throw new Error('文件预览未能关闭，已暂停');
                }
                openedDocument = null;
                completed.add(entry.id); GM_setValue(`xxt-documents:${task}`, [...completed]);
                notify(`已关闭文献预览：${entry.label}`);
            }
            documentReportedTask = task;
            await afterDocuments();
        } catch (error) {
            if (!stopped && automatic && !quietNow() && currentEpoch === epoch) {
                closeDocument(); documentReportedTask = task;
                if (coursePage()) await continueKnowledge(`文献预览无法识别或处理：${error.message}`);
                else { report('document-unrecognized', { task, reason: error.message }); automatic = false; }
            } else throw error;
        } finally { closeDocument(); busy = false; }
        return true;
    }
    function suspendForQuiet() {
        if (quietPaused) return;
        quietPaused = true; resumeAfterQuiet = automatic;
        automatic = false; stopped = true; unknownSince = 0; unknownTask = ''; epoch++; inFlight?.abort();
        closeDocument(); cancelConfirmation(); pendingConfirmations.clear();
        stopPlayer(); remoteVideo?.pause();
        if (coursePage()) for (const [source, entry] of controlledFrames()) post(source, 'quiet-rest', { target: entry.nonce, resume: resumeAfterQuiet });
        notify(resumeAfterQuiet ? '夜间休息中，07:00 后自动继续（北京时间）' : '夜间休息中，点击开始可预约 07:00 后运行');
    }
    async function syncQuietHours() {
        if (quietNow()) { suspendForQuiet(); return false; }
        if (quietPaused) {
            quietPaused = false;
            const resume = resumeAfterQuiet; resumeAfterQuiet = false;
            if (resume) {
                stopped = false;
                if (coordinator && parentManaged) automatic = true;
                else await start();
            }
        }
        return true;
    }
    async function skipUnknownStep() {
        const video = window.app?._getVideoEl?.();
        const visibleVideo = video && D.visible(video) && (video.ownerDocument.defaultView === pageWindow || visibleDescendant(pageWindow, video.ownerDocument.defaultView));
        if (!coursePage() || openedDocument || D.extract(document).length || D.readResult(document) || visibleVideo ||
            [...frames].some(([source, entry]) => Date.now() - (entry.seenAt || 0) < 4000 && canClaim(source, entry))) {
            unknownSince = 0; unknownTask = ''; return;
        }
        if (unknownTask !== courseTask()) { unknownTask = courseTask(); unknownSince = Date.now(); }
        // Allow newly loaded iframes to announce themselves; this is not the cancelled 30s wait.
        if (Date.now() - unknownSince < 3000 || completedTasks.has(courseTask())) return;
        busy = true;
        try {
            if (expectedCheckTask !== courseTask()) await continueKnowledge('未识别到可处理的知识内容');
            else await advanceCourse('未识别到可处理的检测题，跳过当前小节');
        } finally { busy = false; }
    }
    function checkContent() {
        const result = D.readResult(document);
        return JSON.stringify({ questions: D.extract(document).map(entry => entry.question),
            documents: F.find(document).map(entry => entry.id),
            result: result ? { fingerprint: result.fingerprint, review: result.review } : null });
    }
    async function solveVideoQuiz(hit) {
        busy = true;
        let responseWatch;
        const currentEpoch = epoch;
        const guard = () => {
            beforeClick();
            if (epoch !== currentEpoch || (!coursePage() && renderedInPage === false) ||
                (coursePage() && hit.win !== pageWindow && !visibleDescendant(pageWindow, hit.win))) throw new Error('视频弹题页面已切换，取消旧答案');
        };
        const continueQuiz = async (entry, button) => {
            guard(); notify('视频弹题已答对，点击“继续学习”…'); button.click();
            await waitFor(() => {
                guard();
                const active = Q.find(hit.win.document), next = active && Q.extract(active);
                return !active || (next && next.signature !== entry?.signature);
            }, 10000);
        };
        try {
            for (;;) {
                guard();
                let panel = Q.find(hit.win.document);
                if (!panel) break;
                const entry = Q.extract(panel);
                // The page may already show a successful answer after refresh, manual submission or a stopped run.
                const existingFeedback = Q.feedback(panel, entry?.question);
                if (existingFeedback.proceed) {
                    await continueQuiz(entry, existingFeedback.proceed);
                    if (entry) {
                        const key = `xxt-video-quiz:${task}/${entry.question.id}`;
                        GM_setValue(key, { ...(GM_getValue(key, {}) || {}), phase: 'done' });
                    }
                    continue;
                }
                if (!entry) {
                    throw new Error('检测到视频弹题，但题目或选项无法识别，已暂停');
                }
                const key = `xxt-video-quiz:${task}/${entry.question.id}`;
                const state = GM_getValue(key, {}) || {};
                const saveState = () => GM_setValue(key, state);
                const assertQuestion = () => { guard(); if (Q.extract(panel)?.signature !== entry.signature) throw new Error('视频弹题已变化，取消旧答案'); };
                let requireFreshFeedback = false;
                if (state.phase !== 'submitted') {
                    notify(`检测到视频内${entry.question.type === 'multiple' ? '多选' : entry.question.type === 'boolean' ? '判断' : '单选'}题，正在作答…`);
                    let answer;
                    if (state.known?.length) answer = { id: entry.question.id, choices: state.known };
                    else {
                        await panel.ownerDocument.fonts.ready; assertQuestion();
                        const image = await XxtQuestionCapture.capture(panel, { guard: assertQuestion, backgroundColor: '#171717',
                            ignoreElements: el => el.tagName === 'VIDEO' || !!el.closest?.('[data-xxt-codex-panel]') });
                        assertQuestion(); showPreviews([image]);
                        const response = await request('/solve', { questions: [entry.question], images: [image], history: (state.history || []).slice(-5) });
                        assertQuestion(); answer = XxtCodexCore.resolveAnswers([entry.question], response, { randomizeUncertain: true })[0];
                    }
                    await Q.apply(entry, answer, assertQuestion);
                    const submit = Q.control(panel, /^(提交|确定)$/);
                    if (!submit) throw new Error('视频弹题提交按钮缺失或不唯一');
                    assertQuestion(); requireFreshFeedback = Q.feedback(panel, entry.question).wrong;
                    responseWatch?.close(); responseWatch = Q.watchResponse(panel);
                    state.phase = 'submitted'; state.at = Date.now(); state.choices = answer.choices;
                    state.submissions = (state.submissions || 0) + 1; saveState(); submit.click();
                    notify('已提交视频弹题，等待平台反馈…');
                }
                const outcome = await waitFor(() => {
                    guard(); const active = Q.find(hit.win.document);
                    if (!active || Q.extract(active)?.signature && Q.extract(active).signature !== entry.signature) return { advanced: true };
                    const feedback = Q.feedback(active, entry.question);
                    const submitting = [...active.querySelectorAll('#videoquiz-submitting')].some(D.visible);
                    return (!submitting && feedback.wrong && (!requireFreshFeedback || responseWatch?.changed())) || feedback.proceed ? { feedback } : null;
                }, 20000);
                responseWatch?.close(); responseWatch = null;
                guard();
                if (outcome.advanced) { state.phase = 'done'; saveState(); continue; }
                const feedback = outcome.feedback;
                if (feedback.proceed) {
                    await continueQuiz(entry, feedback.proceed);
                    state.phase = 'done'; saveState(); continue;
                }
                if (feedback.choices?.length) state.known = feedback.choices;
                state.history = [...(state.history || []), { finalScore: 0, maxScore: 1,
                    answers: [{ id: entry.question.id, choices: state.choices }], review: [feedback.text.slice(0, 3000)] }].slice(-5);
                saveState();
                if (feedback.remaining === 0 || (!feedback.retry && !feedback.resubmit)) throw new Error('视频弹题未答对，平台没有可用重试按钮，已暂停');
                if (!feedback.retry && feedback.resubmit) { state.phase = ''; saveState(); continue; }
                feedback.retry.click();
                await waitFor(() => {
                    const active = Q.find(hit.win.document);
                    return active && Q.extract(active) && !Q.feedback(active, entry.question).wrong;
                }, 10000);
                state.phase = ''; saveState();
            }
            guard();
            if (!coursePage() && coordinator) report('video-quiz-finished', { task });
            const video = hit.win.document.querySelector('video');
            if (video && !video.ended) {
                applyMediaRate(video);
                try { await video.play(); } catch { video.muted = true; await video.play(); }
            }
            if (coursePage()) {
                if (video?.ended) window.app?._continueAfterVideo(); else window.app?.play();
            }
            notify('视频弹题已结束，继续本节视频…');
        } catch (error) { if (!unloaded) pause(error.message); }
        finally { responseWatch?.close(); busy = false; inFlight = null; }
    }
    async function tick() {
        mount();
        if (!await syncQuietHours()) return;
        dismissInterruptions();
        if (!isTop && !coursePage() && Q.find(document)) report('video-quiz-ready', { viewVisible: renderedInPage,
            quizSignature: `${Q.extract(Q.find(document))?.signature || D.text(Q.find(document))}/${document.querySelector('video')?.currentSrc || ''}` });
        if (coursePage()) tickConfirmations();
        await tickRemoteVideo();
        if (!isTop && !coursePage() && (D.extract(document).length || D.readResult(document))) report('ready', {
            viewVisible: renderedInPage, viewKind: D.readResult(document) ? 'result' : 'questions'
        });
        if (!isTop && !coursePage() && !D.extract(document).length && !D.readResult(document) &&
            (F.find(document).length || openedDocument) && (!task || documentReportedTask !== task))
            report('document-ready', { viewVisible: renderedInPage });
        if (!automatic || stopped || busy || !task) return;
        if (navigationContent && courseTask() !== navigationContent.task) {
            if (checkContent() === navigationContent.signature) {
                if (Date.now() - navigationContent.at > 30000) pause('新章节仍显示旧检测内容，已停止，避免误跳章节。');
                return;
            }
            navigationContent = null;
        }
        if (coursePage() && task !== courseTask()) {
            setTask(courseTask()); expectedCheckTask = ''; expectedDocumentTask = ''; expectedVideoTask = courseTask(); frameClaimAt = 0; navigationRequested = false;
            window.app?._reenterVideoMode?.(); return;
        }
        try {
            const videoQuiz = Q.across(pageWindow)[0];
            if (videoQuiz && (coursePage() || isTop || quizAuthorized)) { await solveVideoQuiz(videoQuiz); return; }
            if (hasVideoQuiz()) return;
            const result = D.readResult(document);
            if (result) { busy = true; await processResult(result); return; }
            if (await readDocuments()) return;
            if (D.enabled(document.querySelector('.btnSubmit.workBtnIndex')) && D.extract(document).length) {
                if (record.phase === 'submitted') {
                    if (!record.confirmed) { busy = true; await finishSubmission(); return; }
                    if (Date.now() - record.at > 30000) throw new Error('提交后未出现成绩，已停止，避免重复提交');
                    return;
                }
                if (record.phase === 'done') return;
                await solve(true); return;
            }
            if (!coursePage() && ['submitted', 'redo-clicked'].includes(record.phase) && Date.now() - record.at > 30000) throw new Error('平台页面未更新，已停止');
            await skipUnknownStep();
        } catch (error) { pause(error.message); }
        finally { if (!inFlight) busy = false; }
    }
    function grant(source, entry, resume = false) {
        post(source, entry.kind === 'video' ? 'grant-video' : entry.kind === 'document' ? 'grant-document' : 'grant', { target: entry.nonce, task: courseTask(), resume,
            rate: getPlaybackRate(), mediaId: entry.mediaId });
    }
    async function tickRemoteVideo() {
        if (quietNow()) { remoteVideo?.pause(); return; }
        if (coursePage()) return;
        const video = document.querySelector('video#video_html5_api,video[id*="video_html5"],video');
        if (!video || !D.visible(video)) return;
        const identity = video.currentSrc || video.src || '';
        if (video !== remoteVideo || identity !== remoteMediaIdentity) {
            remoteVideo = video; remoteMediaIdentity = identity; remoteMediaId = crypto.randomUUID(); remoteVideoEnded = false; remotePlayAttempts = 0;
            remoteVideoTask = '';
        }
        report('video-ready', { mediaId: remoteMediaId, viewVisible: renderedInPage, ended: video.ended });
        if (Q.find(document)) return;
        if (!remoteVideoTask || !automatic || stopped || !coordinator || D.extract(document).length) return;
        applyMediaRate(video, remoteVideoRate);
        if (video.ended) {
            if (!remoteVideoEnded) { remoteVideoEnded = true; report('video-ended', { task: remoteVideoTask, mediaId: remoteMediaId }); }
            return;
        }
        if (renderedInPage === false) return;
        if (!video.paused || remotePlayBusy || Date.now() - remotePlayAt < 2000) return;
        if (remotePlayAttempts >= 10) { pause('视频未能自动播放，请先点播放器的播放按钮再开始自动。'); return; }
        remotePlayAt = Date.now(); remotePlayAttempts++; remotePlayBusy = true;
        applyMediaRate(video, remoteVideoRate);
        try {
            try { await video.play(); } catch { video.muted = true; await video.play(); }
            remotePlayAttempts = 0; if (!stopped && automatic) report('status', { task: remoteVideoTask, value: '正在播放本节视频…' });
        } catch { report('status', { task: remoteVideoTask, value: '正在等待新视频加载，尝试自动播放…' }); }
        finally { remotePlayBusy = false; }
    }
    async function start() {
        if (quietNow()) { suspendForQuiet(); resumeAfterQuiet = true; notify('已预约：夜间休息中，07:00 后自动开始（北京时间）'); return; }
        stopped = false; automatic = true; navigationRequested = false; documentReportedTask = ''; epoch++;
        dismissInterruptions();
        syncPlaybackRate();
        if (coursePage()) {
            setTask(courseTask());
            if (!checkStep() && expectedCheckTask !== courseTask()) expectedVideoTask = courseTask();
            completedTasks.delete(courseTask());
            for (const [source, entry] of frames) {
                completedSenders.delete(entry.nonce);
                if (entry.kind === 'document') completedDocumentSenders.delete(entry.nonce);
                if (entry.kind === 'video' ? canClaimVideo(source, entry) && !parentHasVideo() :
                    canClaim(source, entry) && (entry.kind !== 'document' || !F.find(document).length)) grant(source, entry, true);
            }
            for (const [source, entry] of quizFrames) if (entry.task === courseTask() && Date.now() - entry.at < 4000)
                post(source, 'grant-video-quiz', { target: entry.nonce, task: courseTask(), resume: true });
            if (D.ancestorNavigationPrompt(pageWindow)) {
                if (expectedCheckTask === courseTask()) await advanceCourse('继续本轮章节切换');
                else await continueKnowledge('恢复未完成任务提示');
                return;
            }
            if (window.app) { window.app.configs.autoplay = true; window.app.play(); }
            notify('自动模式已开启：视频后进入检测；全对继续，未全对按平台剩余次数重做。');
        } else {
            if (!isTop) { const since = Date.now(); report('start'); await D.delay(800); if (grantAt < since && !task) setTask(localTask()); }
            else if (!task) setTask(localTask());
            record.paused = false; save(); await tick();
        }
    }
    function stopPlayer() {
        if (window.app) { window.app.configs.autoplay = false; window.app._isPlaying = false; window.app._clearCheckInterval(); window.app._videoEl?.pause(); }
    }
    function stop() {
        resumeAfterQuiet = false;
        pause('已停止自动答题。');
        if (coursePage()) { stopPlayer(); for (const [source, entry] of controlledFrames()) post(source, 'stop', { target: entry.nonce }); }
        if (!isTop && !coursePage()) report('stop');
    }
    function mount() {
        if (panel || !(coursePage() || D.extract(document).length || D.readResult(document) || Q.find(document))) return;
        panel = document.createElement('section'); panel.setAttribute('data-xxt-codex-panel', 'true'); panel.setAttribute('data-html2canvas-ignore', 'true');
        panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:340px;max-height:65vh;overflow:auto;background:white;color:#172033;border:1px solid #abb8c8;border-radius:10px;padding:14px;box-shadow:0 3px 20px #0002;font:14px/1.6 sans-serif;text-align:left';
        const title = document.createElement('strong'); title.textContent = '超星学习通自动化脚本（支持接入各种主流AI模型api）'; panel.append(title);
        const actions = document.createElement('div');
        for (const [action, label] of [['connect', '测试 AI'], ['start', '开始自动'], ['solve', '仅看答案'], ['stop', '停止']]) {
            const button = document.createElement('button'); button.textContent = label; button.dataset.action = action; button.style.cssText = 'margin:8px 4px 8px 0;padding:5px 9px;cursor:pointer';
            button.addEventListener('click', async () => {
                try {
                    if (action === 'stop') stop();
                    if (action === 'start') await start();
                    if (action === 'solve') {
                        if (quietNow()) { notify('夜间休息中，07:00 后可调用 AI'); return; }
                        if (busy) return;
                        if (!D.extract(document).length) throw new Error('请在检测题目页点击“仅看答案”');
                        stopped = false; automatic = false; epoch++;
                        if (!isTop && !coursePage()) report('pause', { reason: '已切换为仅看答案，自动提交停止。', task });
                        await solve(false);
                    }
                    if (action === 'connect') {
                        if (busy) throw new Error('请先停止当前任务再测试 AI');
                        await request('/health'); notify('AI 连接测试通过，点击“开始自动”即可。');
                    }
                } catch (error) { notify(error.message); }
            });
            actions.append(button);
        }
        const output = document.createElement('pre'); output.style.cssText = 'white-space:pre-wrap;word-break:break-word;font:inherit;margin:0';
        const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '查看发送给 AI 的题目截图'; details.append(summary);
        panel.append(actions, output, details);
        themeStatus = XxtAssistantTheme.decorate(panel, { title, actions, output, details, playbackRate: getPlaybackRate(), onRateChange: changePlaybackRate,
            onAiChange: () => { stop(); notify('AI 配置已更改，请测试后重新开始自动。'); }, onQuietChange: () => syncQuietHours().catch(error => pause(error.message)) });
        document.body.append(panel); notify(messageValue);
        if (coordinator && !coursePage()) panel.hidden = true;
    }
    function descendant(root, target, depth = 0) {
        if (root === target) return true;
        if (depth > 6) return false;
        try { for (let index = 0; index < root.frames.length; index++) if (descendant(root.frames[index], target, depth + 1)) return true; } catch {}
        return false;
    }
    function visibleDescendant(root, target, depth = 0) {
        if (depth > 6) return false;
        try {
            for (const frame of root.document.querySelectorAll('iframe')) {
                if (!D.visible(frame) || frame.getBoundingClientRect().height < 1) continue;
                if (frame.contentWindow === target || visibleDescendant(frame.contentWindow, target, depth + 1)) return true;
                // Across origins, only accept descendants of a visible outer frame during a known check step.
                if ((checkStep() || expectedCheckTask === courseTask() || expectedVideoTask === courseTask()) && descendant(frame.contentWindow, target)) return true;
            }
        } catch {}
        return false;
    }
    function canClaim(source, view = {}) {
        if (view.viewVisible === false) return false;
        if (!visibleDescendant(pageWindow, source)) return false;
        if (view.viewVisible === true) return true;
        const el = document.querySelector('.prev_title');
        const title = el?.title || D.text(el);
        if (!checkStep() && expectedCheckTask !== courseTask() && /视频|安全知识|学习目标/.test(title)) return false;
        if (!checkStep() && expectedCheckTask !== courseTask() && window.app?._videoEl?.isConnected && !window.app._videoEl.ended) return false;
        return true;
    }
    function canClaimVideo(source, view = {}) {
        if (view.viewVisible === false) return false;
        if (view.viewVisible === true) return visibleDescendant(pageWindow, source);
        return visibleDescendant(pageWindow, source) && expectedCheckTask !== courseTask() &&
            (!checkStep() || expectedVideoTask === courseTask());
    }
    function parentHasVideo() {
        const app = window.app;
        return app?._isLiveVideo ? app._isLiveVideo(app._videoEl) : !!app?._videoEl?.isConnected;
    }
    function handleMessage(event) {
        let allowed = false;
        try { allowed = /(^|\.)chaoxing\.com$/.test(new URL(event.origin).hostname); } catch {}
        const data = event.data;
        if (!allowed || !data || data.source !== 'xxt-codex-0.3') return;
        if (coursePage() && event.source !== pageWindow && descendant(pageWindow, event.source)) {
            if (quietNow() && !['stop', 'pause', 'ready', 'video-ready', 'document-ready'].includes(data.type)) return;
            if (data.type === 'video-quiz-ready' && data.viewVisible !== false && visibleDescendant(pageWindow, event.source)) {
                if (task && task !== courseTask()) return;
                if (typeof data.quizSignature !== 'string' || retiredQuizForms.has(`${data.nonce}/${data.quizSignature}`)) return;
                let accessible = false;
                try { accessible = !!event.source.document; } catch {}
                if (!accessible) {
                    quizFrames.set(event.source, { nonce: data.nonce, task: courseTask(), at: Date.now(), signature: data.quizSignature });
                    post(event.source, 'owner', { target: data.nonce });
                    if (automatic && !stopped) post(event.source, 'grant-video-quiz', { target: data.nonce, task: courseTask(), resume: true });
                }
            }
            if (data.type === 'video-quiz-finished' && data.task === courseTask() && quizFrames.get(event.source)?.nonce === data.nonce) {
                quizFrames.delete(event.source);
                if (automatic && !stopped && parentHasVideo()) {
                    if (window.app._getVideoEl()?.ended) window.app._continueAfterVideo(); else window.app.play();
                }
            }
            if (data.type === 'document-ready' && !F.find(document).length && !completedDocumentSenders.has(data.nonce) && expectedCheckTask !== courseTask() &&
                canClaim(event.source, data)) {
                expectedDocumentTask = courseTask(); expectedVideoTask = '';
                frames.set(event.source, { nonce: data.nonce, kind: 'document', viewVisible: data.viewVisible, seenAt: Date.now() });
                post(event.source, 'owner', { target: data.nonce });
                if (automatic && !stopped) grant(event.source, frames.get(event.source));
            }
            if (['document-finished', 'document-unrecognized'].includes(data.type) && automatic && !stopped && data.task === courseTask() &&
                frames.get(event.source)?.nonce === data.nonce && !completedDocumentSenders.has(data.nonce)) {
                completedDocumentSenders.add(data.nonce);
                (data.type === 'document-unrecognized' ? continueKnowledge('无法识别文献预览') : afterDocuments()).catch(error => pause(error.message));
            }
            if (data.type === 'confirm-request' && automatic && !stopped && data.task === courseTask() &&
                frames.get(event.source)?.nonce === data.nonce && frames.get(event.source)?.kind === 'check' &&
                canClaim(event.source, frames.get(event.source)) && typeof data.requestId === 'string' && ['submit', 'redo'].includes(data.kind)) {
                pendingConfirmations.set(data.requestId, { source: event.source, nonce: data.nonce, task: data.task, kind: data.kind, at: Date.now() });
            }
            if (data.type === 'confirm-cancel' && pendingConfirmations.get(data.requestId)?.source === event.source) pendingConfirmations.delete(data.requestId);
            if (data.type === 'video-ready' && expectedDocumentTask !== courseTask() && canClaimVideo(event.source, data) &&
                !(data.ended && expectedCheckTask === courseTask()) && !completedMedia.has(`${data.nonce}/${data.mediaId}`)) {
                if (data.viewVisible === true) { expectedVideoTask = courseTask(); expectedCheckTask = ''; frameClaimAt = 0; }
                frames.set(event.source, { nonce: data.nonce, kind: 'video', mediaId: data.mediaId, viewVisible: data.viewVisible, seenAt: Date.now() });
                post(event.source, 'owner', { target: data.nonce });
                // The original player owns same-origin videos; the agent is for inaccessible players.
                if (automatic && !stopped && !parentHasVideo()) grant(event.source, frames.get(event.source));
            }
            if (data.type === 'video-ended' && automatic && !stopped && data.task === courseTask() && frames.get(event.source)?.nonce === data.nonce &&
                frames.get(event.source)?.mediaId === data.mediaId && !completedMedia.has(`${data.nonce}/${data.mediaId}`)) {
                completedMedia.add(`${data.nonce}/${data.mediaId}`);
                expectedVideoTask = '';
                if (!globalThis.XxtCodexControl.enterCheckStep()) window.app?._continueAfterVideo();
            }
            if (data.type === 'ready' && !completedSenders.has(data.nonce) && canClaim(event.source, data)) {
                if (data.viewVisible === true) { expectedCheckTask = courseTask(); expectedDocumentTask = ''; expectedVideoTask = ''; }
                frames.set(event.source, { nonce: data.nonce, kind: 'check', viewVisible: data.viewVisible, seenAt: Date.now() }); frameClaimAt = Date.now(); frameClaimTask = courseTask();
                post(event.source, 'owner', { target: data.nonce });
                if (automatic && !stopped) grant(event.source, frames.get(event.source));
            }
            if (data.type === 'start') { automatic = true; stopped = false; setTask(courseTask()); frames.set(event.source, { nonce: data.nonce }); grant(event.source, frames.get(event.source), true); }
            if (data.type === 'stop') { resumeAfterQuiet = false; pause(data.reason || '自动模式已停止。'); }
            if (data.type === 'pause') pause(data.reason || '自动模式已停止。');
            if (data.type === 'finished' && automatic && data.task === courseTask() && !completedSenders.has(data.nonce)) {
                completedSenders.add(data.nonce); advanceCourse(data.reason).catch(error => pause(error.message));
            }
            if (data.type === 'status' && data.task === courseTask() && !completedSenders.has(data.nonce)) notify(data.value);
        } else if (!isTop && data.target === nonce && chooseCoordinator(event.source)) {
            if (data.type === 'quiet-rest') { suspendForQuiet(); resumeAfterQuiet = data.resume; }
            if (data.type === 'confirm-done' && submitRequest?.id === data.requestId && submitRequest.kind === data.kind && submitRequest.task === data.task && automatic && !stopped) submitRequest.confirmed = true;
            if (data.type === 'grant' || data.type === 'grant-document') {
                const newlyGranted = !parentManaged || task !== data.task || data.resume;
                grantAt = Date.now(); parentManaged = true;
                if (data.resume) { stopped = false; navigationRequested = false; if (data.type === 'grant-document') documentReportedTask = ''; }
                if (!stopped) { setTask(data.task); automatic = true; if (newlyGranted) notify('检测页已接管，正在读取平台成绩或题目…'); }
            }
            if (data.type === 'grant-video') {
                if (data.mediaId !== remoteMediaId) return;
                remoteVideoTask = data.task; selectedPlaybackRate = remoteVideoRate = XxtCodexCore.normalizePlaybackRate(data.rate); parentManaged = true;
                if (data.resume) stopped = false;
                if (!stopped) automatic = true;
            }
            if (data.type === 'set-playback-rate' && (data.task === task || data.task === remoteVideoTask)) {
                selectedPlaybackRate = XxtCodexCore.normalizePlaybackRate(data.rate); syncPlaybackRate();
                const select = panel?.querySelector('[data-setting="playback-rate"]'); if (select) select.value = String(selectedPlaybackRate);
            }
            if (data.type === 'grant-video-quiz') {
                if (data.resume) stopped = false;
                if (!stopped) { setTask(data.task); parentManaged = true; quizAuthorized = true; automatic = true; }
            }
            if (data.type === 'stop') {
                resumeAfterQuiet = false;
                closeDocument();
                cancelConfirmation(); pendingConfirmations.clear();
                automatic = false; stopped = true; epoch++; inFlight?.abort(); remoteVideo?.pause();
                messageValue = '自动模式已停止。'; if (panel) panel.querySelector('pre').textContent = messageValue;
            }
        }
    }
    globalThis.XxtCodexControl = {
        isQuietHours: quietNow,
        getPlaybackRate,
        hasVideoQuiz,
        shouldHold() { return quietNow() || hasVideoQuiz() || (coursePage() && (stopped || expectedDocumentTask === courseTask() || F.find(document).length > 0 || expectedCheckTask === courseTask() ||
            (expectedVideoTask !== courseTask() && (checkStep() || (frameClaimTask === courseTask() && Date.now() - frameClaimAt < 4000))))); },
        noteVideoNavigation() {
            if (openedDocument) { closeDocument(); epoch++; }
            expectedDocumentTask = '';
            expectedCheckTask = ''; expectedVideoTask = courseTask(); frameClaimAt = 0;
            if (automatic && !stopped) notify('已切换到新视频，正在重新接管播放…');
        },
        onVideoPlaying() { if (!stopped && !hasVideoQuiz() && expectedCheckTask !== courseTask()) notify('正在播放本节视频…'); },
        enterCheckStep(status) {
            if (hasVideoQuiz()) return true;
            if (quietNow()) return true;
            if (stopped) return true;
            if (expectedCheckTask === courseTask()) return true;
            if (!coursePage() || completedTasks.has(courseTask())) return false;
            const tab = findCheckTab();
            if (!tab) return false;
            expectedCheckTask = courseTask(); expectedVideoTask = '';
            tab.click(); window.app?._clearCheckInterval(); notify(status || (automatic ? '视频结束，进入学习检测…' : '已进入学习检测，点击“开始自动”可作答。')); return true;
        }
    };
    window.addEventListener('message', handleMessage);
    mount();
    const timer = setInterval(() => { tick().catch(error => pause(error.message)); }, 700);
    window.addEventListener('pagehide', () => { closeDocument(); cancelConfirmation(); pendingConfirmations.clear(); unloaded = true; stopped = true; epoch++; inFlight?.abort(); visibilityObserver?.disconnect(); clearInterval(timer); }, { once: true });
})();
