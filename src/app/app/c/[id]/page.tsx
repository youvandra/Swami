import { ChatView } from "@/components/app/ChatView";

export default async function Chat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatView key={id} id={id} />;
}
