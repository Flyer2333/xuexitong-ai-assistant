import {spawn} from 'node:child_process';
import {emitKeypressEvents} from 'node:readline';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';

export class MenuCancelled extends Error {
    constructor() { super('已取消启动，本地服务未启动。'); this.name='MenuCancelled'; }
}
const clean=value=>String(value||'').replace(/[\x00-\x1f\x7f-\x9f]/g,'').slice(0,180);
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,199}$/.test(value);

export function normalizeModels(rows) {
    const seen=new Set();
    return rows.filter(x=>x&&!x.hidden&&validId(x.model)).flatMap(x=>{
        if(seen.has(x.model)) return []; seen.add(x.model);
        const efforts=[...new Set((Array.isArray(x.supportedReasoningEfforts)?x.supportedReasoningEfforts:[]).map(e=>e?.reasoningEffort).filter(e=>typeof e==='string'&&/^[a-z][a-z0-9_-]{0,31}$/.test(e)))];
        return [{model:x.model,label:clean(x.displayName||x.model),efforts,defaultEffort:efforts.includes(x.defaultReasoningEffort)?x.defaultReasoningEffort:'',isDefault:!!x.isDefault,
            vision:!Array.isArray(x.inputModalities)||x.inputModalities.includes('image')}];
    });
}

// Only initialization and model/list are sent. No thread or inference is started.
export function discoverModels({binary=process.env.XXT_CODEX_BIN||'codex',spawnProcess=spawn,timeoutMs=20000,signal}={}) {
    return new Promise((resolve,reject)=>{
        if(signal?.aborted) return reject(new MenuCancelled());
        const child=spawnProcess(binary,['app-server','--listen','stdio://','-c','model_provider="openai"'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
        let buffer='',bytes=0,finished=false,id=0,pages=0;
        const rows=[],cursors=new Set();
        const finish=(error,value)=>{
            if(finished) return; finished=true;
            clearTimeout(timer);signal?.removeEventListener('abort',cancel);
            child.stdin.end();child.kill();
            if(error) reject(error); else resolve(value);
        };
        const cancel=()=>finish(new MenuCancelled());
        const timer=setTimeout(()=>finish(new Error('读取模型列表超时。请检查 Codex CLI 的登录和网络，然后重新启动。')),timeoutMs);
        signal?.addEventListener('abort',cancel,{once:true});
        const send=data=>{if(!finished) child.stdin.write(JSON.stringify(data)+'\n');};
        const next=cursor=>{
            if(++pages>10) return finish(new Error('模型目录分页异常，已停止读取。'));
            send({method:'model/list',id:++id,params:{limit:100,includeHidden:false,...(cursor?{cursor}:{})}});
        };
        child.stderr.resume();
        child.on('error',error=>finish(new Error(error.code==='ENOENT'?'找不到 Codex CLI。请先安装命令行版，或通过 XXT_CODEX_BIN 指定原生可执行文件。':'无法启动 Codex CLI。Windows 请使用原生 .exe，详情见安装指南。')));
        child.stdin.on('error',()=>finish(new Error('Codex CLI 已断开，请检查 CLI 版本后重试。')));
        child.on('close',()=>finish(new Error('Codex CLI 在返回模型列表前退出，请检查版本和登录状态。')));
        child.stdout.setEncoding('utf8');
        child.stdout.on('data',chunk=>{
            if(finished) return;
            bytes+=Buffer.byteLength(chunk);
            if(bytes>2*1024*1024) return finish(new Error('模型目录过大，已停止读取。'));
            buffer+=chunk.toString();let index;
            while(!finished&&(index=buffer.indexOf('\n'))!==-1){
                const line=buffer.slice(0,index);buffer=buffer.slice(index+1);
                let message;try{message=JSON.parse(line);}catch{continue;}
                if(message.id!==id) continue;
                if(message.error) return finish(new Error('Codex CLI 无法提供模型列表，请更新 CLI 并检查登录状态。'));
                if(id===0){send({method:'initialized',params:{}});next();continue;}
                if(!Array.isArray(message.result?.data)) return finish(new Error('Codex 模型目录格式无效，请更新 CLI 后重试。'));
                rows.push(...message.result.data);
                const cursor=message.result.nextCursor;
                if(cursor){
                    if(typeof cursor!=='string'||cursors.has(cursor)) return finish(new Error('模型目录分页重复，已停止读取。'));
                    cursors.add(cursor);next(cursor);
                }else{
                    const models=normalizeModels(rows);
                    finish(models.length?null:new Error('Codex 没有返回可选模型，请检查 CLI 登录与版本。'),models);
                }
            }
        });
        send({method:'initialize',id:0,params:{clientInfo:{name:'xxt_local_model_picker',version:'1.0.0'}}});
    });
}

export function selectMenu(title,choices,{input=process.stdin,output=process.stdout,initial=0,signal}={}) {
    if(!input.isTTY||!output.isTTY||typeof input.setRawMode!=='function') return Promise.reject(new Error('模型菜单需要交互终端。请在 PowerShell 窗口运行；无人值守启动可用 npm run start:codex:direct。'));
    if(!choices.length) return Promise.reject(new Error('没有可供选择的项目。'));
    if(signal?.aborted) return Promise.reject(new MenuCancelled());
    return new Promise((resolve,reject)=>{
        let selected=Math.max(0,Math.min(initial,choices.length-1)),lines=0,done=false;
        const wasRaw=!!input.isRaw,wasPaused=input.isPaused(),wasFlowing=input.readableFlowing;
        const erase=()=>{if(lines) output.write(`\x1b[${lines}A\r\x1b[J`);};
        const render=()=>{
            erase();
            const visible=Math.max(1,Math.min(8,(output.rows||24)-6));
            const start=Math.max(0,Math.min(selected-Math.floor(visible/2),choices.length-visible));
            const rows=[clean(title),'↑ / ↓ 选择，Enter 确认，Esc / Ctrl+C 取消'];
            for(let i=start;i<Math.min(start+visible,choices.length);i++) rows.push(`${i===selected?'❯':' '} ${clean(choices[i].label)}`);
            rows.push(`(${selected+1}/${choices.length})`);
            const width=Math.max(10,(output.columns||80)-1);
            const clip=row=>{let used=0,text='';for(const char of row){used+=char.codePointAt(0)>255?2:1;if(used>width-1) return text+'…';text+=char;}return text;};
            output.write(rows.map(clip).join('\n')+'\n');lines=rows.length;
        };
        const finish=error=>{
            if(done) return;done=true;
            input.off('keypress',onKey);signal?.removeEventListener('abort',cancel);
            input.setRawMode(wasRaw);if(wasPaused||wasFlowing!==true) input.pause();
            erase();output.write('\x1b[?25h');
            if(error) reject(error);else {output.write(`${clean(title)}：${clean(choices[selected].label)}\n`);resolve(choices[selected].value);}
        };
        const cancel=()=>finish(new MenuCancelled());
        const onKey=(_text,key={})=>{
            if(key.name==='escape'||key.ctrl&&key.name==='c') return cancel();
            if(key.name==='return'||key.name==='enter') return finish();
            if(key.name==='up') selected=(selected-1+choices.length)%choices.length;
            else if(key.name==='down') selected=(selected+1)%choices.length;
            else if(key.name==='home') selected=0;
            else if(key.name==='end') selected=choices.length-1;
            else return;
            render();
        };
        emitKeypressEvents(input);input.setRawMode(true);input.resume();input.on('keypress',onKey);
        signal?.addEventListener('abort',cancel,{once:true});
        output.write('\x1b[?25l');render();
    });
}

export async function chooseSettings(models,{previous={},env=process.env,menu=selectMenu,signal}={}) {
    const choices=models.map(m=>({label:`${m.label} · ${m.model}${m.vision?'':' · 仅文字'}`,value:m}));
    choices.push({label:'使用 CLI 默认模型（不指定型号）',value:null});
    const preferred=env.XXT_CODEX_MODEL||previous.model;
    let initial=models.findIndex(m=>m.model===preferred);
    if(initial<0) initial=Math.max(0,models.findIndex(m=>m.isDefault));
    const model=await menu('选择答题模型',choices,{initial,signal});
    if(!model) return {model:'',reasoningEffort:''};
    const labels={none:'关闭额外推理',minimal:'最少',low:'较快',medium:'均衡',high:'深入',xhigh:'更深入',max:'最长思考',ultra:'Ultra'};
    const efforts=[{label:'模型默认强度',value:''},...model.efforts.map(e=>({label:`${e} · ${labels[e]||e}${e===model.defaultEffort?'（推荐默认）':''}`,value:e}))];
    const preferredEffort=env.XXT_CODEX_MODEL===model.model?env.XXT_CODEX_REASONING:previous.model===model.model?previous.reasoningEffort:model.defaultEffort;
    const reasoningEffort=await menu('选择推理强度',efforts,{initial:Math.max(0,efforts.findIndex(e=>e.value===preferredEffort)),signal});
    return {model:model.model,reasoningEffort};
}

export async function configureLauncher({preferencesPath,input=process.stdin,output=process.stdout,env=process.env,discover=discoverModels,menu=selectMenu}={}) {
    if(!input.isTTY||!output.isTTY) throw new Error('请在 PowerShell 交互窗口运行 npm run start:codex；环境变量直启请用 npm run start:codex:direct。');
    const controller=new AbortController(),cancel=()=>controller.abort();
    process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
    try {
        output.write('正在读取本机 Codex 模型目录（不会发送答题请求）…\n');
        const models=await discover({binary:env.XXT_CODEX_BIN||'codex',signal:controller.signal});
        let previous={};
        try{const saved=JSON.parse(await readFile(preferencesPath,'utf8'));if(saved&&typeof saved==='object') previous=saved;}catch{}
        output.write('目录可能来自 CLI 缓存；可选择不等于账号调用权限已验证。\n');
        const settings=await chooseSettings(models,{previous,env,signal:controller.signal,menu:(title,choices,options)=>menu(title,choices,{...options,input,output})});
        if(controller.signal.aborted) throw new MenuCancelled();
        try {
            await mkdir(dirname(preferencesPath),{recursive:true});
            await writeFile(preferencesPath,JSON.stringify(settings,null,2)+'\n',{mode:0o600});
        }catch{output.write('本次选择已生效，但无法保存上次选择；下次仍可重新选择。\n');}
        return settings;
    }finally{process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}
}
