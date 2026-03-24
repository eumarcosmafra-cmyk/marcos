import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getScoreColor(score: number): string {
  if (score >= 90) return "text-seo-green";
  if (score >= 70) return "text-seo-yellow";
  if (score >= 50) return "text-seo-orange";
  return "text-seo-red";
}

export function getScoreBg(score: number): string {
  if (score >= 90) return "bg-seo-green";
  if (score >= 70) return "bg-seo-yellow";
  if (score >= 50) return "bg-seo-orange";
  return "bg-seo-red";
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excelente";
  if (score >= 70) return "Bom";
  if (score >= 50) return "Precisa Melhorar";
  return "Crítico";
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}
