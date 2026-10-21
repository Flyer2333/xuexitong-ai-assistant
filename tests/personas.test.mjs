import test from 'node:test';import assert from 'node:assert/strict';import P from '../src/personas.cjs';import V from '../src/profiles.cjs';
test('one text and one image assignment across profiles; one profile may serve both, removing one role preserves the other',()=>{
 const data={};let n=0;const v=V.create((k,d)=>data[k]??d,(k,x)=>data[k]=structuredClone(x),()=>1,()=>String(++n));
 const a={provider:'custom',protocol:'chat',baseUrl:'https://fixture.invalid',model:'text',key:'fixture-one'},b={...a,model:'image',key:'fixture-two'},c={...a,model:'combined',key:'fixture-three'};
 for(const x of[a,b,c])v.save(x);v.assign(a,'text');v.assign(b,'image');assert(v.selected(a,'text'));assert(v.selected(b,'image'));
 v.assign(c,'text');v.assign(c,'image');assert(!v.selected(a,'text'));assert(!v.selected(b,'image'));assert(v.selected(c,'text'));assert(v.selected(c,'image'));
 v.assign(b,'image');assert(v.selected(c,'text'));assert(v.selected(b,'image'));assert(!v.selected(c,'image'));
 v.assign(c,'text',false);assert(!v.selected(c,'text'));assert(v.selected(b,'image'));
});
test('connection theme waits through transient errors; repeated failures respect 90s debounce and 120s minimum hold, stale config cannot repaint',()=>{
 const c={provider:'deepseek',model:'deepseek-flash',key:'fixture-secret'},data={'xxt-ai-config':c};let time=1000;
 const h=P.create((k,d)=>data[k]??d,(k,x)=>data[k]=x,()=>time);h.success(c);assert(h.active());
 h.failure(c,Error('timeout'));time+=200000;assert(h.tick(),'one temporary error must retain theme');
 h.success(c);h.failure(c,{status:401});time+=90001;assert(h.tick(),'minimum hold still applies');time+=30000;assert(!h.tick());
 h.success(c);assert(h.active());data['xxt-ai-config']={...c,key:'different-fixture'};assert(!h.active());h.success(c);assert(!h.active());
});
test('provider and model names identify hosted model family, unsupported characters remain absent; errors never repeat arbitrary server contents',()=>{
 assert.equal(P.character({provider:'siliconflow',model:'deepseek-ai/DeepSeek-V3'}),'deepseek');assert.equal(P.character({provider:'custom',model:'claude-opus-4-6'}),'claude');assert.equal(P.character({provider:'custom',model:'unidentified-model'}),null);
 assert(P.explain({code:'model_not_found'}).certain);assert(!P.explain({status:404}).certain);assert(!P.explain({message:'sensitive arbitrary response'}).reason.includes('sensitive'));
});
