import test from 'node:test';
import assert from 'node:assert/strict';
process.env.PLACEMENTIQ_DATA_DIR='server/data/test-runtime/resume-demo-tests';
process.env.OLLAMA_BASE_URL='http://127.0.0.1:9';
const {structuredResume,validateResumeDetails,reviewDetails}=await import('../src/resume-details.mjs');
const {extractResume}=await import('../src/resume.mjs');
const {pageText}=await import('../src/resume-layout.mjs');
const {createApiServer}=await import('../src/server.mjs');
const {getSession,resetStoreForTests}=await import('../src/persistence.mjs');
const {demoInputs}=await import('../src/demo.mjs');
const source=`Aarav Example\naarav@example.test\n+91 98765 43210\nEducation\nB.Tech Computer Science\nExample University\nCGPA: 8.2/10\nSkills\nTypeScript, React.js, Python, PostgreSQL\nProjects\nStudy Planner: Built a Python task planner.\nTechnologies: Python, PostgreSQL\nExperience\nSoftware Intern at Example Labs\nDeveloped a React dashboard for the team.\nCertifications\nPython Foundations\nAchievements\nCampus hackathon finalist\nLinks\nhttps://github.com/example\nhttps://linkedin.com/in/example`;
test('real PDF columns and DOCX tables preserve sections; empty PDFs require text',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const PDFDocument=require('pdfkit');const JSZip=require('jszip');
 const pdf=async(empty=false)=>new Promise(resolve=>{const doc=new PDFDocument({size:'A4',margin:40});const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));if(!empty){doc.text('Example Candidate',40,35);doc.text('Education\nExample University\nB.Tech Computer Science\nCGPA: 8.2/10',40,100,{width:210});doc.text('Projects\nStudy Planner\nBuilt a Python task planner\nTested SQL queries',330,100,{width:210});}doc.end();});
 const check=text=>{assert.ok(text.indexOf('CGPA')<text.indexOf('Projects'));const d=structuredResume(text);assert.ok(d.projects.some(p=>p.value.includes('Planner')));assert.ok(d.education.every(p=>!p.value.includes('Planner')));};
 check((await extractResume({fileName:'columns.pdf',contentBase64:(await pdf()).toString('base64')},'layout-fixture')).text);
 await assert.rejects(extractResume({fileName:'empty.pdf',contentBase64:(await pdf(true)).toString('base64')}),e=>e.code==='scanned_pdf_or_empty');
 const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const cell=lines=>'<w:tc>'+lines.map(s=>`<w:p><w:r><w:t>${s}</w:t></w:r></w:p>`).join('')+'</w:tc>';
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr>'+cell(['Education','Example University','B.Tech Computer Science','CGPA: 8.2/10'])+cell(['Projects','Study Planner','Built a Python task planner'])+'</w:tr></w:tbl></w:body></w:document>');
 check((await extractResume({fileName:'table.docx',contentBase64:await zip.generateAsync({type:'base64'})},'layout-fixture')).text);
});
test('structured fields preserve sections, exact aliases, missing values, evidence and strict schema',()=>{
 const d=structuredResume(source);assert.equal(d.fields.candidateName.value,'Aarav Example');assert.equal(d.fields.cgpa.value,'8.2/10');assert.equal(d.fields.email.value,'aarav@example.test');assert.ok(d.skills.some(s=>s.value==='TypeScript'));assert.ok(!d.skills.some(s=>s.value==='JavaScript'));assert.ok(!d.projects.some(p=>/dashboard/.test(p.value)));assert.equal(d.certifications.length,1);assert.equal(d.fields.portfolio.value,null);assert.ok(d.domains.every(x=>x.origin==='inferred'));assert.equal(validateResumeDetails(d),d);
 assert.throws(()=>validateResumeDetails({...d,unexpected:true}));assert.throws(()=>validateResumeDetails({...d,fields:{...d.fields,cgpa:{...d.fields.cgpa,value:8.2}}}));
 const edited=structuredClone(d);edited.fields.cgpa.value='9.1/10';const r=reviewDetails(edited,d);assert.equal(r.fields.cgpa.origin,'student-correction');assert.equal(r.fields.email.origin,'explicit');
 const missing=structuredResume('Example Candidate\nSkills\nReact\nExperience\nSoftware Intern at Labs\nDeveloped a small dashboard.');assert.deepEqual(missing.projects,[]);assert.equal(missing.fields.cgpa.value,null);
});
test('two-column coordinates remain column-major rather than mixing education with project prose',()=>{
 const item=(str,x,y,width)=>({str,width,transform:[1,0,0,1,x,y]});
 const items=[item('Example Candidate',40,790,140),...['Education','Example University','B.Tech CSE','CGPA: 8.2/10'].map((s,i)=>item(s,40,740-i*25,140)),...['Projects','Study Planner','Built with Python','Tested SQL queries'].map((s,i)=>item(s,330,740-i*25,150))];
 const text=pageText(items,600);assert.ok(text.indexOf('CGPA')<text.indexOf('Projects'));assert.match(text,/Education\nExample University/);
});
test('owner-scoped content hash caches identical uploads and malformed inputs remain rejected',async()=>{
 const a=await extractResume({pastedText:source},'owner-a');const b=await extractResume({pastedText:source},'owner-a');const c=await extractResume({pastedText:source},'owner-b');assert.equal(a.cacheHit,false);assert.equal(b.cacheHit,true);assert.equal(c.cacheHit,false);assert.equal(a.contentHash,b.contentHash);
 await assert.rejects(extractResume({fileName:'bad.pdf',contentBase64:'%%invalid'}),e=>e.code==='invalid_upload');
 await assert.rejects(extractResume({}),e=>e.code==='resume_required');
 await assert.rejects(extractResume({fileName:'bad.pdf',contentBase64:Buffer.from('not a PDF').toString('base64')}),e=>e.code==='resume_parse_failed');
});
test('stream completion is saved, demo answers are guarded and real candidate data is isolated',async()=>{
 await resetStoreForTests();const server=createApiServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const owner='student_resume_demo_test_aaaaaaaaaaaaaaaa';
 const call=async(path,body,method='POST')=>{const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-PlacementIQ-Owner':owner},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error.message),{status:response.status});return data;};
 try{
  const real=(await call('/api/sessions',{})).session;
  const demo=(await call('/api/demo/sessions',{level:'beginner'})).session;assert.equal(demo.demo.level,'beginner');
  const response=await fetch(`${base}/api/sessions/${demo.id}/resume?stream=1`,{method:'POST',headers:{'Content-Type':'application/json','X-PlacementIQ-Owner':owner},body:JSON.stringify({pastedText:demo.demo.resumeText})});
  const events=(await response.text()).trim().split('\n').map(JSON.parse);assert.deepEqual(events.map(x=>x.stage),['Extracting','Analyzing','Completed']);let s=events.at(-1).session;assert.equal((await getSession(s.id,owner)).status,'github');assert.equal(s.inferenceMetrics.resumeProcessing.llmCalls,0);
  const profile=Object.fromEntries(Object.entries(s.profile).map(([k,v])=>[k,v.map(c=>({...c,confirmed:true}))]));
  s=(await call(`/api/sessions/${s.id}/profile`,{profile,resumeDetails:s.resumeDetails},'PATCH')).session;
  s=(await call(`/api/sessions/${s.id}/github`,{skipped:true})).session;
  await (await fetch(`${base}/api/sessions/${s.id}/analyze`,{method:'POST',headers:{'X-PlacementIQ-Owner':owner}})).text();
  s=(await call(`/api/sessions/${s.id}/start`,{domain:'Python'})).session;
  await assert.rejects(call(`/api/sessions/${real.id}/demo-answer`,{questionId:s.questions[0].id}),e=>e.status===403);
  await assert.rejects(call(`/api/sessions/${s.id}/demo-answer`,{questionId:'stale'}),e=>e.status===409);
  let report;
  while(s.status==='interview') {const q=s.questions[s.questionIndex];const fill=await call(`/api/sessions/${s.id}/demo-answer`,{questionId:q.id});assert.ok(fill.answer.length>20);const out=await call(`/api/sessions/${s.id}/answer`,{questionId:q.id,answer:fill.answer});s=out.session;report=out.report||report;}
  assert.equal(s.status,'completed');assert.ok(report.demo);assert.ok(report.assessment.maxPoints>0);assert.equal(report.assessment.score,Math.round(report.assessment.totalPoints/report.assessment.maxPoints*100));assert.ok(s.followUpsUsed>0,'Existing grader should trigger a partial-answer follow-up');
  assert.deepEqual((await call('/api/reports',undefined,'GET')).reports,[]);assert.deepEqual((await call('/api/assessments',undefined,'GET')).assessments,[]);assert.equal((await getSession(real.id,owner)).status,'resume');assert.equal((await getSession(real.id,owner)).resume,null);
  assert.equal(Object.keys(demoInputs('advanced')).length,23);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
