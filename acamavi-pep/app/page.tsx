import { Brand } from "@/components/Brand"
import { DeclaracaoForm } from "@/components/DeclaracaoForm"

export default function Home() {
  return (
    <main className="wrap">
      <Brand />
      <DeclaracaoForm />
      <p className="footer-note">As informações são de uso estritamente confidencial.</p>
    </main>
  )
}
