import type { Metadata } from "next";
import { PrintView } from "@/components/app/PrintView";

export const metadata: Metadata = { robots: { index: false } };

export default async function Print({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrintView id={id} />;
}
