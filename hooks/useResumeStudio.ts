'use client';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {studioApi,uploadResume} from '@/lib/resume-studio';

export function useStudioOverview(){return useQuery({queryKey:['resume-studio'],queryFn:studioApi.overview,refetchInterval:q=>q.state.data?.resumes.some(r=>['queued','processing'].includes(r.status))?1500:false})}
export function useResumeFacts(fileId?:string){return useQuery({queryKey:['resume-studio','facts',fileId],queryFn:()=>studioApi.facts(fileId!),enabled:!!fileId})}
export function useResumeSuggestions(fileId?:string){return useQuery({queryKey:['resume-studio','suggestions',fileId],queryFn:()=>studioApi.suggestions(fileId!),enabled:!!fileId,refetchInterval:2000})}
export function useResumeUpload(onProgress:(n:number)=>void){const qc=useQueryClient();return useMutation({mutationFn:(file:File)=>uploadResume(file,onProgress),onSuccess:()=>qc.invalidateQueries({queryKey:['resume-studio']})})}
