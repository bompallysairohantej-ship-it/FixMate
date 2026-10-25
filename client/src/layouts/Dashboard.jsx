import { useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Refrigerator,
  Search,
  Sparkles,
  PlusCircle,
  ClipboardList,
  Route,
  FileCheck,
  History,
  Star,
  Bell,
  UserRound,
  LogOut,
  Wrench,
  ShieldCheck,
  Store,
  Users,
  Layers,
  ChartNoAxesCombined,
  BookOpen,
  ScrollText,
  LifeBuoy,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { Logo, Loading, Alert, useData } from '../components/UI';
import { useAuth } from '../contexts/Auth';
import { errorMessage } from '../services/api';
const menus = {
  customer: [
    ['', 'Overview', LayoutDashboard],
    ['appliances', 'My appliances', Refrigerator],
    ['technicians', 'Find technicians', Search],
    ['assist', 'Smart Assist', Sparkles],
    ['book', 'Book a repair', PlusCircle],
    ['requests', 'My requests', ClipboardList],
    ['tracking', 'Repair tracking', Route],
    ['quotes', 'Quotes & approvals', FileCheck],
    ['history', 'Service history', History],
    ['reviews', 'Reviews', Star],
  ],
  technician: [
    ['', 'Overview', LayoutDashboard],
    ['requests', 'New requests', ClipboardList],
    ['assigned', 'Assigned repairs', Wrench],
    ['inspections', 'Inspection reports', Search],
    ['quotes', 'Quotations', FileCheck],
    ['tracking', 'Repair progress', Route],
    ['history', 'Completed repairs', History],
    ['services', 'Shop services', Store],
    ['messages', 'Messages', Bell],
  ],
  admin: [
    ['', 'Overview', LayoutDashboard],
    ['verification', 'Technician verification', ShieldCheck],
    ['shops', 'Repair shop management', Store],
    ['customers', 'Customer management', Users],
    ['categories', 'Appliance categories', Layers],
    ['active', 'Active repairs', Wrench],
    ['analytics', 'Analytics', ChartNoAxesCombined],
    ['reviews', 'Reported reviews', Star],
    ['knowledge', 'Knowledge base', BookOpen],
    ['support', 'Support investigations', LifeBuoy],
    ['audit', 'Audit logs', ScrollText],
    ['settings', 'Settings', Settings],
  ],
};
export default function Dashboard() {
  const { role } = useParams();
  const { user, loading, logout } = useAuth();
  const location = useLocation(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [error, setError] = useState('');
  const { data: health } = useData('/health');
  if (loading) return <Loading />;
  if (!user)
    return (
      <Navigate
        to={`/${role}/login`}
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  if (user.role !== role) return <Navigate to={`/${user.role}/dashboard`} replace />;
  const menu = [
    ...menus[role],
    ['notifications', 'Notifications', Bell],
    ['profile', 'Profile', UserRound],
  ];
  const current =
    menu.find(
      ([path]) => location.pathname === `/${role}/dashboard${path ? '/' + path : ''}`
    )?.[1] || 'Repair details';
  return (
    <div className="dashboard">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Logo />
          <button
            className="icon-button mobile-menu"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>
        <span className="sidebar-label">{role} WORKSPACE</span>
        <nav>
          {menu.map(([path, title, Icon]) => (
            <NavLink
              key={path}
              to={`/${role}/dashboard${path ? '/' + path : ''}`}
              end={!path}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              <span>{title}</span>
              {path === 'assist' && <span className="tiny-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-avatar">{user.name.slice(0, 1)}</div>
          <div>
            <strong>{user.name}</strong>
            <small>{role}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              try {
                await logout();
                navigate(`/${role}/login`);
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div>
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu />
            </button>
            <span>
              Workspace <span className="muted">/</span> <strong>{current}</strong>
            </span>
          </div>
          <div>
            <span className="workspace-status">
              <span className="tiny-dot" />
              {health?.demo ? 'Local demo' : 'FixMate workspace'}
            </span>
            <NavLink
              to={`/${role}/dashboard/notifications`}
              className="icon-button"
              aria-label="Notifications"
            >
              <Bell size={19} />
            </NavLink>
            <span className="account-avatar small">{user.name[0]}</span>
          </div>
        </header>
        {health?.demo && (
          <div className="demo-banner">
            Demonstration environment · businesses, reviews, and seeded records are fictional.
            Actions save to a real MongoDB database.
          </div>
        )}
        <div className="workspace-content">
          <Alert>{error}</Alert>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
