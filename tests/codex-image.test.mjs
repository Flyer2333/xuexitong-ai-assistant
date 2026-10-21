import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,writeFile,copyFile,mkdir,mkdtemp,access} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),A=require('../src/ai.js'),P=require('../src/personas.cjs');
globalThis.XxtCodexCore=require('../src/core.cjs');globalThis.XxtPersonas=P;
const local={...A.defaults,provider:'codex',protocol:'codex',model:'',baseUrl:'http://127.0.0.1:18763',key:'a'.repeat(64),vision:true};
test('local image challenge uses authenticated image endpoint and carries no expected answer',()=>{
 const spec=A.build(local,{imageChallenge:true,images:['fixture-image'],code:'must-not-send'});
 assert.equal(spec.url,local.baseUrl+'/image-test');assert.equal(spec.method,'POST');assert.deepEqual(spec.body,{images:['fixture-image']});assert.equal(spec.headers.Authorization,'Bearer '+local.key);
 assert.deepEqual(A.parse('codex',{code:'012345',model:'gpt-6-luna',reasoningEffort:'low'},undefined,false,true),{code:'012345',model:'gpt-6-luna',reasoningEffort:'low'});
 assert.equal(A.parse('codex',{code:'description 012345'},undefined,false,true).code,'');
});
test('health preserves only safe server-selected metadata; no inference claim',()=>{
 const parsed=A.parse('codex',{ok:true,model:'gpt-6-luna',reasoningEffort:'low',imageTestReady:true},undefined,true);
 assert.equal(parsed.kind,'health');assert.equal(parsed.model,'gpt-6-luna');assert.equal(parsed.reasoningEffort,'low');
 assert(!Object.hasOwn(A.parse('codex',{ok:true,model:'bad\nmodel'},undefined,true),'model'));
});
test('both local roles share one GET health and never call image inference; actual model is displayed',async()=>{
 const data={'xxt-ai-config':{...local,vision:false},'xxt-ai-vision-config':local,'xxt-ai-vision-enabled':true};
 globalThis.GM_getValue=(k,d)=>data[k]??d;globalThis.GM_setValue=(k,v)=>{data[k]=v;};let calls=0,marked=0;
 globalThis.XxtProfiles={create:()=>({markUsed:()=>{marked++;}})};
 globalThis.GM_xmlhttpRequest=spec=>{calls++;assert.equal(spec.method,'GET');assert(spec.url.endsWith('/health'));assert.equal(spec.data,undefined);queueMicrotask(()=>spec.onload({status:200,responseText:JSON.stringify({ok:true,model:'gpt-6-luna',reasoningEffort:'low',imageTestReady:true})}));return {abort(){spec.onabort();}};};
 const result=await A.testSelected().promise;assert(result.success);assert.equal(calls,1);assert.equal(marked,0);assert.equal(result.results.length,2);assert(result.results.every(x=>x.kind==='health'&&x.model==='gpt-6-luna'&&x.character==='openai'));
});
test('old bridge image endpoint produces actionable local-service guidance',async()=>{
 let sent;globalThis.GM_xmlhttpRequest=spec=>{sent=spec;return {abort(){spec.onabort();}};};
 const task=A.transport(local,'/image-test',{imageChallenge:true,images:['fixture']});sent.onload({status:404,responseText:'{"error":"未提供此接口"}'});
 await assert.rejects(task.promise,error=>{assert.equal(error.code,'LOCAL_IMAGE_TEST_UNAVAILABLE');assert.match(P.explain(error).reason,/更新本地服务源码/);assert(!P.explain(error).reason.includes('余额'));return true;});
});
test('local image request remains cancellable',async()=>{
 let aborted=0;globalThis.GM_xmlhttpRequest=spec=>({abort(){aborted++;spec.onabort();}});
 const task=A.transport(local,'/image-test',{imageChallenge:true,images:['fixture']});task.abort();await assert.rejects(task.promise,/停止/);assert.equal(aborted,1);
});

const root=resolve(import.meta.dirname,'..'),out=resolve(root,'output/codex-image');await mkdir(out,{recursive:true});
async function bridge(env={}){
 const dir=await mkdtemp(resolve(out,'bridge-'));await mkdir(resolve(dir,'local'));
 for(const name of ['bridge.mjs','core.cjs','answer-schema.json']) await copyFile(resolve(root,'src',name),resolve(dir,name));
 await copyFile(resolve(root,'tests/fixtures/codex-exec.cjs'),resolve(dir,'exec'));await writeFile(resolve(dir,'local/bridge-token.txt'),local.key);
 const child=spawn(process.execPath,[resolve(dir,'bridge.mjs')],{cwd:dir,env:{...process.env,XXT_CODEX_PORT:'0',XXT_CODEX_BIN:process.execPath,XXT_CODEX_MODEL:'gpt-6-luna',XXT_CODEX_REASONING:'low',...env},stdio:['ignore','pipe','pipe'],windowsHide:true});child.stderr.resume();const closed=once(child,'close');
 const port=await new Promise((accept,reject)=>{let text='';const timer=setTimeout(()=>{child.kill();reject(Error('bridge timeout'));},5000);child.stdout.on('data',chunk=>{text+=chunk;const m=text.match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);accept(m[1]);}});child.once('error',e=>{clearTimeout(timer);reject(e);});});
 return {dir,child,url:'http://127.0.0.1:'+port,stop:async()=>{child.kill();await closed;},request:(route,body,options={})=>fetch('http://127.0.0.1:'+port+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+local.key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),...options})};
}
const png=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.write('IHDR',12);png.writeUInt32BE(420,16);png.writeUInt32BE(120,20);const body={images:['data:image/png;base64,'+png.toString('base64')]};
test('bridge image endpoint passes one PNG and selected Luna/low to fake CLI; preserves leading zero',async()=>{
 const server=await bridge();try{
  const health=await(await server.request('/health')).json();assert.equal(health.imageTestReady,true);await assert.rejects(access(resolve(server.dir,'fake-execution.json')));
  assert.equal((await server.request('/image-test',body,{headers:{'Content-Type':'application/json'}})).status,401);
  assert.equal((await server.request('/image-test',{images:[]})).status,422);await assert.rejects(access(resolve(server.dir,'fake-execution.json')));
  const response=await server.request('/image-test',body);assert.equal(response.status,200);assert.deepEqual(await response.json(),{code:'012345',model:'gpt-6-luna',reasoningEffort:'low'});
  const execution=JSON.parse(await readFile(resolve(server.dir,'fake-execution.json'),'utf8'));assert.equal(execution.images,1);assert.equal(execution.model,'gpt-6-luna');
 }finally{await server.stop();}
});
test('bridge does not verify image digits when model reports low confidence',async()=>{
 const server=await bridge({XXT_FAKE_CONFIDENCE:'0.2'});try{assert.equal((await(await server.request('/image-test',body)).json()).code,'');}finally{await server.stop();}
});
test('pending image request holds busy lock and client cancellation terminates fake CLI',async()=>{
 const server=await bridge({XXT_FAKE_DELAY:'30000'}),controller=new AbortController();
 const pending=server.request('/image-test',body,{signal:controller.signal});const rejected=assert.rejects(pending,/abort/i);
 try{
  for(let n=0;n<100;n++){try{await access(resolve(server.dir,'fake-execution.json'));break;}catch{await new Promise(r=>setTimeout(r,20));}}
  const execution=JSON.parse(await readFile(resolve(server.dir,'fake-execution.json'),'utf8'));
  assert.equal((await server.request('/image-test',body)).status,409);controller.abort();await rejected;
  let busy=true;for(let n=0;n<100&&busy;n++){await new Promise(r=>setTimeout(r,20));busy=(await(await server.request('/health')).json()).busy;}
  assert.equal(busy,false);await assert.rejects(access(resolve(server.dir,'fake-completed')));assert.throws(()=>process.kill(execution.pid,0));
 }finally{controller.abort();await rejected;await server.stop();}
});
