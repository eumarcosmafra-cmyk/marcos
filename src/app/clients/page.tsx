"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, Globe, Search, Trash2, RefreshCw } from "lucide-react";
import type { Client } from "@/types/seo";
import { generateId, formatDate } from "@/lib/utils";

export default function ClientsPage() {
  const { data: session } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newClient, setNewClient] = useState({
    name: "",
    domain: "",
    industry: "",
    notes: "",
  });

  const loadClients = () => {
    setLoading(true);
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        setClients(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    // If connected to GSC, sync first then load
    if (session?.accessToken) {
      fetch("/api/gsc/sync", { method: "POST" })
        .then((r) => r.json())
        .then((json) => {
          if (json.clients) setClients(json.clients);
          setLoading(false);
        })
        .catch(() => loadClients());
    } else {
      loadClients();
    }
  }, [session?.accessToken]);

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = async () => {
    if (!newClient.name || !newClient.domain) return;

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });
      const client = await res.json();
      if (res.ok) {
        setClients([...clients, client]);
        setNewClient({ name: "", domain: "", industry: "", notes: "" });
        setShowForm(false);
      }
    } catch {}
  };

  const handleDelete = (id: string) => {
    setClients(clients.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Clientes</h1>
          <p className="text-sm text-white/40">
            Gerencie seus clientes e acompanhe seu progresso SEO
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="glass-card space-y-3 p-5">
          <h3 className="text-sm font-semibold text-white">
            Adicionar Cliente
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              value={newClient.name}
              onChange={(e) =>
                setNewClient({ ...newClient, name: e.target.value })
              }
              placeholder="Nome do cliente"
              className="input-field"
            />
            <input
              type="text"
              value={newClient.domain}
              onChange={(e) =>
                setNewClient({ ...newClient, domain: e.target.value })
              }
              placeholder="Domínio (ex: site.com.br)"
              className="input-field"
            />
            <input
              type="text"
              value={newClient.industry}
              onChange={(e) =>
                setNewClient({ ...newClient, industry: e.target.value })
              }
              placeholder="Indústria / Nicho"
              className="input-field"
            />
            <input
              type="text"
              value={newClient.notes || ""}
              onChange={(e) =>
                setNewClient({ ...newClient, notes: e.target.value })
              }
              placeholder="Observações"
              className="input-field"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary">
              Salvar
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar clientes..."
          className="input-field pl-10"
        />
      </div>

      {/* Client List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-16 animate-pulse" />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
          <Globe className="mb-3 h-10 w-10 text-white/20" />
          <p className="text-sm text-white/40">
            {searchTerm
              ? "Nenhum cliente encontrado"
              : session?.accessToken
                ? "Seus sites do GSC aparecerão aqui automaticamente"
                : "Conecte o GSC ou adicione um cliente manualmente"}
          </p>
          {!session?.accessToken && !searchTerm && (
            <Link href="/settings" className="btn-primary mt-4">
              Conectar GSC
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <div className="glass-card-hover flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                    <Globe className="h-5 w-5 text-white/40" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {client.name}
                    </h3>
                    <p className="text-xs text-white/30">
                      {client.domain}
                      {client.industry ? ` • ${client.industry}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {client.indicators && (
                    <div className="hidden items-center gap-4 text-xs sm:flex">
                      <span className="text-blue-400">
                        {(client.indicators.clicks || 0).toLocaleString("pt-BR")} cliques
                      </span>
                      <span className="text-purple-400">
                        {(client.indicators.impressions || 0).toLocaleString("pt-BR")} impr.
                      </span>
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(client.id);
                    }}
                    className="rounded p-1.5 text-white/20 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
