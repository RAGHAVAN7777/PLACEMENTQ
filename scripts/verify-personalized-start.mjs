import fs from 'node:fs/promises';
process.env.PLACEMENTIQ_DATA_DIR='server/data/test-runtime/personalized-start';
const {createSession,updateSession}=await import('../server/src/persistence.mjs');
const {startInterview,answerQuestion}=await import('../server/src/coordinator.mjs');
const owner='student_personalized_smoke_aaaaaaaa';
const evidence={at:new Date().toISOString(),fixture:'Fictional Python task planner, normal interview code path',passed:false};
try{
 let s=await createSession(owner);s=await updateSession(s.id,owner,x=>({...x,status:'domain-selection',domains:[{domain:'Python'}],suggestedDomain:'Python',profile:{...x.profile,skills:[{name:'Python',confirmed:true,sourcePassage:'Python'}],projects:[{name:'Study Planner',confirmed:true,sourcePassage:'Built a Python task planner that saves tasks to files and uses per-user lists.'}]}}));
 const at=performance.now();s=await startInterview(s.id,owner,'Python');evidence.startMs=Math.round(performance.now()-at);evidence.first={prompt:s.questions[0].prompt,method:s.questions[0].generationMethod,metrics:s.inferenceMetrics.questionPlanning};
 const nextAt=performance.now();s=(await answerQuestion(s.id,owner,{questionId:s.questions[0].id,skipped:true})).session;evidence.nextMs=Math.round(performance.now()-nextAt);evidence.second={prompt:s.questions[1].prompt,method:s.questions[1].generationMethod,metrics:s.inferenceMetrics[`question_${s.questions[1].id}`]};
 evidence.passed=s.questions.slice(0,2).every(q=>q.generationMethod==='ollama-personalized'&&q.prompt.length>=25);evidence.note='Live first and second personalized questions; skip transition, not a complete live grading benchmark.';
}catch(e){evidence.error=e.message;process.exitCode=1;}finally{await fs.writeFile('docs/verification/resume-optimization/personalized-start.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));}
