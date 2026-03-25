import type { PageChange } from "@/services/competitors/detect-page-changes";
import type { SerpMovement } from "@/services/serp/detect-serp-movement";

export function buildRecommendedActionForDrop(
  position: number,
  ctr?: number
): string {
  if (position <= 10 && ctr !== undefined && ctr < 0.03) {
    return "Reescrever title e meta description desta URL para aumentar CTR";
  }
  if (position >= 11 && position <= 20) {
    return "Expandir conteúdo da categoria em 150 a 300 palavras + adicionar bloco de FAQ com 3 perguntas + melhorar linkagem interna";
  }
  if (position > 20) {
    return "Revisão completa da página: expandir conteúdo, adicionar FAQ, melhorar title/meta, adicionar links internos de blog e páginas institucionais";
  }
  return "Revisar otimização on-page da URL";
}

export function buildRecommendedActionForSerpMovement(
  movement: SerpMovement
): string {
  switch (movement.type) {
    case "NEW_TOP5":
      return `Revisar página do concorrente ${movement.domain} que entrou no top 5. Analisar conteúdo, title, estrutura e backlinks`;
    case "LEADER_CHANGE":
      return `Novo líder no top 3: ${movement.domain}. Fazer auditoria comparativa urgente`;
    case "OUR_DOMAIN_OUT":
      return "Seu site saiu do top 10. Ação urgente: expandir conteúdo, adicionar FAQ, revisar title/meta, verificar problemas técnicos";
    case "COMPETITOR_OVERTAKE":
      return `Concorrente ${movement.domain} ultrapassou seu site. Revisar página concorrente e otimizar sua URL`;
  }
}

export function buildRecommendedActionForCompetitorChange(
  changes: PageChange[]
): string {
  const actions: string[] = [];

  for (const change of changes) {
    switch (change.type) {
      case "title_changed":
        actions.push("Revisar seu title para competir com a nova versão do concorrente");
        break;
      case "h1_changed":
        actions.push("Avaliar se seu H1 está competitivo");
        break;
      case "meta_changed":
        actions.push("Revisar meta description para manter competitividade no CTR");
        break;
      case "content_expanded":
        actions.push("Concorrente expandiu conteúdo. Expandir sua página em 150-300 palavras");
        break;
      case "faq_added":
        actions.push("Concorrente adicionou FAQs. Adicionar bloco de FAQ na sua página");
        break;
    }
  }

  return actions.join(". ");
}
