import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { config } from './config.mjs';
import { HttpError } from './security.mjs';
import { extractResume as parseText } from './resume-parser.mjs';
const cache=new Map(), pending=new Map(), workers=[], jobs=[];
const VERSION='layout-2';
function drain() {
  while(jobs.length) {
    let slot=workers.find(s=>!s.busy);
    if(!slot && workers.length<2) {
      const worker=new Worker(new URL('./resume-worker.mjs',import.meta.url));
      slot={worker,busy:false};workers.push(slot);worker.unref();
    }
    if(!slot) return;
    const job=jobs.shift();slot.busy=true;slot.worker.ref();
    const finish=(error,result)=>{
      clearTimeout(timer);slot.worker.removeAllListeners('message');slot.worker.removeAllListeners('error');
      slot.busy=false;slot.worker.unref();
      if(error) job.reject(error); else job.resolve(result);
      drain();
    };
    const timer=setTimeout(()=>{workers.splice(workers.indexOf(slot),1);void slot.worker.terminate();finish(new HttpError(422,'Resume parsing timed out. Paste the text instead.','resume_timeout'));},20000);
    slot.worker.once('message',m=>finish(m.error?new HttpError(m.error.status,m.error.message,m.error.code):null,m.result));
    slot.worker.once('error',()=>{workers.splice(workers.indexOf(slot),1);finish(new HttpError(422,'The parser could not read this file. Paste text instead.','resume_parse_failed'));});
    slot.worker.postMessage(job.payload);
  }
}
export async function extractResume(payload, scope='local') {
  const start=performance.now();
  if(typeof payload?.contentBase64==='string' && payload.contentBase64.length>Math.ceil(config.maxResumeBytes*4/3)+4) throw new HttpError(413,'Resume files must be 8 MB or smaller.','resume_too_large');
  const pasted=typeof payload?.pastedText==='string' && payload.pastedText.trim();
  if(!pasted && (typeof payload?.contentBase64!=='string'||!payload.contentBase64))throw new HttpError(400,'Choose a PDF or DOCX, or paste resume text.','resume_required');
  if(!pasted && (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload.contentBase64)||payload.contentBase64.length%4===1))throw new HttpError(400,'The uploaded file could not be decoded.','invalid_upload');
  const content=pasted?payload.pastedText:payload?.contentBase64 || '';
  const hash=createHash('sha256').update(pasted?content:Buffer.from(content,'base64')).digest('hex');
  const key=`${scope}:${VERSION}:${pasted?'text':String(payload?.mimeType)+':'+String(payload?.fileName).split('.').pop()}:${hash}`;
  const hit=cache.get(key);
  if(hit && Date.now()-hit.at<15*60*1000) return {...structuredClone(hit.value),fileName:payload.fileName || hit.value.fileName,cacheHit:true,parseMs:Math.round(performance.now()-start)};
  if(jobs.length>=12) throw new HttpError(429,'Resume parser is busy. Retry shortly.','parser_busy');
  const reused=pending.has(key);
  if(!reused) {
    const task=pasted?parseText(payload):new Promise((resolve,reject)=>{jobs.push({payload,resolve,reject});drain();});
    pending.set(key,task);
  }
  try {
    const result=await pending.get(key);
    if(cache.size>=32) cache.delete(cache.keys().next().value);
    cache.set(key,{at:Date.now(),value:{...result,contentHash:hash}});
    return {...structuredClone(result),contentHash:hash,cacheHit:reused,parseMs:Math.round(performance.now()-start)};
  } finally {pending.delete(key);}
}
