(function(root){
 'use strict';
 const slots=['xxt-ai-config','xxt-ai-vision-config'],store='xxt-ai-profiles';
 const fields=['provider','protocol','baseUrl','model','key','vision','jsonMode','reasoning','maxTokens'];
 const pick=c=>Object.fromEntries(fields.filter(k=>c[k]!==undefined).map(k=>[k,c[k]]));
 const identity=c=>JSON.stringify([c.provider,c.protocol,String(c.baseUrl||'').replace(/\/+$/,''),c.model,c.key]);
 const mask=key=>!key?'未保存':key.length<12?'••••••••':`${key.slice(0,3)}••••••${key.slice(-4)}`;
 function create(get,set,now=Date.now,id=()=>root.crypto.randomUUID()){
  const list=()=>{const rows=get(store,[]);return Array.isArray(rows)?rows.filter(x=>x&&typeof x.id==='string'&&x.config&&typeof x.config.key==='string').slice(0,30):[];};
  function save(config){
   if(!config.key)return null;
   const rows=list(),old=rows.find(p=>identity(p.config)===identity(config));
   if(!old&&rows.length>=30)throw Error('已保存 30 个接口，请先删除不用的配置');
   const value={id:old?.id||id(),config:pick(config),createdAt:old?.createdAt||now(),updatedAt:now(),lastUsedAt:old?.lastUsedAt||null};
   set(store,old?rows.map(p=>p.id===old.id?value:p):[...rows,value]);return value;
  }
  function remove(profileId){
   const rows=list(),p=rows.find(x=>x.id===profileId);if(!p)return;
   set(store,rows.filter(x=>x.id!==profileId));
   for(const slot of slots){const c=get(slot,{});if(identity(c)===identity(p.config))set(slot,{...c,key:''});}
  }
  function clear(config){for(const p of list())if(identity(p.config)===identity(config))remove(p.id);for(const slot of slots){const c=get(slot,{});if(identity(c)===identity(config))set(slot,{...c,key:''});}}
  function markUsed(config){const rows=list();if(rows.some(p=>identity(p.config)===identity(config)))set(store,rows.map(p=>identity(p.config)===identity(config)?{...p,lastUsedAt:now()}:p));}
  function migrate(){for(const slot of slots){const c=get(slot,{});if(c?.key&&!list().some(p=>identity(p.config)===identity(c)))save(c);}}
  return {list,save,remove,clear,markUsed,migrate};
 }
 const api={create,mask,identity};
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.XxtProfiles=api;
})(typeof globalThis!=='undefined'?globalThis:this);
