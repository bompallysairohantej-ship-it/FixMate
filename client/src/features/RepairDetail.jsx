import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  FileText,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { api, errorMessage, label, money, when } from '../services/api';
import { useAuth } from '../contexts/Auth';
import { Button, Field, Alert, Badge, Loading, useData } from '../components/UI';
const next = {
  REQUESTED: 'ACCEPTED',
  ACCEPTED: 'INSPECTION_SCHEDULED',
  INSPECTED: 'QUOTE_PENDING',
  QUOTE_REJECTED: 'QUOTE_PENDING',
  QUOTE_APPROVED: 'REPAIR_IN_PROGRESS',
  REPAIR_COMPLETED: 'READY_FOR_COLLECTION',
  READY_FOR_COLLECTION: 'CLOSED',
};
const stages = [
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
  'CLOSED',
];
export default function RepairDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, loading, reload } = useData(`/repairs/${id}`);
  const [err, setErr] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(''),
    [items, setItems] = useState([
      { label: 'Inspection', amount: 299 },
      { label: 'Parts', amount: 0 },
      { label: 'Labor', amount: 0 },
      { label: 'Tax', amount: 0 },
    ]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  const action = async (url, body, method = 'post') => {
    setBusy(true);
    setErr('');
    setSuccess('');
    try {
      await api[method](url, body);
      setSuccess('Saved. The repair record has been updated.');
      reload();
      return true;
    } catch (e) {
      setErr(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (loading && !data) return <Loading />;
  if (!data) return <Alert>{error}</Alert>;
  const { repair: r, history, inspection, quotes, review } = data;
  const tech = user.role === 'technician',
    customer = user.role === 'customer';
  const activeQuote = quotes.find((q) => q.status === 'pending');
  const approved = quotes.find((q) => q.status === 'approved');
  const transition = (status) =>
    action(
      `/repairs/${id}/status`,
      { status, note: note || `Status updated to ${label(status)}.` },
      'patch'
    );
  return (
    <>
      <Link className="text-button" to={`/${user.role}/dashboard/requests`}>
        <ArrowLeft size={16} /> Back to requests
      </Link>
      <div className="page-heading split">
        <div>
          <span className="eyebrow">REPAIR #{id.slice(-6).toUpperCase()}</span>
          <h1>
            {r.appliance?.brand} {r.appliance?.model}
          </h1>
          <p>
            {r.shop?.name} · {label(r.category)}
          </p>
        </div>
        <div className="button-row">
          <Badge status={r.status} />
          <Button variant="outline" onClick={reload}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </div>
      <Alert>{error || err}</Alert>
      <Alert good>{success}</Alert>
      <div className="repair-layout">
        <div className="repair-main">
          <section className="panel">
            <div className="section-heading compact">
              <h2>The service request</h2>
              <FileText className="green" size={20} />
            </div>
            <p className="request-symptoms">{r.symptoms}</p>
            <div className="detail-grid">
              <div>
                <small>Preferred appointment</small>
                <strong>{when(r.appointment)}</strong>
              </div>
              <div>
                <small>Service address</small>
                <strong>{r.address}</strong>
              </div>
              <div>
                <small>Customer</small>
                <strong>
                  {r.customer?.name} · {r.customer?.phone}
                </strong>
              </div>
              <div>
                <small>Next action</small>
                <strong>
                  {r.status === 'QUOTE_SENT'
                    ? 'Customer reviews quotation'
                    : r.status === 'INSPECTION_SCHEDULED'
                      ? 'Technician records inspection'
                      : r.status === 'REPAIR_IN_PROGRESS'
                        ? 'Technician records completed work'
                        : r.status === 'CLOSED'
                          ? 'Service completed'
                          : label(next[r.status] || 'Review repair details')}
                </strong>
              </div>
            </div>
            {r.photos?.length > 0 && (
              <div className="button-row">
                {r.photos.map((p, i) => (
                  <a
                    className="text-button"
                    href={`/api/uploads/${p}`}
                    key={p}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Photo {i + 1}
                    <ArrowUpRight size={14} />
                  </a>
                ))}
              </div>
            )}
          </section>
          {((tech && next[r.status]) ||
            (customer &&
              [
                'REQUESTED',
                'ACCEPTED',
                'INSPECTION_SCHEDULED',
                'INSPECTED',
                'QUOTE_PENDING',
                'QUOTE_SENT',
                'QUOTE_REJECTED',
                'READY_FOR_COLLECTION',
              ].includes(r.status))) && (
            <section className="panel">
              <h2>Available actions</h2>
              <Field label="Progress note">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a helpful update for the timeline…"
                  maxLength={4000}
                />
              </Field>
              <div className="button-row">
                {tech && next[r.status] && (
                  <Button busy={busy} onClick={() => transition(next[r.status])}>
                    {label(next[r.status])}
                  </Button>
                )}
                {tech && r.status === 'REQUESTED' && (
                  <Button
                    variant="danger-outline"
                    busy={busy}
                    onClick={() => transition('DECLINED')}
                  >
                    Decline request
                  </Button>
                )}
                {customer && r.status === 'READY_FOR_COLLECTION' ? (
                  <Button busy={busy} onClick={() => transition('CLOSED')}>
                    Confirm collection & close
                  </Button>
                ) : (
                  customer && (
                    <Button
                      variant="danger-outline"
                      busy={busy}
                      onClick={() => {
                        if (window.confirm('Cancel this repair request?')) transition('CANCELLED');
                      }}
                    >
                      Cancel request
                    </Button>
                  )
                )}
              </div>
            </section>
          )}
          {tech && r.status === 'INSPECTION_SCHEDULED' && (
            <section className="panel">
              <h2>Record an inspection</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.target));
                  action(`/repairs/${id}/inspection`, {
                    ...f,
                    estimatedHours: Number(f.estimatedHours),
                  });
                }}
              >
                {[
                  ['symptoms', 'Observed symptoms'],
                  ['findings', 'Inspection findings'],
                  ['diagnosis', 'Technician diagnosis'],
                  ['parts', 'Required parts'],
                ].map(([name, title]) => (
                  <Field label={title} key={name}>
                    <textarea
                      name={name}
                      minLength={3}
                      required={name !== 'parts'}
                      defaultValue={name === 'symptoms' ? r.symptoms : ''}
                    />
                  </Field>
                ))}
                <Field label="Estimated work hours">
                  <input
                    type="number"
                    name="estimatedHours"
                    min="0.1"
                    step="0.1"
                    max="1000"
                    required
                  />
                </Field>
                <Button busy={busy}>Save inspection</Button>
              </form>
            </section>
          )}
          {inspection && (
            <section className="panel">
              <h2>Inspection report</h2>
              <div className="detail-grid">
                {[
                  ['Observed symptoms', inspection.symptoms],
                  ['Findings', inspection.findings],
                  ['Diagnosis', inspection.diagnosis],
                  ['Required parts', inspection.parts || 'None recorded'],
                  ['Estimated work', `${inspection.estimatedHours} hours`],
                ].map(([title, value]) => (
                  <div key={title}>
                    <small>{title}</small>
                    <p>{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {tech &&
            ['INSPECTED', 'QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_REJECTED'].includes(r.status) && (
              <section className="panel">
                <h2>{quotes.length ? 'Revise quotation' : 'Build a quotation'}</h2>
                <p className="muted">
                  Each revision is preserved. A new quotation supersedes the pending version.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.target);
                    action(`/repairs/${id}/quotes`, {
                      items: items.map((i) => ({ ...i, amount: Number(i.amount) })),
                      validUntil: new Date(f.get('validUntil')).toISOString(),
                      estimatedCompletion: new Date(f.get('estimatedCompletion')).toISOString(),
                    });
                  }}
                >
                  <div className="quote-lines">
                    {items.map((item, i) => (
                      <div key={i}>
                        <input
                          aria-label={`Charge ${i + 1} description`}
                          value={item.label}
                          onChange={(e) =>
                            setItems(
                              items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                            )
                          }
                          required
                        />
                        <input
                          aria-label={`Charge ${i + 1} amount in INR`}
                          type="number"
                          min="0"
                          max="1000000"
                          step=".01"
                          value={item.amount}
                          onChange={(e) =>
                            setItems(
                              items.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x))
                            )
                          }
                          required
                        />
                        <button
                          type="button"
                          className="icon-button"
                          disabled={items.length === 1}
                          onClick={() => setItems(items.filter((_, j) => j !== i))}
                          aria-label={`Remove charge ${i + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      setItems([...items, { label: 'Other permitted charge', amount: 0 }])
                    }
                    disabled={items.length >= 25}
                  >
                    + Add charge
                  </button>
                  <div className="quote-total">
                    <span>Total (INR)</span>
                    <strong>{money(items.reduce((s, i) => s + Number(i.amount), 0))}</strong>
                  </div>
                  <div className="form-grid">
                    <Field label="Valid until">
                      <input type="datetime-local" name="validUntil" required />
                    </Field>
                    <Field label="Estimated completion">
                      <input type="datetime-local" name="estimatedCompletion" required />
                    </Field>
                  </div>
                  <Button busy={busy}>Send quotation for approval</Button>
                </form>
              </section>
            )}
          {quotes.map((q) => (
            <section key={q._id} className="panel quotation">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">QUOTATION · REVISION {q.revision}</span>
                  <h2>A clear view of the cost.</h2>
                </div>
                <Badge status={q.status}>{q.status}</Badge>
              </div>
              {q.items.map((item, i) => (
                <div className="quote-row" key={i}>
                  <span>{item.label}</span>
                  <strong>{money(item.amount)}</strong>
                </div>
              ))}
              <div className="quote-total">
                <span>Total</span>
                <strong>{money(q.total)}</strong>
              </div>
              <div className="quote-chart">
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={q.items}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#a7b6aa', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => money(v)}
                      contentStyle={{
                        background: '#111a14',
                        border: '1px solid #29402f',
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="amount" fill="#29df76" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="detail-grid">
                <div>
                  <small>Valid until</small>
                  <strong>{when(q.validUntil)}</strong>
                </div>
                <div>
                  <small>Estimated completion</small>
                  <strong>{when(q.estimatedCompletion)}</strong>
                </div>
              </div>
              {q.clarification && (
                <div className="alert good">Customer clarification: {q.clarification}</div>
              )}
              {q.decisionNote && <p className="muted">Decision note: {q.decisionNote}</p>}
              {customer && q.status === 'pending' && r.status === 'QUOTE_SENT' && (
                <>
                  <Field label="Question or decision note (optional)">
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                  <div className="button-row">
                    <Button
                      busy={busy}
                      onClick={() =>
                        action(`/repairs/${id}/quote-approval`, {
                          quoteId: q._id,
                          decision: 'approved',
                          note,
                        })
                      }
                    >
                      <ShieldCheck size={17} /> Approve {money(q.total)}
                    </Button>
                    <Button
                      variant="danger-outline"
                      busy={busy}
                      onClick={() =>
                        action(`/repairs/${id}/quote-approval`, {
                          quoteId: q._id,
                          decision: 'rejected',
                          note,
                        })
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      busy={busy}
                      onClick={() =>
                        action(`/repairs/${id}/quote-approval`, {
                          quoteId: q._id,
                          decision: 'clarification',
                          note,
                        })
                      }
                    >
                      Ask a question
                    </Button>
                  </div>
                </>
              )}
            </section>
          ))}
          {tech && r.status === 'REPAIR_IN_PROGRESS' && (
            <section className="panel">
              <h2>Complete the repair</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.target);
                  action(
                    `/repairs/${id}/status`,
                    {
                      status: 'REPAIR_COMPLETED',
                      note: 'Repair completed; work and final charges recorded.',
                      finalWork: f.get('finalWork'),
                      replacedParts: f.get('replacedParts'),
                      finalTotal: Number(f.get('finalTotal')),
                    },
                    'patch'
                  );
                }}
              >
                <Field label="Work performed">
                  <textarea name="finalWork" minLength={3} required />
                </Field>
                <Field label="Replaced parts">
                  <textarea name="replacedParts" />
                </Field>
                <Field label={`Final charges (maximum ${money(approved?.total)})`}>
                  <input
                    type="number"
                    name="finalTotal"
                    min="0"
                    max={approved?.total}
                    step=".01"
                    defaultValue={approved?.total}
                    required
                  />
                </Field>
                <Button busy={busy}>Mark repair completed</Button>
              </form>
            </section>
          )}
          {r.finalWork && (
            <section className="panel">
              <h2>Service completion</h2>
              <p>{r.finalWork}</p>
              <p>Replaced parts: {r.replacedParts || 'None recorded'}</p>
              <strong className="green">Final charges: {money(r.finalTotal)}</strong>
            </section>
          )}
          {customer && r.status === 'CLOSED' && (
            <section className="panel">
              <h2>{review ? 'Your review' : 'How did we do?'}</h2>
              {review ? (
                <>
                  <Badge>{review.rating}/5</Badge>
                  <p>{review.comment}</p>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.target);
                    action('/reviews', {
                      repair: id,
                      rating: Number(f.get('rating')),
                      comment: f.get('comment'),
                    });
                  }}
                >
                  <Field label="Rating">
                    <select name="rating">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} / 5
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Your experience">
                    <textarea name="comment" minLength={3} required />
                  </Field>
                  <Button busy={busy}>Publish review</Button>
                </form>
              )}
            </section>
          )}
        </div>
        <aside className="panel timeline-panel">
          <span className="eyebrow">EVERY STEP, IN SIGHT</span>
          <h2>Repair timeline</h2>
          <div className="timeline">
            {history.map((h, i) => (
              <div
                className={`timeline-item ${i === history.length - 1 ? 'current' : ''} ${/REJECTED|DECLINED|CANCELLED/.test(h.status) ? 'failed' : ''}`}
                key={h._id}
              >
                <span className="timeline-dot">
                  {i === history.length - 1 ? <Clock3 size={12} /> : <Check size={12} />}
                </span>
                <strong>{label(h.status)}</strong>
                <small>{when(h.createdAt)}</small>
                <p>{h.note}</p>
              </div>
            ))}
            {stages.indexOf(r.status) >= 0 &&
              stages.slice(stages.indexOf(r.status) + 1).map((s) => (
                <div className="timeline-item upcoming" key={s}>
                  <span className="timeline-dot" />
                  <strong>{label(s)}</strong>
                </div>
              ))}
          </div>
          <small className="muted">
            Updates refresh every 30 seconds while this tab is visible.
          </small>
        </aside>
      </div>
    </>
  );
}
