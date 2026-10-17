# AI 服务商配置

以下地址资料核对于 2026-10-15。先在服务商控制台创建 API Key，再复制账号可用的模型 ID 和接口地址。模型、地区和价格可能变化，请以控制台当前信息为准。脚本已用模拟请求测试协议，但尚未逐一验证真实账号和所有模型，也不提供服务商账号。

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

模型 ID 请从控制台完整复制。脚本不会请求 `/models` 获取列表，也不会自动挑选或更换模型。使用转发站或自建网关前，请确认它可信且支持所选协议。

## OpenAI

面板默认使用 Responses，也可以改选 Chat Completions。请按模型支持的协议选择；两种请求格式不能互换。

Responses 使用 `input_text/input_image`，读取 output 中的 output_text，并设置 `store:false`；Chat Completions 使用 messages 和 image_url。两者都可以按设置发送 JSON 模式参数。推理强度默认不发送，手动选择前请确认模型支持，尤其是 `xhigh`。

依据：[Chat API](https://developers.openai.com/api/reference/resources/chat)、[Responses API](https://developers.openai.com/api/reference/resources/responses)。

## Claude

选择“Claude Messages”，填写模型 ID 和自己的 API Key。脚本使用原生 `/v1/messages`，请求头包含 `x-api-key`、`anthropic-version: 2023-06-01`，图片以 base64 image block 发送。

浏览器直连还会声明 direct-browser-access。Key 保存在自己的浏览器中，项目没有代管密钥的服务器。使用网关或旧版接口时，需要另外确认支持范围。

依据：[Claude Messages](https://platform.claude.com/docs/en/api/messages/create)。

## Gemini

选择“Gemini generateContent”，填写模型 ID 和 API Key。请求使用原生 `/models/{model}:generateContent`，图片放在 parts 的 inline_data 中，Key 通过 `x-goog-api-key` 请求头发送。

开启 JSON 模式时会设置 responseMimeType。脚本只读取最终文本，不把 thought 段当答案；响应被拦截或没有可用文本时停止。

依据：[Gemini generateContent](https://ai.google.dev/api/generate-content)。

## 国内兼容接口

DeepSeek 选择 OpenAI Chat Completions。图片输入、JSON 和推理参数是否可用，仍需核对具体模型，不能只看接口兼容性。[官方快速开始](https://api-docs.deepseek.com/)。

百炼的 Key、地域、业务空间和模型 ID 需要相互匹配。表中的 dashscope 地址是兼容接口示例；新账号可优先从业务空间复制专属 Base URL。若文档给出 `{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` 一类格式，需要替换工作空间 ID，并核对区域，不能直接粘贴带花括号的示例。[官方配置](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)。

火山方舟请填写控制台提供的 Model ID 或接入点 ID。Base URL 保留 `/api/v3`，脚本会自动追加 `/chat/completions`。[官方兼容说明](https://docs.volcengine.com/docs/ark/compatible-with-openai-sdk?lang=zh)。

## 小米 MiMo、Kimi、智谱与硅基流动

这四家都可以在服务商下拉框直接选择。选好后仍需填写模型 ID，并核对账号套餐、接口区域及图片能力。

- **小米 MiMo**：预设使用按量接口 `https://api.xiaomimimo.com/v1`；鉴权使用 `api-key`，输出上限字段使用 `max_completion_tokens`。小米也接受 Bearer，但脚本使用官方示例中的请求头。Token Plan 的 Key 与按量 Key/地址不同，不要混用；具体用途仍受套餐规则限制。若使用另一个套餐地址，应先核对套餐允许的用途，再改 Base URL 并重新填 Key。依据：[小米官方 API 接入](https://mimo.mi.com/docs/zh-CN/quick-start/faq/api-integration)。
- **Kimi / Moonshot**：预设国内兼容地址；模型是否支持视觉、使用哪个区域/域名，以控制台和当前文档为准。API 文档可能重定向到新的 Kimi 平台域名，不要把文档域名当调用地址。依据：[Kimi Chat Completions](https://platform.moonshot.cn/docs/api/chat)。
- **智谱 GLM**：预设通用 `/api/paas/v4`；普通按量 API 与 Coding 专属端点不是同一用途。Bearer Key 从自己的控制台获取。依据：[智谱快速开始](https://docs.bigmodel.cn/cn/api/introduction)。
- **硅基流动**：预设兼容地址，模型名常包含组织/厂商前缀，应复制完整 ID。聚合平台提供模型不等于该平台的每个模型都支持图片。依据：[硅基流动 Chat Completions](https://docs.siliconflow.cn/docs/api/chat-completions-post)。

其他 OpenAI 兼容服务或电脑上的推理服务，可选择“自定义”，手动填写协议和地址。模型 ID 由用户填写；项目没有固定模型列表，也尚未逐家完成账号实测。

## 费用与图文

API 费用由 Key 所属服务商收取，可能包括文字输入、截图、输出和推理用量。项目不代收费用。聊天网页会员通常不包含 API 余额，请在开发者控制台单独核对计费方式。

开启截图可能增加用量；关闭后只发送从页面读取的文字。图片题或特殊字体无法用纯文字处理时，脚本会暂停，要求启用截图并选择视觉模型。图片读取失败也会停止，不调用模型或提交。

再次作答时，脚本会参考最近几轮的平台反馈和答案。如果已经掌握全部平台正确答案，重做时可以直接填写，省去模型请求。
