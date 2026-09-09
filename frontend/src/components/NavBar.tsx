import { useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { useTheme } from '../theme';

function AboutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function ScribeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19v-7" />
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M8 22h8" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 12h6M9 16h6M9 8h2" />
    </svg>
  );
}

function PatientsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M17 14c2.8.3 5 2.6 5 6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H2a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 3.65 8a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H8a1.7 1.7 0 0 0 1-1.56V2a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V8a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z"
      />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 1 0 20.354 15.354Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

const LINKS = [
  { to: '/', label: 'Home', end: true, Icon: HomeIcon },
  { to: '/scribe', label: 'Scribe', Icon: ScribeIcon },
  { to: '/notes', label: 'Report', Icon: ReportIcon },
  { to: '/patients', label: 'Patients', Icon: PatientsIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
  { to: '/about', label: 'About', Icon: AboutIcon },
];

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export default function NavBar() {
  const { user, logout } = useAuth();
  const avatar = user?.avatar;
  const location = useLocation();
  const linksRef = useRef<HTMLElement>(null);
  const { theme, toggleTheme } = useTheme();
  const [highlight, setHighlight] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
    function measure() {
      const container = linksRef.current;
      const active = container?.querySelector('a.active') as HTMLElement | null;
      if (container && active) {
        setHighlight({ left: active.offsetLeft, width: active.offsetWidth, ready: true });
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [location.pathname]);

  
  
  
  useLayoutEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    function handleResize() {
      if (window.innerWidth > 760) setMenuOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeLink = LINKS.find((link) => link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to));

  return (
    <>
    <header className="app-topnav">
      <Link to="/" className="app-logo" style={{ textDecoration: 'none' }}>
        <img src="/logo.png" alt="Consult Scribe" />
        <span className="app-logo-text">Consult Scribe</span>
      </Link>

      <div className="app-topnav-mobile-actions">
        <button type="button" className="app-icon-btn app-bell-btn" title="Notifications" aria-label="Notifications">
          <BellIcon />
          <span className="app-bell-badge">9+</span>
        </button>
        <button
          type="button"
          className="app-icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <button
        type="button"
        className="app-nav-menu-btn"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      <div className={`app-nav-collapsible${menuOpen ? ' is-open' : ''}`}>
        <nav className="app-nav-links" ref={linksRef}>
          <span
            className="app-nav-highlight"
            style={{
              transform: `translateX(${highlight.left}px)`,
              width: highlight.width,
              opacity: highlight.ready ? 1 : 0,
            }}
          />
          {LINKS.map(({ to, label, end, Icon }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-nav-actions">
          <Link to="/patients" className="app-nav-primary">
            <PlusIcon />
            <span>New patient</span>
          </Link>

          <div className="app-nav-utility-actions" aria-label="Application controls">
            <button type="button" className="app-icon-btn app-bell-btn" title="Notifications" aria-label="Notifications">
              <BellIcon />
              <span className="app-bell-badge">9+</span>
            </button>
            <button
              type="button"
              className="app-icon-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button type="button" className="app-icon-btn" onClick={logout} title="Sign out" aria-label="Sign out">
              <SignOutIcon />
            </button>
          </div>

          <Link to="/settings" className="app-profile-chip">
            <span className="app-profile-name">{user?.name}</span>
            <span className="app-profile-avatar-wrap">
              {avatar ? (
                <img src={avatar} alt="" className="app-profile-photo" />
              ) : (
                <span className="app-profile-avatar">{initials(user?.name)}</span>
              )}
              <span className="app-profile-status" />
            </span>
          </Link>
        </div>
      </div>
    </header>

    {}
    <nav className="app-mobile-bottom-bar" aria-label="Mobile navigation bar">
      <NavLink to="/" end className="mobile-bottom-item" title="Home">
        <HomeIcon />
        <span>Home</span>
      </NavLink>

      <NavLink to="/notes" className="mobile-bottom-item" title="Report">
        <ReportIcon />
        <span>Report</span>
      </NavLink>

      <NavLink to="/scribe" className="mobile-bottom-item mobile-mic-fab" title="Start Consultation / Scribe">
        <div className="mobile-mic-circle">
          <ScribeIcon />
        </div>
      </NavLink>

      <NavLink to="/patients" className="mobile-bottom-item" title="Patients">
        <div className="mobile-item-icon-wrap">
          <PatientsIcon />
          <span className="mobile-badge-dot" />
        </div>
        <span>Patient</span>
      </NavLink>

      <NavLink to="/settings" className="mobile-bottom-item" title="Settings">
        {avatar ? (
          <img src={avatar} alt="" className="mobile-avatar-icon" />
        ) : (
          <SettingsIcon />
        )}
        <span>Settings</span>
      </NavLink>
    </nav>
    </>
  );
}
