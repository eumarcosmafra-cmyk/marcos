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
import { ConnectGSCButton } from "@/components/gsc/connect-gsc-button";

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

      {/* Google Search Console */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google Search Console
        </h3>
        <ConnectGSCButton />
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
