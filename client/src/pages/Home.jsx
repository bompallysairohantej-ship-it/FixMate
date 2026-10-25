import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import gsap from 'gsap';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ShieldCheck,
  Sparkles,
  Wrench,
  WashingMachine,
  Refrigerator,
  AirVent,
  Microwave,
  Tv,
  Fan,
  ChevronDown,
  Plus,
  Zap,
  Menu,
  X,
  CircleCheck,
  Clock3,
  BadgeCheck,
} from 'lucide-react';
import { Logo, LinkButton } from '../components/UI';
import { useAuth } from '../contexts/Auth';
const ApplianceScene = lazy(() => import('../three/ApplianceScene'));
const services = [
  {
    name: 'Washing machine',
    slug: 'washing-machine',
    icon: WashingMachine,
    sub: 'A fresh start for every load.',
  },
  {
    name: 'Refrigerator',
    slug: 'refrigerator',
    icon: Refrigerator,
    sub: 'Keep your cool. We’ll handle it.',
  },
  {
    name: 'Air conditioner',
    slug: 'air-conditioner',
    icon: AirVent,
    sub: 'Comfort, back on your terms.',
  },
  {
    name: 'Kitchen appliances',
    slug: 'microwave-oven',
    icon: Microwave,
    sub: 'Get your everyday rhythm back.',
  },
  {
    name: 'TV & electronics',
    slug: 'television',
    icon: Tv,
    sub: 'Bring your entertainment to life.',
  },
  { name: 'More appliances', slug: '', icon: Fan, sub: 'A smarter fix for your home.' },
];
function Intro() {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(!sessionStorage.getItem('fixmate-intro') && !reduced);
  const ref = useRef();
  const finish = () => {
    sessionStorage.setItem('fixmate-intro', '1');
    setShow(false);
  };
  useEffect(() => {
    if (!show) return;
    const ctx = gsap.context(() => {
      gsap.from('.intro-line', { scaleX: 0, duration: 0.75, stagger: 0.12 });
      gsap.from('.intro-center', { opacity: 0, scale: 0.8, y: 15, delay: 0.55, duration: 0.8 });
      gsap.to('.intro-spark', { rotation: 360, transformOrigin: '50% 50%', duration: 1.6 });
    }, ref);
    const timer = setTimeout(finish, 2600);
    return () => {
      ctx.revert();
      clearTimeout(timer);
    };
  }, [show]);
  if (!show) return null;
  return (
    <div className="intro" ref={ref}>
      <div className="intro-line l1" />
      <div className="intro-line l2" />
      <div className="intro-line l3" />
      <div className="intro-center">
        <div className="intro-spark" />
        <Logo />
        <p>From Fault to Fix, Smarter Than Ever.</p>
      </div>
      <button className="text-button" onClick={finish}>
        Skip intro <ArrowRight size={16} />
      </button>
    </div>
  );
}
export default function Home() {
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  const [journey, setJourney] = useState(2);
  const reduced = useReducedMotion();
  return (
    <>
      <Intro />
      <header className="site-header">
        <div className="container nav">
          <Logo />
          <nav className={menu ? 'open' : ''} aria-label="Main navigation">
            <a href="#home" className="active" onClick={() => setMenu(false)}>
              Home
            </a>
            <a href="#services" onClick={() => setMenu(false)}>
              Services
            </a>
            <a href="#how-it-works" onClick={() => setMenu(false)}>
              How it works
            </a>
            <Link to="/technicians">Find technicians</Link>
            <Link to="/assist">
              Smart Assist <span className="tiny-dot" />
            </Link>
            <a href="#about" onClick={() => setMenu(false)}>
              About us
            </a>
          </nav>
          <div className="nav-actions">
            <Link className="login-link" to={user ? `/${user.role}/dashboard` : '/customer/login'}>
              {user ? 'Dashboard' : 'Log in'}
            </Link>
            <LinkButton to={user ? `/${user.role}/dashboard` : '/customer/register'}>
              Get started
            </LinkButton>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Toggle menu"
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main>
        <section id="home" className="hero container">
          <div className="hero-copy">
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="eyebrow-pill">
                <span className="tiny-dot" /> THE SMARTER SIDE OF HOME CARE
              </span>
              <h1>
                Your home
                <br />
                deserves
                <br />
                <span>smarter repairs.</span>
              </h1>
              <p className="hero-description">
                Less breakdown. More peace of mind.
                <br />
                Find trusted professionals, understand the issue, and get your everyday back.
              </p>
              <div className="hero-buttons">
                <LinkButton to="/technicians">Find a technician</LinkButton>
                <LinkButton to="/assist" variant="outline">
                  <Sparkles size={16} /> Try Smart Assist
                </LinkButton>
              </div>
              <div className="hero-trust">
                <span>
                  <ShieldCheck size={17} /> Verified professionals
                </span>
                <span>
                  <Check size={17} /> No surprise costs
                </span>
              </div>
            </motion.div>
          </div>
          <div className="hero-visual">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="scene-grid" />
            <span className="scene-cross cross-one">+</span>
            <span className="scene-cross cross-two">+</span>
            <Suspense fallback={<div className="scene-fallback">Preparing your home…</div>}>
              <ApplianceScene />
            </Suspense>
            <div className="float-note note-top">
              <span className="note-icon">
                <ShieldCheck size={18} />
              </span>
              <div>
                Expert care.<small>For the things you rely on.</small>
              </div>
              <span className="tiny-dot" />
            </div>
            <div className="float-note note-bottom">
              <span className="note-icon">
                <Sparkles size={18} />
              </span>
              <div>
                A smarter diagnosis<small>Powered by intelligent assistance</small>
              </div>
            </div>
            <span className="visual-caption">BUILT AROUND YOUR EVERYDAY.</span>
          </div>
          <a className="scroll-cue" href="#services">
            <span>SCROLL TO EXPLORE</span>
            <ChevronDown size={15} />
          </a>
          <div className="hero-footnote">
            <span className="tiny-dot" /> FROM FAULT TO FIX, SMARTER THAN EVER.
          </div>
        </section>
        <div className="trust-strip">
          <div className="container">
            <span>
              <BadgeCheck /> Verified repair shops
            </span>
            <span>
              <Sparkles /> Intelligent assistance
            </span>
            <span>
              <ShieldCheck /> You approve every quote
            </span>
            <span>
              <Clock3 /> Every repair, tracked
            </span>
          </div>
        </div>
        <section id="services" className="section container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 / EVERYDAY ESSENTIALS</span>
              <h2>
                Big or small.
                <br />
                <span className="muted">We’ve got a fix for it.</span>
              </h2>
            </div>
            <div className="heading-aside">
              <p>
                Expert care for the appliances
                <br />
                that make your house a home.
              </p>
              <a href="#service-grid" className="text-button">
                Explore services <ArrowUpRight size={17} />
              </a>
            </div>
          </div>
          <div id="service-grid" className="service-grid">
            {services.map(({ name, slug, icon: Icon, sub }, i) => (
              <Link
                key={name}
                to={`/technicians${slug ? `?category=${slug}` : ''}`}
                className="service-card"
              >
                <span className="service-no">0{i + 1}</span>
                <div className="appliance-icon">
                  <Icon strokeWidth={1.1} />
                </div>
                <div className="service-card-bottom">
                  <div>
                    <h3>{name}</h3>
                    <p>{sub}</p>
                  </div>
                  <span className="circle-arrow">
                    <ArrowUpRight size={19} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <p className="section-note">
            Made for household & electrical appliances. Handled by specialists.
          </p>
        </section>
        <section id="explorer" className="explorer-section">
          <div className="container explorer-grid">
            <div>
              <span className="eyebrow">A CLOSER LOOK. A SMARTER FIX.</span>
              <h2>
                Understand the problem.
                <br />
                <span className="green">Before the repair.</span>
              </h2>
              <p className="body-copy">
                Every appliance has a story beneath the surface. Explore how the parts work
                together, then let a professional find the cause.
              </p>
              <div className="explorer-points">
                <span>
                  <span className="tiny-dot" /> Control panel & electronics
                </span>
                <span>
                  <span className="tiny-dot" /> Drum & suspension
                </span>
                <span>
                  <span className="tiny-dot red-dot" /> Motor & drainage assembly
                </span>
              </div>
              <small>
                Illustrative components, not a confirmed diagnosis. Scroll to explore; drag to
                rotate.
              </small>
            </div>
            <div className="explorer-canvas">
              <Suspense fallback={null}>
                <ApplianceScene explorer />
              </Suspense>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="section container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 / SIMPLE BY DESIGN</span>
              <h2>
                Every problem has
                <br />
                <span className="muted">a smarter fix.</span>
              </h2>
            </div>
            <p className="heading-aside">
              From “what’s wrong?” to “all fixed.”
              <br />
              We make every step feel simple.
            </p>
          </div>
          <div className="steps">
            {[
              [
                '01',
                'Tell us what’s wrong',
                'Describe the issue. Smart Assist helps you understand the symptoms.',
              ],
              [
                '02',
                'Find your specialist',
                'Choose a verified shop and request a convenient appointment.',
              ],
              [
                '03',
                'Approve with confidence',
                'Get an inspection and a clear, itemized quote. You stay in control.',
              ],
              [
                '04',
                'Get back to everyday',
                'Follow every repair update and keep your service history in one place.',
              ],
            ].map(([n, t, p]) => (
              <div className="step" key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="container assist-banner">
          <div>
            <span className="eyebrow">
              <Sparkles size={15} /> FIXMATE SMART ASSIST
            </span>
            <h2>
              Not sure what’s wrong?
              <br />
              <span className="green">Start with a conversation.</span>
            </h2>
            <p>
              Describe the noise, the leak, or the unexpected stop.
              <br />
              Get source-backed guidance and the right next step.
            </p>
            <LinkButton to="/assist">Let’s figure it out</LinkButton>
            <small>Helpful guidance. Final diagnosis by a qualified technician.</small>
          </div>
          <div className="chat-preview">
            <div className="chat-preview-head">
              <span className="note-icon">
                <Sparkles size={18} />
              </span>
              <div>
                FixMate Smart Assist<small>Illustrative conversation</small>
              </div>
              <span className="tiny-dot" />
            </div>
            <div className="bubble user-bubble">
              My washing machine makes a loud noise when it spins.
            </div>
            <div className="bubble">
              Let’s narrow that down. Does the noise happen on every cycle, or only during
              high-speed spinning?
              <div className="source-tag">
                <ShieldCheck size={12} /> Guidance grounded in approved references
              </div>
            </div>
            <div className="fake-input">
              A little detail goes a long way.
              <ArrowUpRight size={18} />
            </div>
          </div>
        </section>
        <section id="about" className="section container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">03 / CARE YOU CAN COUNT ON</span>
              <h2>
                Good repairs start
                <br />
                <span className="muted">with trust.</span>
              </h2>
            </div>
            <p className="heading-aside">
              A better experience for your home.
              <br />
              And the people who look after it.
            </p>
          </div>
          <div className="benefit-grid">
            {[
              [
                ShieldCheck,
                'Verified, not just listed',
                'Shop verification comes before a professional appears in your search.',
              ],
              [
                Wrench,
                'Clear costs. Your call.',
                'Review inspection findings and every charge before authorizing work.',
              ],
              [
                Clock3,
                'Always in the loop',
                'Real status updates, a clear timeline, and your complete service history.',
              ],
            ].map(([Icon, title, desc]) => (
              <article className="benefit" key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="container journey">
          <div>
            <span className="eyebrow">EVERY STEP, IN SIGHT</span>
            <h2>
              Your repair.
              <br />
              No guessing games.
            </h2>
            <p>Explore a sample repair journey.</p>
          </div>
          <div className="journey-track">
            {['Requested', 'Inspection', 'Quote approved', 'In repair', 'All fixed'].map((s, i) => (
              <button key={s} className={i <= journey ? 'done' : ''} onClick={() => setJourney(i)}>
                <span>{i < journey ? <Check size={18} /> : i + 1}</span>
                <small>{s}</small>
              </button>
            ))}
            <p className="journey-description">
              {
                [
                  'Your request is ready for the selected shop.',
                  'A technician records findings before quoting.',
                  'You review and authorize the itemized price.',
                  'Your technician updates the repair progress.',
                  'Collect your appliance and share your experience.',
                ][journey]
              }
            </p>
          </div>
        </section>
        <section className="section container testimonial">
          <span className="eyebrow">A BETTER KIND OF REPAIR EXPERIENCE</span>
          <blockquote>
            “Clear pricing. Helpful updates.
            <br />
            One less thing to worry about.”
          </blockquote>
          <p>Illustrative customer testimonial · demonstration content</p>
        </section>
        <section className="final-cta container">
          <span className="eyebrow">LET’S GET YOUR EVERYDAY BACK</span>
          <h2>
            Bring your appliances
            <br />
            <span className="green">back to life.</span>
          </h2>
          <LinkButton to="/customer/dashboard/book">Book your repair</LinkButton>
          <span className="cta-symbol">
            <Wrench />
          </span>
        </section>
      </main>
      <footer className="site-footer container">
        <div>
          <Logo />
          <p>From Fault to Fix, Smarter Than Ever.</p>
          <small>Smart appliance repair & service intelligence.</small>
        </div>
        <div>
          <span>EXPLORE</span>
          <Link to="/technicians">Find technicians</Link>
          <a href="#services">Our services</a>
          <Link to="/assist">Smart Assist</Link>
        </div>
        <div>
          <span>FOR PROFESSIONALS</span>
          <Link to="/technician/login">Technician portal</Link>
          <Link to="/technician/register">Join FixMate</Link>
          <Link to="/admin/login">Administrator</Link>
        </div>
        <div>
          <span>HERE TO HELP</span>
          <Link to="/support">Support & contact</Link>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms of service</Link>
        </div>
        <div className="footer-bottom">
          <small>© {new Date().getFullYear()} FixMate. Made for your everyday.</small>
          <span>
            <span className="tiny-dot" /> A little smarter. A lot simpler.
          </span>
        </div>
      </footer>
    </>
  );
}
