/* Video overlay questions have their own form and never complete a chapter. */
(() => {
    const D = XxtCodexDom;
    const selectors = '.ans-videoquiz,.ans-videoquiz-wrap,.videoquiz,.ans-timelineobjects,.tkTopic,[data-video-quiz]';
    const inputs = 'input[type="radio"],input[type="checkbox"],[role="radio"],[role="checkbox"]';
    const feedbackSelector = '.ans-videoquiz-result,.ans-videoquiz-tip,.videoquiz-result,[data-quiz-feedback],[role="status"],.rightInfo,.spanHas,#spanHas,#spanNot,#spanNotBack,#spanNotBackPoint';
    const optionVisible = el => D.visible(el) || D.visible(el.closest('label') || el.labels?.[0]);
    // An iframe can replace its Document while keeping its WindowProxy. Never
    // inspect cached elements from that retired document when scanning siblings.
    const documents = new WeakMap();
    function find(doc) {
        let recognized = documents.get(doc);
        if (!recognized) { recognized = new Set(); documents.set(doc, recognized); }
        const possible = new Set(doc.querySelectorAll(selectors));
        for (const panel of recognized) {
            if (!panel.isConnected || !D.visible(panel)) recognized.delete(panel);
            else if (panel.ownerDocument === doc) possible.add(panel);
        }
        for (const input of doc.querySelectorAll(inputs)) {
            if (!optionVisible(input) || input.closest('.TiMu,[data-xxt-codex-panel]') || !input.closest('#video,.video-js,[data-vjs-player]')) continue;
            for (let scope = input.parentElement, depth = 0; scope && scope !== doc.body && depth < 8; scope = scope.parentElement, depth++) {
                if (/单选题|多选题|判断题/.test(D.text(scope)) && [...scope.querySelectorAll(inputs)].filter(optionVisible).length >= 2 && control(scope, /^(提交|确定)$/)) {
                    possible.add(scope); recognized.add(scope); break;
                }
            }
        }
        const candidates = [...possible].filter(el => D.visible(el) &&
            !el.closest('.TiMu,[data-xxt-codex-panel]') && (el.querySelector('video') || doc.querySelector('video') ||
                (el.matches('.tkTopic,.ans-videoquiz') && el.querySelector('.tkItem_title,.tkTopic_oper'))) &&
            (recognized.has(el) || [...el.querySelectorAll(inputs)].some(optionVisible) || /答对|回答正确|正确答案|答错|回答错误/.test(D.text(el))));
        const hit = D.unique(candidates.filter(el => !candidates.some(other => other !== el && el.contains(other))));
        if (hit) recognized.add(hit);
        return hit;
    }
    function across(win, depth = 0, found = []) {
        if (depth > 6) return found;
        let doc;
        try { doc = win.document; } catch { return found; }
        // A changing/unavailable player must not prevent scanning other players.
        try { const panel = find(doc); if (panel) found.push({ panel, win }); } catch {}
        for (const frame of doc.querySelectorAll('iframe')) {
            try { if (D.visible(frame)) across(frame.contentWindow, depth + 1, found); } catch {}
        }
        return found;
    }
    function hash(value) { let n = 2166136261; for (const ch of value) n = Math.imul(n ^ ch.charCodeAt(0), 16777619); return (n >>> 0).toString(16); }
    function extract(panel) {
        const controls = [...panel.querySelectorAll(inputs)].filter(optionVisible);
        if (controls.length < 2 || controls.length > 20) return null;
        const title = panel.querySelector('.tkItem_title,.ans-videoquiz-tit,.ans-videoquiz-title,.videoquiz-title,[data-question-title]') ||
            [...panel.querySelectorAll('p,h2,h3,h4')].find(el => !el.querySelector(inputs) && D.visible(el) && D.text(el).length > 8 && !/^(正确答案|回答正确|回答错误)/.test(D.text(el)));
        if (!title || (!D.text(title) && !D.imageKey(title))) return null;
        const rows = controls.map(control => control.closest('label') || control.labels?.[0] || control.closest('li,p,.ans-videoquiz-opt') || control.parentElement);
        const options = rows.map((row, index) => ({ key: String.fromCharCode(65 + index),
            text: D.text(row).replace(/^[A-T]\s*[、.．:：]\s*/, '').trim() || (D.imageKey(row) ? '（图片选项，请根据截图判断）' : ''),
            ...(D.imageKey(row) ? {imageKey:D.imageKey(row)} : {}) }));
        if (options.some(option => !option.text)) return null;
        const kind = D.text(panel.querySelector('.tkTopic_title,.ans-videoquiz-type,[data-question-type]')) || D.text(panel);
        const type = controls.some(control => control.type === 'checkbox' || control.getAttribute('role') === 'checkbox') ? 'multiple' : /判断题/.test(kind) ? 'boolean' : 'single';
        const question = { id: `vq${hash(D.text(title) + JSON.stringify(options))}`, type, text: D.text(title), options, obfuscated: !!globalThis.XxtFonts?.obfuscated(panel),
            requiresVision: [title,...rows].some(D.hasRenderedVisual),
            ...(D.imageKey(title) ? {imageKey:D.imageKey(title)} : {}) };
        return { panel, controls, rows, question, signature: JSON.stringify(question) };
    }
    function control(panel, pattern) {
        const matches = [...panel.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],.ans-videoquiz-submit,.ans-videoquiz-continue,#videoquiz-continue')]
            .filter(el => D.enabled(el) && pattern.test(D.text(el).replace(/[\s\u200b-\u200d\ufeff]/g, '')));
        return D.unique(matches.filter(el => !matches.some(other => other !== el && other.contains(el))));
    }
    const selected = el => el.matches('input') ? el.checked : el.getAttribute('aria-checked') === 'true';
    const selection = entry => entry.controls.flatMap((el, index) => selected(el) ? [entry.question.options[index].key] : []);
    const submitting = panel => [...panel.querySelectorAll('#videoquiz-submitting')].some(D.visible);
    const ownedSelections=new WeakMap();
    const manualSelections=new WeakSet();
    for(const type of ['click','keydown'])document.addEventListener(type,event=>{if(event.isTrusted){const target=event.target.closest?.(inputs)||event.target.closest?.('label')?.querySelector(inputs);if(target)manualSelections.add(target);}},true);
    async function apply(entry, answer, guard) {
        const prior=selection(entry).sort().join('');
        const untouchedDefault=entry.controls.every(el=>el.matches('input')&&el.checked===el.defaultChecked);
        if(entry.controls.some(el=>manualSelections.has(el)) || (prior && prior!==ownedSelections.get(entry.panel)&&!untouchedDefault))throw new Error('视频弹题存在手动选择，保留选择并取消自动提交');
        for (let index = 0; index < entry.controls.length; index++) {
            guard(); const el = entry.controls[index], want = answer.choices.includes(entry.question.options[index].key);
            if (selected(el) !== want && (entry.question.type === 'multiple' || want)) {
                if (el.disabled || el.getAttribute('aria-disabled') === 'true') throw new Error('视频弹题选项不可操作');
                const target = D.visible(el) ? el : el.closest('label') || el.labels?.[0];
                if (!D.enabled(target)) throw new Error('视频弹题选项不可操作');
                target.click(); await D.delay(100);
            }
        }
        guard();
        const actual = selection(entry);
        if (actual.sort().join('') !== [...answer.choices].sort().join('')) throw new Error('视频弹题选项未正确选中，已停止提交');
        ownedSelections.set(entry.panel,actual.sort().join(''));
    }
    function feedback(panel, question) {
        const nodes = [...panel.querySelectorAll(feedbackSelector + ',p')]
            .filter(el => D.visible(el) && (/^(回答正确|回答错误|答对|答错|正确答案)/.test(D.text(el)) || el.matches(feedbackSelector)));
        const text = nodes.map(D.text).join(' ');
        const wrong = nodes.some(el => el.matches('#spanNot,#spanNotBack,#spanNotBackPoint') && D.text(el).trim()) || /回答错误|答错|答案错误|真遗憾|再接再厉/.test(text);
        const total = D.text(panel.querySelector('.tkTopic_numbar')).match(/共\s*(\d+)\s*题/)?.[1];
        const right = D.text(panel.querySelector('#rightNum')).trim();
        const allCorrect = Number(total) > 0 && /^\d+$/.test(right) && Number(right) === Number(total);
        const correct = !wrong && (nodes.some(el => el.id === 'spanHas' && D.text(el).trim()) || allCorrect || /回答正确|答对/.test(text));
        let choices;
        const letters = text.match(/正确答案\s*[:：]\s*([A-T](?:[A-T\s,，、]*))/)?.[1]?.replace(/[\s,，、]/g, '');
        if (letters && [...letters].every(key => question?.options.some(option => option.key === key))) choices = [...new Set(letters)].sort();
        if (question?.type === 'boolean') {
            const value = text.match(/正确答案\s*[:：]\s*(对|错|正确|错误)/)?.[1];
            if (value) choices = question.options.filter(option => value.includes('错') ? /^(错|错误)$/.test(option.text) : /^(对|正确)$/.test(option.text)).map(option => option.key);
        }
        const remaining = D.text(panel).match(/剩余\s*[:：]?\s*(\d+)\s*次/);
        // spanNotBackPoint is also used for ordinary failures with an editable form.
        // Its ID alone does not mean the learner must return to an earlier video point.
        const reviewRequired = nodes.some(el => /回看|回到.*(?:知识点|视频)|重新观看|返回观看/.test(D.text(el)));
        const options = [...panel.querySelectorAll(inputs)].filter(optionVisible);
        const editable = options.length >= 2 && options.every(el => !el.disabled && !el.matches(':disabled') &&
            el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('aria-readonly') !== 'true' &&
            D.enabled(D.visible(el) ? el : el.closest('label') || el.labels?.[0]));
        const submitting = [...panel.querySelectorAll('#videoquiz-submitting')].some(D.visible);
        return { text, wrong, correct, choices,
            remaining: remaining ? Number(remaining[1]) : null,
            reviewRequired, editable,
            retry: control(panel, /^(重试|重新作答|重新答题|再试一次)$/),
            resubmit: wrong && !reviewRequired && editable && !submitting ? control(panel, /^(提交|确定)$/) : null,
            proceed: correct ? control(panel, /^(继续|继续播放|继续观看|继续学习|确定)$/) : null };
    }
    function watchResponse(panel) {
        let changed = false, judging = submitting(panel);
        const consume = records => {
            for (const record of records) {
                if (record.target.matches?.('#videoquiz-submitting')) {
                    if (D.visible(record.target)) judging = true;
                    else if (judging) changed = true;
                }
                if (record.target.closest?.(feedbackSelector) || record.target.parentElement?.closest(feedbackSelector) || [...record.addedNodes].some(node =>
                    node.nodeType === 1 && (node.matches(feedbackSelector) || node.querySelector(feedbackSelector)))) changed = true;
            }
        };
        const observer = new panel.ownerDocument.defaultView.MutationObserver(consume);
        observer.observe(panel, { attributes: true, childList: true, subtree: true, characterData: true });
        return { changed() { consume(observer.takeRecords()); return changed; }, started() { consume(observer.takeRecords()); return judging; }, close() { observer.disconnect(); } };
    }
    globalThis.XxtVideoQuiz = { find, across, extract, control, apply, selection, submitting, feedback, watchResponse };
})();
