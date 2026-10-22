import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), D=require('../src/dispatch.cjs'), E=require('../src/diagnostics.cjs');
const q=(id,visual=false)=>({id,type:'single',text:'测试题',options:[{key:'A',text:'甲'},{key:'B',text:'乙'}],...(visual?{imageKey:'stem-image'}:{})});
test('mixed questions: text receives no image, visual has distinct credential and endpoint, answers retain order',async()=>{
 const calls=[],questions=[q('a'),q('b',true),q('c')];
 const result=await D.run({questions,images:['png-b'],imageQuestionIds:['b']},{base:{key:'text-secret',baseUrl:'https://text.invalid',vision:false},vision:{key:'visual-secret',baseUrl:'https://visual.invalid'},transport:(config,path,payload)=>{calls.push({config,payload});return {promise:Promise.resolve({answers:payload.questions.map(q=>({id:q.id}))})};}}).promise;
 assert.deepEqual(result.answers.map(x=>x.id),['a','b','c']);assert.equal(calls.length,2);
 assert.equal(calls[0].config.key,'text-secret');assert.deepEqual(calls[0].payload.images,[]);
 assert.equal(calls[1].config.baseUrl,'https://visual.invalid');assert.equal(calls[1].config.key,'visual-secret');
 assert.deepEqual(calls[1].payload.imageManifest,[{image:1,questionIds:['b']}]);
});
test('content dedup preserves all referring question IDs; batch limits and history filtering',()=>{
 const questions=Array.from({length:23},(_,i)=>q('q'+i,true)),ids=questions.map(q=>q.id);
 const parts=D.batches({questions,images:ids.map(()=>'identical-bytes'),imageQuestionIds:ids,history:[{answers:ids.map(id=>({id,choices:['A']}))}]});
 assert.deepEqual(parts.map(p=>p.questions.length),[8,8,7]);assert(parts.every(p=>p.images.length===1));
 assert.equal(parts[0].imageManifest[0].questionIds.length,8);assert.equal(parts[2].history[0].answers.length,7);
 assert.throws(()=>D.batches({questions:[q('visual',true)],images:[],imageQuestionIds:[]}),/缺少/);
});
test('cancel aborts the active batch and never sends the next; later failure returns no partial answers',async()=>{
 let calls=0,aborted=false,reject;
 const job=D.run({questions:Array.from({length:17},(_,i)=>q('q'+i))},{base:{},transport:()=>{calls++;return{promise:new Promise((_,r)=>reject=r),abort(){aborted=true;reject(Error('cancelled'));}};}});
 job.abort();await assert.rejects(job.promise);assert(aborted);assert.equal(calls,1);
 calls=0;
 await assert.rejects(D.run({questions:[q('a'),q('b',true)],images:['p'],imageQuestionIds:['b']},{base:{vision:true},vision:{key:'image-fixture'},transport:()=>({promise:++calls===1?Promise.resolve({answers:[{id:'a'}]}):Promise.reject(Error('failed'))})}).promise,/failed/);
});

test('216/256 questions retain order, text 16 and vision 8, bounded history and complete answer validation',async()=>{
 const core=require('../src/core.cjs');
 for(const count of [216,256]){
  const questions=Array.from({length:count},(_,i)=>q('q'+i)),calls=[];
  const answers=await D.run({questions,history:[{finalScore:60,maxScore:100,answers:questions.map(q=>({id:q.id,choices:['B']})),review:[]}]},{base:{},transport:(_,path,payload)=>{
   core.validateQuestions(payload.questions);core.validateHistory(payload.history);calls.push(payload.questions.length);
   return{promise:Promise.resolve({answers:payload.questions.map(q=>({id:q.id,choices:['A'],readable:true,confidence:1,explanation:'fixture'}))})};
  }}).promise;
  assert.equal(calls.length,Math.ceil(count/16));assert(calls.every(n=>n<=16));
  assert.deepEqual(core.validateAnswers(questions,answers).map(a=>a.id),questions.map(q=>q.id));
 }
 const visual=Array.from({length:256},(_,i)=>q('v'+i,true));
 const parts=D.batches({questions:visual,images:visual.map(()=>'shared'),imageQuestionIds:visual.map(q=>q.id)});
 assert.equal(parts.length,32);assert(parts.every(p=>p.questions.length===8&&p.images.length===1&&p.imageManifest[0].questionIds.length===8));
 const tooMany=Array.from({length:257},(_,i)=>q('q'+i));
 assert.throws(()=>D.batches({questions:tooMany}),/256/);
 assert.throws(()=>core.validateQuestions(tooMany,core.pageQuestionLimit),/256/);
 assert.throws(()=>core.validateAnswers(tooMany,{answers:[]}),/256/);
 assert.throws(()=>D.batches({questions:[q('a') ]},{size:21}),/1–20/);
 const long=Array.from({length:16},(_,i)=>({...q('long'+i),text:'长'.repeat(3000)}));
 assert(D.batches({questions:long}).every(p=>p.questions.length<16&&p.questions.reduce((n,q)=>n+JSON.stringify(q).length,0)<=12000));
});
test('special fonts and rendered formulas require vision; configured text-only model cannot silently receive images',async()=>{
 assert(D.needsVision({...q('a'),obfuscated:true}));assert(D.needsVision({...q('a'),requiresVision:true}));
 assert(D.needsVision({...q('a'),text:'\ue123'}));
 const result=await D.run({questions:[q('a',true)],images:[]},{base:{vision:true},transport:()=>{throw Error('must not call');}}).promise;
 assert.equal(result.answers.length,0);assert.equal(result.skipped.length,1);assert.match(result.skipped[0].reason,/未配置图片接口/);
});
test('diagnostics export only safe fixed labels and bounded numeric facts',()=>{
 const secret='sk-PRIVATE https://private.invalid?q=course student-name';
 const log=E.create({read:()=>[{code:'HTTP',at:1,message:secret,url:secret,body:secret}],now:()=>2});
 log.record(Error('HTTP 401 '+secret),{phase:'request',batch:2,url:secret,question:secret});
 const exported=log.export('1.1.0');assert(!exported.includes('PRIVATE'));assert(!exported.includes('private.invalid'));assert(!exported.includes('student-name'));
 const last=JSON.parse(exported).diagnostics.at(-1);assert.equal(last.status,401);assert.equal(last.batch,2);
});
