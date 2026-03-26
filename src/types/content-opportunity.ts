export interface RawOpportunity {
  query: string;
  pageUrl: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  sourceType: "quick_win" | "striking_distance" | "weak_serp" | "content_gap";
}

export interface ScoredOpportunity extends RawOpportunity {
  demandScore: number;
  probabilityGain: number;
  businessValue: number;
  duplicationRisk: number;
  operationalRisk: number;
  totalScore: number;
}

export interface SerpAnalysisResult {
  dominantType: "guide" | "listicle" | "comparison" | "faq" | "product" | "news" | "other";
  features: {
    hasFeaturedSnippet: boolean;
    hasPeopleAlsoAsk: boolean;
    paaQuestions: string[];
    hasKnowledgePanel: boolean;
    hasVideoResults: boolean;
    relatedSearches: string[];
  };
  top5: {
    position: number;
    domain: string;
    url: string;
    title: string;
    snippet: string;
    titlePattern: string;
    estimatedFreshness: "fresh" | "recent" | "stale" | "unknown";
  }[];
  competitorWeaknesses: string[];
}

export interface ContentBrief {
  titleSuggestions: string[];
  recommendedFormat: string;
  wordCountTarget: number;
  keyTopics: string[];
  uniqueAngle: string;
  noveltyScore: number;
  duplicationRisk: number;
  headingStructure: string[];
  paaToTarget: string[];
  internalLinkingSuggestions: string[];
}

export type OpportunityStatus = "new" | "brief_generated" | "in_progress" | "published" | "dismissed";
