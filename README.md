# QQ 陪伴机器人（qqbot）

QQ 私聊 AI 陪伴机器人「大肥鱼」的源码与重建资料，包含 Windows 控制台、模型网关、服务器辅助脚本和配置示例。

项目目前处于停机归档阶段。最后一条本机交接记录称三个机器人服务已停止并关闭开机自启；本次整理没有连接服务器复核，所以这不是实时运行状态。

## 从哪里开始

1. [PROJECT-STATUS.md](PROJECT-STATUS.md)：归档范围和最后已知状态。
2. [AI-HANDOVER.md](AI-HANDOVER.md)：项目阅读顺序与操作边界。
3. [docs/rebuild.md](docs/rebuild.md)：只使用公开 Git 资料重建干净实例。
4. [docs/dependencies.lock.md](docs/dependencies.lock.md)：外部组件固定版本和上游提交。
5. [docs/persona-baseline.md](docs/persona-baseline.md)：当前陪伴角色的可重建基线。
6. [MIGRATION.md](MIGRATION.md)：系统结构、数据边界和交接要点。
7. [docs/config-snapshot/](docs/config-snapshot/)：结构示例；不是可直接部署的完整配置。

## 目录

- `desktop/`：Windows Electron 控制台。连接信息、QQ 号和私钥路径需由使用者自行填写。
- `gateway/`：基于 Python 标准库的 OpenAI 兼容模型网关。
- `life-engine/`：早期生活系统插件，保留为开发参考；当前归档快照使用上游陪伴插件。
- `server/`：辅助脚本、systemd 模板、示例配置和固定版本依赖获取脚本。
- `docs/`：重建说明、脱敏配置、架构记录、版本清单和已知问题。

## Windows 控制台

需要 Node.js 22.12.0 或更新的 22.x 版本。依赖已固定在 `desktop/package-lock.json`：

```powershell
cd desktop
npm ci
npm start
```

首次连接前，在控制台设置页填写新环境的服务器地址、SSH 用户、私钥路径和 QQ 账号。仓库没有这些连接资料。

## 数据和重建边界

本公开仓库保存源码、脱敏示例、依赖版本和重建说明。重新搭建的是干净实例：需要自行提供模型服务凭据、QQ 登录和角色资料。历史聊天、长期记忆、运行数据库、QQ 登录态及完整备份不会从 Git 恢复。

本仓库当前没有声明开源许可证；公开可见不等于授予复制、修改或再发布许可。第三方插件按固定上游提交获取，没有把未明确声明许可证的上游源码复制进本仓库。重建流程见 [docs/rebuild.md](docs/rebuild.md)。

