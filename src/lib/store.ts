import type { Client } from "@/types/seo";

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
    indicators: {
      impressions: 45200,
      clicks: 3100,
      sessions: 12400,
      performanceScore: 62,
    },
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
    indicators: {
      impressions: 8700,
      clicks: 620,
      sessions: 3200,
      performanceScore: 45,
    },
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
    indicators: {
      impressions: 120000,
      clicks: 18500,
      sessions: 42000,
      performanceScore: 94,
    },
  },
  {
    id: "4",
    name: "Restaurante SP",
    domain: "sabordacasa.com.br",
    industry: "Gastronomia / Local",
    status: "inactive",
    createdAt: "2024-01-20T08:00:00Z",
    lastAnalysis: "2024-02-10T09:00:00Z",
    currentScore: 45,
    indicators: {
      impressions: 2100,
      clicks: 180,
      sessions: 890,
      performanceScore: 38,
    },
  },
];

// In-memory store (simulates persistence within session)
let clients: Client[] = [...initialClients];

export function getClients(): Client[] {
  return clients;
}

export function getClientById(id: string): Client | undefined {
  return clients.find((c) => c.id === id);
}

export function addClient(client: Client): void {
  clients.push(client);
}

export function updateClient(id: string, data: Partial<Client>): void {
  clients = clients.map((c) => (c.id === id ? { ...c, ...data } : c));
}

export function deleteClient(id: string): void {
  clients = clients.filter((c) => c.id !== id);
}
