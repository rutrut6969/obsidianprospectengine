import { LeadDetailClient } from "@/components/leads/lead-detail-client";

type PageProps = { params: Promise<{ id: string }> };

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <LeadDetailClient id={id} />;
}
