import { getQueryPageData, getDateRange } from "@/lib/gsc-client";
import type { RawOpportunity, ScoredOpportunity } from "@/types/content-opportunity";

// Scoring function
function scoreOpportunity(raw: RawOpportunity): ScoredOpportunity {
  // Demand: normalize impressions (log scale, capped at 1)
  const demandScore = Math.min(1, Math.log10(Math.max(raw.impressions, 1)) / 4);

  // Probability of gain: sigmoid centered at position 10
  const probabilityGain = 1 / (1 + Math.exp(0.3 * (raw.position - 10)));

  // Business value: expected CTR uplift
  // Standard CTR curve approximation
  const expectedCtr = getExpectedCtr(Math.max(1, Math.round(raw.position)));
  const currentCtr = raw.ctr > 1 ? raw.ctr / 100 : raw.ctr;
  const businessValue = Math.max(0, expectedCtr - currentCtr);

  // Operational risk: higher for new content vs existing
  const operationalRisk = raw.pageUrl ? 0.2 : 0.5;

  // Duplication risk: default 0, updated later by LLM
  const duplicationRisk = 0;

  const totalScore = (demandScore * probabilityGain * businessValue * 100) - (duplicationRisk * operationalRisk);

  return {
    ...raw,
    demandScore: Number(demandScore.toFixed(3)),
    probabilityGain: Number(probabilityGain.toFixed(3)),
    businessValue: Number(businessValue.toFixed(3)),
    duplicationRisk,
    operationalRisk,
    totalScore: Number(Math.max(0, totalScore).toFixed(2)),
  };
}

function getExpectedCtr(position: number): number {
  // Approximate organic CTR by position (desktop, branded removed)
  const ctrCurve: Record<number, number> = {
    1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.065,
    6: 0.05, 7: 0.04, 8: 0.035, 9: 0.03, 10: 0.025,
  };
  if (position <= 10) return ctrCurve[position] || 0.025;
  if (position <= 20) return 0.01;
  return 0.005;
}

export async function detectContentOpportunities(
  accessToken: string,
  siteUrl: string,
  period = "28d"
): Promise<ScoredOpportunity[]> {
  const { startDate, endDate } = getDateRange(period);

  const rows = await getQueryPageData(accessToken, siteUrl, startDate, endDate, 500);

  // Normalize CTR
  const normalized = rows.map(r => ({
    ...r,
    ctr: r.ctr > 1 ? r.ctr / 100 : r.ctr,
  }));

  const opportunities: RawOpportunity[] = [];
  const seen = new Set<string>();

  for (const row of normalized) {
    if (!row.query || !row.page || seen.has(row.query)) continue;
    seen.add(row.query);

    // Quick Win: position 5-20, high impressions, low CTR
    if (row.position >= 5 && row.position <= 20 && row.impressions >= 50 && row.ctr < 0.05) {
      opportunities.push({
        query: row.query,
        pageUrl: row.page,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        position: row.position,
        sourceType: "quick_win",
      });
      continue;
    }

    // Striking Distance: position 8-30, decent impressions
    if (row.position >= 8 && row.position <= 30 && row.impressions >= 30) {
      opportunities.push({
        query: row.query,
        pageUrl: row.page,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        position: row.position,
        sourceType: "striking_distance",
      });
      continue;
    }

    // Content Gap: ranking on generic page (short path)
    if (row.impressions >= 20 && row.position <= 50) {
      try {
        const path = new URL(row.page).pathname;
        if (path === "/" || path.split("/").filter(Boolean).length <= 1) {
          opportunities.push({
            query: row.query,
            pageUrl: row.page,
            impressions: row.impressions,
            clicks: row.clicks,
            ctr: row.ctr,
            position: row.position,
            sourceType: "content_gap",
          });
        }
      } catch {}
    }
  }

  // Score and sort
  const scored = opportunities.map(scoreOpportunity);
  scored.sort((a, b) => b.totalScore - a.totalScore);

  return scored.slice(0, 30);
}
