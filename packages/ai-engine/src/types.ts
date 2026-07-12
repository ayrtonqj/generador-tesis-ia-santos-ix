export interface AnalysisResult {
  scores: {
    structure: number;
    content: number;
    form: number;
    originality: number;
    overall: number;
  };
  grade: number;
  executiveSummary: string;
  structureAnalysis: {
    presentSections: string[];
    missingSections: string[];
    extraSections: string[];
    orderCorrect: boolean;
  };
  findings: FindingOutput[];
  processingMs: number;
}

export interface FindingOutput {
  sectionRef: string;
  pageRef?: number;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'SUGGESTION';
  description: string;
  correctionSteps: string;
  exampleImprovement: string;
  recommendation: string;
}

export interface SectionAnalysisOutput {
  findings: FindingOutput[];
  sectionSummary: string;
}

export interface ExtractedReference {
  rawText: string;
  authors: string | null;
  year: number | null;
  title: string | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  doi: string | null;
  url: string | null;
}

export interface DetailedFeedback {
  executiveSummary: string;
  sectionAnalysis: {
    sectionName: string;
    status: 'OK' | 'OBSERVED' | 'MISSING';
    strengths: string;
    weaknesses: string;
    improvementSuggestion: string;
  }[];
  dimensionAnalysis: {
    dimension: string;
    score: number;
    weight: number;
    analysis: string;
    priority: 'ALTA' | 'MEDIA' | 'BAJA';
  }[];
  prioritizedRecommendations: {
    priority: number;
    area: string;
    recommendation: string;
    expectedImpact: string;
  }[];
  improvementPlan: {
    shortTerm: string[];
    mediumTerm: string[];
    longTerm: string[];
  };
  resourcesAndReferences: string[];
}

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
  indent?: string;
  paragraphSpacing?: string;
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

export interface ThesisGenSection {
  name: string;
  required: boolean;
  order: number;
  subsections?: string[];
  estimatedWords?: number;
  description?: string;
}

export interface ThesisGenRequest {
  templateSchema: TemplateSchema;
  templateText?: string;
  topic: string;
  userPrompt?: string;
  sectionNames: string[];
  targetPageRange?: 'menos-10' | '10-20' | '20-30' | '30-40' | '40-50' | '50-60' | '60-70' | '70-80' | '+80';
}

export interface ThesisGenResult {
  content: string;
  sections: string[];
}
