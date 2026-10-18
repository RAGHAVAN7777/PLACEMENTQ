import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react';
import type { EvidenceClaim, InterviewSession } from '../../services/interviewApi';

type Category = keyof InterviewSession['profile'];
const labels: Record<Category, string> = { skills: 'Skills', projects: 'Projects', education: 'Education', experience: 'Experience', strengths: 'Strengths' };
interface Props {
  profile: InterviewSession['profile']; busy: boolean;
  onChange: (category: Category, index: number, changes: Partial<EvidenceClaim>) => void;
  onRemove: (category: Category, index: number) => void;
  onAdd: (category: Category) => void;
  onConfirmAll: () => void; onContinue: () => void;
}
export default function ProfileReview({profile,busy,onChange,onRemove,onAdd,onConfirmAll,onContinue}: Props) {
  const [category,setCategory] = useState<Category>('skills');
  const [selected,setSelected] = useState(0);
  const items = profile[category];
  const index = Math.min(selected, Math.max(0,items.length-1));
  const item = items[index];
  const page = Math.floor(index/6);
  const all = Object.values(profile).flat();
  const confirmed = all.filter(claim=>claim.confirmed).length;
  return <div className="console-panel review-studio">
    <div className="review-title"><div><span className="eyebrow">YOUR EVIDENCE, YOUR SAY</span><h1>A quick profile check.</h1></div><span className="review-count">{confirmed}<small> / {all.length} confirmed</small></span></div>
    <p className="console-lede">Explore a claim, correct anything off, then confirm what Aria can use.</p>
    <div className="review-tabs" role="tablist" aria-label="Profile categories">{(Object.keys(labels) as Category[]).map(key=><button key={key} role="tab" aria-selected={category===key} aria-controls="review-category" id={`review-tab-${key}`} onClick={()=>{setCategory(key);setSelected(0);}}>{labels[key]} <small>{profile[key].length}</small></button>)}</div>
    <section id="review-category" role="tabpanel" aria-labelledby={`review-tab-${category}`} className="review-category">
      <div className="claim-palette">{items.slice(page*6,page*6+6).map((claim,offset)=><button key={claim.id} className={index===page*6+offset?'active':''} onClick={()=>setSelected(page*6+offset)} title={claim.name}><span className={claim.confirmed?'claim-dot confirmed':'claim-dot'}>{claim.confirmed?<Check size={11}/>:null}</span><span>{claim.name || 'New claim'}</span></button>)}</div>
      {item ? <div className="claim-inspector" key={item.id}>
        <div className="claim-inspector-title"><label htmlFor="review-claim-name">CLAIM {index+1} OF {items.length}</label><button disabled={busy} aria-label="Remove selected claim" onClick={()=>onRemove(category,index)}><Trash2 size={15}/></button></div>
        <input id="review-claim-name" aria-label="Claim name" value={item.name} disabled={busy} onChange={event=>onChange(category,index,{name:event.target.value})}/>
        <label htmlFor="review-claim-description">Evidence / description · {item.origin} · {item.confidence}</label><textarea id="review-claim-description" aria-label="Claim description" value={item.sourcePassage} disabled={busy} onChange={event=>onChange(category,index,{sourcePassage:event.target.value})} rows={4} maxLength={700}/>
        <button className={`claim-confirm ${item.confirmed?'confirmed':''}`} aria-pressed={item.confirmed} disabled={busy} onClick={()=>onChange(category,index,{confirmed:!item.confirmed})}><Check size={14}/>{item.confirmed?'Confirmed for interview':'Confirm this claim'}</button>
      </div>:<p className="empty-claims">No {labels[category].toLowerCase()} extracted. Add a claim if your résumé missed it.</p>}
      <div className="claim-navigation"><button disabled={busy} onClick={()=>{onAdd(category);setSelected(items.length);}}><Plus size={14}/> Add claim</button><div><button aria-label="Previous claim" disabled={!index} onClick={()=>setSelected(index-1)}><ArrowLeft size={15}/></button><span>{items.length?index+1:0} / {items.length}</span><button aria-label="Next claim" disabled={index>=items.length-1} onClick={()=>setSelected(index+1)}><ArrowRight size={15}/></button></div></div>
    </section>
    <div className="review-actions"><button className="interview-secondary" disabled={busy||!all.length||confirmed===all.length} onClick={onConfirmAll}><Check size={15}/> Confirm all claims</button><button className="interview-primary" disabled={busy} onClick={onContinue}>Continue <ArrowRight size={16}/></button></div>
  </div>;
}
