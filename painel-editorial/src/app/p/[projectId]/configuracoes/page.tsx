"use client";

import { SettingsView } from "@/components/views/settings";
import { WithWorkspace } from "@/components/with-workspace";

export default function ConfiguracoesPage() {
  return <WithWorkspace>{(ws, handle) => <SettingsView ws={ws} execute={handle.execute} />}</WithWorkspace>;
}
