import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ROUTES } from '../../config';
import { useStore } from '../../services/store';
import {
  LayoutDashboard, BarChart3, FlaskConical, ListChecks,
  TrendingUp, Microscope, User, Menu, X, Home, Bot, ClipboardList, GraduationCap
} from 'lucide-react';
import './AppLayout.css';
import DemoLauncher from './DemoLauncher';
import { InterviewWorkspaceProvider, useInterviewWorkspace } from '../../services/InterviewWorkspace';
import './WorkspaceTheme.css';
import '../../features/overview/InterviewOverview.css';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: ROUTES.overview, label: 'Overview', icon: LayoutDashboard },
      { to: '/app/readiness', label: 'Integrated Readiness', icon: ClipboardList },
      { to: ROUTES.skills, label: 'Skill Analysis', icon: BarChart3 },
      { to: ROUTES.scenarios, label: 'Scenario Lab', icon: FlaskConical },
    ],
  },
  {
    label: 'Preparation',
    items: [
      { to: ROUTES.interviewReports, label: 'Interview Reports', icon: Bot },
      { to: ROUTES.plan, label: 'Action Plan', icon: ListChecks },
      { to: ROUTES.progress, label: 'Progress', icon: TrendingUp },
    ],
  },
  {
    label: 'Research',
    items: [
      { to: ROUTES.placementAssessment, label: 'Placement Predictor', icon: ClipboardList },
      { to: ROUTES.modelLab, label: 'Model Lab', icon: Microscope },
      { to: ROUTES.faculty, label: 'Faculty Evidence', icon: GraduationCap },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/app/readiness': 'Integrated Readiness',
  [ROUTES.overview]: 'Overview',
  [ROUTES.skills]: 'Skill Analysis',
  [ROUTES.scenarios]: 'Scenario Lab',
  [ROUTES.plan]: 'Action Plan',
  [ROUTES.progress]: 'Progress',
  [ROUTES.interviewReports]: 'Interview Reports',
  [ROUTES.faculty]: 'Faculty Evidence View',
  [ROUTES.modelLab]: 'Model Lab',
  [ROUTES.profile]: 'Profile & Settings',
};

export default function AppLayout() {
  return <InterviewWorkspaceProvider><WorkspaceLayout /></InterviewWorkspaceProvider>;
}

function WorkspaceLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const latestAssessment = useStore((s) => s.getLatestAssessment());
  const { report, assessment, loading } = useInterviewWorkspace();
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'PlacementIQ';

  useEffect(() => {
    document.title = `${pageTitle} — PlacementIQ`;
  }, [pageTitle]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`app-sidebar ${mobileMenuOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-header">
          <NavLink to="/" className="sidebar-wordmark">
            <span className="workspace-logo" aria-hidden="true">pi</span>PlacementIQ
          </NavLink>
          <button
            className="sidebar-close btn btn-ghost btn-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <span className="nav-group-label">{group.label}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={assessment?.demo && item.to.startsWith('/app/') ? `${item.to}?assessment=${assessment.id}&demo=1` : item.to}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'active' : ''}`
                  }
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/"
            className="nav-item"
            style={{ marginBottom: 4 }}
          >
            <Home size={16} />
            <span>Landing Page</span>
          </NavLink>
          <NavLink
            to={ROUTES.profile}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <User size={16} />
            <span>Profile &amp; Settings</span>
          </NavLink>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <div className="app-main">
        <header className="app-topbar">
          <button
            className="topbar-menu btn btn-ghost btn-sm"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <div className="topbar-left">
            <h1 className="topbar-title">{pageTitle}</h1>
            {(location.pathname === "/app/readiness" || (location.pathname === ROUTES.overview && !location.search)) ? <span className="topbar-context">Baseline + interview</span> : report ? <span className="topbar-context">Interview · {new Date(report.createdAt).toLocaleDateString()}<span className="workspace-record-tag">SAVED RESULT</span></span> : !loading && latestAssessment && (
              <span className="topbar-context font-mono">
                Assessment: {new Date(latestAssessment.timestamp).toLocaleDateString()}
                {latestAssessment.label && (
                  <span className="badge badge-primary" style={{ marginLeft: 8 }}>
                    {latestAssessment.label}
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <DemoLauncher />
            <NavLink
              to="/"
              className="btn btn-ghost btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
              title="Return to Landing Page"
            >
              <Home size={15} />
              <span>Landing Page</span>
            </NavLink>
            <span className="preview-indicator">Course Project</span>
          </div>
        </header>

        <main id="main-content" className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
