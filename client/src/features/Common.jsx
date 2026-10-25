import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Upload, ShieldCheck, Plus, Wrench } from 'lucide-react';
import { api, errorMessage, upload, money, when, label } from '../services/api';
import { useAuth } from '../contexts/Auth';
import { Button, Field, Alert, Badge, Empty, Loading, useData } from '../components/UI';
export function Notifications({ messages = false }) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useData('/notifications');
  const [err, setErr] = useState('');
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">ALWAYS IN THE LOOP</span>
        <h1>{messages ? 'Messages & quote questions' : 'Your updates.'}</h1>
        <p>Service changes and quotation questions appear here.</p>
      </div>
      <Alert>{error || err}</Alert>
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="notification-list">
          {data
            .filter((n) => !messages || /clarification/i.test(n.message))
            .map((n) => (
              <article className={`panel notification ${n.read ? 'read' : ''}`} key={n._id}>
                <Bell size={20} />
                <div>
                  <p>{n.message}</p>
                  <small>{when(n.createdAt)}</small>
                  {n.repair && (
                    <Link
                      className="text-button"
                      to={`/${user.role}/dashboard/repairs/${n.repair}`}
                    >
                      Open repair
                    </Link>
                  )}
                </div>
                {!n.read && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await api.patch(`/notifications/${n._id}`);
                        reload();
                      } catch (e) {
                        setErr(errorMessage(e));
                      }
                    }}
                  >
                    <Check size={16} /> Mark read
                  </Button>
                )}
              </article>
            ))}
        </div>
      ) : (
        <Empty title="You’re all caught up" text="Updates appear as your repairs move forward." />
      )}
    </>
  );
}
export function Profile() {
  const { user, setUser } = useAuth();
  const { data, error, loading, reload } = useData('/profile');
  const { data: support, reload: refreshSupport } = useData(
    user.role === 'customer' ? '/support-requests' : null
  );
  const [err, setErr] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    setErr('');
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
  if (loading) return <Loading />;
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">MADE PERSONAL</span>
        <h1>Your profile.</h1>
        <p>Keep your contact and service details up to date.</p>
      </div>
      <Alert>{error || err}</Alert>
      <Alert good>{success}</Alert>
      <div className="profile-grid">
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.target));
            run(async () => {
              const r = await api.patch('/profile', f);
              setUser(r.data);
            });
          }}
        >
          <h2>Account details</h2>
          {[
            ['name', 'Full name'],
            ['phone', 'Phone number'],
            ['city', 'City'],
            ['address', 'Service address'],
          ].map(([name, title]) => (
            <Field label={title} key={name}>
              <input name={name} defaultValue={data?.user[name]} required />
            </Field>
          ))}
          <Field label="Email">
            <input value={data?.user.email || ''} disabled />
          </Field>
          <Button busy={busy}>Save changes</Button>
        </form>
        {data?.shop && (
          <div className="panel">
            <h2>Shop verification</h2>
            <Badge status={data.shop.verification}>{data.shop.verification}</Badge>
            <h3>{data.shop.name}</h3>
            <p>
              {data.shop.reason ||
                'An administrator reviews your application and uploaded verification documents.'}
            </p>
            <p>{data.technician?.documents?.length || 0} verification document(s) uploaded.</p>
            {data.technician?.documents?.map((id, i) => (
              <a
                className="text-button"
                href={`/api/uploads/${id}`}
                target="_blank"
                rel="noreferrer"
                key={id}
              >
                View document {i + 1}
              </a>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.target);
                run(() => upload(f.get('file'), 'verification'));
              }}
            >
              <Field
                label="Add verification document"
                hint="Business registration, identity, or certification · PDF or image · up to 5 MB"
              >
                <input
                  name="file"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  required
                />
              </Field>
              <Button variant="outline" busy={busy}>
                <Upload size={16} /> Upload document
              </Button>
            </form>
            <div className="divider" />
            <h3>Update shop details</h3>
            <p className="muted">
              Changing the shop name or address triggers administrator re-verification.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.target));
                run(() => api.patch(`/shops/${data.shop._id}`, f));
              }}
            >
              {[
                ['name', 'Shop name'],
                ['address', 'Shop address'],
                ['city', 'Service city'],
              ].map(([name, title]) => (
                <Field label={title} key={name}>
                  <input name={name} defaultValue={data.shop[name]} required />
                </Field>
              ))}
              <Button variant="outline" busy={busy}>
                Update shop & request review
              </Button>
            </form>
          </div>
        )}
        {support?.length > 0 && (
          <div className="panel">
            <h2>Support access requests</h2>
            <p>
              An administrator needs your permission to inspect a private repair record. Access
              expires after 24 hours.
            </p>
            {support.map((s) => (
              <div className="support-request" key={s._id}>
                <strong>Repair #{s.repair.slice(-6)}</strong>
                <p>{s.reason}</p>
                <Button
                  busy={busy}
                  onClick={() =>
                    run(async () => {
                      await api.post(`/support-requests/${s._id}/authorize`);
                      refreshSupport();
                    })
                  }
                >
                  Authorize limited access
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
export function ShopServices() {
  const { data, error, loading, reload } = useData('/my-shop');
  const { data: categories } = useData('/categories');
  const [err, setErr] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const form = e.target;
    const f = Object.fromEntries(new FormData(form));
    try {
      await api.post('/services', { ...f, inspectionPrice: Number(f.inspectionPrice) });
      form.reset();
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">YOUR EXPERTISE, DISCOVERED</span>
        <h1>Shop services.</h1>
        <p>Publish appliance services to help customers find the right specialist.</p>
      </div>
      <Alert>{error || err}</Alert>
      {loading ? (
        <Loading />
      ) : (
        <div className="profile-grid">
          <div>
            {data?.services.map((s) => (
              <article className="panel service-item" key={s._id}>
                <Badge>{s.published ? 'Published' : 'Unpublished'}</Badge>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
                <strong className="green">{money(s.inspectionPrice)} inspection</strong>
                <div>
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await api.patch(`/services/${s._id}`, { published: !s.published });
                        reload();
                      } catch (e) {
                        setErr(errorMessage(e));
                      }
                    }}
                  >
                    {s.published ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <form className="panel" onSubmit={submit}>
            <h2>Add a service</h2>
            <Field label="Appliance">
              <select name="category" required>
                <option value="">Select appliance</option>
                {categories
                  ?.filter((c) => data?.shop.categories.includes(c.slug))
                  .map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Service title">
              <input name="title" required />
            </Field>
            <Field label="Description">
              <textarea name="description" minLength={3} required />
            </Field>
            <Field label="Inspection charge (INR)">
              <input
                type="number"
                name="inspectionPrice"
                min="0"
                max="1000000"
                step=".01"
                required
              />
            </Field>
            <Button busy={busy}>
              <Plus size={16} /> Publish service
            </Button>
            <p className="muted">
              Services appear publicly only while your shop is approved and active.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
