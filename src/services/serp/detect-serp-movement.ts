import { serpRepository } from "@/repositories/serp-repository";
import type { SerpResult } from "@prisma/client";

export interface SerpMovement {
  type: "NEW_TOP5" | "LEADER_CHANGE" | "OUR_DOMAIN_OUT" | "COMPETITOR_OVERTAKE";
  description: string;
  domain: string;
  previousPosition?: number;
  currentPosition?: number;
}

export async function detectSerpMovements(
  trackedQueryId: string,
  ourDomain: string
): Promise<SerpMovement[]> {
  const latest = await serpRepository.getLatestSnapshot(trackedQueryId);
  const previous = await serpRepository.getPreviousSnapshot(trackedQueryId);

  if (!latest || !previous) return [];

  const movements: SerpMovement[] = [];
  const ourDomainClean = ourDomain.replace(/^www\./, "").toLowerCase();

  const prevTop5 = previous.results.filter((r) => r.position <= 5);
  const currTop5 = latest.results.filter((r) => r.position <= 5);
  const prevTop3 = previous.results.filter((r) => r.position <= 3);
  const currTop3 = latest.results.filter((r) => r.position <= 3);

  // New domain in top 5
  const prevTop5Domains = new Set(prevTop5.map((r) => r.domain.toLowerCase()));
  for (const r of currTop5) {
    if (!prevTop5Domains.has(r.domain.toLowerCase())) {
      movements.push({
        type: "NEW_TOP5",
        description: `${r.domain} entrou no top 5 (posição ${r.position})`,
        domain: r.domain,
        currentPosition: r.position,
      });
    }
  }

  // Leader change in top 3
  const prevLeader = prevTop3[0];
  const currLeader = currTop3[0];
  if (
    prevLeader &&
    currLeader &&
    prevLeader.domain.toLowerCase() !== currLeader.domain.toLowerCase()
  ) {
    movements.push({
      type: "LEADER_CHANGE",
      description: `Líder mudou de ${prevLeader.domain} para ${currLeader.domain}`,
      domain: currLeader.domain,
      previousPosition: findPosition(previous.results, currLeader.domain),
      currentPosition: currLeader.position,
    });
  }

  // Our domain out of top 10
  const ourPrev = previous.results.find(
    (r) => r.domain.toLowerCase().includes(ourDomainClean)
  );
  const ourCurr = latest.results.find(
    (r) => r.domain.toLowerCase().includes(ourDomainClean)
  );

  if (ourPrev && ourPrev.position <= 10 && (!ourCurr || ourCurr.position > 10)) {
    movements.push({
      type: "OUR_DOMAIN_OUT",
      description: `Seu site saiu do top 10 (era posição ${ourPrev.position})`,
      domain: ourDomainClean,
      previousPosition: ourPrev.position,
      currentPosition: ourCurr?.position,
    });
  }

  // Competitor overtake
  if (ourPrev && ourCurr) {
    for (const comp of latest.results) {
      if (comp.domain.toLowerCase().includes(ourDomainClean)) continue;
      const compPrev = previous.results.find(
        (r) => r.domain.toLowerCase() === comp.domain.toLowerCase()
      );
      if (
        compPrev &&
        compPrev.position > ourPrev.position &&
        comp.position < ourCurr.position
      ) {
        movements.push({
          type: "COMPETITOR_OVERTAKE",
          description: `${comp.domain} ultrapassou seu site (${compPrev.position} → ${comp.position})`,
          domain: comp.domain,
          previousPosition: compPrev.position,
          currentPosition: comp.position,
        });
      }
    }
  }

  return movements;
}

function findPosition(results: SerpResult[], domain: string): number | undefined {
  const r = results.find(
    (r) => r.domain.toLowerCase() === domain.toLowerCase()
  );
  return r?.position;
}
