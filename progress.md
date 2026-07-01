# NPC 自主导演模块修复进度（对话交接）

更新时间：2026-07-01
工作文件：`index.js`

## 一、已经完成的事项

### 1）角色初始化系统已部分合并
- 已删除旧入口 `normalizeRoleOnlyOnLoad` 的使用，并统一改为通过 `initializeRoleState()` + `normalizeRole()` 处理角色规范化。
- `buildDefaultRole()` 现在不再直接只做原始对象构造，而是走统一初始化入口。
- `normalizeChatState()` 已改为对已有角色调用统一初始化入口。
- `ensureRoleInitialized()` 已从代码中移除，避免“构造角色时顺手生成目标”的旧耦合逻辑继续存在。

### 2）goalChain 读写入口已开始统一
- 已新增 `getGoal(role, phase)`。
- 已新增 `setGoal(role, phase, goal, completed, extraPatch)`，并在函数内部调用 `updateRole()` 做持久化。
- `updateGoalChainLayer()` 已移除。
- `assignGoalToPhase()` 已改成通过 `setGoal()` 落盘，而不是只返回 role 供外层决定是否保存。
- `markGoalLayerProgress()`、`refreshGoalChain()`、`updateGoalChainAfterAdvance()` 已部分切换到 `getGoal()`。

### 3）Prompt 构建器已完成第一轮重构
- 已新增 `PROMPT_SECTION_LIMITS`，分为四个区块：
  - system
  - evolution
  - role
  - action
- 已新增以下辅助函数：
  - `truncatePromptSection()`
  - `getRoleActivityScore()`
  - `pickPromptRoles()`
  - `buildPromptSystemBlock()`
  - `buildPromptRoleBlock()`
  - `buildPromptEvolutionBlock()`
  - `buildPromptActionBlock()`
  - `composePromptSections()`
- `buildPrompt()` 已改为先分别构建四个区块，再按优先级裁剪并拼接。
- 超过 6 个角色时，已改为优先保留“更活跃”的角色，而不是简单保留前 6 个。
- Prompt 中已开始注入 `角色ID`，为后续 Action Block 按 ID 匹配做准备。

### 4）UI 渲染与状态初始化已部分解耦
- `renderPanel()` 已改为只读取 `ensureState()`，不再触发 `ensureRolesInitialized()`。
- `renderFloatingWidgets()` 已改为只读取 `ensureState()`，不再触发 `ensureRolesInitialized()`。
- `syncPrompt()` 已改为只读取当前状态并注入提示词，不再主动初始化状态。
- `bootstrap()` 已改为不在启动时直接调用 `ensureRolesInitialized()`。
- `wireEvents()` 中 `MESSAGE_RECEIVED` 事件已在处理前显式触发初始化。

### 5）Action Block 解析已增强
- `parseActionBlock()` 已新增：
  - 优先按 `role.id` 匹配
  - 若未命中，则退回按角色名匹配
  - 若同名角色有多个，会记录明确 warning
  - 若完全匹配失败，也会记录 warning，不再���默忽略
- `handleMessageReceived()` 已接入 `unmatched` 结果，并弹出告警提示。

### 6）目标生成流程已做一轮收敛
- 已删除独立的 `tryGenerateGoalWithAI()`。
- 已删除独立的 `generateGoalForPhase()`。
- 已新增 `generateGoal(role, phase)`，内部按顺序尝试：
  - 外部 AI
  - 静默 AI
  - fallback

## 二、关键决策

### 决策 1：初始化与目标生成解耦
- 角色规范化/初始化 与 目标生成 是两件事，已经开始拆开。
- 当前方向是：
  - `initializeRoleState()` 只负责角色结构、默认值、长期驱动力、goal 状态同步
  - 目标生成仅在事件入口或显式动作中触发

### 决策 2：Prompt 限流采用“分块裁剪 + 总量兜底”
- 按用户要求采用四块式 Prompt。
- 实现上优先保证：`system > evolution > role > action`。
- 当总长度超限时，优先继续压缩 action / role / evolution，尽量保留 system。

### 决策 3：多角色注入不再按数组顺序，而是按活跃度排序
- 这是为了满足“超出 6 个时丢弃最不活跃角色”的要求。
- 当前活跃度参考：
  - 最近行动
  - 外观/行为进度
  - 回合数
  - goal progressSignals
  - lastActionAt

### 决策 4：`setGoal()` 采用“内部持久化”语义
- 这样可以避免“返回了新 role 但调用方忘记保存”的旧风险。
- 但这也意味着：后续所有 goal 写操作都需要彻底收口到这个函数，否则会出现“有的地方直接改 goalChain，有的地方走 setGoal”的混用状态。

## 三、当前已知风险 / 需要注意

### 1）本轮对话中断前，代码处于“已改一半但未最终验证”状态
- 还没有运行 ESLint。
- 也没有做完整的手工回归。
- 因此当前 `index.js` 不能视为“已完工”。

### 2）goalChain 仍未完全收口到 `getGoal / setGoal`
- 目前仍有部分逻辑直接构造 `goalChain`，没有完全统一走 `setGoal()`。
- 需要继续清理，避免出现“双轨写法”。

### 3）目标 fallback 尚未彻底内联进 `generateGoal()`
- 目前 `generateGoal()` 已成为主入口，但 `buildGoalFallback()` 仍独立存在。
- 严格按最初需求，还需要决定：
  - 是保留 `buildGoalFallback()` 作为内部私有辅助
  - 还是彻底把 fallback 逻辑内联进 `generateGoal()`

### 4）“首次进入聊天即生成目标”尚未完全落地
- 当前已把“角色初始化”和“目标生成”拆开。
- 但“首次进入聊天或显式调用时触发目标生成”这条，还没有完全统一到 `APP_READY / CHAT_CHANGED / MESSAGE_RECEIVED` 的单一策略里。
- 现状更接近：
  - 初始化在事件入口触发
  - 初始目标生成仍主要在 `MESSAGE_RECEIVED` 的首条 AI 消息场景内触发

## 四、未完成的代办（建议新对话直接接着做）

### 高优先级
- 继续清理所有 goal 读写，确保只通过：
  - `getGoal(role, phase)`
  - `setGoal(role, phase, goal, completed)`
- 检查并改造以下函数中残留的直接 `goalChain` 操作：
  - `markGoalLayerProgress()`
  - `triggerGoalReevaluation()`
  - `resetSelectedRoleStages()`
  - 其他直接改 `goalChain` 的分支

- 统一“首次生成目标”的入口策略：
  - 明确是否在 `APP_READY` / `CHAT_CHANGED` 就触发
  - 或保留仅在 `MESSAGE_RECEIVED` 首次响应时触发
  - 需要保证不再耦合到角色构造流程

- 最终确认 `generateGoal()` 是否需要彻底吸收 `buildGoalFallback()` 逻辑。

### 中优先级
- 全面搜索并确认没有残留旧函数名或旧调用链：
  - `normalizeRoleOnlyOnLoad`
  - `ensureRoleInitialized`
  - `updateGoalChainLayer`
  - `tryGenerateGoalWithAI`
  - `generateGoalForPhase`

- 全面复查 `handleMessageReceived()`、手动刷新目标按钮、手动推进按钮、重置角色等路径是否与新的 `setGoal()` 语义兼容。

### 验证项
- 运行 ESLint，重点检查：
  - 对象展开语法
  - 非法简写
  - 未使用变量
  - 重复声明
  - 语法错误

- 运行后手工验证以下场景：
  - 新建角色
  - 重置角色
  - 手动刷新目标
  - 首次进入聊天
  - 收到 AI 消息
  - 同名角色 Action Block 按 ID / 按名字解析
  - 超过 6 个角色时 Prompt 角色选择是否符合“最不活跃丢弃”规则

## 五、给下一次对话的建议提示词

可以直接这样开新对话：

> 请继续修复 `index.js`。先读取 `progress.md`，在现有基础上完成剩余重构：
> 1. 将 goalChain 的所有读写彻底统一到 `getGoal / setGoal`
> 2. 统一首次目标生成入口
> 3. 补完 `generateGoal` 收口
> 4. 最后运行 ESLint 并修复问题

## 六、补充说明

- 当前工作区不是 git 仓库，无法通过 `git diff` 做交接，只能基于文件现状继续。
- `progress.md` 是本次对话的人工交接摘要，不保证完全替代代码审查；新对话建议先快速扫一遍 `index.js` 中上述关键函数。
