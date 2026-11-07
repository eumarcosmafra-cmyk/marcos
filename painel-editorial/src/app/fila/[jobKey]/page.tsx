"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TrabalhoView } from "@/components/real/trabalho-view";

function Conteudo() {
  const params = useParams<{ jobKey: string }>();
  const sp = useSearchParams();
  const ambiente = sp?.get("ambiente") === "teste" ? "teste" : "producao";
  return <TrabalhoView key={`${params?.jobKey}-${ambiente}`} jobKey={params?.jobKey ?? ""} ambiente={ambiente} />;
}

export default function TrabalhoPage() {
  return (
    <Suspense fallback={null}>
      <Conteudo />
    </Suspense>
  );
}
