"use client";

import { useState } from "react";
import { Plus, Globe, Search, Trash2, ExternalLink } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import type { Client } from "@/types/seo";
import { generateId, formatDate } from "@/lib/utils";

const initialClients: Client[] = [
  {
    id: "1",
    name: "E-commerce Fashion",
    domain: "fashionstore.com.br",
    industry: "E-commerce / Moda",
    status: "active",
    createdAt: "2024-01-15T10:00:00Z",
    lastAnalysis: "2024-03-20T14:30:00Z",
    currentScore: 78,
  },
  {
    id: "2",
    name: "Clínica Odonto",
    domain: "sorrisobelo.com.br",
    industry: "Saúde / Odontologia",
    status: "active",
    createdAt: "2024-02-01T09:00:00Z",
    lastAnalysis: "2024-03-18T11:00:00Z",
    currentScore: 52,
  },
  {
    id: "3",
    name: "Tech Blog",
    domain: "techinsights.com.br",
    industry: "Tecnologia / Blog",
    status: "active",
    createdAt: "2023-11-10T08:00:00Z",
    lastAnalysis: "2024-03-22T16:00:00Z",
    currentScore: 91,
  },
];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newClient, setNewClient] = useState({ name: "", domain: "", industry: "", notes: "" });

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    if (!newClient.name || !newClient.domain) return;
    setClients([
      ...clients,
      {
        id: generateId(),
        ...newClient,
        status: "active" as const,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewClient({ name: "", domain: "", industry: "", notes: "" });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setClients(clients.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Clientes</h1>
          <p className="text-sm text-white/40">Gerencie seus clientes e acompanhe seu progresso SEO</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="glass-card space-y-3 p-5">
          <h3 className="text-sm font-semibold text-white">Adicionar Cliente</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              placeholder="Nome do cliente"
              className="input-field"
            />
            <input
              type="text"
              value={newClient.domain}
              onChange={(e) => setNewClient({ ...newClient, domain: e.target.value })}
              placeholder="Domínio (ex: site.com.br)"
              className="input-field"
            />
            <input
              type="text"
              value={newClient.industry}
              onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
              placeholder="Indústria / Nicho"
              className="input-field"
            />
            <input
              type="text"
              value={newClient.notes || ""}
              onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
              placeholder="Observações"
              className="input-field"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary">Salvar</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
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
      <div className="space-y-3">
        {filteredClients.map((client) => (
          <div key={client.id} className="glass-card-hover flex items-center justify-between p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                <Globe className="h-5 w-5 text-white/40" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{client.name}</h3>
                <p className="text-xs text-white/30">{client.domain} • {client.industry}</p>
                {client.lastAnalysis && (
                  <p className="mt-0.5 text-[10px] text-white/20">
                    Última análise: {formatDate(client.lastAnalysis)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {client.currentScore !== undefined && (
                <ScoreRing score={client.currentScore} size="sm" showLabel={false} />
              )}
              <div className="flex gap-1">
                <button className="rounded p-1.5 text-white/20 hover:bg-white/5 hover:text-brand-400">
                  <ExternalLink className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="rounded p-1.5 text-white/20 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
