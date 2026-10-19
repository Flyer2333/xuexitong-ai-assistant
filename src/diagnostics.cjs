/* Export only fixed labels and bounded facts, never caller-provided messages. */
(function (root) {
    const messages = { CANCELLED:'操作已取消', CONFIG:'模型配置需要检查', HTTP:'接口返回非成功状态', TIMEOUT:'等待响应超时',
        NETWORK:'网络请求失败，原因未确认', PARSE:'题目或响应结构无法确认', DOM:'页面或控件已变化', UNKNOWN:'未分类运行异常' };
    function classify(error) {
        const value = String(error?.message || error || '');
        const http = Number.isInteger(error?.status)&&error.status>=100&&error.status<=599 ? [null,String(error.status)] : value.match(/HTTP\s*(\d{3})/i);
        const code = /停止|取消|aborted/i.test(value) ? 'CANCELLED' : http ? 'HTTP' : /Key|配置|模型 ID|Base URL|连接码|视觉模型/.test(value) ? 'CONFIG' :
            /超时|timeout/i.test(value) ? 'TIMEOUT' : /连接失败|网络|network/i.test(value) ? 'NETWORK' : /切换|控件|已变化|不可见/.test(value) ? 'DOM' :
            /识别|解析|JSON|题型|选项|格式/.test(value) ? 'PARSE' : 'UNKNOWN';
        return { code, message: messages[code], ...(http ? { status: Number(http[1]) } : {}) };
    }
    function facts(value = {}) {
        const out = {};
        for (const key of ['batch','total','count','attempt','elapsedMs']) if (Number.isSafeInteger(value[key]) && value[key] >= 0) out[key] = value[key];
        if (['request','solve','video','reading','navigate','recovery','image-test'].includes(value.phase)) out.phase = value.phase;
        return out;
    }
    function create({ read = () => [], write = () => {}, now = Date.now } = {}) {
        const entries = [];
        // Old or modified persisted records are never exported as arbitrary text.
        const stored=read();
        for (const x of (Array.isArray(stored)?stored:[]).slice(-100)) if (x && Object.hasOwn(messages,x.code) && Number.isFinite(x.at)) entries.push({ code:x.code,message:messages[x.code],at:x.at,...facts(x),...(Number.isInteger(x.status)&&x.status>=100&&x.status<=599?{status:x.status}:{}) });
        return {
            record(error, context) { const entry = { ...classify(error), ...facts(context), at: now() }; entries.push(entry); if (entries.length > 100) entries.shift(); write(entries); return entry; },
            export(version) { return JSON.stringify({ schema:1, version:String(version).replace(/[^0-9.]/g,''), diagnostics:entries }, null, 2); },
            clear() { entries.length = 0; write([]); }
        };
    }
    const api = { classify, facts, create };
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.XxtDiagnostics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
