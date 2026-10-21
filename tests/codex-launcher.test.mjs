import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,readFile,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {normalizeModels,discoverModels,selectMenu,chooseSettings,configureLauncher,MenuCancelled} from '../src/codex-launcher.mjs';
const fixture=fileURLToPath(new URL('./fixtures/codex-catalog.mjs',import.meta.url));
const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'output/codex-launcher');
await mkdir(output,{recursive:true});
const models=normalizeModels([
 {model:'fixture-a',displayName:'甲',isDefault:true,defaultReasoningEffort:'medium',supportedReasoningEfforts:[{reasoningEffort:'medium'},{reasoningEffort:'max'}]},
 {model:'fixture-b',displayName:'乙',inputModalities:['text'],defaultReasoningEffort:'low',supportedReasoningEfforts:[{reasoningEffort:'low'},{reasoningEffort:'high'}]}
]);
function tty(columns=80){
 const input=new PassThrough();input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};
 const output=new PassThrough();output.isTTY=true;output.rows=24;output.columns=columns;let text='';output.on('data',chunk=>{text+=chunk;});
 return {input,output,text:()=>text};
}
const probe=(scenario,options={})=>discoverModels({...options,spawnProcess:(binary,args,config)=>{
 assert.equal(binary,'codex');assert.deepEqual(args.slice(0,3),['app-server','--listen','stdio://']);assert.equal(config.shell,false);
 return spawn(process.execPath,[fixture],{...config,env:{...process.env,XXT_CATALOG_FIXTURE:scenario}});
}});

test('catalog excludes hidden/invalid IDs, preserves per-model capabilities, sanitizes display text',()=>{
 const rows=normalizeModels([{model:'ok',displayName:'name\n\x1b',supportedReasoningEfforts:[null,{reasoningEffort:'high'},{reasoningEffort:'high'},{reasoningEffort:'bad"value'}]},{model:'hidden',hidden:true},{model:'bad\nmodel'},{model:'ok'},{model:'other',supportedReasoningEfforts:{}}]);
 assert.equal(rows.length,2);assert.equal(rows[0].label,'name');assert.deepEqual(rows[0].efforts,['high']);assert.deepEqual(rows[1].efforts,[]);
});
test('metadata handshake and pagination use no inference RPC',async()=>{
 const result=await probe('pages');assert.deepEqual(result.map(x=>x.model),['fixture-a','fixture-b']);assert.deepEqual(result[1].efforts,['low','high']);
});
for(const scenario of ['error','malformed','empty','cursor-loop','exit']) test('metadata fails safely: '+scenario,async()=>{await assert.rejects(probe(scenario),Error);});
test('metadata timeout terminates the reader',async()=>{await assert.rejects(probe('timeout',{timeoutMs:100}),/超时/);});
test('metadata cancellation is distinct from failure',async()=>{
 const controller=new AbortController();const pending=probe('timeout',{signal:controller.signal});controller.abort();await assert.rejects(pending,MenuCancelled);
});
test('model change does not carry incompatible saved effort',async()=>{
 const menus=[];const settings=await chooseSettings(models,{env:{},previous:{model:'fixture-a',reasoningEffort:'max'},menu:async(title,choices,options)=>{menus.push({choices,options});return menus.length===1?models[1]:choices[options.initial].value;}});
 assert.deepEqual(settings,{model:'fixture-b',reasoningEffort:'low'});assert.deepEqual(menus[1].choices.map(x=>x.value),['','low','high']);
});
test('previous model and effort preselect, but still require both confirmations',async()=>{
 let calls=0;const settings=await chooseSettings(models,{env:{},previous:{model:'fixture-a',reasoningEffort:'max'},menu:async(_t,choices,options)=>{calls++;return choices[options.initial].value;}});
 assert.equal(calls,2);assert.equal(settings.reasoningEffort,'max');
});
test('CLI default clears both old environment selections',async()=>{
 const settings=await chooseSettings(models,{env:{XXT_CODEX_MODEL:'fixture-a',XXT_CODEX_REASONING:'max'},menu:async(_t,choices)=>choices.at(-1).value});
 assert.deepEqual(settings,{model:'',reasoningEffort:''});
});
test('arrow keys select and confirm, raw mode restored',async()=>{
 const io=tty();const pending=selectMenu('模型',models.map(x=>({label:x.label,value:x.model})),io);
 io.input.write('\x1b[B');io.input.write('\r');assert.equal(await pending,'fixture-b');assert.equal(io.input.isRaw,false);assert.equal(io.input.listenerCount('keypress'),0);assert(io.text().includes('\x1b[?25h'));
});
for(const key of ['\x1b','\x03']) test('Esc/Ctrl+C cancels menu without selecting: '+JSON.stringify(key),async()=>{
 const io=tty();const pending=selectMenu('模型',[{label:'甲',value:'a'}],io);io.input.write(key);await assert.rejects(pending,MenuCancelled);assert.equal(io.input.isRaw,false);assert.equal(io.input.isPaused(),true);
});
test('long menus scroll and narrow terminal lines do not wrap',async()=>{
 const io=tty(32);const choices=Array.from({length:20},(_,i)=>({label:'中文很长的模型'.repeat(10)+i,value:i}));const pending=selectMenu('模型',choices,io);io.input.write('\x1b[F');io.input.write('\r');assert.equal(await pending,19);assert(io.text().includes('(20/20)'));assert(io.text().includes('…'));
});
test('noninteractive launcher fails before discovery',async()=>{
 await assert.rejects(configureLauncher({input:{isTTY:false},output:{isTTY:false},discover:()=>assert.fail('must not spawn')}),/PowerShell/);
});
test('launcher remembers selections only after both menus; cancellation preserves saved file',async()=>{
 const dir=await mkdtemp(resolve(output,'preferences-')),preferencesPath=resolve(dir,'settings.json');
 await writeFile(preferencesPath,JSON.stringify({model:'fixture-a',reasoningEffort:'max'}));
 const before=await readFile(preferencesPath,'utf8');let n=0;const io=tty();
 await assert.rejects(configureLauncher({...io,env:{},preferencesPath,discover:async()=>models,menu:async(_t,choices)=>{if(++n===2) throw new MenuCancelled();return choices[0].value;}}),MenuCancelled);
 assert.equal(await readFile(preferencesPath,'utf8'),before);
 const selected=await configureLauncher({...io,env:{},preferencesPath,discover:async()=>models,menu:async(_t,choices,options)=>choices[options.initial].value});
 assert.deepEqual(JSON.parse(await readFile(preferencesPath,'utf8')),selected);assert.equal(selected.reasoningEffort,'max');
 assert.equal(process.listenerCount('SIGINT'),0);
});
test('chosen settings reach original bridge health; no solve or model call',async()=>{
 const settings=await chooseSettings(models,{env:{},menu:async(_t,choices)=>choices[choices.length===3?1:choices.length-1].value});
 const dir=await mkdtemp(resolve(output,'bridge-'));await mkdir(resolve(dir,'local'));
 for(const name of ['bridge.mjs','core.cjs','answer-schema.json']) await copyFile(resolve(root,'src',name),resolve(dir,name));
 const token='0'.repeat(64);await writeFile(resolve(dir,'local/bridge-token.txt'),token);
 const child=spawn(process.execPath,[resolve(dir,'bridge.mjs')],{env:{...process.env,XXT_CODEX_PORT:'0',XXT_CODEX_MODEL:settings.model,XXT_CODEX_REASONING:settings.reasoningEffort},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let text='';child.stderr.resume();
 const closed=once(child,'close');
 try{
  const port=await new Promise((accept,reject)=>{
   const timer=setTimeout(()=>reject(new Error('bridge timeout')),5000);
   child.stdout.on('data',chunk=>{text+=chunk;const found=text.match(/127\.0\.0\.1:(\d+)/);if(found){clearTimeout(timer);accept(Number(found[1]));}});
   child.once('error',error=>{clearTimeout(timer);reject(error);});
  });
  const response=await fetch(`http://127.0.0.1:${port}/health`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(response.status,200);const health=await response.json();assert.equal(health.model,settings.model);assert.equal(health.reasoningEffort,settings.reasoningEffort);
 }finally{child.kill();await closed;}
});
