import { API_BASE, ApiError, api } from '@/lib/api';

export type StudioResume={id:string;filename:string;mime_type:string;size_bytes:number;content_hash:string;version:number;status:'queued'|'processing'|'completed'|'failed';extraction_error?:string|null;uploaded_at:string;task?:{id:string;status:string;progress:number;error_code?:string|null}|null};
export type ResumeFact={id:string;entry_type:string;label:string;structured_data:Record<string,unknown>;confidence:number;source_text?:string|null;source_location?:string|number|null;status:'pending'|'confirmed';verified_at?:string|null};
export type ResumeSuggestion={id:string;source_file_id:string;category:string;priority:'high'|'medium'|'low';explanation:string;current_text:string;suggested_text:string;reason:string;status:'pending'|'applied'|'dismissed';applied_document_id?:string|null};
export type ResumeTemplate={key:'ats'|'modern'|'minimal'|'professional';name:string;description:string;accent:string};
export type StudioOverview={resumes:StudioResume[];max_upload_bytes:number;supported_types:string[]};

export function uploadResume(file:File,onProgress:(value:number)=>void):Promise<StudioResume>{
 return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',`${API_BASE}/resume-studio/resumes`);xhr.withCredentials=true;xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100))};xhr.onerror=()=>reject(new ApiError('Network error during upload',0,'network_error'));xhr.onload=()=>{let body:any;try{body=JSON.parse(xhr.responseText)}catch{reject(new ApiError('Invalid upload response',xhr.status));return}if(xhr.status<200||xhr.status>=300){reject(new ApiError(body?.error?.message||body?.detail||'Upload failed',xhr.status,body?.error?.code));return}onProgress(100);resolve(body.data)};const form=new FormData();form.append('file',file);xhr.send(form)});
}

export const studioApi={
 overview:()=>api.get<StudioOverview>('/resume-studio/overview'),
 facts:(id:string)=>api.get<ResumeFact[]>(`/resume-studio/resumes/${id}/facts`),
 verify:(id:string,action:'accept'|'edit'|'reject',label?:string)=>api.post('/profile/verify',{decisions:[{entry_id:id,action,label}]}),
 requestSuggestions:(id:string)=>api.post<{task_id:string}>(`/resume-studio/resumes/${id}/suggestions`),
 suggestions:(id:string)=>api.get<ResumeSuggestion[]>(`/resume-studio/resumes/${id}/suggestions`),
 suggestionAction:(id:string,action:'apply'|'dismiss',document_id?:string)=>api.post(`/resume-studio/suggestions/${id}`,{action,document_id}),
 templates:()=>api.get<ResumeTemplate[]>('/resume-studio/templates'),
 selectTemplate:(documentId:string,template:string)=>api.put(`/resume-studio/documents/${documentId}/template`,{template}),
 target:(body:Record<string,unknown>)=>api.post<{task_id:string;job_id:string}>('/resume-studio/target',body),
 task:(id:string)=>api.get<{status:string;progress:number;result:Record<string,unknown>;error_code?:string}>(`/tasks/${id}`),
 documents:()=>api.get<Array<{id:string;document_type:string;version:number;title:string;content:string;template_key:string;approved_at?:string|null;claim_report:{unsupported_claims:number}}>>('/documents'),
 approve:(id:string)=>api.post(`/documents/${id}/approve`),
 savedJobs:()=>api.get<Array<{id:string;title:string;company:string}>>('/jobs/saved'),
 recommendedJobs:()=>api.get<Array<{id:string;title:string;company:string}>>('/jobs/recommendations'),
};
