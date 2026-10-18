import test from 'node:test';
import assert from 'node:assert/strict';
process.env.PLACEMENTIQ_DATA_DIR='server/data/test-runtime/startup-reliability';
process.env.OLLAMA_MODEL='fixture:4b';
process.env.OLLAMA_MAX_RETRIES='1';
const {createSession,updateSession,getSession}=await import('../src/persistence.mjs');
const {startInterview,ingestResume,answerQuestion}=await import('../src/coordinator.mjs');
const {generateStructured,inferenceFailure}=await import('../src/ollama.mjs');
const {createDemo,demoAnswer}=await import('../src/demo.mjs');
const owner='student_startup_reliability_aaaaaaaa';
async function ready(demo=false){const s=demo?await createDemo(owner,'beginner'):await createSession(owner);return updateSession(s.id,owner,x=>({...x,status:'domain-selection',domains:[{domain:'Python'}],suggestedDomain:'Python'}));}
function mocked(handler){return async(url,init)=>url.endsWith('/api/tags')?new Response(JSON.stringify({models:[{name:'fixture:4b'}]})):url.endsWith('/api/show')?new Response(JSON.stringify({capabilities:['completion']})):handler(JSON.parse(init.body));}
test('500 CUDA failure is classified without exposing body and is not blindly retried',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=mocked(()=>{calls++;return new Response(JSON.stringify({error:'CUDA error: shared object initialization failed PRIVATE FIXTURE'}),{status:500});});
 const r=await generateStructured({system:'Test',prompt:'Test',schema:{}});assert.equal(r.available,false);assert.equal(calls,1);assert.match(r.error,/CUDA runner/);assert.ok(!r.error.includes('PRIVATE'));assert.equal(inferenceFailure(500,'out of memory').category,'memory_allocation');
 }finally{globalThis.fetch=original;}
});
test('transient failure retries once; failed start releases lock; duplicate and repeated starts preserve questions',async()=>{
 const original=globalThis.fetch;let calls=0;let fail=true;let s=await ready();
 try{globalThis.fetch=mocked(body=>{calls++;if(fail)return new Response('{"error":"runner crashed"}',{status:500});const q=JSON.parse(body.prompt).questions;assert.equal(q.length,1);assert.equal(body.options.num_predict,220);assert.equal(body.options.num_ctx,4096);return new Response(JSON.stringify({response:JSON.stringify({questions:q.map(({bankId})=>({bankId,prompt:'How would you prevent shared mutable Python task state in your project?'}))})}));});
 const fallback=await startInterview(s.id,owner,'Python');assert.equal(fallback.questions[0].generationMethod,'curated-fallback');assert.equal((await startInterview(s.id,owner,'Python')).questions[0].id,fallback.questions[0].id);s=await ready();fail=false;
 const [a,b]=await Promise.all([startInterview(s.id,owner,'Python'),startInterview(s.id,owner,'Python')]);assert.equal(calls,2);assert.deepEqual(a.questions,b.questions);assert.equal((await startInterview(s.id,owner,'SQL')).questions[0].id,a.questions[0].id);assert.equal(calls,2);
 const advanced=await answerQuestion(s.id,owner,{questionId:a.questions[0].id,skipped:true});assert.equal(calls,3);assert.equal(advanced.session.questions[1].generationMethod,'ollama-personalized');
 let retries=0;globalThis.fetch=mocked(()=>++retries===1?new Response('{"error":"temporarily busy"}',{status:503}):new Response('{"response":"{\\"ok\\":true}"}'));
 assert.equal((await generateStructured({system:'test',prompt:'test',schema:{}})).available,true);assert.equal(retries,2);
 }finally{globalThis.fetch=original;}
});
test('demo starts and completes without any Ollama request, including behavioral question and follow-ups',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Offline');};
 try{const real=await ready();const fallback=await startInterview(real.id,owner,'Python');assert.equal(fallback.questions[0].generationMethod,'curated-fallback');assert.ok(new Set(fallback.questions.map(q=>q.domain)).size>=4);calls=0;let s=await ready(true);s=await startInterview(s.id,owner,'Python');assert.ok(s.questions.some(q=>q.domain==='Behavioral'));let report;
 while(s.status==='interview'){const q=s.questions[s.questionIndex];const sample=await demoAnswer(s.id,owner,q.id);const out=await answerQuestion(s.id,owner,{questionId:q.id,answer:sample.answer});s=out.session;report=out.report||report;}
 assert.equal(s.status,'completed');assert.equal(calls,0);assert.ok(s.followUpsUsed>0);assert.ok(report.demo);assert.equal(s.model.liveInference,false);assert.ok(s.answers.every(a=>a.grade.reviewNeeded));
 }finally{globalThis.fetch=original;}
});
test('semantic review only runs for ambiguous non-demo extraction and can be disabled',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=mocked(()=>{calls++;return new Response('{"response":"{\\"skills\\":[],\\"projects\\":[],\\"education\\":[],\\"experience\\":[],\\"strengths\\":[]}"}');});
 const text='Example Candidate\nSkills\nPython\nProjects\nStudy Planner: Built a Python task planner with unit tests.';
 try{let s=await createSession(owner);await ingestResume(s.id,owner,{text},{semantic:true});assert.equal(calls,0);
 s=await createDemo(owner,'beginner');await ingestResume(s.id,owner,{text:'An ambiguous paragraph without recognized section headings and some Python experience.'},{semantic:true});assert.equal(calls,0);
 s=await createSession(owner);await ingestResume(s.id,owner,{text:'An ambiguous paragraph without recognized section headings and some Python experience.'},{semantic:false});assert.equal(calls,0);
 s=await createSession(owner);await ingestResume(s.id,owner,{text:'An ambiguous paragraph without recognized section headings and some Python experience.'},{semantic:true});assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
test('all three demo profiles complete their derived domains with prepared answers offline',async()=>{
 const {updateProfile,saveGitHubEvidence,analyzeSession}=await import('../src/coordinator.mjs');
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Offline');};
 try{for(const level of ['beginner','intermediate','advanced']){
   let s=await createDemo(owner,level);s=await ingestResume(s.id,owner,{text:s.demo.resumeText});
   const profile=Object.fromEntries(Object.entries(s.profile).map(([k,v])=>[k,v.map(c=>({...c,confirmed:true}))]));
   await updateProfile(s.id,owner,profile,s.resumeDetails);await saveGitHubEvidence(s.id,owner,[],true);s=await analyzeSession(s.id,owner,()=>{});s=await startInterview(s.id,owner,s.suggestedDomain);
   while(s.status==='interview'){const q=s.questions[s.questionIndex];const fill=await demoAnswer(s.id,owner,q.id);assert.equal(fill.method,'prepared-demo-answer');s=(await answerQuestion(s.id,owner,{questionId:q.id,answer:fill.answer})).session;}
   assert.equal(s.status,'completed');
 }assert.equal(calls,0);}finally{globalThis.fetch=original;}
});

test('unified demo exposes technical domains before confirmation or interview start',async()=>{
 const {saveGitHubEvidence,analyzeSession}=await import('../src/coordinator.mjs');
 for(const level of ['beginner','intermediate','advanced']){
  let s=await createDemo(owner,level,{unified:true});
  s=await ingestResume(s.id,owner,{text:s.demo.resumeText});
  assert.equal(s.status,'github');assert.ok(s.profile.skills.every(c=>!c.confirmed));
  await saveGitHubEvidence(s.id,owner,[],true);s=await analyzeSession(s.id,owner,()=>{});
  assert.ok(s.domains.some(d=>d.domain==='Python'),level);
  assert.ok(s.domains.some(d=>d.domain==='SQL'),level);
  assert.notEqual(s.suggestedDomain,'Project explanation',level);
  assert.equal(s.questions.length,0);
 }
});
