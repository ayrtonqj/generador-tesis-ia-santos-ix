import { analysisApi } from '@/services/api';
import { useQuery } from '@tanstack/react-query';

export type FindingSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'SUGGESTION';

export interface AIFinding {
  id: string;
  sectionRef: string;
  pageRef?: number;
  severity: FindingSeverity;
  description: string;
  correctionSteps: string;
  exampleImprovement: string;
  recommendation: string;
  humanAction?: 'ACCEPTED' | 'MODIFIED' | 'REJECTED';
  humanComment?: string;
  reviewedAt?: string;
}

export interface AIAnalysis {
  id: string;
  advanceId: string;
  structureScore: number;
  contentScore: number;
  formScore: number;
  originalityScore: number;
  overallScore: number;
  gradeConverted: number;
  executiveSummary: string;
  modelUsed: string;
  processingMs: number;
  createdAt: string;
  findings: AIFinding[];
}

export function useFindings(advanceId: string) {
  return useQuery<AIAnalysis>({
    queryKey: ['analysis', advanceId],
    queryFn: async () => {
      const { data } = await analysisApi.getByAdvance(advanceId);
      return data;
    },
    enabled: !!advanceId,
    staleTime: 60_000,
  });
}
