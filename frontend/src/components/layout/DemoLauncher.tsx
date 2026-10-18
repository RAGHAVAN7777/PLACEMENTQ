import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Play } from 'lucide-react';
import './DemoLauncher.css';

export default function DemoLauncher({ disabled=false, onStart }: { disabled?:boolean; onStart?:(level:string)=>void }) {
  const [level,setLevel]=useState('intermediate');
  const menu=useRef<HTMLDetailsElement>(null);
  const navigate=useNavigate();
  return <details className="demo-launcher" ref={menu} onKeyDown={e=>{if(e.key==='Escape'&&menu.current)menu.current.open=false;}}>
    <summary><Play size={14}/> Demo Interview <ChevronDown size={14}/></summary>
    <div className="demo-launcher-menu">
      <strong>Try a fictional candidate</strong><p>Offline questions and practice scoring.</p>
      <label>Demo candidate level<select aria-label="Demo candidate level" value={level} onChange={e=>setLevel(e.target.value)} disabled={disabled}>
        <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
      </select></label>
      <button disabled={disabled} onClick={()=>{if(menu.current)menu.current.open=false;if(onStart)onStart(level);else navigate(`/assessment?demo=${level}`);}}>Try Demo Interview</button>
    </div>
  </details>;
}
