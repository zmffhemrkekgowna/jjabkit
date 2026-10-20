import { notFound } from "next/navigation";
import ShowDetail from "@/components/ShowDetail";
import { fetchShow } from "@/lib/db/shows";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const show = await fetchShow(await createClient(), id);
  if (!show) notFound();
  return <ShowDetail show={show} />;
}
