export interface SEOAnalysis {
  url: string;
  score: number;
  timestamp: string;
  categories: SEOCategory[];
  summary: string;
  recommendations: Recommendation[];
}

export interface SEOCategory {
  name: string;
  score: number;
  status: "excellent" | "good" | "needs_improvement" | "critical";
  issues: SEOIssue[];
}

export interface SEOIssue {
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  impact: string;
  howToFix: string;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  estimatedImpact: string;
}

export interface KeywordAnalysis {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  trend: "up" | "down" | "stable";
  relatedKeywords: string[];
  contentSuggestions: string[];
}

export interface CompetitorAnalysis {
  domain: string;
  overlapKeywords: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  contentGaps: string[];
}

export interface Client {
  id: string;
  name: string;
  domain: string;
  industry: string;
  status: "active" | "inactive";
  createdAt: string;
  lastAnalysis?: string;
  currentScore?: number;
  notes?: string;
  // Quick indicators for dashboard
  indicators?: ClientIndicators;
}

export interface ClientIndicators {
  impressions?: number;
  clicks?: number;
  sessions?: number;
  performanceScore?: number;
}

export interface AuditReport {
  id: string;
  clientId: string;
  url: string;
  createdAt: string;
  onPage: SEOCategory;
  technical: SEOCategory;
  content: SEOCategory;
  backlinks: SEOCategory;
  ux: SEOCategory;
  overallScore: number;
  aiInsights: string;
  actionPlan: Recommendation[];
}

export type AnalysisType = "full" | "on-page" | "technical" | "content" | "keywords" | "competitors";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  analysisData?: Partial<SEOAnalysis>;
}
