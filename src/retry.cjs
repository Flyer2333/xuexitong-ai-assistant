/* Retry comparison uses full question snapshots so moved option letters do not look like new answers. */
(function (root) {
    const C = typeof module !== 'undefined' && module.exports ? require('./core.cjs') : XxtCodexCore;
    const choicesKey = value => [...(value || [])].sort().join('');
    const batchKey = (questions, answers) => JSON.stringify(questions.map(q => [q.id, ['blank','essay'].includes(q.type)?answers.find(a=>a.id===q.id)?.texts:choicesKey(answers.find(a => a.id === q.id)?.choices)]));
    const optionIdentity = option => JSON.stringify([option.text.replace(/\s+/g, ''), option.imageKey || '']);
    const sameQuestion = (a, b) => a.type === b.type && C.normalizeQuestionText(a.text) === C.normalizeQuestionText(b.text) && a.imageKey === b.imageKey &&
        JSON.stringify(a.options.map(optionIdentity).sort()) === JSON.stringify(b.options.map(optionIdentity).sort());
    function remap(questions, attempt) {
        if (attempt.questions?.length !== questions.length || attempt.answers?.length !== questions.length) return null;
        const answers = [], used = new Set();
        for (const question of questions) {
            let candidates = attempt.questions.filter(old => old.id === question.id && sameQuestion(question, old));
            if (!candidates.length) candidates = attempt.questions.filter(old => sameQuestion(question, old));
            if (candidates.length !== 1 || used.has(candidates[0].id)) return null;
            const old = candidates[0], answer = attempt.answers.find(a => a.id === old.id);
            if (!answer) return null;
            if (['blank','essay'].includes(question.type)) {
                if (question.slots!==old.slots || !Array.isArray(answer.texts) || answer.texts.length!==question.slots) return null;
                used.add(old.id);answers.push({id:question.id,choices:[],texts:[...answer.texts]});continue;
            }
            const unchangedOptions = JSON.stringify(old.options) === JSON.stringify(question.options);
            const validChoices = Array.isArray(answer.choices) && answer.choices.length && new Set(answer.choices).size === answer.choices.length &&
                answer.choices.every(key => question.options.some(o => o.key === key)) && (question.type === 'multiple' || answer.choices.length === 1);
            const mapped = unchangedOptions && validChoices ? { choices: [...answer.choices].sort() } :
                C.recallAnswers([question], [{ question: { ...old, id: question.id }, choices: answer.choices }])[0];
            if (!mapped) return null;
            used.add(old.id); answers.push({ id: question.id, choices: mapped.choices });
        }
        return answers;
    }
    function plan(questions, attempts = []) {
        const relevant = attempts.flatMap(attempt => {
            const answers = remap(questions, attempt);
            return answers && attempt.finalScore < attempt.maxScore ? [{ ...attempt, answers }] : [];
        });
        const forbidden = [...new Map(relevant.map(a => [batchKey(questions, a.answers), a.answers])).values()];
        const history = relevant.slice(-5).map(({ finalScore, maxScore, answers, review = [] }) => ({ finalScore, maxScore, answers,
            review: [...review.slice(0, 19), '历史答案字母已按本轮题目及选项重新映射。只有整卷成绩时，未满分不代表每道题都错。'] }));
        return { forbidden, history, repeated: answers => forbidden.some(old => batchKey(questions, old) === batchKey(questions, answers)) };
    }
    function novel(questions, answers, forbidden = [], locked = []) {
        // Text answers have no finite option space. Never synthesize a new string
        // just to evade a previously failed answer vector.
        if (questions.some(q=>['blank','essay'].includes(q.type))) {
            if (forbidden.some(old=>batchKey(questions,old)===batchKey(questions,answers))) return {answers:[],changed:false,exhausted:true};
            return {answers,changed:false,exhausted:false};
        }
        const fixed = new Set(locked.map(a => a.id));
        const domains = questions.map(q => ({ q, radix: fixed.has(q.id) ? 1 : q.type === 'multiple' ? 2 ** q.options.length - 1 : q.options.length }));
        const encode = values => {
            let n = 0n, weight = 1n;
            for (const { q, radix } of domains) {
                const selected = values.find(a => a.id === q.id)?.choices || [];
                const index = radix === 1 ? 0 : q.type === 'multiple' ? selected.reduce((mask, key) => mask | 2 ** q.options.findIndex(o => o.key === key), 0) - 1 : q.options.findIndex(o => o.key === selected[0]);
                if (index < 0 || index >= radix) return null;
                n += BigInt(index) * weight; weight *= BigInt(radix);
            }
            return n;
        };
        const total = domains.reduce((n, d) => n * BigInt(d.radix), 1n);
        const blocked = new Set(forbidden.filter(old => locked.every(a => choicesKey(old.find(o => o.id === a.id)?.choices) === choicesKey(a.choices)))
            .map(encode).filter(n => n !== null).map(String));
        const initial = encode(answers);
        if (initial === null) throw new Error('无法比较本轮答案');
        if (!blocked.has(String(initial))) return { answers, changed: false, exhausted: false };
        if (BigInt(blocked.size) >= total) return { answers: [], changed: false, exhausted: true };
        let candidate = initial;
        for (let step = 0; step <= blocked.size; step++) { candidate = (candidate + 1n) % total; if (!blocked.has(String(candidate))) break; }
        let remaining = candidate;
        const result = domains.map(({ q, radix }) => {
            const previous = answers.find(a => a.id === q.id), index = Number(remaining % BigInt(radix)); remaining /= BigInt(radix);
            if (fixed.has(q.id)) return previous;
            const choices = q.type === 'multiple' ? q.options.filter((o, i) => (index + 1) & 2 ** i).map(o => o.key) : [q.options[index].key];
            if (choicesKey(choices) === choicesKey(previous.choices)) return previous;
            return { ...previous, choices: choices.sort(), confidence: Math.min(previous.confidence ?? 0, 0.79), noveltyAdjusted: true,
                explanation: 'AI复核后仍重复旧组合，采用尚未提交的候选；该调整不代表已确定正确答案。' };
        });
        return { answers: result, changed: true, exhausted: false };
    }
    function comparisonHistory(history, candidate, known, revision) {
        if (!history.length) return history;
        const result = history.map(h => ({ ...h, review: [...h.review] })), last = result[result.length - 1];
        const detail = `本次复核序号：${revision}。本轮候选 ${JSON.stringify(candidate.map(({ id, choices }) => ({ id, choices })))} 与已失败的整卷组合相同，尚未再次提交。平台已确认正确并保留：${JSON.stringify(known.map(({ id, choices }) => ({ id, choices })))}。请比较历史得分、逐题选项与原有解释，重新推理未确认题，给出不同整卷候选并说明改变依据；不应仅因整卷未满分就改变所有题。`;
        last.review = [...last.review.slice(0, 19), detail.slice(0, 3000)]; return result;
    }
    const api = { remap, plan, novel, comparisonHistory, batchKey };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.XxtRetry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
