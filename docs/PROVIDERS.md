# AI 服务商配置

资料核对日期：2026-10-15。协议适配和账号实测是两回事：本项目使用模拟响应验证了请求/解析，不附带厂商账号，不声称所有模型均可用。服务、模型、地区和价格可能变动，优先使用你的控制台信息。

| 服务商 | 协议选择 | Base URL 示例 | 图片设置 |
| --- | --- | --- | --- |
| OpenAI | Responses（预设）或 Chat Completions | `https://api.openai.com/v1` | 仅视觉模型启用 |
| Claude | Claude Messages | `https://api.anthropic.com/v1` | 选择支持视觉的模型 |
| Gemini | Gemini generateContent | `https://generativelanguage.googleapis.com/v1beta` | 以模型能力为准 |
| DeepSeek | OpenAI Chat Completions | `https://api.deepseek.com/v1` | 预设关闭，实际视觉模型才开 |
| 小米 MiMo | OpenAI Chat Completions | `https://api.xiaomimimo.com/v1` | 预设关闭，选择图片理解模型后开启 |
| Kimi / Moonshot | OpenAI Chat Completions | `https://api.moonshot.cn/v1` | 以实际模型为准 |
| 智谱 GLM | OpenAI Chat Completions | `https://open.bigmodel.cn/api/paas/v4` | 视觉模型才开 |
| 通义千问/百炼 | OpenAI Chat Completions | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 视觉模型才开 |
| 豆包/火山方舟 | OpenAI Chat Completions | `https://ark.cn-beijing.volces.com/api/v3` | 按模型能力 |
| 硅基流动 | OpenAI Chat Completions | `https://api.siliconflow.cn/v1` | 按实际托管模型能力 |
| 其他兼容服务 | 对应协议 | 厂商给出的基础地址 | 按模型能力 |

模型 ID 一律从控制台复制。本项目不自动选择“最便宜/最强”的模型，也不向 `/models` 自动探测或替换模型。转发站和自建网关须自己确认可信性与协议。

## OpenAI

Responses 是独立协议，不是把 Chat Completions 地址改名。代码发送 `input_text/input_image`，读取 output 中的 output_text，并设置 `store:false`。Chat Completions 使用 messages 和 image_url。两者都支持按配置启用 JSON 模式；推理强度只在用户选择后发送，不保证所有模型接受 `xhigh`。

依据：[Chat API](https://developers.openai.com/api/reference/resources/chat)、[Responses API](https://developers.openai.com/api/reference/resources/responses)。

## Claude

原生 `/v1/messages` 使用 `x-api-key`、`anthropic-version: 2023-06-01`，图片作为 base64 image block。浏览器直连额外声明 direct-browser-access；这是用户主动在客户端保存 Key 的模式，不是服务器替你保管密钥。SDK、服务商网关和旧版本支持范围可能不同。

依据：[Claude Messages](https://platform.claude.com/docs/en/api/messages/create)。

## Gemini

原生 `/models/{model}:generateContent` 使用 parts 中的 inline_data，API Key 通过 `x-goog-api-key` 请求头发送。可选 JSON 模式对应 responseMimeType。解析时不把 thought 段当最终答案；被拦截或没有文本时停止。

依据：[Gemini generateContent](https://ai.google.dev/api/generate-content)。

## 国内兼容接口

DeepSeek 提供 OpenAI 兼容形式；不要因为兼容就假设任意模型都支持图片、JSON 或所有推理参数。[官方快速开始](https://api-docs.deepseek.com/)。

百炼支持兼容接口，但 Key、地域、业务空间、模型 ID 要匹配。上述 dashscope 兼容域名仍见官方说明；新账号优先从业务空间复制专属 Base URL，例如对应区域的 `{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`，不要把花括号示例直接粘进去。[官方配置](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)。

火山方舟使用控制台提供的 Model ID/接入点，Base URL 包含 `/api/v3`，脚本再追加 `/chat/completions`。[官方兼容说明](https://docs.volcengine.com/docs/ark/compatible-with-openai-sdk?lang=zh)。

## 小米 MiMo、Kimi、智谱与硅基流动

四家都有独立下拉预设，不必选自定义。模型 ID 仍需要用户填写，防止把按量、订阅、区域或模型能力混在一起。

- **小米 MiMo**：预设使用按量接口 `https://api.xiaomimimo.com/v1`；鉴权使用 `api-key`，输出上限字段使用 `max_completion_tokens`。小米也接受 Bearer，但本适配器采用其示例头。Token Plan 的 Key 与按量 Key/地址不同，不要混用；预设不代表套餐可用于任意场景。若使用另一个套餐地址，应先核对套餐允许的用途，再改 Base URL 并重新填 Key。依据：[小米官方 API 接入](https://mimo.mi.com/docs/zh-CN/quick-start/faq/api-integration)。
- **Kimi / Moonshot**：预设国内兼容地址；模型是否支持视觉、使用哪个区域/域名，以控制台和当前文档为准。API 文档可能重定向到新的 Kimi 平台域名，不要把文档域名当调用地址。依据：[Kimi Chat Completions](https://platform.moonshot.cn/docs/api/chat)。
- **智谱 GLM**：预设通用 `/api/paas/v4`；普通按量 API 与 Coding 专属端点不是同一用途。Bearer Key 从自己的控制台获取。依据：[智谱快速开始](https://docs.bigmodel.cn/cn/api/introduction)。
- **硅基流动**：预设兼容地址，模型名常包含组织/厂商前缀，应复制完整 ID。聚合平台提供模型不等于该平台的每个模型都支持图片。依据：[硅基流动 Chat Completions](https://docs.siliconflow.cn/docs/api/chat-completions-post)。

其他 OpenAI 兼容服务以及本地推理服务可选“自定义”。本版没有逐家账号实测，也不硬编码未经核对的模型列表。

## 费用与图文

API 模式由每位用户的 Key 所属服务商计费，可能包含文字输入、截图、输出和推理用量。脚本不承诺免费，不代收费用，网页会员通常不能替代独立的 API 凭据与账单配置。具体价格以厂商实际账单为准。

发送截图可能增加用量；关闭截图会只传 DOM 文字。遇到图片题或特殊字体乱码时纯文字暂停，要求启用截图并选视觉模型，不把图片占位文字当作完整题目。图片读取失败也不会调用模型或提交。平台反馈与之前的答案会作为最近几轮上下文，减少重复调用；完整已知答案重做时可以不调用模型。
