import type { ResumeDetails } from '../../services/interviewApi';
export default function ResumeDetailsReview({details,busy,onChange}:{details:ResumeDetails;busy:boolean;onChange:(details:ResumeDetails)=>void}) {
 const labels:Record<string,string>={candidateName:'Candidate name',email:'Email',phone:'Phone',degree:'Degree',institution:'College / university',cgpa:'CGPA (as written)',percentage:'Percentage',github:'GitHub',linkedin:'LinkedIn',portfolio:'Portfolio'};
 return <details className="resume-details" open><summary>Contact, education and additional details</summary>
 <p>Empty means not mentioned. Confidence reflects extraction evidence, not proficiency. Inferred domains are labelled separately.</p>
 <div className="resume-fields">{Object.entries(details.fields).map(([key,f])=><label key={key}>{labels[key]||key}<input value={f.value||''} placeholder="Not Mentioned" disabled={busy} onChange={e=>onChange({...details,fields:{...details.fields,[key]:{...f,value:e.target.value||null,origin:'student-correction',confidence:'student-reviewed'}}})}/><small>{f.origin} · {f.confidence}</small></label>)}</div>
 {(['certifications','achievements'] as const).map(key=><div key={key}><h3>{key}</h3>{details[key].map((f,i)=><label key={i}>{key} {i+1}<textarea disabled={busy} value={f.value||''} onChange={e=>onChange({...details,[key]:details[key].map((v,j)=>i===j?{...v,value:e.target.value,origin:'student-correction',confidence:'student-reviewed'}:v)})}/><small>{f.origin} · {f.confidence}</small><button disabled={busy} onClick={()=>onChange({...details,[key]:details[key].filter((_,j)=>j!==i)})}>Remove</button></label>)}<button disabled={busy||details[key].length>=24} onClick={()=>onChange({...details,[key]:[...details[key],{value:'',sourcePassage:'Supplied during review.',origin:'student-correction',confidence:'student-reviewed'}]})}>Add {key==='certifications'?'certification':'achievement'}</button></div>)}
 <p>Languages: {details.languages.map(f=>f.value).join(', ')||'Not Mentioned'}</p><p>Possible domains (inferred): {details.domains.map(f=>f.value).join(', ')||'Not Mentioned'}</p>
 {details.warnings.map(w=><p className="voice-notice" key={w}>{w}</p>)}
 </details>;
}
