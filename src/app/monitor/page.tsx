"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Play,
  RefreshCw,
  Shield,
  Target,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  type: string;
  title: string;
  message: string;
  recommendedAction: string | null;
  status: "OPEN" | "DISMISSED" | "DONE";
  createdAt: string;
  categoryWatch?: { name: string } | null;
  trackedQuery?: { query: string } | null;
}

interface Action {
  id: string;
  priorityScore: number;
  priorityLabel: "HIGH" | "MEDIUM" | "LOW";
  actionType: string;
  actionTitle: string;
  actionDescription: string;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  createdAt: string;
  categoryWatch?: { name: string } | null;
  trackedQuery?: { query: string } | null;
}

interface CategoryWatch {
  id: string;
  name: string;
  targetUrl: string;
  isActive: boolean;
  trackedQueries: { id: string; query: string; isPrimary: boolean }[];
}

interface ClientOption {
  id: string;
  name: string;
  domain: string;
}

export default function MonitorPage() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [categories, setCategories] = useState<CategoryWatch[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"alerts" | "actions" | "categories">("actions");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Setup form
  const [showSetup, setShowSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupUrl, setSetupUrl] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [suggestedQueries, setSuggestedQueries] = useState<
    { query: string; impressions: number; position: number; relevanceScore: number }[]
  >([]);
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<string>("");
  const [selectedRelated, setSelectedRelated] = useState<string[]>([]);

  // Fetch clients — auto-sync from GSC if DB is empty
  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        let list = data.clients || data || [];

        // If no clients in DB, try syncing from GSC
        if (list.length === 0) {
          const syncRes = await fetch("/api/gsc/sync", { method: "POST" });
          const syncData = await syncRes.json();
          if (syncData.clients) {
            list = syncData.clients;
          }
        }

        setClients(list);
        if (list.length > 0 && !selectedClient) {
          setSelectedClient(list[0].id);
        }
      } catch {}
    }
    loadClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadClientData = useCallback(async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const [alertsRes, actionsRes, categoriesRes] = await Promise.all([
        fetch(`/api/alerts?clientId=${selectedClient}`).then((r) => r.json()),
        fetch(`/api/action-queue?clientId=${selectedClient}`).then((r) => r.json()),
        fetch(`/api/category-watch?clientId=${selectedClient}`).then((r) => r.json()),
      ]);
      setAlerts(alertsRes.alerts || []);
      setActions(actionsRes.actions || []);
      setCategories(categoriesRes.categories || []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [selectedClient]);

  useEffect(() => {
    loadClientData();
  }, [loadClientData]);

  const handleSetupCategory = async () => {
    if (!setupName || !setupUrl || !selectedClient) return;
    setSetupLoading(true);
    try {
      const res = await fetch("/api/category-watch/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient,
          categoryName: setupName,
          targetUrl: setupUrl,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setNewCategoryId(data.categoryWatch.id);
      setSuggestedQueries(data.suggestedQueries || []);
      if (data.suggestedQueries?.length > 0) {
        setSelectedPrimary(data.suggestedQueries[0].query);
      }
    } catch {
      alert("Erro ao criar categoria");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleSelectQueries = async () => {
    if (!newCategoryId || !selectedPrimary || selectedRelated.length === 0) return;
    setSetupLoading(true);
    try {
      await fetch("/api/category-watch/select-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryWatchId: newCategoryId,
          primaryQuery: selectedPrimary,
          relatedQueries: selectedRelated,
        }),
      });
      setShowSetup(false);
      setNewCategoryId(null);
      setSuggestedQueries([]);
      setSetupName("");
      setSetupUrl("");
      setSelectedPrimary("");
      setSelectedRelated([]);
      loadClientData();
    } catch {
      alert("Erro ao salvar queries");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleAlertAction = async (id: string, status: string) => {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadClientData();
  };

  const handleActionStatus = async (id: string, status: string) => {
    await fetch(`/api/action-queue/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadClientData();
  };

  const criticalCount = alerts.filter(
    (a) => a.severity === "CRITICAL" && a.status === "OPEN"
  ).length;
  const warningCount = alerts.filter(
    (a) => a.severity === "WARNING" && a.status === "OPEN"
  ).length;
  const openActions = actions.filter((a) => a.status === "OPEN").length;

  const toggleRelated = (query: string) => {
    if (query === selectedPrimary) return;
    setSelectedRelated((prev) =>
      prev.includes(query)
        ? prev.filter((q) => q !== query)
        : prev.length < 5
          ? [...prev, query]
          : prev
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="flex items-center gap-2 text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            <Shield className="h-5 w-5 text-brand-500" />
            Monitor Operacional
          </h1>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Alertas, ações e categorias monitoradas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="input-field w-48"
          >
            <option value="">Selecione cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={loadClientData}
            disabled={loading}
            className="btn-secondary flex items-center gap-1"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-2xl font-bold text-red-400">{criticalCount}</span>
          </div>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            Alertas Críticos
          </p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-400">{warningCount}</span>
          </div>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            Warnings
          </p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-400" />
            <span className="text-2xl font-bold text-brand-400">{openActions}</span>
          </div>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            Ações Pendentes
          </p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-emerald-400" />
            <span className="text-2xl font-bold text-emerald-400">
              {categories.length}
            </span>
          </div>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            Categorias Monitoradas
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        {[
          { key: "actions" as const, label: "Ações da Semana", count: openActions },
          { key: "alerts" as const, label: "Alertas", count: criticalCount + warningCount },
          { key: "categories" as const, label: "Categorias", count: categories.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-b-2 border-brand-500 text-brand-400"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-600/20 px-1.5 py-0.5 text-[10px] text-brand-400">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Actions Tab */}
      {activeTab === "actions" && (
        <div className="glass-card overflow-hidden">
          {actions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <CheckCircle2 className="h-8 w-8" style={{ color: "var(--text-faint)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhuma ação pendente
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  {["Prioridade", "Categoria", "Query", "Tipo", "Ação Recomendada", "Status"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-[10px] font-medium uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actions.map((action) => (
                  <tr
                    key={action.id}
                    className="transition-colors hover:bg-[var(--glass-hover)]"
                    style={{ borderBottom: "1px solid var(--glass-border)" }}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          action.priorityLabel === "HIGH" && "bg-red-500/10 text-red-400",
                          action.priorityLabel === "MEDIUM" && "bg-yellow-500/10 text-yellow-400",
                          action.priorityLabel === "LOW" && "bg-blue-500/10 text-blue-400"
                        )}
                      >
                        {action.priorityLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {action.categoryWatch?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {action.trackedQuery?.query || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {action.actionType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {action.actionDescription}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {action.status === "OPEN" && (
                          <>
                            <button
                              onClick={() => handleActionStatus(action.id, "IN_PROGRESS")}
                              className="rounded bg-brand-600/20 px-2 py-1 text-[10px] text-brand-400 hover:bg-brand-600/30"
                            >
                              <Play className="inline h-3 w-3" /> Iniciar
                            </button>
                            <button
                              onClick={() => handleActionStatus(action.id, "DONE")}
                              className="rounded bg-emerald-600/20 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-600/30"
                            >
                              <CheckCircle2 className="inline h-3 w-3" /> Feito
                            </button>
                          </>
                        )}
                        {action.status === "IN_PROGRESS" && (
                          <button
                            onClick={() => handleActionStatus(action.id, "DONE")}
                            className="rounded bg-emerald-600/20 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-600/30"
                          >
                            <CheckCircle2 className="inline h-3 w-3" /> Concluir
                          </button>
                        )}
                        {action.status === "DONE" && (
                          <span className="text-[10px] text-emerald-400">Concluído</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="glass-card flex flex-col items-center gap-2 p-12 text-center">
              <Shield className="h-8 w-8" style={{ color: "var(--text-faint)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhum alerta
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "glass-card p-4",
                  alert.status !== "OPEN" && "opacity-50"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {alert.severity === "CRITICAL" ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    ) : alert.severity === "WARNING" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                    ) : (
                      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {alert.message}
                      </p>
                      {alert.recommendedAction && (
                        <p className="mt-2 text-xs font-medium text-brand-400">
                          Acao: {alert.recommendedAction}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {alert.categoryWatch && (
                          <span>{alert.categoryWatch.name}</span>
                        )}
                        {alert.trackedQuery && (
                          <span>Query: {alert.trackedQuery.query}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(alert.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {alert.status === "OPEN" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAlertAction(alert.id, "DONE")}
                        className="rounded bg-emerald-600/20 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-600/30"
                      >
                        Resolver
                      </button>
                      <button
                        onClick={() => handleAlertAction(alert.id, "DISMISSED")}
                        className="rounded px-2 py-1 text-[10px] hover:bg-[var(--glass-hover)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Ignorar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <div className="space-y-3">
          <button
            onClick={() => setShowSetup(!showSetup)}
            className="btn-primary"
          >
            + Nova Categoria
          </button>

          {/* Setup Form */}
          {showSetup && (
            <div className="glass-card space-y-4 p-5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Configurar Categoria Monitorada
              </h3>

              {!newCategoryId ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nome da categoria (ex: Bota Cano Alto)"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    className="input-field"
                  />
                  <input
                    type="text"
                    placeholder="URL da categoria (ex: https://site.com/bota-cano-alto)"
                    value={setupUrl}
                    onChange={(e) => setSetupUrl(e.target.value)}
                    className="input-field"
                  />
                  <button
                    onClick={handleSetupCategory}
                    disabled={setupLoading || !setupName || !setupUrl}
                    className="btn-primary"
                  >
                    {setupLoading ? "Buscando queries do GSC..." : "Buscar Queries"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Selecione a query principal e 1-5 queries relacionadas:
                  </p>
                  <div className="space-y-1">
                    {suggestedQueries.map((q) => (
                      <div
                        key={q.query}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors",
                          selectedPrimary === q.query
                            ? "bg-brand-600/20"
                            : selectedRelated.includes(q.query)
                              ? "bg-emerald-600/10"
                              : "hover:bg-[var(--glass-hover)]"
                        )}
                      >
                        <div
                          className="flex-1"
                          onClick={() => {
                            setSelectedPrimary(q.query);
                            setSelectedRelated((prev) =>
                              prev.filter((p) => p !== q.query)
                            );
                          }}
                        >
                          <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                            {q.query}
                          </span>
                          <span className="ml-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {q.impressions} imp | pos {q.position.toFixed(1)}
                          </span>
                        </div>
                        {selectedPrimary === q.query ? (
                          <span className="text-[10px] font-medium text-brand-400">
                            PRINCIPAL
                          </span>
                        ) : (
                          <button
                            onClick={() => toggleRelated(q.query)}
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px]",
                              selectedRelated.includes(q.query)
                                ? "bg-emerald-600/20 text-emerald-400"
                                : "text-[var(--text-muted)] hover:bg-[var(--glass-hover)]"
                            )}
                          >
                            {selectedRelated.includes(q.query)
                              ? "Selecionada"
                              : "Relacionar"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleSelectQueries}
                    disabled={
                      setupLoading ||
                      !selectedPrimary ||
                      selectedRelated.length === 0
                    }
                    className="btn-primary"
                  >
                    {setupLoading
                      ? "Salvando e mapeando SERP..."
                      : `Salvar cluster (1 principal + ${selectedRelated.length} relacionadas)`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Categories List */}
          {categories.map((cat) => (
            <div key={cat.id} className="glass-card overflow-hidden">
              <button
                onClick={() =>
                  setExpandedCategory(
                    expandedCategory === cat.id ? null : cat.id
                  )
                }
                className="flex w-full items-center justify-between p-4"
              >
                <div className="flex items-center gap-2">
                  {expandedCategory === cat.id ? (
                    <ChevronDown className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                  )}
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {cat.name}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {cat.trackedQueries.length} queries
                  </span>
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {cat.targetUrl}
                </span>
              </button>
              {expandedCategory === cat.id && (
                <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
                  <div className="space-y-1 pt-3">
                    {cat.trackedQueries.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between rounded p-2"
                      >
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {q.query}
                        </span>
                        {q.isPrimary && (
                          <span className="text-[10px] font-medium text-brand-400">
                            Principal
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
