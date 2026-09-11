import RadarBoard from "@/components/RadarBoard";

export const metadata = { title: "Recompete radar | BidKeep" };
export const dynamic = "force-dynamic";

export default async function SubscriberRadarPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <RadarBoard
      viewer="subscriber"
      basePath="/app/radar"
      searchParams={props.searchParams}
    />
  );
}
