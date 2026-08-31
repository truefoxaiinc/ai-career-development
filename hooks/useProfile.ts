'use client';
import {useQuery} from '@tanstack/react-query';import {api} from '@/lib/api';import type {Profile} from '@/lib/types';
export function useProfile(){return useQuery({queryKey:['profile'],queryFn:()=>api.get<Profile>('/profile')})}
