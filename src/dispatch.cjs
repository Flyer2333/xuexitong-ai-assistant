/* Independently implemented request routing. No third-party implementation is bundled. */
(function (root) {
    const needsVision = q => !!(q.obfuscated || q.imageKey || q.requiresVision || q.options?.some(o => o.imageKey) || /[\ue000-\uf8ff\ufffd]/u.test([q.text,...(q.options||[]).map(o=>o.text)].join(' ')));
    const core = typeof module === 'object' && module.exports ? require('./core.cjs') : root.XxtCodexCore;
    function batches(payload, { routing = true, size, limit = 12000 } = {}) {
        const groups = new Map(), questions = payload.questions || [];
        if (questions.length > core.pageQuestionLimit) throw new Error(`单页最多处理${core.pageQuestionLimit}题，请缩小范围`);
        if (size !== undefined && (!Number.isInteger(size) || size < 1 || size > 20)) throw new Error('每批题数必须为1–20');
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i], vision = !routing || needsVision(q), key = !routing ? 'legacy' : vision ? 'vision' : 'text';
            const own = payload.imageQuestionIds ? (payload.imageQuestionIds.includes(q.id) ? [payload.images[payload.imageQuestionIds.indexOf(q.id)]] : []) :
                (payload.images?.length === questions.length ? [payload.images[i]] : payload.images || []);
            const assets = vision ? own.filter(Boolean) : [];
            if (routing && vision && !assets.length) throw new Error('图片题缺少完整截图，未发送不完整题目');
            const list = groups.get(key) || []; list.push({ q, assets }); groups.set(key, list);
        }
        const result = [];
        for (const [kind, entries] of groups) {
            const batchSize = size ?? (kind === 'text' ? 16 : 8);
            let part = [], weight = 0;
            const flush = () => {
                if (!part.length) return;
                const ids = new Set(part.map(x => x.q.id));
                const images = [...new Set(part.flatMap(x => x.assets))];
                const imageManifest = images.map((image,index) => ({image:index+1,questionIds:part.filter(x=>x.assets.includes(image)).map(x=>x.q.id)}));
                result.push({ kind, questions: part.map(x => x.q), images, imageManifest,
                    history: (payload.history || []).map(h => ({ ...h, answers: (h.answers || []).filter(a => ids.has(a.id)) })) });
                part = []; weight = 0;
            };
            for (const entry of entries) {
                const n = JSON.stringify(entry.q).length;
                if (part.length && (part.length >= batchSize || weight + n > limit)) flush();
                part.push(entry); weight += n;
            }
            flush();
        }
        return result;
    }
    function run(payload, { base, vision, transport, progress = () => {} }) {
        let active, cancelled = false;
        const check = () => { if (cancelled) throw new Error('已停止本次 AI 调用'); };
        const promise = (async () => {
            const skipped=(payload.questions||[]).filter(q=>needsVision(q)&&!vision?.key).map(q=>({id:q.id,reason:'未配置图片接口，已跳过图片题'}));
            const accepted=(payload.questions||[]).filter(q=>!skipped.some(x=>x.id===q.id));
            const parts = batches({...payload,questions:accepted}, { routing:true }), answers = [];
            for (let i = 0; i < parts.length; i++) {
                check(); const part = parts[i];
                const config = part.kind === 'text' ? { ...base, vision: false } : { ...vision, vision: true };
                progress({ batch: i + 1, total: parts.length, kind: part.kind, count: part.questions.length });
                active = transport(config, '/solve', part); const result = await active.promise; check();
                answers.push(...result.answers);
            }
            check();
            return { answers: accepted.map(q => answers.find(a => a.id === q.id)),skipped };
        })();
        return { promise, abort() { cancelled = true; active?.abort(); } };
    }
    const api = { needsVision, batches, run };
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.XxtDispatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
