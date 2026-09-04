import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const icons = {
  mic: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5 10.5a7 7 0 0 0 14 0M12 17.5V22M8.5 22h7" />
    </>
  ),
  wifi: (
    <>
      <path d="M3 8.5a15 15 0 0 1 18 0M6.5 12a9.5 9.5 0 0 1 11 0M10 15.5a4 4 0 0 1 4 0M12 20h.01" />
      <path d="M3 3l18 18" />
    </>
  ),
  brain: (
    <>
      <path d="M9.5 4a3 3 0 0 0-3 3v.5A3.5 3.5 0 0 0 5 14a3.5 3.5 0 0 0 4.5 5.3M14.5 4a3 3 0 0 1 3 3v.5A3.5 3.5 0 0 1 19 14a3.5 3.5 0 0 1-4.5 5.3M9.5 4v16M14.5 4v16M6.5 9h3M14.5 9h3M6.5 15h3M14.5 15h3" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h4M9 13h6M9 17h6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.3 8.2-8 9-4.7-.8-8-4-8-9V6l8-3z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4M12 7v5l3 2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
};

const flow = [
  {
    n: '01',
    title: 'Start conversation',
    text: 'Speak naturally. The consultation is captured as one continuous conversation.',
    icon: icons.mic,
  },
  {
    n: '02',
    title: 'Capture in Chrome',
    text: 'Chrome speech recognition captures the conversation continuously while the consultation is active.',
    icon: icons.wifi,
  },
  {
    n: '03',
    title: 'Analyze with Groq',
    text: 'Groq turns the transcript and vitals into a structured draft for the doctor to review.',
    icon: icons.brain,
  },
  {
    n: '04',
    title: 'Review & deliver',
    text: 'The doctor edits and approves the note, then downloads the PDF or emails the final report.',
    icon: icons.doc,
  },
];

const features = [
  ['Continuous conversation', 'No Doctor / Patient switching or manual speaker tagging.', icons.mic],
  ['Chrome speech', 'Browser speech recognition captures the conversation without a server-side audio pipeline.', icons.wifi],
  ['Groq clinical AI', 'Groq prepares the structured draft while the doctor remains in control.', icons.brain],
  ['Doctor in control', 'AI proposes. The doctor decides what stays in the final clinical record.', icons.shield],
  ['Patient history', 'Approved visits remain available as context for future consultations.', icons.history],
  ['PDF + email', 'Create an A4 report and send the approved patient-facing copy to the saved email.', icons.mail],
];

function Reveal({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`about-reveal ${className}`}>{children}</div>;
}

function handleCardMouseMove(e: MouseEvent<HTMLElement>) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  card.style.setProperty('--about-mx', `${(x * 8).toFixed(2)}px`);
  card.style.setProperty('--about-my', `${(y * 6).toFixed(2)}px`);
  card.style.setProperty('--about-rx', `${(-y * 2.8).toFixed(2)}deg`);
  card.style.setProperty('--about-ry', `${(x * 3.2).toFixed(2)}deg`);
  card.style.setProperty('--about-glow-x', `${((x + 0.5) * 100).toFixed(1)}%`);
  card.style.setProperty('--about-glow-y', `${((y + 0.5) * 100).toFixed(1)}%`);
}

function handleCardMouseLeave(e: MouseEvent<HTMLElement>) {
  const card = e.currentTarget;
  card.style.setProperty('--about-mx', '0px');
  card.style.setProperty('--about-my', '0px');
  card.style.setProperty('--about-rx', '0deg');
  card.style.setProperty('--about-ry', '0deg');
  card.style.setProperty('--about-glow-x', '50%');
  card.style.setProperty('--about-glow-y', '50%');
}

export default function AboutPage() {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      document.documentElement.style.setProperty('--about-cursor-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--about-cursor-y', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const items = root.querySelectorAll('.about-reveal');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="about-page" ref={pageRef}>
      <section className="about-hero about-reveal is-visible">
        <div className="about-hero-glow" />

        <div className="about-brand-mark">
          <img src="/logo.png" alt="Consult Scribe" />
        </div>

        <p className="about-eyebrow">KERNUL TECH PVT LTD</p>

        <h1>
          Consult <span>Scribe</span>
        </h1>

        <p className="about-hero-copy">
          An AI clinical co-pilot that turns a natural consultation
          into a reviewable medical note.
        </p>

        <div className="about-pills">
          <span>CHROME SPEECH</span>
          <span>GROQ AI</span>
          <span>DOCTOR-CONTROLLED</span>
        </div>

        <a className="about-scroll-cue" href="#architecture">
          <span>Explore the workflow</span>
          <span>↓</span>
        </a>
      </section>

      <Reveal>
        <section className="about-section about-problem">
          <div className="about-kicker">WHY CONSULT SCRIBE</div>
          <h2>
            Less documentation.
            <br />
            <span>More attention on the patient.</span>
          </h2>
          <p>
            Consult Scribe is designed around one simple idea: let the doctor
            conduct the consultation naturally while the software handles
            transcription, structuring and report preparation in the background.
          </p>
        </section>
      </Reveal>

      <Reveal>
        <section className="about-section" id="architecture">
          <div className="about-section-head">
            <div>
              <div className="about-kicker">THE ARCHITECTURE</div>
              <h2>From conversation to clinical record.</h2>
            </div>
            <span className="about-section-index">01 / 04</span>
          </div>

          <div className="about-flow">
            {flow.map((item, index) => (
              <div className="about-flow-wrap" key={item.n}>
                <article className="about-flow-card about-interactive-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
                  <div className="about-flow-top">
                    <span className="about-number">{item.n}</span>
                    <span className="about-icon"><Icon>{item.icon}</Icon></span>
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>

                {index < flow.length - 1 && (
                  <div className="about-flow-arrow">
                    <Icon>{icons.arrow}</Icon>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="about-section">
          <div className="about-section-head">
            <div>
              <div className="about-kicker">WHAT MAKES IT DIFFERENT</div>
              <h2>Built for a real consultation.</h2>
            </div>
            <span className="about-section-index">02 / 04</span>
          </div>

          <div className="about-feature-grid">
            {features.map(([title, text, icon]) => (
              <article className="about-feature about-interactive-card" key={title as string} onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
                <div className="about-icon"><Icon>{icon as ReactNode}</Icon></div>
                <div>
                  <h3>{title as string}</h3>
                  <p>{text as string}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="about-section about-stack-section">
          <div className="about-section-head">
            <div>
              <div className="about-kicker">LOCAL-FIRST STACK</div>
              <h2>The core clinical path stays on the PC.</h2>
            </div>
            <span className="about-section-index">03 / 04</span>
          </div>

          <div className="about-stack">
            <div className="about-stack-node about-interactive-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <span className="about-stack-icon"><Icon>{icons.mic}</Icon></span>
              <strong>Browser Speech</strong>
              <span>Normal first path</span>
            </div>

            <div className="about-stack-connector">→</div>

            <div className="about-stack-node emphasis about-interactive-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <span className="about-stack-icon"><Icon>{icons.wifi}</Icon></span>
              <strong>Chrome Speech</strong>
              <span>Browser transcription</span>
            </div>

            <div className="about-stack-connector">→</div>

            <div className="about-stack-node emphasis about-interactive-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <span className="about-stack-icon"><Icon>{icons.brain}</Icon></span>
              <strong>Groq API</strong>
              <span>Clinical analysis</span>
            </div>

            <div className="about-stack-connector">→</div>

            <div className="about-stack-node about-interactive-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <span className="about-stack-icon"><Icon>{icons.doc}</Icon></span>
              <strong>SQLite + PDF</strong>
              <span>Local records &amp; reports</span>
            </div>
          </div>

          <p className="about-stack-note">
            Google sign-in and patient email are network services by design.
            They are separate from the local transcription and clinical-analysis
            pipeline.
          </p>
        </section>
      </Reveal>

      <Reveal>
        <section className="about-section about-control">
          <div className="about-control-card about-interactive-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
            <div className="about-icon large"><Icon>{icons.shield}</Icon></div>
            <div>
              <div className="about-kicker">DOCTOR-CONTROLLED</div>
              <h2>AI assists. The doctor approves.</h2>
              <p>
                Every generated clinical suggestion is editable before approval.
                Consult Scribe does not replace clinical judgement; it reduces
                the documentation burden around it.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="about-section about-contact-section">
          <div className="about-section-head">
            <div>
              <div className="about-kicker">CONTACT</div>
              <h2>KERNUL TECH PVT LTD</h2>
            </div>
            <span className="about-section-index">04 / 04</span>
          </div>

          <div className="about-contact-grid">
            <a
              href="mailto:theonlynivash@gmail.com"
              className="about-contact about-interactive-card"
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
              <span className="about-icon"><Icon>{icons.mail}</Icon></span>
              <span>
                <small>EMAIL</small>
                <strong>theonlynivash@gmail.com</strong>
              </span>
            </a>

            <div className="about-contact about-interactive-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <span className="about-icon">
                <Icon>
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 .1 4.1 2 2 0 0 1 2 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L6 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6A2 2 0 0 1 22 16.9Z" />
                </Icon>
              </span>
              <span>
                <small>LOCATION</small>
                <strong>Chennai, India</strong>
              </span>
            </div>
          </div>
        </section>
      </Reveal>

      <footer className="about-footer">
        Consult Scribe © 2026 Srinivash Karthikeyan · All Rights Reserved.
      </footer>
    </div>
  );
}
