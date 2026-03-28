export interface TopAction {
  action: string;
  category: string;
  revenue_at_stake: number;
  effort: "low" | "medium" | "high";
  timeline: string;
}

export interface ProductDiagnosis {
  executive_summary: string;
  biggest_opportunity: string;
  biggest_risk: string;
  top_actions: TopAction[];
  content_gap_summary: string;
  abc_visibility_summary: string;
}
