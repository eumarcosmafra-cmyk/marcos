import type { Client } from "@/types/seo";

// In-memory store — starts empty, populated by GSC sites
let clients: Client[] = [];

export function getClients(): Client[] {
  return clients;
}

export function getClientById(id: string): Client | undefined {
  return clients.find((c) => c.id === id);
}

export function addClient(client: Client): void {
  // Avoid duplicates by domain
  const existing = clients.find(
    (c) => c.domain.toLowerCase() === client.domain.toLowerCase()
  );
  if (!existing) {
    clients.push(client);
  }
}

export function updateClient(id: string, data: Partial<Client>): void {
  clients = clients.map((c) => (c.id === id ? { ...c, ...data } : c));
}

export function deleteClient(id: string): void {
  clients = clients.filter((c) => c.id !== id);
}

export function getClientByDomain(domain: string): Client | undefined {
  const clean = domain
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/$/, "")
    .toLowerCase();
  return clients.find((c) => c.domain.toLowerCase() === clean);
}
