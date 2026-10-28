import { mockReply } from "@/lib/agent/mock";
import type { ChatRequest } from "@/lib/agent/types";

// Swap mockReply for the real agent loop (Qloo tools + scorers) without touching the client.
export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequest;
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }
  await new Promise((r) => setTimeout(r, 900));
  return Response.json(mockReply(body));
}
