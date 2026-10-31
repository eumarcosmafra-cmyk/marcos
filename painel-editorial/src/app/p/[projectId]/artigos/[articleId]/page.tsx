"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ArticleWorkspace } from "@/components/views/article-workspace";
import { WithWorkspace } from "@/components/with-workspace";
import { ErrorState, LoadingState } from "@/components/ui";
import { Link } from "@/state/unsaved-guard";

export default function ArtigoPage() {
  const params = useParams<{ projectId: string; articleId: string }>();
  return (
    <Suspense fallback={<LoadingState />}>
      <WithWorkspace>
        {(ws, handle) => {
          const article = ws.articles.find((a) => a.id === params?.articleId);
          if (!article) {
            return (
              <ErrorState title="Artigo não encontrado neste projeto" action={<Link className="btn-secondary" href={`/p/${ws.project.id}/artigos`}>Voltar aos artigos</Link>}>
                Ele pode pertencer a outro projeto ou ter sido removido ao restaurar a demonstração.
              </ErrorState>
            );
          }
          return <ArticleWorkspace key={article.id} ws={ws} article={article} execute={handle.execute} />;
        }}
      </WithWorkspace>
    </Suspense>
  );
}
