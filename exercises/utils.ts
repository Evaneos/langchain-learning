import { config } from "dotenv";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import type { AIMessage, AIMessageChunk, BaseMessage } from "@langchain/core/messages";
import { ToolMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { IterableReadableStream } from "@langchain/core/utils/stream";
import { z } from "zod";

config({ path: ".env.local" });

export const model = new ChatAnthropic({
  model: "claude-haiku-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const getWeatherTool = tool(
  async ({ city, month }) => {
    return `${city} in ${month}: 28°C, tropical humidity, occasional rain.`;
  },
  {
    name: "get_weather",
    description:
      "Get weather conditions for a city during a specific month. Use when the user asks about climate or best time to visit.",
    schema: z.object({
      city: z.string().describe("City name"),
      month: z.string().describe("Month name (e.g. 'July')"),
    }),
  },
);

export const searchFlightsTool = tool(
  async ({ from, to }) => {
    return `${from} → ${to}: 650€, 12h with 1 stopover.`;
  },
  {
    name: "search_flights",
    description:
      "Search for flights between two cities. Use when the user mentions flying or needs transport options.",
    schema: z.object({
      from: z.string().describe("Departure city"),
      to: z.string().describe("Destination city"),
    }),
  },
);

export const tools = [getWeatherTool, searchFlightsTool];

const BORDER = "─".repeat(60);

/**
 * Log a compact framed summary of an AIMessage.
 */
export function logAIMessage(msg: AIMessage): void {
  const parts: string[] = [];

  if (typeof msg.content === "string") {
    parts.push(msg.content.length > 0 ? `content: "${msg.content.slice(0, 50)}…"` : "content: (empty)");
  } else if (Array.isArray(msg.content)) {
    const types = msg.content.map((b) => b.type);
    parts.push(`content: ContentBlock[${msg.content.length}] (${types.join(", ")})`);
  }

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const calls = msg.tool_calls.map(
      (tc) => `${tc.name}(${Object.keys(tc.args).join(", ")})`,
    );
    parts.push(`tool_calls: ${calls.join(", ")}`);
  }

  const stop =
    msg.response_metadata?.stop_reason ?? msg.additional_kwargs?.stop_reason;
  if (stop) parts.push(`stop: ${stop}`);

  const usage = msg.usage_metadata;
  if (usage) {
    parts.push(`tokens: ${usage.input_tokens}in/${usage.output_tokens}out`);
  }

  console.log(`┌${BORDER}┐`);
  console.log(`│ ${parts.join(" | ")}`);
  console.log(`└${BORDER}┘\n`);
}

/**
 * Collect all chunks from a stream and reduce them into a single AIMessage.
 * When `display` is true, prints text and tool call chunks as they arrive.
 * When `slow` is true, adds a delay between chunks for observation.
 */
export async function collectStream(
  stream: IterableReadableStream<AIMessageChunk>,
  opts: { display?: boolean; slow?: boolean; delayMs?: number } = {},
): Promise<AIMessage> {
  const { display = false, slow = false, delayMs = 150 } = opts;
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const chunks: AIMessageChunk[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
    if (slow) await delay(delayMs);

    if (display) {
      writeChunkText(chunk);

      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        for (const tc of chunk.tool_call_chunks) {
          if (tc.name) process.stdout.write(`[tool-call-start] ${tc.name} (id: ${tc.id})\n`);
          if (tc.args) process.stdout.write(`  [args-delta] ${tc.args}`);
        }
      }
    }
  }

  if (display) console.log("\n");
  const result = chunks.reduce((acc, chunk) => acc.concat(chunk)) as unknown as AIMessage;
  if (display) logAIMessage(result);
  return result;
}

/**
 * Execute tool calls from an AIMessage, log results, return ToolMessages.
 */
export async function executeToolCalls(
  aiMessage: AIMessage,
  tools: StructuredToolInterface[],
): Promise<ToolMessage[]> {
  const toolMessages: ToolMessage[] = [];
  for (const toolCall of aiMessage.tool_calls ?? []) {
    const selectedTool = tools.find((t) => t.name === toolCall.name);
    if (!selectedTool) throw new Error(`Tool not found: ${toolCall.name}`);
    const result = await selectedTool.invoke(toolCall.args);
    toolMessages.push(
      new ToolMessage({ content: String(result), tool_call_id: toolCall.id! }),
    );
    console.log(`  ⤷ ${toolCall.name}(${JSON.stringify(toolCall.args)}) → ${String(result)}`);
  }
  console.log();
  return toolMessages;
}

/**
 * Extract and write text from a chunk to stdout.
 * Handles both string content (no tools) and ContentBlock[] (with bindTools).
 */
export function writeChunkText(chunk: AIMessageChunk): void {
  if (typeof chunk.content === "string") {
    if (chunk.content.length > 0) process.stdout.write(chunk.content);
  } else if (Array.isArray(chunk.content)) {
    for (const block of chunk.content) {
      if (block.type === "text" && block.text) {
        process.stdout.write(block.text as string);
      }
    }
  }
}

/**
 * Log skill definitions loaded by DeepAgents' SkillsMiddleware.
 * Each entry has: name, description, path, allowedTools, metadata.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- skillsMetadata not in DeepAgent's public type
export function logLoadedSkills(agentResult: any): void {
  const skills = agentResult.skillsMetadata as Array<{
    name: string; description: string; path: string;
    allowedTools?: string[]; metadata?: Record<string, string>;
  }> | undefined;
  if (!skills?.length) {
    console.log("  Loaded skills: (none)");
    return;
  }
  console.log("  Loaded skills:");
  for (const s of skills) {
    console.log(`    [${s.name}] ${s.description}`);
    console.log(`      path: ${s.path}`);
    if (s.allowedTools?.length) console.log(`      allowedTools: ${s.allowedTools.join(", ")}`);
  }
}

/**
 * Log a compact summary of each message in a conversation (graph result).
 */
export function logConversation(messages: BaseMessage[]): void {
  for (const msg of messages) {
    const { type } = msg;
    if (type === "human") {
      console.log(`[human] ${(msg.content as string).slice(0, 80)}...`);
    } else if (type === "ai" && (msg as AIMessage).tool_calls?.length) {
      const calls = (msg as AIMessage).tool_calls!.map(
        (tc) => `${tc.name}(${JSON.stringify(tc.args)})`,
      );
      console.log(`[ai → tool_calls] ${calls.join(", ")}`);
    } else if (type === "tool") {
      console.log(`[tool result] ${(msg.content as string).slice(0, 80)}`);
    } else if (type === "ai") {
      console.log(`[ai → final] ${(msg.content as string).slice(0, 120)}...`);
    }
  }
}
