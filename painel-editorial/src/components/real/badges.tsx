"use client";

import { FlaskConical, ShieldCheck } from "lucide-react";
import type { Ambiente } from "@/lib/fila-types";

export function AmbienteBadge({ ambiente }: { ambiente: Ambiente }) {
  return ambiente === "producao" ? (
    <span className="chip border-emerald-300 bg-emerald-50 text-emerald-900">
      <ShieldCheck className="h-3 w-3" aria-hidden /> Produção
    </span>
  ) : (
    <span className="chip border-amber-300 bg-amber-50 text-amber-950">
      <FlaskConical className="h-3 w-3" aria-hidden /> Teste
    </span>
  );
}

