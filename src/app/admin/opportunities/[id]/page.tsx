import { getOpportunity, OpportunityDetail } from "./OpportunityDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const op = await getOpportunity(id);
  return { title: op ? `${op.title} | Admin` : "Opportunity | Admin" };
}

export default async function AdminOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <OpportunityDetail params={params} basePath="/admin/opportunities" />;
}
