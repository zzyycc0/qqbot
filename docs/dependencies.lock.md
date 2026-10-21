# 依赖与固定版本

本表以 2026-10-21 的停机前服务器备份和本地桌面锁文件为基线。源码没有自动升级；重新创建实例时必须确认各上游项目仍可获取，并由所有者检查是否要继续使用这些版本。

## 本项目组件

| 组件 | 停机前版本 | 固定来源 | 固定提交 / 说明 |
|---|---:|---|---|
| AstrBot | 4.29.1 | [AstrBotDevs/AstrBot](https://github.com/AstrBotDevs/AstrBot) | `dffe922773725e9c178392c423676ad65044748c`；标签 `v4.29.1`；上游许可 AGPL-3.0-or-later |
| NapCat | 4.18.38 | [NapNeko/NapCatQQ](https://github.com/NapNeko/NapCatQQ) | `bbd0d2aca3d470c20b33b1d4f95123335633bf26`；标签 `v4.18.38` |
| Linux QQ | 3.2.34-53644 | 腾讯 Linux QQ 发布包 | 非本仓库源码；需重新从官方渠道取得兼容包，不能从 Git 恢复登录态 |
| 私聊陪伴插件 | 6.7.0 | [menglimi/astrbot_plugin_private_companion](https://github.com/menglimi/astrbot_plugin_private_companion) | `f2f87183993a0667800056f73bcf12df298cdbcb`；标签 `v6.7.0` |
| 记忆插件 | 2.3.2 | [menglimi/astrbot_plugin_memory_companion](https://github.com/menglimi/astrbot_plugin_memory_companion) | `8cff40d217438d5c0ac1b9a1fe6f935d1f46a5c1`；标签 `v2.3.2` |
| 内容扩展 | 0.2.2 | [menglimi/astrbot_plugin_content_companion](https://github.com/menglimi/astrbot_plugin_content_companion) | `6f226ce084cb6c5b539f03a2a074dd94fa87ddf5`；标签 `v0.2.2` |
| 表情包管理器 | 5.1.0 | [anka-afk/astrbot_plugin_meme_manager](https://github.com/anka-afk/astrbot_plugin_meme_manager) | `b96d6bedecca6d0bef27b70261fd6f787116ee49`；标签 `v5.1.0` |

## 控制台依赖

| 组件 | 固定版本 | 文件 |
|---|---:|---|
| Node.js | 22.12.0 | `.nvmrc` |
| Electron | 44.9.1 | `desktop/package.json` 与 `desktop/package-lock.json` |
| ssh2 | 1.17.0 | `desktop/package.json` 与 `desktop/package-lock.json` |
| Python | 3.12 | 服务器 AstrBot 运行时；符合上游要求 |

## 版本核对说明

- 本地备份中四个插件的版本分别是 6.7.0、2.3.2、0.2.2、5.1.0。
- 2026-10-21 检查上游标签时，前三个插件仍以相同版本为最新标签；表情包管理器上游已有 5.2.1（提交 `0bfa4710b3fbe49262029010738a1eadad620f48`），但停机前实例仍为 5.1.0。为保持原实例可重建，本表锁定 5.1.0，不代表建议继续使用旧版。
- 三个陪伴插件仓库未声明明确的开源许可证。本项目不复制其源码；`server/fetch_dependencies.sh` 从上游固定版本获取。使用者应遵守上游条款并自行复核许可。
- AstrBot 的 Python 依赖由固定源码版本中的 `requirements.txt` 管理，其中部分范围仍允许后续版本。Git 可固定应用源码，但无法保证未来 PyPI 依赖解析与 2026-10-21 完全一致。
- QQ 客户端包、模型服务凭据、用户配置和运行数据必须从所有者授权的来源重新提供，不能放入本仓库。
