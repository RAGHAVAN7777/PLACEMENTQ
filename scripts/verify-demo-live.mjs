throw new Error('Historical live demo verification is frozen. Demo Mode now intentionally runs offline; use verify-demo-ui.cjs.');
import fs from 'node:fs/promises';
process.env.PLACEMENTIQ_DATA_DIR='server/data/test-runtime/demo-live';
const {createDemo,demoAnswer}=await import('../server/src/demo.mjs');
const {extractResume}=await import('../server/src/resume.mjs');
const {ingestResume,updateProfile,saveGitHubEvidence,analyzeSession,startInterview,answerQuestion}=await import('../server/src/coordinator.mjs');
const owner='student_demo_live_aaaaaaaaaaaaaaaaaaaaaaaa';const evidence={at:new Date().toISOString(),fixture:'Intermediate fictional demo candidate',steps:[],passed:false};
try{
let s=await createDemo(owner,'intermediate');let at=performance.now();s=await ingestResume(s.id,owner,await extractResume({pastedText:s.demo.resumeText},owner));evidence.steps.push({stage:'resume',ms:performance.now()-at,metrics:s.inferenceMetrics});
const p=Object.fromEntries(Object.entries(s.profile).map(([k,v])=>[k,v.map(c=>({...c,confirmed:true}))]));s=await updateProfile(s.id,owner,p,s.resumeDetails);await saveGitHubEvidence(s.id,owner,[],true);s=await analyzeSession(s.id,owner,()=>{});at=performance.now();s=await startInterview(s.id,owner,s.suggestedDomain);evidence.steps.push({stage:'planning',ms:performance.now()-at,model:s.model});if(!s.model.liveInference)throw new Error('Real Ollama is required for this live verification.');
while(s.status==='interview'){at=performance.now();const q=s.questions[s.questionIndex];const fill=await demoAnswer(s.id,owner,q.id);const result=await answerQuestion(s.id,owner,{questionId:q.id,answer:fill.answer});s=result.session;evidence.steps.push({stage:'answer',bankId:q.bankId,followUp:q.followUp,method:fill.method,grading:result.answer.grade.method,ms:performance.now()-at});console.log(`Completed ${s.answers.length} demo answers`);if(result.report)evidence.result={score:result.report.assessment.score,followUps:s.followUpsUsed,reportDemo:result.report.demo,model:s.model};}
evidence.passed=s.status==='completed';
}catch(e){evidence.error=e.message;process.exitCode=1;}finally{await fs.writeFile('docs/verification/resume-optimization/demo-live.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed:evidence.passed,error:evidence.error,result:evidence.result}));}
