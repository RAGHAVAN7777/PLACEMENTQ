import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileText, RotateCcw } from 'lucide-react';
import type { InterviewReport } from '../../services/interviewApi';
import './InterviewOverview.css';

export function InterviewSkillResults({ report }: { report: InterviewReport }) {
  return <section className="result-paper"><div className="result-section-heading"><div><span className="workspace-kicker">WHAT YOU DEMONSTRATED</span><h2>Your skill profile</h2></div><Link to={`/app/interviews?report=${report.id}`}>Answer evidence <ArrowRight size={15} /></Link></div>
    <div className="interview-skill-bars">{report.assessment.skills.map((skill) => <div className="interview-skill-row" key={skill.skill}><div><strong>{skill.skill}</strong><span>{skill.questions} scored question{skill.questions === 1 ? '' : 's'}{skill.reviewNeeded ? ' · review recommended' : ''}</span></div><div className="interview-skill-track" aria-label={`${skill.skill}: ${skill.score == null ? 'not demonstrated' : `${skill.score} out of 100`}`}><i style={{width:`${skill.score ?? 0}%`}} /></div><b>{skill.score == null ? 'Not yet assessed' : `${skill.score}/100`}</b></div>)}</div><p className="result-footnote">Only skills covered by your recorded answers appear here. Unassessed aptitude, communication and other skills are not assigned invented scores.</p></section>;
}

export default function InterviewOverview({ report }: { report: InterviewReport }) {
  const answered = report.questions.filter((item) => !item.skipped);
  const skipped = report.questions.length - answered.length;
  const claimed = report.evidenceProfile.claimed;
  const education = claimed.education?.filter((item) => item.confirmed) || [];
  const projects = claimed.projects?.filter((item) => item.confirmed) || [];
  const skills = claimed.skills?.filter((item) => item.confirmed) || [];
  const review = report.assessment.skills.some((item) => item.reviewNeeded);
  const completeEvidence = answered.length >= 3 && report.assessment.skills.every((item) => item.result === 'assessed');
  const band = !answered.length ? 'Not enough answer evidence' : !completeEvidence ? 'Partial evidence · keep practising' : review ? 'Result ready for review' : report.assessment.score >= 75 ? 'Strong demonstrated foundation' : report.assessment.score >= 50 ? 'A developing foundation' : 'Your next steps are clear';
  const reportUrl = `/app/interviews?report=${report.id}`;
  return <div className="interview-overview">
    <div className="results-intro"><div><span className="workspace-kicker">YOUR CONVERSATION, REFLECTED.</span><h1>A clearer picture.<br /><em>Your next chapter.</em></h1><p>Your interview is complete. Here’s what your answers demonstrated.</p></div><Link className="btn btn-secondary" to="/assessment?new=1"><RotateCcw size={15}/> Start reassessment</Link></div>
    <div className="result-status"><CheckCircle2 size={18}/><div><strong>Interview saved</strong><span>{new Date(report.createdAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})} · {report.selectedDomain}</span></div><Link to={reportUrl}>View full report <ArrowRight size={15}/></Link></div>
    <section className="result-paper result-summary">
      <div className="interview-score"><span className="workspace-kicker">INTERVIEW SCORE</span><div className="interview-score-number">{report.assessment.score}<small>/100</small></div><strong>{band}</strong><p>{report.assessment.totalPoints} of {report.assessment.maxPoints} rubric points</p><Link to={`${reportUrl}#scoring-policy`}>How this is scored <ArrowRight size={13}/></Link></div>
      <div className="result-context"><span className="workspace-kicker">FROM YOUR SESSION</span><h2>Your evidence profile</h2><dl><div><dt>Starting domain</dt><dd>{report.selectedDomain}</dd></div><div><dt>Answered</dt><dd>{answered.length} of {report.questions.length} prompts</dd></div><div><dt>Hints used</dt><dd>{report.questions.filter((item) => item.hintUsed).length}</dd></div><div><dt>Reviewed projects</dt><dd>{projects.length || 'None supplied'}</dd></div><div><dt>Repository sources</dt><dd>{new Set(report.evidenceProfile.observed.map((item)=>item.repository)).size || 'Not supplied'}</dd></div><div><dt>Scoring</dt><dd>{answered.some((item)=>item.grade.method === 'ollama-rubric-estimate') ? 'Local AI + validated rubric' : 'Rubric rules · review needed'}</dd></div></dl>{education.length > 0 && <p className="result-education"><FileText size={15}/>{education.map((item)=>item.name).join(' · ')}</p>}
      <div className="result-claim-tags">{[...new Set(skills.map((item)=>item.name.toLowerCase()))].slice(0,7).map((skill)=><span key={skill}>{skill}</span>)}</div><p className="result-footnote">Education, skills and projects above are your reviewed résumé claims. CGPA, college tier and internship counts are not guessed.</p></div>
    </section>
    {skipped > 0 && <div className="result-evidence-note"><strong>{skipped} prompt{skipped===1?' was':'s were'} skipped.</strong> Skipped prompts stay visible in your report. Reassessment lets you demonstrate what is missing; this score does not determine whether you can get placed.</div>}
    <InterviewSkillResults report={report}/>
    <section className="result-paper"><div className="result-section-heading"><div><span className="workspace-kicker">A LITTLE PROGRESS, EVERY DAY</span><h2>Your next steps</h2></div><Link to="/app/plan">Open action plan <ArrowRight size={15}/></Link></div><div className="interview-next-steps">{report.improvementTasks.slice(0,3).map((task,index)=><article key={task.id}><span>{String(index+1).padStart(2,'0')}</span><div><h3>{task.title}</h3><p>{task.action}</p></div></article>)}</div></section>
    <footer className="result-boundary"><p>This is evidence from your interview, not a placement probability or hiring decision.</p><Link to="/placement-assessment">Open the separate placement predictor <ArrowRight size={14}/></Link></footer>
  </div>;
}
