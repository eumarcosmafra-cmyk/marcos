"use client";

import { diffLines, diffWordsWithSpace, type Change } from "diff";
import { Fragment, useMemo, useState } from "react";

interface Row {
  kind: "same" | "add" | "del" | "mod";
  oldText?: string;
  newText?: string;
  inline?: Change[];
}

function splitLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function buildDiffRows(a: string, b: string): Row[] {
  const parts = diffLines(a, b);
  const rows: Row[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    const next = parts[i + 1];
    if (p.removed && next?.added) {
      const oldLines = splitLines(p.value);
      const newLines = splitLines(next.value);
      const n = Math.max(oldLines.length, newLines.length);
      for (let j = 0; j < n; j += 1) {
        const o = oldLines[j];
        const nw = newLines[j];
        if (o !== undefined && nw !== undefined) rows.push({ kind: "mod", oldText: o, newText: nw, inline: diffWordsWithSpace(o, nw) });
        else if (o !== undefined) rows.push({ kind: "del", oldText: o });
        else rows.push({ kind: "add", newText: nw });
      }
      i += 1;
      continue;
    }
    for (const line of splitLines(p.value)) {
      if (p.added) rows.push({ kind: "add", newText: line });
      else if (p.removed) rows.push({ kind: "del", oldText: line });
      else rows.push({ kind: "same", oldText: line, newText: line });
    }
  }
  return rows;
}

type Segment = { kind: "rows"; rows: Row[] } | { kind: "fold"; id: number; rows: Row[] };

const CONTEXT = 2;

/** Agrupa linhas iguais longas em blocos recolhíveis, mantendo contexto ao redor das mudanças. */
function segment(rows: Row[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  let foldId = 0;
  while (i < rows.length) {
    if (rows[i].kind !== "same") {
      out.push({ kind: "rows", rows: [rows[i]] });
      i += 1;
      continue;
    }
    let j = i;
    while (j < rows.length && rows[j].kind === "same") j += 1;
    const run = rows.slice(i, j);
    const head = i === 0 ? 0 : CONTEXT;
    const tail = j === rows.length ? 0 : CONTEXT;
    if (run.length > head + tail + 2) {
      if (head) out.push({ kind: "rows", rows: run.slice(0, head) });
      out.push({ kind: "fold", id: foldId++, rows: run.slice(head, run.length - tail) });
      if (tail) out.push({ kind: "rows", rows: run.slice(run.length - tail) });
    } else out.push({ kind: "rows", rows: run });
    i = j;
  }
  return out;
}

export function VersionDiff({ before, after, labelBefore, labelAfter }: { before: string; after: string; labelBefore: string; labelAfter: string }) {
  const rows = useMemo(() => buildDiffRows(before, after), [before, after]);
  const segments = useMemo(() => segment(rows), [rows]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const stats = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const r of rows) {
      if (r.kind === "add") add += 1;
      if (r.kind === "del") del += 1;
      if (r.kind === "mod") {
        add += 1;
        del += 1;
      }
    }
    return { add, del };
  }, [rows]);

  if (before === after) {
    return <p className="rounded-md border border-line bg-subtle px-3 py-2 text-sm text-muted">As duas versões têm o mesmo texto.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>
          Comparando <strong className="text-ink">{labelBefore}</strong> → <strong className="text-ink">{labelAfter}</strong>
        </span>
        <span className="diff-add rounded px-1.5 py-0.5 font-medium">+{stats.add} linha(s)</span>
        <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-900">−{stats.del} linha(s)</span>
        <span>Legenda: <span className="diff-add rounded px-1">acrescentado</span> <span className="diff-del rounded px-1">removido</span></span>
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full border-collapse font-mono text-[12.5px] leading-relaxed">
          <caption className="sr-only">Diferenças entre {labelBefore} e {labelAfter}</caption>
          <tbody>
            {segments.map((seg, sIdx) => {
              if (seg.kind === "fold" && !open.has(seg.id)) {
                return (
                  <tr key={`f-${sIdx}`} className="bg-subtle">
                    <td className="border-r border-line" aria-hidden />
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        className="font-sans text-xs font-medium text-brand-800 hover:underline"
                        onClick={() => setOpen((prev) => new Set(prev).add(seg.id))}
                      >
                        Mostrar {seg.rows.length} linhas sem alteração
                      </button>
                    </td>
                  </tr>
                );
              }
              return (
                <Fragment key={`s-${sIdx}`}>
            {seg.rows.map((r, idx) => {
              if (r.kind === "same") {
                return (
                  <tr key={idx}>
                    <td className="w-6 select-none border-r border-line px-1 text-center text-faint" aria-hidden> </td>
                    <td className="whitespace-pre-wrap break-words px-2 text-muted">{r.newText || " "}</td>
                  </tr>
                );
              }
              if (r.kind === "add") {
                return (
                  <tr key={idx} className="diff-add">
                    <td className="w-6 select-none border-r border-line px-1 text-center" title="Linha acrescentada">+</td>
                    <td className="whitespace-pre-wrap break-words px-2"><span className="sr-only">Acrescentado: </span>{r.newText || " "}</td>
                  </tr>
                );
              }
              if (r.kind === "del") {
                return (
                  <tr key={idx} className="diff-del">
                    <td className="w-6 select-none border-r border-line px-1 text-center" title="Linha removida">−</td>
                    <td className="whitespace-pre-wrap break-words px-2"><span className="sr-only">Removido: </span>{r.oldText || " "}</td>
                  </tr>
                );
              }
              return (
                <tr key={idx} className="bg-amber-50/60">
                  <td className="w-6 select-none border-r border-line px-1 text-center text-amber-900" title="Linha alterada">~</td>
                  <td className="whitespace-pre-wrap break-words px-2">
                    <span className="sr-only">Alterado: </span>
                    {r.inline?.map((c, j) =>
                      c.added ? (
                        <ins key={j} className="diff-add rounded-sm no-underline">{c.value}</ins>
                      ) : c.removed ? (
                        <del key={j} className="diff-del rounded-sm">{c.value}</del>
                      ) : (
                        <span key={j}>{c.value}</span>
                      ),
                    )}
                  </td>
                </tr>
              );
            })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
