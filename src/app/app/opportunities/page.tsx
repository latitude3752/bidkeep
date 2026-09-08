import OpportunityPipeline from "@/components/OpportunityPipeline";

export const metadata = { title: "Opportunities | BidKeep" };
export const dynamic = "force-dynamic";

export default async function SubscriberOpportunitiesPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <OpportunityPipeline
      viewer="subscriber"
      basePath="/app/opportunities"
      searchParams={props.searchParams}
    />
  );
}
