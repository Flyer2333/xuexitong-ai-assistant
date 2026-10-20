/* Restore only verified glyph mappings in the request text; never rewrite the course DOM. */
(()=>{
 'use strict';
 const url='https://www.forestpolice.org/ttf/2.0/table.json',hash='fbc6ae3c795a46ca2bd0994e68e7cb90ca4d9a046f335512657760d9a4fdf875';
 const documents=new WeakMap(),cache=new Map();let tablePromise;
 const special=/[\ue000-\uf8ff\ufffd]/u;
 function source(doc){
  const styles=[...doc.querySelectorAll('style')].map(s=>s.textContent).join('\n');
  const blocks=styles.match(/@font-face\s*\{[^}]+\}/gi)||[];
  const block=blocks.find(s=>/cxsecret/i.test(s));
  if(!block)return [...(doc.fonts||[])].some(f=>/cxsecret/i.test(f.family))||/font-family\s*:[^;}]*cxsecret/i.test(styles)?'unavailable':null;
  return block.match(/base64,([a-z0-9+/=\s]+)["')]/i)?.[1].replace(/\s/g,'')||'unavailable';
 }
 async function verify(raw){
  if(typeof raw!=='string'||raw.length>1024*1024)throw Error('字体字典大小无效');
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(sha!==hash)throw Error('字体字典校验未通过');const table=JSON.parse(raw);
  if(!table||Array.isArray(table)||typeof table!=='object')throw Error('字体字典格式无效');
  // The pinned public dictionary also contains author/license/version metadata.
  // Only eight-digit glyph fingerprints are mappings; never interpret metadata as code points.
  const mappings=Object.entries(table).filter(([key])=>/^[a-f0-9]{8}$/.test(key));
  if(!mappings.length||mappings.some(([,x])=>!Number.isInteger(Number(x))||Number(x)<1||Number(x)>65535))throw Error('字体字典格式无效');return Object.fromEntries(mappings);
 }
 function loadTable(){
  if(!tablePromise)tablePromise=(async()=>{
   const stored=GM_getValue('xxt-font-table-v1','');if(stored){try{return await verify(stored);}catch{}}
   const raw=await new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url,anonymous:true,redirect:'error',timeout:15000,onload:r=>r.status===200&&(!r.finalUrl||r.finalUrl===url)?resolve(r.responseText):reject(Error('字体字典读取失败')),onerror:()=>reject(Error('字体字典连接失败')),ontimeout:()=>reject(Error('字体字典读取超时'))}));
   const table=await verify(raw);try{GM_setValue('xxt-font-table-v1',raw);}catch{}return table;
  })().catch(e=>{tablePromise=null;throw e;});return tablePromise;
 }
 async function prepare(doc,guard=()=>{}){
  if(!doc.querySelector('.font-cxsecret'))return;
  const encoded=source(doc);if(!encoded){documents.set(doc,{plain:true});return;}
  if(encoded==='unavailable'){documents.set(doc,{failed:true});return;}
  try{
   guard();if(encoded.length>3*1024*1024)throw Error('字体过大');
   let parsed=cache.get(encoded);
   if(!parsed){const table=await loadTable();guard();const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));parsed={font:XxtFontDependencies.Typr.parse(bytes)[0],table,map:new Map()};if(cache.size>=4)cache.delete(cache.keys().next().value);cache.set(encoded,parsed);}
   // Decode only characters actually present in marked text, not the entire CJK range.
   const chars=new Set([...doc.querySelectorAll('.font-cxsecret')].flatMap(e=>[...e.textContent]));
   let processed=0;for(const char of chars){if(++processed%64===0){await new Promise(resolve=>setTimeout(resolve,0));guard();}if(parsed.map.has(char))continue;const code=char.codePointAt(0);if(code<0x3400||code>0xffff)continue;
    const glyph=XxtFontDependencies.Typr.U.codeToGlyph(parsed.font,code);if(!glyph){parsed.map.set(char,char);continue;}
    const fingerprint=XxtFontDependencies.md5(JSON.stringify(XxtFontDependencies.Typr.U.glyphToPath(parsed.font,glyph))).slice(24),target=parsed.table[fingerprint];
    parsed.map.set(char,target===undefined?null:String.fromCharCode(Number(target)));
   }
   guard();documents.set(doc,{encoded,map:parsed.map});
  }catch{documents.set(doc,{failed:true});}
 }
 function read(el){
  if(!el)return '';const walker=el.ownerDocument.createTreeWalker(el,4);let node,out='';const state=documents.get(el.ownerDocument);
  while((node=walker.nextNode())){if(node.parentElement?.closest('script,style'))continue;const marked=node.parentElement?.closest('.font-cxsecret');out+=marked&&state?.map?[...node.data].map(c=>state.map.get(c)||c).join(''):node.data;}
  return out.replace(/\s+/g,' ').trim();
 }
 function obfuscated(el){
  if(!el)return false;const state=documents.get(el.ownerDocument),marked=[...(el.closest('.font-cxsecret')?[el]:[]),...el.querySelectorAll('.font-cxsecret')];
  if(special.test(read(el)))return true;
  if(!marked.length)return false;
  if(state?.plain||(!state&&!source(el.ownerDocument)))return false;
  if(!state?.map)return true;
  return marked.some(e=>[...e.textContent].some(c=>state.map.has(c)&&state.map.get(c)===null));
 }
 globalThis.XxtFonts={prepare,read,obfuscated};
})();
