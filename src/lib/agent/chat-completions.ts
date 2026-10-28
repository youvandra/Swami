import type Anthropic from "@anthropic-ai/sdk";
import type { MessagesClient } from "./llm.ts";

type Params = Anthropic.Beta.MessageCreateParamsNonStreaming;
type Block = Anthropic.Beta.BetaContentBlock;

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

/**
 * Runs the agent on any OpenAI-compatible chat-completions endpoint, so the
 * model is a deployment choice. It translates the agent's Messages-shaped
 * request and the reply; the loop, tools and every check stay the same.
 */
export class ChatCompletionsClient implements MessagesClient {
  readonly beta: MessagesClient["beta"];

  constructor(baseUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch) {
    const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    this.beta = {
      messages: {
        async create(params: Params, opts?: { signal?: AbortSignal }) {
          const res = await fetchImpl(url, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(toChatRequest(params)),
            signal: opts?.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
          });
          if (!res.ok) throw new Error(`Model endpoint ${res.status}: ${(await res.text()).slice(0, 300)}`);
          return fromChatResponse(await res.json(), params.model);
        },
      },
    };
  }
}

export function toChatRequest(params: Params) {
  const messages: ChatMessage[] = [];
  // Messages-only fields (betas, fallbacks, effort, cache markers) have no equivalent here and are dropped.
  if (typeof params.system === "string") messages.push({ role: "system", content: params.system });
  else if (Array.isArray(params.system)) messages.push({ role: "system", content: params.system.map((b) => b.text).join("\n\n") });
  for (const m of params.messages) {
    if (typeof m.content === "string") {
      messages.push({ role: m.role, content: m.content });
      continue;
    }
    const blocks = m.content as unknown as { type: string; [k: string]: unknown }[];
    if (m.role === "assistant") {
      const text = blocks.filter((b) => b.type === "text").map((b) => String(b.text)).join("\n");
      const calls = blocks
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ id: String(b.id), type: "function" as const, function: { name: String(b.name), arguments: JSON.stringify(b.input ?? {}) } }));
      messages.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    for (const b of blocks) {
      if (b.type === "tool_result") {
        const content = typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? "");
        messages.push({ role: "tool", tool_call_id: String(b.tool_use_id), content: b.is_error ? `Error: ${content}` : content });
      } else if (b.type === "text") {
        messages.push({ role: "user", content: String(b.text) });
      }
    }
  }
  const tools = (params.tools ?? []).flatMap((t) =>
    "input_schema" in t
      ? [{ type: "function" as const, function: { name: t.name, description: t.description ?? "", parameters: t.input_schema } }]
      : [],
  );
  return { model: params.model, max_tokens: Math.min(params.max_tokens, 8192), messages, ...(tools.length ? { tools } : {}) };
}

export function fromChatResponse(body: unknown, model: string): Anthropic.Beta.BetaMessage {
  const choice = (body as { choices?: { message?: ChatMessage; finish_reason?: string }[] }).choices?.[0];
  const msg = choice?.message;
  const content: Block[] = [];
  if (msg?.content) content.push({ type: "text", text: msg.content, citations: null } as Block);
  for (const c of msg?.tool_calls ?? []) {
    let input: unknown;
    try {
      input = JSON.parse(c.function.arguments || "{}");
    } catch {
      // A malformed call reaches the tool as empty input, which the checks reject with a message the model can act on.
      input = {};
    }
    content.push({ type: "tool_use", id: c.id, name: c.function.name, input } as Block);
  }
  const usedTools = (msg?.tool_calls?.length ?? 0) > 0;
  return {
    id: String((body as { id?: string }).id ?? ""),
    type: "message",
    role: "assistant",
    model: String((body as { model?: string }).model ?? model),
    content,
    usage: { input_tokens: (body as { usage?: { prompt_tokens?: number } }).usage?.prompt_tokens ?? 0, output_tokens: (body as { usage?: { completion_tokens?: number } }).usage?.completion_tokens ?? 0 },
    stop_reason: usedTools ? "tool_use" : choice?.finish_reason === "length" ? "max_tokens" : "end_turn",
  } as Anthropic.Beta.BetaMessage;
}
