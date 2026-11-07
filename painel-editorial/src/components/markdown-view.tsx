"use client";

import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ImageOff } from "lucide-react";

/**
 * Renderização segura de Markdown.
 *
 * - Nenhum plugin de HTML bruto é usado: HTML escrito no conteúdo é exibido como
 *   TEXTO (nunca interpretado), então <script>, atributos on* e afins não executam.
 * - URLs passam pelo `defaultUrlTransform` (bloqueia javascript:, data:, vbscript:).
 * - Imagens não são carregadas na prévia (evita requisições a terceiros); aparecem
 *   como marcador com o texto alternativo.
 * - Links relativos são resolvidos contra o site do cliente e abrem em nova aba.
 */

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

function htmlAsText() {
  const walk = (node: MdNode) => {
    if (node.type === "html") node.type = "text";
    node.children?.forEach(walk);
  };
  return (tree: MdNode) => walk(tree);
}

function resolveHref(href: string | undefined, baseUrl?: string): string | undefined {
  if (!href) return undefined;
  const safe = defaultUrlTransform(href);
  if (!safe) return undefined;
  if (safe.startsWith("#")) return safe;
  try {
    if (baseUrl && safe.startsWith("/")) return new URL(safe, baseUrl).toString();
    return new URL(safe).toString();
  } catch {
    // URL relativa sem base conhecida: mantida como texto do link, sem navegação.
    return undefined;
  }
}

export function MarkdownView({
  markdown,
  baseUrl,
  variant = "article",
}: {
  markdown: string;
  baseUrl?: string;
  variant?: "article" | "compact";
}) {
  // A página já tem um <h1>; os títulos do conteúdo descem um nível para manter a
  // hierarquia acessível, preservando o visual de cada nível do Markdown.
  const components: Components = {
    h1: ({ children }) => <h2 className="md-h1">{children}</h2>,
    h2: ({ children }) => <h3 className="md-h2">{children}</h3>,
    h3: ({ children }) => <h4 className="md-h3">{children}</h4>,
    h4: ({ children }) => <h5 className="md-h4">{children}</h5>,
    h5: ({ children }) => <h6 className="md-h4">{children}</h6>,
    h6: ({ children }) => <h6 className="md-h4">{children}</h6>,
    a: ({ href, children }) => {
      const resolved = resolveHref(href, baseUrl);
      if (!resolved) return <span className="underline decoration-dotted" title="Link sem destino válido">{children}</span>;
      if (resolved.startsWith("#")) return <a href={resolved}>{children}</a>;
      return (
        <a href={resolved} target="_blank" rel="noopener noreferrer nofollow" title={resolved}>
          {children}
        </a>
      );
    },
    img: ({ alt, src }) => (
      <span className="not-prose my-2 inline-flex items-center gap-2 rounded border border-dashed border-line-strong px-2 py-1 font-sans text-xs text-muted">
        <ImageOff className="h-3.5 w-3.5" aria-hidden />
        Imagem não carregada na prévia{alt ? `: ${alt}` : ""}
        {typeof src === "string" && src ? <span className="truncate font-mono">({src})</span> : null}
      </span>
    ),
  };
  return (
    <div className={variant === "article" ? "article-prose" : "prose-compact"}>
      <ReactMarkdown remarkPlugins={[remarkGfm, htmlAsText]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
