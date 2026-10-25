import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/Auth';
import { Loading, Logo } from './components/UI';
import './styles/index.css';
const Home = lazy(() => import('./pages/Home'));
const Auth = lazy(() => import('./pages/Auth'));
const Recovery = lazy(() => import('./pages/Auth').then((m) => ({ default: m.PasswordRecovery })));
const Dashboard = lazy(() => import('./layouts/Dashboard'));
const Assist = lazy(() => import('./pages/Assist'));
const Shops = lazy(() => import('./pages/Discovery').then((m) => ({ default: m.Shops })));
const Overview = lazy(() => import('./features/Customer').then((m) => ({ default: m.Overview })));
const Appliances = lazy(() =>
  import('./features/Customer').then((m) => ({ default: m.Appliances }))
);
const Booking = lazy(() => import('./features/Customer').then((m) => ({ default: m.Booking })));
const Requests = lazy(() => import('./features/Customer').then((m) => ({ default: m.Requests })));
const RepairDetail = lazy(() => import('./features/RepairDetail'));
const Profile = lazy(() => import('./features/Common').then((m) => ({ default: m.Profile })));
const Notifications = lazy(() =>
  import('./features/Common').then((m) => ({ default: m.Notifications }))
);
const ShopServices = lazy(() =>
  import('./features/Common').then((m) => ({ default: m.ShopServices }))
);
const AdminOverview = lazy(() =>
  import('./features/Admin').then((m) => ({ default: m.AdminOverview }))
);
const AdminManager = lazy(() =>
  import('./features/Admin').then((m) => ({ default: m.AdminManager }))
);
const AdminSettings = lazy(() =>
  import('./features/Admin').then((m) => ({ default: m.AdminSettings }))
);
import { useAuth } from './contexts/Auth';
function RoleView({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user?.role) ? (
    children
  ) : (
    <Navigate to={`/${user?.role}/dashboard`} replace />
  );
}
function Index() {
  const { user } = useAuth();
  return user.role === 'admin' ? <AdminOverview /> : <Overview />;
}
function ScrollReset() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function Info({ kind }) {
  const content = {
    support: [
      'Support & contact',
      'For a repair question, open the repair request and use the quotation clarification action. Platform administrators can request access for a support investigation; you authorize it from Profile.',
      'This local project does not provide a live support phone line or inbox. Before public deployment, the operator must add their real support contact information.',
    ],
    privacy: [
      'Privacy policy — project demonstration',
      'FixMate stores account details, registered appliances, repair requests, uploads, messages, and service history in the configured MongoDB database. Uploaded files are private and available only to authorized participants.',
      'Technicians can access their assigned repairs. Administrators need a customer-authorized, time-limited investigation to read private repair details. Their access is logged. Ollama runs at the server-configured address; reference text and appliance symptoms are used for assistance.',
      'This is a demonstration policy. The operator must publish their legal identity, retention schedule, privacy contact, and applicable rights before public use.',
    ],
    terms: [
      'Terms of service — project demonstration',
      'FixMate coordinates appliance service requests. Appointment preferences are requests, not guaranteed availability. A technician must inspect an appliance and issue a quotation before billable work begins.',
      'Only the customer can approve a quotation. Smart Assist provides possible explanations, not a confirmed diagnosis. Do not perform dangerous electrical repairs. No payments are processed by this project.',
      'Fictional seeded shops, reviews, and service history are labeled as demonstration data. The operator must replace these demonstration terms with reviewed terms before public use.',
    ],
  };
  const [title, ...paragraphs] = content[kind];
  return (
    <div className="simple-page">
      <Logo />
      <article className="panel legal">
        <h1>{title}</h1>
        {paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <Link className="button outline" to="/">
          Back to FixMate
        </Link>
      </article>
    </div>
  );
}
class AppBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="simple-page">
        <Logo />
        <div className="panel">
          <h1>Something needs a refresh.</h1>
          <p>The page could not be displayed. Your saved records are safe on the server.</p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppBoundary>
        <AuthProvider>
          <ScrollReset />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/:role/login" element={<Auth />} />
              <Route path="/:role/register" element={<Auth register />} />
              <Route path="/forgot-password" element={<Recovery />} />
              <Route path="/reset-password" element={<Recovery reset />} />
              <Route path="/technicians" element={<Shops />} />
              <Route path="/assist" element={<Assist />} />
              {['privacy', 'terms', 'support'].map((kind) => (
                <Route key={kind} path={`/${kind}`} element={<Info kind={kind} />} />
              ))}
              <Route path="/:role/dashboard" element={<Dashboard />}>
                <Route index element={<Index />} />
                <Route
                  path="appliances"
                  element={
                    <RoleView roles={['customer']}>
                      <Appliances />
                    </RoleView>
                  }
                />
                <Route
                  path="book"
                  element={
                    <RoleView roles={['customer']}>
                      <Booking />
                    </RoleView>
                  }
                />
                <Route path="technicians" element={<Shops embedded />} />
                <Route
                  path="assist"
                  element={
                    <RoleView roles={['customer']}>
                      <Assist embedded />
                    </RoleView>
                  }
                />
                {[
                  'requests',
                  'assigned',
                  'tracking',
                  'quotes',
                  'inspections',
                  'history',
                  'reviews',
                ].map((mode) => (
                  <Route
                    key={mode}
                    path={mode}
                    element={
                      mode === 'reviews' ? (
                        <ReviewRoute />
                      ) : (
                        <RoleView roles={['customer', 'technician']}>
                          <Requests mode={mode} />
                        </RoleView>
                      )
                    }
                  />
                ))}
                <Route path="repairs/:id" element={<RepairDetail />} />
                <Route path="profile" element={<Profile />} />
                <Route path="notifications" element={<Notifications />} />
                <Route
                  path="messages"
                  element={
                    <RoleView roles={['technician']}>
                      <Notifications messages />
                    </RoleView>
                  }
                />
                <Route
                  path="services"
                  element={
                    <RoleView roles={['technician']}>
                      <ShopServices />
                    </RoleView>
                  }
                />
                {[
                  'verification',
                  'shops',
                  'customers',
                  'categories',
                  'knowledge',
                  'audit',
                  'support',
                ].map((section) => (
                  <Route
                    key={section}
                    path={section}
                    element={
                      <RoleView roles={['admin']}>
                        <AdminManager section={section} />
                      </RoleView>
                    }
                  />
                ))}
                <Route
                  path="analytics"
                  element={
                    <RoleView roles={['admin']}>
                      <AdminOverview analyticsOnly />
                    </RoleView>
                  }
                />
                <Route
                  path="active"
                  element={
                    <RoleView roles={['admin']}>
                      <AdminOverview activeOnly />
                    </RoleView>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <RoleView roles={['admin']}>
                      <AdminSettings />
                    </RoleView>
                  }
                />
              </Route>
              <Route
                path="*"
                element={
                  <div className="simple-page">
                    <Logo />
                    <h1>This page isn’t here.</h1>
                    <Link className="button" to="/">
                      Back home
                    </Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </AuthProvider>
      </AppBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
function ReviewRoute() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminManager section="reviews" /> : <Requests mode="reviews" />;
}
