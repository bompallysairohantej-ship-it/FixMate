import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Refrigerator,
  WashingMachine,
  Wrench,
  ArrowUpRight,
  FileCheck,
  CheckCircle2,
  Activity,
  Trash2,
  Pencil,
  Upload,
  Sparkles,
} from 'lucide-react';
import { api, errorMessage, upload, label, money, when } from '../services/api';
import { useAuth } from '../contexts/Auth';
import { Button, Field, Alert, Empty, Loading, Modal, Badge, useData } from '../components/UI';
export function Overview() {
  const { user } = useAuth();
  const { data: repairs, error, loading } = useData('/repairs');
  const { data: appliances } = useData(user.role === 'customer' ? '/appliances' : null);
  const { data: profile } = useData(user.role === 'technician' ? '/profile' : null);
  if (loading) return <Loading />;
  const counts =
    user.role === 'customer'
      ? [
          [Refrigerator, 'My appliances', appliances?.length || 0],
          [
            Activity,
            'Active requests',
            repairs?.filter((r) => !['CLOSED', 'DECLINED', 'CANCELLED'].includes(r.status))
              .length || 0,
          ],
          [
            FileCheck,
            'Quotes to approve',
            repairs?.filter((r) => r.status === 'QUOTE_SENT').length || 0,
          ],
          [
            CheckCircle2,
            'Completed repairs',
            repairs?.filter((r) => r.status === 'CLOSED').length || 0,
          ],
        ]
      : [
          [Plus, 'New requests', repairs?.filter((r) => r.status === 'REQUESTED').length || 0],
          [
            Wrench,
            'Accepted requests',
            repairs?.filter((r) => r.status === 'ACCEPTED').length || 0,
          ],
          [
            Activity,
            'Inspections pending',
            repairs?.filter((r) => r.status === 'INSPECTION_SCHEDULED').length || 0,
          ],
          [
            FileCheck,
            'Awaiting approval',
            repairs?.filter((r) => r.status === 'QUOTE_SENT').length || 0,
          ],
          [
            Wrench,
            'In progress',
            repairs?.filter((r) => r.status === 'REPAIR_IN_PROGRESS').length || 0,
          ],
          [CheckCircle2, 'Completed', repairs?.filter((r) => r.status === 'CLOSED').length || 0],
        ];
  return (
    <>
      <div className="page-heading split">
        <div>
          <span className="eyebrow">A LITTLE SMARTER. A LOT SIMPLER.</span>
          <h1>
            Hello, {user.name.split(' ')[0]}
            <span className="green">.</span>
          </h1>
          <p>
            {user.role === 'customer'
              ? 'Your home is in good hands. Here’s what’s happening.'
              : 'Your next great repair starts here.'}
          </p>
        </div>
        {user.role === 'customer' && (
          <Link className="button" to="book">
            <Plus size={17} /> Book a repair
          </Link>
        )}
      </div>
      <Alert>{error}</Alert>
      {profile?.shop?.verification !== 'approved' && user.role === 'technician' && (
        <div className="pending-card">
          <ShieldNotice />
          <div>
            <h3>Your shop is awaiting verification.</h3>
            <p>
              {profile?.shop?.reason ||
                'Upload your documents in Profile. An administrator must approve your shop before you can accept repairs.'}
            </p>
            <Link to="profile" className="text-button">
              View verification details <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      )}
      <div className={`stats-grid ${user.role === 'technician' ? 'six' : ''}`}>
        {counts.map(([Icon, title, n]) => (
          <article className="stat-card" key={title}>
            <span>
              <Icon size={18} />
              {title}
            </span>
            <strong>{n.toString().padStart(2, '0')}</strong>
            <small>From your saved records</small>
          </article>
        ))}
      </div>
      {user.role === 'customer' && (
        <div className="dashboard-assist">
          <div className="note-icon">
            <Sparkles />
          </div>
          <div>
            <h3>Something not quite right?</h3>
            <p>Turn appliance symptoms into a clearer next step.</p>
          </div>
          <Link className="button outline" to="assist">
            Ask Smart Assist <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      <div className="section-heading compact">
        <h2>Recent repair activity</h2>
        <Link className="text-button" to="requests">
          View all requests <ArrowUpRight size={16} />
        </Link>
      </div>
      <RepairTable repairs={repairs?.slice(0, 5) || []} />
    </>
  );
}
function ShieldNotice() {
  return <FileCheck size={30} className="green" />;
}
export function RepairTable({ repairs }) {
  const { user } = useAuth();
  return repairs.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Appliance / request</th>
            <th>Repair shop</th>
            <th>Status</th>
            <th>Requested</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {repairs.map((r) => (
            <tr key={r._id}>
              <td>
                <strong>
                  {r.appliance?.brand} {r.appliance?.model}
                </strong>
                <small>
                  #{r._id.slice(-6).toUpperCase()} · {label(r.category)}
                </small>
              </td>
              <td>{r.shop?.name || 'Assigned shop'}</td>
              <td>
                <Badge status={r.status} />
              </td>
              <td>
                {new Date(r.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </td>
              <td>
                <Link to={`/${user.role}/dashboard/repairs/${r._id}`} className="text-button">
                  View <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="A clean slate" text="Your repair requests and updates will appear here." />
  );
}
export function Requests({ mode = 'requests' }) {
  const { data, error, loading, reload } = useData('/repairs');
  const [filter, setFilter] = useState('');
  const filters = {
    quotes: ['QUOTE_SENT', 'QUOTE_APPROVED', 'QUOTE_REJECTED', 'QUOTE_PENDING'],
    history: ['CLOSED', 'REPAIR_COMPLETED', 'READY_FOR_COLLECTION'],
    reviews: ['CLOSED'],
    inspections: ['ACCEPTED', 'INSPECTION_SCHEDULED', 'INSPECTED'],
    assigned: [
      'ACCEPTED',
      'INSPECTION_SCHEDULED',
      'INSPECTED',
      'QUOTE_PENDING',
      'QUOTE_SENT',
      'QUOTE_APPROVED',
      'REPAIR_IN_PROGRESS',
    ],
    tracking: [
      'REQUESTED',
      'ACCEPTED',
      'INSPECTION_SCHEDULED',
      'INSPECTED',
      'QUOTE_PENDING',
      'QUOTE_SENT',
      'QUOTE_APPROVED',
      'REPAIR_IN_PROGRESS',
      'REPAIR_COMPLETED',
      'READY_FOR_COLLECTION',
    ],
  };
  const list =
    data?.filter(
      (r) =>
        (!filters[mode] || filters[mode].includes(r.status)) &&
        (!filter ||
          `${r.appliance?.brand} ${r.appliance?.model} ${r.status}`
            .toLowerCase()
            .includes(filter.toLowerCase()))
    ) || [];
  return (
    <>
      <div className="page-heading split">
        <div>
          <span className="eyebrow">EVERY REPAIR, IN ONE PLACE</span>
          <h1>
            {{
              quotes: 'Quotations & approvals',
              history: 'Service history',
              reviews: 'Your completed services',
              inspections: 'Inspection workspace',
              assigned: 'Assigned repairs',
              tracking: 'Repair tracking',
            }[mode] || 'Repair requests'}
          </h1>
          <p>Open a request for its timeline, findings, quotations, and available actions.</p>
        </div>
        <Button variant="outline" onClick={reload}>
          Refresh
        </Button>
      </div>
      <div className="filter-bar">
        <input
          aria-label="Filter requests"
          placeholder="Search appliance or status…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span>{list.length} records</span>
      </div>
      <Alert>{error}</Alert>
      {loading ? <Loading /> : <RepairTable repairs={list} />}
    </>
  );
}
export function Appliances() {
  const { data, error, loading, reload } = useData('/appliances');
  const { data: categories } = useData('/categories');
  const [editing, setEditing] = useState(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const f = new FormData(e.target);
      const image = f.get('image');
      const body = {
        category: f.get('category'),
        brand: f.get('brand'),
        model: f.get('model'),
        purchaseYear: Number(f.get('purchaseYear')),
        serial: f.get('serial'),
        warranty: f.get('warranty'),
        image: image?.size ? await upload(image, 'appliance') : editing?.image,
      };
      if (editing) await api.patch(`/appliances/${editing._id}`, body);
      else await api.post('/appliances', body);
      setOpen(false);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const archive = async (a) => {
    if (!window.confirm(`Archive ${a.brand} ${a.model}? Service history will be preserved.`))
      return;
    try {
      await api.delete(`/appliances/${a._id}`);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <>
      <div className="page-heading split">
        <div>
          <span className="eyebrow">YOUR HOME, ORGANIZED</span>
          <h1>Meet your everyday essentials.</h1>
          <p>Keep appliance details handy for your next repair.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setErr('');
            setOpen(true);
          }}
        >
          <Plus size={17} /> Add appliance
        </Button>
      </div>
      <Alert>{error || (!open && err)}</Alert>
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="appliances-grid">
          {data.map((a) => (
            <article className="panel appliance-card" key={a._id}>
              <div className="appliance-card-illustration">
                {a.category === 'washing-machine' ? <WashingMachine /> : <Refrigerator />}
              </div>
              <Badge>{label(a.category)}</Badge>
              <h2>
                {a.brand} {a.model}
              </h2>
              <p>Purchased {a.purchaseYear || 'year unknown'}</p>
              {a.warranty && <p>{a.warranty}</p>}
              <div className="button-row">
                <Link to={`../book?appliance=${a._id}`} className="button outline">
                  Book repair <ArrowUpRight size={16} />
                </Link>
                <button
                  className="icon-button"
                  aria-label="Edit appliance"
                  onClick={() => {
                    setEditing(a);
                    setErr('');
                    setOpen(true);
                  }}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label="Archive appliance"
                  onClick={() => archive(a)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Let’s get to know your appliances"
          text="Register your first appliance to book an inspection."
        />
      )}
      {open && (
        <Modal title={editing ? 'Edit appliance' : 'Add an appliance'} close={() => setOpen(false)}>
          <form onSubmit={save}>
            <Alert>{err}</Alert>
            <Field label="Appliance category">
              <select name="category" defaultValue={editing?.category} required>
                <option value="">Select appliance</option>
                {categories?.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Brand">
                <input name="brand" defaultValue={editing?.brand} required />
              </Field>
              <Field label="Model">
                <input name="model" defaultValue={editing?.model} required />
              </Field>
              <Field label="Purchase year">
                <input
                  name="purchaseYear"
                  type="number"
                  min="1950"
                  max={new Date().getFullYear()}
                  defaultValue={editing?.purchaseYear || new Date().getFullYear()}
                  required
                />
              </Field>
              <Field label="Serial number (optional)">
                <input name="serial" defaultValue={editing?.serial} />
              </Field>
            </div>
            <Field label="Warranty details (optional)">
              <textarea name="warranty" defaultValue={editing?.warranty} />
            </Field>
            <Field label="Appliance photo (optional)" hint="PNG, JPEG or WebP · up to 5 MB">
              <input type="file" name="image" accept="image/png,image/jpeg,image/webp" />
            </Field>
            <Button busy={busy}>Save appliance</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Booking() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: appliances, error, loading } = useData('/appliances');
  const [applianceId, setApplianceId] = useState(params.get('appliance') || '');
  const appliance = appliances?.find((a) => a._id === applianceId);
  const [city, setCity] = useState(user.city || '');
  const { data: shops, error: shopError } = useData(
    appliance ? `/shops?category=${appliance.category}&city=${encodeURIComponent(city)}` : null
  );
  const [err, setErr] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const f = new FormData(e.target);
      const photos = await Promise.all(
        f
          .getAll('photos')
          .filter((f) => f.size)
          .map((file) => upload(file, 'repair'))
      );
      const r = await api.post('/repairs', {
        appliance: applianceId,
        shop: f.get('shop'),
        symptoms: f.get('symptoms'),
        city,
        address: f.get('address'),
        appointment: new Date(f.get('appointment')).toISOString(),
        photos,
      });
      navigate(`../repairs/${r.data._id}`);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">LET’S GET YOUR EVERYDAY BACK</span>
        <h1>A smarter fix starts here.</h1>
        <p>Tell the specialist what’s happening. You approve the cost after inspection.</p>
      </div>
      <Alert>{error || shopError || err}</Alert>
      {loading ? (
        <Loading />
      ) : !appliances?.length ? (
        <Empty
          title="First, add your appliance"
          text="Your technician needs the category, brand, and model."
        >
          <Link className="button" to="../appliances">
            Add appliance
          </Link>
        </Empty>
      ) : (
        <div className="booking-layout">
          <form className="panel" onSubmit={submit}>
            <h2>
              <span className="step-number">1</span> The appliance & the issue
            </h2>
            <Field label="Choose your appliance">
              <select value={applianceId} onChange={(e) => setApplianceId(e.target.value)} required>
                <option value="">Select appliance</option>
                {appliances.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.brand} {a.model} · {label(a.category)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="What’s happening?">
              <textarea
                name="symptoms"
                rows="4"
                defaultValue={params.get('symptoms') || ''}
                placeholder="When did the issue start? Any unusual noise or error code?"
                minLength={3}
                maxLength={4000}
                required
              />
            </Field>
            <Field label="Photos (optional)" hint="Up to 5 images · PNG, JPEG, WebP · 5 MB each">
              <input type="file" name="photos" multiple accept="image/png,image/jpeg,image/webp" />
            </Field>
            <h2>
              <span className="step-number">2</span> Where & who
            </h2>
            <div className="form-grid">
              <Field label="Service city">
                <input value={city} onChange={(e) => setCity(e.target.value)} required />
              </Field>
              <Field label="Verified repair shop">
                <select
                  name="shop"
                  key={applianceId + city}
                  defaultValue={params.get('shop') || ''}
                  required
                >
                  <option value="">Choose a matching shop</option>
                  {shops?.map((s) => (
                    <option value={s._id} key={s._id}>
                      {s.name}
                      {s.demo ? ' (demo)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {appliance && shops?.length === 0 && (
              <Alert>
                No verified shop has a published service for this appliance in this city.
              </Alert>
            )}
            <Field label="Service address">
              <textarea name="address" defaultValue={user.address} minLength={3} required />
            </Field>
            <h2>
              <span className="step-number">3</span> Your preferred appointment
            </h2>
            <Field
              label="Preferred date & time"
              hint="This is a request, not confirmed real-time availability. The shop confirms the inspection."
            >
              <input name="appointment" type="datetime-local" required />
            </Field>
            <Button busy={busy} disabled={!appliance || !shops?.length}>
              Submit repair request <ArrowUpRight size={17} />
            </Button>
          </form>
          <aside className="panel booking-summary">
            <Wrench size={32} className="green" />
            <h2>
              Good repairs.
              <br />
              No surprises.
            </h2>
            <p>1. Your chosen shop reviews the request.</p>
            <p>2. A technician inspects the appliance.</p>
            <p>3. You receive an itemized quotation.</p>
            <p>4. Work begins after your approval.</p>
            <div className="divider" />
            <small>
              No payment is collected through this application. Final charges are recorded against
              your approved quotation.
            </small>
          </aside>
        </div>
      )}
    </>
  );
}
