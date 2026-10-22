(() => {
    'use strict';
    const css = XxtGlassCss;
    const vault=()=>XxtProfiles.create(GM_getValue,GM_setValue);
    const profilesChanged=()=>document.dispatchEvent(new Event('xxt-profiles-changed'));
    function figure(id,index=1){
        const asset=typeof XxtPersonaAssets==='undefined'?null:XxtPersonaAssets[id];if(!asset)return null;
        const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');
        const [x,y,w,h]=asset.cells[index];svg.setAttribute('viewBox',`${x*asset.width} ${y*asset.height} ${w*asset.width} ${h*asset.height}`);svg.setAttribute('aria-hidden','true');
        const clip=document.createElementNS(ns,'clipPath'),rect=document.createElementNS(ns,'rect'),clipId='xxt-art-'+crypto.randomUUID();clip.setAttribute('id',clipId);clip.setAttribute('clipPathUnits','userSpaceOnUse');
        for(const [k,v]of Object.entries({x:x*asset.width,y:y*asset.height,width:w*asset.width,height:h*asset.height}))rect.setAttribute(k,v);clip.append(rect);
        image.setAttribute('width',asset.width);image.setAttribute('height',asset.height);image.setAttribute('href',asset.src);image.setAttribute('clip-path',`url(#${clipId})`);svg.append(clip,image);return svg;
    }
    function askImageUse(config,origin){
        if(XxtAi.catalog.model(config.provider,config.model)?.vision!==false)return Promise.resolve(true);
        return new Promise(resolve=>{
            const panel=origin.closest('[data-xxt-codex-panel]'),dialog=document.createElement('dialog');dialog.className='xxt-test-result';dialog.setAttribute('aria-label','确认图片用途');
            const h=document.createElement('h3'),p=document.createElement('p'),yes=document.createElement('button'),no=document.createElement('button');
            h.textContent='这个模型似乎不支持图片';p.textContent='可能无法识别图片题。仍要把它设为图片接口吗？你也可以先查看服务商的模型说明。';yes.textContent='仍用于图片';no.textContent='取消';no.autofocus=true;
            let accepted=false;yes.onclick=()=>{accepted=true;dialog.close();};no.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();origin.focus();resolve(accepted);},{once:true});dialog.append(h,p,no,yes);panel.append(dialog);dialog.showModal();
        });
    }
    function profileManager(onChange){
        const section=document.createElement('details'),heading=document.createElement('summary'),rows=document.createElement('div'),note=document.createElement('p'),link=document.createElement('a');
        section.dataset.savedProfiles='true';rows.className='xxt-profile-list';
        note.textContent='密钥仅保存在此浏览器的油猴存储中，调用时发送到你设置的接口。没有作者收集密钥的服务器；这不是加密保险箱。删除这里只移除本地配置，不撤销服务商密钥。';
        link.textContent='查看密钥与隐私说明';link.href='https://github.com/Flyer2333/xuexitong-ai-assistant/blob/main/docs/SECURITY.md';link.target='_blank';link.rel='noopener noreferrer';
        const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.dataset.purposeFeedback='true';
        function render(){
            const saved=vault().list();heading.textContent=`已保存接口 · ${saved.length}`;rows.replaceChildren();
            for(const p of saved){
                const item=document.createElement('article'),name=document.createElement('strong'),meta=document.createElement('small'),key=document.createElement('code'),dates=document.createElement('small'),buttons=document.createElement('div');
                item.className='xxt-profile';name.textContent=`${XxtAi.presets[p.config.provider]?.label||p.config.provider} · ${p.config.model||'Codex'}`;
                let host;try{host=new URL(p.config.baseUrl).host;}catch{host='地址无效';}
                meta.textContent=`${host} · ${p.config.protocol}`;key.textContent=XxtProfiles.mask(p.config.key);
                const date=value=>value?new Date(value).toLocaleString():'尚未成功调用';dates.textContent=`保存：${date(p.createdAt)} / 最近成功调用：${date(p.lastUsedAt)}`;buttons.className='ai-buttons';
                for(const [label,slot] of [['用于文字','xxt-ai-config'],['用于图片','xxt-ai-vision-config']]){
                    const kind=slot==='xxt-ai-config'?'text':'image',active=vault().selected(p.config,kind);
                    const b=document.createElement('button');b.type='button';b.textContent=label+(active?' ✓':'');b.dataset.purpose=kind;b.dataset.profileId=p.id;b.setAttribute('aria-pressed',String(active));
                    b.onclick=async()=>{const latest=vault().list().find(x=>x.id===p.id);if(!latest)return;const pressed=vault().selected(latest.config,kind);if(!pressed&&kind==='image'&&!await askImageUse(latest.config,b))return;onChange();vault().assign(latest.config,kind,!pressed);feedback.textContent=pressed?`已取消此接口的${kind==='text'?'文字':'图片'}用途。`:`已设为${kind==='text'?'文字':'图片'}接口：${latest.config.model}。请点击“测试 AI”验证。`;profilesChanged();section.querySelector(`[data-purpose="${kind}"][data-profile-id="${p.id}"]`)?.focus();};buttons.append(b);
                }
                const remove=document.createElement('button');remove.type='button';remove.textContent='删除配置';remove.onclick=()=>{onChange();vault().remove(p.id);profilesChanged();};buttons.append(remove);item.append(name,meta,key,dates);
                if(p.config.protocol==='codex'){
                    const localNote=document.createElement('small');localNote.dataset.localServiceNote='true';
                    localNote.textContent='请保持运行本地服务的 PowerShell 窗口开启；关闭后此接口暂不可用。重新启动原服务即可恢复；若地址或连接码已变，请更新并保存接口配置。';
                    item.append(localNote);
                }
                item.append(buttons);rows.append(item);
            }
            if(!saved.length)rows.textContent='暂无已保存接口。在接口设置中填写后点击“保存设置”，即可在这里切换或删除。';
        }
        try{vault().migrate();}catch{}
        section.append(heading,feedback,rows,note,link);section.addEventListener('toggle',()=>{if(section.open)render();});document.addEventListener('xxt-profiles-changed',render);render();return section;
    }
    function testResult(button,result){
        const panel=button.closest('[data-xxt-codex-panel]'),dialog=document.createElement('dialog');dialog.className='xxt-test-result';
        const success=result.success;dialog.dataset.imageTestResult=success?'success':'failure';dialog.setAttribute('aria-label','接口测试结果');
        const title=document.createElement('h3'),close=document.createElement('button'),cast=document.createElement('div'),dismiss=document.createElement('button');cast.className='xxt-result-cast';title.textContent=success?'连接成功，可以开始了！':'本次测试有未通过的接口';dismiss.className='xxt-result-dismiss';dismiss.textContent='×';dismiss.setAttribute('aria-label','关闭测试结果');dismiss.onclick=()=>dialog.close();dialog.append(dismiss,title,cast);
        for(const r of result.results){
            const row=document.createElement('section'),art=document.createElement('div'),info=document.createElement('div'),label=document.createElement('strong'),description=document.createElement('p');row.className='xxt-result-row';row.dataset.testRole=r.role;row.dataset.result=r.success?'success':'failure';art.className='xxt-result-art';
            const character=figure(r.character,r.success?2:3);if(character)art.append(character);else art.textContent=r.success?'✓':'!';
            label.textContent=`${r.role} · ${XxtPersonas.names[r.character]||r.provider} · ${r.success?'测试通过':'未通过'}`;
            const model=document.createElement('small');model.textContent=[r.model,r.reasoningEffort].filter(Boolean).join(' · ');
            description.textContent=r.success?(r.role==='图片'?'已正确识别本次测试图。':'已收到有效的模型回复。'):`${r.title}。${r.reason}`;
            if(!r.success&&!r.certain){const possible=document.createElement('small');possible.textContent='以上为可能原因，尚未确定唯一原因。';info.append(possible);}
            info.prepend(label,model,description);row.append(art,info);cast.append(row);
        }
        close.type='button';close.textContent='知道了';close.autofocus=true;close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();button.focus();},{once:true});dialog.append(close);panel.append(dialog);dialog.showModal();
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches){dialog.animate([{opacity:0},{opacity:1}],{duration:200,easing:'cubic-bezier(0.23,1,0.32,1)'});for(const art of dialog.querySelectorAll('.xxt-result-art'))art.animate(art.closest('[data-result]').dataset.result==='success'?[{opacity:0,transform:'translateY(12px) scale(.92) rotate(-3deg)'},{opacity:1,transform:'translateY(-4px) scale(1.02) rotate(2deg)'},{opacity:1,transform:'translateY(0) scale(1) rotate(0)'}]:[{opacity:0,transform:'translateY(8px) scale(.95)'},{opacity:1,transform:'translateX(-4px) scale(1)'},{opacity:1,transform:'translateX(4px) scale(1)'},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:280,easing:'cubic-bezier(0.23,1,0.32,1)'});}
    }
    function aiSettings(onChange, storageKey = 'xxt-ai-config') {
        const visionSlot = storageKey !== 'xxt-ai-config';
        const A = XxtAi, section = document.createElement('details'); section.dataset[visionSlot ? 'visionSettings' : 'aiSettings'] = 'true';
        const heading = document.createElement('summary'); heading.textContent = '添加 / 编辑接口';
        const form = document.createElement('div'); form.className = 'ai-form';
        const fields = {};
        function field(key, label, options) {
            const wrapper = document.createElement('label'); wrapper.textContent = label;
            const input = document.createElement(options ? 'select' : 'input'); input.dataset[visionSlot ? 'visionField' : 'aiField'] = key;
            if (options) for (const [value, text] of options) { const option = document.createElement('option'); option.value = value; option.textContent = text; input.append(option); }
            wrapper.append(input); form.append(wrapper); fields[key] = input; return input;
        }
        field('provider','服务商',Object.entries(A.presets).map(([key,value]) => [key,value.label]));
        field('protocol','接口协议',[['chat','OpenAI Chat Completions'],['responses','OpenAI Responses'],['anthropic','Claude Messages'],['gemini','Gemini generateContent'],['codex','本地 Codex']]);
        field('baseUrl','Base URL（不带具体接口路径）');
        const modelPicker = document.createElement('select'); modelPicker.dataset[visionSlot ? 'visionModelPicker' : 'aiModelPicker'] = 'true';
        const modelLabel = document.createElement('label'); modelLabel.textContent = '模型'; modelLabel.append(modelPicker); form.append(modelLabel);
        field('model','手动填写模型 ID'); fields.model.autocomplete = 'off'; fields.model.spellcheck = false;
        const catalogNote = document.createElement('small'); catalogNote.dataset.aiCatalogNote = 'true'; form.append(catalogNote);
        field('key','API Key / 本地连接码'); fields.key.type = 'password'; fields.key.autocomplete = 'off';
        const keyHelp=document.createElement('small');keyHelp.dataset.aiKeyHelp='true';fields.key.closest('label').after(keyHelp);
        function updateKeyHelp(){
            const local=fields.protocol.value==='codex';fields.key.placeholder=local?'请输入本地服务生成的连接码':'请输入该服务商的 API Key';keyHelp.replaceChildren();keyHelp.hidden=!local;if(!local)return;
            const download=document.createElement('a');download.textContent='① 下载本地服务 ZIP';download.href='https://github.com/Flyer2333/xuexitong-ai-assistant/archive/refs/heads/main.zip';download.target='_blank';download.rel='noopener noreferrer';
            const guide=document.createElement('a');guide.textContent='查看完整安装教程';guide.href='https://github.com/Flyer2333/xuexitong-ai-assistant/blob/main/docs/INSTALL.md#本地-codex-连接';guide.target='_blank';guide.rel='noopener noreferrer';
            keyHelp.append(download,document.createElement('br'),'② 解压后进入含 package.json 的文件夹，在地址栏输入 powershell 打开终端。',document.createElement('br'),'③ 运行 npm run start:codex，用 ↑↓ 和回车选择模型、推理强度，服务随后自动启动。',document.createElement('br'),'④ 打开 src/local/bridge-token.txt，复制完整连接码填到这里。',document.createElement('br'),'请保持服务窗口开启；关闭后重新启动原服务。地址或连接码变化时需更新配置，无需另填 OpenAI API Key。 ',guide);
        }
        field('maxTokens','最大输出 token'); fields.maxTokens.type = 'number'; fields.maxTokens.min = '256'; fields.maxTokens.max = '32768';
        field('reasoning','推理设置（按当前模型适配）',[]);
        const reasoningNote = document.createElement('small'); reasoningNote.dataset.aiReasoningNote = 'true'; form.append(reasoningNote);
        function updateReasoning(preferred = fields.reasoning.value) {
            updateKeyHelp();
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
        fields.model.oninput = () => updateReasoning(); fields.protocol.onchange = () => {updateReasoning('');updateKeyHelp();};
        for (const [key,label] of [['vision','图片能力'],['jsonMode','发送 JSON 模式参数（须接口支持）']]) { field(key,label); fields[key].type = 'checkbox'; }
        fields.vision.closest('label').hidden=true;
        field('purpose','这个接口用于',[['text','文字题'],['image','图片题'],['both','文字题＋图片题'],['none','仅保存，暂不使用']]);
        const note = document.createElement('small'); note.textContent = 'API 按服务商用量计费。“测试 AI”会按所选用途发送文字或图片测试请求。Key 保存在油猴存储，非加密保险箱；仅向你配置的 API 发送题目与截图。更换服务商或地址后必须重新输入 Key。';
        const message = document.createElement('small'); message.setAttribute('role','status');
        let editingConfig;
        function populate(preferred) {
            const c = preferred?.provider ? preferred : A.load(storageKey);editingConfig=c;
            for (const [key,input] of Object.entries(fields)) { if (key === 'key') { input.value = ''; input.placeholder = c.key ? '已保存，留空保留（同一地址）' : '请输入你自己的密钥'; } else if (input.type === 'checkbox') input.checked = !!c[key]; else input.value = String(c[key] ?? ''); }
            updateModelPicker(c.model); updateReasoning(c.reasoning);
            const text=vault().selected(c,'text'),image=vault().selected(c,'image');fields.purpose.value=text&&image?'both':image?'image':text?'text':'text';
        }
        fields.provider.onchange = () => { const preset = A.presets[fields.provider.value]; fields.protocol.value = preset.protocol; fields.baseUrl.value = preset.baseUrl; fields.vision.checked = preset.vision; fields.key.value = ''; fields.key.placeholder = '请输入该服务商的密钥'; updateModelPicker(); updateReasoning(''); };
        const controls = document.createElement('div'); controls.className = 'ai-buttons';
        const save = document.createElement('button'); save.type = 'button'; save.textContent = '保存设置'; save.dataset[visionSlot ? 'visionSave' : 'aiSave'] = 'true';
        save.onclick = async () => {
            try {
                const c = Object.fromEntries(Object.entries(fields).map(([key,input]) => [key,input.type === 'checkbox' ? input.checked : input.value]));
                const old = editingConfig || A.load(storageKey);
                if (!c.key && c.provider === old.provider && c.protocol === old.protocol && c.baseUrl.replace(/\/+$/,'') === old.baseUrl) c.key = old.key;
                const valid = A.normalize(c),purpose=fields.purpose.value;
                if(['image','both'].includes(purpose)&&!await askImageUse(valid,save))return;
                onChange();vault().save(valid);
                vault().assign(valid,'text',['text','both'].includes(purpose));vault().assign(valid,'image',['image','both'].includes(purpose));
                profilesChanged();populate(valid);fields.purpose.value=purpose;message.textContent=`已保存${purpose==='both'?'，用于文字题和图片题':purpose==='text'?'，用于文字题':purpose==='image'?'，用于图片题':'，暂不使用'}。请点击“测试 AI”验证。`;
            } catch (error) { message.textContent = error.message; }
        };
        const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = '清除密钥';
        clear.onclick = () => { onChange(); vault().clear(editingConfig || A.load(storageKey)); profilesChanged(); populate(); message.textContent = '已移除当前本地密钥及对应已保存配置；服务商密钥未撤销。'; };
        const imageTest=document.createElement('button');imageTest.type='button';imageTest.dataset.action='test-images';imageTest.textContent='测试图片识别（可能计费）';
        imageTest.onclick=async()=>{onChange();if(GM_getValue('xxt-quiet-enabled',true)&&globalThis.XxtCodexCore.quietHoursAt()){message.textContent='夜间休息中，07:00 后可测试图片识别';return;}const config=A.imageConfig();if(!config){message.textContent='请先把一个已保存接口设为“用于图片”。';return;}const job=A.testImages(config);imageTest.disabled=true;message.textContent='正在测试随机数字图片…';try{const result=await job.promise;message.textContent=result.message;testResult(imageTest,{success:result.verified,results:[{role:'图片',provider:config.provider,model:result.model||config.model,reasoningEffort:result.reasoningEffort,character:XxtPersonas.character(config),success:result.verified,...(!result.verified?XxtPersonas.explain({code:'IMAGE_MISMATCH'}):{})}]});}catch(error){message.textContent=/停止|取消|夜间/.test(error.message)?error.message:XxtPersonas.explain(error).title;if(!/停止|取消|夜间/.test(error.message))testResult(imageTest,{success:false,results:[{role:'图片',provider:config.provider,model:config.model,character:XxtPersonas.character(config),success:false,...XxtPersonas.explain(error)}]});}finally{imageTest.disabled=false;}};
        form.addEventListener('input',()=>A.cancelImageTest());
        form.addEventListener('change',()=>A.cancelImageTest());
        controls.append(imageTest);
        controls.append(save,clear); form.append(note,controls,message); section.append(heading,form); document.addEventListener('xxt-profiles-changed',populate); populate(); return section;
    }
    function decorate(panel, { title, actions, output, details, runLog, onQuietChange, playbackRate, onRateChange, onAiChange, muted, onMutedChange }) {
        try{vault().migrate();}catch{}
        globalThis.XxtPersonaHealth=XxtPersonas.create(GM_getValue,GM_setValue);
        const style = document.createElement('style'); style.textContent = css; document.head.append(style);
        panel.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;width:min(360px,calc(100vw - 36px));text-align:left';
        const make = (tag,cls) => { const el = document.createElement(tag); el.className = cls; return el; };
        const shell = make('div','xxt-shell'), header = make('header','xxt-head'), name = document.createElement('div');
        const brand=make('div','xxt-brand');brand.dataset.modelBrand='true';brand.setAttribute('aria-label','当前模型');header.append(brand);
        const version = make('div','xxt-version'); version.textContent = 'LEARNING ASSISTANT · ' + XxtUpdates.release.version; name.append(title,version);
        const picker = make('div','xxt-skin-picker'); picker.setAttribute('role','group'); picker.setAttribute('aria-label','外观主题');
        const pickerLabel = make('span','xxt-skin-label'); pickerLabel.textContent = '外观'; picker.append(pickerLabel);
        const mascot = make('div','xxt-theme-mascot'); mascot.setAttribute('aria-hidden','true'); mascot.hidden = true;
        const mascotImage = document.createElement('img'); mascotImage.alt = ''; mascotImage.draggable = false; mascot.append(mascotImage);
        const scene=make('div','xxt-scene-art');scene.setAttribute('aria-hidden','true');
        const switcher=document.createElement('button'),switchThumb=make('span','xxt-switch-thumb'),switchLabel=document.createElement('span');switcher.className='xxt-theme-switch';switcher.type='button';switcher.dataset.skinChoice='default';switcher.setAttribute('role','switch');switcher.setAttribute('aria-label','默认 / AI 模型主题');switcher.append(switchThumb,switchLabel);picker.append(switcher);
        const themeFeedback=make('small','xxt-theme-feedback');themeFeedback.setAttribute('role','status');
        const skins={nailoong:['奶龙','奶龙·学习助手'],naiwa:['奶蛙','奶蛙·学习助手']};
        let preference=GM_getValue('xxt-ui-preference',GM_getValue('xxt-ui-skin','default')==='default'?'auto':GM_getValue('xxt-ui-skin','default')),painted='';
        function applySkin(){
            const config=XxtAi.load(),id=XxtPersonas.character(config),available=!!id&&Object.hasOwn(XxtPersonaAssets,id)&&XxtPersonaHealth.tick()&&GM_getValue('xxt-ai-enabled',!!config.key);
            const skin=Object.hasOwn(skins,preference)?preference:preference==='auto'&&available?'ai-'+id:'default';
            panel.dataset.skin=skin;panel.dataset.character=skin.startsWith('ai-')?id:'';
            switcher.setAttribute('aria-checked',String(skin.startsWith('ai-')));switcher.dataset.selected=String(!Object.hasOwn(skins,preference));switchThumb.textContent=id?({deepseek:'鲸',openai:'GPT',claude:'C',gemini:'✦',zhipu:'Z',kimi:'K',qwen:'Q',doubao:'豆',xiaomi:'mi'}[id]):'AI';switchLabel.textContent=skin.startsWith('ai-')?`${XxtPersonas.names[id]} 主题`:'默认';
            switcher.title=available?'切换默认 / 已连接 AI 主题':'文字接口测试通过后自动切换到对应 AI 主题';
            const modelName=skin.startsWith('ai-')&&config.key?(XxtPersonas.names[id]||config.model||'Codex'):'';
            title.textContent=modelName?`${modelName}·学习助手`:skins[skin]?.[1]||'学习助手';
            brand.replaceChildren();const icon=id&&config.key&&XxtModelIcons[id];
            if(icon&&skin.startsWith('ai-')){const img=document.createElement('img');img.src=icon;img.alt=modelName+' 图标';brand.append(img);}else brand.textContent='AI';
            if(icon){const thumb=document.createElement('img');thumb.src=icon;thumb.alt='';thumb.dataset.icon=id;switchThumb.replaceChildren(thumb);}
            for(const b of picker.querySelectorAll('[data-skin-choice]:not([role=switch])'))b.setAttribute('aria-pressed',String(b.dataset.skinChoice===skin));
            themeFeedback.textContent=skin.startsWith('ai-')?'文字接口最近连接成功 · 偶发断连保留主题':preference==='auto'&&!available&&config.key?'测试文字接口后解锁对应 AI 主题':'';
            if(painted===skin)return;painted=skin;scene.replaceChildren();mascot.replaceChildren();
            if(skin.startsWith('ai-')){const background=figure(id,0);background.setAttribute('preserveAspectRatio','xMidYMin meet');scene.append(background);mascot.append(figure(id,1));mascot.hidden=false;}
            else if(skins[skin]){mascotImage.src=XxtThemeAssets[skin];mascot.append(mascotImage);mascot.hidden=false;}
            else mascot.hidden=true;
        }
        const persist=()=>{GM_setValue('xxt-ui-preference',preference);GM_setValue('xxt-ui-skin',Object.hasOwn(skins,preference)?preference:'default');applySkin();};
        document.addEventListener('xxt-ai-test-passed',()=>{if(XxtPersonas.character(XxtAi.load())&&XxtPersonaHealth.active()){preference='auto';persist();}});
        switcher.onclick=()=>{preference=Object.hasOwn(skins,preference)?'default':preference==='auto'?'default':'auto';persist();};
        for(const [id,[label]]of Object.entries(skins)){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.skinChoice=id;b.onclick=()=>{preference=preference===id?'default':id;persist();};picker.append(b);}
        document.addEventListener('xxt-connection-changed',applySkin);document.addEventListener('xxt-profiles-changed',applySkin);const themeTimer=setInterval(applySkin,5000);window.addEventListener('pagehide',()=>clearInterval(themeTimer),{once:true});
        const body = make('div','xxt-body'), fold = make('button','xxt-fold'); fold.textContent = '−'; fold.title = '收起面板';
        fold.onclick = () => { body.hidden = !body.hidden; fold.textContent = body.hidden ? '+' : '−'; fold.title = body.hidden ? '展开面板' : '收起面板'; };
        const status = make('div','xxt-state'); status.textContent = '学习流程 · 多模型接入';
        const statusCard=make('section','xxt-status-card');statusCard.dataset.status='idle';statusCard.setAttribute('aria-label','运行状态');
        const statusTop=make('div','xxt-status-top'),symbol=make('span','xxt-status-symbol'),statusTitle=document.createElement('span'),badge=make('span','xxt-status-badge');
        symbol.setAttribute('aria-hidden','true');statusTitle.textContent='运行状态';badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');statusTop.append(symbol,statusTitle,badge);
        output.tabIndex=0;output.setAttribute('aria-label','当前运行状态详情');
        const apiWarning=make('aside','xxt-api-warning');apiWarning.dataset.apiWarning='true';apiWarning.hidden=true;
        const warningTitle=document.createElement('strong'),warningText=document.createElement('p'),warningTime=document.createElement('time');
        warningTitle.textContent='!  AI 调用未成功';warningTitle.setAttribute('role','status');warningTitle.setAttribute('aria-live','polite');warningTime.dataset.warningCountdown='true';apiWarning.append(warningTitle,warningText,warningTime);
        statusCard.append(statusTop,output,apiWarning);
        let lastStatus,warningUntil=0,warningTimer;
        const updateStatus=()=>{
            const text=output.textContent;if(text===lastStatus)return;lastStatus=text;
            let state='notice',label='请查看提示',icon='i';
            if(/^夜间休息|^已预约/.test(text)){state='rest';label='夜间休息';icon='☾';}
            else if(/^AI 配置已更改|^运行模式已保存/.test(text)){state='notice';label='设置已更改';icon='↻';}
            else if(/已暂停|已停止|^自动操作已停止/.test(text)){state='paused';label='已暂停';icon='Ⅱ';}
            else if(/^AI 连接测试通过|^随机数字图片识别通过/.test(text)){state='success';label='测试通过';icon='✓';}
            else if(/^第\s*\d+\s*题/.test(text)){state='notice';label='答案已返回';icon='≡';}
            else if(/^(?:API |AI 连接失败|无法|未能|未找到|题目.*(?:无效|变化)|模型.*(?:无效|没有|未返回))/.test(text)){state='error';label='需要处理';icon='!';}
            else if(/^正在|^检测到|^已读取|^已进入|^已提交|^已点击|^AI 正在|^已记录待复核/.test(text)){state='running';label='正在处理';icon='›';}
            else if(/^选择|^先连接|^不接入 AI 模式无需/.test(text)){state='idle';label='等待开始';icon='◇';}
            statusCard.dataset.status=state;badge.textContent=label;symbol.textContent=icon;
        };
        const statusObserver=new MutationObserver(updateStatus);statusObserver.observe(output,{subtree:true,childList:true,characterData:true});updateStatus();
        const updateWarning=()=>{const seconds=Math.ceil((warningUntil-Date.now())/1000);apiWarning.hidden=seconds<=0;if(seconds<=0){clearInterval(warningTimer);warningTimer=null;return;}warningTime.textContent=`（${seconds}s 后自动关闭）`;};
        status.showApiFailure=(until,wasAutomatic)=>{if(until<=Date.now())return;warningUntil=until;warningText.textContent=wasAutomatic?
            '本次未能取得可用的 AI 答案，请检查接口、模型和余额后重试。脚本仍会按原设置重试或记录跳过题目，继续其余可处理任务；跳过不代表完成。':
            '本次 AI 调用未成功，请检查接口地址、模型、密钥和余额后重试。';updateWarning();if(!warningTimer)warningTimer=setInterval(updateWarning,1000);};
        document.addEventListener('visibilitychange',updateWarning);
        window.addEventListener('pagehide',()=>{statusObserver.disconnect();clearInterval(warningTimer);document.removeEventListener('visibilitychange',updateWarning);},{once:true});
        const foregroundNote = make('p','xxt-foreground-note');
        foregroundNote.textContent = '建议将课程页保持在前台：选中课程标签，不最小化窗口，也不要让电脑休眠。后台运行可能使弹题处理或“继续学习”延迟。';
        const modeLabel = document.createElement('label'), mode = document.createElement('select');
        mode.dataset.setting = 'ai-mode'; mode.setAttribute('aria-label', '运行模式');
        for (const [value,label] of [['off','不接入 AI'],['on','接入 AI（自动答题）']]) {
            const option = document.createElement('option'); option.value = value; option.textContent = label; mode.append(option);
        }
        mode.value = GM_getValue('xxt-ai-enabled', !!GM_getValue('xxt-ai-config', {})?.key) ? 'on' : 'off';
        const modeNote = document.createElement('p'); modeNote.className = 'xxt-foreground-note';
        const aiForm = aiSettings(onAiChange);
        const routingNote=document.createElement('p');routingNote.className='xxt-route-note';routingNote.textContent='文字题交给文字接口，图片题交给图片接口。没有图片接口时跳过图片题，继续其余任务。';
        const selectedSummary=make('div','xxt-selected-summary');selectedSummary.dataset.selectedSummary='true';selectedSummary.setAttribute('aria-live','polite');
        const renderSelected=()=>{selectedSummary.replaceChildren();for(const kind of ['text','image']){const c=kind==='text'?XxtAi.load():XxtAi.imageConfig();const line=document.createElement('p');line.textContent=`${kind==='text'?'文字':'图片'}接口：${c?.key?`${c.model||'Codex'}${(kind==='text'?XxtPersonaHealth.active():GM_getValue('xxt-image-connection',{}).fingerprint===XxtPersonas.fingerprint(c)&&Date.now()-GM_getValue('xxt-image-connection',{}).at<86400000)?' · 最近连接成功':' · 请测试确认'}`:'未选择'}`;selectedSummary.append(line);}};
        document.addEventListener('xxt-profiles-changed',renderSelected);document.addEventListener('xxt-connection-changed',renderSelected);renderSelected();
        const updateMode = () => {
            const enabled = mode.value === 'on';
            status.textContent = enabled ? '学习流程 · 多模型接入' : '学习流程 · 不接入 AI';
            routingNote.hidden=selectedSummary.hidden=!enabled; aiForm.hidden = !enabled;applySkin();
            for (const action of ['connect','solve']) actions.querySelector(`[data-action="${action}"]`).disabled = !enabled;
            modeNote.textContent = enabled ? '使用自己的模型接口作答，测试与答题可能产生 API 费用。' : '无需 Key，直接开始。处理音视频、文献和专题；题目记录后跳过，视频弹题可能导致当前视频未完成。';
        };
        mode.onchange = () => { onAiChange(); GM_setValue('xxt-ai-enabled', mode.value === 'on'); updateMode(); output.textContent = '运行模式已保存，点击“开始自动”继续。'; };
        modeLabel.append(document.createTextNode('运行模式 '),mode); document.addEventListener('xxt-profiles-changed',updateMode); updateMode();
        const settings = make('div','xxt-settings'), rateLabel = make('label','xxt-rate-setting'), rate = document.createElement('select'); rate.dataset.setting = 'playback-rate'; rate.setAttribute('aria-label','音视频倍速');
        for (const value of XxtCodexCore.playbackRates) { const option = document.createElement('option'); option.value = value; option.textContent = value === 1 ? '1×（建议）' : `${value}×`; rate.append(option); }
        rate.value = playbackRate; rate.onchange = () => onRateChange(Number(rate.value)); rateLabel.append(document.createTextNode('音视频倍速'),rate);
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
        const support=document.createElement('a');support.textContent='♥ 支持作者';support.href='https://github.com/Flyer2333/xuexitong-ai-assistant/blob/main/docs/SUPPORT.md';support.target='_blank';support.rel='noopener noreferrer';feedbackLinks.append(support);
        actions.className = 'xxt-actions'; body.append(actions,status,statusCard,foregroundNote,modeLabel,modeNote,selectedSummary,routingNote,aiForm,profileManager(onAiChange),settings,details,...(runLog ? [runLog] : []),XxtUpdates.create({bannerHost:shell}),feedback); header.append(name); shell.append(scene,header,picker,themeFeedback,body); panel.replaceChildren(shell,mascot,fold);
        const scenePosition=new ResizeObserver(()=>{shell.style.setProperty('--xxt-scene-top',body.offsetTop+'px');fold.style.top=(header.offsetTop+18)+'px';});scenePosition.observe(body);window.addEventListener('pagehide',()=>scenePosition.disconnect(),{once:true});
        applySkin();
        let drag;
        header.onpointerdown = event => { if (event.button !== 0 || event.target.closest('button')) return; const r = panel.getBoundingClientRect(); drag = {x:event.clientX-r.left,y:event.clientY-r.top}; header.setPointerCapture(event.pointerId); event.preventDefault(); };
        header.onpointermove = event => { if (!drag) return; const r = panel.getBoundingClientRect(); panel.style.left = `${Math.max(8,Math.min(innerWidth-r.width-8,event.clientX-drag.x))}px`; panel.style.top = `${Math.max(panel.dataset.character ? 96 : panel.dataset.skin === 'default' ? 8 : 78,Math.min(innerHeight-60,event.clientY-drag.y))}px`; panel.style.right = 'auto'; panel.style.bottom = 'auto'; };
        header.onpointerup = header.onpointercancel = () => { drag = null; };
        return status;
    }
    globalThis.XxtAssistantTheme = { decorate,testResult,figure };
})();

