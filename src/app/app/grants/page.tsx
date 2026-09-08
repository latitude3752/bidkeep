import GrantAwardsDashboard from "@/components/GrantAwardsDashboard";

export const metadata = { title: "Grant Awards | BidKeep" };
export const dynamic = "force-dynamic";

export default async function SubscriberGrantsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <GrantAwardsDashboard
      viewer="subscriber"
      basePath="/app/grants"
      searchParams={props.searchParams}
    />
  );
}
