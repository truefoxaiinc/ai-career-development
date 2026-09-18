'use client';
import {useMutation,useQuery} from '@tanstack/react-query';import {api,qs} from '@/lib/api';import type {AsyncTask,Job} from '@/lib/types';
export function useJobs(params:{q?:string;location?:string;source?:string;sort?:string;page?:number}={}){return useQuery({queryKey:['jobs',params],queryFn:()=>api.get<{items:Job[];page:number;page_size:number;total:number;pages:number}>(`/jobs${qs(params)}`)})}
export function useRecommendations(){return useQuery({queryKey:['jobs','recommendations'],queryFn:()=>api.get<Job[]>('/jobs/recommendations')})}
export function useSavedJobs(){return useQuery({queryKey:['jobs','saved'],queryFn:()=>api.get<Job[]>('/jobs/saved')})}

export function useDiscoverJobs(){
  return useMutation({
    mutationFn:async()=>{
      const queued=await api.post<{task_id:string;status:string}>('/jobs/discover',{limit_per_provider:20,max_results:50});
      for(let attempt=0;attempt<60;attempt+=1){
        const task=await api.get<AsyncTask>(`/tasks/${queued.task_id}`);
        if(task.status==='succeeded')return task;
        if(task.status==='failed')throw new Error(task.error_code==='preferences_required'?'Set at least one target job title in Preferences before discovering jobs.':'Job discovery failed. Please try again.');
        await new Promise((resolve)=>setTimeout(resolve,1000));
      }
      throw new Error('Job discovery is taking longer than expected. Please check again shortly.');
    },
  });
}
