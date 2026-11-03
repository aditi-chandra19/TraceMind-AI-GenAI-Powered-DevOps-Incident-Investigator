import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Cpu,
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
import { getCurrentUser, getIncidents, signOut, uploadLog, type Session } from './api';
import type { Incident, Severity } from './types';
import { Sidebar, severityLabel } from './components/Sidebar';
import { SeverityBadge } from './components/SeverityBadge';
import { MetricCard } from './components/MetricCard';
import { LoginPage } from './features/auth/LoginPage';

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
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadNotice, setUploadNotice] = useState('');
  const [uploadError, setUploadError] = useState('');
  useEffect(() => {
    getCurrentUser()
      .then((current) => {
        setSession(current);
        setMode(current?.mode ?? 'demo');
      })
      .catch(() => {
        setSession(null);
        setMode('demo');
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
  async function handleLogout() {
    await signOut().catch(() => undefined);
    setSession(null);
    setIncidents([]);
    setUploadNotice('');
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
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'Upload failed. Check the file and try again.',
      );
    }
  }
  const visible = useMemo(
    () =>
      incidents.filter(
        (item) =>
          `${item.id} ${item.title} ${item.service}`.toLowerCase().includes(search.toLowerCase()) &&
          (severity === 'All severities' || item.severity === severity.toLowerCase()),
      ),
    [incidents, search, severity],
  );
  const activeCount = incidents.filter((item) => item.status !== 'resolved').length;
  const selectedIncident = incidents.find((item) => item.id === selected) ?? incidents[0];

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
        onLogout={handleLogout}
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
              <kbd>⌘ K</kbd>
            </button>
            <button className="icon-button notifications" aria-label="Notifications">
              <Bell size={18} />
              <i />
            </button>
            <div className="top-avatar">{session.user.name.slice(0, 2).toUpperCase()}</div>
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
              <button className="btn btn-secondary">
                <span className="period-dot" /> Last 24 hours <ChevronDown size={15} />
              </button>
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
                  <button className="icon-button tiny">
                    <MoreHorizontal size={19} />
                  </button>
                </div>
              </div>
              <div className="chart-summary">
                <strong>184</strong>
                <span>events</span>
                <span className="chart-change">
                  <ArrowUpRight size={13} /> 12.8%
                </span>
                <small>compared to previous period</small>
              </div>
              <div className="trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
                    <Area
                      type="monotone"
                      dataKey="baseline"
                      stroke="#5d687b"
                      strokeWidth={1.5}
                      strokeDasharray="4 5"
                      fill="transparent"
                    />
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
                <button className="icon-button tiny">
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
            <article className="panel incidents-panel">
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
                  <button className="btn btn-secondary btn-all">
                    View all <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <div className="table-toolbar">
                <div className="incident-tabs">
                  <button className="tab-active">
                    All incidents <span>{incidents.length}</span>
                  </button>
                  <button>My incidents</button>
                  <button>Unassigned</button>
                </div>
                <div className="table-search">
                  <Search size={15} />
                  <input
                    id="incident-search"
                    aria-label="Search incidents"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
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
                    onChange={(event) => setSeverity(event.target.value)}
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
                    {visible.map((incident) => (
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
                          >
                            <MoreHorizontal size={16} />
                          </button>
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
                    {visible.length ? 1 : 0}–{visible.length}
                  </b>{' '}
                  of <b>{incidents.length}</b> incidents
                </span>
                <div>
                  <button disabled>Previous</button>
                  <button className="page-number">1</button>
                  <button disabled>Next</button>
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
                      <span>
                        View evidence <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                  <button className="btn btn-ai">
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
              <button>
                <Github size={13} /> Changelog
              </button>
              <button>
                <LifeBuoy size={13} /> Support
              </button>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
