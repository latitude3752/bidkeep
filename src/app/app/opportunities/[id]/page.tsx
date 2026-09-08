import { getOpportunity, OpportunityDetail } from "@/app/admin/opportunities/[id]/OpportunityDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const op = await getOpportunity(id);
  return { title: op ? `${op.title} | BidKeep` : "Opportunity | BidKeep" };
}

export default async function SubscriberOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <OpportunityDetail params={params} basePath="/app/opportunities" />;
}
