# 模型目录与推理设置

目录核对日期：**2026-10-18**。面板先选择服务商，再从“模型”下拉框选择准确 ID；列表末尾有 **没有我要的模型，手动填写**。原有自定义 ID 会自动进入手动填写模式，不会被换成另一个模型。

本目录收录已核实、适合文本或图文问答的模型，不包含语音合成、图像生成、向量嵌入和专用工具模型，也不是每个账号的实时可用列表。模型权限、地域、套餐、预览版与下线时间仍以服务商控制台为准。切换选项不会联网或产生 API 费用；“测试 AI”和实际答题可能计费。

## 各服务商目录与来源

| 服务商 | 本次核查与收录范围 | 官方来源 |
| --- | --- | --- |
| OpenAI | GPT-6 Astra、6.1 Sol、6 Sol、6 Luna；使用 API ID，不使用 Codex 界面里的显示名称 | [模型目录](https://developers.openai.com/api/docs/models)、[GPT-6 参数](https://developers.openai.com/api/docs/guides/latest-model) |
| Claude | Fable 5.1、Opus/Sonnet/Haiku 5.5 | [模型 ID](https://platform.claude.com/docs/en/models/overview)、[effort](https://platform.claude.com/docs/en/build-with-claude/effort) |
| Gemini | 当前 Flash 与 Flash-Lite、仍列出的 Pro/Flash 预览版和 2.5 系列；旧账号限制见官方说明 | [模型目录](https://ai.google.dev/gemini-api/docs/models)、[思考参数](https://ai.google.dev/gemini-api/docs/thinking) |
| DeepSeek | `deepseek-flash`、`deepseek-v4-pro`；Flash 为当前官方调用别名 | [首次调用](https://api-docs.deepseek.com/zh-cn/)、[请求参数](https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/) |
| 小米 MiMo | V2.6 Pro、Flash、Pro UltraSpeed；即将下线的 2.5 系列不作为快捷选项 | [模型目录](https://mimo.mi.com/docs/en-US/quick-start/model)、[Chat API](https://mimo.mi.com/docs/zh-CN/api/chat/openai-api) |
| Kimi | K3、K2.6、K2.7 Code 及高速版；不再列出已下线的 K2.5/moonshot-v1 | [模型目录](https://platform.kimi.com/docs/models)、[思考模式](https://platform.kimi.com/docs/guide/use-thinking-models)、[K3 强度](https://platform.kimi.com/docs/guide/use-reasoning-effort) |
| 智谱 GLM | `glm-5.3`、`glm-5.3-flash`、`glm-5.3-flashx`；Flash/FlashX 原生支持图片，参数与 5.3 一致，不能关闭思考，需匹配 API 权限 | [国内目录](https://docs.bigmodel.cn/cn/guide/models)、[GLM-5.3 官方说明](https://docs.z.ai/guides/llm/glm-5.3) |
| 千问 / 百炼 | 已核实的 3.8/3.7/3.6/3.5 系列和 VL；托管第三方模型可手填 | [模型大全](https://help.aliyun.com/zh/model-studio/models)、[模型范围](https://help.aliyun.com/zh/model-studio/batch-inference)、[深度思考](https://help.aliyun.com/zh/model-studio/deep-thinking/) |
| 豆包 / 火山方舟 | 当前 Seed 2.1 Pro/Lite/Turbo、Evolving 和 2.0 Lite；专属 `ep-` 接入点使用手动填写 | [模型目录](https://docs.volcengine.com/docs/ark/model-list?lang=zh)、[深度思考](https://docs.volcengine.com/docs/ark/deep-thinking?lang=zh) |
| 硅基流动 | 已核实的 GLM、DeepSeek、Kimi、Qwen 托管 ID；保留组织前缀，不与原厂 ID 混用。国际与国内目录可能不同 | [调整公告](https://docs.siliconflow.cn/docs/release-notes/overview)、[GLM-5.3 部署说明](https://www.siliconflow.com/zh-tw/blog/glm-5.3-now-live-on-siliconflow) |

目录和具体 ID 保存在 [src/models.cjs](../src/models.cjs)，随脚本版本更新。服务商页面无法成功读取的部分会注明，不宣称全部型号均已核实或实测。

## 推理设置怎样适配

默认选择 **使用模型默认值（建议）**，不额外发送推理参数。高强度可能占用更多输出预算、增加费用和等待时间，不保证答案更正确。

| 服务商 / 模型 | 可选设置 | 实际请求参数 |
| --- | --- | --- |
| OpenAI 当前 GPT-6 | low / medium / high / xhigh / max；Luna 另有 none | Responses 的 `reasoning.effort`，或 Chat 的 `reasoning_effort` |
| Claude 当前目录模型 | low / medium / high / xhigh / max | 原生 Messages 的 `output_config.effort` |
| Gemini 3.8 Flash | low / medium / high | `generationConfig.thinkingConfig.thinkingLevel` |
| DeepSeek 当前目录模型 | none / low / high / max | `reasoning_effort`，none 表示关闭思考 |
| 小米 V2.6 | 开启 / 关闭思考 | `thinking.type`，不发送 xhigh |
| Kimi K3 | low / high / max | `reasoning_effort`，不能关闭思考 |
| Kimi K2.6 | 开启 / 关闭思考 | `thinking.type` |
| Kimi K2.7 Code | 服务商默认值 | 始终思考，不发送关闭参数 |
| 智谱 GLM-5.3 / Flash / FlashX | low / high / max | `reasoning_effort`，不能关闭思考 |
| 当前目录的千问混合思考模型 | 开启 / 关闭思考 | 顶层 `enable_thinking` 布尔值 |
| 当前目录的豆包模型 | 开启 / 关闭思考 | `thinking.type`；不套用另一套 Managed Agents API 的强度枚举 |
| 硅基流动 GLM-5.3 | low / high / max | 平台部署支持的 `reasoning_effort` |
| 其他未核实模型、不同协议组合 | 服务商默认值 | 不猜测兼容参数 |
| 自定义 Chat / Responses | 通用强度选项 | 由使用者确认网关支持范围 |
| 本地 Codex | 在连接服务中设置 | 面板不覆盖 CLI 模型或推理强度 |

更换模型、服务商或协议时会刷新选项并回到默认值；不会把上一家的 xhigh 自动带给下一家。旧版本保存了不兼容强度时，沿用模型和密钥，仅恢复推理默认值。

需要截图时，请核对模型图片能力。已核实能力的快捷选项会同步截图开关；手动模型不会被擅自推断为视觉模型。即使目录标注支持图片，账号权限和输入格式仍可能限制调用。
