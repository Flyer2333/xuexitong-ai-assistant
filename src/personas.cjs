(function(root){
 'use strict';
 const names={deepseek:'DeepSeek',openai:'GPT',claude:'Claude',gemini:'Gemini',zhipu:'GLM',kimi:'Kimi',qwen:'千问',doubao:'豆包',xiaomi:'MiMo'};
 function character(c={}){
  if(c.protocol==='codex'||c.provider==='codex')return 'openai';
  const id=String(c.model||'').toLowerCase();
  for(const [pattern,name] of [[/deepseek/,'deepseek'],[/claude/,'claude'],[/gemini/,'gemini'],[/\b(?:gpt|o[134])[-/\d]|codex/,'openai'],[/glm/,'zhipu'],[/kimi|moonshot/,'kimi'],[/qwen|qwq/,'qwen'],[/doubao|seed/,'doubao'],[/mimo/,'xiaomi']])if(pattern.test(id))return name;
  return Object.hasOwn(names,c.provider)&&!['custom','siliconflow'].includes(c.provider)?c.provider:null;
 }
 function fingerprint(c={}){let h=2166136261;const text=JSON.stringify([c.provider,c.protocol,c.baseUrl,c.model,c.key]);for(const ch of text)h=Math.imul(h^ch.charCodeAt(0),16777619);return (h>>>0).toString(16);}
 function explain(error={}){
  const code=String(error.code||'').toLowerCase(),status=Number(error.status)||0;
  if(code==='text_mismatch')return {title:'文字测试未通过',reason:'服务已响应，但模型没有正确返回本次计算结果；请重新测试或调整模型与推理强度。',certain:true};
  if(code==='local_image_test_unavailable')return {title:'本地服务没有图片测试入口',reason:'请更新本地服务源码、重启 PowerShell，并核对本地服务地址；仅更新油猴脚本不会更新电脑上的服务。',certain:true};
  if(/model_not_found|invalid_model|model_not_exist|model_not_supported/.test(code))return {title:'模型 ID 不存在或不可用',reason:'接口明确拒绝了这个模型 ID，请从服务商控制台复制可用 ID。',certain:true};
  if(/insufficient|balance|quota_exceeded/.test(code)||status===402)return {title:'账户余额或额度不足',reason:'请检查服务商余额、套餐额度及该模型的调用权限。',certain:true};
  if(status===401)return {title:'密钥验证未通过',reason:'服务商返回 401，请检查密钥是否正确、过期或已被撤销。',certain:true};
  if(status===403)return {title:'接口拒绝访问',reason:'可能是账号权限、地区限制或服务商风控，请检查控制台。',certain:false};
  if(status===404)return {title:'未找到接口或模型',reason:'可能是 Base URL、协议或模型 ID 不正确；仅凭 404 无法确定是哪一项。',certain:false};
  if(status===429)return {title:'请求受限',reason:'可能触发频率限制或账号额度限制，请检查控制台并稍后重试。',certain:false};
  if(status>=500)return {title:'服务商暂时出错',reason:'服务端返回错误，请稍后重试；也可查看服务商状态页。',certain:true};
  if(/IMAGE_MISMATCH/.test(error.code||''))return {title:'图片识别未通过',reason:'接口已响应，但没有识别出本次测试图片。可能不支持图片，或图片识别结果不正确。',certain:false};
  if(/超时/.test(error.message||''))return {title:'等待接口响应超时',reason:'可能是网络拥堵、模型繁忙或输出耗时过长，请稍后重试。',certain:false};
  if(status===400||status===422)return {title:'请求参数未被接受',reason:'可能是模型 ID、协议或参数不兼容；请先使用模型默认推理设置。',certain:false};
  return {title:'本次连接未成功',reason:'请检查网络、接口地址、模型 ID、密钥、余额和油猴授权；目前无法确定唯一原因。',certain:false};
 }
 function create(get,set,now=Date.now){
  const current=()=>get('xxt-ai-config',{}),key='xxt-text-connection';
  const active=()=>{const s=get(key,{});return s.fingerprint===fingerprint(current())&&s.active&&now()-s.successAt<86400000;};
  function success(c){if(fingerprint(c)!==fingerprint(current()))return;set(key,{fingerprint:fingerprint(c),active:true,successAt:now(),failureAt:0,failures:0});}
  function failure(c,error){if(fingerprint(c)!==fingerprint(current())||/停止|取消|夜间/.test(error.message||''))return;const s=get(key,{});if(s.fingerprint!==fingerprint(c))return;set(key,{...s,failureAt:s.failureAt||now(),failures:Math.max((s.failures||0)+1,[401,403,404].includes(error.status)?3:1)});}
  function tick(){const s=get(key,{});if(s.active&&s.failures>=3&&now()-s.failureAt>=90000&&now()-s.successAt>=120000)set(key,{...s,active:false});return active();}
  return {success,failure,tick,active};
 }
 const api={names,character,fingerprint,explain,create};if(typeof module==='object'&&module.exports)module.exports=api;root.XxtPersonas=api;
})(typeof globalThis!=='undefined'?globalThis:this);
