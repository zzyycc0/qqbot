# AI 辅助软件开发流程与项目资料管理研究

整理日期：2026-10-21  
检索范围：OpenAI / OpenAI Developers 与 GitHub 官方资料  
用途：为本项目及后续 Codex 开发建立可复用的资料与上下文管理方法

> 研究边界：本记录依据官方产品说明、开发指南、GitHub 工作流文档和 OpenAI 发布的 Codex 工作流案例归纳。官方资料不是对开发者使用习惯的抽样调查，因此本文不把某一种做法说成“所有人都这么用”；“建议”部分是结合这些官方能力作出的实用判断。

## 结论摘要

- **GitHub 仓库适合作为代码和技术资料的主版本库。** 仓库不只放源码；README、安装运行说明、架构文档、决策记录、测试和自动化工作流都可以与代码一起版本管理。GitHub 官方指引将仓库、Issues、Projects、Pull Requests 和 Actions 作为项目规划、协作、评审与持续集成的组合工具。[GitHub：项目规划与追踪](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/planning-and-tracking-work-for-your-team-or-project)（检索于 2026-10-21）
- **Codex 的稳定项目上下文应落在仓库文件里，不应只留在一条聊天中。** AGENTS.md 是 Codex 识别的可选持久指引；长期任务可按需增加目标、计划、阶段说明和状态记录。这些文件是可选惯例，应从项目实际需要出发，不需要每个项目都套满模板。[OpenAI：Codex 迭代工作流](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex)（检索于 2026-10-21）
- **ChatGPT Project 和 Library 有用，但角色不同。** Project 适合收拢相关对话、项目指令和参考资料；Library 适合跨对话查找、下载和再次附加文件。它们方便 AI 对话使用，但不提供 Git 的分支、差异比较、代码评审和 CI，因此建议作为协作入口或资料副本，不作为代码和技术决策的唯一真源。[OpenAI：Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt)、[OpenAI：Library](https://help.openai.com/en/articles/20001052-using-library-to-manage-files-in-chatgpt)（检索于 2026-10-21）
- **Codex 上下文变长时，先检查、再压缩或分支。** 对同一目标使用 /status 查看上下文情况；若当前任务目标没变，可用 /compact 压缩对话；如果要探索不同方向，用 /fork 从当前历史分出新聊天。界面、版本和账户条件可能影响命令可用性。[OpenAI：Codex 远程工程工作指南](https://developers.openai.com/blog/mastering-codex-remote-for-engineering)（检索于 2026-10-21）
- **插件和技能不需要越多越好。** 技能提供可复用的工作方法；插件可以打包技能和外部应用/MCP 工具。只有当工作确实需要特定工作流或外部数据/操作时才安装和授权。插件安装不会自动获得外部账户权限。[OpenAI：插件概念](https://developers.openai.com/plugins/concepts/plugins)、[OpenAI：ChatGPT/Codex 插件说明](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt)（检索于 2026-10-21）

## 一个可维护的 AI 开发闭环

### 1. 先写清需求和完成标准

开工前说明目标、范围、限制和可检查的完成条件。小任务直接写成一条明确任务；多步骤任务可用 GitHub Issue 记录目标和待办，需要分阶段时再加计划文件。GitHub Issues 可记录 bug、功能和发布任务；任务清单可拆分步骤；GitHub Projects 可汇总 Issues 与 Pull Requests 并跟踪状态。[GitHub：项目规划与追踪](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/planning-and-tracking-work-for-your-team-or-project)

### 2. 让仓库成为代码与开发事实的主档案

建议基础文件各自只负责一类信息：

| 文件 / 位置 | 负责内容 |
|---|---|
| README.md | 项目是什么、如何安装/运行、从哪里继续 |
| AGENTS.md | Codex 和协作者长期遵守的项目约定、边界、测试入口、相关文档索引 |
| docs/architecture.md | 系统边界、模块关系、数据流等需要理解架构时再查的内容 |
| docs/decisions/ | 重要技术选择、理由、替代方案与日期；必要时采用 ADR 编号 |
| docs/runbook.md | 运维、恢复、排障步骤；涉及真实凭据时只写安全获取方式，不写凭据 |
| docs/project-status.md | 当前阶段、已完成、未完成、已知风险、下一步 |
| tests/、CI 工作流 | 自动验证与可复现的质量门槛 |

这是一种建议的职责分工，不是 Codex 强制要求。GitHub 会在仓库页面展示 README；Codex 官方示例则将 AGENTS.md 作为持久仓库指引，并将 PLANS.md、GOALS.md、PROMPTS.md 与阶段文件列为可选工作流文件。[GitHub：README](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)、[OpenAI：Codex 迭代工作流](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex)

**不要把每份架构文档都塞进常驻指令。** AGENTS.md 应保持精简，并按任务指向详细文档；例如改数据库时查 schema 文档，准备部署时查 runbook。OpenAI 近期建议避免让每次小改动都加载一大串无关说明，以减少指令臃肿和上下文浪费。[OpenAI：重新思考技能与提示词](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

### 不同 AI 开发工具里的共同做法

这里没有可靠的“所有开发者实际使用比例”数据；不过 Codex、GitHub Copilot 和 Cursor 的官方文档都支持把项目说明放在代码仓库中：Codex 识别 AGENTS.md，Copilot 可读 `.github/copilot-instructions.md` 与 AGENTS.md，Cursor 的项目规则存放在 `.cursor/rules` 并可随仓库版本管理。由此能归纳的主流工程做法是：**让项目说明跟着代码仓库走，而不是只留在某个 AI 产品的聊天记忆里。**[GitHub Copilot：自定义指令](https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions)、[Cursor：规则](https://docs.cursor.com/context/rules)、[OpenAI：Codex 迭代工作流](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex)

会话上下文也不是长期项目记忆。以 Claude Code 的官方说明为例，`/compact` 用于压缩当前对话，`/clear` 用于新开会话；项目指令和文件则在会话外保留。这和 Codex 建议使用项目文件加 `/compact` 的思路一致。[Anthropic：Claude Code 上下文与用量](https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code)

### 3. 用小批次完成实现

建议流程：

1. 读取任务相关的指引和资料，确认现状与边界。
2. 对复杂工作先列计划、阶段和验收标准；一次只执行一段。
3. 让 Codex 修改代码，同时说明修改范围和不确定点。
4. 按项目实际运行测试、构建、格式检查或静态分析，并修复失败。
5. 更新受到影响的说明、决策和状态记录。
6. 检查差异，确认没有不相关改动或敏感内容。
7. 由人复核后再合并或发布。

OpenAI 描述的 Codex 长任务循环是“计划、编辑、运行工具、观察结果、修复失败、更新文档/状态、重复”；阶段记录和版本控制能形成便于复查的开发历史。[OpenAI：长时间运行的 Codex 任务](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex)、[OpenAI：Codex 迭代工作流](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex)

### 4. 用 GitHub 保存可审阅的改动历史

个人项目可采用轻量 GitHub Flow：从主分支开一个描述明确的分支，提交有意义的改动，开 Pull Request 检查差异和讨论，合并后保留提交与评审历史。GitHub Actions 可按推送或 PR 事件运行构建和测试，并把结果展示在 PR 上。[GitHub：GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)、[GitHub：持续集成](https://docs.github.com/en/actions/get-started/continuous-integration)

AI 生成的代码、文档、计划也应通过差异检查和提交记录纳入可复查流程。若有外部发布或部署，最好与本地编辑和 Git 提交分开，让人先检查实际变更和影响。

### 5. 保存阶段记录，而不是要求聊天永远记住一切

需要长期推进的任务，可把阶段、当前状态、已作决定、验证结果和下一步写进仓库文档。OpenAI 的 Codex 案例建议把长期规格、计划、当前阶段、决策、运行方式、已知问题和后续工作外部化到 Markdown 文件中；分阶段文件和版本控制可形成可审阅记录。[OpenAI：长时间运行的 Codex 任务](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex)、[OpenAI：Codex 迭代工作流](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex)

## GitHub、ChatGPT Project、Library 的职责边界

| 位置 | 推荐作为 | 不适合单独承担 |
|---|---|---|
| GitHub 仓库 | 源码、可版本化文档、测试、版本历史、Issue/PR/CI | 个人所有资料的通用文件柜 |
| ChatGPT Project | 某个主题下的对话、项目指令、参考文件、从对话保存的结论 | 带分支、差异和代码评审的代码仓库 |
| ChatGPT Library | 跨聊天找文件、下载文件、把文件再次附加到聊天 | 持续维护源码、决策审查与自动化测试 |
| Drive / Notion 等连接应用 | 既有文件服务中的多人协作资料；授权后让 AI 搜索或操作 | 未授权时自动让 Codex 看见本地磁盘或私有资料 |

ChatGPT Project 可添加文件、项目指令、受支持应用的链接，也可把有用的聊天回复保存为项目资料；Library 可浏览、搜索、下载和再次附加上传或生成的文件。如果连接 Google Drive，Library 可按权限浏览 Drive 中的文件和文件夹。[OpenAI：Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt)、[OpenAI：Library](https://help.openai.com/en/articles/20001052-using-library-to-manage-files-in-chatgpt)

**实用原则：一项事实选一个权威位置，其余位置只做入口或副本。** 例如代码和架构决策以仓库为准；Project 可放脱敏摘要、对话和工作偏好；Library 可放跨项目复用的模板或资料。这样可避免 AI 在一个位置拿到旧文档、另一个位置却已更新。这是基于各产品能力边界作出的建议。

无论使用哪种 AI 工具，都不要把 API 密钥、访问令牌、私钥或登录态备份直接写进普通文档、提交记录或云端知识文件。GitHub push protection 能阻止部分可识别密钥被推送，但保护功能不是把秘密留在仓库里的理由。[GitHub：防止秘密泄漏](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/prevent-future-leaks)（检索于 2026-10-21）

## Codex 上下文接近上限时

### 对话里处理

1. 若当前目标仍相同，先查看 /status；在命令可用的 Codex 客户端中使用 /compact 压缩对话。
2. 若下一步变成另一条探索线，用 /fork 从已有聊天分出新聊天；保留原聊天作为原任务记录。
3. 若要开始聚焦的新任务，就新开聊天，并交代目标、当前状态、关键约定、相关文件和下一步。
4. 阶段完成后，把重要决策、结果和验证信息写入仓库；不要把压缩后的聊天总结当作项目唯一档案。

OpenAI 的 Codex 工程指南把 /status、/compact、/fork 分别用于查看上下文、压缩长聊天、从当前历史分出不同方向，并提醒具体可用性依赖客户端、版本和账户配置。[OpenAI：Codex 远程工程工作指南](https://developers.openai.com/blog/mastering-codex-remote-for-engineering)

### 区分桌面 Codex 与自己开发的 API Agent

Responses API 的 /responses/compact 是面向自行开发 Agent 的 API，不是普通桌面用户手动调用的按钮。应用开发者可在上下文较长时将历史交给该 API 压缩，并将返回的紧凑上下文传给后续请求。[OpenAI：Compaction 指南](https://developers.openai.com/api/docs/guides/compaction)

## 对 QQ 陪伴机器人当前状态的核对

- 本机交接记录称服务于 2026-10-21 14:20 停机；本次没有连接服务器复核，因此这不是实时远程状态。
- 本次整理已为项目准备本地 Git 仓库内容、脱敏配置模板、固定版本表和重建说明。远程 GitHub 仓库尚未创建或上传。
- 桌面控制台默认服务器地址、QQ 号和 SSH 私钥路径留空；凭据、登录态、运行数据库、日志、截图与完整备份均通过忽略规则排除。
- 插件版本以停机前备份元数据为准；恢复前须重新验证上游版本、许可和模型费用。

以上内容是本次本机核对结论，不代表已连接账户、创建 GitHub 远端或恢复机器人服务。
## 插件与技能：按实际缺口选择

### 术语

- **Skill（技能）**：可复用工作步骤和配套参考文件，适合模型已能用现有工具完成、但需要固定流程的任务。
- **Plugin（插件）**：可打包技能和可选的 MCP 服务/外部应用连接；连接能提供实时数据或受支持的读写操作。
- 技能指导“怎么做”；MCP/应用工具提供“能访问什么数据、能做什么操作”。安装插件不等于完成第三方账户授权；插件只能使用授权范围内的内容。[OpenAI：插件架构](https://developers.openai.com/plugins/concepts/plugins)、[OpenAI：插件和应用权限](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt)

### 选择建议

| 优先级 | 何时考虑 | 判断 |
|---|---|---|
| 沿用已有能力 | 只是需要代码审查、资料研究、OpenAI 文档查证等，且当前已有相应技能 | 先用已具备的技能，不为“凑齐插件”重复安装 |
| 有 GitHub 在线协作需求时考虑 GitHub 插件 | 需要 AI 查看 GitHub Issues、PR、CI 或相关发布流程 | 先查看插件列出的操作和权限，再连接目标账号/仓库；若只在本地改代码并手动评审，则不急 |
| 使用 OpenAI API/Agents SDK 时考虑 OpenAI Developers 插件 | 需要 OpenAI Platform 应用连接、API 设置或 OpenAI API/Agent SDK 指引 | 它面向 OpenAI API 开发；若项目不使用 OpenAI API，这个插件优先级低 |
| 有明确安全审计需求时再考虑专门安全能力 | 需要对远程仓库做持续代码安全扫描并把发现纳入处理队列 | 先确认代码是否可被该服务扫描、可用性和权限，再启用；单人日常编码无需预先安装多个安全工具 |
| 知识文件确实在外部服务时再连接 Drive/Notion 等 | 希望 AI 跨项目搜索云端文档，或在授权后更新文档 | 选择实际存放资料的服务；检查读写权限与可访问范围 |
| 暂缓通用或重复技能 | 不能说明它解决哪项重复工作，或与已有工具/技能重叠 | 先不装；某项流程反复费力时再增补 |

插件目录能显示其包含的技能、应用和设置要求；安装及可用功能受到计划、工作区、地区、客户端界面和权限限制。即使插件带有 OpenAI Verified 标记，也不能替代隐私与供应商审查。[OpenAI：Plugins in ChatGPT](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt)

**对本项目的当前判断：**这次研究没有安装插件、连接外部账户或修改设置。先把代码和文档在仓库中整理清楚，再判断是否需要 GitHub 插件；若项目没有 OpenAI API 接入，OpenAI Developers 插件暂时不急；Google Drive/Notion 仅在确定要用它们管理资料后再接入。此判断是建议，不代表已检查或更改账户设置。

## 来源清单

以下均为官方一手资料；检索日期均为 2026-10-21。

1. [GitHub Docs：Planning and tracking work for your team or project](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/planning-and-tracking-work-for-your-team-or-project) — 仓库、README、Issues、任务拆分、Projects。
2. [GitHub Docs：GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow) — 分支、提交、PR、评审与合并流程。
3. [GitHub Docs：Continuous integration](https://docs.github.com/en/actions/get-started/continuous-integration) — Actions 构建和测试，并显示 PR 检查结果。
4. [GitHub Docs：About the repository README file](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes) — README 的介绍和入门用途。
5. [GitHub Docs：How-tos for leak prevention](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/prevent-future-leaks) — secret scanning 与 push protection。
6. [OpenAI Cookbook：Iterating Development Workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex) — AGENTS.md、可选计划文件、阶段验收和版本控制历史。
7. [OpenAI Developers：Run long horizon tasks with Codex](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex) — 长期任务循环、可持续项目记忆与阶段验证。
8. [OpenAI Developers：Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) — 精简技能描述、按任务加载文档以避免上下文膨胀。
9. [OpenAI Developers：Mastering remote engineering work from your phone](https://developers.openai.com/blog/mastering-codex-remote-for-engineering) — /status、/compact、/fork 的上下文管理用途及可用性说明。
10. [OpenAI Help Center：Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) — 项目文件、指令、来源、保存对话回复。
11. [OpenAI Help Center：Using Library to manage files in ChatGPT](https://help.openai.com/en/articles/20001052-using-library-to-manage-files-in-chatgpt) — 文件保存、搜索、下载、再次附加和连接 Drive。
12. [OpenAI Developers：Plugin architecture](https://developers.openai.com/plugins/concepts/plugins) — Skill、MCP、插件职责边界。
13. [OpenAI Help Center：Plugins in ChatGPT](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt) — 插件目录、安装、应用授权和访问权限。
14. [OpenAI Developers：OpenAI Developers plugin](https://developers.openai.com/learn/developers-codex-plugin) — OpenAI API/Platform 专项插件用途。
15. [OpenAI API：Compaction](https://developers.openai.com/api/docs/guides/compaction) — API Agent 长上下文压缩方式（与桌面用户界面不同）。
16. [GitHub Copilot：Custom instructions](https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions) — 仓库级和路径级的可复用 AI 编码指令。
17. [Cursor：Rules](https://docs.cursor.com/context/rules) — 项目范围、可纳入版本控制的规则文件。
18. [Anthropic：Models, usage, and limits in Claude Code](https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code) — 会话压缩与重新开始的上下文管理方式。

