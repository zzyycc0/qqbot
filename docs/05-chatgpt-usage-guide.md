# ChatGPT / Codex 使用功能与配置建议

整理日期：2026-10-21  
适用项目：QQ 陪伴机器人（qq-companion）  
当前状态：项目停用归档；这份说明只介绍可用功能和建议，不代表已更改账号设置或安装连接器。

## 先分清三个概念

| 功能 | 作用 | 对本项目的用法 |
|---|---|---|
| ChatGPT 项目（Project） | 把相关聊天、文件和项目指令放在同一上下文中 | 建立“QQ 陪伴机器人”项目，长期保存交接与设计聊天 |
| 资料库（Library） | 保存上传或生成的文件，方便在其他聊天中查找、下载、再次引用 | 保存可安全放在云端的脱敏说明文档 |
| Codex 本地工作目录 | 让 Codex 访问、分析和修改本机代码 | 在 Codex 中打开 E:deepseekqq-companion |

侧边栏的自定义分类（例如“已停用项目”）只整理聊天记录，不是 ChatGPT Project，也不会把文件保存到资料库。此前创建的该分类仅用于归档当前聊天。

## ChatGPT 与 Codex 的主要区域

- **Chat**：普通问答、写作、翻译、总结和解释。
- **Work**：适合使用已连接应用、浏览网页、整理文件、制作文档和运行计划任务的工作流。桌面版可在授权后访问本机文件夹；云端 Work 的聊天与任务上下文可能存储在云端。
- **Codex**：面向代码工作的界面，可打开本地文件夹、阅读项目指令、改代码、执行开发任务。Codex 与 ChatGPT 的聊天历史是分开的。
- 桌面应用左上角可在 ChatGPT 与 Codex 之间切换；在 ChatGPT 中还有 Chat / Work 的切换入口。具体入口和可用功能会随账号、计划、地区、工作区权限及应用版本变化。

## 对 QQ 陪伴机器人最有用的内置功能

### 1. ChatGPT Project：作为长期项目空间

项目可集中保存项目聊天、文件和项目专属指令，并可把符合条件的已有聊天移入项目。适合存放设计讨论、故障分析、迁移计划和后续决策。

项目空间状态（2026-10-21 核验）：

- 建议的项目指令：
  - 本项目当前停用归档；除非用户明确要求恢复，否则不要启动或重启远程服务，也不要调用会产生费用的模型接口。
  - 优先依据 PROJECT-STATUS.md、AI-HANDOVER.md 和 MIGRATION.md；早期历史文档可能过时。
  - 不把 secrets/、私钥、访问令牌、真实 API Key 或含登录态的备份加入项目文件。
  - 遇到远程变更、费用、登录或权限动作时，先说明影响并等待用户明确指示。

当前账号的项目列表中已存在名为“qq陪伴机器人”的 ChatGPT Project。当前这条 Codex 对话的 projectId 仍为空，侧边栏的“已停用项目”只是自定义分类；它尚未归入该 ChatGPT Project。本次没有移动聊天或添加项目资料。移动本地 Codex 对话是否可用取决于当前界面支持情况。

### 2. 资料库（Library）：作为可复用文件架

资料库适合保存 ChatGPT 上传或生成的文件，供之后查找、下载或再次附加到聊天。网页端有完整资料库界面；连接 Google Drive、Box、Dropbox 或 SharePoint 后，也可能在资料库浏览对应来源，功能取决于权限和账号条件。

适合考虑保存到资料库的文件：

- AI-HANDOVER.md（当前根目录版本不含凭据）
- PROJECT-STATUS.md
- README.md
- 经逐份检查并脱敏的设计、使用说明或配置快照

不要放入资料库：

- secrets/ 中的原始 AI-HANDOVER、SECRETS-EXPORT、密钥、令牌或服务器盘点文件
- 含真实配置与 QQ 登录态的备份压缩包
- 尚未检查的截图、日志和配置文件

当前会话没有直接上传到资料库的工具；以上文件目前仍保存在本机项目目录。资料库并不会自动同步 E 盘整个文件夹。对于要经常协作维护的资料，ChatGPT Project 或已连接的云盘更适合；敏感材料继续留在本机。

### 3. 网页搜索与深度研究

- 网页搜索适合核对最新软件版本、官方文档、服务规则和故障资料。
- 深度研究适合跨多个来源整理出带出处的长报告。
- 这项能力不需要为普通搜索额外安装插件。本次报告使用官方文档核对功能状态。

### 4. 上传文件、数据分析、Canvas、图像和语音

- 上传文档、PDF、表格、图片和支持的音频，可做总结、提取、比对或问答。
- 数据分析可处理 CSV、Excel 等结构化数据并生成图表；适合以后查看模型费用、每日调用和备份记录。
- Canvas 适合共同编辑较长文档、代码或布局。
- 图像生成和图片理解可用于控制台界面草图、截图分析等。
- 语音适合口述需求或让 Work / Codex 进行语音交流。

### 5. 记忆与自定义指令

- **记忆**用于跨聊天保留可能有帮助的偏好与信息；内容由系统选择，不保证记住每个细节。
- **自定义指令**适合写长期适用的沟通偏好。
- 项目专属规则应写在 ChatGPT Project 指令中；Codex 仓库规则写在项目根目录的 AGENTS.md。
- 重要技术事实仍应写进项目文档，不能只依赖记忆。

### 6. 计划任务与 Codex 自动化

- ChatGPT 计划任务可以做提醒、周期性检查或在受支持应用事件触发时运行，通常要开启通知。
- Codex 自动化与 ChatGPT 计划任务是不同的功能。
- 机器人目前停止使用，不建议设置自动启动、远程巡检或任何会产生费用的自动任务。将来只需要提醒时，可考虑建立“定期检查本地备份”的提醒；这不等于自动读取本机 E 盘。
- 官方说明指出，在项目中建立的计划任务不能访问该项目上传的文件；不要假设它会自动读取项目资料。

## 插件、应用连接器与技能

### 它们的区别

- **应用（App）**连接 Google Drive、GitHub、Slack 等外部服务，按授权读取信息或执行支持的操作。
- **技能（Skill）**是一套可复用流程说明，告诉模型某类工作应该怎么做；技能本身不一定连接外部服务。
- **插件（Plugin）**可以把技能、一个或多个应用连接、工具和交互界面打包在一起。
- 安装插件不等于自动完成账号授权。可用能力会受计划、地区、工作区设置、应用权限和所在界面影响。

### 本次查询到的相关连接器

下面这些搜索结果标记为“可用但未安装”，不代表已连接任何账号：

| 连接器 | 查询到的状态 | 对本项目的价值 |
|---|---|---|
| GitHub | 可用、未安装 | 项目恢复开发并决定托管代码后，可协助看仓库、Issue、PR 和 CI |
| Google Drive | 可用、未安装 | 保存和检索文档、表格及文件；可作为云端资料入口 |
| Notion | 可用、未安装 | 适合整理项目知识库、决策和任务数据库 |
| Dropbox | 可用、未安装 | 已在使用 Dropbox 时，可检索文件、保存生成内容 |
| Box | 可用、未安装 | 已在使用 Box 时，可搜索和整理文件 |

当前项目没有 Git 仓库，因此 GitHub 连接暂时不会带来完整的代码协作价值。存储工具建议只选用户日常在用的一种（例如 Google Drive 或 Notion），不必同时装多个。现阶段没有必须安装的连接器。

当前环境给出的其他推荐目录项包括 Figma、Linear、Outlook、SharePoint、Slack、Teams 和 OpenAI Developers 等；对这个停用归档项目暂无直接必要。应用目录会随账号和工作区配置变化。

### 当前会话可用的技能

本次环境已经提供一组技能，不需要再安装即可在相关任务中使用。对本项目最实用的包括：

- code-review：审查代码改动或 PR。
- diagnosing-bugs：按步骤诊断难复现的故障或性能问题。
- research：基于高可信来源做资料研究。
- security-best-practices：用户明确要求安全审查或安全实现时使用。
- tdd：用户要求测试驱动开发时使用。
- documents、pdf、spreadsheets：处理 Word、PDF、Excel 等交付物。
- plugin-management：发现插件、检查连接器权限和安装依赖。
- skill-creator、skill-installer：创建或安装可复用技能。

技能更适合承载重复、步骤稳定的工作流程。当前已有 AGENTS.md 记录本项目的停机边界和本机资料规则；只有恢复后出现稳定重复的运维流程，才值得另做专属技能。

## 建议检查的设置

以下是建议查看项，不代表本次已修改：

1. **设置 > 个性化 > 记忆**：检查记忆、引用历史聊天等选项是否符合需要。记忆不替代项目文档。
2. **设置 > 个性化 > 高级**：如果界面提供 Library 搜索设置，可决定是否让回答自动查找资料库文件。
3. **设置 > 数据控制**：按个人偏好检查“为所有人改进模型”开关。个人账号中该设置开启时，聊天和应用访问内容可能用于改进模型；若不希望这样使用，可在此关闭。
4. **设置 > 插件 / 应用**：连接前检查授权账号、读取范围和写入动作；优先从只读、最小权限开始。
5. **设置 > 通知 / Scheduled**：仅在确实需要提醒或周期任务时开启通知。
6. **Codex / Work 本地文件夹访问**：打开项目时只授予项目所需目录。本地运行不代表整个聊天和上下文都只保存在本机。

## 针对本项目的建议顺序

### 当前停机归档阶段

1. 检查已存在的“qq陪伴机器人” Project 指令和资料，只加入已检查的无密钥文档；不要上传 secrets/ 和备份压缩包。
2. 当前 Codex 对话尚未归入该 Project；若界面提供移动入口，再决定是否把聊天归档到该项目。
3. 在 Codex 里单独打开本地 E:deepseekqq-companion 文件夹，以便代码任务能读取 AGENTS.md 和源码。
4. 目前不安装 GitHub、云盘、Slack、Linear 等连接器；确有需要时再选择一种。
5. 不设自动启停、远程访问或模型调用任务。

### 将来恢复开发时

1. 先清理并确认凭据和服务端状态。
2. 建立受 .gitignore 保护的版本控制，再决定是否连接 GitHub。
3. 为本地开发选择一个主要资料存储位置；不要让本机文件、Library、云盘和服务器配置出现互相覆盖的多个“唯一真相”。
4. 代码审查、故障诊断、研究和安全检查按任务调用已有技能。

## 官方资料

- ChatGPT 功能总览：https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview
- ChatGPT 项目：https://help.openai.com/en/articles/10169521-projects-in-chatgpt
- ChatGPT 资料库：https://help.openai.com/en/articles/20001052-using-library-to-manage-files-in-chatgpt
- ChatGPT 记忆：https://help.openai.com/en/articles/8590148-memory-in-chatgpt
- 插件：https://help.openai.com/en/articles/20001256-plugins-in-chatgpt
- 应用连接器：https://help.openai.com/en/articles/11487775-connected-apps-in-chatgpt
- 计划任务：https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt
- 数据控制：https://help.openai.com/en/articles/7730893-chats-in-chatgpt
- ChatGPT Work 与 Codex：https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
- Skills 概念：https://developers.openai.com/plugins/concepts/skills
- AGENTS.md 与 Codex 项目工作流：https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex

功能上线范围、计划限制和界面名称会变化；遇到入口与本文不符时，以当前账号界面和官方帮助页为准。
