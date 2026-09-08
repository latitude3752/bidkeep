import GrantAwardsDashboard from "@/components/GrantAwardsDashboard";

export const metadata = { title: "Grant Awards Dashboard | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminGrantsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <GrantAwardsDashboard
      viewer="founder"
      basePath="/admin/grants"
      searchParams={props.searchParams}
    />
  );
}
