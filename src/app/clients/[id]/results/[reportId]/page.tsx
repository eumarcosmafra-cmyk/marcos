import { ResultsPanel } from "@/components/client-report/results-panel";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function ClientResultsPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;

  const report = await prisma.clientReport.findFirst({
    where: { id: reportId, clientId: id },
    include: { client: { select: { name: true, domain: true } } },
  });

  if (!report) notFound();

  // Serialize for client component (remove analyst notes, convert dates)
  const { analystNotes: _, ...publicReport } = report;
  const serialized = {
    ...publicReport,
    createdAt: publicReport.createdAt.toISOString(),
    updatedAt: publicReport.updatedAt.toISOString(),
    rankingWins: (publicReport.rankingWins || []) as unknown[],
    visualKeywords: (publicReport.visualKeywords || []) as unknown[],
    nextSteps: (publicReport.nextSteps || []) as unknown[],
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fafafa",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <ResultsPanel report={serialized as any} />
      </div>
    </div>
  );
}
