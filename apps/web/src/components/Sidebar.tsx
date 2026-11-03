import {
  Activity,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  Network,
  Settings2,
  Sparkles,
  TerminalSquare,
  Users,
  X,
  Box,
} from 'lucide-react';
import type { SessionUser } from '../api';
import type { Severity } from '../types';

const navMain = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Incidents', icon: Activity, count: '4' },
  { label: 'Log explorer', icon: TerminalSquare },
  { label: 'Services', icon: Box },
  { label: 'Infrastructure', icon: Network },
];
const navTools = [
  { label: 'AI investigations', icon: Sparkles, badge: 'NEW' },
  { label: 'Reports', icon: FileText },
  { label: 'Team & access', icon: Users },
];

export function severityLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
export function Sidebar({
  open,
  onClose,
  user,
  mode,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
  mode: 'mongodb' | 'demo';
  onLogout: () => void;
}) {
  return (
    <>
      <div className={`mobile-scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Activity size={19} strokeWidth={2.4} />
          </div>
          <div>
            <div className="brand-name">
              TraceMind<span>AI</span>
            </div>
            <div className="brand-caption">INCIDENT COMMAND</div>
          </div>
          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <button className="workspace">
          <span className="workspace-avatar">A</span>
          <span className="workspace-info">
            <b>Acme Production</b>
            <small>Enterprise workspace</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="side-scroll">
          <div className="nav-label">WORKSPACE</div>
          {navMain.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${item.label === 'Overview' ? 'active' : ''}`}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              {item.count && <i>{item.count}</i>}
            </button>
          ))}
          <div className="nav-label tools-label">INVESTIGATE</div>
          {navTools.map((item) => (
            <button key={item.label} className="nav-item">
              <item.icon size={17} />
              <span>{item.label}</span>
              {item.badge && <em>{item.badge}</em>}
            </button>
          ))}
          <div className="nav-label tools-label">DATA MODE</div>
          <div className="connection">
            <span className={`connection-dot ${mode === 'mongodb' ? '' : 'purple'}`} />
            <span>{mode === 'mongodb' ? 'MongoDB connected' : 'Demo data store'}</span>
            <small>{mode === 'mongodb' ? 'Live' : 'Local'}</small>
          </div>
          <div className="connection">
            <span className="connection-dot purple" />
            <span>AI analysis</span>
            <small>Demo</small>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item">
            <Settings2 size={17} />
            <span>Settings</span>
          </button>
          <button className="nav-item">
            <CircleHelp size={17} />
            <span>Help center</span>
            <ExternalLink size={13} className="external" />
          </button>
          <div className="profile">
            <div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
            <div className="profile-info">
              <b>{user.name}</b>
              <small>{severityLabel(user.role)}</small>
            </div>
            <button className="profile-logout" aria-label="Sign out" onClick={onLogout}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`severity severity-${severity}`}>
      <span /> {severityLabel(severity)}
    </span>
  );
}
