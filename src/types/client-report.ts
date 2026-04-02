export interface FunnelData {
  itemsViewed: number;
  addedToCart: number;
  purchased: number;
}

export interface RankingWin {
  name: string;
  url: string;
  newPosition: number;
  jump: number;
  impressionsDelta?: number;
}

export interface VisualKeyword {
  keyword: string;
  position: number;
  clicks: number;
}

export interface AIPlatforms {
  chatgpt: number;
  aiMode: number;
  gemini: number;
  aiOverview: number;
}

export interface NextStep {
  title: string;
  description: string;
}

export interface ClientReport {
  id: string;
  clientId: string;
  period: string;
  periodType: "mensal" | "trimestral";
  createdAt: string;

  clicks: number;
  clicksDelta: number;
  impressions: number;
  impressionsDelta: number;
  revenue: number;
  cartConversion: number;
  aiScore: number;
  aiMentions: number;

  funnelData: FunnelData | null;
  rankingWins: RankingWin[];
  visualKeywords: VisualKeyword[];
  aiPlatforms: AIPlatforms | null;
  nextSteps: NextStep[];
  analystNotes?: string;

  client?: { name: string; domain: string };
}
