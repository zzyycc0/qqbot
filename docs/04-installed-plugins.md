# 停机归档中的插件版本

以下版本来自本机保存的停机前插件元数据，表示最后保存的安装基线，不是实时服务器检查结果。上游提交与下载地址见 [dependencies.lock.md](dependencies.lock.md)。

| 插件 | 保存版本 | 用途 |
|---|---:|---|
| `astrbot_plugin_private_companion` | 6.7.0 | 陪伴对话、角色状态和主动行为 |
| `astrbot_plugin_memory_companion` | 2.3.2 | 记忆管理与插件协作 |
| `astrbot_plugin_content_companion` | 0.2.2 | 可选创作能力 |
| `astrbot_plugin_meme_manager` | 5.1.0 | 可选表情包能力 |

## 重建提示

- 第三方插件按固定提交下载；仓库不镜像没有明确声明许可证的插件源码。
- 新实例必须重新设置目标用户、模型凭据、角色内容、主动消息权限和数据备份策略。
- 版本来自停机前记录，不代表当前上游最新版本。若要升级，应单独评估兼容性和迁移风险。
