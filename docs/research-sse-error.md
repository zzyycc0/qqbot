# OpenAI Node SDK SSE 错误研究

日期：2026-10-21

## 结论

`Error reading response: malformed server-sent event JSON.` 是 OpenAI Node SDK 在**已经按 SSE 事件分帧后，对某个事件的 `data` 字段执行 `JSON.parse()` 失败**时主动抛出的 `SyntaxError`。它不是“网络断开”这一类错误，也不是普通 JSON 响应解析失败。

因此，只要 OpenAI 兼容代理在 `stream: true` 时发送了一个已结束的 SSE 事件块，其中 `data:` 的拼接结果不是完整合法 JSON，就会触发该错误。常见触发内容包括：

- `data: {"choices":[...` 被截断，字符串/对象没有闭合；
- `data: OK`、`data: upstream error`、HTML 错误页或网关文本被当作 SSE 数据发送；
- 一个事件块包含多行 `data:`，拼接后不是合法 JSON；
- 代理把心跳、日志、错误对象混入 `data:` 行。纯注释心跳（例如 `: heartbeat`）按 SSE 规范应被忽略，不会单独触发该 JSON 错误。

## OpenAI Node SDK 的精确行为

当前 DeepSeek Harness 安装包内的 `openai` 实现位于 `dsh/node_modules/openai/core/streaming.mjs`。其 `Stream.fromSSEResponse()` 逐事件读取 `_iterSSEMessages()` 的结果：遇到 `[DONE]` 结束；对每个普通事件或命名事件执行 `JSON.parse(sse.data)`；`JSON.parse` 失败时记录诊断并抛出精确错误文本。

源码：

- OpenAI Node SDK（当前工作台随附源码，安装包解包后的对应实现）：[`streaming.mjs`](../../_dsh_extract/dsh/node_modules/openai/core/streaming.mjs#L95-L131)
- `_iterSSEMessages` 先按 SSE 行和空行组装完整事件，再交给上层 JSON 解析：[`streaming.mjs`](../../_dsh_extract/dsh/node_modules/openai/core/streaming.mjs#L475-L535)
- SSE 解码器只把 `data:` 字段加入数据缓冲；以 `:` 开头的行被视为注释并忽略；同一事件的多条 `data:` 会用换行连接：[`streaming.mjs`](../../_dsh_extract/dsh/node_modules/openai/core/streaming.mjs#L595-L644)

关键逻辑等价于：

```js
for await (const sse of messages) {
  if (sse.data === '[DONE]') break;
  try {
    const data = JSON.parse(sse.data);
    yield data;
  } catch {
    throw new SyntaxError(
      'Error reading response: malformed server-sent event JSON.'
    );
  }
}
```

这说明工作台/SDK 的报错位置是明确的：它已经收到了 HTTP 流，并且已经识别出 SSE 事件；失败点是事件 `data` 的 JSON 内容。单纯的连接超时、HTTP 非 200、错误的 `Content-Type` 会走其他错误路径。

## SSE 标准要求

WHATWG HTML Standard 定义 `text/event-stream` 的格式：事件由字段行组成，事件之间以空行结束；字段可为 `event:`、`data:`、`id:`、`retry:`，以冒号开头的行是注释；事件流必须使用 UTF-8。`data` 字段可以出现多次，客户端会按顺序拼接并在每个字段之间加入换行。未以空行结束的 EOF 事件通常不会派发给浏览器 EventSource。

来源：

- WHATWG HTML Standard，SSE 格式、字段和 UTF-8 要求：[Parsing an event stream](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream)
- WHATWG HTML Standard，事件流逐行解释和 `data` 多行拼接：[Interpreting an event stream](https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation)
- WHATWG HTML Standard，HTTP 响应必须为 200 且 `Content-Type` 为 `text/event-stream`：[EventSource processing model](https://html.spec.whatwg.org/multipage/server-sent-events.html#sse-processing-model)

对 OpenAI 兼容代理来说，建议每个流式 chunk 使用一个完整事件块，并保证：

```text
data: {"id":"...","object":"chat.completion.chunk","choices":[...]}

```

结束时发送：

```text
data: [DONE]

```

心跳应使用注释格式：

```text
: heartbeat

```

不要发送 `data: heartbeat`，因为 OpenAI Node SDK 会尝试把 `heartbeat` 当 JSON 解析。

## 对当前中转接口的验证意义

对当前配置的中转地址（此处不记录任何密钥）做了独立请求验证：

- `POST /v1/chat/completions`、`stream: false` 返回 `application/json`，可被正常读取；
- 同一接口、`stream: true` 返回 `text/event-stream`，响应包含 `: heartbeat` 注释、合法 JSON chunk、最后的 `data: [DONE]`；这些帧符合上面的解析规则，单次短请求没有复现错误。

因此这次错误不能仅凭错误文本判定为工作台坏了。更可能是中转服务在某次长响应、上游异常、代理超时或连接中断时输出了一个非 JSON 的 `data:` 事件；工作台使用的 OpenAI SDK 随后按设计报错。也仍存在工作台上游 SDK 对异常帧诊断不足的问题，但当前错误本身指向收到的 SSE 数据不合法。

## 兼容性建议

兼容 OpenAI Node SDK 的代理应：

1. 返回 HTTP 200、`Content-Type: text/event-stream`，并使用 UTF-8。
2. 每个 `data:` 事件块都发送完整 JSON；不要把普通文本、HTML、反向代理错误页或日志写进 `data:`。
3. 使用规范的空行分隔事件；不要依赖 TCP chunk 边界，客户端必须允许一个 JSON 事件跨多个网络 chunk。
4. 心跳使用 `: comment`，不要使用非 JSON 的 `data:` 心跳。
5. 正常结束发送独立的 `data: [DONE]` 事件；在上游错误时，保持事件数据仍为合法 JSON，或先返回明确的 HTTP 错误而不要伪装成成功 SSE 流。
6. 保留并转发 OpenAI 风格的 `choices[].delta`、`finish_reason` 等字段，避免在流中混入供应商私有文本。
7. 对代理/网关关闭会破坏长连接的缓冲、压缩或超时策略；WHATWG 还特别提示 HTTP chunking 和缓冲层可能影响 SSE 可靠性。[Authoring notes](https://html.spec.whatwg.org/multipage/server-sent-events.html#authoring-notes)

## 排查步骤

在客户端开发者工具或中转服务器日志中捕获失败请求的原始响应，重点查看最后一个正常事件之后的完整 `data:` 块。可用下面的判断：

- 如果失败块是 `data: <非 JSON 文本>`、HTML、截断 JSON：中转站/其上游或代理输出不兼容；切换到非流式、换模型/备用线路，或要求中转修复 SSE。
- 如果原始 HTTP 响应本身是合法 SSE，而工作台仍报错：保存该原始响应并用同版本 `openai` SDK 重放；再考虑工作台版本/SDK 回归。
- 纯 `: heartbeat` 不应导致这个错误；若它导致错误，说明中转端实际把它作为 `data:` 发送，或捕获的原始内容与显示内容不一致。

本文件未记录 API key、Authorization 值或其他凭据。
