import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, FileText,
  GitFork, Lightbulb, Loader2, Mic, Pause, Play, Plus, RotateCcw, Send, SkipForward, Sparkles, Trash2, Upload,
  Volume2, VolumeX, ShieldCheck, ArrowUpRight, X, AudioLines, CircleHelp
} from 'lucide-react';
import { ROUTES } from '../../config';
import {
  fileToBase64, interviewApi, rememberSession, savedSessionId,
  type EvidenceClaim, type InterviewReport, type InterviewSession, type OllamaStatus
} from '../../services/interviewApi';
import RobotAvatar, { type RobotState } from './RobotAvatar';
import { useInterviewerSpeech } from './useInterviewerSpeech';
import './InterviewPage.css';
import './InterviewRoom.css';
import './Conversation.css';
import './InterviewWorkspace.css';
import ProfileReview from './ProfileReview';
import { useLocalVoiceInput } from './useLocalVoiceInput';
import ConversationHistory from './ConversationHistory';

const STAGES = ['Resume', 'Evidence', 'Analysis', 'Interview', 'Report'];

function stageNumber(status?: InterviewSession['status']) {
  if (!status || ['resume', 'profile-review'].includes(status)) return 0;
  if (status === 'github') return 1;
  if (['analysis', 'domain-selection'].includes(status)) return 2;
  if (['interview', 'paused', 'reporting'].includes(status)) return 3;
  return 4;
}

export default function InterviewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const newRequested = useRef(searchParams.get('new') === '1');
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [health, setHealth] = useState<OllamaStatus | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [githubUrl, setGithubUrl] = useState('');
  const [githubPreview, setGithubPreview] = useState<Awaited<ReturnType<typeof interviewApi.previewGitHub>> | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState({ progress: 0, message: 'Ready to analyse', events: [] as string[] });
  const [selectedDomain, setSelectedDomain] = useState('');
  const [answer, setAnswer] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [completedHere, setCompletedHere] = useState(false);
  const [hint, setHint] = useState('');
  const [lastFeedback, setLastFeedback] = useState('');
  const [muted, setMuted] = useState(() => localStorage.getItem('placementiq_muted') === 'true');
  const [showPaste, setShowPaste] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const operationRef = useRef(false);
  const submittingAnswer = useRef(false);

  const currentQuestion = session?.questions[session.questionIndex];

  useEffect(() => {
    document.title = 'AI Evidence Interview — PlacementIQ';
    let active = true;
    (async () => {
      try {
        const healthResult = await interviewApi.health();
        if (!active) return;
        setHealth(healthResult.ollama);
        const saved = newRequested.current ? null : savedSessionId();
        let next: InterviewSession;
        if (saved) {
          try { next = (await interviewApi.getSession(saved)).session; }
          catch (err) { if (!(err instanceof Error) || !/not found/i.test(err.message)) throw err; next = (await interviewApi.createSession()).session; }
        } else next = (await interviewApi.createSession()).session;
        if (!active) return;
        rememberSession(next.id);
        if (newRequested.current) { newRequested.current = false; setSearchParams({}, { replace: true }); }
        setSession(next);
        if (next.reportId) setReport((await interviewApi.report(next.reportId)).report);
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'The local server is unavailable.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; window.speechSynthesis?.cancel(); };
  }, []);

  useEffect(() => { localStorage.setItem('placementiq_muted', String(muted)); }, [muted]);
  useEffect(() => { if (session?.suggestedDomain && !selectedDomain) setSelectedDomain(session.suggestedDomain); }, [session?.suggestedDomain, selectedDomain]);
  useEffect(() => { setHint(''); setAnswer(currentQuestion ? sessionStorage.getItem(`piq_draft_${currentQuestion.id}`) || '' : ''); }, [currentQuestion?.id]);

  const speech = useMemo(() => {
    if (error) return `I need your attention. ${error}`;
    if (!session) return 'Welcome to PlacementIQ. I am preparing your local interview room.';
    if (session.status === 'resume') return 'Hi, I’m Aria. Every good conversation starts with your story. Share your résumé, and we’ll take it from there.';
    if (session.status === 'profile-review') return 'I found these claims in your resume. Please correct and confirm them before we continue.';
    if (session.status === 'github') return 'You can add public GitHub evidence, or continue without it. Repository files do not prove authorship.';
    if (session.status === 'analysis') return analysis.message;
    if (session.status === 'domain-selection') return `Your strongest starting point appears to be ${session.suggestedDomain}, based on ${session.domains[0]?.basis || 'available evidence'}. You can choose another domain.`;
    if (session.status === 'paused') return 'The interview is paused. Your answers and position are saved.';
    if (session.status === 'reporting') return 'I am calculating the rubric totals and preparing your report.';
    if (session.status === 'completed' && session.conversation?.length) return session.conversation.at(-1)!.text;
    if (session.status === 'completed') return report ? `Your interview is complete. Let’s look at what you demonstrated, and where to go next.` : 'Your interview is complete. I’m opening your saved report.';
    if (currentQuestion) return session.conversation?.at(-1)?.text || currentQuestion.prompt;
    return 'I am ready when you are.';
  }, [session, currentQuestion, analysis.message, error, report]);

  const speechPlayer = useInterviewerSpeech(speech, muted, !busy && !voiceActive);
  useEffect(() => {
    if (session?.status === 'completed' && report && !busy && (!completedHere || speechPlayer.finishedText === speech)) {
      speechPlayer.stop();
      navigate(`${ROUTES.overview}?report=${encodeURIComponent(report.id)}`, { replace: true });
    }
  }, [session?.status, report?.id, busy, completedHere, speechPlayer.finishedText, speech, navigate, speechPlayer.stop]);
  const updateAnswer = (value: string) => { setAnswer(value); if (currentQuestion) sessionStorage.setItem(`piq_draft_${currentQuestion.id}`, value); };
  const voice = useLocalVoiceInput(answer, updateAnswer, busy || session?.status !== 'interview', (active) => { if (active) speechPlayer.stop(); setVoiceActive(active); });
  const robotState: RobotState = error ? 'error' : busy ? 'processing' : speechPlayer.speaking ? 'speaking' : voice.listening ? 'listening' : (session?.avatarState || 'awaiting');
  const setSafeSession = (next: InterviewSession) => { setSession(next); rememberSession(next.id); setError(''); if (next.model.lastStatus) setHealth(next.model.lastStatus); };
  const run = async (task: () => Promise<void>, isAnswer = false) => { if (operationRef.current) return; operationRef.current = true; submittingAnswer.current = isAnswer; speechPlayer.stop(); voice.stop(); setBusy(true); setError(''); try { await task(); } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); } finally { operationRef.current = false; submittingAnswer.current = false; setBusy(false); } };
  const refreshHealth = async () => { setHealthBusy(true); try { setHealth((await interviewApi.health()).ollama); } catch (err) { setError(err instanceof Error ? err.message : 'Could not connect.'); } finally { setHealthBusy(false); } };
  const selectFile = (next: File | null) => {
    setError(''); setUploadProgress(0);
    if (next && (!/\.(pdf|docx)$/i.test(next.name) || next.size > 8 * 1024 * 1024)) { setError('Choose a PDF or DOCX no larger than 8 MB.'); return; }
    setFile(next); if (next) { setShowPaste(false); setPastedText(''); }
  };

  const submitResume = () => run(async () => {
    if (!session) return;
    if (!file && pastedText.trim().length < 40) throw new Error('Choose a PDF or DOCX, or paste at least 40 characters of resume text.');
    if (file && file.size > 8 * 1024 * 1024) throw new Error('Resume files must be 8 MB or smaller.');
    if (file && !/\.(pdf|docx)$/i.test(file.name)) throw new Error('Only PDF and DOCX files are supported.');
    setUploadProgress(file ? 1 : 75);
    const contentBase64 = file ? await fileToBase64(file, setUploadProgress) : undefined;
    const result = await interviewApi.uploadResume(session.id, { fileName: file?.name, mimeType: file?.type, contentBase64, pastedText: file ? undefined : pastedText });
    setUploadProgress(100); setSafeSession(result.session);
  });

  const changeClaim = (category: keyof InterviewSession['profile'], index: number, changes: Partial<EvidenceClaim>) => {
    if (!session) return;
    const profile = { ...session.profile, [category]: session.profile[category].map((item, itemIndex) => itemIndex === index ? { ...item, ...changes, origin: changes.name !== undefined ? 'student-correction' : item.origin } : item) };
    setSession({ ...session, profile });
  };
  const removeClaim = (category: keyof InterviewSession['profile'], index: number) => session && setSession({ ...session, profile: { ...session.profile, [category]: session.profile[category].filter((_, itemIndex) => itemIndex !== index) } });
  const addClaim = (category: keyof InterviewSession['profile']) => session && setSession({ ...session, profile: { ...session.profile, [category]: [...session.profile[category], { id: `${category}_${Date.now()}`, name: '', sourcePassage: 'Added by student during review.', origin: 'student-correction', confidence: 'student-supplied', confirmed: true }] } });
  const confirmAllClaims = () => session && setSession({ ...session, profile: Object.fromEntries(Object.entries(session.profile).map(([key, items]) => [key, items.map((item) => ({ ...item, confirmed: true }))])) as InterviewSession['profile'] });

  const saveProfile = () => run(async () => { if (session) setSafeSession((await interviewApi.saveProfile(session.id, session.profile)).session); });
  const previewGithub = () => run(async () => { const preview = await interviewApi.previewGitHub(githubUrl); setGithubPreview(preview); setSelectedRepos(preview.type === 'repository' ? [preview.repositories[0].fullName] : []); });

  const runAnalysis = async (id: string) => {
    setAnalysis({ progress: 0, message: 'Starting local analysis', events: [] });
    await interviewApi.analyze(id, (event) => {
      if (event.type === 'error') throw new Error(event.message);
      setAnalysis((current) => ({ progress: event.progress ?? current.progress, message: event.message, events: event.type === 'progress' ? [...current.events.filter((item) => item !== event.message), event.message] : current.events }));
      if (event.session) setSafeSession(event.session);
    });
  };
  const continueGithub = (skipped = false) => run(async () => {
    if (!session) return;
    const repos = skipped ? [] : (githubPreview?.repositories || []).filter((repo) => selectedRepos.includes(repo.fullName)).map(({ owner, name }) => ({ owner, name }));
    const result = await interviewApi.saveGitHub(session.id, repos, skipped);
    setSafeSession(result.session);
    await runAnalysis(result.session.id);
  });

  const startInterview = () => run(async () => { if (session) setSafeSession((await interviewApi.start(session.id, selectedDomain)).session); });
  const submitAnswer = (skipped = false) => run(async () => {
    if (!session) return;
    const result = await interviewApi.answer(session.id, answer, skipped, currentQuestion?.id);
    if (currentQuestion) sessionStorage.removeItem(`piq_draft_${currentQuestion.id}`);
    setLastFeedback(skipped ? 'Question skipped and recorded as insufficient evidence.' : result.answer.feedbackDeferred ? 'Your answer is saved. Let’s explore a little further before reviewing the rubric.' : `${result.answer.grade.awardedPoints}/${result.answer.grade.maxPoints} rubric points recorded · ${result.answer.grade.uncertainty} uncertainty`);
    setSafeSession(result.session); if (result.report) { setCompletedHere(true); setReport(result.report); }
  }, !skipped);
  const requestHint = () => run(async () => { if (session) { const result = await interviewApi.hint(session.id); setHint(`${result.hint} ${result.scoringPolicy}`); setSafeSession(result.session); } });
  const togglePause = () => run(async () => { if (session) setSafeSession((await interviewApi.pause(session.id, session.status === 'interview')).session); });
  const newSession = () => run(async () => { const next = (await interviewApi.createSession()).session; setReport(null); setFile(null); setPastedText(''); setShowPaste(false); setGithubUrl(''); setGithubPreview(null); setSelectedRepos([]); setSelectedDomain(''); setHint(''); setAnswer(''); setLastFeedback(''); setUploadProgress(0); setAnalysis({ progress: 0, message: 'Ready to analyse', events: [] }); setSafeSession(next); });

  const step = stageNumber(session?.status);
  const statusLabel = error ? 'Needs attention' : voice.listening ? 'Listening to you' : speechPlayer.speaking ? 'Speaking' : busy ? 'Preparing' : session?.status === 'paused' ? 'Paused' : session?.status === 'completed' ? 'Session complete' : 'Ready when you are';
  return <div className={`interview-page stage-${session?.status || 'connecting'}`}>
    <header className="interview-topbar">
      <Link to={ROUTES.home} className="interview-wordmark" aria-label="PlacementIQ home"><span className="wordmark-symbol">p<span>i</span></span>PlacementIQ<span className="wordmark-divider" /><small>THE INTERVIEW ROOM</small></Link>
      <div className="interview-steps" aria-label="Interview progress">{STAGES.map((label, index) => <div key={label} className={`${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`}><i>{index < step ? <Check size={11} /> : index + 1}</i><span>{label}</span></div>)}</div>
      <Link to={ROUTES.interviewReports} className="interview-history-link">My interviews <ArrowUpRight size={15} /></Link>
    </header>

    <main className="interview-room" id="main-content">
      <section className="presenter-stage" aria-label="Your interviewer Aria">
        <div className="stage-grain" />
        <div className="stage-editorial"><h1>Your story.<br />{' '}Your skills.<br /><em>Your next chapter.</em></h1><p>A thoughtful conversation.<br />A clearer picture of what’s next.</p><span className="stage-session-note">01 — PERSONAL INTERVIEW</span></div>
        <div className="presenter-canvas"><RobotAvatar state={robotState} speechRef={speechPlayer.speechRef} currentText={speech} /><img src="/image.png" alt="Suit" className="avatar-suit" /></div>
        <aside className="stage-session-details"><span className="eyebrow">MADE AROUND YOU</span><div><span>01</span><p>Your experience<small>Résumé & project evidence</small></p></div><div><span>02</span><p>Your thinking<small>6 questions · up to 2 follow-ups</small></p></div><div><span>03</span><p>Your next step<small>A personal preparation plan</small></p></div><span className="stage-privacy"><ShieldCheck size={14} /> Your résumé stays on this device</span></aside>
        <div className="presenter-identity"><span className={`presence-dot ${speechPlayer.speaking ? 'is-speaking' : ''}`} /><strong>Aria</strong><span>Your interview companion</span><i /> <small>{statusLabel}</small></div>
      </section>
      {/* Keep dialogue and active controls together in the right-hand workspace. */}
      <div className="interaction-deck">
      <div className="deck-caption"><span>YOUR INTERVIEW SPACE</span><span>{String(step + 1).padStart(2, '0')} / 05</span></div>
      <section className="conversation-bar" aria-label="Aria's dialogue">
        <div className={`speech-wave ${speechPlayer.speaking ? 'is-speaking' : ''}`} aria-hidden="true">{[0, 1, 2, 3, 4].map((item) => <i key={item} style={{ animationDelay: `${item * 0.13}s` }} />)}</div>
        <p aria-live="polite">{speech}</p>
        <div className="speech-controls"><button onClick={() => { voice.stop(); speechPlayer.speaking ? speechPlayer.stop() : speechPlayer.replay(); }} disabled={muted || !speechPlayer.supported || busy || voice.active} aria-label={speechPlayer.speaking ? 'Stop Aria speaking' : 'Replay Aria’s reply'} title={speechPlayer.voiceName || 'Hear Aria'}>{speechPlayer.speaking ? <Pause size={16} /> : <Play size={16} />}{speechPlayer.speaking ? ' Interrupt' : ' Replay'}</button><button onClick={() => { speechPlayer.stop(); setMuted(!muted); }} aria-label={muted ? 'Unmute Aria' : 'Mute Aria'} aria-pressed={muted}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button></div>
      </section>
      {speechPlayer.speechError && <p className="voice-notice">{speechPlayer.speechError}</p>}
      <section className="interview-console">
        {busy && session && <p className="operation-status" role="status"><Loader2 size={14} className="spin" />{session.status === 'resume' ? 'Reading your résumé and extracting source-backed claims…' : session.status === 'domain-selection' ? 'Preparing your questions with the local model…' : session.status === 'interview' ? 'Reviewing this step and saving your progress…' : 'Working on your evidence…'}</p>}
        {error && <div className="interview-error"><AlertCircle size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
        {!session && !busy && <div className="connection-recovery"><h2>Let’s reconnect your interview room.</h2><p>Start the local service with Start-PlacementIQ.cmd, then try again.</p><button className="interview-primary" onClick={() => window.location.reload()}><RotateCcw size={16} /> Reconnect</button></div>}

        {busy && !session && <div className="console-loading"><Loader2 className="spin" /><span>Connecting to the local interview service…</span></div>}

        {session?.status === 'resume' && <div className="console-panel resume-panel">
          <div className="panel-heading"><div><span className="eyebrow">FIRST, A LITTLE CONTEXT</span><h1>Let’s begin with your story.</h1></div><span className="panel-step">STEP 01 / 05</span></div><p className="console-lede">Share your résumé. We’ll turn your experience into a conversation that’s yours.</p>
          <label className={`resume-dropzone ${file ? 'has-file' : ''} ${dragging ? 'drag-over' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0] || null); }}>
            <input type="file" aria-label="Upload résumé" disabled={busy} accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { selectFile(event.target.files?.[0] || null); event.target.value = ''; }} />
            {file ? <><FileText size={28} /><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to read locally</span></div><button type="button" onClick={(event) => { event.preventDefault(); setFile(null); }}><Trash2 size={15} /> Replace</button></> : <><Upload size={28} /><div><strong>Drop your resume here</strong><span>PDF or DOCX · up to 8 MB</span></div><b>Browse file</b></>}
          </label>
          <div className="resume-footer"><button className="paste-toggle" onClick={() => { setShowPaste(!showPaste); setFile(null); }}><FileText size={14} /> {showPaste ? 'Use a document instead' : 'Or paste your résumé text'}</button><span><ShieldCheck size={13} /> Stored locally · Linked to this browser</span></div>
          {showPaste && <textarea className="resume-paste" aria-label="Résumé text" value={pastedText} maxLength={30000} onChange={(event) => setPastedText(event.target.value)} placeholder="Paste the resume text exactly as it appears. PlacementIQ never invents missing content." rows={5} />}
          {uploadProgress > 0 && <div className="upload-progress"><div><i style={{ width: `${uploadProgress}%` }} /></div><span>{uploadProgress >= 100 ? 'Extraction complete' : uploadProgress >= 75 ? 'Text ready · extracting and validating claims' : `Reading file · ${uploadProgress}%`}</span></div>}
          <div className="resume-continue"><span>No perfect résumé needed.<br /><strong>Just a place to start.</strong></span><button className="interview-primary" disabled={busy || (!file && pastedText.trim().length < 40)} onClick={submitResume}>{busy ? <Loader2 className="spin" size={17} /> : null} {busy ? 'Reading your résumé…' : 'Let’s get to know you'} <ArrowRight size={17} /></button></div>
        </div>}

        {session?.status === 'profile-review' && <ProfileReview profile={session.profile} busy={busy} onChange={changeClaim} onRemove={removeClaim} onAdd={addClaim} onConfirmAll={confirmAllClaims} onContinue={saveProfile} />}

        {session?.status === 'github' && <div className="console-panel github-panel">
          <span className="eyebrow">03 · OPTIONAL REPOSITORY EVIDENCE</span><h1>Show me what I may inspect.</h1><p className="console-lede">Add a public profile or repository. I read a bounded set of READMEs, manifests, source files, and tests—never execute downloaded code.</p>
          <div className="github-input"><GitFork size={20} /><input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/username or /username/repository" /><button onClick={previewGithub} disabled={busy || !githubUrl.trim()}>{busy ? <Loader2 className="spin" size={16} /> : 'Inspect link'}</button></div>
          {githubPreview && <div className="repo-picker"><div className="repo-picker-head"><span>{githubPreview.profile.name || githubPreview.profile.login}</span><small>Select up to two · {githubPreview.cached ? 'cached response' : 'fresh response'}</small></div>{githubPreview.repositories.map((repo) => { const selected = selectedRepos.includes(repo.fullName); return <button className={selected ? 'selected' : ''} key={repo.fullName} onClick={() => setSelectedRepos((current) => selected ? current.filter((item) => item !== repo.fullName) : current.length < 2 ? [...current, repo.fullName] : current)}><span className="repo-check">{selected && <Check size={12} />}</span><div><strong>{repo.fullName}</strong><p>{repo.description || 'No repository description.'}</p><small>{repo.language || 'Mixed'} · updated {new Date(repo.updatedAt).toLocaleDateString()}</small></div></button> })}<p className="evidence-disclaimer">Repository presence, commits, and file contents do not prove authorship or proficiency.</p></div>}
          <div className="github-actions"><button className="interview-secondary" onClick={() => continueGithub(true)} disabled={busy}>Continue without GitHub</button><button className="interview-primary" onClick={() => continueGithub(false)} disabled={busy || !selectedRepos.length}>Inspect selected & analyse <ArrowRight size={17} /></button></div>
        </div>}

        {session?.status === 'analysis' && <div className="console-panel analysis-panel">
          <span className="eyebrow">04 · EVIDENCE ANALYSIS</span><h1>Building your interview path.</h1><p className="console-lede">These updates come from the backend coordinator. Your interview will not start until the final state is saved.</p>
          <div className="analysis-orb"><span>{analysis.progress}%</span><i style={{ '--progress': `${analysis.progress * 3.6}deg` } as React.CSSProperties} /></div>
          <div className="analysis-events">{analysis.events.map((event, index) => <div className={index === analysis.events.length - 1 ? 'current' : 'done'} key={event}>{index < analysis.events.length - 1 ? <CheckCircle2 size={17} /> : <Loader2 className="spin" size={17} />}<span>{event}</span></div>)}</div>
          {!busy && <button className="interview-primary" onClick={() => run(() => runAnalysis(session.id))}>Resume analysis <RotateCcw size={16} /></button>}
        </div>}

        {session?.status === 'domain-selection' && <div className="console-panel domain-panel">
          <span className="eyebrow">05 · CHOOSE YOUR STARTING DOMAIN</span><h1>Where should we begin?</h1><p className="console-lede">The suggestion is evidence-informed, not a claim of proficiency. You control the starting point.</p>
          <div className="domain-grid">{session.domains.map((domain, index) => <button key={domain.domain} className={selectedDomain === domain.domain ? 'selected' : ''} onClick={() => setSelectedDomain(domain.domain)}><div><span>{index === 0 && 'Suggested · '}{domain.basis}</span><strong>{domain.domain}</strong></div><i>{domain.claimed ? `${domain.claimed} claimed` : 'not claimed'}</i><i>{domain.observed ? `${domain.observed} observed` : 'no repo evidence'}</i><p>{domain.evidence[0]}</p></button>)}</div>
          <div className="evidence-legend"><span><i className="claimed" /> Claimed in resume</span><span><i className="observed" /> Observed in files</span><span><i className="assessed" /> Demonstrated in interview</span></div>
          {!!session.github.inspectedFiles.length && <details className="inspected-evidence"><summary>{session.github.inspectedFiles.length} repository files inspected</summary>{session.github.inspectedFiles.map((item) => <p key={`${item.repository}/${item.path}`}><code>{item.repository}/{item.path}</code></p>)}{session.github.notice && <p>{session.github.notice}</p>}</details>}
          <button className="interview-primary" onClick={startInterview} disabled={busy || !selectedDomain}>Begin with {selectedDomain || 'selected domain'} <ArrowRight size={17} /></button>
        </div>}

        {session?.status === 'paused' && <div className="console-panel paused-panel"><Pause size={30} /><span className="eyebrow">SESSION SAVED</span><h1>Take the time you need.</h1><p>Your question position, evidence, and submitted answers are persisted locally by the backend.</p><button className="interview-primary" onClick={togglePause}><Play size={17} /> Resume interview</button></div>}

        {session?.status === 'interview' && currentQuestion && <div className="console-panel question-panel">
          <div className="question-meta"><span>{currentQuestion.skill}</span><span>{currentQuestion.difficulty}</span><span>{currentQuestion.followUp ? 'adaptive follow-up' : `question ${session.questionIndex + 1} of ${session.questions.length}`}</span></div>
          <div className="question-progress"><i style={{ width: `${(session.questionIndex / session.questions.length) * 100}%` }} /></div>
          {lastFeedback && <div className="last-feedback"><CheckCircle2 size={15} /> {lastFeedback}</div>}
          <details className="history-drawer"><summary>Conversation · {session.answers?.length || 0} answers saved</summary><ConversationHistory turns={session.conversation || []} pending={busy && submittingAnswer.current ? answer : undefined} /></details>
          <h1 className="question-text conversation-your-turn">Your turn</h1>
          {currentQuestion.context && <div className="question-source"><span>{currentQuestion.context.type === 'repository' ? 'Observed source' : 'Claimed source'} · {currentQuestion.context.label}</span><p>{currentQuestion.context.passage}</p></div>}
          {hint && <div className="hint-panel"><Lightbulb size={17} /><p>{hint}</p></div>}
          <div className="answer-composer"><textarea aria-label="Your answer" value={answer} onChange={(event) => updateAnswer(event.target.value)} placeholder="Explain your reasoning. A concrete example is stronger than a keyword list." rows={5} maxLength={4000} disabled={busy || voice.active} /><div className="composer-footer"><div><button className={`voice-button ${voice.listening ? 'listening' : ''}`} onClick={voice.toggle} disabled={!voice.supported || busy || (voice.active && !voice.listening)} title="Offline transcription on this device; review before submitting"><Mic size={16} /> {voice.listening ? 'Stop microphone' : 'Microphone · answer by voice'}</button><span>{answer.length}/4000 · draft saved</span></div><button className="send-answer" onClick={() => submitAnswer(false)} disabled={busy || voice.active || answer.trim().length < 1}>{busy ? <Loader2 className="spin" size={17} /> : <ArrowUpRight size={17} />} Submit answer</button></div></div>
          {voice.error && <p className="voice-notice">{voice.error}</p>}
          <div className="question-actions"><button onClick={togglePause} disabled={busy}><Pause size={15} /> Pause</button><button onClick={requestHint} disabled={busy || Boolean(hint)}><Lightbulb size={15} /> {currentQuestion.hintUsed ? 'Show hint' : 'Hint'} <small>70% cap</small></button><button onClick={() => submitAnswer(true)} disabled={busy}><SkipForward size={15} /> Skip</button></div>
          <div className="voice-session-status" role="status">{voice.status === 'loading' ? 'Loading local speech recognition…' : voice.status === 'permission' ? 'Waiting for microphone permission… Allow access in your browser.' : voice.status === 'recording' ? '● Recording — Aria is silent. Stop when you finish (90-second limit).' : voice.status === 'transcribing' ? 'Finishing your local transcript…' : voice.status === 'review' ? 'Transcript ready. Edit it above, then submit when you are happy.' : 'Type an answer or use the microphone. Audio stays in this browser.'}</div>
          <div className="conversation-input-tools"><button onClick={() => { voice.stop(); speechPlayer.stop(); document.querySelector<HTMLTextAreaElement>('[aria-label="Your answer"]')?.focus(); }}>Interrupt Aria & type</button><label>Use recorded audio<input type="file" aria-label="Transcribe recorded answer" accept="audio/*" disabled={busy || voice.active} onChange={event => { const file = event.target.files?.[0]; if (file) voice.fromFile(file); event.target.value = ''; }} /></label>{voice.active && <button onClick={voice.stop}>Cancel microphone</button>}</div>
        </div>}

        {session?.status === 'reporting' && <div className="console-panel analysis-panel"><span className="eyebrow">FINALISING</span><h1>Preparing your report.</h1><p>Your recorded answers are saved. We’ll calculate your results from the rubric scores.</p>{busy ? <Loader2 className="spin report-spinner" size={34} /> : <button className="interview-primary" onClick={() => run(async () => { const result = await interviewApi.finishReport(session.id); setSafeSession(result.session); setReport(result.report); })}>Finish saved report <ArrowRight size={16} /></button>}</div>}
        {session?.status === 'completed' && report && <div className="console-panel completed-panel"><ConversationHistory turns={session.conversation || []} /><p>Your report is saved. Aria’s final reply is shown above.</p><div className="completed-actions"><button className="interview-primary" onClick={() => { speechPlayer.stop(); navigate(`${ROUTES.overview}?report=${report.id}`); }}>View my results <ArrowRight size={17} /></button><button className="interview-secondary" onClick={() => window.print()}>Print report</button><button className="interview-primary" onClick={newSession}>Start reassessment <ArrowRight size={17} /></button></div></div>}
      </section>
      </div>
      <footer className="room-footer" style={{ justifyContent: 'center' }}>
        <span>&copy; {new Date().getFullYear()} Developed by RAGHAVAN S , VEERA M</span>
      </footer>
      {health && !health.installed && <p className="practice-notice">Ollama isn’t connected yet. You can finish guided practice now; results use a limited rule-based rubric and need review.</p>}
      {setupOpen && <section className="connection-panel"><div><h2>Your local connection</h2><button aria-label="Close connection details" onClick={() => setSetupOpen(false)}><X size={17} /></button></div><p>{health?.message || 'The local interview service is not connected.'}</p><dl><dt>Model</dt><dd>{health?.model || 'qwen3:4b-instruct'}</dd><dt>Endpoint</dt><dd>{health?.endpoint || 'http://127.0.0.1:11434'}</dd><dt>Voice</dt><dd>{speechPlayer.supported ? speechPlayer.voiceName || 'Available after playback starts' : 'Unavailable in this browser; all dialogue is shown as text.'}</dd></dl>{!health?.installed && <><p>When you install Ollama, run:</p><code>ollama pull {health?.model || 'qwen3:4b-instruct'}</code></>}<button className="interview-secondary" disabled={healthBusy} onClick={refreshHealth}><RotateCcw size={15} className={healthBusy ? 'spin' : ''} /> Check connection</button><small>Facial movement follows speech events with estimated mouth shapes. Voice availability depends on your browser and Windows voices.</small></section>}
    </main>
  </div>;
}
