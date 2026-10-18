(() => {
    'use strict';
    const css = `
[data-xxt-codex-panel]{--ink:#1e293b;--accent:#4f46e5;--line:#e2e8f0;--surface:#f8fafc;--tint:#eef2ff;--muted:#64748b;--button:#4f46e5;--button-ink:#fff;color:var(--ink)!important;font:13px/1.6 system-ui,'Microsoft YaHei',sans-serif!important;color-scheme:light}
[data-xxt-codex-panel] *{box-sizing:border-box}
[data-xxt-codex-panel] .xxt-shell{border:1px solid var(--line);border-radius:18px;background:var(--surface);box-shadow:0 16px 50px #17255424;overflow:hidden}
[data-xxt-codex-panel] .xxt-head{display:flex;align-items:center;gap:10px;padding:18px;background:linear-gradient(120deg,var(--tint),var(--surface));border-bottom:1px solid var(--line);cursor:grab}
[data-xxt-codex-panel] .xxt-head:before{flex-shrink:0;content:'AI';display:grid;place-items:center;background:var(--button);color:#fff;font-weight:800;border-radius:12px;width:38px;height:38px;font-size:14px}
[data-xxt-codex-panel] strong{font-size:16px;letter-spacing:.3px}
[data-xxt-codex-panel] .xxt-version{color:var(--muted);font-size:10px;letter-spacing:1px}
[data-xxt-codex-panel] .xxt-fold{flex-shrink:0;margin-left:auto;border:0;background:#fff;color:var(--muted);border-radius:8px;width:28px;height:28px;cursor:pointer}
[data-xxt-codex-panel] .xxt-body{padding:16px;max-height:70vh;overflow:auto}
[data-xxt-codex-panel] .xxt-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
[data-xxt-codex-panel] button{font:inherit;cursor:pointer}
[data-xxt-codex-panel] .xxt-actions button{margin:0!important;padding:10px!important;border:1px solid #d9dfeb;border-radius:10px;background:#fff;color:#475569;font-weight:600}
[data-xxt-codex-panel] .xxt-actions button:hover{background:var(--tint);border-color:#a5b4fc}
[data-xxt-codex-panel] .xxt-actions [data-action=start]{background:var(--button);color:var(--button-ink);border-color:var(--button)}
[data-xxt-codex-panel] .xxt-actions [data-action=stop]{color:#be123c;background:#fff8fa;border-color:#f5d3dd}
[data-xxt-codex-panel] .xxt-state{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;margin-bottom:8px}
[data-xxt-codex-panel] .xxt-state:before{content:'';width:6px;height:6px;border-radius:50%;background:var(--accent)}
[data-xxt-codex-panel][data-sleeping=true] .xxt-state:before{background:#94a3b8}
[data-xxt-codex-panel] pre{font:inherit!important;margin:0!important;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px!important;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow:auto;color:#475569}
[data-xxt-codex-panel] .xxt-foreground-note{margin:10px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--tint);color:var(--ink);font-size:12px;line-height:1.7}
[data-xxt-codex-panel] .xxt-settings{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;color:var(--muted);font-size:11px}
[data-xxt-codex-panel] .xxt-rate-setting{display:flex;width:100%;justify-content:space-between;align-items:center}
[data-xxt-codex-panel] input,[data-xxt-codex-panel] select{font:inherit;color:#334155;background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:7px;min-width:0}
[data-xxt-codex-panel] input[type=checkbox]{accent-color:var(--accent);vertical-align:middle;margin:0 4px 0 0}
[data-xxt-codex-panel] details{border-top:1px solid var(--line);margin-top:12px;padding-top:10px;font-size:12px;color:var(--muted)}
[data-xxt-codex-panel] summary{cursor:pointer;font-weight:600;color:#475569}
[data-xxt-codex-panel] details img{max-width:100%;border-radius:8px;margin-top:8px}
[data-xxt-codex-panel] .ai-form{display:grid;gap:10px;margin-top:12px}
[data-xxt-codex-panel] .ai-form>label{display:grid;gap:4px;font-size:11px}
[data-xxt-codex-panel] .ai-form small{color:var(--muted);font-size:11px;line-height:1.6}
[data-xxt-codex-panel] .ai-form>.xxt-update-auto-label{display:flex;align-items:center;gap:5px}
[data-xxt-codex-panel] [data-xxt-updates] ul,[data-xxt-codex-panel] [data-xxt-updates] ol{padding-left:18px;margin:8px 0;font-size:12px}
[data-xxt-codex-panel] [data-xxt-updates] li+li{margin-top:6px}
[data-xxt-codex-panel] .xxt-update-dismiss{justify-self:start;border:1px solid var(--line);border-radius:8px;padding:6px 12px;background:#fff;color:var(--accent)}
[data-xxt-codex-panel] .ai-buttons{display:flex;gap:8px}
[data-xxt-codex-panel] .ai-buttons button{border:1px solid #c7d2fe;background:var(--tint);color:#4338ca;border-radius:8px;padding:8px 12px}
[data-xxt-codex-panel] .xxt-feedback{border-top:1px solid var(--line);margin-top:12px;padding-top:10px;color:var(--muted);font-size:11px;line-height:1.7}
[data-xxt-codex-panel] .xxt-feedback-links{display:flex;gap:14px;margin-bottom:4px}
[data-xxt-codex-panel] .xxt-feedback a{color:#4f46e5;text-decoration:none;font-weight:600}
[data-xxt-codex-panel] .xxt-feedback a:hover{text-decoration:underline}
[data-xxt-codex-panel][data-skin=nailoong]{--ink:#51371f;--accent:#92570d;--line:#eddbb7;--surface:#fffdf5;--tint:#fff1cc;--muted:#7c6a50;--button:#f3c350;--button-ink:#49300f}
[data-xxt-codex-panel][data-skin=naiwa]{--ink:#4e3d20;--accent:#8a600e;--line:#eadcb4;--surface:#fffef4;--tint:#fff5cf;--muted:#796b49;--button:#eac84b;--button-ink:#49370e}
[data-xxt-codex-panel] .xxt-head>div{min-width:0;flex:1}
[data-xxt-codex-panel] .xxt-head strong{font-size:17px;line-height:1.4}
[data-xxt-codex-panel] .xxt-head:before{color:var(--button-ink)}
[data-xxt-codex-panel] .xxt-fold{position:relative;z-index:4}
[data-xxt-codex-panel] .xxt-skin-picker{display:flex;align-items:center;gap:5px;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--line)}
[data-xxt-codex-panel] .xxt-skin-label{font-size:11px;color:var(--muted);margin-right:auto}
[data-xxt-codex-panel] .xxt-skin-picker button{font:inherit;font-size:11px;min-height:30px;padding:4px 12px;background:transparent;border:1px solid transparent;border-radius:999px;color:var(--muted)}
[data-xxt-codex-panel] .xxt-skin-picker button[aria-pressed=true]{color:var(--accent);background:#fff;border-color:var(--line);box-shadow:0 2px 5px #17255408;font-weight:700}
[data-xxt-codex-panel] button:focus-visible,[data-xxt-codex-panel] summary:focus-visible,[data-xxt-codex-panel] a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
[data-xxt-codex-panel] .xxt-theme-mascot{position:absolute;right:14px;top:-72px;width:120px;height:100px;overflow:hidden;pointer-events:none;z-index:2;filter:drop-shadow(0 5px 6px #54351b20)}
[data-xxt-codex-panel] .xxt-theme-mascot img{display:block;width:120px;height:auto;user-select:none;-webkit-user-drag:none}
[data-xxt-codex-panel][data-skin=naiwa] .xxt-theme-mascot{width:120px;height:112px;right:14px;top:-88px;overflow:visible}
[data-xxt-codex-panel][data-skin=naiwa] .xxt-theme-mascot img{width:120px;height:112px;object-fit:contain}
[data-xxt-codex-panel] .xxt-feedback details{border:0;margin:3px 0 0;padding:0;font-size:11px}
[data-xxt-codex-panel] .xxt-feedback summary{display:inline-block;color:#4f46e5;font-weight:600}
[data-xxt-codex-panel] .xxt-feedback summary:before{content:'▸';display:inline-block;margin-right:4px}
[data-xxt-codex-panel] .xxt-feedback details[open] summary:before{content:'▾'}
[data-xxt-codex-panel] .xxt-feedback-copy{margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--tint)}
[data-xxt-codex-panel] .xxt-feedback-copy>div+div{margin-top:6px}
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
        const modelPicker = document.createElement('select'); modelPicker.dataset.aiModelPicker = 'true';
        const modelLabel = document.createElement('label'); modelLabel.textContent = '模型'; modelLabel.append(modelPicker); form.append(modelLabel);
        field('model','手动填写模型 ID'); fields.model.autocomplete = 'off'; fields.model.spellcheck = false;
        const catalogNote = document.createElement('small'); catalogNote.dataset.aiCatalogNote = 'true'; form.append(catalogNote);
        field('key','API Key / 本地连接码'); fields.key.type = 'password'; fields.key.autocomplete = 'off';
        field('maxTokens','最大输出 token'); fields.maxTokens.type = 'number'; fields.maxTokens.min = '256'; fields.maxTokens.max = '32768';
        field('reasoning','推理设置（按当前模型适配）',[]);
        const reasoningNote = document.createElement('small'); reasoningNote.dataset.aiReasoningNote = 'true'; form.append(reasoningNote);
        function updateReasoning(preferred = fields.reasoning.value) {
            const c = {provider:fields.provider.value,protocol:fields.protocol.value,model:fields.model.value.trim()};
            const options = A.catalog.reasoningOptions(c); fields.reasoning.replaceChildren();
            for (const [value,text] of options) { const option = document.createElement('option'); option.value = value; option.textContent = text; fields.reasoning.append(option); }
            fields.reasoning.value = options.some(([value]) => value === preferred) ? preferred : '';
            fields.reasoning.disabled = options.length === 1;
            reasoningNote.textContent = c.protocol === 'codex' ? '由本地 Codex 服务配置。' : options.length === 1 ? '此模型或协议尚未核实可调参数，沿用服务商默认值，不额外发送推理参数。' : c.provider === 'custom' ? '自定义接口：请自行确认服务是否支持所选强度。' : '仅显示已核实的参数；默认不额外发送设置。更高强度可能增加耗时和 token 消耗。';
        }
        function updateModelPicker(value = '') {
            const provider = fields.provider.value, entry = A.catalog.providers[provider]; modelPicker.replaceChildren();
            const append = (value,text) => { const option = document.createElement('option'); option.value = value; option.textContent = text; modelPicker.append(option); };
            append('','请选择模型');
            for (const item of entry.models) append(item.id,item.id + (item.vision === true ? ' · 支持图片' : item.vision === false ? ' · 仅文字' : ''));
            append('__manual__','没有我要的模型，手动填写');
            modelPicker.value = value && !entry.models.some(item => item.id === value) ? '__manual__' : value;
            if (!entry.models.length && provider !== 'codex') modelPicker.value = '__manual__';
            modelLabel.hidden = provider === 'codex'; fields.model.closest('label').hidden = modelPicker.value !== '__manual__' || provider === 'codex';
            fields.model.value = value;
            catalogNote.textContent = (provider === 'custom' || provider === 'codex' ? '' : `目录核对：${A.catalog.verifiedAt}。仅列适用的对话模型，实际可用性以账号权限为准。`) + (entry.note || '');
        }
        modelPicker.onchange = () => {
            const manual = modelPicker.value === '__manual__'; fields.model.closest('label').hidden = !manual;
            if (!manual) fields.model.value = modelPicker.value;
            const item = A.catalog.model(fields.provider.value,fields.model.value);
            if (item?.vision !== null && item?.vision !== undefined) fields.vision.checked = item.vision;
            updateReasoning(''); if (manual) fields.model.focus();
        };
        fields.model.oninput = () => updateReasoning(); fields.protocol.onchange = () => updateReasoning('');
        for (const [key,label] of [['vision','发送题目截图（须选视觉模型）'],['jsonMode','发送 JSON 模式参数（须接口支持）']]) { field(key,label); fields[key].type = 'checkbox'; }
        const note = document.createElement('small'); note.textContent = 'API 按服务商用量计费。“测试 AI”会发送一条短请求。Key 保存在油猴存储，非加密保险箱；仅向你配置的 API 发送题目与截图。更换服务商或地址后必须重新输入 Key。';
        const message = document.createElement('small'); message.setAttribute('role','status');
        function populate() {
            const c = A.load();
            for (const [key,input] of Object.entries(fields)) { if (key === 'key') { input.value = ''; input.placeholder = c.key ? '已保存，留空保留（同一地址）' : '请输入你自己的密钥'; } else if (input.type === 'checkbox') input.checked = !!c[key]; else input.value = String(c[key] ?? ''); }
            updateModelPicker(c.model); updateReasoning(c.reasoning);
        }
        fields.provider.onchange = () => { const preset = A.presets[fields.provider.value]; fields.protocol.value = preset.protocol; fields.baseUrl.value = preset.baseUrl; fields.vision.checked = preset.vision; fields.key.value = ''; fields.key.placeholder = '请输入该服务商的密钥'; updateModelPicker(); updateReasoning(''); };
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
        const version = make('div','xxt-version'); version.textContent = 'LEARNING ASSISTANT · ' + XxtUpdates.release.version; name.append(title,version);
        const picker = make('div','xxt-skin-picker'); picker.setAttribute('role','group'); picker.setAttribute('aria-label','外观主题');
        const pickerLabel = make('span','xxt-skin-label'); pickerLabel.textContent = '外观'; picker.append(pickerLabel);
        const mascot = make('div','xxt-theme-mascot'); mascot.setAttribute('aria-hidden','true'); mascot.hidden = true;
        const mascotImage = document.createElement('img'); mascotImage.alt = ''; mascotImage.draggable = false; mascot.append(mascotImage);
        const skins = { default: ['默认','学习助手'], nailoong: ['奶龙','奶龙·学习助手'], naiwa: ['奶蛙','奶蛙·学习助手'] };
        function applySkin(value, persist = false) {
            const id = Object.hasOwn(skins,value) ? value : 'default'; panel.dataset.skin = id; title.textContent = skins[id][1];
            for (const button of picker.querySelectorAll('button')) button.setAttribute('aria-pressed',String(button.dataset.skinChoice === id));
            const image = id !== 'default' && typeof XxtThemeAssets !== 'undefined' && XxtThemeAssets[id];
            mascot.hidden = !image;
            if (image) mascotImage.src = image; else mascotImage.removeAttribute('src');
            if (persist) GM_setValue('xxt-ui-skin',id);
        }
        for (const [id,[label]] of Object.entries(skins)) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.skinChoice = id;
            button.onclick = () => applySkin(id,true); picker.append(button);
        }
        const body = make('div','xxt-body'), fold = make('button','xxt-fold'); fold.textContent = '−'; fold.title = '收起面板';
        fold.onclick = () => { body.hidden = !body.hidden; fold.textContent = body.hidden ? '+' : '−'; fold.title = body.hidden ? '展开面板' : '收起面板'; };
        const status = make('div','xxt-state'); status.textContent = '学习流程 · 多模型接入';
        const foregroundNote = make('p','xxt-foreground-note');
        foregroundNote.textContent = '建议将课程页保持在前台：选中课程标签，不最小化窗口，也不要让电脑休眠。后台运行可能使弹题处理或“继续学习”延迟。';
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
        const feedbackNote = document.createElement('div'); feedbackNote.textContent = '问题反馈请附脚本版本、复现步骤和面板提示；功能建议请说明具体使用场景，方便作者定位和改进。';
        const privacyNote = document.createElement('div'); privacyNote.textContent = '提交前请遮挡 API Key、连接码及个人信息。不会自动上传页面或日志。';
        const feedbackDetails = document.createElement('details'); feedbackDetails.dataset.feedbackDetails = 'true';
        const feedbackSummary = document.createElement('summary'); feedbackSummary.textContent = '反馈说明';
        const feedbackCopy = make('div','xxt-feedback-copy');
        const authorNote = document.createElement('div'); authorNote.textContent = '脚本根据作者自己的实际使用需求编写，并持续完善。遇到暂不支持的场景，或有希望增加的功能，欢迎及时反馈；作者会第一时间跟进，评估后补充相应设置和功能。';
        feedbackCopy.append(authorNote,feedbackNote,privacyNote); feedbackDetails.append(feedbackSummary,feedbackCopy);
        feedback.append(feedbackLinks,feedbackDetails);
        actions.className = 'xxt-actions'; body.append(actions,status,output,foregroundNote,aiSettings(onAiChange),settings,details,XxtUpdates.create(),feedback); header.append(name,fold); shell.append(header,picker,body); panel.replaceChildren(shell,mascot);
        applySkin(GM_getValue('xxt-ui-skin','default'));
        let drag;
        header.onpointerdown = event => { if (event.button !== 0 || event.target.closest('button')) return; const r = panel.getBoundingClientRect(); drag = {x:event.clientX-r.left,y:event.clientY-r.top}; header.setPointerCapture(event.pointerId); event.preventDefault(); };
        header.onpointermove = event => { if (!drag) return; const r = panel.getBoundingClientRect(); panel.style.left = `${Math.max(8,Math.min(innerWidth-r.width-8,event.clientX-drag.x))}px`; panel.style.top = `${Math.max(panel.dataset.skin === 'default' ? 8 : 78,Math.min(innerHeight-60,event.clientY-drag.y))}px`; panel.style.right = 'auto'; panel.style.bottom = 'auto'; };
        header.onpointerup = header.onpointercancel = () => { drag = null; };
        return status;
    }
    globalThis.XxtAssistantTheme = { decorate };
})();
