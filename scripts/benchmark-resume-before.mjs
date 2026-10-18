throw new Error('Historical baseline is frozen in docs/verification/resume-optimization/before.json. Run benchmark-resume.mjs for the current implementation.');
import fs from 'node:fs/promises';
process.env.PLACEMENTIQ_DATA_DIR='server/data/test-runtime/resume-before';
const {extractResume}=await import('../server/src/resume.mjs');
const {createSession}=await import('../server/src/persistence.mjs');
const {ingestResume}=await import('../server/src/coordinator.mjs');
const text='Aarav Example\naarav@example.test\nEducation\nB.Tech Computer Science, Example University\nCGPA: 8.2/10\nSkills\nPython, SQL, React, JavaScript\nProjects\nStudy Planner: Built a Python and SQL task planner with unit tests.\nExperience\nSoftware Intern at Fictional Labs: Tested REST endpoints.';
const start=performance.now(); const resume=await extractResume({pastedText:text});const parsed=performance.now();const session=await createSession('student_benchmark_aaaaaaaaaaaaaaaaaaaaaaaa');const result=await ingestResume(session.id,session.ownerId,resume);
const out={at:new Date().toISOString(),fixture:'Fictional plain-text resume',parsingMs:parsed-start,totalMs:performance.now()-start,model:result.model,metrics:result.inferenceMetrics};await fs.writeFile('docs/verification/resume-optimization/before.json',JSON.stringify(out,null,2));console.log(JSON.stringify({totalMs:out.totalMs,metrics:out.metrics}));
