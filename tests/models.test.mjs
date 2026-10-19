import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url), A = require('../src/ai.js'), C = require('../src/models.cjs');
const config = (provider,model,reasoning='') => ({...A.defaults,...A.presets[provider],provider,model,reasoning,key:'fixture-key'});
const build = (p,m,r) => A.build(config(p,m,r),{questions:[],images:[]}).body;
test('catalog provider coverage and exact IDs, unknown model remains valid on defaults',()=>{
    assert.deepEqual(Object.keys(C.providers).sort(),Object.keys(A.presets).sort());
    assert(C.model('deepseek','deepseek-flash')); assert(!C.model('deepseek','DeepSeek V4.1 Flash'));
    assert.equal(A.normalize(config('doubao','ep-user-owned')).model,'ep-user-owned');
    assert.equal(build('doubao','ep-user-owned').reasoning_effort,undefined);
});
test('DeepSeek has none/low/high/max, rejects unsupported xhigh',()=>{
    assert.deepEqual(C.reasoningOptions(config('deepseek','deepseek-flash')).map(x=>x[0]),['','none','low','high','max']);
    assert.equal(build('deepseek','deepseek-flash','max').reasoning_effort,'max');
    assert.equal(build('deepseek','deepseek-flash','none').reasoning_effort,'none');
    assert.throws(()=>build('deepseek','deepseek-flash','xhigh'),/不支持/);
});
test('Kimi model-specific effort versus thinking switch and always-on models',()=>{
    const k3=build('kimi','kimi-k3','high'); assert.equal(k3.reasoning_effort,'high'); assert(!k3.thinking);
    const k26=build('kimi','kimi-k2.6','disabled'); assert.deepEqual(k26.thinking,{type:'disabled'}); assert(!k26.reasoning_effort);
    assert.throws(()=>build('kimi','kimi-k3','disabled'),/不支持/);
    assert.throws(()=>build('kimi','kimi-k2.7-code','disabled'),/不支持/);
});
test('Xiaomi and Doubao use thinking.type, Qwen enable_thinking',()=>{
    for(const [p,m] of [['xiaomi','mimo-v2.6-flash'],['doubao','doubao-seed-2-1-lite-260915']]) {
        const b=build(p,m,'enabled'); assert.deepEqual(b.thinking,{type:'enabled'}); assert(!b.reasoning_effort);
    }
    const b=build('qwen','qwen3.8-flash','disabled'); assert.equal(b.enable_thinking,false); assert(!b.thinking); assert(!b.reasoning_effort);
    assert.equal(build('qwen','qwen3.8-27b','disabled').enable_thinking,false);
    assert.throws(()=>build('qwen','qwen3.8-2.4t-a95b','disabled'),/不支持/);
    assert.equal(C.model('qwen','qwen3.8-2.4t-a95b').vision,false);
    assert.equal(build('qwen','qwen3.8-omni-flash').reasoning_effort,undefined);
});
test('native OpenAI, Claude and Gemini use distinct effort locations',()=>{
    assert.deepEqual(build('openai','gpt-6-luna','max').reasoning,{effort:'max'});
    assert.throws(()=>build('openai','gpt-6-astra','none'),/不支持/);
    assert.deepEqual(build('openai','gpt-6-sol','none').reasoning,{effort:'none'});
    assert.throws(()=>build('openai','gpt-6.1-sol','none'),/不支持/);
    const claude=build('claude','claude-sonnet-5-5','xhigh'); assert.deepEqual(claude.output_config,{effort:'xhigh'}); assert(!claude.reasoning);
    assert.deepEqual(build('gemini','gemini-3.8-flash','medium').generationConfig.thinkingConfig,{thinkingLevel:'medium'});
});
test('aggregator capabilities belong to deployment, not copied from model name',()=>{
    assert.equal(build('siliconflow','zai-org/GLM-5.3','low').reasoning_effort,'low');
    assert.throws(()=>build('siliconflow','deepseek-ai/DeepSeek-V4-Pro','max'),/不支持/);
    assert.throws(()=>A.normalize({...config('deepseek','deepseek-flash','high'),protocol:'anthropic'}),/不支持/);
});
test('legacy unsupported effort resets while model and credential are retained',()=>{
    globalThis.GM_getValue=()=>config('kimi','kimi-k2.6','xhigh'); const c=A.load();
    assert.equal(c.model,'kimi-k2.6'); assert.equal(c.key,'fixture-key'); assert.equal(c.reasoning,'');
});


test('verified Doubao and Omni effort fields, aliases and hosted model boundaries',()=>{
    const seed='doubao-seed-2-1-pro-260915';
    for(const value of ['none','minimal','low','medium','high','xhigh','max']){
        const b=build('doubao',seed,value);assert.equal(b.reasoning_effort,value);assert(!b.thinking);
        const o=build('qwen','qwen3.8-omni-flash',value);assert.equal(o.reasoning_effort,value);assert(!o.enable_thinking);assert(!o.thinking_budget);
    }
    assert.deepEqual(build('doubao',seed,'disabled').thinking,{type:'disabled'});
    assert.equal(build('doubao','deepseek-v4-1-flash-260910','max').reasoning_effort,'max');
    assert.throws(()=>build('doubao','glm-5-3-flash-260828','none'),/不支持/);
    assert.equal(build('doubao','glm-5-3-flash-260828','low').reasoning_effort,'low');
    assert(C.model('qwen','xiaomi/mimo-v2.6-pro-ultraspeed').vision);
    assert.throws(()=>build('qwen','xiaomi/mimo-v2.6-pro-ultraspeed','enabled'),/不支持/);
});
