import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../src/core.cjs'),R=require('../src/retry.cjs'),L=require('../src/run-ledger.cjs');
const q={id:'q1',type:'blank',text:'填写两空',slots:2,options:[]};
const answer={id:'q1',texts:['甲','乙'],choices:[],readable:true,confidence:1,explanation:'依据题意'};
test('text answers require exact slot mapping, nonempty values and confidence; never randomize text',()=>{
 assert.deepEqual(C.resolveAnswers([q],{answers:[answer]})[0].texts,['甲','乙']);
 assert.throws(()=>C.resolveAnswers([q],{answers:[{...answer,texts:['甲']}]}),/数量/);
 assert.throws(()=>C.resolveAnswers([q],{answers:[{...answer,confidence:0.1}]},{randomizeUncertain:true}),/不随机/);
 assert.deepEqual(C.recallAnswers([q],[{question:q,texts:['甲','乙']}])[0].texts,['甲','乙']);
 assert.equal(R.novel([q],[answer],[[answer]]).exhausted,true);
 const plan=R.plan([q],[{questions:[q],answers:[answer],finalScore:0,maxScore:10}]);assert(plan.repeated([answer]));
 assert(!plan.repeated([{...answer,texts:['丙','丁']}]));
});
test('central retry is scoped, bounded and excludes uncertain submission, changed catalog and legacy records',()=>{
 const scope='course-class-account',catalog=[{index:0,title:'甲'},{index:1,title:'乙'}];
 const records=[{scope,index:0,title:'甲'}, {scope,index:0,title:'甲'}, {scope,index:1,title:'乙',uncertainSubmission:true}, {scope:'other-account',index:1,title:'乙'},{index:1,title:'乙'}];
 assert.deepEqual(L.plan(records,catalog,scope),[{index:0,title:'甲'}]);
 assert.deepEqual(L.plan(records,[{index:0,title:'目录已变化'}],scope),[]);
 const updated=L.record(records,{scope,index:0,title:'甲',reason:'未处理'});assert.equal(updated.filter(x=>x.scope===scope&&x.index===0).length,1);
 assert(L.record([{scope,index:1,title:'乙',uncertainSubmission:true}],{scope,index:1,title:'乙',reason:'后来未识别'})[0].uncertainSubmission);
});
