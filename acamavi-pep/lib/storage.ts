import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { del, get, list, put } from "@vercel/blob"
import type { Submission } from "./types"

// Em produção tudo fica em um Blob store PRIVADO: nenhum arquivo tem URL pública.
// LOCAL_STORAGE_DIR existe só para testar o app fora da Vercel (grava em disco).
const SUBMISSIONS = "submissions/"

const ID_RE = /^[a-f0-9]{24}$/

interface StoredFile {
  bytes: Uint8Array
  contentType: string
}

interface Backend {
  put(pathname: string, bytes: Uint8Array, contentType: string): Promise<void>
  get(pathname: string): Promise<StoredFile | null>
  list(prefix: string): Promise<string[]>
  del(pathnames: string[]): Promise<void>
}

const blobBackend: Backend = {
  async put(pathname, bytes, contentType) {
    await put(pathname, Buffer.from(bytes), {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    })
  },
  async get(pathname) {
    const result = await get(pathname, { access: "private", useCache: false })
    if (!result || result.statusCode !== 200 || !result.stream) return null
    const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer())
    return { bytes, contentType: result.blob.contentType }
  },
  async list(prefix) {
    const pathnames: string[] = []
    let cursor: string | undefined
    do {
      const page = await list({ prefix, limit: 1000, cursor })
      pathnames.push(...page.blobs.map((b) => b.pathname))
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)
    return pathnames
  },
  async del(pathnames) {
    if (pathnames.length) await del(pathnames)
  },
}

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json",
}

function localBackend(dir: string): Backend {
  const resolve = (pathname: string) => path.join(dir, pathname)
  return {
    async put(pathname, bytes) {
      await mkdir(path.dirname(resolve(pathname)), { recursive: true })
      await writeFile(resolve(pathname), bytes)
    },
    async get(pathname) {
      try {
        const bytes = new Uint8Array(await readFile(resolve(pathname)))
        return { bytes, contentType: CONTENT_TYPES[path.extname(pathname)] ?? "application/octet-stream" }
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null
        throw e
      }
    },
    async list(prefix) {
      try {
        const files = await readdir(resolve(prefix))
        return files.map((f) => `${prefix}${f}`)
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return []
        throw e
      }
    },
    async del(pathnames) {
      await Promise.all(pathnames.map((p) => rm(resolve(p), { force: true })))
    },
  }
}

const backend: Backend = process.env.LOCAL_STORAGE_DIR ? localBackend(process.env.LOCAL_STORAGE_DIR) : blobBackend

export function isValidId(id: string): boolean {
  return ID_RE.test(id)
}

function submissionPath(id: string) {
  return `${SUBMISSIONS}${id}.json`
}

export async function saveSubmission(s: Submission): Promise<void> {
  await backend.put(submissionPath(s.id), new TextEncoder().encode(JSON.stringify(s)), "application/json")
}

export async function readSubmission(id: string): Promise<Submission | null> {
  if (!isValidId(id)) return null
  const file = await backend.get(submissionPath(id))
  if (!file) return null
  return JSON.parse(new TextDecoder().decode(file.bytes)) as Submission
}

export async function listSubmissions(): Promise<Submission[]> {
  const pathnames = await backend.list(SUBMISSIONS)
  const ids = pathnames.map((p) => p.slice(SUBMISSIONS.length).replace(/\.json$/, "")).filter(isValidId)
  const out: Submission[] = []
  const queue = [...ids]
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const s = await readSubmission(id)
      if (s) out.push(s)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return out
}

export async function deleteSubmission(s: Submission): Promise<void> {
  await backend.del([submissionPath(s.id)])
}
