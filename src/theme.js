(() => {
    'use strict';
    const css = `
[data-xxt-codex-panel]{--ink:#1e293b;--accent:#4f46e5;--line:#e2e8f0;color:var(--ink)!important;font:13px/1.6 system-ui,'Microsoft YaHei',sans-serif!important;color-scheme:light}
[data-xxt-codex-panel] *{box-sizing:border-box}
[data-xxt-codex-panel] .xxt-shell{border:1px solid #d7ddea;border-radius:18px;background:#f8fafc;box-shadow:0 16px 50px #17255424;overflow:hidden}
[data-xxt-codex-panel] .xxt-head{display:flex;align-items:center;gap:10px;padding:18px;background:linear-gradient(120deg,#eef2ff,#f8fafc);border-bottom:1px solid var(--line);cursor:grab}
[data-xxt-codex-panel] .xxt-head:before{flex-shrink:0;content:'AI';display:grid;place-items:center;background:#4f46e5;color:#fff;font-weight:800;border-radius:12px;width:38px;height:38px;font-size:14px}
[data-xxt-codex-panel] strong{font-size:16px;letter-spacing:.3px}
[data-xxt-codex-panel] .xxt-version{color:#64748b;font-size:10px;letter-spacing:1px}
[data-xxt-codex-panel] .xxt-fold{flex-shrink:0;margin-left:auto;border:0;background:#fff;color:#64748b;border-radius:8px;width:28px;height:28px;cursor:pointer}
[data-xxt-codex-panel] .xxt-body{padding:16px;max-height:70vh;overflow:auto}
[data-xxt-codex-panel] .xxt-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
[data-xxt-codex-panel] button{font:inherit;cursor:pointer}
[data-xxt-codex-panel] .xxt-actions button{margin:0!important;padding:10px!important;border:1px solid #d9dfeb;border-radius:10px;background:#fff;color:#475569;font-weight:600}
[data-xxt-codex-panel] .xxt-actions button:hover{background:#eef2ff;border-color:#a5b4fc}
[data-xxt-codex-panel] .xxt-actions [data-action=start]{background:#4f46e5;color:white;border-color:#4f46e5}
[data-xxt-codex-panel] .xxt-actions [data-action=stop]{color:#be123c;background:#fff8fa;border-color:#f5d3dd}
[data-xxt-codex-panel] .xxt-state{font-size:11px;color:#64748b;display:flex;align-items:center;gap:6px;margin-bottom:8px}
[data-xxt-codex-panel] .xxt-state:before{content:'';width:6px;height:6px;border-radius:50%;background:#6366f1}
[data-xxt-codex-panel][data-sleeping=true] .xxt-state:before{background:#94a3b8}
[data-xxt-codex-panel] pre{font:inherit!important;margin:0!important;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px!important;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow:auto;color:#475569}
[data-xxt-codex-panel] .xxt-settings{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;color:#64748b;font-size:11px}
[data-xxt-codex-panel] .xxt-rate-setting{display:flex;width:100%;justify-content:space-between;align-items:center}
[data-xxt-codex-panel] input,[data-xxt-codex-panel] select{font:inherit;color:#334155;background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:7px;min-width:0}
[data-xxt-codex-panel] input[type=checkbox]{accent-color:#4f46e5;vertical-align:middle;margin:0 4px 0 0}
[data-xxt-codex-panel] details{border-top:1px solid var(--line);margin-top:12px;padding-top:10px;font-size:12px;color:#64748b}
[data-xxt-codex-panel] summary{cursor:pointer;font-weight:600;color:#475569}
[data-xxt-codex-panel] details img{max-width:100%;border-radius:8px;margin-top:8px}
[data-xxt-codex-panel] .ai-form{display:grid;gap:10px;margin-top:12px}
[data-xxt-codex-panel] .ai-form>label{display:grid;gap:4px;font-size:11px}
[data-xxt-codex-panel] .ai-form small{color:#64748b;font-size:11px;line-height:1.6}
[data-xxt-codex-panel] .ai-buttons{display:flex;gap:8px}
[data-xxt-codex-panel] .ai-buttons button{border:1px solid #c7d2fe;background:#eef2ff;color:#4338ca;border-radius:8px;padding:8px 12px}
[data-xxt-codex-panel] .xxt-feedback{border-top:1px solid var(--line);margin-top:12px;padding-top:10px;color:#64748b;font-size:11px;line-height:1.7}
[data-xxt-codex-panel] .xxt-feedback-links{display:flex;gap:14px;margin-bottom:4px}
[data-xxt-codex-panel] .xxt-feedback a{color:#4f46e5;text-decoration:none;font-weight:600}
[data-xxt-codex-panel] .xxt-feedback a:hover{text-decoration:underline}
[data-xxt-codex-panel] [hidden]{display:none!important}
`;
    function aiSettings(onChange) {
        const A = XxtAi, section = document.createElement('details'); section.dataset.aiSettings = 'true';
        const heading = document.createElement('summary'); heading.textContent = 'AI 接口设置';
        const form = document.createElement('div'); form.className = 'ai-form';
        const fields = {};
        function field(key, label, options) {
            const wrapper = document.createElement('label'); wrapper.textContent = label;
            const input = document.createElement(options ? 'select' : 'input'); input.dataset.aiField = key;
            if (options) for (const [value, text] of options) { const option = document.createElement('option'); option.value = value; option.textContent = text; input.append(option); }
            wrapper.append(input); form.append(wrapper); fields[key] = input; return input;
        }
        field('provider','服务商',Object.entries(A.presets).map(([key,value]) => [key,value.label]));
        field('protocol','接口协议',[['chat','OpenAI Chat Completions'],['responses','OpenAI Responses'],['anthropic','Claude Messages'],['gemini','Gemini generateContent'],['codex','本地 Codex']]);
        field('baseUrl','Base URL（不带具体接口路径）');
        field('model','模型 ID（从服务商控制台复制）');
        field('key','API Key / 本地连接码'); fields.key.type = 'password'; fields.key.autocomplete = 'off';
        field('maxTokens','最大输出 token'); fields.maxTokens.type = 'number'; fields.maxTokens.min = '256'; fields.maxTokens.max = '32768';
        field('reasoning','推理强度（仅 OpenAI 协议，默认不发送）',[['','使用模型默认值'],['low','low'],['medium','medium'],['high','high'],['xhigh','xhigh（仅支持的模型）']]);
        for (const [key,label] of [['vision','发送题目截图（须选视觉模型）'],['jsonMode','发送 JSON 模式参数（须接口支持）']]) { field(key,label); fields[key].type = 'checkbox'; }
        const note = document.createElement('small'); note.textContent = 'API 按服务商用量计费。“测试 AI”会发送一条短请求。Key 保存在油猴存储，非加密保险箱；仅向你配置的 API 发送题目与截图。更换服务商或地址后必须重新输入 Key。';
        const message = document.createElement('small'); message.setAttribute('role','status');
        function populate() {
            const c = A.load();
            for (const [key,input] of Object.entries(fields)) { if (key === 'key') { input.value = ''; input.placeholder = c.key ? '已保存，留空保留（同一地址）' : '请输入你自己的密钥'; } else if (input.type === 'checkbox') input.checked = !!c[key]; else input.value = String(c[key] ?? ''); }
        }
        fields.provider.onchange = () => { const preset = A.presets[fields.provider.value]; fields.protocol.value = preset.protocol; fields.baseUrl.value = preset.baseUrl; fields.vision.checked = preset.vision; fields.model.value = ''; fields.key.value = ''; fields.key.placeholder = '请输入该服务商的密钥'; };
        const controls = document.createElement('div'); controls.className = 'ai-buttons';
        const save = document.createElement('button'); save.type = 'button'; save.textContent = '保存设置'; save.dataset.aiSave = 'true';
        save.onclick = () => {
            try {
                const c = Object.fromEntries(Object.entries(fields).map(([key,input]) => [key,input.type === 'checkbox' ? input.checked : input.value]));
                const old = A.load();
                if (!c.key && c.provider === old.provider && c.protocol === old.protocol && c.baseUrl.replace(/\/+$/,'') === old.baseUrl) c.key = old.key;
                const valid = A.normalize(c); onChange(); GM_setValue('xxt-ai-config', valid); populate(); message.textContent = '已保存。点击“测试 AI”验证（会消耗少量 API 用量）。';
            } catch (error) { message.textContent = error.message; }
        };
        const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = '清除密钥';
        clear.onclick = () => { onChange(); GM_setValue('xxt-ai-config',{ ...A.load(),key:'' }); populate(); message.textContent = '已清除当前密钥。'; };
        controls.append(save,clear); form.append(note,controls,message); section.append(heading,form); populate(); return section;
    }
    function decorate(panel, { title, actions, output, details, onQuietChange, playbackRate, onRateChange, onAiChange, muted, onMutedChange }) {
        const style = document.createElement('style'); style.textContent = css; document.head.append(style);
        panel.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;width:min(360px,calc(100vw - 36px));text-align:left';
        const make = (tag,cls) => { const el = document.createElement(tag); el.className = cls; return el; };
        const shell = make('div','xxt-shell'), header = make('header','xxt-head'), name = document.createElement('div');
        const version = make('div','xxt-version'); version.textContent = 'LEARNING ASSISTANT · 1.0.4'; name.append(title,version);
        const body = make('div','xxt-body'), fold = make('button','xxt-fold'); fold.textContent = '−'; fold.title = '收起面板';
        fold.onclick = () => { body.hidden = !body.hidden; fold.textContent = body.hidden ? '+' : '−'; fold.title = body.hidden ? '展开面板' : '收起面板'; };
        const status = make('div','xxt-state'); status.textContent = '学习流程 · 多模型接入';
        const settings = make('div','xxt-settings'), rateLabel = make('label','xxt-rate-setting'), rate = document.createElement('select'); rate.dataset.setting = 'playback-rate'; rate.setAttribute('aria-label','视频倍速');
        for (const value of XxtCodexCore.playbackRates) { const option = document.createElement('option'); option.value = value; option.textContent = value === 1 ? '1×（建议）' : `${value}×`; rate.append(option); }
        rate.value = playbackRate; rate.onchange = () => onRateChange(Number(rate.value)); rateLabel.append(document.createTextNode('视频倍速'),rate);
        const mutedInput = document.createElement('input'); mutedInput.type = 'checkbox'; mutedInput.dataset.setting = 'muted'; mutedInput.checked = muted;
        mutedInput.onchange = () => onMutedChange(mutedInput.checked);
        const mutedLabel = document.createElement('label'); mutedLabel.append(mutedInput,document.createTextNode('静音播放'));
        const quiet = document.createElement('input'); quiet.type = 'checkbox'; quiet.dataset.setting = 'quiet'; quiet.checked = GM_getValue('xxt-quiet-enabled',true);
        quiet.onchange = () => { GM_setValue('xxt-quiet-enabled',quiet.checked); onQuietChange(); };
        const quietLabel = document.createElement('label'); quietLabel.append(quiet,document.createTextNode('23:00—07:00 休息'));
        const duration = document.createElement('span'); duration.textContent = '文档 60 秒 · 专题每项 90 秒'; settings.append(rateLabel,mutedLabel,duration,quietLabel);
        const feedback = make('footer','xxt-feedback'), feedbackLinks = make('div','xxt-feedback-links');
        for (const [label,template] of [['Bug / 问题反馈','bug_report.yml'],['功能建议','feature_request.yml']]) {
            const link = document.createElement('a'); link.textContent = label;
            link.href = `https://github.com/Flyer2333/xuexitong-ai-assistant/issues/new?template=${template}`;
            link.target = '_blank'; link.rel = 'noopener noreferrer'; feedbackLinks.append(link);
        }
        const feedbackNote = document.createElement('div'); feedbackNote.textContent = '遇到 Bug 或有新功能想法？欢迎提交，作者会及时排查修复、评估并持续完善功能。';
        const privacyNote = document.createElement('div'); privacyNote.textContent = '提交前请遮挡 API Key、连接码及个人信息。不会自动上传页面或日志。';
        feedback.append(feedbackLinks,feedbackNote,privacyNote);
        actions.className = 'xxt-actions'; body.append(actions,status,output,aiSettings(onAiChange),settings,details,feedback); header.append(name,fold); shell.append(header,body); panel.replaceChildren(shell);
        let drag;
        header.onpointerdown = event => { if (event.button !== 0 || event.target.closest('button')) return; const r = panel.getBoundingClientRect(); drag = {x:event.clientX-r.left,y:event.clientY-r.top}; header.setPointerCapture(event.pointerId); event.preventDefault(); };
        header.onpointermove = event => { if (!drag) return; const r = panel.getBoundingClientRect(); panel.style.left = `${Math.max(8,Math.min(innerWidth-r.width-8,event.clientX-drag.x))}px`; panel.style.top = `${Math.max(8,Math.min(innerHeight-60,event.clientY-drag.y))}px`; panel.style.right = 'auto'; panel.style.bottom = 'auto'; };
        header.onpointerup = header.onpointercancel = () => { drag = null; };
        return status;
    }
    globalThis.XxtAssistantTheme = { decorate };
})();
