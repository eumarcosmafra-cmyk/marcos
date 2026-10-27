interface Props {
  id: string
  token: string
  nome: string
}

export function DownloadDeclaracao({ id, token, nome }: Props) {
  const pdfHref = `/api/submissions/${id}/pdf?t=${encodeURIComponent(token)}`
  const firstName = nome.split(" ")[0]

  return (
    <>
      <section className="card">
        <div className="alert alert-ok">Pronto, {firstName}! Sua declaração foi preenchida.</div>
        <h2>1. Baixe sua declaração</h2>
        <a className="btn btn-block" href={pdfHref} download>
          Baixar declaração (PDF)
        </a>
      </section>

      <section className="card">
        <h2>2. Imprima e assine à mão</h2>
        <ol className="steps steps-strong">
          <li>Imprima o PDF (2 páginas).</li>
          <li>Confira seus dados.</li>
          <li>Assine com caneta sobre a linha &quot;Assinatura&quot;, na primeira página.</li>
          <li>Entregue o documento assinado à ACAMAVI.</li>
        </ol>
      </section>
    </>
  )
}
