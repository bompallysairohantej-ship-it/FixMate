import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  Wrench,
  ShieldCheck,
  Clock3,
  Activity,
  CheckCircle2,
  Plus,
  RefreshCw,
  BookOpen,
  ArrowUpRight,
} from 'lucide-react';
import { api, errorMessage, label, when } from '../services/api';
import { Button, Field, Alert, Badge, Empty, Loading, useData } from '../components/UI';
const colors = ['#29df76', '#137a45', '#a7b6aa', '#f04452', '#487658'];
function Chart({ title, data }) {
  return (
    <section className="panel chart-panel">
      <h3>{title}</h3>
      {data?.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid stroke="#243128" vertical={false} />
            <XAxis
              dataKey={data[0]?.name ? 'name' : '_id'}
              tick={{ fill: '#a7b6aa', fontSize: 10 }}
              tickFormatter={label}
            />
            <YAxis allowDecimals={false} tick={{ fill: '#a7b6aa', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#111a14', border: '1px solid #29402f', borderRadius: 8 }}
            />
            <Bar dataKey="count" fill="#29df76" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Empty title="No data yet" text="Charts populate from saved MongoDB records." />
      )}
    </section>
  );
}
export function AdminOverview({ analyticsOnly = false, activeOnly = false }) {
  const { data, error, loading, reload } = useData('/admin/overview');
  const { data: analytics, error: chartError, reload: reloadCharts } = useData('/admin/analytics');
  const cards = [
    [Users, 'Customers', 'customers'],
    [Wrench, 'Technicians', 'technicians'],
    [ShieldCheck, 'Verified shops', 'verified'],
    [Clock3, 'Pending applications', 'pending'],
    [Activity, 'Active repairs', 'active'],
    [CheckCircle2, 'Completed repairs', 'completed'],
  ];
  return (
    <>
      <div className="page-heading split">
        <div>
          <span className="eyebrow">FIXMATE CONTROL CENTER</span>
          <h1>
            {activeOnly
              ? 'Active repair overview.'
              : analyticsOnly
                ? 'The bigger picture.'
                : 'A clear view of your platform.'}
          </h1>
          <p>
            Operational metrics from saved records. Private repair details require authorized
            support access.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            reload();
            reloadCharts();
          }}
        >
          <RefreshCw size={16} /> Refresh
        </Button>
      </div>
      <Alert>{error || chartError}</Alert>
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="stats-grid six">
            {cards.map(([Icon, title, key]) => (
              <div className="stat-card" key={key}>
                <span>
                  <Icon size={18} />
                  {title}
                </span>
                <strong>{String(data?.[key] || 0).padStart(2, '0')}</strong>
                <small>Database-backed metric</small>
              </div>
            ))}
          </div>
          {!analyticsOnly && !activeOnly && (
            <div className="dashboard-assist">
              <ShieldCheck className="green" size={28} />
              <div>
                <h3>{data?.pending || 0} shop applications need review</h3>
                <p>Review the business details and verification documents.</p>
              </div>
              <Link className="button outline" to="verification">
                Review applications <ArrowUpRight size={16} />
              </Link>
            </div>
          )}
          <div className="charts-grid">
            <Chart title="Repairs by appliance" data={analytics?.categories} />
            <Chart title="Monthly repair requests" data={analytics?.monthly} />
            <Chart title="Current technician workload" data={analytics?.workload} />
            <Chart title="Repair stages" data={analytics?.statuses} />
            <Chart title="Shop verification" data={analytics?.verification} />
            <section className="panel completion-card">
              <span className="eyebrow">COMPLETION RATE</span>
              <strong>
                {analytics?.statuses?.reduce((s, r) => s + r.count, 0)
                  ? Math.round(
                      ((data?.completed || 0) /
                        analytics.statuses.reduce((s, r) => s + r.count, 0)) *
                        100
                    )
                  : 0}
                %
              </strong>
              <p>Closed repairs as a share of all submitted requests.</p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
export function AdminManager({ section }) {
  const endpoints = {
    verification: 'shops',
    shops: 'shops',
    customers: 'customers',
    categories: 'categories',
    reviews: 'reviews',
    knowledge: 'knowledge-documents',
    audit: 'audit-logs',
    support: 'investigations',
  };
  const titles = {
    verification: 'Verify the people behind the repairs.',
    shops: 'Repair shop oversight.',
    customers: 'Customer directory.',
    categories: 'Appliance categories.',
    reviews: 'Reported reviews.',
    knowledge: 'Approved knowledge.',
    audit: 'Accountability, recorded.',
    support: 'Support investigations.',
  };
  const { data, error, loading, reload } = useData(`/admin/${endpoints[section]}`);
  const { data: categories } = useData(section === 'knowledge' ? '/categories' : null);
  const [err, setErr] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false),
    [create, setCreate] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    setErr('');
    setSuccess('');
    try {
      await fn();
      setSuccess('Saved successfully.');
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const reason = () => window.prompt('Record the reason for this action:');
  const rows =
    section === 'verification' ? data?.filter((s) => s.verification === 'pending') : data;
  return (
    <>
      <div className="page-heading split">
        <div>
          <span className="eyebrow">PLATFORM ADMINISTRATION</span>
          <h1>{titles[section]}</h1>
          <p>
            {section === 'support'
              ? 'Customers must authorize access in their Profile. Every private read is logged.'
              : section === 'knowledge'
                ? 'Approve reference documents, then rebuild embeddings when Ollama and Atlas are configured.'
                : 'All management actions are enforced by the backend.'}
          </p>
        </div>
        <div className="button-row">
          {['categories', 'knowledge', 'support'].includes(section) && (
            <Button onClick={() => setCreate(!create)}>
              <Plus size={16} />
              {create ? 'Close form' : 'Add new'}
            </Button>
          )}
          <Button variant="outline" onClick={reload}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </div>
      <Alert>{error || err}</Alert>
      <Alert good>{success}</Alert>
      {create && (
        <form
          className="panel admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.target));
            if (section === 'categories')
              f.symptoms = f.symptoms
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            run(async () => {
              await api.post(`/admin/${endpoints[section]}`, f);
              setCreate(false);
            });
          }}
        >
          <h2>
            {section === 'categories'
              ? 'Add household appliance'
              : section === 'knowledge'
                ? 'Approve troubleshooting reference'
                : 'Request limited support access'}
          </h2>
          {section === 'categories' ? (
            <>
              <div className="form-grid">
                <Field label="Name">
                  <input name="name" required />
                </Field>
                <Field label="Slug (lowercase-hyphens)">
                  <input name="slug" pattern="[a-z]+(-[a-z]+)*" required />
                </Field>
              </div>
              <Field label="Appliance group">
                <select name="group">
                  {['Cooling', 'Laundry', 'Kitchen', 'Household electrical'].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description">
                <textarea name="description" required minLength={3} />
              </Field>
              <Field label="Common symptoms (comma separated)">
                <input name="symptoms" required />
              </Field>
            </>
          ) : section === 'knowledge' ? (
            <>
              <Field label="Document title">
                <input name="title" required />
              </Field>
              <Field label="Appliance">
                <select name="category" required>
                  {categories?.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Source / reference">
                <input
                  name="source"
                  required
                  placeholder="Manual title, edition and page, or official source URL"
                />
              </Field>
              <Field
                label="Approved safe guidance"
                hint="Only approved symptom explanations and safe user checks. Never include hazardous repair procedures."
              >
                <textarea name="content" rows="7" minLength={30} maxLength={80000} required />
              </Field>
              <Field label="Or load a plain-text document">
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={async (e) => {
                    const f = e.target.files[0];
                    if (f) {
                      if (f.size > 80000) {
                        setErr('Text documents must be 80 KB or smaller.');
                        return;
                      }
                      e.target.form.elements.content.value = await f.text();
                    }
                  }}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Repair record ID">
                <input name="repair" pattern="[a-fA-F0-9]{24}" required />
              </Field>
              <Field label="Investigation reason">
                <textarea name="reason" minLength={3} required />
              </Field>
            </>
          )}
          <Button busy={busy}>Save {section === 'support' ? 'access request' : 'record'}</Button>
        </form>
      )}
      {section === 'knowledge' && (
        <div className="button-row bottom-space">
          <Button
            variant="outline"
            busy={busy}
            onClick={() => run(() => api.post('/admin/knowledge-documents/reindex'))}
          >
            <RefreshCw size={16} /> Rebuild knowledge & service embeddings
          </Button>
          <small className="muted">
            Run npm run indexes once to provision the Atlas vector indexes.
          </small>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : !rows?.length ? (
        <Empty title="Nothing needs attention" text="New records appear here when available." />
      ) : section === 'customers' || section === 'audit' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {(section === 'customers'
                  ? ['Name', 'Email', 'Phone', 'City']
                  : ['Action', 'Actor', 'Target', 'Reason', 'Time']
                ).map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  {(section === 'customers'
                    ? [r.name, r.email, r.phone, r.city]
                    : [r.action, r.actor?.name, r.target, r.reason, when(r.createdAt)]
                  ).map((v, i) => (
                    <td key={i}>{v || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-records">
          {rows.map((r) => (
            <article className="panel admin-record" key={r._id}>
              {['shops', 'verification'].includes(section) ? (
                <>
                  <div className="section-heading compact">
                    <h2>{r.name}</h2>
                    <Badge status={r.verification}>
                      {r.verification}
                      {!r.active ? ' · suspended' : ''}
                    </Badge>
                  </div>
                  <p>
                    {r.owner?.name} · {r.owner?.email} · {r.owner?.phone}
                  </p>
                  <p>
                    {r.address} · {r.city}
                  </p>
                  <div className="tags">
                    {r.categories.map((c) => (
                      <Badge key={c}>{label(c)}</Badge>
                    ))}
                  </div>
                  <p>Experience: {r.profile?.experience || 0} years</p>
                  {r.demo && (
                    <span className="demo-label">
                      Fictional demonstration shop · document exemption for seed data only
                    </span>
                  )}
                  <div className="button-row">
                    {r.profile?.documents?.map((d, i) => (
                      <a
                        key={d}
                        className="button outline"
                        href={`/api/uploads/${d}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Review document {i + 1}
                      </a>
                    ))}
                  </div>
                  <div className="button-row">
                    {['approved', 'rejected'].map((v) => (
                      <Button
                        key={v}
                        busy={busy}
                        variant={v === 'rejected' ? 'danger-outline' : ''}
                        disabled={r.verification === v}
                        onClick={() => {
                          const note = reason();
                          if (note)
                            run(() =>
                              api.patch(`/admin/shops/${r._id}/verification`, {
                                verification: v,
                                reason: note,
                              })
                            );
                        }}
                      >
                        {v === 'approved' ? 'Approve shop' : 'Reject application'}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      busy={busy}
                      onClick={() => {
                        const note = reason();
                        if (note)
                          run(() =>
                            api.patch(`/admin/shops/${r._id}/active`, {
                              active: !r.active,
                              reason: note,
                            })
                          );
                      }}
                    >
                      {r.active ? 'Suspend shop' : 'Activate shop'}
                    </Button>
                  </div>
                  {r.services?.map((s) => (
                    <div className="quote-row" key={s._id}>
                      <span>{s.title}</span>
                      <button
                        className="text-button"
                        onClick={() =>
                          run(() => api.patch(`/services/${s._id}`, { published: !s.published }))
                        }
                      >
                        {s.published ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  ))}
                </>
              ) : section === 'categories' ? (
                <>
                  <div className="section-heading compact">
                    <h2>{r.name}</h2>
                    <Badge>{r.active ? 'Active' : 'Disabled'}</Badge>
                  </div>
                  <p>
                    {r.group} · {r.description}
                  </p>
                  <p className="muted">{r.symptoms.join(' · ')}</p>
                  <div className="button-row">
                    <Button
                      variant="outline"
                      busy={busy}
                      onClick={() =>
                        run(() => api.patch(`/admin/categories/${r._id}`, { active: !r.active }))
                      }
                    >
                      {r.active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const name = window.prompt('Category name', r.name);
                        if (!name) return;
                        const description = window.prompt('Description', r.description);
                        if (description)
                          run(() => api.patch(`/admin/categories/${r._id}`, { name, description }));
                      }}
                    >
                      Edit details
                    </Button>
                  </div>
                </>
              ) : section === 'knowledge' ? (
                <>
                  <div className="section-heading compact">
                    <h2>{r.title}</h2>
                    <BookOpen size={20} className="green" />
                  </div>
                  <Badge>{label(r.category)}</Badge>
                  <p>{r.content}</p>
                  <small className="muted">Source: {r.source}</small>
                  <p className="muted">
                    {r.indexedAt
                      ? `Last indexed ${when(r.indexedAt)}`
                      : 'Not embedded yet · available in reference mode'}
                  </p>
                </>
              ) : section === 'reviews' ? (
                <>
                  <Badge>
                    {r.hidden ? 'Hidden' : 'Visible'} · {r.rating}/5
                  </Badge>
                  <p>{r.comment}</p>
                  {r.reports.map((report, i) => (
                    <p key={i}>Report: {report.reason}</p>
                  ))}
                  <Button
                    variant="outline"
                    busy={busy}
                    onClick={() => {
                      const note = reason();
                      if (note)
                        run(() =>
                          api.patch(`/admin/reviews/${r._id}`, {
                            hidden: !r.hidden,
                            moderationReason: note,
                          })
                        );
                    }}
                  >
                    {r.hidden ? 'Restore review' : 'Hide review'}
                  </Button>
                </>
              ) : (
                <>
                  <Badge status={r.status}>{r.status}</Badge>
                  <h3>Repair #{r.repair.slice(-6)}</h3>
                  <p>{r.reason}</p>
                  <small>Expires: {when(r.expiresAt)}</small>
                  <div className="button-row">
                    {r.status === 'authorized' && new Date(r.expiresAt) > new Date() && (
                      <Link className="button outline" to={`../repairs/${r.repair}`}>
                        Open authorized repair <ArrowUpRight size={16} />
                      </Link>
                    )}
                    {r.status !== 'closed' && (
                      <Button
                        variant="outline"
                        onClick={() => run(() => api.post(`/admin/investigations/${r._id}/close`))}
                      >
                        Close investigation
                      </Button>
                    )}
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
export function AdminSettings() {
  const { data, error } = useData('/health');
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">CONFIGURATION</span>
        <h1>Platform settings.</h1>
        <p>Runtime integrations are configured through the server environment.</p>
      </div>
      <Alert>{error}</Alert>
      <div className="panel narrow">
        <h2>Connection status</h2>
        <div className="quote-row">
          <span>Database</span>
          <Badge>{data?.status || 'Checking'}</Badge>
        </div>
        <div className="quote-row">
          <span>AI integration enabled</span>
          <Badge>{data?.aiEnabled ? 'Enabled' : 'Reference mode'}</Badge>
        </div>
        <div className="quote-row">
          <span>Environment</span>
          <Badge>{data?.demo ? 'Local demonstration' : 'Configured MongoDB'}</Badge>
        </div>
        <p>
          Configure MongoDB, Ollama, vector index names, email delivery, and session secrets in the
          root .env file. Restart the server after changing configuration.
        </p>
        <p>
          Only environment configuration and the seed script can create the initial administrator.
          Secrets are never returned through this screen.
        </p>
      </div>
    </>
  );
}
