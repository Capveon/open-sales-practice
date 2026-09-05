import { CallSession } from "@/components/call-session";

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CallSession id={id} />;
}
