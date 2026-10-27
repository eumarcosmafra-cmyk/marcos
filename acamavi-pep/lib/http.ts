import { NextResponse } from "next/server"
import type { ApiError, FieldErrors } from "./types"

const NO_STORE = { "Cache-Control": "no-store" }

export function json<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export function error(message: string, status: number, fields?: FieldErrors): NextResponse {
  const body: ApiError = fields ? { error: message, fields } : { error: message }
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export function fileResponse(bytes: Uint8Array, contentType: string, filename: string, inline = false): Response {
  const disposition = inline ? "inline" : "attachment"
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}

export function extensionFor(contentType: string): string {
  if (contentType === "application/pdf") return "pdf"
  if (contentType === "image/png") return "png"
  return "jpg"
}
