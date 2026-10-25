import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Wrench,
  ArrowLeft,
  ArrowRight,
  House,
  Check,
  LoaderCircle,
} from 'lucide-react';
import { Logo, Button, Field, Alert, useData } from '../components/UI';
import { api, errorMessage } from '../services/api';
import { useAuth } from '../contexts/Auth';
export default function AuthPage({ register: signup = false }) {
  const { role = 'customer' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm();
  const { data: categories } = useData(signup && role === 'technician' ? '/categories' : null);
  if (!['customer', 'technician', 'admin'].includes(role) || (role === 'admin' && signup))
    return (
      <div className="empty">
        This portal does not exist. <Link to="/">Return home</Link>
      </div>
    );
  const Icon = role === 'admin' ? ShieldCheck : role === 'technician' ? Wrench : House;
  const submit = handleSubmit(async (data) => {
    setError('');
    try {
      const body = {
        ...data,
        ...(signup && role === 'technician'
          ? {
              experience: Number(data.experience || 0),
              categories: typeof data.categories === 'string' ? [data.categories] : data.categories,
            }
          : {}),
      };
      delete body.confirm;
      const result = await api.post(`/auth/${role}/${signup ? 'register' : 'login'}`, body);
      setUser(result.data.user);
      const destination = location.state?.from;
      navigate(destination?.startsWith(`/${role}/dashboard`) ? destination : `/${role}/dashboard`);
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <div className={`auth-page auth-${role}`}>
      <div className="auth-story">
        <Logo />
        <div className="auth-story-content">
          <div className="auth-emblem">
            <Icon size={60} strokeWidth={1} />
            <span className="tiny-dot red-dot" />
          </div>
          <span className="eyebrow">
            {role === 'admin'
              ? 'OPERATIONS, UNDER CONTROL'
              : role === 'technician'
                ? 'GOOD WORK DESERVES A GREAT WORKSPACE'
                : 'YOUR EVERYDAY, TAKEN CARE OF'}
          </span>
          <h1>
            {role === 'admin' ? (
              <>
                A clear view.
                <br />
                <span>Better decisions.</span>
              </>
            ) : role === 'technician' ? (
              <>
                You bring the skill.
                <br />
                <span>We connect the rest.</span>
              </>
            ) : (
              <>
                Welcome to
                <br />
                <span>smarter home care.</span>
              </>
            )}
          </h1>
          <p>
            {role === 'admin'
              ? 'Manage verification, oversee service quality, and keep the FixMate experience running smoothly.'
              : role === 'technician'
                ? 'Manage requests, record inspections, and build trust with transparent quotations.'
                : 'Your appliances, trusted specialists, and every repair update. All in one place.'}
          </p>
          <div className="auth-points">
            <span>
              <Check size={16} /> Clear, transparent workflows
            </span>
            <span>
              <ShieldCheck size={16} /> Your account. Your workspace.
            </span>
          </div>
        </div>
        <small>From Fault to Fix, Smarter Than Ever.</small>
      </div>
      <div className="auth-form-side">
        <Link className="text-button back" to="/">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <div className="auth-form">
          <span className="eyebrow">{role.toUpperCase()} PORTAL</span>
          <h2>{signup ? 'Make yourself at home.' : 'Good to see you again.'}</h2>
          <p>
            {signup
              ? 'Create your FixMate account to get started.'
              : 'Sign in to pick up where you left off.'}
          </p>
          <form onSubmit={submit}>
            <Alert>{error}</Alert>
            {signup && (
              <Field label="Full name">
                <input autoComplete="name" {...register('name', { required: true })} required />
              </Field>
            )}
            <Field label="Email address">
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register('email', { required: true })}
                required
              />
            </Field>
            <Field
              label="Password"
              hint={signup ? '10–72 characters. Choose a unique password.' : undefined}
            >
              <div className="password-field">
                <input
                  type={show ? 'text' : 'password'}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  minLength={signup ? 10 : undefined}
                  maxLength={72}
                  {...register('password', { required: true })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            {signup && (
              <>
                <Field label="Confirm password">
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...register('confirm', {
                      validate: (v) => v === watch('password') || 'Passwords must match.',
                    })}
                    required
                  />
                </Field>
                {errors.confirm && <Alert>{errors.confirm.message}</Alert>}
                <div className="form-grid">
                  <Field label="Phone">
                    <input type="tel" {...register('phone')} required />
                  </Field>
                  <Field label="City">
                    <input {...register('city')} placeholder="Bengaluru" required />
                  </Field>
                </div>
                <Field label={role === 'technician' ? 'Shop address' : 'Service address'}>
                  <textarea {...register('address')} required />
                </Field>
                {role === 'technician' && (
                  <>
                    <Field label="Shop name">
                      <input {...register('shopName')} required />
                    </Field>
                    <Field label="Experience (years)">
                      <input type="number" min="0" max="70" {...register('experience')} required />
                    </Field>
                    <Field
                      label="Supported appliances"
                      hint="Hold Ctrl or Command to select several."
                    >
                      <select multiple {...register('categories')} required>
                        {categories?.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="alert good">
                      Upload verification documents from your dashboard after registration. Your
                      shop stays private until approved.
                    </div>
                  </>
                )}
              </>
            )}
            {!signup && (
              <Link className="forgot" to="/forgot-password">
                Forgot password?
              </Link>
            )}
            <Button busy={isSubmitting} className="full">
              {signup ? 'Create account' : 'Sign in'}
              <ArrowRight size={17} />
            </Button>
          </form>
          {role !== 'admin' && (
            <p className="auth-switch">
              {signup ? 'Already part of FixMate?' : 'New around here?'}{' '}
              <Link to={`/${role}/${signup ? 'login' : 'register'}`}>
                {signup ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
          )}
          <div className="portal-switch">
            <span>Choose your workspace</span>
            {['customer', 'technician', 'admin'].map((r) => (
              <Link key={r} className={r === role ? 'selected' : ''} to={`/${r}/login`}>
                {r}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export function PasswordRecovery({ reset = false }) {
  const [params] = useSearchParams();
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const form = new FormData(e.target);
      const r = await api.post(
        reset ? '/auth/reset-password' : '/auth/forgot-password',
        reset
          ? { token: params.get('token'), password: form.get('password') }
          : { email: form.get('email') }
      );
      setMessage(reset ? 'Password updated. You can now sign in.' : r.data.message);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="simple-page">
      <Logo />
      <div className="panel narrow">
        <h1>{reset ? 'A fresh start.' : 'Let’s get you back in.'}</h1>
        <p>{reset ? 'Choose a new password.' : 'Enter the email address on your account.'}</p>
        <form onSubmit={submit}>
          <Alert>{error}</Alert>
          <Alert good>{message}</Alert>
          <Field label={reset ? 'New password' : 'Email'}>
            <input
              name={reset ? 'password' : 'email'}
              type={reset ? 'password' : 'email'}
              minLength={reset ? 10 : undefined}
              maxLength={reset ? 72 : undefined}
              required
            />
          </Field>
          <Button busy={busy}>{reset ? 'Update password' : 'Send recovery instructions'}</Button>
        </form>
        <Link to="/customer/login" className="text-button">
          Back to sign in <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
