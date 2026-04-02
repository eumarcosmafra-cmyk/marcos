export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#fafafa", color: "#1a1a1a" }}>
        {children}
      </body>
    </html>
  );
}
