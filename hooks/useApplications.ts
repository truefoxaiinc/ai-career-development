'use client';
import {useQuery} from '@tanstack/react-query';import {api} from '@/lib/api';import type {Application} from '@/lib/types';
export function useApplications(){return useQuery({queryKey:['applications'],queryFn:()=>api.get<Application[]>('/applications')})}
