'use client';
import {useQuery} from '@tanstack/react-query';import {api} from '@/lib/api';
export function useInterviewDashboard(){return useQuery({queryKey:['interviews','dashboard'],queryFn:()=>api.get<{recent_sessions:unknown[];star_answer_count:number;voice_ready_architecture:boolean;voice_enabled:boolean}>('/interviews/dashboard')})}
