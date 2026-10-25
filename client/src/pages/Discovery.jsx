import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MapPin, ShieldCheck, Star, ArrowUpRight, Wrench } from 'lucide-react';
import { Logo, Button, Field, Alert, Loading, Empty, Badge, useData } from '../components/UI';
import { api, errorMessage, money } from '../services/api';
import { useAuth } from '../contexts/Auth';
export function Shops({ embedded = false }) {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [category, setCategory] = useState(params.get('category') || '');
  const [city, setCity] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({ category: params.get('category') || '', city: '' });
  const { data: categories } = useData('/categories');
  const { data, loading, error } = useData(
    `/shops?category=${encodeURIComponent(search.category)}&city=${encodeURIComponent(search.city)}`
  );
  const [matched, setMatched] = useState(null),
    [matchError, setMatchError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setMatched(null);
    setMatchError('');
    setSearch({ category, city });
    if (query && user) {
      setBusy(true);
      try {
        setMatched(
          (
            await api.post('/shop-matching', {
              category: category || undefined,
              city,
              message: query,
            })
          ).data
        );
      } catch (e) {
        setMatchError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    }
  };
  const shops = matched?.matches || data;
  return (
    <div className={embedded ? '' : 'public-page container'}>
      {!embedded && (
        <div className="public-top">
          <Logo />
          <Link
            to={user ? `/${user.role}/dashboard` : '/customer/login'}
            className="button outline"
          >
            {user ? 'My dashboard' : 'Sign in'}
          </Link>
        </div>
      )}
      <div className="page-heading">
        <span className="eyebrow">THE RIGHT PEOPLE. THE RIGHT FIX.</span>
        <h1>Find your specialist.</h1>
        <p>Verified appliance professionals. Clear services. Your choice.</p>
      </div>
      <form className="search-panel" onSubmit={submit}>
        <Field label="Appliance">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All appliances</option>
            {categories?.map((c) => (
              <option value={c.slug} key={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service city">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Bengaluru"
          />
        </Field>
        <Field label="Describe the problem (optional)">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="My fridge is not cooling"
          />
        </Field>
        <Button busy={busy}>
          <Search size={18} /> Find a fix
        </Button>
      </form>
      {query && !user && (
        <p className="section-note">
          Sign in for symptom-based service matching. Appliance and city filters work without an
          account.
        </p>
      )}
      <Alert>{error || matchError}</Alert>
      {matched && (
        <p className="section-note">
          Matching mode:{' '}
          {matched.mode === 'semantic'
            ? 'semantic symptom relevance'
            : 'verified category and city filters'}
          . Appointment preferences require shop confirmation.
        </p>
      )}
      {loading ? (
        <Loading />
      ) : shops?.length ? (
        <div className="shop-grid">
          {shops.map((shop) => (
            <ShopCard key={shop._id} shop={shop} />
          ))}
        </div>
      ) : (
        <Empty
          title="No matching shops yet"
          text="Try another city or appliance. Only approved shops with published services appear here."
        />
      )}
    </div>
  );
}
function ShopCard({ shop }) {
  const [show, setShow] = useState(false);
  const { data: reviews, error } = useData(show ? `/shops/${shop._id}/reviews` : null);
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const report = async (id) => {
    const reason = window.prompt('Why are you reporting this review?');
    if (!reason) return;
    try {
      await api.post(`/reviews/${id}/report`, { reason });
      setMessage('Review reported for administrator investigation.');
    } catch (e) {
      setMessage(errorMessage(e));
    }
  };
  return (
    <article className="panel shop-card">
      <div className="shop-card-top">
        <div className="shop-avatar">
          <Wrench size={27} />
        </div>
        <Badge>
          <ShieldCheck size={12} /> Verified shop
        </Badge>
      </div>
      <h2>{shop.name}</h2>
      <p className="location">
        <MapPin size={14} />
        {shop.city}
      </p>
      {shop.demo && <span className="demo-label">Fictional demonstration business</span>}
      <div className="shop-rating">
        <Star size={15} />
        {shop.rating
          ? `${shop.rating.toFixed(1)} · ${shop.reviewCount} review${shop.reviewCount !== 1 ? 's' : ''}`
          : 'No reviews yet'}
      </div>
      <p>{shop.explanation || shop.address}</p>
      <div className="service-list">
        {shop.services?.map((s) => (
          <div key={s._id}>
            <span>{s.title}</span>
            <strong>
              {money(s.inspectionPrice)}
              <small>inspection</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="button-row">
        <Link
          to={`/customer/dashboard/book?shop=${shop._id}&category=${shop.services?.[0]?.category || ''}`}
          className="button"
        >
          Book an inspection <ArrowUpRight size={16} />
        </Link>
        <button className="text-button" onClick={() => setShow(!show)}>
          {show ? 'Hide reviews' : 'Reviews'}
        </button>
      </div>
      {show && (
        <div className="review-list">
          <Alert>{error || message}</Alert>
          {reviews?.length ? (
            reviews.map((r) => (
              <div key={r._id}>
                <strong>{r.rating}/5</strong>
                <p>{r.comment}</p>
                {user && (
                  <button className="text-button" onClick={() => report(r._id)}>
                    Report review
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>No completed-service reviews yet.</p>
          )}
        </div>
      )}
    </article>
  );
}
