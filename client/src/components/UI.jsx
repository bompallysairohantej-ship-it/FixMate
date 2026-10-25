import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  LoaderCircle,
  X,
  House,
  Wrench,
  Zap,
  Check,
  AlertCircle,
} from 'lucide-react';
import { api, errorMessage, label } from '../services/api';
export function Logo({ small = false }) {
  return (
    <Link className={`logo ${small ? 'small' : ''}`} to="/" aria-label="FixMate home">
      <span className="logo-mark">
        <House size={31} />
        <Wrench size={17} className="logo-tool" />
        <i />
      </span>
      <span>
        Fix<span className="green">Mate</span>
        <b>®</b>
      </span>
    </Link>
  );
}
export function Button({ children, variant = '', className = '', busy, ...props }) {
  return (
    <button
      className={`button ${variant} ${className}`}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <LoaderCircle className="spin" size={17} /> : null}
      {children}
    </button>
  );
}
export function LinkButton({ children, to, variant = '', ...props }) {
  return (
    <Link className={`button ${variant}`} to={to} {...props}>
      {children}
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function Badge({ children, status = '' }) {
  return (
    <span className={`badge ${/REJECTED|DECLINED|CANCELLED|rejected/.test(status) ? 'red' : ''}`}>
      {children || label(status)}
    </span>
  );
}
export function Field({ label: title, children, hint }) {
  return (
    <label className="field">
      <span>{title}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Alert({ children, good = false }) {
  return children ? (
    <div className={`alert ${good ? 'good' : ''}`} role={good ? 'status' : 'alert'}>
      {good ? <Check size={18} /> : <AlertCircle size={18} />}
      <span>{children}</span>
    </div>
  ) : null;
}
export function Empty({
  title = 'Nothing here yet',
  text = 'Your records will appear here as you use FixMate.',
  children,
}) {
  return (
    <div className="empty">
      <Zap size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" /> Loading your workspace…
    </div>
  );
}
export function Modal({ title, children, close }) {
  useEffect(() => {
    const previous = document.activeElement;
    const handler = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const nodes = [
          ...document.querySelectorAll(
            '.modal button:not(:disabled), .modal input, .modal select, .modal textarea, .modal a'
          ),
        ];
        if (!nodes.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    document.querySelector('.modal button')?.focus();
    return () => {
      document.removeEventListener('keydown', handler);
      previous?.focus();
    };
  }, [close]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="section-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Close dialog">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function useData(url) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    api
      .get(url)
      .then((r) => {
        if (alive) {
          setData(r.data);
          setError('');
        }
      })
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url, version]);
  return { data, error, loading, reload: () => setVersion((v) => v + 1), setData };
}
