import { rankingRepository } from "@/repositories/ranking-repository";

export interface RankingDropResult {
  severity: "WARNING" | "CRITICAL" | null;
  daysDropping: number;
  startPosition: number;
  currentPosition: number;
  totalDrop: number;
}

export async function detectRankingDrop(
  trackedQueryId: string
): Promise<RankingDropResult> {
  const history = await rankingRepository.getHistory(trackedQueryId, 15);

  if (history.length < 3) {
    return {
      severity: null,
      daysDropping: 0,
      startPosition: 0,
      currentPosition: 0,
      totalDrop: 0,
    };
  }

  // Filter entries with valid position
  const withPosition = history.filter((h) => h.yourPosition !== null);
  if (withPosition.length < 3) {
    return {
      severity: null,
      daysDropping: 0,
      startPosition: 0,
      currentPosition: 0,
      totalDrop: 0,
    };
  }

  // Count consecutive days of dropping (higher position number = worse)
  let daysDropping = 0;
  for (let i = withPosition.length - 1; i > 0; i--) {
    const current = withPosition[i].yourPosition!;
    const previous = withPosition[i - 1].yourPosition!;
    if (current > previous) {
      daysDropping++;
    } else {
      break;
    }
  }

  const startPosition = withPosition[0].yourPosition!;
  const currentPosition = withPosition[withPosition.length - 1].yourPosition!;
  const totalDrop = currentPosition - startPosition;

  let severity: "WARNING" | "CRITICAL" | null = null;

  // Continuous drop for 15+ days = CRITICAL
  if (daysDropping >= 12) {
    severity = "CRITICAL";
  }
  // Continuous drop for 7+ days = WARNING
  else if (daysDropping >= 5) {
    severity = "WARNING";
  }
  // Significant accumulated drop (e.g., position 5 → 11)
  else if (totalDrop >= 6 && withPosition.length >= 10) {
    severity = "CRITICAL";
  } else if (totalDrop >= 4 && withPosition.length >= 7) {
    severity = "WARNING";
  }

  return { severity, daysDropping, startPosition, currentPosition, totalDrop };
}
