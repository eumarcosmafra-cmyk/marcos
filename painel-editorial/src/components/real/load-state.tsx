"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { ApiError } from "./api";

/** Erro identificável (código + mensagem) com ação de tentar de novo. Nunca troca por dados simulados. */
export function LoadError({ error, onRetry, titulo = "Não foi possível carregar os dados reais" }: { error: unknown; onRetry: () => void; titulo?: string }) {
  const e = error instanceof ApiError ? error : null;
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-5 py-5 text-red-950">
      <div className="flex items-center gap-2 font-medium">
        <WifiOff className="h-4 w-4" aria-hidden />
        {titulo}
      </div>
      <p className="text-sm">{e ? e.message : "Erro inesperado."}</p>
      <p className="text-xs">
        Código: <code className="rounded bg-red-100 px-1 font-mono">{e?.codigo ?? "ERRO_INESPERADO"}</code>
        {e?.detalhe && typeof e.detalhe.codigo_fila === "string" ? (
          <>
            {" "}· fila: <code className="rounded bg-red-100 px-1 font-mono">{e.detalhe.codigo_fila}</code>
          </>
        ) : null}
        {e && e.status ? <> · HTTP {e.status}</> : null}
      </p>
      <button type="button" className="btn-secondary mt-1" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden /> Tentar novamente
      </button>
    </div>
  );
}

export function ActionError({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error instanceof ApiError ? error : null;
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-950">
      <p>{e ? e.message : "Erro inesperado."}</p>
      <p className="mt-0.5 text-xs">
        Código: <code className="font-mono">{e?.codigo ?? "ERRO_INESPERADO"}</code>
        {e?.detalhe && typeof e.detalhe.codigo_fila === "string" ? <> · fila: <code className="font-mono">{e.detalhe.codigo_fila}</code></> : null}
        {e?.resultadoIncerto ? " · O resultado é incerto: recarregue antes de repetir. Repetir a mesma ação é seguro (mesmo identificador)." : null}
      </p>
    </div>
  );
}
