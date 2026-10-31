"use client";

import { OverviewView } from "@/components/views/overview";
import { WithWorkspace } from "@/components/with-workspace";

export default function OverviewPage() {
  return <WithWorkspace>{(ws) => <OverviewView ws={ws} />}</WithWorkspace>;
}
