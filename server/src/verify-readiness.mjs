import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.PLACEMENTIQ_DATA_DIR = `server/data/test-runtime/readiness-${Date.now()}`;
process.env.READINESS_INTERVIEW_THRESHOLD = '90'; // Deliberate policy override to compare real saved 88 and 100 scores.
const { baselineInference } = await import('./baseline.mjs');
const { compareReadiness, readinessPolicy } = await import('./readiness-policy.mjs');
const { integrateInterview } = await import('./readiness.mjs');
const { createApiServer } = await import('./server.mjs');
const { getAssessment } = await import('./persistence.mjs');
const runtime = JSON.parse(await fs.readFile(new URL('../data/runtime/placementiq-store.json', import.meta.url)));
const highReport = Object.values(runtime.reports).find(r => r.id === 'report_0793e12e-19de-4d15-a57e-c7b80e6d4005');
const lowReport = Object.values(runtime.reports).find(r => r.id === 'report_2aaaa595-1eeb-4f05-8107-e7c01889e60b');
assert.ok(highReport && lowReport, 'Real saved verification interviews must exist');
const high = {age:22,gender:'Male',cgpa:9,branch:'CSE',college_tier:'Tier 1',internships_count:4,projects_count:6,certifications_count:3,coding_skill_score:90,aptitude_score:90,communication_skill_score:85,logical_reasoning_score:90,hackathons_participated:4,github_repos:8,linkedin_connections:500,mock_interview_score:85,attendance_percentage:95,backlogs:0,extracurricular_score:70,leadership_score:75,volunteer_experience:'Yes',sleep_hours:7,study_hours_per_day:5};
const low = {...high,cgpa:5,internships_count:0,projects_count:1,coding_skill_score:30,aptitude_score:35,logical_reasoning_score:35,mock_interview_score:30,backlogs:3,attendance_percentage:60};
const proof = {runAt:new Date().toISOString(),note:'Fictional baseline inputs with actual saved-model inference. Matrix scenarios use real saved interview scores 100 and 88 with a visible test threshold of 90; production default remains 65. No live report marks are altered.',policy:readinessPolicy,checks:[]};
const server=createApiServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const owner='student_readiness_acceptance_20261004';
async function call(route,body,status=200,who=owner){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-PlacementIQ-Owner':who},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
try {
 const before=await fs.readFile(new URL('../../ml/models/placement_model.joblib',import.meta.url));
 const a=(await call('/api/assessments',{inputs:high,confirmed:true},201)).assessment;
 const b=(await call('/api/assessments',{inputs:low,confirmed:true},201)).assessment;
 assert.ok(a.baseline.score>=50 && b.baseline.score<50);
 proof.baselines=[a.baseline,b.baseline];
 const expectations=['Placement Ready','Profile Strong, Interview Preparation Required','Demonstrated Skill Strong, Profile Improvement Required','Structured Readiness Development Required'];
 let n=0;for(const baseline of [a.baseline,b.baseline])for(const report of [highReport,lowReport]){const result=compareReadiness(baseline,report,readinessPolicy);assert.equal(result.category,expectations[n++]);proof.checks.push({category:result.category,baseline:baseline.score,interview:report.assessment.score,sourceReport:report.id});}
 assert.equal(a.result.status,'missing-interview');proof.checks.push('Missing interview remains pending');
 assert.equal(compareReadiness(null,highReport,readinessPolicy).status,'missing-baseline');proof.checks.push('Missing baseline remains pending');
 for(const inputs of [null,[],{...high,agent_interview_score:99},{...high,cgpa:null},{...high,age:22.5},{...high,branch:'Other'},{}])await call('/api/assessments',{inputs,confirmed:true},400);
 await call('/api/assessments',{inputs:high,confirmed:false},400);proof.checks.push('Invalid, incomplete, unconfirmed and unknown-category inputs rejected');
 const insufficient=Object.values(runtime.reports).find(r=>r.assessment.skills.some(s=>s.result==='insufficient evidence'));
 assert.equal(compareReadiness(a.baseline,insufficient,readinessPolicy).status,'insufficient-evidence');proof.checks.push('Real insufficient-evidence interview withheld from matrix');
 const integrated=await integrateInterview({...highReport,ownerId:owner,sessionId:a.sessionId});
 const restored=(await call(`/api/assessments/${integrated.id}`)).assessment;
 assert.equal(restored.interview.reportId,highReport.id);assert.equal(restored.result.category,'Placement Ready');
 assert.deepEqual((await getAssessment(integrated.id,owner)).policy,readinessPolicy); const onDisk=JSON.parse(await fs.readFile(new URL(`../../${process.env.PLACEMENTIQ_DATA_DIR}/placementiq-store.json`,import.meta.url))); assert.equal(onDisk.assessments[integrated.id].interview.reportId,highReport.id);proof.checks.push('Saved result and original policy reload identically');
 const started=(await call(`/api/assessments/${integrated.id}/prepare`,{})).assessment;
 assert.equal(started.preparation.status,'started');assert.ok(started.timeline.some(e=>e.stage==='start-preparation'));
 assert.equal((await call('/api/assessments')).assessments.length,2);assert.notEqual(a.id,b.id);proof.checks.push('Second assessment preserves first; preparation persists');
 await call(`/api/assessments/${a.id}`,undefined,404,'student_other_readiness_test_20261004');
 await call('/api/assessments',{inputs:high,confirmed:true,sessionId:a.sessionId},409);proof.checks.push('Ownership and immutable baseline enforced');
 assert.deepEqual(await fs.readFile(new URL('../../ml/models/placement_model.joblib',import.meta.url)),before);
 proof.passed=true;proof.dataDir=process.env.PLACEMENTIQ_DATA_DIR;
 console.log(JSON.stringify(proof.checks,null,2));
 await fs.writeFile(new URL('../../docs/verification/readiness-inputs.json',import.meta.url),JSON.stringify({high,low},null,2));
} catch(error){proof.passed=false;proof.error=error.message;process.exitCode=1;console.error(error);}
finally{await fs.writeFile(new URL('../../docs/verification/readiness-acceptance.json',import.meta.url),JSON.stringify(proof,null,2));await new Promise(r=>server.close(r));}
