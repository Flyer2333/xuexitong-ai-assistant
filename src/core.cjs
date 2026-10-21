/* Shared validation for the browser assistant and the local Codex bridge. */
(function (root) {
    const supported = new Set(['single', 'multiple', 'boolean','blank','essay']);
    const textQuestion = q => ['blank','essay'].includes(q.type);
    const playbackRates = [1, 1.25, 1.5, 1.75, 2];
    const normalizePlaybackRate = value => playbackRates.includes(Number(value)) ? Number(value) : 1;
    function validateQuestions(questions, max = 20) {
        if (!Array.isArray(questions) || !questions.length || questions.length > max) throw new Error(`题目数量必须为 1–${max}`);
        const ids = new Set();
        for (const q of questions) {
            if (!q || typeof q.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(q.id) || ids.has(q.id)) throw new Error('题目标识无效或重复');
            ids.add(q.id);
            if (!supported.has(q.type)) throw new Error('不支持的题型');
            if (typeof q.text !== 'string' || q.text.length > 8000) throw new Error('题干无效');
            if (textQuestion(q)) {
                if (!Array.isArray(q.options) || q.options.length || !Number.isInteger(q.slots) || q.slots < 1 || q.slots > 20 || (q.type === 'essay' && q.slots !== 1)) throw new Error('文本题输入框映射无效');
                continue;
            }
            if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 20) throw new Error('选项数量无效');
            const keys = new Set();
            for (const option of q.options) {
                if (!option || typeof option.key !== 'string' || !/^[A-T]$/.test(option.key) || keys.has(option.key) || typeof option.text !== 'string' || !option.text.trim() || option.text.length > 4000) throw new Error('选项无效或重复');
                keys.add(option.key);
            }
            if (q.type === 'boolean' && q.options.length !== 2) throw new Error('判断题应有两个选项');
        }
        return questions;
    }
    function validateAnswers(questions, result, { allowUncertain = false } = {}) {
        validateQuestions(questions, 200);
        if (!result || !Array.isArray(result.answers) || result.answers.length !== questions.length) throw new Error('模型未返回全部题目的答案');
        const ids = new Set();
        return result.answers.map(answer => {
            const q = questions.find(item => item.id === answer.id);
            if (!q || ids.has(answer.id)) throw new Error('模型返回了重复或未知题目');
            ids.add(answer.id);
            if (typeof answer.readable !== 'boolean' || !Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) throw new Error('模型置信度或可读性无效');
            const uncertain = !answer.readable || answer.confidence < 0.8;
            if (!allowUncertain && !answer.readable) throw new Error(`题目 ${q.id} 截图无法可靠识别，停止作答`);
            if (!allowUncertain && uncertain) throw new Error(`题目 ${q.id} 的答案不确定，停止作答`);
            if (textQuestion(q)) {
                if (!Array.isArray(answer.texts) || answer.texts.length !== q.slots || answer.texts.some(s=>typeof s!=='string'||!s.trim()||s.length>8000)) throw new Error('文本答案数量或内容无效');
                if (typeof answer.explanation !== 'string' || answer.explanation.length > 4000) throw new Error('模型解释无效');
                return {id:q.id,texts:[...answer.texts],choices:[],readable:answer.readable,confidence:answer.confidence,explanation:answer.explanation};
            }
            if (!Array.isArray(answer.choices) || (!answer.choices.length && !(allowUncertain && uncertain)) || new Set(answer.choices).size !== answer.choices.length || answer.choices.some(key => !q.options.some(opt => opt.key === key))) throw new Error('模型选项无效');
            if (q.type !== 'multiple' && answer.choices.length !== 1 && !(allowUncertain && uncertain && !answer.choices.length)) throw new Error('单选题或判断题只能选择一项');
            if (typeof answer.explanation !== 'string' || answer.explanation.length > 4000) throw new Error('模型解释无效');
            return { id: q.id, choices: [...answer.choices].sort(), readable: answer.readable, explanation: answer.explanation, confidence: answer.confidence };
        });
    }
    function resolveAnswers(questions, result, { randomizeUncertain = false, random = Math.random } = {}) {
        return validateAnswers(questions, result, { allowUncertain: true }).map(answer => {
            if (!randomizeUncertain || (answer.readable && answer.confidence >= 0.8)) return answer;
            const q = questions.find(item => item.id === answer.id);
            if (textQuestion(q)) {
                if (!answer.readable) throw new Error(`填空/简答题 ${q.id} 被模型标记为无法读清，保留原输入`);
                // A complete model candidate is a first attempt, not a random string.
                // Let platform scoring and the existing reference-answer retry judge it.
                return {...answer,lowConfidence:true};
            }
            const keys = q.options.map(option => option.key);
            const pick = () => keys[Math.min(keys.length - 1, Math.max(0, Math.floor(random() * keys.length)))];
            const choices = q.type === 'multiple' ? keys.filter(() => random() < 0.5) : [pick()];
            if (!choices.length) choices.push(pick());
            return { ...answer, choices: choices.sort(), randomized: true, explanation: '答案不确定，按设置随机填写；提交后读取平台正确答案。' };
        });
    }
    const normalizeQuestionText = value => String(value || '').replace(/^\s*\d+\s*[.、．]?\s*/, '')
        .replace(/【(?:单选题|多选题|判断题|填空题|简答题|论述题)】/g, '').replace(/\s+/g, '').trim();
    function recallAnswers(questions, learned = []) {
        const answers = [];
        for (const q of questions) {
            const candidates = learned.filter(item => item.question?.id === q.id && item.question.type === q.type &&
                normalizeQuestionText(item.question.text) === normalizeQuestionText(q.text) && item.question.imageKey === q.imageKey);
            if (candidates.length !== 1) continue;
            const item = candidates[0];
            if (textQuestion(q)) {
                if (q.slots === item.question.slots && Array.isArray(item.texts) && item.texts.length === q.slots && item.texts.every(s=>typeof s==='string'&&s.trim()&&s.length<=8000))
                    answers.push({id:q.id,texts:[...item.texts],choices:[],readable:true,confidence:1,explanation:'采用平台已显示的正确答案。',source:'platform'});
                continue;
            }
            const choices = [];
            for (const oldKey of item.choices || []) {
                const oldOption = item.question.options.find(option => option.key === oldKey);
                if (!oldOption) break;
                const matches = q.options.filter(option => option.text.replace(/\s+/g, '') === oldOption.text.replace(/\s+/g, '') && option.imageKey === oldOption.imageKey);
                if (matches.length !== 1) break;
                choices.push(matches[0].key);
            }
            if (!choices.length || choices.length !== item.choices?.length || new Set(choices).size !== choices.length || (q.type !== 'multiple' && choices.length !== 1)) continue;
            answers.push({ id: q.id, choices: choices.sort(), readable: true, confidence: 1, explanation: '采用平台已显示的正确答案。', source: 'platform' });
        }
        return answers;
    }
    function nextAction({ allCorrect, remaining, redoAvailable, resultKnown }) {
        if (!resultKnown || typeof allCorrect !== 'boolean') return 'wait';
        if (allCorrect === true) return 'advance';
        if (redoAvailable !== true || remaining === 0) return 'skip';
        if (remaining == null) return 'redo';
        if (!Number.isSafeInteger(remaining) || remaining < 0) return 'pause';
        return 'redo';
    }
    function validateHistory(history = []) {
        if (!Array.isArray(history) || history.length > 5) throw new Error('最多携带最近五轮成绩');
        return history.map(item => {
            if (!item || !Number.isFinite(item.finalScore) || !Number.isFinite(item.maxScore) || item.maxScore <= 0 || item.finalScore < 0 || item.finalScore > item.maxScore) throw new Error('历史成绩无效');
            const answers = item.answers || [], review = item.review || [];
            if (!Array.isArray(answers) || answers.length > 20 || !Array.isArray(review) || review.length > 20 || review.some(value => typeof value !== 'string' || value.length > 3000)) throw new Error('历史反馈无效');
            for (const answer of answers) {
                if (typeof answer.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(answer.id) || !Array.isArray(answer.choices) || answer.choices.length > 20 || answer.choices.some(value => !/^[A-T]$/.test(value))) throw new Error('历史选项无效');
                if (answer.texts && (!Array.isArray(answer.texts) || answer.texts.length>20 || answer.texts.some(s=>typeof s!=='string'||s.length>8000))) throw new Error('历史文本答案无效');
            }
            return { finalScore: item.finalScore, maxScore: item.maxScore, answers, review };
        });
    }
    function quietHoursAt(timestamp = Date.now()) {
        const hour = new Date(timestamp + 8 * 60 * 60 * 1000).getUTCHours();
        return hour >= 23 || hour < 7;
    }
    const api = { validateQuestions, validateAnswers, resolveAnswers, recallAnswers, normalizeQuestionText, validateHistory, nextAction, quietHoursAt, playbackRates, normalizePlaybackRate };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.XxtCodexCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
