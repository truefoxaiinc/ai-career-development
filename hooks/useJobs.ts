'use client';
import {useQuery} from '@tanstack/react-query';import {api,qs} from '@/lib/api';import type {Job} from '@/lib/types';
export function useJobs(params:{q?:string;location?:string;source?:string;sort?:string;page?:number}={}){return useQuery({queryKey:['jobs',params],queryFn:()=>api.get<{items:Job[];page:number;page_size:number;total:number;pages:number}>(`/jobs${qs(params)}`)})}
export function useRecommendations(){return useQuery({queryKey:['jobs','recommendations'],queryFn:()=>api.get<Job[]>('/jobs/recommendations')})}
export function useSavedJobs(){return useQuery({queryKey:['jobs','saved'],queryFn:()=>api.get<Job[]>('/jobs/saved')})}
