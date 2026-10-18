import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),U=require('../src/updates.cjs');
test('numeric version comparison prevents lexical mistakes and downgrades',()=>{
 assert.equal(U.compare('1.0.10','1.0.9'),1);assert.equal(U.compare('1.0.9','1.0.9'),0);assert.equal(U.compare('1.0.8','1.0.9'),-1);
 for(const value of ['v1.0.9','1.0.9<script>','999999999999.0.0','1.2'])assert.throws(()=>U.compare(value,'1.0.9'));
});
test('Wi-Fi detection is strict; effective 4g never means WLAN',()=>{
 assert.equal(U.network({onLine:true,connection:{type:'wifi'}}).wifi,true);
 for(const connection of [undefined,{effectiveType:'4g'},{type:'cellular'},{type:'ethernet'},{type:'unknown'},{type:'wifi',saveData:true}])assert.equal(U.network({onLine:true,connection}).wifi,false);
 assert.equal(U.network({onLine:false,connection:{type:'wifi'}}).wifi,false);
});
test('metadata is bounded and cannot supply an arbitrary download destination',()=>{
 const data=U.validate({...U.release,downloadUrl:'https://untrusted.invalid/payload'});assert(!Object.hasOwn(data,'downloadUrl'));
 for(const changes of [[],['x'.repeat(401)],Array(21).fill('x'),[{}]])assert.throws(()=>U.validate({...U.release,changes}));
 assert.equal(new URL(U.installUrl).hostname,'raw.githubusercontent.com');
});
