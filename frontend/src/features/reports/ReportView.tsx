import { AlertTriangle, ArrowUpRight, CheckCircle2, Minus, RefreshCw, ShieldCheck, Mic, Activity, MessageSquare, Sparkles } from 'lucide-react';
import type { InterviewReport } from '../../services/interviewApi';
import './ReportsPage.css';
import ConversationHistory from '../interview/ConversationHistory';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ReportView({ report, compact = false }: { report: InterviewReport; compact?: boolean }) {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#scoring-policy') document.getElementById('scoring-policy')?.scrollIntoView({ block: 'center' });
  }, [report.id, hash]);
  const modelGraded = report.questions.filter((answer) => answer.grade.method === 'ollama-rubric-estimate').length;
  const skipped = report.questions.filter((answer) => answer.skipped).length;
  const ruleGraded = report.questions.length - modelGraded - skipped;
  const gradingSummary = [
    modelGraded ? `${modelGraded} answer${modelGraded === 1 ? '' : 's'} graded with local ${report.provenance.model.used || report.provenance.model.requested}` : '',
    ruleGraded ? `${ruleGraded} rule-based estimate${ruleGraded === 1 ? '' : 's'} · review recommended` : '',
    skipped ? `${skipped} skipped · insufficient evidence` : '',
  ].filter(Boolean).join('; ');
  const claims = Object.entries(report.evidenceProfile.claimed).flatMap(([category, items]) => items.map((item) => ({ ...item, category })));
  return (
    <div className={`interview-report ${compact ? 'report-compact' : ''}`}>
      {report.demo && <p className="voice-notice"><strong>DEMO — {report.demo.name}</strong> · Fictional candidate and sample answers. This is not a real candidate assessment.</p>}
      <div className="report-hero">
        <div className="report-score-ring" style={{ '--score': `${report.assessment.score * 3.6}deg` } as React.CSSProperties}>
          <span>{report.assessment.score}</span><small>/ 100</small>
        </div>
        <div>
          <span className="eyebrow">INTERVIEW ASSESSMENT · {report.selectedDomain}</span>
          <h2>Evidence-based interview report</h2>
          <p>{report.assessment.totalPoints} of {report.assessment.maxPoints} rubric points across {report.assessment.scoredQuestions ?? report.questions.length} scored questions{report.assessment.scoredQuestions != null && report.questions.length > report.assessment.scoredQuestions ? ` (${report.questions.length} recorded attempts including clarification)` : ''}. This score is separate from placement prediction.</p>
          <div className="report-provenance"><ShieldCheck size={15} /> {gradingSummary}</div>
        </div>
      </div>

      <section className="report-section">
        <div className="section-heading"><div><span className="eyebrow">ASSESSED SKILLS</span><h3>Results by demonstrated area</h3></div></div>
        <div className="skill-result-grid">
          {report.assessment.skills.map((skill) => (
            <article className="skill-result" key={skill.skill}>
              <div><strong>{skill.skill}</strong><span>{skill.questions} question{skill.questions === 1 ? '' : 's'}</span></div>
              <b>{skill.score ?? 'Insufficient evidence'}{skill.score != null && '%'}</b>
              <div className="result-bar"><i style={{ width: `${skill.score || 0}%` }} /></div>
              {skill.reviewNeeded && <small><AlertTriangle size={12} /> Review recommended</small>}
            </article>
          ))}
        </div>
      </section>

      {report.communicationInsights && (
        <section className="report-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TRANSCRIPT COACHING</span>
              <h3>Transcript and timing diagnostics</h3>
            </div>
          </div>
          <p className="report-section-note">{report.communicationInsights.timingSource === 'provided-duration' ? 'Pace uses the provided recording duration. Word matching and clarity are simple text heuristics, not validated measures of speaking ability.' : 'Historical record: timing was estimated from text and is not a measured speaking rate.'}</p>
          <div className="skill-result-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <article className="skill-result">
              <div>
                <strong>Speaking Cadence</strong>
                <span>Average pace</span>
              </div>
              <b style={{ color: 'var(--color-primary, #6366f1)' }}>
                {report.communicationInsights.averageWpm} <small style={{ fontSize: '0.8rem', fontWeight: 500 }}>WPM</small>
              </b>
              <div className="result-bar">
                <i style={{ width: `${Math.min(100, (report.communicationInsights.averageWpm / 180) * 100)}%` }} />
              </div>
              <small><Activity size={12} style={{ display: 'inline', marginRight: 3 }} /> {report.communicationInsights.paceClassification}</small>
            </article>

            <article className="skill-result">
              <div>
                <strong>Text clarity heuristic</strong>
                <span>Not a rubric grade</span>
              </div>
              <b style={{ color: '#059669' }}>
                {report.communicationInsights.clarityScore} <small style={{ fontSize: '0.8rem', fontWeight: 500 }}>/ 100</small>
              </b>
              <div className="result-bar">
                <i style={{ width: `${report.communicationInsights.clarityScore}%`, background: '#10b981' }} />
              </div>
              <small><Sparkles size={12} style={{ display: 'inline', marginRight: 3 }} /> Based on transcript length and word matches</small>
            </article>

            <article className="skill-result">
              <div>
                <strong>Filler Word Load</strong>
                <span>Total count detected</span>
              </div>
              <b style={{ color: report.communicationInsights.totalFillerWords > 5 ? '#dc2626' : '#64748b' }}>
                {report.communicationInsights.totalFillerWords} <small style={{ fontSize: '0.8rem', fontWeight: 500 }}>fillers</small>
              </b>
              <div className="result-bar">
                <i style={{ width: `${Math.min(100, report.communicationInsights.totalFillerWords * 10)}%`, background: '#ef4444' }} />
              </div>
              <small><Mic size={12} style={{ display: 'inline', marginRight: 3 }} /> um, uh, basically, etc.</small>
            </article>
          </div>

          {report.communicationInsights.keyFeedback && (
            <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'var(--color-surface-raised, #f8fafc)', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)', fontSize: '0.8125rem' }}>
              <strong>Aria’s Delivery Coaching:</strong>
              <ul style={{ margin: '0.35rem 0 0 1.25rem', padding: 0 }}>
                {[report.communicationInsights.keyFeedback].map((note, idx) => (
                  <li key={idx} style={{ color: 'var(--color-text-secondary, #475569)' }}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {!compact && Boolean(report.conversation?.length) && <details className="report-section"><summary>Read the full interview conversation</summary><ConversationHistory turns={report.conversation || []} /></details>}
      {report.comparison.length > 0 && (
        <section className="report-section">
          <span className="eyebrow">REASSESSMENT DIFFERENCE</span><h3>Change from the latest comparable interview</h3>
          <p className="report-section-note">Same starting domain. Question paths and difficulty can differ; these changes are a preparation reference, not a calibrated ranking.</p>
          <div className="comparison-grid">
            {report.comparison.map((item) => <div className="comparison-row" key={item.skill}><span>{item.skill}</span><span>{item.previousScore ?? 'No score'} → {item.currentScore ?? 'Insufficient evidence'}</span><b className={(item.change || 0) > 0 ? 'positive' : ''}>{item.change == null ? <Minus size={14} /> : `${item.change > 0 ? '+' : ''}${item.change}`}</b></div>)}
          </div>
        </section>
      )}

      <section className="report-section report-two-column">
        <div>
          <span className="eyebrow">WHAT YOU EXPLAINED</span><h3>Supported concepts</h3>
          <div className="report-list">
            {report.explainedConcepts.length ? report.explainedConcepts.map((item, index) => (
              <div className="report-list-item" key={`${item.skill}-${index}`}><CheckCircle2 size={16} /><div><strong>{item.skill} · {item.concept}</strong><p>“{item.excerpt}”</p></div></div>
            )) : <p className="report-empty">No answer met the report's supported-concept threshold.</p>}
          </div>
        </div>
        <div>
          <span className="eyebrow">MISSING OR UNCERTAIN</span><h3>Evidence gaps</h3>
          <ul className="evidence-gap-list">{report.missingOrUncertainEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <section className="report-section">
        <span className="eyebrow">PREPARATION PLAN</span><h3>Specific next actions</h3>
        <div className="task-grid">{report.improvementTasks.map((task, index) => <article className="report-task" key={task.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{task.title}</strong><p>{task.action}</p></div><ArrowUpRight size={17} /></article>)}</div>
        {report.reassessmentTopics.length > 0 && <div className="reassessment-topics"><strong>Revisit in your next interview</strong><ul>{report.reassessmentTopics.map((topic) => <li key={topic}>{topic}</li>)}</ul></div>}
      </section>

      {!compact && <section className="report-section">
        <span className="eyebrow">EVIDENCE PROFILE</span><h3>Claims, observations, and demonstrated results</h3>
        <p className="report-section-note">The skills above are assessed from answers. Résumé claims and repository observations below provide context; they are not proof of proficiency or authorship.</p>
        <div className="report-two-column">
          <div><h4>Résumé & reviewed claims</h4><div className="report-source-list">{claims.length ? claims.map((claim) => <details key={`${claim.category}-${claim.id}`} className="report-source"><summary><strong>{claim.name}</strong><span>{claim.category} · {claim.origin === 'student-correction' ? 'student correction' : 'résumé source'} · {claim.confirmed ? 'confirmed by student' : 'unconfirmed'}</span></summary><blockquote>{claim.sourcePassage}</blockquote></details>) : <p className="report-empty">No résumé claims recorded.</p>}</div></div>
          <div><h4>Observed in repository files</h4><div className="report-source-list">{report.evidenceProfile.observed.length ? report.evidenceProfile.observed.map((item, index) => <details key={`${item.repository}-${item.sourcePath}-${index}`} className="report-source"><summary><strong>{item.skill}</strong><span>{item.repository} / {item.sourcePath}</span></summary><blockquote>{item.passage}</blockquote><small>{item.confidence} confidence · {item.origin}</small></details>) : <p className="report-empty">No repository evidence was recorded for this interview.</p>}</div></div>
        </div>
      </section>}

      {!compact && <section className="report-section">
        <span className="eyebrow">QUESTION RECORD</span><h3>Answers and rubric evidence</h3>
        <div className="answer-review-list">{report.questions.map((answer, index) => (
          <details key={answer.id} className="answer-review">
            <summary><span>Q{index + 1}</span><strong>{answer.question}</strong><b>{answer.grade.awardedPoints}/{answer.grade.maxPoints}</b></summary>
            <div className="answer-review-body">
              <div><span className="answer-label">Submitted answer</span><p>{answer.skipped ? 'Skipped — insufficient evidence.' : answer.answer}</p></div>
              {answer.deliveryMetrics && (
                <div style={{ margin: '6px 0 10px 0', padding: '6px 10px', background: 'var(--color-surface-raised, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <span className="font-mono"><strong>{answer.deliveryMetrics.wpm}</strong> WPM ({answer.deliveryMetrics.pace})</span>
                  <span>·</span>
                  <span><strong>{answer.deliveryMetrics.clarityScore}/100</strong> Text heuristic</span>
                  <span>·</span>
                  <span><strong>{answer.deliveryMetrics.totalFillers}</strong> Fillers</span>
                  <span>·</span>
                  <span style={{ fontStyle: 'italic', color: 'var(--color-text-secondary, #64748b)' }}>“{answer.deliveryMetrics.coachingTip}”</span>
                </div>
              )}
              {answer.hintUsed && <div className="hint-flag">A hint was used; the published 70% cap was applied.</div>}
              <div className="rubric-table">{answer.grade.criteria.map((criterion) => <div key={criterion.criterionId}><span>{criterion.label}</span><div><p>{criterion.evidenceExcerpt ? `“${criterion.evidenceExcerpt}”` : 'No supporting excerpt.'}</p><p>{criterion.explanation}</p></div><b>{criterion.points}/{criterion.maxPoints}</b></div>)}</div>
              {answer.grade.missingConcepts.length > 0 && <p className="grade-note">Missing concepts: {answer.grade.missingConcepts.join('; ')}</p>}
              <p className="grade-note">{answer.grade.explanation} · {answer.grade.method === 'ollama-rubric-estimate' ? 'Local model estimate' : 'Rule-based rubric'} · Uncertainty: {answer.grade.uncertainty}{answer.grade.reviewNeeded && ' · Faculty review recommended'}</p>
            </div>
          </details>
        ))}</div>
      </section>}

      <div className="report-limitations"><AlertTriangle size={16} /><div><strong>Interpretation limits</strong>{report.limitations.map((item) => <p key={item}>{item}</p>)}</div></div>
      <p id="scoring-policy" className="report-section-note report-policy">Scoring policy: {report.provenance.aggregationPolicy}</p>
      <div className="report-footer-meta"><RefreshCw size={13} /> Bank {report.provenance.questionBankVersion} · Prompt {report.provenance.versions.prompt} · Coordinator {report.provenance.versions.coordinator}</div>
    </div>
  );
}
