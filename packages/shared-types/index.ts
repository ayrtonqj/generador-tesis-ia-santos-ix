// ═══════════════════════════════════════════
// KIMY — Tipos compartidos Web + API + Mobile
// ═══════════════════════════════════════════

// ─── Auth ────────────────────────────────
export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'ADVISOR' | 'COORDINATOR' | 'ADMIN';
  programId?: string;
  programName?: string;
  avatarUrl?: string;
}

// ─── Advances ────────────────────────────
export interface AdvanceSummary {
  id: string;
  title: string;
  advanceType: string;
  version: number;
  status: AdvanceStatusType;
  fileType: string;
  pageCount?: number;
  createdAt: string;
  studentName?: string;
  aiScore?: number;
  aiGrade?: number;
  humanGrade?: number;
}

export type AdvanceStatusType =
  | 'PENDING'
  | 'AI_PROCESSING'
  | 'AI_COMPLETE'
  | 'HUMAN_REVIEW'
  | 'OBSERVED'
  | 'APPROVED'
  | 'REJECTED';

// ─── AI Analysis ─────────────────────────
export interface AIAnalysisResult {
  id: string;
  structureScore: number;
  contentScore: number;
  formScore: number;
  originalityScore: number;
  overallScore: number;
  gradeConverted: number;
  executiveSummary: string;
  processingMs: number;
  modelUsed: string;
  findings: AIFindingResult[];
}

export interface AIFindingResult {
  id: string;
  sectionRef: string;
  pageRef?: number;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'SUGGESTION';
  description: string;
  correctionSteps: string;
  exampleImprovement: string;
  recommendation: string;
  humanAction?: 'ACCEPTED' | 'MODIFIED' | 'REJECTED';
  humanComment?: string;
}

// ─── Review ──────────────────────────────
export interface ReviewData {
  id: string;
  advanceId: string;
  reviewerId: string;
  reviewerName: string;
  finalGrade?: number;
  humanComment?: string;
  rubricAnswers?: Record<string, any>;
  status: AdvanceStatusType;
  reviewedAt?: string;
}

export interface FindingFeedbackDto {
  findingId: string;
  outcome: 'ACCEPTED' | 'ACCEPTED_WITH_EDIT' | 'DISCARDED' | 'SEVERITY_CHANGED';
  humanComment?: string;
  adjustedSeverity?: string;
  adjustedDescription?: string;
}

// ─── Plagiarism ──────────────────────────
export interface PlagiarismReportResult {
  id: string;
  method: string;
  overallScore: number;
  status: string;
  alerts: PlagiarismAlertResult[];
}

export interface PlagiarismAlertResult {
  id: string;
  targetAdvanceId?: string;
  targetStudentName?: string;
  targetAdvanceTitle?: string;
  sectionName: string;
  similarity: number;
  sourceSnippet?: string;
  targetSnippet?: string;
  severity: string;
}

// ─── References ──────────────────────────
export interface ReferenceAnalysisResult {
  id: string;
  totalRefs: number;
  verifiedCount: number;
  errorCount: number;
  references: ReferenceResult[];
}

export interface ReferenceResult {
  id: string;
  rawText: string;
  authors?: string;
  year?: number;
  title?: string;
  journal?: string;
  doi?: string;
  status: 'VERIFIED' | 'PARTIAL' | 'NOT_FOUND' | 'HALLUCINATED';
  errorType?: string;
  suggestion?: string;
}

// ─── Dashboard ───────────────────────────
export interface DashboardKPIs {
  totalAdvances: number;
  pendingAdvances: number;
  reviewedAdvances: number;
  rejectedAdvances: number;
  avgAIScore: number;
  avgHumanGrade: number;
  avgReviewTime: number;
  aiHumanConcordance: number;
  plagiarismAlerts: number;
  invalidCitations: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  userId: string;
  userName: string;
  entityId?: string;
  createdAt: string;
}

// ─── Templates ───────────────────────────
export interface TemplateFormatting {
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  alignment: string;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  pageNumbering: {
    enabled: boolean;
    position: 'bottom-right' | 'bottom-center' | 'bottom-left';
    excludeFirstPage: boolean;
  };
  decimalSeparator: string;
  figureNaming: string;
  tableNaming: string;
  bibliographyManager?: string;
}

export interface TemplateSection {
  name: string;
  level: number;
  required: boolean;
  order: number;
  subsections?: TemplateSection[];
  minWords?: number;
  maxWords?: number;
  estimatedWords?: number;
  description?: string;
  validationRules?: string[];
}

export interface TemplateSchema {
  sections: TemplateSection[];
  formatting: TemplateFormatting;
  citationStyle: string;
  writingStyle?: string;
  additionalRules?: string[];
}

// ─── Notifications ───────────────────────
export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}
