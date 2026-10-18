import { useEffect, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config';
import { useStore } from '../../services/store';
import { ArrowRight, Search, Target, ListChecks, FlaskConical, Eye, Shield } from 'lucide-react';
import ParticleHero from './ParticleHero';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const loadSampleProfile = useStore((s) => s.loadSampleProfile);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    document.title = 'PlacementIQ — Placement Readiness Assessment';
  }, []);

  const handleStartAssessment = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsTransitioning(true);
    setTimeout(() => {
      navigate(ROUTES.assessment);
    }, 1200); // Wait for explosion animation to finish
  };

  const handleExplore = async () => {
    await loadSampleProfile();
    navigate(ROUTES.scenarios);
  };

  return (
    <div className="landing">
      {/* Hero Section (Full Bleed) */}
      <section className="hero">
        <div className="hero-background">
          <Suspense fallback={<div style={{ width: '100%', height: '100%', background: '#030407' }} />}>
            <ParticleHero isTransitioning={isTransitioning} />
          </Suspense>
        </div>

        <header className="landing-header">
          <div className="container landing-header-inner">
            <Link to="/" className="landing-wordmark">
              PlacementIQ
            </Link>
            <nav className="landing-nav" aria-label="Primary">
              <a href="#how-it-works" className="landing-nav-link">How it works</a>
              <Link to={ROUTES.modelLab} className="landing-nav-link">Model transparency</Link>
              <Link to={ROUTES.overview} className="landing-nav-link">Open workspace</Link>
              <Link to={ROUTES.assessment} onClick={handleStartAssessment} className="btn btn-primary btn-sm hero-nav-cta">
                Tell Your Success
              </Link>
            </nav>
          </div>
        </header>

        <div className="piq-hero-layout">
          <div className="hero-content">
            <div className="hero-label font-mono">PLACEMENTIQ / CAREER READINESS</div>
            <h1 className="hero-headline">
              Your skills.<br />Your direction.<br />Your next chapter.
            </h1>
          </div>
          <div className="piq-hero-caption">
            <p className="hero-description">
              Meet your AI interviewer. Discover what you can demonstrate.
            </p>
            <div className="hero-actions">
              <Link to={ROUTES.assessment} onClick={handleStartAssessment} className="btn btn-primary btn-lg">
                Tell Your Success
                <ArrowRight size={16} />
              </Link>
              <button className="btn btn-outline btn-lg hero-outline-btn" onClick={handleExplore}>
                Explore sample profile
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="section landing-section">
        <div className="container">
          <h2 className="landing-section-title">
            Three stages to clarity
          </h2>
          <div className="stages-grid">
            <div className="stage">
              <div className="stage-number font-mono">01</div>
              <div className="stage-icon"><Search size={20} /></div>
              <h3 className="stage-title">Assess your profile</h3>
              <p className="stage-desc">
                Enter your academic record, skill scores, and experience.
                The assessment captures core features used by placement-prediction models.
              </p>
            </div>
            <div className="stage">
              <div className="stage-number font-mono">02</div>
              <div className="stage-icon"><Target size={20} /></div>
              <h3 className="stage-title">Explore your gaps</h3>
              <p className="stage-desc">
                Compare your profile against preparation benchmarks.
                Identify the skills and experiences that matter most for readiness.
              </p>
            </div>
            <div className="stage">
              <div className="stage-number font-mono">03</div>
              <div className="stage-icon"><ListChecks size={20} /></div>
              <h3 className="stage-title">Plan your progress</h3>
              <p className="stage-desc">
                Build a concrete action plan with prioritised tasks.
                Track improvements across assessments over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Preview */}
      <section className="section landing-section">
        <div className="container">
          <div className="preview-header">
            <div>
              <h2 className="landing-section-title">
                See your readiness profile
              </h2>
              <p className="landing-section-subtitle">
                The overview dashboard shows your preparation level, key skills, and prioritised actions — all in one place.
              </p>
            </div>
            <span className="badge badge-warning" style={{ background: 'rgba(255, 122, 32, 0.1)', color: '#FF7A20', border: '1px solid rgba(255, 122, 32, 0.2)' }}>Illustrative profile</span>
          </div>

          <div className="preview-card">
            <div className="preview-grid">
              <div className="preview-score-area">
                <div className="preview-score-label font-mono">Illustrative readiness</div>
                <div className="preview-score-value font-serif" style={{ color: '#F4F4F0' }}>62</div>
                <div className="badge" style={{ background: 'rgba(255, 122, 32, 0.1)', color: '#FF7A20' }}>Developing</div>
                <p className="preview-score-note text-secondary" style={{ marginTop: '12px', fontSize: '0.8125rem' }}>
                  This is a product-defined preparation estimate, not a model prediction.
                </p>
              </div>
              <div className="preview-bars-area">
                <h4 style={{ marginBottom: '12px', fontSize: '0.875rem' }}>Preparation profile</h4>
                {[
                  { label: 'Coding', value: 72, target: 75 },
                  { label: 'Aptitude', value: 65, target: 70 },
                  { label: 'Communication', value: 58, target: 65 },
                  { label: 'Logic', value: 68, target: 70 },
                  { label: 'Interview', value: 55, target: 65 },
                ].map((s) => (
                  <div key={s.label} className="score-bar" style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8125rem', minWidth: '100px' }}>{s.label}</span>
                    <div className="score-bar-track" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                      <div
                        className="score-bar-fill"
                        style={{
                          width: `${s.value}%`,
                          background: s.value >= s.target ? 'var(--color-success)' : 'var(--color-primary)',
                        }}
                      />
                      <div className="score-bar-target" style={{ left: `${s.target}%`, background: '#ADB1BB' }} />
                    </div>
                    <span className="score-bar-value">{s.value}</span>
                  </div>
                ))}
                <div className="preview-bars-legend font-mono">
                  <span>— Current</span>
                  <span>| Target</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scenario Lab Preview */}
      <section className="section landing-section">
        <div className="container">
          <div className="preview-header">
            <div>
              <h2 className="landing-section-title">
                Explore what-if scenarios
              </h2>
              <p className="landing-section-subtitle">
                Adjust skill scores and experience counts to see how changes affect your readiness estimate. Turn improvements into action-plan tasks.
              </p>
            </div>
            <FlaskConical size={20} className="text-tertiary" />
          </div>
          <div className="preview-card scenario-preview">
            <div className="scenario-preview-grid">
              <div className="scenario-col">
                <div className="font-mono scenario-col-label">Current</div>
                <div className="scenario-values">
                  <div className="scenario-row"><span>Coding</span><span className="font-mono">72</span></div>
                  <div className="scenario-row"><span>Projects</span><span className="font-mono">4</span></div>
                  <div className="scenario-row"><span>Internships</span><span className="font-mono">2</span></div>
                  <div className="scenario-row"><span>Interview</span><span className="font-mono">55</span></div>
                </div>
                <div className="scenario-result">
                  <span className="font-mono">Readiness</span>
                  <span className="font-serif" style={{ fontSize: '1.5rem' }}>62</span>
                </div>
              </div>
              <div className="scenario-arrow">
                <ArrowRight size={20} />
              </div>
              <div className="scenario-col scenario-col-hyp">
                <div className="font-mono scenario-col-label">Hypothetical</div>
                <div className="scenario-values">
                  <div className="scenario-row changed"><span>Coding</span><span className="font-mono">82 <small>+10</small></span></div>
                  <div className="scenario-row changed"><span>Projects</span><span className="font-mono">6 <small>+2</small></span></div>
                  <div className="scenario-row"><span>Internships</span><span className="font-mono">2</span></div>
                  <div className="scenario-row changed"><span>Interview</span><span className="font-mono">70 <small>+15</small></span></div>
                </div>
                <div className="scenario-result">
                  <span className="font-mono">Readiness</span>
                  <span className="font-serif" style={{ fontSize: '1.5rem', color: 'var(--color-success)' }}>71</span>
                </div>
              </div>
            </div>
            <p className="scenario-disclaimer text-secondary font-mono">
              Illustrative scenario — not a prediction of the effect of an intervention.
            </p>
          </div>
        </div>
      </section>

      {/* Transparency */}
      <section className="section landing-section">
        <div className="container">
          <div className="transparency-block">
            <div className="transparency-icon"><Eye size={24} /></div>
            <div>
              <h2 className="landing-section-title" style={{ marginBottom: '8px' }}>
                Built for transparency
              </h2>
              <p className="text-secondary" style={{ maxWidth: '640px', lineHeight: '1.7' }}>
                PlacementIQ is an experimental tool for exploring placement readiness. Current readiness scores
                are illustrative estimates based on transparent, rule-based logic — not outputs from a trained
                prediction model. The Model Lab documents the dataset, preliminary evaluation metrics, known
                limitations, and the distinction between illustrative and genuine model outputs. This project
                does not claim to predict hiring outcomes.
              </p>
              <Link to={ROUTES.modelLab} className="btn btn-outline" style={{ marginTop: '16px', borderColor: 'rgba(244,244,240,0.2)', color: '#F4F4F0' }}>
                <Shield size={16} />
                View Model Lab
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section landing-cta">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 className="landing-section-title">
            Ready to begin?
          </h2>
          <p className="text-secondary" style={{ marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
            Meet your AI interviewer, demonstrate your project thinking, and leave with an evidence-backed preparation plan.
          </p>
          <Link to={ROUTES.assessment} onClick={handleStartAssessment} className="btn btn-primary btn-lg">
            Tell Your Success
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-wordmark" style={{ fontSize: '0.875rem' }}>
              PlacementIQ
            </span>
            <span className="text-tertiary" style={{ fontSize: '0.75rem' }}>
              Experimental readiness assessment tool
            </span>
          </div>
          <nav className="landing-footer-nav" aria-label="Footer">
            <Link to={ROUTES.assessment}>Assessment</Link>
            <Link to={ROUTES.overview}>Workspace</Link>
            <Link to={ROUTES.modelLab}>Model Lab</Link>
            <Link to={ROUTES.profile}>Settings</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
