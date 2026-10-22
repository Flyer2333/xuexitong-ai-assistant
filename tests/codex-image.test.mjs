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
const answers=text=>({answers:[{id:'image-probe',choices:[],texts:[text],readable:true,confidence:1,explanation:'fixture'}]});

test('local image challenge uses the existing authenticated solve route without an expected answer',()=>{
 const spec=A.build(local,{imageChallenge:true,images:['fixture-image'],code:'must-not-send'});
 assert.equal(spec.url,local.baseUrl+'/solve');assert.equal(spec.method,'POST');assert.deepEqual(spec.body.images,['fixture-image']);assert.equal(spec.body.questions[0].id,'image-probe');assert.deepEqual(spec.body.imageManifest,[{image:1,questionIds:['image-probe']}]);assert(!JSON.stringify(spec.body).includes('must-not-send'));assert.equal(spec.headers.Authorization,'Bearer '+local.key);
 assert.deepEqual(A.parse('codex',{...answers('012345'),model:'gpt-6-luna',reasoningEffort:'low'},undefined,false,true),{code:'012345',model:'gpt-6-luna',reasoningEffort:'low'});
 assert.equal(A.parse('codex',answers('description 012345'),undefined,false,true).code,'');
});
test('health preserves only safe server-selected metadata; no inference claim',()=>{
 const parsed=A.parse('codex',{ok:true,model:'gpt-6-luna',reasoningEffort:'low',imageTestReady:true},undefined,true);
 assert.equal(parsed.kind,'health');assert.equal(parsed.model,'gpt-6-luna');assert.equal(parsed.reasoningEffort,'low');
 assert(!Object.hasOwn(A.parse('codex',{ok:true,model:'bad\nmodel'},undefined,true),'model'));
});
function setupSelected({image=true,health=true,wrongText=false,wrongImage=false,hang=false}={}){
 const data={'xxt-ai-config':{...local,vision:false},'xxt-ai-vision-config':local,'xxt-ai-vision-enabled':image},calls=[];
 let digits='',marked=0,aborted=0;
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(value){digits=value;}}),toDataURL:()=> 'data:image/png;base64,fixture'}),dispatchEvent(){}};
 globalThis.GM_getValue=(k,d)=>data[k]??d;globalThis.GM_setValue=(k,v)=>{data[k]=v;};globalThis.XxtProfiles={create:()=>({markUsed:()=>marked++})};
 globalThis.GM_xmlhttpRequest=spec=>{
  calls.push(spec);queueMicrotask(()=>{
   if(spec.url.endsWith('/health')){spec.onload({status:200,responseText:JSON.stringify({ok:health,model:'gpt-6-luna',reasoningEffort:'low'})});return;}
   if(hang)return;
   const body=JSON.parse(spec.data),q=body.questions[0],numbers=q.text.match(/计算 (\d+) \+ (\d+)/);
   const value=q.id==='text-probe'?(wrongText?'wrong':String(Number(numbers[1])+Number(numbers[2]))):(wrongImage?'wrong':digits);
   const result={answers:[{id:q.id,choices:[],texts:[value],readable:true,confidence:1,explanation:'fixture'}]};
   spec.onload({status:200,responseText:JSON.stringify(result)});
  });return {abort(){aborted++;spec.onabort();}};
 };
 return {data,calls,get marked(){return marked;},get aborted(){return aborted;}};
}

test('one connection click tests text and image through solve even on an older bridge, health is deduplicated',async()=>{
 const fixture=setupSelected();const result=await A.testSelected().promise;
 assert(result.success);assert.equal(fixture.calls.filter(x=>x.method==='GET').length,1);assert.equal(fixture.calls.filter(x=>x.url.endsWith('/solve')).length,2);
 assert.equal(fixture.marked,2);assert(result.results.every(x=>x.success&&x.kind!=='health'&&x.model==='gpt-6-luna'&&x.character==='openai'&&x.reasoningEffort==='low'));
 assert.equal(fixture.data['xxt-image-capability'].verified,true);
});

test('text-only selection makes one real text probe and no image probe',async()=>{
 const fixture=setupSelected({image:false});assert((await A.testSelected().promise).success);assert.equal(fixture.calls.length,2);assert.equal(JSON.parse(fixture.calls[1].data).images.length,0);
});

test('connection progress reports stages and validated outcomes without credentials',async()=>{
 setupSelected();const stages=[];assert((await A.request('/test-selected',{onProgress:info=>stages.push(info)}).promise).success);
 assert.deepEqual(stages,[{role:'文字',phase:'health'},{role:'文字',phase:'model'},{role:'文字',phase:'done',success:true},{role:'图片',phase:'model'},{role:'图片',phase:'done',success:true}]);assert(!JSON.stringify(stages).includes(local.key));
});

test('progress UI callback errors do not interrupt connection validation',async()=>{
 setupSelected();assert((await A.testSelected({onProgress(){throw Error('fixture UI error');}}).promise).success);
});

test('reachable health alone does not pass when model answer is wrong',async()=>{
 setupSelected({image:false,wrongText:true});const result=await A.testSelected().promise;assert.equal(result.success,false);assert.equal(result.results[0].title,'文字测试未通过');assert.equal(result.results[0].model,'gpt-6-luna');
});

test('wrong image keeps text success and does not mark image capability',async()=>{
 const fixture=setupSelected({wrongImage:true});const result=await A.testSelected().promise;assert.equal(result.success,false);assert(result.results[0].success);assert.equal(result.results[1].title,'图片识别未通过');assert.equal(fixture.data['xxt-image-capability'],undefined);
});

test('failed health does not start any model probe',async()=>{
 const fixture=setupSelected({health:false});assert.equal((await A.testSelected().promise).success,false);assert(fixture.calls.every(x=>x.method==='GET'));
});

test('cancel while text inference is pending prevents image inference and success result',async()=>{
 const fixture=setupSelected({hang:true}),task=A.testSelected();for(let n=0;n<10&&fixture.calls.length<2;n++)await new Promise(r=>setImmediate(r));task.abort();await assert.rejects(task.promise,/停止/);assert.equal(fixture.calls.length,2);assert.equal(fixture.aborted,1);assert.equal(fixture.marked,0);
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

test('existing solve route handles both text and image probes without the newer image-test endpoint',async()=>{
 const server=await bridge();try{
  const text={questions:[{id:'text-probe',type:'blank',text:'计算 17 + 28，只将计算结果填写在一个输入框中。',options:[],slots:1}],images:[],imageManifest:[]};
  const response=await server.request('/solve',text);assert.equal(response.status,200);assert.equal((await response.json()).answers[0].texts[0],'45');
  const image=A.build(local,{imageChallenge:true,...body});assert.equal(image.url,local.baseUrl+'/solve');const result=await(await server.request('/solve',image.body)).json();assert.equal(A.parse('codex',result,undefined,false,true).code,'012345');
 }finally{await server.stop();}
});
