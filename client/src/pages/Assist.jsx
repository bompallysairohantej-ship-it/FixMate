import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Send, BookOpen, Plus, ShieldCheck, ArrowRight } from 'lucide-react';
import { Logo, Button, Field, Alert, useData } from '../components/UI';
import { api, errorMessage } from '../services/api';
import { useAuth } from '../contexts/Auth';
export default function Assist({ embedded = false }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]),
    [text, setText] = useState(''),
    [category, setCategory] = useState(''),
    [history, setHistory] = useState(false),
    [session, setSession] = useState(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { data: categories } = useData('/categories');
  const end = useRef();
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const question = text;
    setText('');
    setError('');
    setMessages((m) => [...m, { role: 'user', answer: question }]);
    setBusy(true);
    try {
      const { data } = await api.post('/repair-chat', {
        message: question,
        category: category || undefined,
        sessionId: session,
        history,
      });
      setSession(data.sessionId);
      if (data.category) setCategory(data.category);
      setMessages((m) => [...m, { role: 'assistant', ...data }]);
    } catch (e) {
      setError(errorMessage(e));
      setText(question);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={embedded ? '' : 'public-page container'}>
      {!embedded && (
        <div className="public-top">
          <Logo />
          <Link
            className="button outline"
            to={user ? `/${user.role}/dashboard` : '/customer/login'}
          >
            {user ? 'Dashboard' : 'Sign in'}
          </Link>
        </div>
      )}
      <div className="page-heading">
        <span className="eyebrow">
          <Sparkles size={15} /> FIXMATE SMART ASSIST
        </span>
        <h1>A little clarity goes a long way.</h1>
        <p>Tell us what’s happening. We’ll help you find the next step.</p>
      </div>
      {!user || user.role !== 'customer' ? (
        <div className="panel narrow">
          <ShieldCheck className="green" />
          <h2>Your home, your conversation.</h2>
          <p>
            Sign in to a customer account to use appliance assistance and your private repair
            history.
          </p>
          <Link className="button" to="/customer/login">
            Customer sign in <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="assist-layout">
          <aside className="panel assist-sidebar">
            <h3>Give us a little context</h3>
            <Field label="Appliance">
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Identify from my message</option>
                {categories?.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={history}
                onChange={(e) => setHistory(e.target.checked)}
              />{' '}
              Ask about my repair history
            </label>
            <Button
              variant="outline"
              onClick={() => {
                setMessages([]);
                setSession(undefined);
                setError('');
              }}
            >
              <Plus size={16} /> New conversation
            </Button>
            <div className="safety-note">
              <ShieldCheck />
              <h4>Guidance, with care.</h4>
              <p>
                Possible causes are not a diagnosis. Never open electrical components or attempt
                work on live wiring. A qualified technician confirms the fault and cost.
              </p>
            </div>
          </aside>
          <div className="panel conversation">
            <div className="conversation-head">
              <span className="note-icon">
                <Sparkles size={19} />
              </span>
              <div>
                <strong>FixMate Smart Assist</strong>
                <small>Grounded guidance. Human expertise.</small>
              </div>
            </div>
            <div className="messages" aria-live="polite">
              {!messages.length && (
                <div className="chat-welcome">
                  <Sparkles size={34} />
                  <h2>What needs a little attention?</h2>
                  <p>Start with the appliance and a symptom.</p>
                  {[
                    'My washing machine is noisy during spinning.',
                    'My refrigerator light works but it is not cooling.',
                  ].map((t) => (
                    <button key={t} onClick={() => setText(t)}>
                      {t}
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`message ${m.role}`}>
                  <span className="message-author">
                    {m.role === 'user' ? 'You' : 'FixMate Smart Assist'}
                  </span>
                  <p>{m.answer}</p>
                  {m.question && <strong>{m.question}</strong>}
                  {m.notice && <small className="mode-note">{m.notice}</small>}
                  {m.sources?.length > 0 && (
                    <div className="source-list">
                      {m.sources.map((s, j) => (
                        <div key={j}>
                          <BookOpen size={13} />
                          <span>
                            {s.title}
                            <small>{s.source}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {m.disclaimer && <small className="mode-note">{m.disclaimer}</small>}
                  {m.category && (
                    <Link
                      className="text-button"
                      to={`/customer/dashboard/book?category=${m.category}&symptoms=${encodeURIComponent(m.symptoms)}`}
                    >
                      Use these symptoms in a booking <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              ))}
              {busy && (
                <div className="typing">
                  Checking approved references<span>•••</span>
                </div>
              )}
              <div ref={end} />
            </div>
            <Alert>{error}</Alert>
            <form className="chat-compose" onSubmit={send}>
              <textarea
                aria-label="Describe your appliance problem"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={4000}
                minLength={3}
                placeholder="Tell us what’s happening…"
                required
              />
              <Button busy={busy} aria-label="Send message">
                <Send size={19} />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
