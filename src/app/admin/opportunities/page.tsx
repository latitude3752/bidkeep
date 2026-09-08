import OpportunityPipeline from "@/components/OpportunityPipeline";

export const metadata = { title: "Opportunities Dashboard | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminOpportunitiesPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <OpportunityPipeline
      viewer="founder"
      basePath="/admin/opportunities"
      searchParams={props.searchParams}
    />
  );
}
