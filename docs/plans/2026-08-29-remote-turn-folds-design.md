# 远端折叠 turn:后端索引 + 按 turn 懒加载(设计)

日期:2026-08-29
状态:已确认(用户拍板:按 turn 取事件切片)
基线:0.1.22(`98cb983`;含 turn-less notice 注入折叠进 run 组的新语义)

## 背景与问题

聚焦对话的折叠 flow 由 `buildFocusFlow(chat.order, …)` 从 ChatSnapshot(会话窗口内已加载的消息)实时派生。刷新后 Session 窗口只有最近 50 条消息(`PAGE_MESSAGES = 50`),更早的 turn 完全不在快照里:

- 只能靠「加载更早的消息」一页页拉全文;
- 分页按消息数切割,切在 turn 中间时该 turn 缺 `turn/start` 边界、算不出时长,行渲染为**不折叠**的原始行——用户必须反复点按钮,直到窗口头越过每个 turn 的开场 User Message,才能看到折叠摘要行。

## 目标

- 刷新(或首次打开)后,**完整对话直接以折叠形态展示**:窗口之前的每个已完成 turn 渲染为「开场用户消息 + 工作了 X 分 Y 秒 + 结束回复预览」的折叠行,无需任何翻页。
- **展开才加载**:点击折叠行 → RPC 取该 turn 的原始事件切片 → 插件本地投影 → 与本地折叠展开完全同款的行渲染。
- 「加载更早的消息」按钮保留不动(想完整载入本地阅读时仍可用)。

## 非目标(YAGNI)

- 不改 dsh 源码(session-controller 分页语义不动)。
- 不复用/不导入 ui-chat、ui-conversation 的运行时值(bundle purity);投影是插件自有的派生,与现有 `toolRowModel`「reimplement the chat derivation」同一姿态。
- 右侧 turn 导航条不含远端 turn(窗口 turn 才有 anchorKey);记为已知限制。
- 远端 turn 不渲染:产物文件列表(ui-deliverables turn data)、fileMentions、分支预览(`branchUnavailable = true`)。反馈(有 `closingMessageId`)、fork(有 `closingSeq`)、图片(attachment ref 照常)不受影响。

## 架构

```
┌─ host(src/index.ts + src/host/)──────────────────────────┐
│ RPC 通道 /focus-chat-api(ctx.connection.rpc.handle)       │
│  focus/turnIndex {sessionId} → { turns, cursor }           │
│  focus/turnEvents {sessionId, turn} → { events, … }        │
│ 数据源:ctx.sessionQuery.observeSession(sessionId)          │
│  → SessionObservation { events: 完整日志, cursor } (using)  │
└────────────────────────────────────────────────────────────┘
             │ connection.rpc.call('/focus-chat-api', …)
┌─ client(apply.ts 注入 face + view/model)──────────────────┐
│ turnIndex(sessionId) / turnEvents(sessionId, turn) 回调     │
│ FocusView:索引落定后首帧渲染;windowHead 以下 turn → 远端行  │
│ turn-slice.ts:原始事件 → FocusFlowItem[](复用 tools/text) │
└────────────────────────────────────────────────────────────┘
```

### 1. 传输协议(`src/protocol.ts`,双半共享、type-only)

```ts
interface TurnOpeningMessage { seq: number; time: number; role: 'user'; content: readonly ContentBlock[] }
interface TurnSummary {
  turn: number
  startSeq: number; endSeq: number
  startTime: number; endTime: number
  stopped: boolean               // turn/end reason.kind === 'interrupted'
  closingSeq: number | null      // 最后一条带正文回复的 assistant/message
  closingMessageId: string | null
  closingPreview: string         // 结束回复首行,截断 ~200 字符;空串 = 无
  opening: readonly TurnOpeningMessage[]   // turn/start 与首个 step/start 之间的 source.kind==='user' 消息
}
// focus/turnIndex  → { turns: TurnSummary[]; cursor: number }
// focus/turnEvents → { startSeq: number; endSeq: number; events: SessionEventEntry[] }
```

`turnEvents` 返回 `[startSeq..endSeq]` 闭区间内的**全部事件**(含 `command/run|done`、`compaction/*`、`llm/retry`、`tool/code-dispatch*`、`request/header`)。

### 2. Host 半边

- `src/index.ts`:`inject = ['connection', 'sessionQuery']`;`apply` 经 `ctx.effect` 注册 RPC 通道(可卸载)。
- `src/host/turn-index.ts`:**纯函数** `computeTurnIndex(events): { turns, cursor }`——单次 O(n) 扫描:
  - 位置游标归属:`turn/start(T)` … `turn/end(T)` 之间的所有事件属于 T(user/message 等不带 turn 字段的事件靠位置);
  - `stopped` = reason.kind === 'interrupted';`closing` = 末条 `assistant/message` 且 blocks 有正文(text 非空);
  - `opening` 收 `[turnStart..firstStepStart)` 间的 user 源消息。
- `src/host/rpc.ts`:端点分发 + wire 校验(sessionId 非空串、turn 为非负整数)+ 租约 `using` 释放 + 错误映射(未找到 → `session-not-found`)。
- Node 半边保持零运行时依赖:所有 `@deepseek-ai/*` 引用都是 type-only(tsdown node bundle 现状不打包 externals)。
- 日志 append-only ⟹ 旧 turn 索引永不失效;host 不做缓存(单次扫描足够便宜),客户端按 session 缓存。

### 3. Client 接线(`apply.ts` + `contract/props.ts`)

`FocusViewInjected` 增加:

```ts
turnIndex(sessionId: SessionId): Promise<TurnSummary[]>          // 失败 reject
turnEvents(sessionId: SessionId, turn: number): Promise<TurnSlice>
```

实现:`ctx.connection.rpc.call('/focus-chat-api', …)`(mineru 先例);apply 闭包 `Map<SessionId, TurnSummary[]>` 缓存索引(tab 切换存活),切片缓存放视图层。

### 4. 视图与 flow 集成

- **windowHead**:`min(anchorSeq over chat.nodes.values())`(memo 按 chat 引用)。
- **远端 turn 判定**(每次 flow 组合时无状态计算):索引中 `startSeq < windowHead` 的已完成 turn;
- **隐藏窗口行**:`buildFocusFlow` 增加 `hideTurns?: ReadonlySet<number>` 参数——`pushItem` 对 `nodeTurn.get(key) ∈ hideTurns` 的 item 直接跳过(边界 turn 的窗口残行不再双渲染;运行中 turn 不在索引里,永不隐藏);
- **flow 组成**:`[remote-turn 行…] + buildFocusFlow(…, hideTurns)`;
- **首帧门控**:索引请求落定(成功或失败)后才做开屏滚动恢复——首帧即含折叠总览,无位移;索引失败降级为现状(无折叠行),console.warn。

### 5. `remote-turn` flow item(`model/types.ts`)

```ts
| {
  kind: 'remote-turn'
  nodeKey: string                 // `remote-turn:${turn}`
  turn: number
  summary: TurnSummary
  state: 'collapsed' | 'loading' | 'loaded' | 'error'
  work: readonly FocusFlowItem[]  // loaded 时:context-fold、work 行(含分段折叠)
  closing: FocusFlowItem | null   // loaded 时:结束回复 assistant 行
  tail: FocusFlowItem | null      // loaded 时:turn-tail 行
  error: string | null
}
```

- 折叠态渲染:开场用户气泡(真实 MessageRow)+ 折叠行(复用 TurnFoldRow 的「工作了 X 分 Y 秒/用户 X 后停止」视觉)+ 结束回复单行预览(弱化色)。
- 展开态:开场气泡 + 折叠行(展开)+ `work` 行 + `closing` + `tail`——全部复用现有 FlowRow/TurnTailRow。
- 展开交互在 `RemoteTurnRow.tsx` 内:点击 → `turnEvents` → `projectTurnSlice` → 父级缓存(版本计数驱动重渲);失败行内错误 + 重试;collapsed → expanded 本地状态(同 TurnFoldRow 的 useState)。
- 切片缓存:`Map<turn, 切片>` LRU(上限 ~12 turn)。

### 6. 切片投影(`src/client/model/turn-slice.ts`)

`projectTurnSlice(events, cwd, home) → { work, closing, tail }`:

- 位置游标划 step/turn;**settled 历史不消费 chunk rows**(`assistant/message` 即最终块;`toAssistantBlocks` 语义重实现:content switch,已核对源码);
- 消息分类:`source.kind !== 'user'` → context(`contextProvenance`/`contextForm` 同语义重实现);step 开始后的 user 源消息 → steering;pre-step user 消息不进 work(折叠态已画);
- 工具:`tool/call`(running block:`{callId,name,argsRaw,time,subCalls:[]}`)+ `tool/result`(`message.source.callId` 配对 → ToolResultNode:`call`、`content`、`isError`、`error`、`meta`);`tool/code-dispatch-start|code-dispatch` 按 subCallId/parentCallId 挂 subCalls;
- 命令/压缩/重试/turn-error/turn-max-tokens:`command/run|done` 按 commandId 配对;`compaction/*`;`llm/retry`(历史 retryState:切片内其后存在 turn/start → 'started',否则 'cancelled');`turn/end` reason → turn-error / turn-max-tokens;
- 折叠语义与 `flow.ts` 当前实现逐条对齐(0.1.22):连续 tool-call 归组、直连组合并、turn-less notice 注入折叠进相邻 run 组并计入 background-jobs、steering 切段、closing reasoning 移入折叠段;
- 复用 `toolGroup`/`toolRowModel` 产出 work;`closing` = assistant 行(带 finalSeq/messageId);`tail` = turn-tail 行(`runMs = end-start`,`branchUnavailable: true`,`produced: []`,`tokenUsage/ttft/tokensPerSecond` 尽力而为,缺省 null)。

### 7. 边界

| 场景 | 行为 |
|---|---|
| compaction shadow 过的旧 turn | 仍出折叠行(日志完整保留,阅读视图保历史);窗口内 summary 行照旧 |
| 边界 turn(start < head ≤ end) | 走远端折叠,窗口残行被 hideTurns 隐藏 |
| 运行中的 turn / 新 turn | 不在索引(未完成),照旧窗口渲染 |
| loadOlder 翻页后 | windowHead 下移,翻入窗口的 turn 自动从远端行切换为窗口行(anchor 机制保滚动) |
| 索引/切片 RPC 失败 | 索引失败:降级现状;切片失败:行内错误 + 重试 |
| 空会话 / 单页会话 | hasMore=false ⟹ windowHead=0 ⟹ 无远端行,零开销 |

## 实施计划

| # | 内容 | 产出 |
|---|---|---|
| 1 | 协议 + host 索引纯函数 | `src/protocol.ts`、`src/host/turn-index.ts`、`tests/turn-index.spec.ts` |
| 2 | host RPC 装配 | `src/index.ts`、`src/host/rpc.ts`(handler 单测并入 1) |
| 3 | 切片投影 | `src/client/model/turn-slice.ts`、`tests/turn-slice.spec.ts` |
| 4 | flow 集成(hideTurns + remote-turn item) | `model/flow.ts`、`model/types.ts`、`tests/focus-view.spec.tsx` 增补 |
| 5 | 视图(RemoteTurnRow + 门控 + 缓存) | `view/rows/RemoteTurnRow.tsx(+css)`、`view/FocusView.tsx`、`contract/props.ts`、`apply.ts`、`locales.ts`、`tests/remote-fold.spec.tsx` |
| 6 | 收尾 | README 双语、版本号、`yarn typecheck && yarn test && yarn build` |

每步交付即可独立验证;3 完成前 5 的展开态用注入回调 mock 先行。
