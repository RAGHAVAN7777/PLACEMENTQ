export function pageText(items, width) {
  const spans = items.filter(x => typeof x.str === 'string' && x.str.trim()).map(x => ({ text: x.str, x: x.transform[4], y: x.transform[5], end: x.transform[4] + x.width }));
  if (!spans.length) return '';
  const lines = list => {
    const rows = [];
    for (const s of [...list].sort((a,b) => b.y-a.y || a.x-b.x)) {
      let row = rows.find(r => Math.abs(r.y-s.y)<3);
      if (!row) { row={y:s.y,spans:[]}; rows.push(row); }
      row.spans.push(s);
    }
    return rows.sort((a,b)=>b.y-a.y).map(r=>r.spans.sort((a,b)=>a.x-b.x).map(s=>s.text).join(' ').trim()).join('\n');
  };
  let split = null, best = -1;
  for (let f=.28; f<=.72; f+=.02) {
    const x=width*f, left=spans.filter(s=>s.end<x-8), right=spans.filter(s=>s.x>x+8);
    const crossing=spans.filter(s=>s.x<x+8 && s.end>x-8);
    const top=Math.max(...right.map(s=>s.y));
    const bodyCross=crossing.filter(s=>s.y<top-4);
    const score=Math.min(left.length,right.length)-bodyCross.length*5;
    if(left.length>=4 && right.length>=4 && bodyCross.length===0 && score>best) {split=x;best=score;}
  }
  if (!split) return lines(spans);
  const cross=spans.filter(s=>s.x<split+8 && s.end>split-8);
  return [lines(cross),lines(spans.filter(s=>s.end<=split-8)),lines(spans.filter(s=>s.x>=split+8))].filter(Boolean).join('\n\n');
}
