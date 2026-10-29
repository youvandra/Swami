import { ChatView } from "@/components/app/ChatView";

// each "New Chat" carries its own ?new= so the view starts clean even when /app is already showing
export default async function NewChat({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: fresh } = await searchParams;
  return <ChatView key={fresh ?? "new"} id={null} />;
}
