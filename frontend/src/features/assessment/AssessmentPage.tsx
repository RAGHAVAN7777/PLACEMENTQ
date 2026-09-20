import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../services/store';
import { FEATURE_DEFINITIONS, ASSESSMENT_STEPS, ROUTES } from '../../config';
import type { StudentProfile, FeatureDefinition } from '../../types';
import { ArrowLeft, ArrowRight, Check, AlertTriangle, Save } from 'lucide-react';
import './AssessmentPage.css';

type ValidationErrors = Record<string, string>;
type ValidationWarnings = Record<string, string>;

function validateField(def: FeatureDefinition, value: unknown): { error?: string; warning?: string } {
  if (def.required && (value === undefined || value === null || value === '')) {
    return { error: `${def.label} is required.` };
  }
  if (value === undefined || value === null || value === '') return {};

  if (def.type === 'number') {
    const num = Number(value);
    if (isNaN(num)) return { error: 'Must be a valid number.' };
    if (def.min !== undefined && num < def.min) return { error: `Must be at least ${def.min}.` };
    if (def.max !== undefined && num > def.max) return { error: `Must be at most ${def.max}.` };

    // Warn for out-of-range but valid
    if (def.warningThreshold) {
      const { low, high, message } = def.warningThreshold;
      if ((low !== undefined && num < low) || (high !== undefined && num > high)) {
        return { warning: message };
      }
    }
  }
  return {};
}

function validateStep(step: number, profile: Partial<StudentProfile>): { errors: ValidationErrors; warnings: ValidationWarnings } {
  const stepConfig = ASSESSMENT_STEPS[step - 1];
  if (!stepConfig || step === 4) return { errors: {}, warnings: {} };

  const fields = FEATURE_DEFINITIONS.filter((f) => (stepConfig.categories as unknown as string[]).includes(f.category));
  const errors: ValidationErrors = {};
  const warnings: ValidationWarnings = {};

  for (const def of fields) {
    const value = (profile as unknown as Record<string, unknown>)[def.key];
    const result = validateField(def, value);
    if (result.error) errors[def.key] = result.error;
    if (result.warning) warnings[def.key] = result.warning;
  }

  return { errors, warnings };
}

export default function AssessmentPage() {
  const navigate = useNavigate();
  const { draft, initDraft, updateDraft, setDraftStep, clearDraft, submitAssessment } = useStore();
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [warnings, setWarnings] = useState<ValidationWarnings>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Assessment — PlacementIQ';
    initDraft();
  }, [initDraft]);

  const currentStep = draft?.step ?? 1;
  const profile = draft?.profile ?? {};

  const fieldsForStep = useCallback(
    (step: number) => {
      const stepConfig = ASSESSMENT_STEPS[step - 1];
      if (!stepConfig) return [];
      return FEATURE_DEFINITIONS.filter((f) => (stepConfig.categories as unknown as string[]).includes(f.category));
    },
    []
  );

  const handleChange = useCallback(
    (key: string, value: string) => {
      const def = FEATURE_DEFINITIONS.find((f) => f.key === key);
      let parsed: unknown = value;
      if (def?.type === 'number' && value !== '') {
        parsed = parseFloat(value);
      }
      if (value === '') parsed = undefined;
      updateDraft({ [key]: parsed } as Partial<StudentProfile>);

      // Clear error for this field
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [updateDraft]
  );

  const handleNext = useCallback(() => {
    const { errors: stepErrors, warnings: stepWarnings } = validateStep(currentStep, profile);
    setErrors(stepErrors);
    setWarnings(stepWarnings);

    if (Object.keys(stepErrors).length > 0) {
      // Focus first error
      const firstErrorKey = Object.keys(stepErrors)[0];
      const el = document.getElementById(`field-${firstErrorKey}`);
      el?.focus();
      return;
    }

    setDraftStep(Math.min(currentStep + 1, 4));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep, profile, setDraftStep]);

  const handleBack = useCallback(() => {
    setErrors({});
    setWarnings({});
    setDraftStep(Math.max(currentStep - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep, setDraftStep]);

  const handleSubmit = useCallback(async () => {
    // Validate all required fields
    const allErrors: ValidationErrors = {};
    for (const def of FEATURE_DEFINITIONS.filter((f) => f.required)) {
      const value = (profile as Record<string, unknown>)[def.key];
      const result = validateField(def, value);
      if (result.error) allErrors[def.key] = result.error;
    }

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await submitAssessment(profile as StudentProfile);
      navigate(ROUTES.overview);
    } catch (e) {
      console.error('Submission failed', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [profile, submitAssessment, navigate]);

  const handleDiscard = useCallback(() => {
    clearDraft();
    navigate(ROUTES.home);
  }, [clearDraft, navigate]);

  const renderField = useCallback(
    (def: FeatureDefinition) => {
      const value = (profile as Record<string, unknown>)[def.key];
      const error = errors[def.key];
      const warning = warnings[def.key];

      return (
        <div key={def.key} className="form-group assessment-field">
          <label htmlFor={`field-${def.key}`} className="form-label">
            {def.label}
            {def.required && <span className="required" aria-label="required">*</span>}
            {!def.required && <span className="form-optional">(optional)</span>}
            {def.unit && <span className="form-unit" style={{ marginLeft: 6 }}>{def.unit}</span>}
          </label>

          {def.type === 'select' ? (
            <select
              id={`field-${def.key}`}
              className={`form-select ${error ? 'error' : ''}`}
              value={(value as string) ?? ''}
              onChange={(e) => handleChange(def.key, e.target.value)}
            >
              <option value="">Select...</option>
              {def.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              id={`field-${def.key}`}
              type="number"
              className={`form-input ${error ? 'error' : ''}`}
              value={value !== undefined && value !== null ? String(value) : ''}
              onChange={(e) => handleChange(def.key, e.target.value)}
              min={def.min}
              max={def.max}
              step={def.step}
              placeholder={`${def.min ?? 0}–${def.max ?? ''}`}
            />
          )}

          {def.description && !error && (
            <span className="form-hint">{def.description}</span>
          )}
          {error && <span className="form-error">{error}</span>}
          {warning && !error && (
            <span className="form-warning">
              <AlertTriangle size={12} />
              {warning}
            </span>
          )}
        </div>
      );
    },
    [profile, errors, warnings, handleChange]
  );

  const renderReview = () => {
    const categories = ['academic', 'experience', 'activity', 'skill', 'supplementary'] as const;
    return (
      <div className="review-sections">
        {categories.map((cat) => {
          const fields = FEATURE_DEFINITIONS.filter((f) => f.category === cat);
          const filledFields = fields.filter((f) => {
            const v = (profile as Record<string, unknown>)[f.key];
            return v !== undefined && v !== null && v !== '';
          });
          if (filledFields.length === 0) return null;

          return (
            <div key={cat} className="review-section">
              <h4 className="review-section-title">
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const step = ASSESSMENT_STEPS.findIndex((s) =>
                      (s.categories as readonly string[]).includes(cat)
                    );
                    if (step >= 0) setDraftStep(step + 1);
                  }}
                >
                  Edit
                </button>
              </h4>
              <div className="review-fields">
                {filledFields.map((f) => (
                  <div key={f.key} className="review-field">
                    <span className="review-field-label">{f.label}</span>
                    <span className="review-field-value font-mono">
                      {String((profile as Record<string, unknown>)[f.key])}
                      {f.unit && <span className="form-unit" style={{ marginLeft: 4 }}>{f.unit}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {Object.keys(errors).length > 0 && (
          <div className="notice notice-error" style={{ marginTop: 16 }}>
            <AlertTriangle size={16} />
            <span>Some required fields are missing. Please review the highlighted sections above.</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="assessment-page">
      <div className="assessment-container">
        {/* Header */}
        <div className="assessment-header">
          <Link to={ROUTES.home} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
            Back
          </Link>
          <div className="assessment-header-right">
            {draft?.isDirty && (
              <span className="badge badge-success">
                <Save size={10} />
                Draft saved
              </span>
            )}
            {draft && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowDiscardDialog(true)}
              >
                Discard
              </button>
            )}
          </div>
        </div>

        <h1 className="assessment-title">Profile Assessment</h1>
        <p className="assessment-subtitle text-secondary">
          Complete your academic and skills profile to generate a readiness analysis.
        </p>

        {/* Stepper */}
        <div className="stepper" role="navigation" aria-label="Assessment steps">
          {ASSESSMENT_STEPS.map((step, i) => (
            <div key={step.id} className="stepper-step-wrap">
              <div
                className={`stepper-step ${
                  step.id === currentStep ? 'active' : step.id < currentStep ? 'completed' : ''
                }`}
              >
                <span className="stepper-number">
                  {step.id < currentStep ? <Check size={12} /> : step.id}
                </span>
                <span className="stepper-label">{step.title}</span>
              </div>
              {i < ASSESSMENT_STEPS.length - 1 && <span className="stepper-divider" />}
            </div>
          ))}
        </div>

        {/* Form content */}
        <div className="assessment-form" ref={formRef}>
          {currentStep < 4 ? (
            <>
              <h2 className="assessment-step-title">
                {ASSESSMENT_STEPS[currentStep - 1].title}
              </h2>

              {currentStep === 1 && (
                <div className="notice notice-info" style={{ marginBottom: 20 }}>
                  <span>
                    Skill scores should ideally come from structured assessments. Self-reported scores
                    are not verified measurements and should be treated as approximate.
                  </span>
                </div>
              )}

              <div className="assessment-fields-grid">
                {fieldsForStep(currentStep).map(renderField)}
              </div>
            </>
          ) : (
            <>
              <h2 className="assessment-step-title">Review your profile</h2>
              <p className="text-secondary" style={{ marginBottom: 20 }}>
                Review your entries below. Click "Edit" on any section to make changes before submitting.
              </p>
              {renderReview()}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="assessment-nav">
          {currentStep > 1 && (
            <button className="btn btn-secondary" onClick={handleBack}>
              <ArrowLeft size={16} />
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {currentStep < 4 ? (
            <button className="btn btn-primary" onClick={handleNext}>
              Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="loading-dots"><span /><span /><span /></div>
                  Generating readiness analysis...
                </>
              ) : (
                <>
                  Submit assessment
                  <Check size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Discard dialog */}
      {showDiscardDialog && (
        <div className="dialog-overlay" onClick={() => setShowDiscardDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Discard draft">
            <h3>Discard assessment draft?</h3>
            <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
              This will permanently remove your current draft. Any entered data will be lost.
            </p>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setShowDiscardDialog(false)}>
                Keep editing
              </button>
              <button className="btn btn-danger" onClick={handleDiscard}>
                Discard draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
