import { readFile } from "node:fs/promises"
import path from "node:path"
import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import * as T from "./document-text"
import type { PepRow, Submission } from "./types"
import { dataPorExtenso, formatCpf } from "./validation"

// A4 em pontos. As coordenadas abaixo são medidas a partir do TOPO da página;
// a conversão para o sistema do PDF (origem embaixo) acontece só no desenho.
const PAGE_W = 595.28
const PAGE_H = 841.89
const BOX_L = 32
const BOX_R = PAGE_W - 32
const PAD = 7
const IN_L = BOX_L + PAD
const IN_R = BOX_R - PAD
const IN_W = IN_R - IN_L
const CONTENT_TOP = 88
const CONTENT_BOTTOM = PAGE_H - 42
const BLACK = rgb(0, 0, 0)
const GRAY = rgb(0.45, 0.45, 0.45)

interface Fonts {
  regular: PDFFont
  bold: PDFFont
}

interface Run {
  text: string
  bold?: boolean
}

let fontBytesPromise: Promise<[Uint8Array, Uint8Array]> | null = null

function loadFontBytes(): Promise<[Uint8Array, Uint8Array]> {
  if (!fontBytesPromise) {
    const dir = path.join(process.cwd(), "fonts")
    fontBytesPromise = Promise.all([
      readFile(path.join(dir, "DocSans-Regular.ttf")),
      readFile(path.join(dir, "DocSans-Bold.ttf")),
    ])
      .then(([r, b]): [Uint8Array, Uint8Array] => [new Uint8Array(r), new Uint8Array(b)])
      .catch((e: unknown) => {
        console.error("[pdf] Erro ao carregar fontes:", e)
        fontBytesPromise = null
        throw e
      })
  }
  return fontBytesPromise
}

const EXTRA_CHARS = new Set("ŒœŠšŸŽž–—‘’‚“”„•…€")

/** Garante que o texto só use caracteres presentes nas fontes embutidas. */
function pdfSafe(text: string): string {
  let out = ""
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 0
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || EXTRA_CHARS.has(ch)) {
      out += ch
      continue
    }
    const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const baseCode = base.codePointAt(0) ?? 0
    out += base.length === 1 && baseCode >= 0x20 && baseCode <= 0x7e ? base : "?"
  }
  return out
}

/** Quebra texto simples em linhas que caibam na largura (quebra palavras longas se preciso). */
function wrapPlain(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  let current = ""
  for (const word of text.split(" ").filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    if (font.widthOfTextAtSize(word, size) <= width) {
      current = word
      continue
    }
    let piece = ""
    for (const ch of word) {
      if (font.widthOfTextAtSize(piece + ch, size) > width && piece) {
        lines.push(piece)
        piece = ""
      }
      piece += ch
    }
    current = piece
  }
  if (current) lines.push(current)
  return lines
}

function drawHeader(page: PDFPage, fonts: Fonts) {
  const sigla = T.ASSOCIACAO_SIGLA
  const nome = T.ASSOCIACAO_NOME
  const siglaSize = 16
  const nomeSize = 10
  page.drawText(sigla, {
    x: (PAGE_W - fonts.bold.widthOfTextAtSize(sigla, siglaSize)) / 2,
    y: PAGE_H - 44,
    size: siglaSize,
    font: fonts.bold,
    color: BLACK,
  })
  page.drawText(nome, {
    x: (PAGE_W - fonts.regular.widthOfTextAtSize(nome, nomeSize)) / 2,
    y: PAGE_H - 58,
    size: nomeSize,
    font: fonts.regular,
    color: BLACK,
  })
  page.drawLine({
    start: { x: BOX_L, y: PAGE_H - 68 },
    end: { x: BOX_R, y: PAGE_H - 68 },
    thickness: 0.5,
    color: GRAY,
  })
}

class Writer {
  page: PDFPage
  /** Cursor vertical: topo da próxima linha, medido a partir do topo da página. */
  y = CONTENT_TOP
  private boxTop: number | null = null

  constructor(
    private readonly doc: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.page = this.addPage()
  }

  private addPage(): PDFPage {
    const page = this.doc.addPage([PAGE_W, PAGE_H])
    drawHeader(page, this.fonts)
    return page
  }

  private drawBoxSegment(bottom: number) {
    if (this.boxTop === null) return
    this.page.drawRectangle({
      x: BOX_L,
      y: PAGE_H - bottom,
      width: BOX_R - BOX_L,
      height: bottom - this.boxTop,
      borderColor: BLACK,
      borderWidth: 0.75,
    })
  }

  newPage() {
    const inBox = this.boxTop !== null
    if (inBox) this.drawBoxSegment(this.y + 2)
    this.page = this.addPage()
    this.y = CONTENT_TOP
    if (inBox) {
      this.boxTop = this.y
      this.y += PAD
    }
  }

  ensure(height: number) {
    if (this.y + height > CONTENT_BOTTOM) this.newPage()
  }

  openBox() {
    this.boxTop = this.y
    this.y += PAD
  }

  closeBox() {
    this.y += PAD - 3
    this.drawBoxSegment(this.y)
    this.boxTop = null
  }

  /** Desenha texto com o topo da linha em `top`. */
  textAt(raw: string, x: number, top: number, font: PDFFont, size: number, underline = false) {
    const text = pdfSafe(raw)
    const baseline = top + size * 0.8
    this.page.drawText(text, { x, y: PAGE_H - baseline, size, font, color: BLACK })
    if (underline) {
      const w = font.widthOfTextAtSize(text, size)
      this.page.drawLine({
        start: { x, y: PAGE_H - baseline - 1.4 },
        end: { x: x + w, y: PAGE_H - baseline - 1.4 },
        thickness: 0.5,
        color: BLACK,
      })
    }
  }

  line(text: string, opts: { x?: number; size: number; bold?: boolean; underline?: boolean; center?: boolean; lineHeight?: number }) {
    const font = opts.bold ? this.fonts.bold : this.fonts.regular
    const lh = opts.lineHeight ?? opts.size * 1.25
    this.ensure(lh)
    const x = opts.center ? (PAGE_W - font.widthOfTextAtSize(text, opts.size)) / 2 : (opts.x ?? IN_L)
    this.textAt(text, x, this.y, font, opts.size, opts.underline)
    this.y += lh
  }

  /** Parágrafo com trechos em negrito, quebra automática e justificação opcional. */
  paragraph(runs: Run[], opts: { x?: number; width?: number; size: number; lineHeight?: number; justify?: boolean }) {
    const x0 = opts.x ?? IN_L
    const width = opts.width ?? IN_R - x0
    const size = opts.size
    const lh = opts.lineHeight ?? size * 1.25
    const space = this.fonts.regular.widthOfTextAtSize(" ", size)
    const words = runs.flatMap((r) =>
      r.text
        .split(" ")
        .filter(Boolean)
        .map((w) => {
          const font = r.bold ? this.fonts.bold : this.fonts.regular
          return { w, font, width: font.widthOfTextAtSize(w, size) }
        }),
    )

    const lines: (typeof words)[] = []
    let current: typeof words = []
    let currentWidth = 0
    for (const word of words) {
      const extra = current.length ? space + word.width : word.width
      if (current.length && currentWidth + extra > width) {
        lines.push(current)
        current = [word]
        currentWidth = word.width
      } else {
        current.push(word)
        currentWidth += extra
      }
    }
    if (current.length) lines.push(current)

    lines.forEach((lineWords, i) => {
      this.ensure(lh)
      const natural = lineWords.reduce((s, w) => s + w.width, 0) + space * (lineWords.length - 1)
      const isLast = i === lines.length - 1
      const gap =
        opts.justify && !isLast && lineWords.length > 1 ? space + (width - natural) / (lineWords.length - 1) : space
      let x = x0
      for (const w of lineWords) {
        this.textAt(w.w, x, this.y, w.font, size)
        x += w.width + gap
      }
      this.y += lh
    })
  }

  /** Item com rótulo pendurado (ex.: "II -", "a)", "1.1."). */
  hangingItem(label: string, text: string, opts: { labelX: number; textX: number; size: number; justify?: boolean; lineHeight?: number }) {
    const lh = opts.lineHeight ?? opts.size * 1.25
    this.ensure(lh)
    this.textAt(label, opts.labelX, this.y, this.fonts.regular, opts.size)
    this.paragraph([{ text }], { x: opts.textX, size: opts.size, justify: opts.justify, lineHeight: lh })
  }

  checkbox(label: string, checked: boolean, size: number) {
    const lh = 15
    this.ensure(lh)
    const box = 8.5
    const top = this.y + 0.5
    const x = IN_L
    this.page.drawRectangle({
      x,
      y: PAGE_H - top - box,
      width: box,
      height: box,
      borderColor: BLACK,
      borderWidth: 0.75,
    })
    if (checked) {
      const pdfTop = PAGE_H - top
      this.page.drawLine({ start: { x: x + 1.6, y: pdfTop - 1.6 }, end: { x: x + box - 1.6, y: pdfTop - box + 1.6 }, thickness: 1.1, color: BLACK })
      this.page.drawLine({ start: { x: x + 1.6, y: pdfTop - box + 1.6 }, end: { x: x + box - 1.6, y: pdfTop - 1.6 }, thickness: 1.1, color: BLACK })
    }
    this.textAt(label, x + box + 4, this.y, this.fonts.regular, size)
    this.y += lh
  }

  pepTable(rows: PepRow[]) {
    const { regular, bold } = this.fonts
    const cols = [138, 86, 116, 62, 76]
    const tableX = IN_L + 32
    const colX = cols.reduce<number[]>((acc, w, i) => [...acc, acc[i] + w], [tableX])
    const tableR = colX[colX.length - 1]
    const headH = 24
    const cellSize = 8
    const cellLh = 9.5
    const cellPad = 2.5

    const dataRows = [...rows]
    while (dataRows.length < 5) dataRows.push({ nome: "", situacao: "", cargo: "", de: "", ate: "" })
    const cellLines = dataRows.map((r) =>
      [r.nome, r.situacao, r.cargo, r.de, r.ate].map((v, i) => wrapPlain(v, regular, cellSize, cols[i] - cellPad * 2)),
    )
    const rowHeights = cellLines.map((cells) => Math.max(11.5, Math.max(...cells.map((l) => l.length)) * cellLh + 2.5))
    const total = headH + rowHeights.reduce((s, h) => s + h, 0)
    this.ensure(total + 14)

    const top = this.y
    const pdf = (t: number) => PAGE_H - t
    const hLine = (x1: number, x2: number, t: number) =>
      this.page.drawLine({ start: { x: x1, y: pdf(t) }, end: { x: x2, y: pdf(t) }, thickness: 0.6, color: BLACK })
    const vLine = (x: number, t1: number, t2: number) =>
      this.page.drawLine({ start: { x, y: pdf(t1) }, end: { x, y: pdf(t2) }, thickness: 0.6, color: BLACK })

    // Cabeçalho
    const headSize = 8.5
    const centerText = (text: string, x1: number, x2: number, t: number) =>
      this.textAt(text, x1 + (x2 - x1 - bold.widthOfTextAtSize(text, headSize)) / 2, t, bold, headSize)
    centerText(T.TABELA_COLUNAS.nome, colX[0], colX[1], top + (headH - headSize) / 2)
    centerText(T.TABELA_COLUNAS.situacao, colX[1], colX[2], top + (headH - headSize) / 2)
    centerText(T.TABELA_COLUNAS.cargo[0], colX[2], colX[3], top + 2.5)
    centerText(T.TABELA_COLUNAS.cargo[1], colX[2], colX[3], top + 12.5)
    centerText(T.TABELA_COLUNAS.periodo, colX[3], colX[5], top + 2)
    centerText(T.TABELA_COLUNAS.de, colX[3], colX[4], top + 13.5)
    centerText(T.TABELA_COLUNAS.ate, colX[4], colX[5], top + 13.5)

    hLine(tableX, tableR, top)
    hLine(colX[3], colX[5], top + headH / 2)
    let t = top + headH
    hLine(tableX, tableR, t)

    // Linhas de dados
    cellLines.forEach((cells, r) => {
      cells.forEach((lines, c) => {
        lines.forEach((ln, i) => this.textAt(ln, colX[c] + cellPad, t + 1.8 + i * cellLh, regular, cellSize))
      })
      t += rowHeights[r]
      hLine(tableX, tableR, t)
    })

    // Verticais
    vLine(colX[0], top, t)
    vLine(colX[1], top, t)
    vLine(colX[2], top, t)
    vLine(colX[3], top, t)
    vLine(colX[4], top + headH / 2, t)
    vLine(colX[5], top, t)

    this.y = t + 2
    this.line(T.TABELA_NOTA, { x: tableX - 4, size: 7, lineHeight: 9 })
  }

  signature(size: number) {
    this.ensure(62)
    this.y += 34
    const center = PAGE_W / 2
    const half = 85
    this.page.drawLine({
      start: { x: center - half, y: PAGE_H - this.y },
      end: { x: center + half, y: PAGE_H - this.y },
      thickness: 0.6,
      color: BLACK,
    })
    this.y += 3
    this.line("Assinatura", { size, center: true })
  }
}

export async function generateDeclaracaoPdf(submission: Submission): Promise<Uint8Array> {
  const s: Submission = {
    ...submission,
    nome: pdfSafe(submission.nome),
    rg: pdfSafe(submission.rg),
    local: pdfSafe(submission.local),
    pepRows: submission.pepRows.map((r) => ({
      nome: pdfSafe(r.nome),
      situacao: pdfSafe(r.situacao),
      cargo: pdfSafe(r.cargo),
      de: pdfSafe(r.de),
      ate: pdfSafe(r.ate),
    })),
  }
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const [regularBytes, boldBytes] = await loadFontBytes()
  const fonts: Fonts = {
    // As fontes já vêm reduzidas ao alfabeto latino (subset do pdf-lib corrompe a fonte)
    regular: await doc.embedFont(regularBytes, { subset: false }),
    bold: await doc.embedFont(boldBytes, { subset: false }),
  }

  doc.setTitle(`Declaração sobre condição de Pessoa Politicamente Exposta – ${s.nome}`)
  doc.setSubject("Declaração de Pessoa Politicamente Exposta – Pessoa Física")
  doc.setCreator(T.ASSOCIACAO_SIGLA)
  doc.setProducer(T.ASSOCIACAO_SIGLA)
  doc.setLanguage("pt-BR")
  doc.setCreationDate(new Date(s.createdAt))
  doc.setModificationDate(new Date(s.createdAt))

  const w = new Writer(doc, fonts)
  const body = 9.5

  // Título
  w.line(T.TITULO, { size: 11.5, bold: true, center: true, lineHeight: 14 })
  w.line(T.SUBTITULO, { size: 10.5, bold: true, center: true, lineHeight: 13 })
  w.y += 12

  // Orientações gerais (sem o item "deve ser apresentado na forma impressa e assinado")
  w.line(T.ORIENTACOES_TITULO, { size: 9, bold: true, underline: true, lineHeight: 12 })
  w.y += 6
  const orient = { size: 9, lineHeight: 11.5 }
  w.hangingItem("1.", T.ORIENTACOES.quem, { labelX: IN_L + 8, textX: IN_L + 20, ...orient })
  for (const [rotulo, texto] of T.ORIENTACOES.subitens) {
    w.hangingItem(rotulo, texto, { labelX: IN_L + 32, textX: IN_L + 70, ...orient })
  }
  w.hangingItem("2.", T.ORIENTACOES.confidencial, { labelX: IN_L + 8, textX: IN_L + 20, ...orient })
  w.y += 12

  // Quadro da declaração
  w.openBox()
  w.paragraph([{ text: T.DECLARO }], { size: body, justify: true, lineHeight: 12 })
  w.y += 7
  w.checkbox(T.OPCAO_SIM, s.pep === "sim", body)
  w.y += 3
  w.checkbox(T.OPCAO_NAO, s.pep === "nao", body)
  w.y += 3
  w.line(T.CASO_SIM, { size: body, lineHeight: 12 })
  w.y += 6
  w.pepTable(s.pep === "sim" ? s.pepRows : [])
  w.y += 12

  w.paragraph([{ text: "Local e data:" }, { text: `${s.local}, ${dataPorExtenso(s.dataDeclaracao)}.` }], {
    size: body,
    lineHeight: 12,
  })
  w.y += 10
  w.paragraph([{ text: "Nome completo:" }, { text: s.nome }], { size: body, lineHeight: 12 })
  w.paragraph([{ text: "RG:" }, { text: s.rg }], { size: body, lineHeight: 12 })
  w.paragraph([{ text: "CPF:" }, { text: formatCpf(s.cpf) }], { size: body, lineHeight: 12 })
  w.signature(body)
  w.y += 12

  // Caracterização
  const small = { size: 8, lineHeight: 10, justify: true }
  w.line(T.CARACTERIZACAO_TITULO, { size: 8, bold: true, underline: true, lineHeight: 10 })
  w.y += 8
  w.paragraph([{ text: "1.", bold: true }, { text: T.CARACTERIZACAO_1 }], small)
  w.paragraph([{ text: "2.", bold: true }, { text: T.CARACTERIZACAO_2 }], small)
  w.y += 8
  w.line(T.PARA_BRASILEIROS, { size: 8, bold: true, lineHeight: 10 })
  for (const item of T.LISTA_BRASILEIROS) {
    w.hangingItem(item.rotulo, item.texto, { labelX: IN_L, textX: IN_L + 22, ...small })
    for (const sub of item.subitens ?? []) {
      w.hangingItem(sub.rotulo, sub.texto, { labelX: IN_L + 34, textX: IN_L + 58, ...small })
    }
  }
  w.y += 8
  w.paragraph([{ text: T.PARA_ESTRANGEIROS, bold: true }, { text: T.TEXTO_ESTRANGEIROS }], small)
  w.y += 8
  w.paragraph([{ text: "3.", bold: true }, { text: T.CARACTERIZACAO_3 }], small)
  w.paragraph([{ text: "4.", bold: true }, { text: T.CARACTERIZACAO_4 }], small)
  w.closeBox()

  return doc.save({ useObjectStreams: false })
}
