import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.PLACEMENTIQ_DATA_DIR='server/data/test-runtime/unified';
process.env.OLLAMA_BASE_URL='http://127.0.0.1:9';
process.env.OLLAMA_MAX_RETRIES='0';
const {createApiServer}=await import('../src/server.mjs');
const {resetStoreForTests,getSession,getAssessment}=await import('../src/persistence.mjs');
const {demoInputs}=await import('../src/demo.mjs');
const {config}=await import('../src/config.mjs');
const {compareReadiness}=await import('../src/readiness-policy.mjs');
test('unified verification gate, real model snapshot, offline demo, idempotency, history, scenario and persistent plan',async()=>{
 await resetStoreForTests();const server=createApiServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const owner='student_unified_test_aaaaaaaaaaaa';const call=async(path,method='GET',body)=>{const r=await fetch(base+'/api'+path,{method,headers:{'X-PlacementIQ-Owner':owner,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,...await r.json()};};
 async function prepare(demo){let s=(await call(demo?'/demo/sessions':'/sessions','POST',demo?{level:'intermediate'}:{})).session;s=(await call(`/sessions/${s.id}/resume`,'POST',{pastedText:demo?s.demo.resumeText:'Example Candidate\nEducation\nB.Tech Computer Science, CGPA: 8.2/10\nSkills\nPython, SQL\nProjects\nStudy Planner: Built a Python task planner with tests.',semantic:false})).session;assert.equal(s.status,'github');await call(`/sessions/${s.id}/github`,'POST',{skipped:true});await (await fetch(base+`/api/sessions/${s.id}/analyze`,{method:'POST',headers:{'X-PlacementIQ-Owner':owner}})).text();return (await call(`/sessions/${s.id}`)).session;}
 try{
 const real=await prepare(false);assert.equal((await call(`/sessions/${real.id}/start`,'POST',{domain:'Python'})).status,409);
 assert.equal((await call('/assessments','POST',{sessionId:real.id,confirmed:true,inputs:demoInputs('beginner')})).status,409);
 const profile=Object.fromEntries(Object.entries(real.profile).map(([k,v])=>[k,v.map(c=>({...c,confirmed:true}))]));
 await call(`/sessions/${real.id}/profile`,'PATCH',{profile,resumeDetails:real.resumeDetails});
 assert.equal((await call('/assessments','POST',{sessionId:real.id,confirmed:true,inputs:{cgpa:8}})).status,400);
 const started=performance.now();const result=await call('/assessments','POST',{sessionId:real.id,confirmed:true,inputs:demoInputs('beginner')});assert.equal(result.status,201);const record=result.assessment;
 console.log('unified_baseline_ms',Math.round(performance.now()-started));assert.equal(record.result.composite,null);assert.equal(record.baseline.featureOrder.length,31);assert.equal(Object.keys(record.baseline.inputs).length,23);assert.equal(record.policy.baselineWeight,.4);assert.equal(record.policy.interviewWeight,.6);
 assert.equal((await call('/assessments','POST',{sessionId:real.id,confirmed:true,inputs:demoInputs('advanced')})).status,409);
 assert.equal((await call(`/sessions/${real.id}/profile`,'PATCH',{profile})).status,409);
 const first=(await call(`/sessions/${real.id}/start`,'POST',{domain:'Python'})).session;assert.equal(first.questions[0].generationMethod,'curated-fallback');assert.equal((await call(`/sessions/${real.id}/start`,'POST',{domain:'SQL'})).session.questions[0].id,first.questions[0].id);
 const candidate=(await call('/candidate')).candidate;assert.ok(candidate.version>0);
 await call('/candidate','PATCH',{personal:{name:'Updated Current Name',githubUrl:'https://github.com/example'}});assert.equal((await call(`/assessments/${record.id}`)).assessment.candidateSnapshot.name,record.candidateSnapshot.name);
 const hypothetical=await call('/baseline/explain','POST',{inputs:{...record.baseline.inputs,cgpa:9}});assert.equal(hypothetical.status,200);assert.deepEqual((await call(`/assessments/${record.id}`)).assessment.baseline,record.baseline);
 let s=await prepare(true);const start=performance.now();s=(await call(`/sessions/${s.id}/start`,'POST',{domain:'Python'})).session;assert.ok(s.baselineReady);const demoRecord=await getAssessment(s.assessmentId,owner);assert.ok(demoRecord.baseline);assert.equal(demoRecord.result.composite,null);let report;
 while(s.status==='interview'){const q=s.questions[s.questionIndex];const answer=(await call(`/sessions/${s.id}/demo-answer`,'POST',{questionId:q.id})).answer;const out=await call(`/sessions/${s.id}/answer`,'POST',{questionId:q.id,answer});assert.equal(out.status,200);s=out.session;report=out.report||report;}
 console.log('unified_offline_demo_ms',Math.round(performance.now()-start));assert.equal(s.status,'completed');const done=(await call(`/assessments/${s.assessmentId}`)).assessment;assert.equal(done.interview.reportId,report.id);assert.ok(done.result.composite);assert.equal(done.result.composite.value,Number((.4*done.baseline.score+.6*done.interview.score).toFixed(2)));
 await call(`/sessions/${s.id}/report`,'POST',{});assert.deepEqual((await call(`/assessments/${s.assessmentId}`)).assessment,done);
 const task=done.tasks[0];assert.ok(task);assert.equal((await call(`/assessments/${done.id}/tasks/${task.id}`,'PATCH',{completed:true})).assessment.tasks[0].completed,true);
 const saved=JSON.parse(await fs.readFile(config.dataDir+'/placementiq-store.json','utf8'));assert.equal(saved.version,2);assert.equal(saved.sessions[s.id].status,'completed');assert.equal(saved.assessments[done.id].tasks[0].completed,true);assert.ok(saved.reports[report.id]);
 assert.equal((await call('/assessments')).assessments.length,1);assert.equal((await call('/reports')).reports.length,0);assert.equal((await call('/candidate')).candidate.personal.name,'Updated Current Name');assert.equal((await getSession(real.id,owner)).status,'interview');
 }finally{await new Promise(r=>server.close(r));}
});
