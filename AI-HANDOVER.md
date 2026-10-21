# QQ 陪伴机器人 · AI 交接入口

项目名称：**QQ 陪伴机器人（qqbot）**
当前阶段：**停机归档；最后已知状态来自本机记录，未作实时服务器核对**。

## 阅读顺序

- 先读 [PROJECT-STATUS.md](PROJECT-STATUS.md)，了解资料范围和最后已知状态。
- 从公开 Git 重建干净实例见 [docs/rebuild.md](docs/rebuild.md)。
- 组件版本见 [docs/dependencies.lock.md](docs/dependencies.lock.md)，架构与数据边界见 [MIGRATION.md](MIGRATION.md)。
- 角色基线见 [docs/persona-baseline.md](docs/persona-baseline.md)，脱敏配置结构见 [docs/config-snapshot/](docs/config-snapshot/)。
- 历史方案摘要见 [docs/00-context.md](docs/00-context.md)。

## 操作边界

- 除非所有者明确要求恢复，否则不要启动、重启或启用机器人服务，不要连接远程服务器，不要触发会产生费用的模型请求，也不要发送 QQ 消息。
- 新环境的服务器地址、账号、凭据和服务状态必须重新确认。不要将任何旧运行配置直接覆盖到新环境。
- QQ 登录态、聊天记录、记忆、运行数据库、模型凭据、SSH 私钥、面板令牌、日志和完整备份应由所有者单独保管，不进入公开 Git。
- 固定版本的上游插件在重建时下载；不要复制许可证不明确的第三方插件源码。
