"use client";

import { useState } from "react";
import {
  Settings,
  Key,
  Globe,
  Palette,
  Bell,
  Shield,
  Check,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [language, setLanguage] = useState("pt-BR");
  const [theme, setTheme] = useState("dark");
  const [notifications, setNotifications] = useState(true);
  const [autoAudit, setAutoAudit] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-white/40">
          Gerencie as configurações da sua conta e preferências
        </p>
      </div>

      {/* API Key */}
      <div className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <Key className="h-4 w-4 text-brand-400" />
          API Key
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-white/40">Anthropic API Key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="input-field flex-1"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="btn-secondary text-xs"
              >
                {showKey ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-white/30">
              <Info className="h-3 w-3" />
              A chave é configurada via variável de ambiente ANTHROPIC_API_KEY
            </p>
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <Settings className="h-4 w-4 text-brand-400" />
          Geral
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-white/40">Idioma</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input-field pl-10"
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/40">Tema</label>
            <div className="relative">
              <Palette className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="input-field pl-10"
              >
                <option value="dark">Escuro</option>
                <option value="light">Claro (em breve)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <Shield className="h-4 w-4 text-brand-400" />
          Preferências
        </h3>
        <div className="space-y-3">
          <ToggleOption
            icon={Bell}
            label="Notificações"
            description="Receba alertas quando uma análise for concluída"
            checked={notifications}
            onChange={setNotifications}
          />
          <ToggleOption
            icon={Shield}
            label="Auditoria Automática"
            description="Executar auditorias automaticamente ao adicionar um novo cliente"
            checked={autoAudit}
            onChange={setAutoAudit}
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              Salvo!
            </>
          ) : (
            "Salvar Configurações"
          )}
        </button>
      </div>
    </div>
  );
}

function ToggleOption({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-white/30" />
        <div>
          <p className="text-xs font-medium text-white">{label}</p>
          <p className="text-[10px] text-white/30">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-brand-600" : "bg-white/10"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            checked && "translate-x-4"
          )}
        />
      </button>
    </div>
  );
}
