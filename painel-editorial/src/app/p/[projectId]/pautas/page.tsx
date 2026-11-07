"use client";

import { Suspense } from "react";
import { PautasView } from "@/components/views/pautas";
import { WithWorkspace } from "@/components/with-workspace";
import { LoadingState } from "@/components/ui";

export default function PautasPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <WithWorkspace>{(ws) => <PautasView ws={ws} />}</WithWorkspace>
    </Suspense>
  );
}
