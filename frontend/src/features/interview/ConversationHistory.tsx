import { useEffect, useRef } from 'react';
import type { ConversationTurn } from '../../services/interviewApi';
import './Conversation.css';

export default function ConversationHistory({ turns, pending }: { turns: ConversationTurn[]; pending?: string }) {
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [turns.length, pending]);
  return <section className="conversation-history" aria-label="Interview conversation">
    <header><span>YOUR CONVERSATION</span><small>{turns.filter(t => t.role === 'student').length} answers saved</small></header>
    <div className="conversation-messages" role="log" aria-live="polite" ref={log}>
      {turns.map(turn => <article key={turn.id} className={`conversation-turn ${turn.role}`}><span>{turn.role === 'student' ? 'You' : 'Aria'}{turn.kind === 'challenge' ? ' · Let’s test that' : turn.kind === 'clarify' ? ' · A closer look' : ''}</span><p>{turn.text}</p></article>)}
      {pending && <article className="conversation-turn student pending"><span>You · sending, not yet saved</span><p>{pending}</p></article>}
    </div>
    {pending && <p className="conversation-thinking" role="status">Aria is considering your answer and checking its evidence…</p>}
  </section>;
}
