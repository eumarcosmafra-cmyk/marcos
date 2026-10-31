import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownView } from "@/components/markdown-view";
import { buildDiffRows } from "@/components/version-diff";

describe("MarkdownView (renderização segura)", () => {
  const html = renderToStaticMarkup(
    <MarkdownView
      baseUrl="https://altovaletopteam.com.br/"
      markdown={[
        "# Título",
        "",
        "<script>alert(1)</script>",
        "",
        'Texto <img src="x" onerror="alert(2)"> inline.',
        "",
        "[js](javascript:alert(3)) [dados](data:text/html;base64,PHNjcmlwdD4=) [interno](/blog/x) [externo](https://example.com/a)",
        "",
        "![foto](https://example.com/rastreio.png)",
      ].join("\n")}
    />,
  );

  it("não gera elementos script/img nem atributos de evento", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/<[^>]*\sonerror=/i);
  });

  it("exibe o HTML do conteúdo como texto", () => {
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("neutraliza javascript: e data:", () => {
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toMatch(/href="data:/i);
  });

  it("resolve links relativos no site do cliente e abre externos com rel seguro", () => {
    expect(html).toContain('href="https://altovaletopteam.com.br/blog/x"');
    expect(html).toMatch(/href="https:\/\/example.com\/a" target="_blank" rel="noopener noreferrer nofollow"/);
  });

  it("o título do conteúdo não vira um segundo h1 da página", () => {
    expect(html).not.toMatch(/<h1/);
    expect(html).toContain('<h2 class="md-h1">Título</h2>');
  });
});

describe("buildDiffRows", () => {
  it("marca linhas acrescentadas, removidas e alteradas", () => {
    const rows = buildDiffRows("a\nb\nc\n", "a\nB\nc\nd\n");
    expect(rows.map((r) => r.kind)).toEqual(["same", "mod", "same", "add"]);
  });
});
