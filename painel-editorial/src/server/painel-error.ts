/** Erro com código estável, exibido na interface para facilitar o diagnóstico. */
export class PainelError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PainelError";
  }
}
