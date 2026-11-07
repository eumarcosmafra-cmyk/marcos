"use client";

import { PautaEditor } from "@/components/views/pauta-editor";
import { WithWorkspace } from "@/components/with-workspace";

export default function NovaPautaPage() {
  return <WithWorkspace>{(ws, handle) => <PautaEditor ws={ws} execute={handle.execute} />}</WithWorkspace>;
}
