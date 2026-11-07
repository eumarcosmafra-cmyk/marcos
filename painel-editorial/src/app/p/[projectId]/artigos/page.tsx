"use client";

import { Suspense } from "react";
import { ArticlesView } from "@/components/views/articles";
import { WithWorkspace } from "@/components/with-workspace";
import { LoadingState } from "@/components/ui";

export default function ArtigosPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <WithWorkspace>{(ws) => <ArticlesView ws={ws} />}</WithWorkspace>
    </Suspense>
  );
}
