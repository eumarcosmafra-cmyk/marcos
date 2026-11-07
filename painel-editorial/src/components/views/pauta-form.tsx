"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import type { Pauta, PautaInput, PlannedLink, RelatedContent, ResearchEvidence } from "@/domain/types";
import { INTENT_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import { useUnsavedGuard } from "@/state/unsaved-guard";
import { MarkdownView } from "@/components/markdown-view";
import { DemoTag, Field } from "@/components/ui";

export function emptyPautaInput(): PautaInput {
  return {
    title: "",
    primaryKeyword: "",
    secondaryKeywords: [],
    intent: "informacional",
    audience: "",
    question: "",
    cluster: "",
    rationale: "",
    coverageContribution: "",
    briefingMarkdown: "",
    outlineMarkdown: "",
    plannedLinks: [],
    researchEvidence: [],
    relatedContent: [],
    owner: "",
    plannedDate: "",
    priority: "media",
  };
}

export function pautaToInput(p: Pauta): PautaInput {
  return {
    title: p.title,
    primaryKeyword: p.primaryKeyword,
    secondaryKeywords: [...p.secondaryKeywords],
    intent: p.intent,
    audience: p.audience,
    question: p.question,
    cluster: p.cluster,
    rationale: p.rationale,
    coverageContribution: p.coverageContribution,
    briefingMarkdown: p.briefingMarkdown,
    outlineMarkdown: p.outlineMarkdown,
    plannedLinks: p.plannedLinks.map((l) => ({ ...l })),
    researchEvidence: p.researchEvidence.map((e) => ({ ...e })),
    relatedContent: p.relatedContent.map((r) => ({ ...r })),
    owner: p.owner ?? "",
    plannedDate: p.plannedDate ?? "",
    priority: p.priority,
  };
}

function localId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function MarkdownField({ id, label, value, onChange, hint, rows = 10 }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; rows?: number }) {
  const [preview, setPreview] = useState(false);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="field-label mb-0">{label}</label>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
          {preview ? <Pencil className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
          {preview ? "Editar" : "Prévia"}
        </button>
      </div>
      {preview ? (
        <div className="min-h-[8rem] rounded-md border border-line bg-subtle/50 px-3 py-2">
          {value.trim() ? <MarkdownView markdown={value} variant="compact" /> : <p className="text-sm text-faint">Vazio.</p>}
        </div>
      ) : (
        <textarea id={id} className="textarea" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function PautaForm({
  initial,
  clusters,
  onSubmit,
  onCancel,
  submitLabel,
  guardKey,
}: {
  initial: PautaInput;
  clusters: string[];
  onSubmit: (input: PautaInput) => Promise<boolean>;
  onCancel: () => void;
  submitLabel: string;
  guardKey: string;
}) {
  const [v, setV] = useState<PautaInput>(initial);
  const [kw2Text, setKw2Text] = useState(initial.secondaryKeywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const uid = useId();
  const { setDirty } = useUnsavedGuard();
  const initialJson = useMemo(() => JSON.stringify(initial), [initial]);
  const dirty = JSON.stringify(v) !== initialJson;

  useEffect(() => {
    setDirty(guardKey, dirty);
    return () => setDirty(guardKey, false);
  }, [dirty, guardKey, setDirty]);

  const set = <K extends keyof PautaInput>(k: K, value: PautaInput[K]) => setV((s) => ({ ...s, [k]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.title.trim() || !v.primaryKeyword.trim()) {
      setError("Preencha o título proposto e a palavra-chave principal.");
      return;
    }
    setError(undefined);
    setSaving(true);
    const clean: PautaInput = {
      ...v,
      owner: v.owner?.trim() || undefined,
      plannedDate: v.plannedDate || undefined,
      plannedLinks: v.plannedLinks.filter((l) => l.anchor.trim() || l.url.trim()),
      researchEvidence: v.researchEvidence.filter((e) => e.summary.trim() || e.source.trim()),
      relatedContent: v.relatedContent.filter((r) => r.title.trim() || r.url.trim()),
    };
    setDirty(guardKey, false);
    const ok = await onSubmit(clean);
    setSaving(false);
    if (!ok) setDirty(guardKey, true);
  };

  const fid = (n: string) => `${uid}-${n}`;

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      ) : null}

      <fieldset className="card grid gap-4 px-4 py-4 md:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Proposta</legend>
        <div className="md:col-span-2">
          <Field label="Título proposto" htmlFor={fid("title")} required>
            <input id={fid("title")} className="input" value={v.title} onChange={(e) => set("title", e.target.value)} required aria-required />
          </Field>
        </div>
        <Field label="Palavra-chave principal" htmlFor={fid("kw")} required>
          <input id={fid("kw")} className="input" value={v.primaryKeyword} onChange={(e) => set("primaryKeyword", e.target.value)} required aria-required />
        </Field>
        <Field label="Palavras-chave secundárias" htmlFor={fid("kw2")} hint="Separe por vírgula.">
          <input
            id={fid("kw2")}
            className="input"
            value={kw2Text}
            onChange={(e) => {
              setKw2Text(e.target.value);
              set("secondaryKeywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean));
            }}
          />
        </Field>
        <Field label="Intenção de busca" htmlFor={fid("intent")} hint="Use “Local” apenas quando a pesquisa indicar intenção local.">
          <select id={fid("intent")} className="input" value={v.intent} onChange={(e) => set("intent", e.target.value as PautaInput["intent"])}>
            {Object.entries(INTENT_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Prioridade" htmlFor={fid("prio")}>
          <select id={fid("prio")} className="input" value={v.priority} onChange={(e) => set("priority", e.target.value as PautaInput["priority"])}>
            {Object.entries(PRIORITY_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Público" htmlFor={fid("aud")}>
          <input id={fid("aud")} className="input" value={v.audience} onChange={(e) => set("audience", e.target.value)} />
        </Field>
        <Field label="Dúvida que o conteúdo resolve" htmlFor={fid("q")}>
          <input id={fid("q")} className="input" value={v.question} onChange={(e) => set("question", e.target.value)} />
        </Field>
        <Field label="Cluster / tema" htmlFor={fid("cluster")}>
          <input id={fid("cluster")} className="input" list={fid("clusters")} value={v.cluster} onChange={(e) => set("cluster", e.target.value)} />
          <datalist id={fid("clusters")}>
            {clusters.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Responsável" htmlFor={fid("owner")}>
          <input id={fid("owner")} className="input" value={v.owner ?? ""} onChange={(e) => set("owner", e.target.value)} />
        </Field>
        <Field label="Data editorial planejada" htmlFor={fid("date")} hint="Planejamento interno. Não agenda publicação.">
          <input id={fid("date")} type="date" className="input" value={v.plannedDate ?? ""} onChange={(e) => set("plannedDate", e.target.value)} />
        </Field>
        <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
          <Field label="Justificativa da pauta" htmlFor={fid("why")}>
            <textarea id={fid("why")} className="input" rows={3} value={v.rationale} onChange={(e) => set("rationale", e.target.value)} />
          </Field>
          <Field label="Contribuição para a cobertura do assunto" htmlFor={fid("cov")}>
            <textarea id={fid("cov")} className="input" rows={3} value={v.coverageContribution} onChange={(e) => set("coverageContribution", e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="card grid gap-4 px-4 py-4 lg:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Briefing e estrutura</legend>
        <MarkdownField id={fid("brief")} label="Briefing (Markdown)" value={v.briefingMarkdown} onChange={(x) => set("briefingMarkdown", x)} rows={14} />
        <MarkdownField id={fid("outline")} label="Estrutura sugerida (Markdown)" value={v.outlineMarkdown} onChange={(x) => set("outlineMarkdown", x)} rows={14} hint="Use títulos (##) para as seções previstas." />
      </fieldset>

      <ListEditor<PlannedLink>
        legend="Links internos previstos"
        items={v.plannedLinks}
        onChange={(items) => set("plannedLinks", items)}
        make={() => ({ id: localId("pl"), anchor: "", url: "", note: "" })}
        addLabel="Adicionar link"
        render={(item, update) => (
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            <input aria-label="Texto âncora" placeholder="Texto âncora" className="input" value={item.anchor} onChange={(e) => update({ ...item, anchor: e.target.value })} />
            <input aria-label="URL ou caminho" placeholder="/blog/..." className="input" value={item.url} onChange={(e) => update({ ...item, url: e.target.value })} />
            <input aria-label="Observação" placeholder="Observação" className="input" value={item.note ?? ""} onChange={(e) => update({ ...item, note: e.target.value })} />
          </div>
        )}
      />

      <ListEditor<ResearchEvidence>
        legend="Evidências de pesquisa"
        description="Registre a origem, a localidade e a data. Não informe volumes sem fonte."
        items={v.researchEvidence}
        onChange={(items) => set("researchEvidence", items)}
        make={() => ({ id: localId("ev"), source: "", locality: "", collectedAt: "", summary: "", url: "", isDemo: false })}
        addLabel="Adicionar evidência"
        render={(item, update) => (
          <div className="grid flex-1 gap-2 sm:grid-cols-4">
            <input aria-label="Origem" placeholder="Origem (ferramenta, base)" className="input" value={item.source} onChange={(e) => update({ ...item, source: e.target.value })} />
            <input aria-label="Localidade" placeholder="Localidade" className="input" value={item.locality ?? ""} onChange={(e) => update({ ...item, locality: e.target.value })} />
            <input aria-label="Data da coleta" type="date" className="input" value={item.collectedAt ?? ""} onChange={(e) => update({ ...item, collectedAt: e.target.value })} />
            <input aria-label="URL" placeholder="URL (opcional)" className="input" value={item.url ?? ""} onChange={(e) => update({ ...item, url: e.target.value })} />
            <textarea aria-label="Resumo da evidência" placeholder="O que a evidência mostra" className="input sm:col-span-4" rows={2} value={item.summary} onChange={(e) => update({ ...item, summary: e.target.value })} />
            {item.isDemo ? <span className="sm:col-span-4"><DemoTag>Evidência demonstrativa</DemoTag></span> : null}
          </div>
        )}
      />

      <ListEditor<RelatedContent>
        legend="Conteúdo existente relacionado"
        description="Itens adicionados aqui ficam como “sobreposição avaliada manualmente”. Nenhuma auditoria automática é feita."
        items={v.relatedContent}
        onChange={(items) => set("relatedContent", items)}
        make={() => ({ id: localId("rc"), title: "", url: "", note: "", overlap: "avaliada_manualmente", isDemo: false })}
        addLabel="Adicionar conteúdo relacionado"
        render={(item, update) => (
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <input aria-label="Título" placeholder="Título" className="input" value={item.title} onChange={(e) => update({ ...item, title: e.target.value })} />
            <input aria-label="URL" placeholder="https://" className="input" value={item.url} onChange={(e) => update({ ...item, url: e.target.value })} />
            <textarea aria-label="Observação sobre sobreposição" placeholder="Observação sobre possível sobreposição" className="input sm:col-span-2" rows={2} value={item.note} onChange={(e) => update({ ...item, note: e.target.value })} />
            {item.overlap === "simulada" ? <span className="sm:col-span-2"><DemoTag>Sobreposição simulada</DemoTag></span> : null}
          </div>
        )}
      />

      <div className="sticky bottom-0 z-10 -mx-3 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface/95 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-b-lg">
        {dirty ? <span className="mr-auto text-xs font-medium text-amber-800">Alterações não salvas</span> : null}
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function ListEditor<T extends { id: string }>({
  legend,
  description,
  items,
  onChange,
  make,
  render,
  addLabel,
}: {
  legend: string;
  description?: string;
  items: T[];
  onChange: (items: T[]) => void;
  make: () => T;
  render: (item: T, update: (next: T) => void) => React.ReactNode;
  addLabel: string;
}) {
  return (
    <fieldset className="card px-4 py-4">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      {description ? <p className="mb-3 text-xs text-muted">{description}</p> : null}
      <ul className="flex flex-col gap-3">
        {items.length === 0 ? <li className="text-sm text-faint">Nenhum item.</li> : null}
        {items.map((item, idx) => (
          <li key={item.id} className="flex items-start gap-2">
            {render(item, (next) => onChange(items.map((x, i) => (i === idx ? next : x))))}
            <button type="button" className="btn-ghost btn-sm mt-1" onClick={() => onChange(items.filter((_, i) => i !== idx))} aria-label={`Remover item ${idx + 1} de ${legend}`}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => onChange([...items, make()])}>
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {addLabel}
      </button>
    </fieldset>
  );
}
