/* Visible DOM adapters; result text follows the user's screenshots, not a live DOM dump. */
(() => {
    const text = el => (el?.textContent || el?.value || '').replace(/\s+/g, ' ').trim();
    const visible = el => !!(el?.isConnected && el.getClientRects().length && el.ownerDocument.defaultView.getComputedStyle(el).visibility !== 'hidden');
    const enabled = el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !el.classList.contains('disabled');
    const buttons = doc => [...doc.querySelectorAll('a,button,[role="button"],input[type="button"],input[type="submit"]')].filter(visible);
    const unique = items => items.length === 1 ? items[0] : null;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    function pageText(doc) {
        if (!doc.body) return '';
        const walker = doc.createTreeWalker(doc.body, 4);
        const lines = [];
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent?.closest('[data-xxt-codex-panel],script,style') && visible(parent)) lines.push(node.textContent);
        }
        return lines.join(' ').replace(/\s+/g, ' ').trim();
    }
    function extract(doc) {
        return [...doc.querySelectorAll('.TiMu')].filter(el => !el.parentElement?.closest('.TiMu')).map((el, index) => {
            const kind = text(el.querySelector('.newZy_TItle'));
            const type = kind.includes('多选题') ? 'multiple' : kind.includes('判断题') ? 'boolean' : kind.includes('单选题') ? 'single' : 'unsupported';
            const rows = [...el.querySelectorAll('.Zy_ulTop > li')];
            const choiceClass = el.querySelector('[class*="choice"]')?.className.match(/\bchoice(\d+)\b/);
            return { element: el, rows, question: {
                id: choiceClass ? `q${choiceClass[1]}` : `q${index + 1}`,
                type, text: text(el.querySelector('.Zy_TItle')), obfuscated: !!el.querySelector('.font-cxsecret'),
                options: rows.map(row => ({ key: text(row.querySelector('.num_option_dx,.num_option')), text: text(row.querySelector('.after')) }))
            } };
        });
    }
    function readResult(doc) {
        if (enabled(doc.querySelector('.btnSubmit.workBtnIndex'))) return null;
        const value = pageText(doc);
        let score = value.match(/最终成绩\s*(\d+(?:\.\d+)?)\s*分/);
        const scoreSource = score ? 'final' : 'attempt';
        if (!score && /第\s*\d+\s*次\s*作答/.test(value) && /我的答案\s*[:：]/.test(value)) {
            const attempts = [...value.matchAll(/本次成绩\s*(\d+(?:\.\d+)?)\s*分/g)];
            if (attempts.length === 1) score = attempts[0];
        }
        const maximum = value.match(/满分\s*[:：]\s*(\d+(?:\.\d+)?)/);
        if (!score || !maximum) return null;
        const finalScore = Number(score[1]), maxScore = Number(maximum[1]);
        if (maxScore <= 0 || finalScore > maxScore || finalScore < 0) return null;
        const candidates = buttons(doc).filter(el => /重做|重新作答/.test(text(el)));
        if (candidates.length > 1) return { ambiguous: true };
        const redo = candidates[0] || null;
        const count = redo && text(redo).match(/剩余\s*[:：]?\s*(\d+)\s*次/);
        const remaining = count ? Number(count[1]) : null;
        const attempt = value.match(/第\s*(\d+)\s*次\s*作答/);
        return { finalScore, maxScore, scoreSource, allCorrect: Math.abs(finalScore - maxScore) < 0.001,
            remaining, redo, redoAvailable: !!redo && enabled(redo), resultKnown: true,
            fingerprint: `${finalScore}/${maxScore}/${remaining}/${attempt?.[1] || ''}`,
            review: [...doc.querySelectorAll('.TiMu,.mark_table')].filter(visible).map(el => text(el).slice(0, 3000)).slice(0, 20) };
    }
    function confirmation(doc, kind = 'submit') {
        const label = el => text(el).replace(/[\s\u200b-\u200d\ufeff]/g, '');
        const promptPattern = kind === 'redo' ? /^(?:(?:之前|此前|先前)答题(?:内容|答案)不会保留[,，。]?)?确认(?:重做|重新作答)[?？]$/ : /^确认提交[?？]$/;
        const confirmLabel = kind === 'redo' ? '确定' : '提交';
        const prompts = [...doc.querySelectorAll('p,div,span,h1,h2,h3,label')].filter(el =>
            !el.closest('[data-xxt-codex-panel],script,style') && visible(el) && promptPattern.test(label(el)));
        const found = new Set();
        for (const prompt of prompts) {
            let parent = prompt.parentElement;
            for (let depth = 0; parent && parent !== doc.body && depth < 12; depth++, parent = parent.parentElement) {
                const choices = [...parent.querySelectorAll('a,button,[role="button"],input[type="button"],input[type="submit"],div,span')]
                    .filter(el => enabled(el) && [confirmLabel, '取消'].includes(label(el)));
                // Resolve a nested label to its clickable wrapper, including div/span controls.
                const controls = [...new Set(choices.map(el => {
                    const wrapper = el.closest('a,button,[role="button"],input,[onclick]');
                    return wrapper && parent.contains(wrapper) ? wrapper : el;
                }))].filter(enabled).filter(el => !choices.some(other => other !== el && other.contains(el) && label(other) === label(el)));
                const submit = controls.filter(el => label(el) === confirmLabel);
                if (submit.length === 1 && controls.some(el => label(el) === '取消')) { found.add(submit[0]); break; }
            }
        }
        return unique([...found]);
    }
    function readCorrectAnswers(doc, questions = []) {
        const learned = [];
        for (const block of [...doc.querySelectorAll('.TiMu')].filter(visible)) {
            const classId = block.querySelector('[class*="choice"]')?.className.match(/\bchoice(\d+)\b/)?.[1];
            const title = text(block.querySelector('.Zy_TItle'));
            const matches = classId ? questions.filter(q => q.id === `q${classId}`) : questions.filter(q =>
                XxtCodexCore.normalizeQuestionText(q.text) === XxtCodexCore.normalizeQuestionText(title));
            if (matches.length !== 1) continue;
            const question = matches[0];
            const values = [...block.querySelectorAll('p,div,span,label,strong')].filter(el => visible(el) &&
                !el.closest('.Zy_TItle,.Zy_ulTop,[data-xxt-codex-panel]')).map(el => {
                const match = text(el).match(/^(?:(?:正确|参考|标准)答案|答案)\s*[:：]\s*([^:：]+?)(?=我的答案|你的答案|答案解析|解析|得分|$)/);
                return match?.[1]?.trim();
            }).filter(Boolean);
            const found = [];
            for (const value of values) {
                let choices;
                const clean = value.replace(/[\s,，、;；.．]/g, '');
                if (/^[A-T]+$/.test(clean)) choices = [...clean];
                else if (question.type === 'boolean') {
                    const correct = /^(对|正确|√|true)$/i.test(clean), wrong = /^(错|错误|×|false)$/i.test(clean);
                    if (correct || wrong) choices = question.options.filter(option =>
                        (correct ? /^(对|正确|√|true)$/i : /^(错|错误|×|false)$/i).test(option.text.trim())).map(option => option.key);
                }
                if (!choices?.length || new Set(choices).size !== choices.length || choices.some(key => !question.options.some(option => option.key === key)) ||
                    (question.type !== 'multiple' && choices.length !== 1)) continue;
                found.push(choices.sort().join(''));
            }
            const distinct = [...new Set(found)];
            if (distinct.length === 1) learned.push({ question, choices: [...distinct[0]] });
        }
        return learned;
    }
    function ancestorConfirmation(win, kind = 'submit') {
        const found = new Set();
        for (let depth = 0; win && depth < 8; depth++) {
            try { const button = confirmation(win.document, kind); if (button) found.add(button); } catch {}
            if (win === win.parent) break;
            win = win.parent;
        }
        return unique([...found]);
    }
    function selected(row) {
        const control = row.querySelector('input[type="radio"],input[type="checkbox"]');
        if (control) return control.checked;
        const aria = row.getAttribute('aria-checked');
        if (aria === 'true' || aria === 'false') return aria === 'true';
        const marker = row.querySelector('.num_option_dx,.num_option');
        if (!marker) throw new Error('无法核对选项状态');
        return marker.classList.contains('check_answer') || marker.classList.contains('check_answer_dx') ||
            row.classList.contains('check_answer') || row.classList.contains('check_answer_dx');
    }
    async function applyAnswers(entries, answers, assertCurrent = () => {}) {
        for (const entry of entries) {
            const answer = answers.find(item => item.id === entry.question.id);
            if (!answer) throw new Error('答案与题目不一致');
            for (let index = 0; index < entry.rows.length; index++) {
                assertCurrent();
                const row = entry.rows[index];
                const desired = answer.choices.includes(entry.question.options[index].key);
                if (selected(row) !== desired && (entry.question.type === 'multiple' || desired)) {
                    if (!enabled(row)) throw new Error('选项不可操作');
                    (row.querySelector('.num_option_dx,.num_option') || row).click();
                    await delay(100);
                }
            }
            assertCurrent();
            const actual = entry.rows.flatMap((row, index) => selected(row) ? [entry.question.options[index].key] : []).sort();
            if (actual.join(',') !== [...answer.choices].sort().join(',')) throw new Error(`题目 ${entry.question.id} 未正确选中，取消提交`);
        }
    }
    function navigationPrompt(doc) {
        const label = el => text(el).replace(/[\s\u200b-\u200d\ufeff]/g, '');
        const prompts = [...doc.querySelectorAll('p,div,span,label')].filter(el => visible(el) &&
            !el.closest('[data-xxt-codex-panel],script,style') && /^当前章节还有任务点未完成[,，。]是否去完成[?？]$/.test(label(el)));
        const found = new Map();
        for (const prompt of prompts) {
            for (let scope = prompt.parentElement, depth = 0; scope && scope !== doc.body && depth < 12; scope = scope.parentElement, depth++) {
                const controls = [...new Set([...scope.querySelectorAll('a,button,[role="button"],input,div,span')].filter(el =>
                    enabled(el) && ['去学习', '下一节'].includes(label(el))).map(el => el.closest('a,button,[role="button"],input,[onclick]') || el))]
                    .filter(el => !el.closest('[data-xxt-codex-panel]'));
                const next = unique(controls.filter(el => label(el) === '下一节'));
                if (!next || !controls.some(el => label(el) === '去学习')) continue;
                const closes = [...scope.querySelectorAll('button,a,[role="button"],[onclick],[aria-label],[title],[class*="close"],[class*="Close"]')]
                    .filter(el => enabled(el) && (/^(关闭|×|✕|✖)$/.test(el.getAttribute('aria-label') || el.title || label(el)) ||
                        /(?:^|\s)[\w-]*close[\w-]*(?:\s|$)/i.test(el.className || '')))
                    .map(el => el.closest('button,a,[role="button"],[onclick]') || el);
                found.set(next, { next, close: unique([...new Set(closes)]) }); break;
            }
        }
        return unique([...found.values()]);
    }
    function ancestorNavigationPrompt(win) {
        const found = new Map();
        for (let depth = 0; win && depth < 8; depth++) {
            try { const prompt = navigationPrompt(win.document); if (prompt) found.set(prompt.next, prompt); } catch {}
            if (win === win.parent) break;
            win = win.parent;
        }
        return unique([...found.values()]);
    }
    const findNext = doc => {
        const prompt = navigationPrompt(doc);
        return unique(buttons(doc).filter(el => el !== prompt?.next && /^(下一节|下一?小节)$/.test(text(el))));
    };
    globalThis.XxtCodexDom = { text, visible, enabled, buttons, unique, delay, extract, readResult, readCorrectAnswers, confirmation, ancestorConfirmation,
        navigationPrompt, ancestorNavigationPrompt, selected, applyAnswers, findNext, pageText };
})();
