"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Trash2 } from "lucide-react";
import { LoadingDots } from "@/components/ui/loading";
import { generateId } from "@/lib/utils";
import type { ChatMessage } from "@/types/seo";

const SUGGESTIONS = [
  "Como melhorar o Core Web Vitals do meu site?",
  "Qual a melhor estratégia de link building para e-commerce?",
  "Como otimizar meta descriptions para CTR?",
  "O que é E-E-A-T e como impacta o ranking?",
  "Como fazer auditoria de conteúdo duplicado?",
  "Estratégias de SEO local para clínicas",
];

export default function AnalysisPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const content = text || input.trim();
    if (!content || loading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Analista IA</h1>
          <p className="text-sm text-white/40">
            Converse com seu analista SEO sênior powered by Claude
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            <Trash2 className="h-3 w-3" />
            Nova conversa
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02] p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600/20">
              <Bot className="h-8 w-8 text-brand-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-white">
              Olá! Sou seu Analista SEO Sênior
            </h2>
            <p className="mb-8 max-w-md text-center text-sm text-white/40">
              Tenho mais de 15 anos de experiência em SEO. Pergunte-me qualquer coisa sobre
              otimização, estratégia, auditoria ou tendências.
            </p>
            <div className="grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 text-left text-xs text-white/60 transition-all hover:border-brand-500/30 hover:bg-brand-500/5 hover:text-white/80"
                >
                  <Sparkles className="mb-1 h-3 w-3 text-brand-400" />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600/20">
                    <Bot className="h-4 w-4 text-brand-400" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-white/[0.05] text-white/80"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <User className="h-4 w-4 text-white/60" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600/20">
                  <Bot className="h-4 w-4 text-brand-400" />
                </div>
                <div className="rounded-xl bg-white/[0.05] px-4 py-3">
                  <LoadingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte ao analista SEO..."
          rows={1}
          className="input-field flex-1 resize-none py-3"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="btn-primary flex items-center gap-2 px-5 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
