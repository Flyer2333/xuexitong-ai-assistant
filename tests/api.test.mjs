import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
globalThis.XxtCodexCore=require('../src/core.cjs');
const A=require('../src/ai.js');
const q={id:'q1',type:'single',text:'1+1=?',options:[{key:'A',text:'2'},{key:'B',text:'3'}]};
const answer={answers:[{id:'q1',choices:['A'],readable:true,confidence:1,explanation:'一加一等于二'}]};
const payload={questions:[q],images:['data:image/png;base64,aGVsbG8='],history:[]};
const config=protocol=>({...A.defaults,protocol,provider:protocol==='codex'?'codex':'custom',baseUrl:protocol==='codex'?'http://127.0.0.1:18763':'https://api.example.invalid/v1',model:'vision-test',key:protocol==='codex'?'b'.repeat(64):'test-only-key'});
for(const protocol of ['chat','responses','anthropic','gemini','codex']){
 test(`${protocol}: request/auth/image/response`,()=>{
  const spec=A.build(config(protocol),payload),body=JSON.stringify(spec.body);
  assert.equal(spec.method,'POST');assert(!spec.url.includes('test-only-key'));
  if(protocol==='chat'){assert(spec.url.endsWith('/chat/completions'));assert.equal(spec.body.messages[0].content[1].type,'image_url');}
  if(protocol==='responses'){assert.equal(spec.body.store,false);assert.equal(spec.body.input[0].content[1].type,'input_image');}
  if(protocol==='anthropic'){assert.equal(spec.headers['x-api-key'],'test-only-key');assert.equal(spec.body.messages[0].content[1].source.media_type,'image/png');}
  if(protocol==='gemini'){assert.equal(spec.headers['x-goog-api-key'],'test-only-key');assert.equal(spec.body.contents[0].parts[1].inline_data.mime_type,'image/png');}
  assert(!body.includes('test-only-key'));
  const text=JSON.stringify(answer),response=protocol==='chat'?{choices:[{message:{content:text}}]}:protocol==='responses'?{output:[{content:[{type:'output_text',text}]}]}:protocol==='anthropic'?{content:[{type:'thinking',thinking:'ignore'},{type:'text',text}]}:protocol==='gemini'?{candidates:[{content:{parts:[{thought:true,text:'ignore'},{text}]}}]}:answer;
  assert.deepEqual(A.parse(protocol,response,[q]),answer);
 });
}
test('text mode does not send images; JSON and reasoning are opt-in',()=>{
 const spec=A.build({...config('chat'),vision:false},payload);assert.equal(typeof spec.body.messages[0].content,'string');assert(!JSON.stringify(spec.body).includes('aGVsbG8'));assert(!spec.body.response_format);assert(!spec.body.reasoning_effort);
 const json=A.build({...config('responses'),jsonMode:true,reasoning:'high'},payload);assert.equal(json.body.text.format.type,'json_object');assert.equal(json.body.reasoning.effort,'high');
});
test('Chinese provider presets and Xiaomi native header/token field',()=>{
 for(const provider of ['deepseek','xiaomi','kimi','zhipu','qwen','doubao','siliconflow']){
  const c={...config('chat'),...A.presets[provider],provider};const spec=A.build(c,payload);
  assert.equal(spec.url,c.baseUrl+'/chat/completions');
  assert.equal(provider==='xiaomi'?spec.headers['api-key']:spec.headers.Authorization,provider==='xiaomi'?'test-only-key':'Bearer test-only-key');
  if(provider==='xiaomi'){assert.equal(spec.body.max_completion_tokens,8192);assert(!spec.headers.Authorization);assert(!spec.body.max_tokens);}
 }
});
test('URL and credential validation',()=>{
 for(const baseUrl of ['http://example.com/v1','https://key:secret@example.com/v1','https://example.com/v1?key=x','https://example.com/v1#x'])assert.throws(()=>A.normalize({...config('chat'),baseUrl}));
 assert.throws(()=>A.build({...config('chat'),baseUrl:'https://example.com/v1/chat/completions'},payload));
 assert.throws(()=>A.normalize({...config('codex'),baseUrl:'https://example.com'}));
 assert.throws(()=>A.normalize({...config('chat'),key:'abc\r\nInjected:x'}));
 assert.throws(()=>A.normalize({...config('chat'),model:''}));
});
test('bad output, unknown answers, incomplete and blocked results do not become random answers',()=>{
 assert.throws(()=>A.parse('chat',{choices:[{message:{content:'not JSON'}}]},[q]));
 assert.throws(()=>A.parse('chat',{choices:[{message:{content:JSON.stringify({answers:[{...answer.answers[0],choices:['Z']}]})}}]},[q]));
 assert.throws(()=>A.parse('responses',{status:'incomplete',output_text:JSON.stringify(answer)},[q]));
 assert.throws(()=>A.parse('gemini',{promptFeedback:{blockReason:'SAFETY'}},[q]));
});
test('image references follow reordered options and reject changed stem/option images',()=>{
 const original={...q,imageKey:'1111111111111111',options:q.options.map((o,i)=>({...o,text:'图片选项',imageKey:i?'bbbbbbbbbbbbbbbb':'aaaaaaaaaaaaaaaa'}))};
 const learned=[{question:original,choices:['A']}];
 const reordered={...original,options:[{...original.options[1],key:'A'},{...original.options[0],key:'B'}]};
 assert.deepEqual(XxtCodexCore.recallAnswers([reordered],learned)[0].choices,['B']);
 assert.equal(XxtCodexCore.recallAnswers([{...reordered,imageKey:'2222222222222222'}],learned).length,0);
 assert.equal(XxtCodexCore.recallAnswers([{...original,options:[{...original.options[0],imageKey:'cccccccccccccccc'},original.options[1]]}],learned).length,0);
});
test('transport success, probe, cancellation, redacted HTTP errors and text obfuscation',async()=>{
 let calls=0,aborts=0,configValue=config('chat'),sent;
 globalThis.GM_getValue=()=>configValue;
 globalThis.GM_xmlhttpRequest=spec=>{calls++;sent=spec;return {abort(){aborts++;spec.onabort();}};};
 const job=A.request('/solve',payload);assert.equal(calls,1);assert.equal(sent.redirect,'error');assert.equal(sent.anonymous,true);
 sent.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify(answer)}}]})});assert.deepEqual(await job.promise,answer);
 const probe=A.request('/health');assert.equal(sent.method,'POST');assert(!sent.data.includes(q.text));
 sent.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:'{"ok":true}'}}]})});assert.deepEqual(await probe.promise,{ok:true});
 const cancel=A.request('/solve',payload);cancel.abort();await assert.rejects(cancel.promise,/已停止/);assert.equal(aborts,1);
 const failed=A.request('/solve',payload);sent.onload({status:401,responseText:'secret echoed test-only-key'});await assert.rejects(failed.promise,error=>!error.message.includes('test-only-key')&&/无效/.test(error.message));
 configValue={...config('chat'),vision:false};const before=calls;
 await assert.rejects(A.request('/solve',{...payload,questions:[{...q,obfuscated:true}]}).promise,/特殊字体/);assert.equal(calls,before);
 await assert.rejects(A.request('/solve',{...payload,questions:[{...q,imageKey:'1111111111111111'}]}).promise,/包含图片/);assert.equal(calls,before);
});
