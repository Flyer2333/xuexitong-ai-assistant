import test from 'node:test';
import assert from 'node:assert/strict';
import P from '../src/profiles.cjs';
test('saved profiles migrate and deduplicate; successful use and local removal preserve unrelated credentials',()=>{
 const a={provider:'custom',protocol:'chat',baseUrl:'https://a.example.invalid/v1',model:'text',key:'test-secret-one',vision:false},b={...a,model:'image',key:'test-secret-two'};
 const data={'xxt-ai-config':a,'xxt-ai-vision-config':a};let n=0,t=100;
 const p=P.create((k,d)=>data[k]??d,(k,v)=>data[k]=structuredClone(v),()=>t,()=>String(++n));
 p.migrate();p.migrate();assert.equal(p.list().length,1);p.save({...a,maxTokens:4096});assert.equal(p.list().length,1);
 const second=p.save(b);t=200;p.markUsed(a);assert.equal(p.list()[0].lastUsedAt,200);assert.equal(second.lastUsedAt,null);
 p.remove(p.list()[0].id);assert.equal(data['xxt-ai-config'].key,'');assert.equal(data['xxt-ai-vision-config'].key,'');assert.equal(p.list()[0].config.key,b.key);
 assert(!P.mask(a.key).includes(a.key));assert.equal(P.mask('short'),'••••••••');
});
test('profile fields are whitelisted and storage limit never drops an existing key',()=>{
 const data={};let id=0;const p=P.create((k,d)=>data[k]??d,(k,v)=>data[k]=v,()=>1,()=>String(++id));
 for(let i=0;i<30;i++)p.save({provider:'custom',protocol:'chat',baseUrl:'https://example.invalid',model:String(i),key:'test',extra:'must not persist'});
 assert(!('extra' in p.list()[0].config));assert.throws(()=>p.save({model:'new',key:'test'}),/30/);assert.equal(p.list().length,30);
});
