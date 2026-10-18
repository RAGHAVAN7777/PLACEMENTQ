import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.PLACEMENTIQ_DATA_DIR='server/data/test-runtime/migration';
const folder=new URL('../data/test-runtime/migration/',import.meta.url);
await fs.mkdir(folder,{recursive:true});
const policy={version:'historical-fixture',baselineWeight:.5,interviewWeight:.5};
const old={id:'fixture_assessment',ownerId:'fixture_owner',sessionId:'fixture_session',createdAt:'2026-01-01T00:00:00Z',baseline:{inputs:{cgpa:7},score:60},interview:{reportId:'fixture_report'},policy,result:{composite:{value:70}}};
await fs.writeFile(new URL('placementiq-store.json',folder),JSON.stringify({version:1,sessions:{},assessments:{[old.id]:old},reports:{fixture_report:{improvementTasks:[{id:'fixture_task',title:'Review actual fixture evidence'}]}}}));
const {initStore,getAssessment,getCandidate,saveCandidate}=await import('../src/persistence.mjs');
test('version-one migration preserves historical policy/results and backfills current candidate and tasks',async()=>{
 await initStore();const a=await getAssessment(old.id,old.ownerId);assert.deepEqual(a.policy,policy);assert.deepEqual(a.result,old.result);assert.equal(a.status,'completed');assert.equal(a.tasks[0].completed,false);assert.equal((await getCandidate(old.ownerId)).baselineInputs.cgpa,7);
 await saveCandidate(old.ownerId,{personal:{name:'Current fixture'}});const disk=JSON.parse(await fs.readFile(new URL('placementiq-store.json',folder),'utf8'));assert.equal(disk.version,2);assert.deepEqual(disk.assessments[old.id].baseline,old.baseline);assert.deepEqual(disk.assessments[old.id].policy,policy);
});
