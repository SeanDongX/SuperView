export type Language = "en" | "zh-CN";
export type TokenChartCopy = {
  defaultTitle: string;
  eyebrow: string;
  loading: string;
  visibleDays: (count: number) => string;
  noVisibleDays: string;
  summaryAria: string;
  totalTokens: string;
  kvHit: string;
  hideChart: string;
  showChart: string;
  breakdownAria: string;
  chartAria: string;
  chartTitle: string;
  totalSuffix: string;
  trendLabel: string;
  tokenSuffix: string;
  input: string;
  cachedInput: string;
  output: string;
  reasoning: string;
  totalTrend: string;
  legendAria: string;
  emptyLoading: string;
  empty: string;
};

export type IngestCopy = {
  kicker: string;
  completed: string;
  failed: string;
  running: string;
  files: string;
  phase: string;
  current: string;
  waitingFile: string;
  coins: string;
  clearedBlocks: string;
  hazards: string;
  events: string;
  aria: (status: string, phase: string, processed: number, total: number, percent: number) => string;
};

export type AppCopy = {
  brandSubtitle: string;
  language: { short: string; aria: string; title: string };
  theme: { aria: string };
  topbar: { agentLogRoot: string; agentLogRootAria: string; agentLogRootPlaceholder: string; source: string; sourceAria: string; scan: string };
  title: { eyebrow: string; emptyProject: string; lead: string };
  projectControls: { provider: string; providerAria: string; project: string; projectAria: string; all: string; noProvider: string };
  metrics: { projects: string; events: string; tasks: string; tokens: string; kvHit: string; showDailyTokens: string; hideDailyTokens: string; dailyUsageByDay: string };
  empty: {
    loadingTitle: string;
    loadingDetail: string;
    noRunsTitle: string;
    noRunsDetail: string;
    noProviderTitle: string;
    noProviderDetail: string;
    source: string;
    sourceAria: string;
    root: string;
    rootAria: string;
  };
  loading: { scanningLogs: string; loadingTimeline: string; loadingIndex: string; loadingDailyTokens: string; steady: string; aria: string };
  timeline: {
    heading: string;
    rangeOf: string;
    loaded: (tasks: number, events: number) => string;
    prevPage: string;
    nextPage: string;
    emptyPage: string;
    aria: string;
    nextInput: string;
    sessionEnd: string;
    eventCount: (count: number) => string;
    loadingDetails: string;
    tokens: string;
    agentWork: string;
    viewProcess: string;
    hideProcess: string;
    backgroundWork: string;
    log: string;
    entries: string;
    noBackground: string;
    noLog: string;
    user: string;
    expand: string;
    collapse: string;
    skills: string;
  };
  evidence: {
    heading: string;
    loading: string;
    kind: string;
    time: string;
    tool: string;
    call: string;
    noDetail: string;
    artifacts: string;
    inlineEvidence: string;
    noArtifacts: string;
    rawEvent: string;
    noRawEvent: string;
    empty: string;
  };
  ingest: IngestCopy;
  tokenChart: TokenChartCopy;
};

export function normalizeLanguage(value: string | null): Language {
  return value === "zh-CN" ? "zh-CN" : "en";
}

export const COPY: Record<Language, AppCopy> = {
  en: {
    brandSubtitle: "Agent timeline command center",
    language: {
      short: "中",
      aria: "Switch language to Simplified Chinese",
      title: "Switch language to Simplified Chinese"
    },
    theme: {
      aria: "Toggle theme"
    },
    topbar: {
      agentLogRoot: "Agent log root",
      agentLogRootAria: "Agent log root path",
      agentLogRootPlaceholder: "Blank scans default Codex logs",
      source: "Source",
      sourceAria: "Agent log source",
      scan: "Scan Agent Logs"
    },
    title: {
      eyebrow: "Project Timeline",
      emptyProject: "No project indexed yet",
      lead: "Replay each user input as an agent conversation, with background work available on demand."
    },
    projectControls: {
      provider: "Provider",
      providerAria: "Project provider",
      project: "Project",
      projectAria: "Project",
      all: "All",
      noProvider: "No provider"
    },
    metrics: {
      projects: "Projects",
      events: "Events",
      tasks: "Tasks",
      tokens: "Tokens",
      kvHit: "KV hit",
      showDailyTokens: "Show daily token usage chart",
      hideDailyTokens: "Hide daily token usage chart",
      dailyUsageByDay: "Daily usage by day"
    },
    empty: {
      loadingTitle: "Loading SuperView index",
      loadingDetail: "Checking local SQLite state.",
      noRunsTitle: "No agent runs indexed",
      noRunsDetail: "Scan local Codex, Claude Code, or OpenCode logs to build the first timeline.",
      noProviderTitle: "No projects for this provider",
      noProviderDetail: "Switch the project filter to All, or scan logs for the selected provider.",
      source: "Agent log source",
      sourceAria: "Empty agent log source",
      root: "Agent log root path",
      rootAria: "Empty agent log root path"
    },
    loading: {
      scanningLogs: "Scanning agent logs",
      loadingTimeline: "Loading timeline page",
      loadingIndex: "Loading SuperView index",
      loadingDailyTokens: "Loading daily token usage",
      steady: "Keeping the workspace steady while SuperView updates.",
      aria: "Blocking operation"
    },
    timeline: {
      heading: "CLI Conversation",
      rangeOf: "of",
      loaded: (tasks: number, events: number) => `${tasks} task journeys loaded from ${events} events`,
      prevPage: "Prev page",
      nextPage: "Next page",
      emptyPage: "No user-input task journeys are visible on this page.",
      aria: "Task conversation thread",
      nextInput: "Next input",
      sessionEnd: "Session end",
      eventCount: (count: number) => `${count} events`,
      loadingDetails: "Loading details",
      tokens: "tokens",
      agentWork: "Agent work",
      viewProcess: "View process...",
      hideProcess: "Hide process...",
      backgroundWork: "Background Work",
      log: "Log",
      entries: "entries",
      noBackground: "No background work captured for this task.",
      noLog: "No tool or verification log entries captured.",
      user: "User",
      expand: "Expand",
      collapse: "Collapse",
      skills: "Skills"
    },
    evidence: {
      heading: "Evidence",
      loading: "Loading",
      kind: "Kind",
      time: "Time",
      tool: "Tool",
      call: "Call",
      noDetail: "No detail captured.",
      artifacts: "Artifacts",
      inlineEvidence: "Inline evidence",
      noArtifacts: "No artifacts attached to this event.",
      rawEvent: "Raw Event",
      noRawEvent: "No raw event reference available.",
      empty: "Select an episode, timeline event, or replay node to inspect redacted evidence."
    },
    ingest: {
      kicker: "Ingest level",
      completed: "Castle clear",
      failed: "Level failed",
      running: "Running level",
      files: "files",
      phase: "Phase",
      current: "Current",
      waitingFile: "Waiting for next file",
      coins: "Coins",
      clearedBlocks: "Cleared blocks",
      hazards: "Hazards",
      events: "Events",
      aria: (status: string, phase: string, processed: number, total: number, percent: number) => `Ingest ${status}, ${phase}, ${processed} of ${total} files processed, ${percent} percent`
    },
    tokenChart: {
      defaultTitle: "Daily Token Usage",
      eyebrow: "Tokens",
      loading: "Loading daily usage",
      visibleDays: (count: number) => `${count} visible day${count === 1 ? "" : "s"}`,
      noVisibleDays: "No visible days",
      summaryAria: "Daily token usage summary",
      totalTokens: "Total tokens",
      kvHit: "KV hit",
      hideChart: "Hide daily token usage chart",
      showChart: "Show daily token usage chart",
      breakdownAria: "Visible token usage breakdown",
      chartAria: "Daily token usage chart",
      chartTitle: "Daily token usage by date",
      totalSuffix: "total tokens",
      trendLabel: "trend",
      tokenSuffix: "tokens",
      input: "Input",
      cachedInput: "Cached input",
      output: "Output",
      reasoning: "Reasoning",
      totalTrend: "Total trend",
      legendAria: "Token usage legend",
      emptyLoading: "Loading daily token usage...",
      empty: "No daily token usage yet."
    }
  },
  "zh-CN": {
    brandSubtitle: "Agent 时间线指挥中心",
    language: {
      short: "EN",
      aria: "切换语言到英文",
      title: "切换语言到英文"
    },
    theme: {
      aria: "切换主题"
    },
    topbar: {
      agentLogRoot: "Agent 日志根目录",
      agentLogRootAria: "Agent 日志根目录路径",
      agentLogRootPlaceholder: "留空则扫描默认 Codex 日志",
      source: "来源",
      sourceAria: "Agent 日志来源",
      scan: "扫描 Agent 日志"
    },
    title: {
      eyebrow: "项目时间线",
      emptyProject: "还没有索引项目",
      lead: "把每次用户输入还原成一轮 agent 对话，需要时再展开后台工作过程。"
    },
    projectControls: {
      provider: "来源",
      providerAria: "项目来源",
      project: "项目",
      projectAria: "项目",
      all: "全部",
      noProvider: "无来源"
    },
    metrics: {
      projects: "项目",
      events: "事件",
      tasks: "任务",
      tokens: "Tokens",
      kvHit: "KV 命中",
      showDailyTokens: "显示按天 token 用量图",
      hideDailyTokens: "隐藏按天 token 用量图",
      dailyUsageByDay: "按天用量"
    },
    empty: {
      loadingTitle: "正在加载 SuperView 索引",
      loadingDetail: "正在检查本地 SQLite 状态。",
      noRunsTitle: "还没有索引 Agent Runs",
      noRunsDetail: "扫描本地 Codex、Claude Code 或 OpenCode 日志，生成第一条时间线。",
      noProviderTitle: "这个来源下还没有项目",
      noProviderDetail: "把项目过滤切到全部，或者扫描当前来源的日志。",
      source: "Agent 日志来源",
      sourceAria: "空状态 Agent 日志来源",
      root: "Agent 日志根目录路径",
      rootAria: "空状态 Agent 日志根目录路径"
    },
    loading: {
      scanningLogs: "正在扫描 agent 日志",
      loadingTimeline: "正在加载时间线分页",
      loadingIndex: "正在加载 SuperView 索引",
      loadingDailyTokens: "正在加载按天 token 用量",
      steady: "SuperView 更新中，暂时锁定工作区。",
      aria: "阻塞操作"
    },
    timeline: {
      heading: "CLI 对话",
      rangeOf: "/",
      loaded: (tasks: number, events: number) => `已从 ${events} 个事件加载 ${tasks} 轮任务旅程`,
      prevPage: "上一页",
      nextPage: "下一页",
      emptyPage: "当前页没有可见的用户输入任务旅程。",
      aria: "任务对话 thread",
      nextInput: "下一次输入",
      sessionEnd: "Session 结束",
      eventCount: (count: number) => `${count} 个事件`,
      loadingDetails: "正在加载细节",
      tokens: "tokens",
      agentWork: "Agent 工作过程",
      viewProcess: "查看过程...",
      hideProcess: "收起过程...",
      backgroundWork: "后台工作",
      log: "日志",
      entries: "条",
      noBackground: "这轮任务没有捕获到后台工作过程。",
      noLog: "没有捕获到 tool 或 verification 日志。",
      user: "用户",
      expand: "展开",
      collapse: "收起",
      skills: "Skills"
    },
    evidence: {
      heading: "证据",
      loading: "加载中",
      kind: "类型",
      time: "时间",
      tool: "工具",
      call: "调用",
      noDetail: "没有捕获到详情。",
      artifacts: "Artifacts",
      inlineEvidence: "Inline evidence",
      noArtifacts: "这个事件没有附加 artifacts。",
      rawEvent: "原始事件",
      noRawEvent: "没有可用的原始事件引用。",
      empty: "选择一个 episode、timeline event 或 replay node，查看 redacted evidence。"
    },
    ingest: {
      kicker: "Ingest 关卡",
      completed: "城堡通关",
      failed: "关卡失败",
      running: "关卡运行中",
      files: "文件",
      phase: "阶段",
      current: "当前",
      waitingFile: "等待下一个文件",
      coins: "金币",
      clearedBlocks: "已清理砖块",
      hazards: "障碍",
      events: "事件",
      aria: (status: string, phase: string, processed: number, total: number, percent: number) => `Ingest ${status}，${phase}，已处理 ${processed}/${total} 个文件，进度 ${percent}%`
    },
    tokenChart: {
      defaultTitle: "按天 Token 用量",
      eyebrow: "Tokens",
      loading: "正在加载按天用量",
      visibleDays: (count: number) => `${count} 个可见日期`,
      noVisibleDays: "没有可见日期",
      summaryAria: "按天 token 用量摘要",
      totalTokens: "总 tokens",
      kvHit: "KV 命中",
      hideChart: "隐藏按天 token 用量图",
      showChart: "显示按天 token 用量图",
      breakdownAria: "可见 token 用量拆分",
      chartAria: "按天 token 用量图",
      chartTitle: "按日期统计的 token 用量",
      totalSuffix: "总 tokens",
      trendLabel: "趋势",
      tokenSuffix: "tokens",
      input: "Input",
      cachedInput: "Cached input",
      output: "Output",
      reasoning: "Reasoning",
      totalTrend: "总趋势",
      legendAria: "Token 用量图例",
      emptyLoading: "正在加载按天 token 用量...",
      empty: "还没有按天 token 用量。"
    }
  }
};
