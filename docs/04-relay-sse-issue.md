# 04 · 中转站 SSE 缺失空行导致工作台报 “malformed server-sent event JSON”

> 记录时间：2026-10-21。现象：DeepSeek Harness 工作台选「中转 DeepSeek」时，运行一回合就报
> `Error reading response: malformed server-sent event JSON.`；换成官方 DeepSeek 正常。

## 一句话结论

**工作台没坏，是接口返回的流格式不合规。** 中转站 `<PROVIDER_HOST>` 的
`deepseek-v4.1-flash` 这条线路，**SSE 每个 `data:` 行之间只有单个换行、没有空行**。
按 SSE 规范，空行才是“一个事件结束、可以派发”的分隔符；缺少空行会让整条流被当成
**一个**事件，多个 `data:` 字段被拼成一段以 `\n` 连接的文本，于是 `JSON.parse` 必然失败，
工作台内置的 OpenAI SDK 就把这个解析失败原样报成上面那句错误。

同一中转站的 `gpt-6.1-sol` 线路格式是正常的（有空行），所以“同一个中转站，有的模型能用”。

## 证据（可复现）

1. **复现率 100%**：用工作台内置的同一个 `openai` SDK（v7.19.0）+ 同一中转
   `deepseek-v4.1-flash`，`stream: true` 连续 8 次，8 次全部报原文错误。
2. **对照组**：官方 `https://api.deepseek.com/v1` + `deepseek-flash` 连续 3 次全部成功。
3. **原始字节**（直接抓上游响应，未经任何改写）：

   | 线路 | 事件间空行数 | 结果 |
   |---|---|---|
   | 中转 `deepseek-v4.1-flash` | 0 | 解析失败 |
   | 中转 `gpt-6.1-sol` | 25 | 正常 |
   | 官方 `deepseek-flash` | 66 | 正常 |

   中转那条的响应开头长这样（注意全是单换行）：

   ```
   : heartbeat
   data: {"choices":[{"delta":{"role":"assistant"}...}]}
   data: {"choices":[{"delta":{"reasoning_content":"The"}...}]}
   data: {"choices":[{"delta":{"reasoning_content":" user"}...}]}
   ```

   而正常线路是 `data: {...}\n\ndata: {...}\n\n...`。
4. **反证修复有效**：在客户端只做一件事——把缺失的空行补回去
   （`\ndata:` → `\n\ndata:`），同一个 SDK 立刻恢复正常，3/3 全部成功。
   这证明问题就在“空行缺失”，不在工作台其他地方。
5. 错误字符串来源已定位到工作台安装包内的 `openai/core/streaming.js`（第 113、131 行），
   触发条件就是 `JSON.parse(sse.data)` 抛异常后原样转成该 `SyntaxError`。

## 附带发现（同一中转站）

- `free-luna` / `month-luna` / `balance-luna`（`gpt-6-luna`）目前直接返回 **HTTP 502**，
  这是线路本身不可用，与本次报错无关，但说明中转站整体质量不稳。
- 该线路是**推理型**：内容先走 `reasoning_content`，`stream:false` 时正文可能在
  `message.content` 里为空。对不支持 `reasoning_content` 的客户端也不友好。

## 影响面

- **DeepSeek Harness 工作台**：选这条中转线路就会随机/稳定报错；换官方 DeepSeek 正常。
- **QQ 陪伴机器人**：**不受影响**。自建网关 `gateway/main.py` 对上游固定 `stream: false`
  （见该文件 `call_openai()`），从不消费 SSE，所以这个格式缺陷打不到它。
  它自己的 `/v1/chat/completions` 即使被要求 `stream:true`，也只是把整段内容包成一个
  合法 chunk 再补 `[DONE]`，格式是合规的。

## 怎么解决

按推荐顺序：

1. **最简单**：工作台里把模型切回 **官方 DeepSeek**（现在已经在用，正常）。
2. **要用中转就把问题丢回给中转站**：这是它的 bug，一句话就能说清——
   “你们的 SSE 流每个 `data:` 之间缺少空行（`\n\n`），不符合 `text/event-stream`
   规范，所有按规范解析的客户端（OpenAI SDK、浏览器 EventSource、LangChain 等）都会报错；
   同站点的 `gpt-6.1-sol` 是正常的，请对照修 `deepseek-v4.1-flash` 这条线路。”
3. **必须用中转又等不及对方修**：本地起一个“补空行”的小代理（本次验证用的就是它），
   工作台把 base URL 指到本地代理即可；代价是多一个常驻进程。
4. **不建议**直接改工作台安装目录里的 `app.asar`：安装包有签名/自动更新，改完容易被覆盖，
   而且会把“上游不合规”伪装成“本地能跑”，下次换机器又踩一遍。

## 复现脚本（诊断用，非项目代码）

- 使用工作台同款 SDK 调用兼容端点并统计失败率。
- 使用本地抓包代理检查上游原始 SSE 帧和 JSON 结构。
- 使用本地代理补齐事件分隔符并比较修复前后的解析结果。

> 密钥只从 `secrets/model_config.json` 读进环境变量，不落日志；本文不记录任何 key。
