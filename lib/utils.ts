export function cn(...parts:(string|false|null|undefined)[]) { return parts.filter(Boolean).join(' '); }
export const sleep=(ms=220)=>new Promise(resolve=>setTimeout(resolve,ms));
export function fuzzyMatch(query:string, text:string){
  const q=query.toLowerCase().trim(); const t=text.toLowerCase(); if(!q) return 1; if(t.includes(q)) return 100-q.length;
  let cursor=0; for(const ch of q){cursor=t.indexOf(ch,cursor); if(cursor<0)return 0; cursor+=1;} return 20-q.length;
}
