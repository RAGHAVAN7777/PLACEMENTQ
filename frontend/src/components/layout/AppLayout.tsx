import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ROUTES } from '../../config';
import { useStore } from '../../services/store';
import {
  LayoutDashboard, BarChart3, FlaskConical, ListChecks,
  TrendingUp, Microscope, User, Menu, X, ChevronRight
} from 'lucide-react';
import './AppLayout.css';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: ROUTES.overview, label: 'Overview', icon: LayoutDashboard },
      { to: ROUTES.skills, label: 'Skill Analysis', icon: BarChart3 },
      { to: ROUTES.scenarios, label: 'Scenario Lab', icon: FlaskConical },
    ],
  },
  {
    label: 'Preparation',
    items: [
      { to: ROUTES.plan, label: 'Action Plan', icon: ListChecks },
      { to: ROUTES.progress, label: 'Progress', icon: TrendingUp },
    ],
  },
  {
    label: 'Research',
    items: [
      { to: ROUTES.modelLab, label: 'Model Lab', icon: Microscope },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  [ROUTES.overview]: 'Overview',
  [ROUTES.skills]: 'Skill Analysis',
  [ROUTES.scenarios]: 'Scenario Lab',
  [ROUTES.plan]: 'Action Plan',
  [ROUTES.progress]: 'Progress',
  [ROUTES.modelLab]: 'Model Lab',
  [ROUTES.profile]: 'Profile & Settings',
};

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const latestAssessment = useStore((s) => s.getLatestAssessment());
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
            <span className="wordmark-accent">Placement</span>IQ
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
                  to={item.to}
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
            to={ROUTES.profile}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <User size={16} />
            <span>Profile & Settings</span>
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
            {latestAssessment && (
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

          <div className="topbar-right">
            <span className="preview-indicator">Frontend preview</span>
          </div>
        </header>

        <main id="main-content" className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
