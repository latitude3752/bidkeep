import RadarBoard from "@/components/RadarBoard";

export const metadata = { title: "Recompete radar | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminRadarPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <RadarBoard
      viewer="founder"
      basePath="/admin/radar"
      searchParams={props.searchParams}
    />
  );
}
