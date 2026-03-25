import type { CompetitorSnapshot } from "@prisma/client";

export interface PageChange {
  type:
    | "title_changed"
    | "h1_changed"
    | "meta_changed"
    | "content_expanded"
    | "faq_added";
  description: string;
  previous: string | null;
  current: string | null;
}

export function detectPageChanges(
  previous: CompetitorSnapshot | null,
  current: {
    title: string | null;
    h1: string | null;
    metaDescription: string | null;
    contentLength: number;
    faqCount: number;
    rawHtmlHash: string;
  }
): PageChange[] {
  if (!previous) return [];

  const changes: PageChange[] = [];

  if (
    previous.title &&
    current.title &&
    previous.title !== current.title
  ) {
    changes.push({
      type: "title_changed",
      description: `Title alterado`,
      previous: previous.title,
      current: current.title,
    });
  }

  if (
    previous.h1 &&
    current.h1 &&
    previous.h1 !== current.h1
  ) {
    changes.push({
      type: "h1_changed",
      description: `H1 alterado`,
      previous: previous.h1,
      current: current.h1,
    });
  }

  if (
    previous.metaDescription &&
    current.metaDescription &&
    previous.metaDescription !== current.metaDescription
  ) {
    changes.push({
      type: "meta_changed",
      description: `Meta description alterada`,
      previous: previous.metaDescription,
      current: current.metaDescription,
    });
  }

  if (
    previous.contentLength &&
    current.contentLength &&
    current.contentLength > previous.contentLength * 1.15
  ) {
    const growth = Math.round(
      ((current.contentLength - previous.contentLength) /
        previous.contentLength) *
        100
    );
    changes.push({
      type: "content_expanded",
      description: `Conteúdo expandido em ${growth}%`,
      previous: `${previous.contentLength} chars`,
      current: `${current.contentLength} chars`,
    });
  }

  if (
    current.faqCount > (previous.faqCount || 0)
  ) {
    changes.push({
      type: "faq_added",
      description: `FAQs adicionados (${previous.faqCount || 0} → ${current.faqCount})`,
      previous: String(previous.faqCount || 0),
      current: String(current.faqCount),
    });
  }

  return changes;
}
