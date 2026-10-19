/* Official model catalog. Refresh sources and capabilities before every release. */
(function (root) {
    'use strict';
    const verifiedAt = '2026-10-19', release = '1.0.14';
    const rows = (ids, profile = '', vision = null) => ids.map(id => ({ id, profile, vision }));
    const providers = {
        openai: { sources: ['https://developers.openai.com/api/docs/models','https://developers.openai.com/api/docs/guides/latest-model','https://developers.openai.com/api/docs/models/gpt-6-sol'], models: rows(['gpt-6-astra','gpt-6.1-sol'], 'openai', true).concat(rows(['gpt-6-sol','gpt-6-luna'], 'openai-none', true)) },
        claude: { sources: ['https://platform.claude.com/docs/en/models/overview','https://platform.claude.com/docs/en/build-with-claude/effort'], models: rows(['claude-fable-5-1','claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5'], 'claude', true) },
        gemini: { sources: ['https://ai.google.dev/gemini-api/docs/models','https://ai.google.dev/gemini-api/docs/thinking'], models: rows(['gemini-3.8-flash'], 'gemini', true).concat(rows(['gemini-4-argon'], '', true), rows(['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-pro-preview','gemini-3-flash-preview','gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite'], '', true)), note: '预览版可能变更；2.5 系列仅部分已有账号可用。' },
        deepseek: { sources: ['https://api-docs.deepseek.com/zh-cn/','https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/'], models: rows(['deepseek-flash'], 'deepseek', true).concat(rows(['deepseek-v4-pro'], 'deepseek', false)) },
        xiaomi: { sources: ['https://mimo.mi.com/docs/en-US/quick-start/model','https://mimo.mi.com/docs/zh-CN/api/chat/openai-api'], models: rows(['mimo-v2.6-pro','mimo-v2.6-flash','mimo-v2.6-pro-ultraspeed'], 'thinking', true), note: 'UltraSpeed 需相应权限；即将下线的 2.5 系列不列入快捷选项。' },
        kimi: { sources: ['https://platform.kimi.com/docs/models','https://platform.kimi.com/docs/guide/use-thinking-models','https://platform.kimi.com/docs/guide/use-reasoning-effort','https://www.kimi.com/help/kimi-api/api-troubleshooting'], models: rows(['kimi-k3'], 'effort-three', true).concat(rows(['kimi-k2.6'], 'thinking', true), rows(['kimi-k2.7-code','kimi-k2.7-code-highspeed'], '', true)), note: 'K3 和 K2.7 Code 始终思考；K2.6 可关闭思考。' },
        zhipu: { sources: ['https://docs.bigmodel.cn/cn/guide/models','https://docs.z.ai/guides/llm/glm-5.3'], models: rows(['glm-5.3'], 'effort-three', false).concat(rows(['glm-5.3-flash','glm-5.3-flashx'],'effort-three',true)), note: '国内与国际平台权限、套餐及上线范围可能不同；FlashX 需相应 API 权限。' },
        qwen: { sources: ['https://help.aliyun.com/zh/model-studio/models','https://help.aliyun.com/zh/model-studio/batch-inference','https://help.aliyun.com/zh/model-studio/deep-thinking/','https://help.aliyun.com/zh/model-studio/text-generation','https://help.aliyun.com/zh/model-studio/newly-released-models','https://help.aliyun.com/zh/model-studio/model-depreciation','https://help.aliyun.com/zh/model-studio/qwen-omni'], models: rows(['qwen3.8-max','qwen3.8-flash','qwen3.8-27b','qwen3.7-plus','qwen3.7-flash','qwen3.6-plus','qwen3.6-flash','qwen3.5-plus','qwen3.5-flash'], 'qwen', true).concat(rows(['qwen3.8-2.4t-a95b'], '', false), rows(['qwen3.8-omni-flash'], 'qwen-omni', true), rows(['xiaomi/mimo-v2.6-pro-ultraspeed'], '', true), rows(['qwen3.7-max'], 'qwen', null), rows(['qwen3-vl-plus','qwen3-vl-flash'], '', true)), note: '需匹配百炼地域和业务空间；2.4T 仅思考；Omni 强度存在服务端映射；托管 MiMo 暂用推理默认值，需匹配地域权限。' },
        doubao: { sources: ['https://docs.volcengine.com/docs/ark/model-list?lang=zh','https://docs.volcengine.com/docs/ark/deep-thinking?lang=zh','https://docs.volcengine.com/docs/ark/model-release-announcement?lang=zh'], models: rows(['doubao-seed-evolving','doubao-seed-2-1-pro-260915','doubao-seed-2-1-lite-260915','doubao-seed-2-1-pro-260628','doubao-seed-2-1-turbo-260628','doubao-seed-2-0-lite-260428'], 'doubao', true).concat(rows(['deepseek-v4-1-flash-260910'], 'deepseek', true), rows(['glm-5-3-flash-260828'], 'effort-three', true)), note: '需先开通模型；专属 ep- 接入点请选择手动填写。Seed 支持思考开关及强度；none/minimal 关闭思考，xhigh/max 映射 high。托管模型按各自参数映射。' },
        siliconflow: { sources: ['https://docs.siliconflow.cn/docs/release-notes/overview','https://www.siliconflow.com/zh-tw/blog/glm-5.3-now-live-on-siliconflow'], models: rows(['zai-org/GLM-5.3'], 'effort-three', false).concat(rows(['deepseek-ai/DeepSeek-V4-Pro','deepseek-ai/DeepSeek-V3.2','Pro/deepseek-ai/DeepSeek-V3.2','Pro/moonshotai/Kimi-K2.6','Pro/zai-org/GLM-5.1','Qwen/Qwen3.6-27B','Qwen/Qwen3.6-35B-A3B'])), note: '聚合平台目录随时调整；国内/国际目录和权限可能不同，未列出的完整组织/模型 ID 可手动填写。' },
        custom: { sources: [], models: [], note: '自建服务或中转站请填写该服务实际提供的模型 ID，并核对它支持的参数。' },
        codex: { sources: [], models: [], note: '模型和推理强度由本地 Codex 服务配置，面板不覆盖 CLI 设置。' }
    };
    const levels = {
        openai: ['low','medium','high','xhigh','max'], 'openai-none': ['none','low','medium','high','xhigh','max'],
        claude: ['low','medium','high','xhigh','max'], gemini: ['low','medium','high'], deepseek: ['none','low','high','max'],
        'qwen-omni': ['none','minimal','low','medium','high','xhigh','max'], doubao: ['enabled','disabled','none','minimal','low','medium','high','xhigh','max'],
        'effort-three': ['low','high','max'], thinking: ['enabled','disabled'], qwen: ['enabled','disabled'], generic: ['none','low','medium','high','xhigh','max']
    };
    const labels = {minimal:'最低（minimal）',none:'关闭思考（none）',low:'低（low）',medium:'中（medium）',high:'高（high）',xhigh:'极高（xhigh）',max:'最高（max）',enabled:'开启思考',disabled:'关闭思考'};
    function model(provider, id) { return providers[provider]?.models.find(item => item.id === id); }
    function reasoningProfile(c) {
        if (c.protocol === 'codex') return '';
        // A different wire protocol is not evidence that a vendor accepts the same knobs.
        const protocols = {openai:['chat','responses'],claude:['anthropic'],gemini:['gemini']};
        if (c.provider === 'custom') return ['chat','responses'].includes(c.protocol) ? 'generic' : '';
        if (!(protocols[c.provider] || ['chat']).includes(c.protocol)) return '';
        return model(c.provider,c.model)?.profile || '';
    }
    function reasoningOptions(c) { return [['','使用模型默认值（建议）'], ...(levels[reasoningProfile(c)] || []).map(value => [value,labels[value]])]; }
    const api = {verifiedAt,release,providers,levels,model,reasoningProfile,reasoningOptions};
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.XxtModelCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
