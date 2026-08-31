export const API_BASE=(process.env.NEXT_PUBLIC_API_URL||'http://localhost:8000/api/v1').replace(/\/$/,'');

type ErrorEnvelope={ok?:false;error?:{code?:string;message?:string;fields?:Array<{field?:string;message?:string}>}};
export class ApiError extends Error{status:number;code:string;fields:Record<string,string>;constructor(message:string,status=500,code='api_error',fields:Record<string,string>={}){super(message);this.status=status;this.code=code;this.fields=fields}}

async function parseError(response:Response){let body:ErrorEnvelope|{detail?:string}|null=null;try{body=await response.json()}catch{};const env=body as ErrorEnvelope;const detail=body as {detail?:string};const fields:Record<string,string>={};for(const item of env?.error?.fields||[]){if(item.field&&item.message)fields[item.field]=item.message}return new ApiError(env?.error?.message||detail?.detail||`Request failed (${response.status})`,response.status,env?.error?.code||'request_failed',fields)}

async function raw<T>(path:string,init:RequestInit={},retry=true):Promise<T>{
 const headers=new Headers(init.headers);if(init.body && !(init.body instanceof FormData)&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
 const response=await fetch(`${API_BASE}${path}`,{...init,headers,credentials:'include',cache:'no-store'});
 if(response.status===401&&retry&&path!='/auth/refresh'&&typeof window!=='undefined'){
   const refreshed=await fetch(`${API_BASE}/auth/refresh`,{method:'POST',credentials:'include'});
   if(refreshed.ok)return raw<T>(path,init,false);
 }
 if(!response.ok)throw await parseError(response);
 const body=await response.json();return body.data as T;
}
export const api={
 get:<T>(path:string)=>raw<T>(path),
 post:<T>(path:string,body?:unknown)=>raw<T>(path,{method:'POST',body:body===undefined?undefined:JSON.stringify(body)}),
 put:<T>(path:string,body:unknown)=>raw<T>(path,{method:'PUT',body:JSON.stringify(body)}),
 patch:<T>(path:string,body:unknown)=>raw<T>(path,{method:'PATCH',body:JSON.stringify(body)}),
 delete:<T>(path:string,body?:unknown)=>raw<T>(path,{method:'DELETE',body:body===undefined?undefined:JSON.stringify(body)}),
 upload:<T>(path:string,form:FormData)=>raw<T>(path,{method:'POST',body:form}),
};
export async function downloadDocument(documentId:string,format:'pdf'|'docx'){
 const response=await fetch(`${API_BASE}/documents/${documentId}/download?format=${format}`,{credentials:'include'});if(!response.ok)throw await parseError(response);const blob=await response.blob();const cd=response.headers.get('content-disposition')||'';const match=/filename="?([^";]+)"?/i.exec(cd);const name=match?.[1]||`careerpilot-document.${format}`;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
export function qs(values:Record<string,string|number|boolean|undefined|null>){const p=new URLSearchParams();Object.entries(values).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')p.set(k,String(v))});const s=p.toString();return s?`?${s}`:''}
