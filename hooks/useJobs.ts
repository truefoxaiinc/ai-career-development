'use client';

import {
  useMutation,
  useQuery,
} from '@tanstack/react-query';

import {
  api,
  qs,
} from '@/lib/api';

import type {
  AsyncTask,
  Job,
} from '@/lib/types';


export type GlobalJob = Job & {
  country?: string | null;
  country_code?: string | null;
  city?: string | null;
  category?: string | null;
  occupation?: string | null;
  visa_sponsorship?: boolean | null;
  relocation_support?: boolean | null;
  work_authorization?: string | null;
};


export type JobSearchParams = {
  q?: string;
  location?: string;
  country?: string;
  category?: string;
  work_mode?: string;
  employment_type?: string;
  salary_min?: number;
  currency?: string;
  visa_sponsorship?: boolean;
  relocation_support?: boolean;
  work_authorization?: string;
  source?: string;
  sort?: string;
  page?: number;
  page_size?: number;
};


export function useJobs(
  params: JobSearchParams = {},
) {
  return useQuery({
    queryKey: [
      'jobs',
      params,
    ],

    queryFn: () =>
      api.get<{
        items: GlobalJob[];
        page: number;
        page_size: number;
        total: number;
        pages: number;
      }>(
        `/jobs${qs(params)}`,
      ),

    placeholderData:
      (previousData) =>
        previousData,

    staleTime: 15_000,
  });
}


export function useRecommendations() {
  return useQuery({
    queryKey: [
      'jobs',
      'recommendations',
    ],

    queryFn: () =>
      api.get<GlobalJob[]>(
        '/jobs/recommendations',
      ),
  });
}


export function useSavedJobs() {
  return useQuery({
    queryKey: [
      'jobs',
      'saved',
    ],

    queryFn: () =>
      api.get<GlobalJob[]>(
        '/jobs/saved',
      ),
  });
}


export function useJobSources() {
  return useQuery({
    queryKey: [
      'jobs',
      'sources',
    ],

    queryFn: () =>
      api.get<string[]>(
        '/jobs/sources',
      ),
  });
}


export function useDiscoverJobs() {
  return useMutation({
    mutationFn: async () => {
      const queued =
        await api.post<{
          task_id: string;
          status: string;
        }>(
          '/jobs/discover',
          {
            limit_per_provider: 20,
            max_results: 50,
          },
        );

      for (
        let attempt = 0;
        attempt < 60;
        attempt += 1
      ) {
        const task =
          await api.get<AsyncTask>(
            `/tasks/${queued.task_id}`,
          );

        if (
          task.status ===
          'succeeded'
        ) {
          return task;
        }

        if (
          task.status ===
          'failed'
        ) {
          throw new Error(
            'Job discovery failed. Please try again.',
          );
        }

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              1000,
            ),
        );
      }

      throw new Error(
        'Job discovery is taking longer than expected. Please check again shortly.',
      );
    },
  });
}
