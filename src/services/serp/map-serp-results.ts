import { serpRepository } from "@/repositories/serp-repository";
import { competitorRepository } from "@/repositories/competitor-repository";
import { fetchSerpTop10 } from "./fetch-serp-top10";

export async function mapSerpResults(trackedQueryId: string, query: string) {
  const serp = await fetchSerpTop10(query);

  // Save snapshot
  const snapshot = await serpRepository.createSnapshot(
    trackedQueryId,
    serp.results.map((r) => ({
      position: r.position,
      domain: r.domain,
      url: r.link,
      title: r.title,
    })),
    serp.rawJson
  );

  // Upsert competitor pages
  await competitorRepository.upsertFromSerp(
    trackedQueryId,
    serp.results.map((r) => ({
      domain: r.domain,
      url: r.link,
      position: r.position,
    }))
  );

  return snapshot;
}
