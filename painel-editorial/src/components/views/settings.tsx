"use client";

import { ExternalLink, FlaskConical, PlugZap, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ProjectWorkspace, ReviewerIdentity, ReviewerRole } from "@/domain/types";
import { KNOWN_STATUSES, REDACAO_FIELDS } from "@/domain/workflow-mapping";
import { formatDateTime } from "@/lib/format";
import { AGENT_STAGES, ROLE_LABEL } from "@/lib/labels";
import { useEditorial, type WorkspaceHandle } from "@/state/editorial";
import { useToast } from "@/state/toast";
import { useUnsavedGuard } from "@/state/unsaved-guard";
import { DemoTag, Field, Notice, PageHeader, SectionCard } from "@/components/ui";

type ProjectForm = {
  name: string;
  shortName: string;
  siteUrl: string;
  location: string;
  audience: string;
  editorialDirection: string;
  technicalOwner: string;
  requiresSpecialistReview: boolean;
};

export function SettingsView({ ws, execute }: { ws: ProjectWorkspace; execute: WorkspaceHandle["execute"] }) {
  const p = ws.project;
  const initial = useMemo<ProjectForm>(
    () => ({
      name: p.name,
      shortName: p.shortName,
      siteUrl: p.siteUrl,
      location: p.location ?? "",
      audience: p.audience,
      editorialDirection: p.editorialDirection,
      technicalOwner: p.technicalOwner,
      requiresSpecialistReview: p.requiresSpecialistReview,
    }),
    [p],
  );
  const [form, setForm] = useState<ProjectForm>(initial);
  useEffect(() => setForm(initial), [initial]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const { setDirty } = useUnsavedGuard();
  useEffect(() => {
    setDirty("projeto", dirty);
    return () => setDirty("projeto", false);
  }, [dirty, setDirty]);

  const set = <K extends keyof ProjectForm>(k: K, v: ProjectForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow={p.name} title="Projeto e configurações" description="Dados do cliente, integrações futuras, inventário de conteúdo e modo demonstração." />

      <div className="flex flex-col gap-5">
        <SectionCard
          title="Dados do projeto"
          description={
            <span className="flex flex-wrap items-center gap-1.5">
              {p.isDemo ? <DemoTag>Projeto demonstrativo</DemoTag> : null}
              <span>{p.origin.label}</span>
              {p.origin.ref ? <span className="font-mono">({p.origin.ref})</span> : null}
            </span>
          }
        >
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await execute({ type: "project.update", patch: { ...form, location: form.location || undefined } });
            }}
          >
            <Field label="Cliente" htmlFor="pj-name"><input id="pj-name" className="input" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Nome curto" htmlFor="pj-short"><input id="pj-short" className="input" value={form.shortName} onChange={(e) => set("shortName", e.target.value)} /></Field>
            <Field label="Site" htmlFor="pj-site" hint={p.siteStack ? `Stack informada: ${p.siteStack}` : undefined}><input id="pj-site" className="input" value={form.siteUrl} onChange={(e) => set("siteUrl", e.target.value)} /></Field>
            <Field label="Localização" htmlFor="pj-loc"><input id="pj-loc" className="input" value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Público" htmlFor="pj-aud"><textarea id="pj-aud" className="input" rows={2} value={form.audience} onChange={(e) => set("audience", e.target.value)} /></Field></div>
            <div className="md:col-span-2"><Field label="Direção editorial" htmlFor="pj-dir"><textarea id="pj-dir" className="input" rows={3} value={form.editorialDirection} onChange={(e) => set("editorialDirection", e.target.value)} /></Field></div>
            <Field label="Responsável técnico" htmlFor="pj-owner"><input id="pj-owner" className="input" value={form.technicalOwner} onChange={(e) => set("technicalOwner", e.target.value)} /></Field>
            <div className="flex items-start gap-2 pt-6">
              <input id="pj-spec" type="checkbox" className="mt-1 h-4 w-4" checked={form.requiresSpecialistReview} onChange={(e) => set("requiresSpecialistReview", e.target.checked)} />
              <label htmlFor="pj-spec" className="text-sm">
                Exigir revisão do especialista/professor antes da aprovação final
                <span className="block text-xs text-faint">Vale para a avaliação das versões a partir de agora.</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 md:col-span-2">
              {dirty ? <span className="mr-auto text-xs font-medium text-amber-800">Alterações não salvas</span> : null}
              <button type="button" className="btn-secondary" disabled={!dirty} onClick={() => setForm(initial)}>Descartar</button>
              <button type="submit" className="btn-primary" disabled={!dirty}><Save className="h-4 w-4" aria-hidden /> Salvar dados do projeto</button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Integrações" description="Espaço reservado para o estado das conexões. Nenhuma está ativa nesta entrega.">
          <ul className="grid gap-2 md:grid-cols-3">
            {p.integrations.map((i) => (
              <li key={i.key} className="rounded-md border border-line px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{i.label}</span>
                </div>
                <span className="pending-tag mt-1.5"><PlugZap className="h-3 w-3" aria-hidden /> Não conectado</span>
                <p className="mt-1.5 text-xs text-muted">{i.note}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Etapas dos agentes" description="Referência do fluxo. Nenhum agente aparece como ativo: não há evidência de integração.">
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {AGENT_STAGES.map((a, idx) => (
              <li key={a.key} className="rounded-md border border-line px-3 py-2">
                <p className="text-xs text-faint">{idx + 1}</p>
                <p className="text-sm font-medium">{a.label}</p>
                <p className="mt-0.5 text-xs text-muted">{a.role}</p>
                <span className="pending-tag mt-1.5">Não integrado</span>
              </li>
            ))}
          </ol>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-medium text-brand-800">Mapeamento preparado para as saídas dos workflows</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {Object.entries(KNOWN_STATUSES).map(([k, v]) => (
                <li key={k}><code className="rounded bg-subtle px-1 text-xs">{k}</code> → {v.effect}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Campos aceitos da saída de redação (todos opcionais): {REDACAO_FIELDS.map((f) => <code key={f} className="mr-1 rounded bg-subtle px-1">{f}</code>)}
            </p>
          </details>
        </SectionCard>

        <SectionCard
          title="Inventário de conteúdos existentes"
          description="Apoia a decisão de novas pautas. A coleta automática do site não está conectada."
        >
          {ws.inventory.length === 0 ? (
            <p className="text-sm text-faint">Nenhum conteúdo inventariado.</p>
          ) : (
            <>
              {ws.inventory.some((i) => i.isDemo) ? (
                <Notice tone="warning" icon={FlaskConical} className="mb-3">
                  Lista demonstrativa. As URLs marcadas como “(Exemplo)” não foram verificadas e podem não existir no site.
                </Notice>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-head">
                      <th scope="col" className="px-2 py-2">Título</th>
                      <th scope="col" className="px-2 py-2">Tema</th>
                      <th scope="col" className="px-2 py-2">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ws.inventory.map((i) => (
                      <tr key={i.id} className="border-b border-line last:border-0 align-top">
                        <td className="px-2 py-2">{i.title}{i.note ? <span className="block text-xs text-faint">{i.note}</span> : null}</td>
                        <td className="px-2 py-2 text-muted">{i.topic}</td>
                        <td className="break-all px-2 py-2 text-xs">
                          <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={i.url} target="_blank" rel="noopener noreferrer nofollow">
                            {i.url} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SectionCard>

        <DemoModeSettings />
      </div>
    </div>
  );
}

function DemoModeSettings() {
  const { settings, saveSettings, resetDemo, activeReviewer } = useEditorial();
  const toast = useToast();
  const [name, setName] = useState("");
  const [role, setRole] = useState<ReviewerRole>("editor");
  if (!settings) return null;

  const add = async () => {
    if (!name.trim()) return;
    const id = `rev-local-${Date.now().toString(36)}`;
    const next: ReviewerIdentity = { id, name: name.trim(), role, isLocal: true };
    await saveSettings({ ...settings, reviewers: [...settings.reviewers, next] });
    setName("");
    toast.show({ tone: "success", message: "Identidade local adicionada." });
  };

  const remove = async (id: string) => {
    if (settings.reviewers.length <= 1) return;
    const reviewers = settings.reviewers.filter((r) => r.id !== id);
    await saveSettings({ reviewers, activeReviewerId: settings.activeReviewerId === id ? reviewers[0].id : settings.activeReviewerId });
  };

  return (
    <section id="modo-demonstracao" className="card scroll-mt-20 border-amber-300" aria-labelledby="demo-title">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
        <h2 id="demo-title" className="flex items-center gap-1.5 text-sm font-semibold text-amber-950">
          <FlaskConical className="h-4 w-4" aria-hidden /> Modo demonstração — dados locais
        </h2>
      </div>
      <div className="flex flex-col gap-4 px-4 py-3 text-sm">
        <ul className="list-disc pl-5 text-muted">
          <li>Todos os dados ficam somente neste navegador (localStorage), separados por projeto.</li>
          <li>Os nomes dos revisores são <strong className="text-ink">identificações locais, sem autenticação real</strong>. Qualquer pessoa com acesso a este navegador pode escolher qualquer identidade.</li>
          <li>Não há controle de acesso, isolamento no servidor nem persistência compartilhada. Isso é obrigatório antes do uso em produção (ver INTEGRACAO_FUTURA.md).</li>
          <li>Nenhuma chave, senha ou token é armazenado ou exigido.</li>
        </ul>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Identidades locais</h3>
          <ul className="flex flex-col gap-1.5">
            {settings.reviewers.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line px-3 py-1.5">
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted">{ROLE_LABEL[r.role]}</span>
                {activeReviewer?.id === r.id ? <span className="chip border-brand-300 bg-brand-50 text-brand-900">Em uso</span> : null}
                <button type="button" className="btn-ghost btn-sm ml-auto" disabled={settings.reviewers.length <= 1} onClick={() => void remove(r.id)} aria-label={`Remover ${r.name}`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="new-rev" className="mb-0.5 block text-xs text-muted">Nome</label>
              <input id="new-rev" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="new-rev-role" className="mb-0.5 block text-xs text-muted">Papel</label>
              <select id="new-rev-role" className="input" value={role} onChange={(e) => setRole(e.target.value as ReviewerRole)}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-secondary" onClick={() => void add()} disabled={!name.trim()}>
              <Plus className="h-4 w-4" aria-hidden /> Adicionar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (window.confirm("Restaurar os dados de demonstração? Todas as alterações feitas neste navegador serão apagadas.")) {
                void resetDemo().then(() => toast.show({ tone: "success", message: `Dados de demonstração restaurados em ${formatDateTime(new Date().toISOString())}.` }));
              }
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Restaurar dados de demonstração
          </button>
          <span className="text-xs text-faint">Apaga pautas, versões, comentários e decisões criados neste navegador.</span>
        </div>
      </div>
    </section>
  );
}
