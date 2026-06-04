import { AlertTriangle, ChartColumn, FileText, Languages, Moon, RotateCw, Search, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AgentProvider,
  Artifact,
  DailyTokenUsageResponse,
  EventEvidence,
  IngestJob,
  ProjectTimeline,
  SkillUsage,
  TaskJourney,
  TaskJourneyDetail,
  TimelineEvent,
  TokenUsage
} from "../../core/types";
import {
  fetchDailyTokenUsage,
  fetchEventEvidence,
  fetchIngestJob,
  fetchProjects,
  fetchTaskJourneyDetail,
  fetchTimeline,
  ProjectWithSessions,
  startIngest
} from "./api";
import { DailyTokenUsagePanel } from "./DailyTokenUsagePanel";
import { AppCopy, COPY, IngestCopy, Language, normalizeLanguage } from "./i18n";
import { IngestLevelProgress } from "./IngestLevelProgress";
import { formatMillionTokens } from "./tokenFormat";

type Theme = "light" | "dark";
type ProjectProviderFilter = AgentProvider | "all";
type MetricKey = "projects" | "events" | "tasks" | "tokens";

const TIMELINE_LIMIT = 300;

export function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("superview-theme") as Theme | null) ?? "light");
  const [language, setLanguage] = useState<Language>(() => normalizeLanguage(localStorage.getItem("superview-language")));
  const [projects, setProjects] = useState<ProjectWithSessions[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<ProjectTimeline | null>(null);
  const [timelineOffset, setTimelineOffset] = useState(0);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [dailyTokenUsage, setDailyTokenUsage] = useState<DailyTokenUsageResponse | null>(null);
  const [dailyTokenUsageLoading, setDailyTokenUsageLoading] = useState(false);
  const [tokenChartExpanded, setTokenChartExpanded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [journeyDetails, setJourneyDetails] = useState<Record<string, TaskJourneyDetail>>({});
  const [journeyLoadingIds, setJourneyLoadingIds] = useState<Record<string, boolean>>({});
  const journeyLoadingRef = useRef(new Set<string>());
  const [expandedJourneyIds, setExpandedJourneyIds] = useState<Record<string, boolean>>({});
  const [eventEvidence, setEventEvidence] = useState<EventEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [job, setJob] = useState<IngestJob | null>(null);
  const [agentProvider, setAgentProvider] = useState<AgentProvider>("codex");
  const [projectProviderFilter, setProjectProviderFilter] = useState<ProjectProviderFilter>("all");
  const [agentLogRoot, setAgentLogRoot] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[language];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("superview-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("superview-language", language);
  }, [language]);

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadTimeline(selectedProjectId, 0);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setDailyTokenUsage(null);
      return;
    }
    void loadDailyTokenUsage(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    const filtered = filterProjectsByProvider(projects, projectProviderFilter);
    if (filtered.length === 0) {
      setSelectedProjectId(null);
      setTimeline(null);
      setSelectedEvent(null);
      return;
    }
    if (!selectedProjectId || !filtered.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(filtered[0].id);
    }
  }, [projects, projectProviderFilter, selectedProjectId]);

  useEffect(() => {
    if (!selectedEvent) {
      setEventEvidence(null);
      return;
    }

    let cancelled = false;
    setEvidenceLoading(true);
    void fetchEventEvidence(selectedEvent.id)
      .then((next) => {
        if (!cancelled) {
          setEventEvidence(next);
          setError(null);
        }
      })
      .catch((evidenceError) => {
        if (!cancelled) {
          setEventEvidence({ event: selectedEvent, artifacts: [], rawEvent: null });
          setError(evidenceError instanceof Error ? evidenceError.message : String(evidenceError));
        }
      })
      .finally(() => {
        if (!cancelled) setEvidenceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEvent]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const timer = window.setInterval(async () => {
      const next = await fetchIngestJob(job.id);
      setJob(next);
      if (next.status === "completed") {
        await loadProjects();
        if (selectedProjectId) await loadDailyTokenUsage(selectedProjectId);
      }
    }, 700);
    return () => window.clearInterval(timer);
  }, [job, selectedProjectId]);

  async function loadProjects() {
    setLoading(true);
    try {
      const next = await fetchProjects();
      setProjects(next);
      setSelectedProjectId((current) => current ?? next[0]?.id ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function loadTimeline(projectId: string, offset: number) {
    setTimelineLoading(true);
    try {
      const next = await fetchTimeline(projectId, { limit: TIMELINE_LIMIT, offset });
      setTimeline(next);
      setTimelineOffset(next.offset ?? offset);
      setSelectedEvent(next.events[0] ?? null);
      setExpandedJourneyIds({});
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setTimelineLoading(false);
    }
  }

  async function loadDailyTokenUsage(projectId: string) {
    setDailyTokenUsageLoading(true);
    try {
      const next = await fetchDailyTokenUsage(projectId);
      setDailyTokenUsage(next);
      setError(null);
    } catch (loadError) {
      setDailyTokenUsage(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setDailyTokenUsageLoading(false);
    }
  }

  async function loadNextTimelinePage() {
    if (!selectedProjectId || !timeline) return;
    const nextOffset = timelineOffset + (timeline.limit ?? TIMELINE_LIMIT);
    await loadTimeline(selectedProjectId, nextOffset);
  }

  async function loadPreviousTimelinePage() {
    if (!selectedProjectId) return;
    const previousOffset = Math.max(0, timelineOffset - TIMELINE_LIMIT);
    await loadTimeline(selectedProjectId, previousOffset);
  }

  async function handleScan() {
    if (isIngestBusy(job)) return;
    setError(null);
    try {
      const root = agentLogRoot.trim();
      const jobId = await startIngest(root ? { sources: [{ provider: agentProvider, root, path: root }] } : { sources: [{ provider: agentProvider }] });
      setJob(await fetchIngestJob(jobId));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : String(scanError));
    }
  }

  async function loadJourneyDetail(journeyId: string, projectId = selectedProjectId ?? undefined) {
    if (journeyDetails[journeyId] || journeyLoadingRef.current.has(journeyId)) return;
    journeyLoadingRef.current.add(journeyId);
    setJourneyLoadingIds((current) => ({ ...current, [journeyId]: true }));
    try {
      const detail = await fetchTaskJourneyDetail(journeyId, projectId);
      setJourneyDetails((current) => ({ ...current, [journeyId]: detail }));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      journeyLoadingRef.current.delete(journeyId);
      setJourneyLoadingIds((current) => ({ ...current, [journeyId]: false }));
    }
  }

  function toggleJourneyDetails(journeyId: string) {
    setExpandedJourneyIds((current) => {
      const nextExpanded = !current[journeyId];
      if (nextExpanded) void loadJourneyDetail(journeyId);
      return { ...current, [journeyId]: nextExpanded };
    });
  }

  const filteredProjects = useMemo(() => filterProjectsByProvider(projects, projectProviderFilter), [projects, projectProviderFilter]);
  const selectedProject = filteredProjects.find((project) => project.id === selectedProjectId) ?? null;
  const journeys = timeline?.taskJourneys ?? [];
  const timelineEventsById = useMemo(() => new Map((timeline?.events ?? []).map((event) => [event.id, event])), [timeline]);
  const drawerEvent = selectedEvent;
  const drawerEvidence = eventEvidence?.event.id === drawerEvent?.id ? eventEvidence : null;
  const drawerArtifacts = drawerEvidence?.artifacts ?? [];
  const totalEvents = timeline?.totalEvents ?? timeline?.events.length ?? 0;
  const currentLimit = timeline?.limit ?? TIMELINE_LIMIT;
  const pageEnd = Math.min(timelineOffset + (timeline?.events.length ?? 0), totalEvents);
  const hasPreviousPage = timelineOffset > 0;
  const hasNextPage = totalEvents > timelineOffset + currentLimit;
  const projectTokenUsage = selectedProject?.tokenUsage ?? timeline?.tokenUsage ?? ZERO_TOKEN_USAGE;
  const ingestBusy = isIngestBusy(job);
  const blockingMessage = getBlockingMessage({ copy, loading, timelineLoading, ingestBusy, dailyTokenUsageLoading });
  const blockingJob = getBlockingJob({ job, message: blockingMessage, ingestBusy, loading, timelineLoading, dailyTokenUsageLoading });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>SuperView</strong>
          <span>{copy.brandSubtitle}</span>
        </div>
        <div className="topbar-actions">
          <label className="agent-root-control">
            <span>{copy.topbar.agentLogRoot}</span>
            <input
              aria-label={copy.topbar.agentLogRootAria}
              value={agentLogRoot}
              onChange={(event) => setAgentLogRoot(event.target.value)}
              placeholder={copy.topbar.agentLogRootPlaceholder}
              disabled={ingestBusy}
            />
          </label>
          <label className="agent-provider-control">
            <span>{copy.topbar.source}</span>
            <select aria-label={copy.topbar.sourceAria} value={agentProvider} onChange={(event) => setAgentProvider(event.target.value as AgentProvider)} disabled={ingestBusy}>
              <option value="codex">Codex</option>
              <option value="claude-code">Claude Code</option>
              <option value="opencode">OpenCode</option>
            </select>
          </label>
          <button className="shell-button" onClick={handleScan} disabled={ingestBusy}>
            <RotateCw size={16} />
            {copy.topbar.scan}
          </button>
          <button
            className="shell-button language-toggle-button"
            aria-label={copy.language.aria}
            title={copy.language.title}
            onClick={() => setLanguage((current) => (current === "en" ? "zh-CN" : "en"))}
          >
            <Languages size={16} />
            {copy.language.short}
          </button>
          <button className="icon-button" aria-label={copy.theme.aria} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="title-row">
          <div>
            <p className="eyebrow">{copy.title.eyebrow}</p>
            <h1>{selectedProject?.name ?? copy.title.emptyProject}</h1>
            <p className="lead">{copy.title.lead}</p>
          </div>
          <div className="title-actions">
            <div className="project-controls-panel">
              <label className="project-control">
                <span className="field-label">{copy.projectControls.provider}</span>
                <select aria-label={copy.projectControls.providerAria} value={projectProviderFilter} onChange={(event) => setProjectProviderFilter(event.target.value as ProjectProviderFilter)} disabled={timelineLoading || ingestBusy}>
                  <option value="all">{copy.projectControls.all}</option>
                  <option value="codex">Codex</option>
                  <option value="claude-code">Claude Code</option>
                  <option value="opencode">OpenCode</option>
                </select>
              </label>
              <label className="project-control" htmlFor="project-select">
                <span className="field-label">{copy.projectControls.project}</span>
                <select id="project-select" aria-label={copy.projectControls.projectAria} value={selectedProjectId ?? ""} onChange={(event) => setSelectedProjectId(event.target.value)} disabled={filteredProjects.length === 0 || timelineLoading || ingestBusy}>
                  {filteredProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} - {providerSummary(project, copy)} - {formatMillionTokens(project.tokenUsage.total)} {copy.timeline.tokens} / KV {formatKvHitRate(project.tokenUsage)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="status-cluster">
              <Metric metricKey="projects" label={copy.metrics.projects} value={filteredProjects.length} />
              <Metric metricKey="events" label={copy.metrics.events} value={totalEvents} />
              <Metric metricKey="tasks" label={copy.metrics.tasks} value={timeline?.taskJourneys.length ?? 0} />
              <Metric
                metricKey="tokens"
                label={copy.metrics.tokens}
                value={projectTokenUsage.total}
                action={
                  selectedProject ? (
                    <button
                      className="metric-icon-button"
                      type="button"
                      aria-label={tokenChartExpanded ? copy.metrics.hideDailyTokens : copy.metrics.showDailyTokens}
                      aria-expanded={tokenChartExpanded}
                      onClick={() => setTokenChartExpanded((current) => !current)}
                    >
                      <ChartColumn size={15} />
                    </button>
                  ) : null
                }
                overlay={
                  selectedProject && tokenChartExpanded ? (
                    <DailyTokenUsagePanel
                      copy={copy.tokenChart}
                      data={dailyTokenUsage}
                      loading={dailyTokenUsageLoading}
                      title={copy.metrics.tokens}
                      subtitle={copy.metrics.dailyUsageByDay}
                      maxVisiblePoints={30}
                      className="token-chart-panel--metric-popover"
                      showHeaderToggle={false}
                      expanded={tokenChartExpanded}
                      onExpandedChange={setTokenChartExpanded}
                    />
                  ) : null
                }
              />
              <RatioMetric label={copy.metrics.kvHit} value={formatKvHitRate(projectTokenUsage)} />
            </div>
          </div>
        </section>

        {error ? <div className="alert"><AlertTriangle size={16} />{error}</div> : null}
        {job && !ingestBusy ? <IngestLevelProgress job={job} copy={copy.ingest} /> : null}
        {blockingMessage ? <BlockingLoader copy={copy.loading} ingestCopy={copy.ingest} message={blockingMessage} job={blockingJob} /> : null}

        {loading ? (
          <EmptyState
            copy={copy.empty}
            title={copy.empty.loadingTitle}
            detail={copy.empty.loadingDetail}
            agentProvider={agentProvider}
            onAgentProviderChange={setAgentProvider}
            agentLogRoot={agentLogRoot}
            onAgentLogRootChange={setAgentLogRoot}
            onScan={handleScan}
            disabled={ingestBusy}
            scanLabel={copy.topbar.scan}
            placeholder={copy.topbar.agentLogRootPlaceholder}
          />
        ) : projects.length === 0 ? (
          <EmptyState
            copy={copy.empty}
            title={copy.empty.noRunsTitle}
            detail={copy.empty.noRunsDetail}
            agentProvider={agentProvider}
            onAgentProviderChange={setAgentProvider}
            agentLogRoot={agentLogRoot}
            onAgentLogRootChange={setAgentLogRoot}
            onScan={handleScan}
            disabled={ingestBusy}
            scanLabel={copy.topbar.scan}
            placeholder={copy.topbar.agentLogRootPlaceholder}
          />
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            copy={copy.empty}
            title={copy.empty.noProviderTitle}
            detail={copy.empty.noProviderDetail}
            agentProvider={agentProvider}
            onAgentProviderChange={setAgentProvider}
            agentLogRoot={agentLogRoot}
            onAgentLogRootChange={setAgentLogRoot}
            onScan={handleScan}
            disabled={ingestBusy}
            scanLabel={copy.topbar.scan}
            placeholder={copy.topbar.agentLogRootPlaceholder}
          />
        ) : (
          <div className="dashboard-grid conversation-dashboard-grid">
            <section className="timeline-panel">
              <div className="panel-heading">
                <FileText size={17} />
                <span>{copy.timeline.heading}</span>
                <em>
                  {timelineOffset + 1}-{pageEnd} {copy.timeline.rangeOf} {totalEvents}
                </em>
              </div>
              <div className="timeline-controls">
                <span>{copy.timeline.loaded(timeline?.taskJourneys.length ?? 0, timeline?.events.length ?? 0)}</span>
                <div>
                  <button className="secondary-button" onClick={loadPreviousTimelinePage} disabled={!hasPreviousPage || timelineLoading || ingestBusy}>
                    {copy.timeline.prevPage}
                  </button>
                  <button className="secondary-button" onClick={loadNextTimelinePage} disabled={!hasNextPage || timelineLoading || ingestBusy}>
                    {copy.timeline.nextPage}
                  </button>
                </div>
              </div>
              <ConversationThread
                copy={copy.timeline}
                journeys={journeys}
                detailsByJourneyId={journeyDetails}
                timelineEventsById={timelineEventsById}
                expandedJourneyIds={expandedJourneyIds}
                loadingJourneyIds={journeyLoadingIds}
                selectedEventId={drawerEvent?.id ?? null}
                onToggleDetails={toggleJourneyDetails}
                onSelectEvent={(event) => setSelectedEvent(event)}
              />
            </section>

            <EvidenceDrawer copy={copy.evidence} event={drawerEvent ?? null} artifacts={drawerArtifacts} rawEvent={drawerEvidence?.rawEvent ?? null} loading={evidenceLoading} />
          </div>
        )}
      </main>
    </div>
  );
}

function eventItemClass(event: TimelineEvent, selectedId: string | null) {
  const classes = ["log-entry", event.status];
  if (event.id === selectedId) classes.push("selected");
  return classes.join(" ");
}

function ConversationThread({
  copy,
  journeys,
  detailsByJourneyId,
  timelineEventsById,
  expandedJourneyIds,
  loadingJourneyIds,
  selectedEventId,
  onToggleDetails,
  onSelectEvent
}: {
  copy: AppCopy["timeline"];
  journeys: TaskJourney[];
  detailsByJourneyId: Record<string, TaskJourneyDetail>;
  timelineEventsById: Map<string, TimelineEvent>;
  expandedJourneyIds: Record<string, boolean>;
  loadingJourneyIds: Record<string, boolean>;
  selectedEventId: string | null;
  onToggleDetails: (journeyId: string) => void;
  onSelectEvent: (event: TimelineEvent) => void;
}) {
  if (journeys.length === 0) {
    return <p className="muted">{copy.emptyPage}</p>;
  }

  return (
    <div className="conversation-thread" aria-label={copy.aria}>
      {journeys.map((journey) => (
        <ConversationTurn
          key={journey.id}
          copy={copy}
          journey={journey}
          detail={detailsByJourneyId[journey.id] ?? null}
          fallbackPrompt={timelineEventsById.get(journey.promptEventId) ?? null}
          expanded={Boolean(expandedJourneyIds[journey.id])}
          loading={Boolean(loadingJourneyIds[journey.id])}
          selectedEventId={selectedEventId}
          onToggleDetails={() => onToggleDetails(journey.id)}
          onSelectEvent={onSelectEvent}
        />
      ))}
    </div>
  );
}

function ConversationTurn({
  copy,
  journey,
  detail,
  fallbackPrompt,
  expanded,
  loading,
  selectedEventId,
  onToggleDetails,
  onSelectEvent
}: {
  copy: AppCopy["timeline"];
  journey: TaskJourney;
  detail: TaskJourneyDetail | null;
  fallbackPrompt: TimelineEvent | null;
  expanded: boolean;
  loading: boolean;
  selectedEventId: string | null;
  onToggleDetails: () => void;
  onSelectEvent: (event: TimelineEvent) => void;
}) {
  const events = detail?.events ?? [];
  const prompt = fallbackPrompt ?? events.find((event) => event.id === journey.promptEventId || event.kind === "user_prompt");
  const assistantMessage = events.find((event) => event.kind === "assistant_message");
  const backgroundEvents = events.filter((event) => event.kind !== "user_prompt" && event.id !== assistantMessage?.id);
  const logEvents = events.filter((event) => event.kind === "tool_call" || event.kind === "tool_result" || event.kind === "file_change" || event.kind === "verification" || event.kind === "error");
  const skills = aggregateSkills(journey.skills, events);
  const agentOutput = assistantMessage?.detail ?? assistantMessage?.title ?? journey.summary;
  const provider = prompt ? providerFromSessionId(prompt.sessionId) : providerFromSessionId(journey.sessionId);
  const agentLabel = labelForProvider(provider);
  const promptText = prompt?.detail ?? journey.title;

  return (
    <article className={`conversation-turn ${journey.status}`}>
      <div className="conversation-summary">
        <div>
          <span>{copy.eventCount(journey.eventIds.length)}</span>
          <span>{formatExitType(journey.exitType, copy)}</span>
          <span>{formatDuration(journey.durationMs)}</span>
          <span>{formatMillionTokens(journey.tokenUsage.total)} {copy.tokens}</span>
          <span>KV {formatKvHitRate(journey.tokenUsage)}</span>
          {loading ? <span>{copy.loadingDetails}</span> : null}
        </div>
      </div>

      <ChatBubble
        copy={copy}
        variant="user"
        label={copy.user}
        text={promptText}
        skills={skills}
        selected={prompt?.id === selectedEventId}
        disabled={!prompt}
        onSelect={() => (prompt ? onSelectEvent(prompt) : undefined)}
      />

      <div className="message-row codex detail-message-row">
        <span className="message-avatar" aria-hidden="true">{avatarForProvider(provider)}</span>
        <div className="message-stack">
          <button className="conversation-message codex detail-toggle" onClick={onToggleDetails}>
            <span className="message-meta">{copy.agentWork}</span>
            <span>{expanded ? copy.hideProcess : copy.viewProcess}</span>
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="background-details">
          <section>
            <div className="detail-section-heading">
              <span>{copy.backgroundWork}</span>
              <em>{backgroundEvents.length} {copy.entries}</em>
            </div>
            <div className="log-list">
              {backgroundEvents.length > 0 ? (
                backgroundEvents.map((event) => (
                  <button key={event.id} className={eventItemClass(event, selectedEventId)} data-event-id={event.id} onClick={() => onSelectEvent(event)}>
                    <span>{event.kind}</span>
                    <strong>{event.title}</strong>
                    {event.skills && event.skills.length > 0 ? <small>{copy.skills}: {formatSkillNames(event.skills)}</small> : null}
                    <small>{event.detail ?? formatDate(event.timestamp, copy)}</small>
                  </button>
                ))
              ) : (
                <p className="muted">{copy.noBackground}</p>
              )}
            </div>
          </section>

          <section>
            <div className="detail-section-heading">
              <span>{copy.log}</span>
              <em>{logEvents.length} {copy.entries}</em>
            </div>
            <div className="log-list compact">
              {logEvents.length > 0 ? (
                logEvents.map((event) => (
                  <button key={event.id} className={eventItemClass(event, selectedEventId)} data-event-id={event.id} onClick={() => onSelectEvent(event)}>
                    <span>{event.toolName ?? event.kind}</span>
                    <strong>{event.title}</strong>
                    {event.skills && event.skills.length > 0 ? <small>{copy.skills}: {formatSkillNames(event.skills)}</small> : null}
                    <small>{event.detail ?? event.callId ?? formatDate(event.timestamp, copy)}</small>
                  </button>
                ))
              ) : (
                <p className="muted">{copy.noLog}</p>
              )}
            </div>
          </section>
        </div>
      ) : null}

      <ChatBubble
        copy={copy}
        variant="codex"
        label={agentLabel}
        text={agentOutput}
        skills={skills}
        selected={assistantMessage?.id === selectedEventId}
        disabled={!assistantMessage}
        onSelect={() => (assistantMessage ? onSelectEvent(assistantMessage) : undefined)}
      />
    </article>
  );
}

function ChatBubble({
  copy,
  variant,
  label,
  title,
  text,
  skills = [],
  selected,
  disabled,
  onSelect
}: {
  copy: AppCopy["timeline"];
  variant: "user" | "codex";
  label: string;
  title?: string;
  text: string;
  skills?: SkillUsage[];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const measure = () => {
      setCanExpand(body.scrollHeight > 250);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [text, title]);

  useEffect(() => {
    if (!canExpand) setExpanded(false);
  }, [canExpand]);

  return (
    <div className={`message-row ${variant}`}>
      <span className="message-avatar" aria-hidden="true">{variant === "user" ? "U" : "C"}</span>
      <div className="message-stack">
        <button className={`conversation-message ${variant} ${selected ? "selected" : ""}`} disabled={disabled} onClick={onSelect}>
          <span className="message-meta">{label}</span>
          <div ref={bodyRef} className="message-body" data-expanded={expanded ? "true" : "false"}>
            {title ? <strong>{title}</strong> : null}
            <p>{text}</p>
          </div>
          {skills.length > 0 ? <SkillChips copy={copy} skills={skills} /> : null}
          {canExpand && !expanded ? <span className="message-fade" aria-hidden="true" /> : null}
        </button>
        {canExpand ? (
          <button className="message-expand-toggle" onClick={() => setExpanded((current) => !current)}>
            {expanded ? copy.collapse : copy.expand}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SkillChips({ copy, skills }: { copy: AppCopy["timeline"]; skills: SkillUsage[] }) {
  const uniqueSkills = dedupeSkills(skills);
  const visibleSkills = uniqueSkills.slice(0, 4);
  const remaining = Math.max(0, uniqueSkills.length - visibleSkills.length);
  return (
    <div className="skill-chip-row" aria-label={`${copy.skills}: ${formatSkillNames(skills)}`}>
      <span className="skill-chip-label">{copy.skills}</span>
      {visibleSkills.map((skill) => (
        <span className="skill-chip" title={skill.excerpt || skill.path || skill.source} key={`${skill.name}-${skill.source}-${skill.path ?? ""}`}>
          {skill.name}
        </span>
      ))}
      {remaining > 0 ? <span className="skill-chip more">+{remaining}</span> : null}
    </div>
  );
}

function Metric({ metricKey, label, value, action, overlay }: { metricKey: MetricKey; label: string; value: number; action?: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="metric">
      <span>
        {label}
        {action}
      </span>
      <strong>{formatMetricValue(metricKey, value)}</strong>
      {overlay}
    </div>
  );
}

function RatioMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BlockingLoader({ copy, ingestCopy, message, job }: { copy: AppCopy["loading"]; ingestCopy: IngestCopy; message: string; job?: IngestJob | null }) {
  return (
    <div className="blocking-loader" role="status" aria-live="polite" aria-label={copy.aria}>
      <div className="blocking-loader-card">
        <div className="blocking-loader-message">
          <span className="blocking-loader-icon" aria-hidden="true" />
          <div>
            <strong>{message}</strong>
            <span>{copy.steady}</span>
          </div>
        </div>
        {job ? <IngestLevelProgress job={job} copy={ingestCopy} /> : null}
      </div>
    </div>
  );
}

function EmptyState({
  copy,
  title,
  detail,
  agentProvider,
  onAgentProviderChange,
  agentLogRoot,
  onAgentLogRootChange,
  onScan,
  scanLabel,
  placeholder,
  disabled = false
}: {
  copy: AppCopy["empty"];
  title: string;
  detail: string;
  agentProvider: AgentProvider;
  onAgentProviderChange: (value: AgentProvider) => void;
  agentLogRoot: string;
  onAgentLogRootChange: (value: string) => void;
  onScan: () => void;
  scanLabel: string;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <section className="empty-state">
      <Search size={34} />
      <h2>{title}</h2>
      <p>{detail}</p>
      <label className="empty-agent-provider">
        <span>{copy.source}</span>
        <select aria-label={copy.sourceAria} value={agentProvider} onChange={(event) => onAgentProviderChange(event.target.value as AgentProvider)} disabled={disabled}>
          <option value="codex">Codex</option>
          <option value="claude-code">Claude Code</option>
          <option value="opencode">OpenCode</option>
        </select>
      </label>
      <label className="empty-agent-root">
        <span>{copy.root}</span>
        <input aria-label={copy.rootAria} value={agentLogRoot} onChange={(event) => onAgentLogRootChange(event.target.value)} placeholder={placeholder} disabled={disabled} />
      </label>
      <button className="primary-button" onClick={onScan} disabled={disabled}>{scanLabel}</button>
    </section>
  );
}

function EvidenceDrawer({
  copy,
  event,
  artifacts,
  rawEvent,
  loading
}: {
  copy: AppCopy["evidence"];
  event: TimelineEvent | null;
  artifacts: Artifact[];
  rawEvent: EventEvidence["rawEvent"];
  loading: boolean;
}) {
  return (
    <aside className="evidence-drawer">
      <div className="panel-heading">
        <FileText size={17} />
        <span>{copy.heading}</span>
        {loading ? <em>{copy.loading}</em> : null}
      </div>
      {event ? (
        <>
          <div className={`status-badge ${event.status}`}>{formatEventKind(event.kind)}</div>
          <h2>{event.title}</h2>
          <dl>
            <dt>{copy.kind}</dt>
            <dd>{event.kind}</dd>
            <dt>{copy.time}</dt>
            <dd>{formatDate(event.timestamp, copy)}</dd>
            {event.toolName ? <><dt>{copy.tool}</dt><dd>{event.toolName}</dd></> : null}
            {event.callId ? <><dt>{copy.call}</dt><dd>{event.callId}</dd></> : null}
          </dl>
          <pre>{event.detail ?? copy.noDetail}</pre>
          <h3>{copy.artifacts}</h3>
          {artifacts.length > 0 ? (
            artifacts.map((artifact) => (
              <div className="artifact" key={artifact.id}>
                <strong>{artifact.type}</strong>
                <small>{artifact.path ?? copy.inlineEvidence}</small>
                <pre>{artifact.excerpt}</pre>
              </div>
            ))
          ) : (
            <p className="muted">{copy.noArtifacts}</p>
          )}
          <h3>{copy.rawEvent}</h3>
          {rawEvent ? (
            <div className="artifact">
              <strong>{rawEvent.type}</strong>
              <small>{rawEvent.sourcePath}:{rawEvent.lineNo}</small>
              <pre>{rawEvent.redactedPayloadJson}</pre>
            </div>
          ) : (
            <p className="muted">{copy.noRawEvent}</p>
          )}
        </>
      ) : (
        <p className="muted">{copy.empty}</p>
      )}
    </aside>
  );
}

function aggregateSkills(journeySkills: SkillUsage[] | undefined, events: TimelineEvent[]) {
  return dedupeSkills([...(journeySkills ?? []), ...events.flatMap((event) => event.skills ?? [])]);
}

function filterProjectsByProvider(projects: ProjectWithSessions[], provider: ProjectProviderFilter) {
  if (provider === "all") return projects;
  return projects.filter((project) => project.sessions.some((session) => session.provider === provider || session.id.startsWith(`${provider}:`)));
}

function providerSummary(project: ProjectWithSessions, copy: AppCopy) {
  const providers = new Set(project.sessions.map((session) => session.provider ?? providerFromSessionId(session.id)));
  if (providers.size === 0) return copy.projectControls.noProvider;
  return [...providers].map(labelForProvider).join("+");
}

function dedupeSkills(skills: SkillUsage[]) {
  const byName = new Map<string, SkillUsage>();
  for (const skill of skills) {
    if (!byName.has(skill.name)) byName.set(skill.name, skill);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function formatSkillNames(skills: SkillUsage[]) {
  return dedupeSkills(skills).map((skill) => skill.name).join(", ");
}

function formatExitType(exitType: TaskJourney["exitType"], copy: AppCopy["timeline"]) {
  return exitType === "next_prompt" ? copy.nextInput : copy.sessionEnd;
}

function providerFromSessionId(sessionId: string) {
  if (sessionId.startsWith("claude-code:")) return "claude-code";
  if (sessionId.startsWith("opencode:")) return "opencode";
  return "codex";
}

function labelForProvider(provider: string) {
  if (provider === "claude-code") return "Claude Code";
  if (provider === "opencode") return "OpenCode";
  return "Codex CLI";
}

function avatarForProvider(provider: string) {
  if (provider === "claude-code") return "CC";
  if (provider === "opencode") return "OC";
  return "C";
}

function formatEventKind(kind: TimelineEvent["kind"]) {
  return kind.replace(/_/g, " ");
}

function formatDate(value: string, _copy?: unknown) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function formatKvHitRate(usage: TokenUsage) {
  const totalInput = usage.input + usage.cachedInput;
  if (totalInput <= 0) return "0.0%";
  return `${((usage.cachedInput / totalInput) * 100).toFixed(1)}%`;
}

function formatMetricValue(metricKey: MetricKey, value: number) {
  return metricKey === "tokens" ? formatMillionTokens(value) : value.toLocaleString();
}

function isIngestBusy(job: IngestJob | null) {
  return job?.status === "queued" || job?.status === "running";
}

function getBlockingMessage({
  copy,
  loading,
  timelineLoading,
  ingestBusy,
  dailyTokenUsageLoading
}: {
  copy: AppCopy;
  loading: boolean;
  timelineLoading: boolean;
  ingestBusy: boolean;
  dailyTokenUsageLoading: boolean;
}) {
  if (ingestBusy) return copy.loading.scanningLogs;
  if (timelineLoading) return copy.loading.loadingTimeline;
  if (loading) return copy.loading.loadingIndex;
  if (dailyTokenUsageLoading) return copy.loading.loadingDailyTokens;
  return null;
}

function getBlockingJob({
  job,
  message,
  ingestBusy,
  loading,
  timelineLoading,
  dailyTokenUsageLoading
}: {
  job: IngestJob | null;
  message: string | null;
  ingestBusy: boolean;
  loading: boolean;
  timelineLoading: boolean;
  dailyTokenUsageLoading: boolean;
}) {
  if (!message) return null;
  if (ingestBusy && job) return job;
  if (loading) return createLoaderJob("loading-projects", "scanning", 3, 12, message);
  if (timelineLoading) return createLoaderJob("loading-timeline", "normalizing", 7, 12, message);
  if (dailyTokenUsageLoading) return createLoaderJob("loading-token-usage", "parsing", 5, 12, message);
  return createLoaderJob("loading-superview", "scanning", 4, 12, message);
}

function createLoaderJob(id: string, phase: IngestJob["phase"], processedFiles: number, totalFiles: number, currentFile: string): IngestJob {
  return {
    id,
    status: "running",
    phase,
    startedAt: new Date(0).toISOString(),
    finishedAt: null,
    totalFiles,
    processedFiles,
    totalEvents: processedFiles * 10,
    errors: [],
    skippedFiles: Math.max(0, processedFiles - 2),
    candidateFiles: totalFiles,
    changedFiles: processedFiles,
    processedBytes: 0,
    totalBytes: 0,
    currentFile
  };
}

const ZERO_TOKEN_USAGE: TokenUsage = { input: 0, output: 0, reasoning: 0, cachedInput: 0, total: 0 };
