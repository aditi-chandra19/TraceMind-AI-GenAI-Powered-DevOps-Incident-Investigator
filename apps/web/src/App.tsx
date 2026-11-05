import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Cpu,
  ExternalLink,
  FileText,
  Filter,
  Gauge,
  Github,
  LifeBuoy,
  Menu,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getCurrentUser,
  getIncidents,
  getRuntimeMode,
  signOut,
  uploadLog,
  analyzeLogSource,
  type Session,
  type LogAnalysis,
  getLogEntries,
  getLogSources,
  getWorkspaceMembers,
  updateIncidentStatus,
  type LogEntry,
  type LogSource,
  type WorkspaceMember,
} from './api';
import type { Incident, Severity } from './types';
import { Sidebar, severityLabel } from './components/Sidebar';
import { SeverityBadge } from './components/SeverityBadge';
import { MetricCard } from './components/MetricCard';
import { LoginPage } from './features/auth/LoginPage';
import { ActionDialog } from './components/ActionDialog';

const trend = [
  { time: '09:00', current: 22, baseline: 19 },
  { time: '10:00', current: 18, baseline: 20 },
  { time: '11:00', current: 26, baseline: 21 },
  { time: '12:00', current: 24, baseline: 22 },
  { time: '13:00', current: 38, baseline: 21 },
  { time: '14:00', current: 33, baseline: 22 },
  { time: '15:00', current: 74, baseline: 23 },
  { time: '16:00', current: 58, baseline: 22 },
  { time: '17:00', current: 42, baseline: 21 },
  { time: '18:00', current: 34, baseline: 20 },
  { time: '19:00', current: 29, baseline: 19 },
  { time: '20:00', current: 24, baseline: 19 },
];
const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
const chartRanges = {
  '24 hours': trend,
  '7 days': trend.map((point, index) => ({
    ...point,
    time: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][
      index
    ]!,
    current: Math.round(point.current * 1.34),
    baseline: Math.round(point.baseline * 1.08),
  })),
  '30 days': trend.map((point, index) => ({
    ...point,
    time: `${index * 2 + 1}d`,
    current: Math.round(point.current * 1.8),
    baseline: Math.round(point.baseline * 1.2),
  })),
} as const;
type DateRange = keyof typeof chartRanges;
type IncidentTab = 'all' | 'open' | 'resolved';
type PanelKind =
  | 'notifications'
  | 'workspace'
  | 'chart'
  | 'health'
  | 'investigation'
  | 'logs'
  | 'services'
  | 'infrastructure'
  | 'team'
  | 'settings'
  | 'help'
  | 'profile'
  | 'analysis';
const panelTitles: Record<PanelKind, string> = {
  notifications: 'Active notifications',
  workspace: 'Workspace',
  chart: 'Incident activity',
  health: 'Service health details',
  investigation: 'Incident investigation',
  logs: 'Log explorer',
  services: 'Services overview',
  infrastructure: 'Infrastructure status',
  team: 'Team and access',
  settings: 'Alert settings',
  help: 'Help and support',
  profile: 'Account details',
  analysis: 'Log investigation results',
};

function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState<'loading' | 'mongodb' | 'demo'>('loading');
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('All severities');
  const [selected, setSelected] = useState('INC-2847');
  const [mobileNav, setMobileNav] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeNav, setActiveNav] = useState('Overview');
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const [panelError, setPanelError] = useState('');
  const [panelLoading, setPanelLoading] = useState(false);
  const [logSources, setLogSources] = useState<LogSource[]>([]);
  const [selectedLogSource, setSelectedLogSource] = useState<LogSource | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logAnalysis, setLogAnalysis] = useState<LogAnalysis | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [incidentTab, setIncidentTab] = useState<IncidentTab>('all');
  const [page, setPage] = useState(1);
  const [showAllIncidents, setShowAllIncidents] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('24 hours');
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [showBaseline, setShowBaseline] = useState(true);
  const [alertSeverity, setAlertSeverity] = useState<Severity>(
    () => (localStorage.getItem('tracemind-alert-severity') as Severity | null) ?? 'high',
  );
  const [alertSeverityDraft, setAlertSeverityDraft] = useState<Severity>(alertSeverity);
  const [actionMessage, setActionMessage] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadNotice, setUploadNotice] = useState('');
  const [uploadError, setUploadError] = useState('');
  useEffect(() => {
    Promise.all([getCurrentUser(), getRuntimeMode()])
      .then(([current, runtimeMode]) => {
        setSession(current);
        setMode(current?.mode ?? runtimeMode);
      })
      .catch(() => {
        setSession(null);
        setMode('mongodb');
      })
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    if (!session) return;
    getIncidents()
      .then((result) => {
        setIncidents(result.data);
        setMode(result.mode);
      })
      .catch((error) => {
        if ((error as { status?: number }).status === 401) setSession(null);
        else {
          setIncidents([]);
          setMode('demo');
        }
      });
  }, [session]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('incident-search')?.focus();
      }
      if (event.key === 'Escape') {
        setPanel(null);
        setShowDateMenu(false);
        setRowMenuId(null);
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);
  async function handleLogout() {
    await signOut().catch(() => undefined);
    setSession(null);
    setIncidents([]);
    setUploadNotice('');
  }
  async function runLogAnalysis(sourceId: string) {
    setPanel('analysis');
    setPanelError('');
    setLogAnalysis(null);
    setPanelLoading(true);
    try {
      setLogAnalysis(await analyzeLogSource(sourceId));
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : 'Could not analyze this log source.');
    } finally {
      setPanelLoading(false);
    }
  }
  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadError('');
    setUploadNotice('');
    try {
      const result = await uploadLog(file, selectedIncident?.id);
      setUploadNotice(
        `${result.data.source.originalName} · ${result.data.stored.toLocaleString()} lines parsed and redacted`,
      );
      if (panel === 'logs') setLogSources(await getLogSources());
      await runLogAnalysis(result.data.source.id);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'Upload failed. Check the file and try again.',
      );
    }
  }
  async function handleNavigate(label: string) {
    setActiveNav(label);
    setPanelError('');
    setActionMessage('');
    setSelectedLogSource(null);
    if (label === 'Overview') {
      setPanel(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (label === 'Incidents') {
      setPanel(null);
      setIncidentTab('all');
      setPage(1);
      document.getElementById('incidents-panel')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (label === 'Log explorer') {
      setPanel('logs');
      setPanelLoading(true);
      try {
        setLogSources(await getLogSources());
      } catch (error) {
        setPanelError(error instanceof Error ? error.message : 'Could not load saved log sources.');
      } finally {
        setPanelLoading(false);
      }
      return;
    }
    if (label === 'Services') setPanel('services');
    else if (label === 'Infrastructure') setPanel('infrastructure');
    else if (label === 'AI investigations') setPanel('investigation');
    else if (label === 'Reports') downloadReport();
    else if (label === 'Team & access') {
      setPanel('team');
      setPanelLoading(true);
      try {
        setMembers(await getWorkspaceMembers());
      } catch (error) {
        setPanelError(error instanceof Error ? error.message : 'Could not load workspace members.');
      } finally {
        setPanelLoading(false);
      }
    } else if (label === 'Settings') {
      setAlertSeverityDraft(alertSeverity);
      setPanel('settings');
    } else if (label === 'Help center') setPanel('help');
    else if (label === 'Workspace') setPanel('workspace');
  }
  async function showLogEntries(source: LogSource) {
    const sourceId = source._id ?? source.id;
    if (!sourceId) {
      setPanelError('This log source is missing its database identifier.');
      return;
    }
    setSelectedLogSource(source);
    setPanelLoading(true);
    setPanelError('');
    try {
      setLogEntries(await getLogEntries(sourceId));
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : 'Could not load parsed log entries.');
    } finally {
      setPanelLoading(false);
    }
  }
  function downloadReport() {
    const report = [
      '# TraceMind AI incident report',
      '',
      `Generated: ${new Date().toLocaleString()}`,
      `Workspace: Acme Production`,
      '',
      ...incidents.flatMap((incident) => [
        `## ${incident.id} — ${incident.title}`,
        '',
        `- Severity: ${severityLabel(incident.severity)}`,
        `- Status: ${severityLabel(incident.status)}`,
        `- Service: ${incident.service}`,
        `- Root-cause hypothesis (${incident.confidence}% confidence): ${incident.rootCause}`,
        '',
        incident.summary,
        '',
        '### Evidence and timeline',
        ...incident.timeline.map((item) => `- ${item.time}: ${item.title} — ${item.detail}`),
        ...(incident.timeline.length
          ? []
          : ['- No source-line evidence is attached to this incident.']),
        '',
      ]),
      'Recommendations are hypotheses and require human review before action.',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tracemind-incident-report-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setActionMessage('Incident report downloaded as Markdown.');
  }
  function downloadChartCsv() {
    const rows = chartRanges[dateRange];
    const csv = [
      'time,current,baseline',
      ...rows.map((point) => `${point.time},${point.current},${point.baseline}`),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tracemind-activity-${dateRange.replace(' ', '-')}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setActionMessage('Activity data downloaded as CSV.');
  }
  async function changeIncidentStatus(incident: Incident, status: Incident['status']) {
    try {
      const updated = await updateIncidentStatus(incident.id, status);
      setIncidents((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setActionMessage(`${updated.id} status updated to ${severityLabel(status)}.`);
      setRowMenuId(null);
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : 'Could not update incident status.');
    }
  }
  const visible = useMemo(
    () =>
      incidents.filter(
        (item) =>
          `${item.id} ${item.title} ${item.service}`.toLowerCase().includes(search.toLowerCase()) &&
          (severity === 'All severities' || item.severity === severity.toLowerCase()) &&
          (incidentTab === 'all' ||
            (incidentTab === 'open' && item.status !== 'resolved') ||
            (incidentTab === 'resolved' && item.status === 'resolved')),
      ),
    [incidents, search, severity, incidentTab],
  );
  const pageSize = showAllIncidents ? 100 : 3;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageIncidents = visible.slice((page - 1) * pageSize, page * pageSize);
  const alerts = incidents.filter(
    (incident) =>
      severityOrder.indexOf(incident.severity) <= severityOrder.indexOf(alertSeverity) &&
      incident.status !== 'resolved',
  );
  const activeCount = incidents.filter((item) => item.status !== 'resolved').length;
  const selectedIncident = incidents.find((item) => item.id === selected) ?? incidents[0];
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (!authReady)
    return (
      <main className="auth-screen">
        <div className="auth-card auth-loading">
          <div className="brand-mark">
            <Activity size={20} />
          </div>
          <span>Connecting to TraceMind…</span>
        </div>
      </main>
    );
  if (!session)
    return (
      <LoginPage
        mode={mode === 'demo' ? 'demo' : 'mongodb'}
        onAuthenticated={(authenticated) => {
          setSession(authenticated);
          setMode(authenticated.mode);
        }}
      />
    );

  return (
    <div className="app-shell">
      <Sidebar
        open={mobileNav}
        onClose={() => setMobileNav(false)}
        user={session.user}
        mode={mode === 'mongodb' ? 'mongodb' : 'demo'}
        active={activeNav}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              Workspace <ChevronRight size={14} /> <b>Overview</b>
            </div>
            <div className="env-pill">
              <span /> {mode === 'mongodb' ? 'DB LIVE' : 'DEMO'}
            </div>
            {mode === 'demo' && <div className="demo-pill">DEMO DATA</div>}
          </div>
          <div className="topbar-actions">
            <div className="last-sync">
              <span /> All systems operational
            </div>
            <button
              className="icon-button search-shortcut"
              aria-label="Search"
              onClick={() => document.getElementById('incident-search')?.focus()}
            >
              <Search size={17} />
              <kbd>Ctrl K</kbd>
            </button>
            <button
              className="icon-button notifications"
              aria-label={`Notifications, ${alerts.length} active`}
              onClick={() => setPanel('notifications')}
            >
              <Bell size={18} />
              {alerts.length > 0 && <i />}
            </button>
            <button
              className="top-avatar"
              aria-label="Account details"
              onClick={() => setPanel('profile')}
            >
              {session.user.name.slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>
        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="pulse-dot" /> LIVE OPERATIONS
              </div>
              <h1>
                Good afternoon, {session.user.name.split(' ')[0]} <span>✳</span>
              </h1>
              <p>Here’s what’s happening across your infrastructure today.</p>
            </div>
            <div className="heading-actions">
              <div className="period-picker">
                <button
                  className="btn btn-secondary"
                  aria-expanded={showDateMenu}
                  onClick={() => setShowDateMenu((open) => !open)}
                >
                  <span className="period-dot" /> Last {dateRange} <ChevronDown size={15} />
                </button>
                {showDateMenu && (
                  <div className="period-menu" role="menu" aria-label="Select time range">
                    {(Object.keys(chartRanges) as DateRange[]).map((range) => (
                      <button
                        key={range}
                        role="menuitemradio"
                        aria-checked={dateRange === range}
                        onClick={() => {
                          setDateRange(range);
                          setShowDateMenu(false);
                        }}
                      >
                        Last {range}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {session.user.role !== 'viewer' && (
                <button className="btn btn-primary" onClick={() => uploadRef.current?.click()}>
                  <UploadCloud size={16} /> Analyze logs
                </button>
              )}
              <input
                ref={uploadRef}
                type="file"
                hidden
                accept=".log,.txt,.json,.jsonl,.ndjson"
                onChange={handleUpload}
              />
            </div>
          </section>
          {(uploadNotice || uploadError) && (
            <div
              className={`upload-notice ${uploadError ? 'upload-failed' : ''}`}
              role={uploadError ? 'alert' : 'status'}
            >
              {uploadError || uploadNotice}
              <button
                aria-label="Dismiss upload message"
                onClick={() => {
                  setUploadNotice('');
                  setUploadError('');
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {actionMessage && (
            <div className="upload-notice" role="status">
              {actionMessage}
              <button aria-label="Dismiss message" onClick={() => setActionMessage('')}>
                <X size={14} />
              </button>
            </div>
          )}
          <section className="metric-grid" aria-label="Incident metrics">
            <MetricCard
              label="Active incidents"
              value={activeCount.toString().padStart(2, '0')}
              trend="2 resolved today"
              icon={Activity}
              accent="blue"
              change="−18%"
              positive
            />
            <MetricCard
              label="Critical alerts"
              value="01"
              trend="Needs immediate attention"
              icon={Bell}
              accent="red"
              change="+1"
            />
            <MetricCard
              label="Affected users"
              value="3,572"
              trend="Across 3 services"
              icon={Users}
              accent="amber"
              change="−12%"
              positive
            />
            <MetricCard
              label="Mean time to resolve"
              value="42<span>m</span>"
              trend="vs. 58m last week"
              icon={Gauge}
              accent="green"
              change="−27%"
              positive
            />
          </section>
          <section className="analytics-grid">
            <article className="panel trend-panel">
              <div className="panel-heading">
                <div>
                  <h2>Incident activity</h2>
                  <p>Event volume across your services</p>
                </div>
                <div className="chart-legend">
                  <span>
                    <i className="legend-current" /> This period
                  </span>
                  <span>
                    <i className="legend-base" /> Baseline
                  </span>
                  <button
                    className="icon-button tiny"
                    aria-label="Incident activity options"
                    onClick={() => setPanel('chart')}
                  >
                    <MoreHorizontal size={19} />
                  </button>
                </div>
              </div>
              <div className="chart-summary">
                <strong>
                  {dateRange === '24 hours' ? '184' : dateRange === '7 days' ? '246' : '331'}
                </strong>
                <span>events</span>
                <span className="chart-change">
                  <ArrowUpRight size={13} /> 12.8%
                </span>
                <small>compared to previous period</small>
              </div>
              <div className="trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartRanges[dateRange]}
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="currentFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7593ff" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#7593ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#232a36" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#697487', fontSize: 11 }}
                      dy={12}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#697487', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#141923',
                        border: '1px solid #2b3444',
                        borderRadius: 10,
                        color: '#e5e9f0',
                        fontSize: 12,
                      }}
                    />
                    {showBaseline && (
                      <Area
                        type="monotone"
                        dataKey="baseline"
                        stroke="#5d687b"
                        strokeWidth={1.5}
                        strokeDasharray="4 5"
                        fill="transparent"
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="current"
                      stroke="#849bff"
                      strokeWidth={2.2}
                      fill="url(#currentFill)"
                      activeDot={{ r: 4, fill: '#aab9ff', stroke: '#161b26', strokeWidth: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-footer">
                <span>
                  <i /> Peak activity at <b>3:00 PM</b>
                </span>
                <span>Updated just now</span>
              </div>
            </article>
            <article className="panel health-panel">
              <div className="panel-heading">
                <div>
                  <h2>Service health</h2>
                  <p>Live performance signals</p>
                </div>
                <button
                  className="icon-button tiny"
                  aria-label="Service health details"
                  onClick={() => setPanel('health')}
                >
                  <MoreHorizontal size={19} />
                </button>
              </div>
              <div className="health-score">
                <div className="health-ring">
                  <div>
                    <strong>
                      98<span>.4</span>
                    </strong>
                    <small>HEALTH SCORE</small>
                  </div>
                </div>
                <div className="health-state">
                  <span>
                    <i /> Operational
                  </span>
                  <small>Across 12 services</small>
                </div>
              </div>
              <div className="health-metrics">
                <div>
                  <span>
                    <Activity size={14} /> Latency
                  </span>
                  <b>
                    124 <small>ms</small>
                    <i className="good">−8%</i>
                  </b>
                </div>
                <div>
                  <span>
                    <ArrowDownRight size={14} /> Error rate
                  </span>
                  <b>
                    0.08 <small>%</small>
                    <i className="good">−0.2%</i>
                  </b>
                </div>
                <div>
                  <span>
                    <Cpu size={14} /> CPU usage
                  </span>
                  <b>
                    42 <small>%</small>
                    <i className="neutral">+2%</i>
                  </b>
                </div>
              </div>
            </article>
          </section>
          <section className="lower-grid">
            <article className="panel incidents-panel" id="incidents-panel">
              <div className="panel-heading incidents-head">
                <div>
                  <div className="title-line">
                    <h2>Recent incidents</h2>
                    <span className="count-badge">{incidents.length}</span>
                  </div>
                  <p>Monitor and investigate ongoing events</p>
                </div>
                <div className="incident-actions">
                  <button
                    className={`btn btn-filter ${showFilters ? 'selected' : ''}`}
                    onClick={() => setShowFilters((value) => !value)}
                  >
                    <Filter size={14} /> Filter
                  </button>
                  <button
                    className="btn btn-secondary btn-all"
                    onClick={() => {
                      setShowAllIncidents((showAll) => !showAll);
                      setPage(1);
                    }}
                  >
                    {showAllIncidents ? 'Show recent' : 'View all'} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <div className="table-toolbar">
                <div className="incident-tabs">
                  <button
                    className={incidentTab === 'all' ? 'tab-active' : ''}
                    onClick={() => {
                      setIncidentTab('all');
                      setPage(1);
                    }}
                  >
                    All incidents <span>{incidents.length}</span>
                  </button>
                  <button
                    className={incidentTab === 'open' ? 'tab-active' : ''}
                    onClick={() => {
                      setIncidentTab('open');
                      setPage(1);
                    }}
                  >
                    Open <span>{activeCount}</span>
                  </button>
                  <button
                    className={incidentTab === 'resolved' ? 'tab-active' : ''}
                    onClick={() => {
                      setIncidentTab('resolved');
                      setPage(1);
                    }}
                  >
                    Resolved <span>{incidents.length - activeCount}</span>
                  </button>
                </div>
                <div className="table-search">
                  <Search size={15} />
                  <input
                    id="incident-search"
                    aria-label="Search incidents"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search incidents…"
                  />
                  {search && (
                    <button aria-label="Clear search" onClick={() => setSearch('')}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
              {showFilters && (
                <div className="filter-row">
                  <span>Severity</span>
                  <select
                    value={severity}
                    onChange={(event) => {
                      setSeverity(event.target.value);
                      setPage(1);
                    }}
                    aria-label="Filter by severity"
                  >
                    <option value="All severities">All severities</option>
                    {severityOrder.map((item) => (
                      <option key={item} value={item}>
                        {severityLabel(item)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      setSeverity('All severities');
                      setSearch('');
                      setIncidentTab('all');
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
              <div className="incident-table-wrap">
                <table className="incident-table">
                  <thead>
                    <tr>
                      <th>INCIDENT</th>
                      <th>SEVERITY</th>
                      <th>SERVICE</th>
                      <th>STARTED</th>
                      <th>STATUS</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {pageIncidents.map((incident) => (
                      <tr
                        key={incident.id}
                        className={selected === incident.id ? 'row-selected' : ''}
                        onClick={() => setSelected(incident.id)}
                      >
                        <td>
                          <div className="incident-cell">
                            <span className="incident-id">{incident.id}</span>
                            <b>{incident.title}</b>
                          </div>
                        </td>
                        <td>
                          <SeverityBadge severity={incident.severity} />
                        </td>
                        <td>
                          <span className="service-tag">
                            <span /> {incident.service}
                          </span>
                        </td>
                        <td>
                          <span className="started">{incident.duration} ago</span>
                        </td>
                        <td>
                          <span className={`status status-${incident.status}`}>
                            {incident.status === 'investigating' && <i />}
                            {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="row-more"
                            aria-label={`More actions for ${incident.id}`}
                            aria-expanded={rowMenuId === incident.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setRowMenuId(rowMenuId === incident.id ? null : incident.id);
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {rowMenuId === incident.id && (
                            <div
                              className="row-action-menu"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setSelected(incident.id);
                                  setPanel('investigation');
                                  setRowMenuId(null);
                                }}
                              >
                                Open investigation
                              </button>
                              <button
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      if (!navigator.clipboard) throw new Error('Unavailable');
                                      await navigator.clipboard.writeText(incident.id);
                                      setActionMessage(`${incident.id} copied.`);
                                    } catch {
                                      setActionMessage(
                                        'Clipboard access is unavailable in this browser.',
                                      );
                                    }
                                  })();
                                }}
                              >
                                Copy incident ID
                              </button>
                              {incident.status !== 'resolved' && (
                                <button
                                  onClick={() => void changeIncidentStatus(incident, 'resolved')}
                                >
                                  Mark resolved
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visible.length === 0 && (
                  <div className="empty-state">
                    <Search size={21} />
                    <b>No incidents found</b>
                    <span>Try another search or clear your filters.</span>
                  </div>
                )}
              </div>
              <div className="table-footer">
                <span>
                  Showing{' '}
                  <b>
                    {visible.length ? (page - 1) * pageSize + 1 : 0}–
                    {Math.min(page * pageSize, visible.length)}
                  </b>{' '}
                  of <b>{visible.length}</b> matching incidents
                </span>
                <div>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </button>
                  <span className="page-number" aria-label={`Page ${page} of ${pageCount}`}>
                    {page} / {pageCount}
                  </span>
                  <button
                    disabled={page >= pageCount}
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </article>
            <article className="panel ai-panel">
              <div className="ai-heading">
                <div className="ai-orb">
                  <Sparkles size={17} />
                </div>
                <div>
                  <h2>AI investigation</h2>
                  <p>Powered by TraceMind Intelligence</p>
                </div>
                <span className="ai-live">LIVE</span>
              </div>
              {selectedIncident ? (
                <>
                  <div className="ai-incident">
                    <div>
                      <span className="incident-id">{selectedIncident.id}</span>
                      <span className="ai-updated">Updated 2m ago</span>
                    </div>
                    <SeverityBadge severity={selectedIncident.severity} />
                  </div>
                  <h3>{selectedIncident.rootCause}</h3>
                  <div className="confidence">
                    <span>Root cause confidence</span>
                    <b>{selectedIncident.confidence}%</b>
                    <div className="confidence-track">
                      <i style={{ width: `${selectedIncident.confidence}%` }} />
                    </div>
                  </div>
                  <div className="evidence-box">
                    <div className="evidence-head">
                      <ShieldCheck size={14} />
                      <b>Evidence-backed insight</b>
                      <span>3 signals</span>
                    </div>
                    <p>{selectedIncident.summary}</p>
                    <div className="evidence-foot">
                      <span>
                        <FileText size={12} /> 3 log sources analyzed
                      </span>
                      <button onClick={() => setPanel('investigation')}>
                        View evidence <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                  <button className="btn btn-ai" onClick={() => setPanel('investigation')}>
                    <Sparkles size={14} /> Open investigation <ChevronRight size={14} />
                  </button>
                  <div className="human-note">
                    <ShieldCheck size={13} /> Recommendations require human approval
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <Activity size={21} />
                  <b>Select an incident</b>
                  <span>Choose an incident to see its investigation.</span>
                </div>
              )}
            </article>
          </section>
          <footer className="footer">
            <span>
              © 2025 TraceMind AI <i /> Built for teams that keep the lights on.
            </span>
            <div>
              <span>
                <span className="footer-dot" /> All systems operational
              </span>
              <button
                onClick={() =>
                  window.open(
                    'https://github.com/aditi-chandra19/TraceMind-AI-GenAI-Powered-DevOps-Incident-Investigator/commits/main',
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                <Github size={13} /> Changelog
              </button>
              <button onClick={() => setPanel('help')}>
                <LifeBuoy size={13} /> Support
              </button>
            </div>
          </footer>
        </div>
      </main>
      {panel && (
        <ActionDialog
          title={panelTitles[panel]}
          onClose={() => {
            setPanel(null);
            setPanelError('');
          }}
        >
          {panelLoading && <p className="panel-feedback">Loading…</p>}
          {panelError && (
            <p className="panel-feedback panel-feedback-error" role="alert">
              {panelError}
            </p>
          )}
          {panel === 'notifications' && (
            <div className="action-list">
              <p className="panel-feedback">
                Showing open incidents at or above the {severityLabel(alertSeverity).toLowerCase()}{' '}
                alert threshold.
              </p>
              {alerts.length ? (
                alerts.map((incident) => (
                  <button
                    key={incident.id}
                    className="action-list-row"
                    onClick={() => {
                      setSelected(incident.id);
                      setPanel('investigation');
                    }}
                  >
                    <SeverityBadge severity={incident.severity} />
                    <span>
                      <b>{incident.id}</b> {incident.title}
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))
              ) : (
                <p className="panel-feedback">No matching active alerts.</p>
              )}
              <button
                className="dialog-secondary"
                onClick={() => {
                  setPanel(null);
                  handleNavigate('Incidents');
                }}
              >
                View incidents
              </button>
            </div>
          )}
          {panel === 'workspace' && (
            <div className="workspace-details">
              <div className="workspace-avatar">A</div>
              <div>
                <b>Acme Production</b>
                <p>
                  Current workspace · {mode === 'mongodb' ? 'MongoDB connected' : 'Demo data store'}
                </p>
              </div>
              <span className="workspace-live">{mode === 'mongodb' ? 'LIVE' : 'DEMO'}</span>
            </div>
          )}
          {panel === 'chart' && (
            <div className="dialog-actions">
              <p>
                Period: <b>Last {dateRange}</b>. Download the displayed series or toggle its
                baseline.
              </p>
              <button
                className="dialog-secondary"
                onClick={() => setShowBaseline((visible) => !visible)}
              >
                {showBaseline ? 'Hide baseline' : 'Show baseline'}
              </button>
              <button className="dialog-primary" onClick={downloadChartCsv}>
                Download chart data (CSV)
              </button>
            </div>
          )}
          {panel === 'health' && (
            <div className="health-detail-grid">
              <div>
                <span>Overall service health</span>
                <b>98.4 / 100</b>
                <small>Operational across 12 services</small>
              </div>
              <div>
                <span>Median latency</span>
                <b>124 ms</b>
                <small>8% lower than prior period</small>
              </div>
              <div>
                <span>Error rate</span>
                <b>0.08%</b>
                <small>Within the configured alert range</small>
              </div>
              <div>
                <span>CPU usage</span>
                <b>42%</b>
                <small>2% above the previous period</small>
              </div>
              <p>
                These dashboard performance signals are sample workspace metrics; incident and log
                records are loaded from the connected database.
              </p>
            </div>
          )}
          {panel === 'investigation' && selectedIncident && (
            <div className="investigation-detail">
              <div className="investigation-title-row">
                <span className="incident-id">{selectedIncident.id}</span>
                <SeverityBadge severity={selectedIncident.severity} />
              </div>
              <h3>{selectedIncident.title}</h3>
              <p>{selectedIncident.summary}</p>
              <div className="hypothesis-note">
                <b>Root-cause hypothesis · {selectedIncident.confidence}% confidence</b>
                <span>{selectedIncident.rootCause}</span>
              </div>
              <h4>Incident timeline and evidence</h4>
              {selectedIncident.timeline.length ? (
                <ol className="incident-timeline">
                  {selectedIncident.timeline.map((event, index) => (
                    <li key={`${event.time}-${index}`}>
                      <time>{event.time}</time>
                      <div>
                        <b>{event.title}</b>
                        <span>{event.detail}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="panel-feedback">
                  No timeline evidence is attached yet. Upload logs to add source lines.
                </p>
              )}
              <p className="panel-feedback">
                The incident record does not include exact source-line citations yet. The cause
                shown above is a hypothesis and must be reviewed by a person.
              </p>
              {session.user.role !== 'viewer' && (
                <div className="dialog-actions">
                  <label htmlFor="incident-status">Update incident status</label>
                  <select
                    id="incident-status"
                    value={selectedIncident.status}
                    onChange={(event) =>
                      void changeIncidentStatus(
                        selectedIncident,
                        event.target.value as Incident['status'],
                      )
                    }
                  >
                    <option value="investigating">Investigating</option>
                    <option value="identified">Identified</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              )}
            </div>
          )}
          {panel === 'logs' &&
            (selectedLogSource ? (
              <div className="log-source-detail">
                <button className="dialog-secondary" onClick={() => setSelectedLogSource(null)}>
                  ← All uploaded files
                </button>
                <p>
                  <b>{selectedLogSource.originalName}</b> ·{' '}
                  {selectedLogSource.lineCount.toLocaleString()} lines · secrets redacted
                </p>
                <div className="log-entry-list">
                  {logEntries.length
                    ? logEntries.map((entry) => (
                        <article key={entry._id ?? entry.id ?? entry.lineNumber}>
                          <span>
                            Line {entry.lineNumber}
                            {entry.level ? ` · ${entry.level}` : ''}
                            {entry.service ? ` · ${entry.service}` : ''}
                          </span>
                          <code>{entry.message}</code>
                        </article>
                      ))
                    : !panelLoading && (
                        <p className="panel-feedback">
                          No parsed entries were found for this file.
                        </p>
                      )}
                </div>
                {session.user.role !== 'viewer' && (
                  <button
                    className="dialog-primary"
                    onClick={() =>
                      void runLogAnalysis(selectedLogSource._id ?? selectedLogSource.id ?? '')
                    }
                    disabled={!selectedLogSource._id && !selectedLogSource.id}
                  >
                    <Sparkles size={15} /> Analyze this log source
                  </button>
                )}
              </div>
            ) : (
              <div className="action-list">
                <p className="panel-feedback">
                  Uploaded log files are stored with redacted, line-numbered entries.
                </p>
                {logSources.map((source) => (
                  <button
                    key={source._id ?? source.id ?? source.originalName}
                    className="action-list-row"
                    onClick={() => void showLogEntries(source)}
                  >
                    <FileText size={16} />
                    <span>
                      <b>{source.originalName}</b>
                      <small>
                        {source.lineCount.toLocaleString()} lines ·{' '}
                        {source.createdAt
                          ? new Date(source.createdAt).toLocaleString()
                          : 'Just now'}
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
                {!panelLoading && !logSources.length && (
                  <p className="panel-feedback">
                    No log files yet. Upload a .log, .txt, .json, .jsonl, or .ndjson file to see
                    parsed results here.
                  </p>
                )}
                {session.user.role !== 'viewer' && (
                  <button
                    className="dialog-primary"
                    onClick={() => {
                      setPanel(null);
                      uploadRef.current?.click();
                    }}
                  >
                    Analyze a log file
                  </button>
                )}
              </div>
            ))}
          {panel === 'analysis' && logAnalysis && (
            <div className="analysis-report">
              <div className="analysis-report-heading">
                <div>
                  <b>{logAnalysis.source.name}</b>
                  <small>
                    Analyzed {logAnalysis.source.analyzedLines.toLocaleString()} of{' '}
                    {logAnalysis.source.totalLines.toLocaleString()} lines
                    {logAnalysis.source.truncated ? ' · sample limited to first 500 lines' : ''}
                  </small>
                </div>
                <span className={`analysis-mode analysis-mode-${logAnalysis.analysisMode}`}>
                  {logAnalysis.analysisMode === 'openai'
                    ? 'OpenAI analysis'
                    : logAnalysis.analysisMode === 'local-fallback'
                      ? 'Local fallback'
                      : 'Local rules'}
                </span>
              </div>
              {logAnalysis.providerNotice && (
                <p className="panel-feedback" role="status">
                  {logAnalysis.providerNotice}
                </p>
              )}
              <section className="analysis-section">
                <h3>Assessment</h3>
                <div className="analysis-severity">
                  <SeverityBadge severity={logAnalysis.severity} />
                  <span>{logAnalysis.confidence}% confidence · assessment, not certainty</span>
                </div>
                <p>{logAnalysis.summary}</p>
                <h4>Root-cause hypothesis</h4>
                <p>{logAnalysis.rootCauseHypothesis}</p>
              </section>
              <section className="analysis-section">
                <h3>Error patterns</h3>
                {logAnalysis.errorClusters.length ? (
                  <ul className="analysis-clusters">
                    {logAnalysis.errorClusters.map((cluster) => (
                      <li key={cluster.signature}>
                        <span>{cluster.signature}</span>
                        <small>
                          {cluster.count} match{cluster.count === 1 ? '' : 'es'} · lines{' '}
                          {cluster.lineNumbers.join(', ')}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No error patterns were found in the analyzed sample.</p>
                )}
                {logAnalysis.anomalies.map((anomaly) => (
                  <p className="analysis-anomaly" key={anomaly.description}>
                    {anomaly.description} Evidence lines: {anomaly.lineNumbers.join(', ')}
                  </p>
                ))}
                {!!logAnalysis.stackTraceLineNumbers.length && (
                  <p className="panel-feedback">
                    Stack-trace indicators at lines {logAnalysis.stackTraceLineNumbers.join(', ')}.
                  </p>
                )}
              </section>
              <section className="analysis-section">
                <h3>Verified source evidence</h3>
                {logAnalysis.evidence.length ? (
                  <div className="log-entry-list">
                    {logAnalysis.evidence.map((entry) => (
                      <article key={entry.lineNumber}>
                        <span>
                          Line {entry.lineNumber}
                          {entry.level ? ` · ${entry.level}` : ''}
                          {entry.service ? ` · ${entry.service}` : ''}
                        </span>
                        <code>{entry.message}</code>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>No source lines were cited for this assessment.</p>
                )}
              </section>
              <section className="analysis-section">
                <h3>Recommended checks</h3>
                <ol>
                  {logAnalysis.recommendations.map((recommendation, index) => (
                    <li key={`${index}-${recommendation}`}>{recommendation}</li>
                  ))}
                </ol>
                <p className="panel-feedback">
                  Recommendations are advisory. A human must verify the cause and approve any
                  remediation.
                </p>
              </section>
            </div>
          )}
          {panel === 'services' && (
            <div className="action-list">
              {Array.from(new Set(incidents.map((item) => item.service))).map((service) => {
                const linked = incidents.filter((item) => item.service === service);
                const open = linked.filter((item) => item.status !== 'resolved').length;
                return (
                  <div className="action-list-row" key={service}>
                    <span className={`connection-dot ${open ? 'purple' : ''}`} />
                    <span>
                      <b>{service}</b>
                      <small>
                        {open
                          ? `${open} open incident${open === 1 ? '' : 's'}`
                          : 'No open incidents'}{' '}
                        · {linked.length} tracked
                      </small>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {panel === 'infrastructure' && (
            <div className="action-list">
              {Array.from(new Set(incidents.map((item) => item.service))).map((service) => {
                const linked = incidents.filter((item) => item.service === service);
                const latest = linked[0];
                const healthy = linked.every((item) => item.status === 'resolved');
                return (
                  <div className="action-list-row" key={service}>
                    <span className={`infra-state ${healthy ? 'healthy' : 'degraded'}`} />
                    <span>
                      <b>{service}</b>
                      <small>
                        {healthy ? 'Healthy' : `Investigating · ${latest?.id ?? 'incident'}`}
                      </small>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {panel === 'team' && (
            <div className="action-list">
              {members.map((member) => (
                <div className="action-list-row" key={member._id ?? member.id ?? member.email}>
                  <Users size={16} />
                  <span>
                    <b>{member.name}</b>
                    <small>{member.email}</small>
                  </span>
                  <span className="member-role">{severityLabel(member.role)}</span>
                </div>
              ))}
              {!panelLoading && !panelError && members.length === 0 && (
                <p className="panel-feedback">No workspace members were returned.</p>
              )}
            </div>
          )}
          {panel === 'settings' && (
            <form
              className="settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                localStorage.setItem('tracemind-alert-severity', alertSeverityDraft);
                setAlertSeverity(alertSeverityDraft);
                setActionMessage('Alert threshold saved on this browser.');
                setPanel(null);
              }}
            >
              <label htmlFor="alert-severity">Notify me for incidents at or above</label>
              <select
                id="alert-severity"
                value={alertSeverityDraft}
                onChange={(event) => setAlertSeverityDraft(event.target.value as Severity)}
              >
                {severityOrder.map((value) => (
                  <option value={value} key={value}>
                    {severityLabel(value)}
                  </option>
                ))}
              </select>
              <p>
                This setting filters the dashboard notification list on this browser. It does not
                change server-side alert routing.
              </p>
              <button className="dialog-primary">Save alert threshold</button>
            </form>
          )}
          {panel === 'help' && (
            <div className="action-list">
              <p className="panel-feedback">Quick links for this local TraceMind workspace.</p>
              <a
                className="action-list-row"
                href="https://github.com/aditi-chandra19/TraceMind-AI-GenAI-Powered-DevOps-Incident-Investigator/blob/main/docs/day2-setup.md"
                target="_blank"
                rel="noreferrer"
              >
                <Github size={16} />
                <span>
                  <b>Setup guide</b>
                  <small>Run the API, dashboard, and local database</small>
                </span>
                <ExternalLink size={14} />
              </a>
              <a
                className="action-list-row"
                href="https://github.com/aditi-chandra19/TraceMind-AI-GenAI-Powered-DevOps-Incident-Investigator/issues"
                target="_blank"
                rel="noreferrer"
              >
                <LifeBuoy size={16} />
                <span>
                  <b>Support and issues</b>
                  <small>Open the project issue tracker</small>
                </span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}
          {panel === 'profile' && (
            <div className="profile-details">
              <div className="profile-avatar">{session.user.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <b>{session.user.name}</b>
                <span>{session.user.email}</span>
                <small>
                  {severityLabel(session.user.role)} ·{' '}
                  {mode === 'mongodb' ? 'MongoDB workspace' : 'Demo workspace'}
                </small>
              </div>
              <button className="dialog-secondary" onClick={() => void handleLogout()}>
                Sign out
              </button>
            </div>
          )}
        </ActionDialog>
      )}
    </div>
  );
}

export default App;
