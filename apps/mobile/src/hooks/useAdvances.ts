import { advancesApi } from '@/services/api';
import { useQuery } from '@tanstack/react-query';

export interface Advance {
  id: string;
  title: string;
  advanceType: string;
  version: number;
  status:
    | 'PENDING'
    | 'AI_PROCESSING'
    | 'AI_COMPLETE'
    | 'HUMAN_REVIEW'
    | 'OBSERVED'
    | 'APPROVED'
    | 'REJECTED';
  fileType: string;
  pageCount?: number;
  createdAt: string;
  aiAnalysis?: {
    overallScore: number;
    gradeConverted: number;
  };
}

export function useAdvances() {
  return useQuery<Advance[]>({
    queryKey: ['advances'],
    queryFn: async () => {
      const { data } = await advancesApi.list({ limit: 50 });
      return data?.data ?? data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useAdvanceById(id: string) {
  return useQuery<Advance>({
    queryKey: ['advances', id],
    queryFn: async () => {
      const { data } = await advancesApi.getById(id);
      return data;
    },
    enabled: !!id,
  });
}
