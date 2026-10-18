import { createHash } from 'node:crypto';
import { HttpError } from './security.mjs';
export const RESUME_VERSION='structured-2';
export const FIELD_KEYS=['candidateName','email','phone','degree','institution','cgpa','percentage','github','linkedin','portfolio'];
export const LIST_KEYS=['languages','skills','education','projects','experience','certifications','achievements','domains'];
const aliases=[['Python',/\bpython\b/i],['JavaScript',/\bjavascript\b|(?<![.\w])js\b/i],['TypeScript',/\b(?:typescript|ts)\b/i],['Java',/\bjava\b/i],['C++',/\bc\+\+(?!\w)/i],['C#',/\bc#(?!\w)/i],['SQL',/\bsql\b/i],['Go',/\bgolang\b/i],['Rust',/\brust\b/i],['React',/\breact(?:js|\.js)?\b/i],['Node.js',/\bnode(?:js|\.js)\b/i],['PostgreSQL',/\b(?:postgresql|postgres)\b/i],['MySQL',/\bmysql\b/i],['SQLite',/\bsqlite\b/i],['Git',/\bgit\b/i],['Docker',/\bdocker\b/i],['AWS',/\baws\b/i],['HTML',/\bhtml\b/i],['CSS',/\bcss\b/i],['pandas',/\bpandas\b/i],['NumPy',/\bnumpy\b/i],['scikit-learn',/\b(?:scikit[- ]learn|sklearn)\b/i],['TensorFlow',/\btensorflow\b/i],['PyTorch',/\bpytorch\b/i],['FastAPI',/\bfastapi\b/i],['Flask',/\bflask\b/i],['Django',/\bdjango\b/i],['Machine learning',/\bmachine learning\b/i],['Data analysis',/\bdata analysis\b/i],['Kubernetes',/\bkubernetes\b/i]];
const headings={education:/^(education|academic(?: background| qualifications)?|qualifications)$/i,projects:/^(?:academic |personal |technical |selected )?projects?$/i,experience:/^(?:(?:work|professional|relevant) )?experience$|^internships?$|^employment$/i,skills:/^(?:(?:technical|core|programming) )?skills$|^technologies$|^programming languages$/i,certifications:/^certifications?$|^licenses?(?: and certifications)?$/i,achievements:/^achievements?$|^awards?$|^hackathons?$/i,other:/^summary$|^profile$|^objective$|^interests$|^activities$/i};
const evidence=(value,sourcePassage,confidence='high',origin='explicit')=>({value,sourcePassage,origin,confidence});
const empty=()=>Object.fromEntries(FIELD_KEYS.map(k=>[k,evidence(null,'','none')]));
const fieldSchema={type:'object',additionalProperties:false,required:['value','sourcePassage','origin','confidence'],properties:{value:{type:['string','null'],maxLength:2000},sourcePassage:{type:'string',maxLength:3000},origin:{enum:['explicit','inferred','student-correction']},confidence:{enum:['high','medium','low','none','student-reviewed']}}};
export const RESUME_SCHEMA={type:'object',additionalProperties:false,required:['version','fields',...LIST_KEYS,'warnings'],properties:{version:{const:RESUME_VERSION},fields:{type:'object',additionalProperties:false,required:FIELD_KEYS,properties:Object.fromEntries(FIELD_KEYS.map(k=>[k,fieldSchema]))},...Object.fromEntries(LIST_KEYS.map(k=>[k,{type:'array',maxItems:24,items:fieldSchema}])),warnings:{type:'array',maxItems:30,items:{type:'string',maxLength:400}}}};
export function validateResumeDetails(input) {
  const exact=(o,keys)=>o && typeof o==='object' && !Array.isArray(o) && Object.keys(o).length===keys.length && keys.every(k=>Object.hasOwn(o,k));
  const validField=f=>exact(f,['value','sourcePassage','origin','confidence'])&&(f.value===null || typeof f.value==='string'&&f.value.length<=2000)&&typeof f.sourcePassage==='string'&&f.sourcePassage.length<=3000&&fieldSchema.properties.origin.enum.includes(f.origin)&&fieldSchema.properties.confidence.enum.includes(f.confidence);
  if(!exact(input,['version','fields',...LIST_KEYS,'warnings'])||input.version!==RESUME_VERSION||!exact(input.fields,FIELD_KEYS)||!FIELD_KEYS.every(k=>validField(input.fields[k]))||!LIST_KEYS.every(k=>Array.isArray(input[k])&&input[k].length<=24&&input[k].every(validField))||!Array.isArray(input.warnings)||input.warnings.length>30||input.warnings.some(x=>typeof x!=='string'||x.length>400)) throw new HttpError(400,'Resume details do not match the structured schema.','invalid_resume_details');
  return input;
}
export function structuredResume(text) {
  const out={version:RESUME_VERSION,fields:empty(),...Object.fromEntries(LIST_KEYS.map(k=>[k,[]])),warnings:[]};
  const lines=text.split(/\r?\n/).map(x=>x.trim());
  const sections={};let section='other',duplicates=0;
  const seen=new Set();
  for(const raw of lines) {
    const line=raw.replace(/^[•●▪]\s*/,'');
    const part=line.match(/^([^:]{2,40}):\s*(.*)$/);
    const key=Object.keys(headings).find(k=>headings[k].test((part?part[1]:line).trim()));
    if(key && !(section==='projects' && part && /^(technologies|tech stack)$/i.test(part[1]))) {section=key;if(!sections[section])sections[section]=[];if(part?.[2])sections[section].push(part[2]);continue;}
    if(!sections[section])sections[section]=[];
    if(!line){sections[section].push('');continue;}
    const norm=line.toLowerCase().replace(/\s+/g,' ');
    if(seen.has(norm)){duplicates++;continue;}seen.add(norm);
    sections[section].push(line);
  }
  const pick=(key,regex)=>{const matches=[...text.matchAll(new RegExp(regex.source,regex.flags.includes('g')?regex.flags:regex.flags+'g'))];if(matches[0])out.fields[key]=evidence(matches[0][1]||matches[0][0],matches[0][0]);if(new Set(matches.map(m=>m[1]||m[0])).size>1)out.warnings.push(`Multiple ${key} values found; review the selected value.`);};
  pick('email',/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  pick('phone',/(?<!\w)(\+?\d[\d ().-]{7,20}\d)(?!\w)/);
  if(out.fields.phone.value && out.fields.phone.value.replace(/\D/g,'').length<10)out.fields.phone=evidence(null,'','none');
  pick('cgpa',/\b(?:c?gpa)\s*[:=\-]?\s*(\d+(?:\.\d+)?(?:\s*(?:\/|out of)\s*\d+)?)\b/i);
  pick('percentage',/\b(?:percentage|aggregate|marks)\s*[:=\-]?\s*(\d+(?:\.\d+)?\s*%)/i);
  pick('github',/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_.\/-]+/i);
  pick('linkedin',/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[A-Za-z0-9_.\/-]+/i);
  pick('portfolio',/(?:portfolio|website)\s*[:\-]?\s*((?:https?:\/\/|www\.)[^\s,]+)/i);
  const first=lines.filter(x=>x&&!/^(resume|curriculum vitae)$/i.test(x))[0];
  if(first && !Object.values(headings).some(rx=>rx.test(first)) && /^[\p{L}][\p{L} .'-]{2,65}$/u.test(first)&&first.split(/\s+/).length>=2&&first.split(/\s+/).length<=5)out.fields.candidateName=evidence(first,first,'medium');
  const education=(sections.education||[]).join('\n');
  const deg=education.match(/\b(?:B\.?\s?Tech|M\.?\s?Tech|B\.?\s?E\.?|M\.?\s?E\.?|B\.?Sc|M\.?Sc|BCA|MCA|Bachelor[^\n,;]*|Master[^\n,;]*|Ph\.?D)(?:[^\n,;]{0,65})/i);
  if(deg)out.fields.degree=evidence(deg[0],deg[0]);
  const inst=(sections.education||lines).find(x=>/\b(university|college|institute|IIT|NIT)\b/i.test(x));
  if(inst)out.fields.institution=evidence(inst,inst,'medium');
  for(const [name,rx] of aliases) {const line=lines.find(l=>rx.test(l));if(line){const f=evidence(name,line);out.skills.push(f);if(['Python','JavaScript','TypeScript','Java','C++','C#','SQL','Go','Rust'].includes(name))out.languages.push({...f});}}
  out.skills=out.skills.slice(0,24);
  for(const key of ['education','projects','experience','certifications','achievements']) {
    const src=sections[key]||[];let groups=[],current=[];
    for(const line of src) {
      if(!line){if(current.length)groups.push(current.join('\n'));current=[];continue;}
      if(current.length && !/^(technologies|tech stack|description)\s*:/i.test(line) && /^[A-Z][^:]{2,70}:/.test(line)){groups.push(current.join('\n'));current=[];}
      current.push(line);
    }
    if(current.length)groups.push(current.join('\n'));
    if(!groups.length && !Object.keys(sections).some(k=>k!=='other'))groups=lines.filter(l=> key==='projects'?/\b(built|developed|implemented|created)\b/i.test(l)&&!/\b(intern|worked|employment)\b/i.test(l):key==='education'?/\b(B\.?Tech|Bachelor|University|College|CGPA)\b/i.test(l):key==='experience'?/\b(intern(?:ship)?|worked at|engineer at|developer at)\b/i.test(l):key==='certifications'?/\b(certified|certification)\b/i.test(l):/\b(hackathon|awarded|winner)\b/i.test(l));
    out[key]=groups.filter(x=>!/^\s*(?:none|not mentioned|no (?:internships?|experience|projects?))\.?\s*$/i.test(x)).slice(0,12).map(x=>evidence(x.slice(0,2000),x.slice(0,3000),'medium'));
  }
  for(const [name,rx] of [['Machine learning',/\b(machine learning|scikit[- ]learn|pytorch)\b/i],['Frontend',/\b(react|html|css|frontend)\b/i],['Backend',/\b(fastapi|django|node\.js|backend)\b/i],['Data analysis',/\b(pandas|tableau|data analysis)\b/i],['Cloud & DevOps',/\b(docker|kubernetes|aws|devops)\b/i]]) {const line=lines.find(l=>rx.test(l));if(line)out.domains.push(evidence(name,line,'medium','inferred'));}
  if(duplicates)out.warnings.push(`${duplicates} duplicate lines removed.`);
  if(!Object.keys(sections).some(k=>k!=='other'))out.warnings.push('Section headings were not recognized. Review category assignments; optional semantic analysis is available.');
  out.warnings.push('Layout and name detection are heuristic. Confirm extracted details before interview use.');
  return validateResumeDetails(out);
}
export function detailsToProfile(details) {
  const claim=(item,key)=>({id:`${key}_${createHash('sha256').update(item.value+item.sourcePassage).digest('hex').slice(0,16)}`,name:item.value.slice(0,160),sourcePassage:item.sourcePassage.slice(0,700),origin:'resume',confidence:item.confidence,confirmed:false});
  return Object.fromEntries(['skills','projects','education','experience','strengths'].map(k=>[k,(details[k]||[]).slice(0,k==='skills'?24:12).map(x=>claim(x,k))]));
}
export function reviewDetails(proposed,previous) {
  validateResumeDetails(proposed);
  const review=(f,old)=>old&&f.value===old.value&&f.sourcePassage===old.sourcePassage?{...old}:{...f,origin:'student-correction',confidence:'student-reviewed',sourcePassage:'Supplied during candidate review.'};
  return {...proposed,fields:Object.fromEntries(FIELD_KEYS.map(k=>[k,review(proposed.fields[k],previous?.fields[k])])),...Object.fromEntries(LIST_KEYS.map(k=>[k,proposed[k].map(f=>review(f,previous?.[k]?.find(o=>o.value===f.value&&o.sourcePassage===f.sourcePassage)))])),warnings:previous?.warnings||[]};
}
