# 从公开 Git 重建干净实例

本文记录一套从仓库重新搭建的方法。本次整理没有安装依赖、连接服务器、启动服务或调用模型。

## Git 可以提供什么

仓库含 Windows Electron 控制台、Python 模型网关、服务器辅助脚本、systemd 模板、脱敏配置结构、固定依赖和项目说明。它不含 QQ 登录态、QQ 绑定、对话、长期记忆、运行数据库、模型凭据、SSH 私钥、面板令牌、日志或完整备份。因此重建结果是干净的新实例。

## 1. 准备服务器并克隆

准备兼容的 Ubuntu 24.04 x86_64 服务器，安装 Git、Python 3.12、Xvfb、中文字体及 Linux QQ 所需系统库。开始前根据计划运行的 QQ 客户端、AstrBot 与插件重新核对 CPU、内存和磁盘容量。

```bash
sudo git clone https://github.com/zzyycc0/qqbot.git /opt/qqb
sudo mkdir -p /opt/qqb/data /opt/qqb/logs
```

仓库目录中的 `gateway/`、`server/` 和 `docs/` 保存项目源码和操作资料。不要把本机私密目录或完整备份复制进仓库。

## 2. 获取固定组件

查看 [dependencies.lock.md](dependencies.lock.md) 后运行：

```bash
sudo bash /opt/qqb/server/fetch_dependencies.sh
```

该脚本下载固定版本的 AstrBot 和上游插件源码，不安装依赖、不启动服务，也不请求模型。随后按 AstrBot 和每个插件的说明建立 Python 3.12 环境并安装依赖。上游依赖未全部锁定，未来解析结果可能变化。

## 3. 安装 QQ 客户端并扫码

Linux QQ 客户端不属于本仓库。所有者应从可信的官方来源取得与所固定 NapCat 版本兼容的 Linux QQ 包，再按上游文档安装。首次使用时由所有者扫码登录；不要从旧备份导入登录态。`server/napcat-start.sh` 支持扫码启动；如需设置快速登录参数，参考 `server/napcat.env.example`，真实值只放在服务器上。

## 4. 配置网关和插件

将 [server/model_config.example.json](../server/model_config.example.json) 复制到服务器数据目录，再按所选模型服务填写真实的 API 地址、密钥、模型名和价格。示例中的占位域名不可用于请求。模型凭据不要提交 Git。

陪伴插件结构参考 [config-snapshot/](config-snapshot/)。这些脱敏快照仅用于理解配置字段，不是完整恢复文件。目标 QQ 用户列表、模型预算、主动消息权限和角色内容需要由所有者重新设置。

## 5. 安装 systemd 模板

先检查每个模板内的用户、路径、权限和配置位置，再复制需要的服务模板：

```bash
sudo install -m 644 /opt/qqb/server/systemd/qqb-gateway.service /etc/systemd/system/
sudo install -m 644 /opt/qqb/server/systemd/qqb-astrbot.service /etc/systemd/system/
sudo install -m 644 /opt/qqb/server/systemd/qqb-napcat.service /etc/systemd/system/
sudo install -m 644 /opt/qqb/server/systemd/qqb-backup.service /etc/systemd/system/
sudo install -m 644 /opt/qqb/server/systemd/qqb-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

模板复制后不会自动启动服务。所有者决定恢复机器人后，应先复查服务器防火墙、服务绑定地址、QQ 登录和模型预算，再按网关、NapCat、AstrBot 的顺序手动启动。备份定时器也需独立审核后启用。

## 6. 准备 Windows 控制台

安装 Node.js 22.12.0 或更新的 22.x 版本，然后运行：

```powershell
cd desktop
npm ci
npm start
```

在设置页面填写新服务器地址、SSH 用户、私钥路径和 QQ 账号。控制台连接资料保存在本机 Electron 用户目录，不在 Git 中。

## 7. 备份与历史数据

如果所有者选择从旧备份恢复，应先在本机单独核验备份内容、来源和登录状态，再确认是否迁移到新服务器。完整备份不属于公开 Git，也不属于从 Git 建立干净实例的步骤。恢复旧数据可能带回个人对话、长期记忆和凭据；不要将这些内容提交或分享。
