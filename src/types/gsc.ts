export interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCDateRow {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCOverviewData {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: GSCQueryRow[];
  topPages: GSCPageRow[];
  dailyData: GSCDateRow[];
}

export interface GSCQueryPageRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export type PositionBand = "Top 1" | "Top 3" | "Top 10" | "Top 20" | "Top 30";

export interface Opportunity {
  query: string;
  url: string;
  impressions: number;
  clicks: number;
  position: number;
  ctr: number;
  score: number;
  reason: string;
  band: PositionBand;
  nextMove: string;
}
