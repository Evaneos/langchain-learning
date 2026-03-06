import { config } from "dotenv";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import type { AIMessageChunk } from "@langchain/core/messages";
import { z } from "zod";
import { collectStream, executeToolCalls } from "../utils";
config({ path: ".env.local" });

// --- Slow-motion mode: `npx tsx index.ts B --slow` to observe chunks at human speed ---
const SLOW_MODE = process.argv.includes("--slow");
const CHUNK_DELAY_MS = 150; // tweak this to go faster/slower
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const model = new ChatAnthropic({
  model: "claude-haiku-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// --- Example 1: Text streaming + tool call streaming ---

const getWeatherTool = tool(
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

const tools = [getWeatherTool];
const modelWithTools = model.bindTools(tools);

// --- Part A: Pure text streaming ---
async function partA() {
  console.log("=== Part A: Text streaming ===\n");

  const userMessage = new HumanMessage(
    "Explain in 2 sentences why Bali is popular with tourists.",
  );

  // .stream() returns an AsyncIterable of AIMessageChunk (not a full AIMessage).
  // Each chunk contains a small piece of the response — usually a few tokens.
  // Under the hood, the stream yields { value: AIMessageChunk, done: false }
  // on each iteration, then { value: undefined, done: true } when exhausted.
  // for await hides this: it extracts .value into `chunk` and exits on done: true.
  const stream = await model.stream([userMessage]);

  for await (const chunk of stream) {
    // chunk.content is a string fragment — write without newline for real-time effect
    if (SLOW_MODE) await delay(CHUNK_DELAY_MS);
    process.stdout.write(chunk.content as string);
  }
  console.log("\n");
}

// --- Part B: Streaming with tools ---
async function partB() {
  console.log("=== Part B: Tool call streaming ===\n");

  const userMessage = new HumanMessage("What's the weather like in Bali in July?");
  const stream = await modelWithTools.stream([userMessage]);

  // When the LLM decides to call a tool, chunks contain tool_call_chunks
  // instead of text content. Each chunk carries a piece of the JSON args.
  // We collect all chunks to reconstruct the full AIMessage at the end.
  const chunks: AIMessageChunk[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
    if (SLOW_MODE) await delay(CHUNK_DELAY_MS);

    // Text content — stream it live
    if (chunk.content && typeof chunk.content === "string" && chunk.content.length > 0) {
      process.stdout.write(chunk.content);
    }

    // Tool call chunks — partial tool call data arriving progressively.
    // Each chunk has { name, args, id, index }. The name and id arrive in the
    // first chunk, then args arrive as JSON string fragments across subsequent chunks.
    if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
      for (const tc of chunk.tool_call_chunks) {
        if (tc.name) {
          // First chunk for this tool call — we get the name and id
          process.stdout.write(`[tool-call-start] ${tc.name} (id: ${tc.id})\n`);
        }
        if (tc.args) {
          // Subsequent chunks — args JSON fragments arriving piece by piece
          process.stdout.write(`  [args-delta] ${tc.args}`);
        }
      }
    }
  }
  console.log("\n");

  // Concatenate all chunks to get the full AIMessage — same shape as .invoke() result.
  // This is how you recover tool_calls[] from a stream.
  const fullMessage = chunks.reduce((acc, chunk) => acc.concat(chunk));

  // In streaming, stop_reason lives in additional_kwargs (on the last chunk),
  // NOT in response_metadata like .invoke() (exercise 03). The concat merges it.
  console.log(
    "Stop reason (from additional_kwargs):",
    fullMessage.additional_kwargs?.stop_reason,
  );
  console.log("Reconstructed tool_calls:", JSON.stringify(fullMessage.tool_calls, null, 2));
}

// --- Part C: Complete streaming tool cycle ---
async function partC() {
  console.log("\n=== Part C: Full streaming cycle (stream → tool → stream) ===\n");

  const userMessage = new HumanMessage("What's the weather in Bali in July?");

  const streamOpts = { display: true, slow: SLOW_MODE, delayMs: CHUNK_DELAY_MS };

  // Step 1: Collect the LLM response (tool call)
  console.log("--- Step 1: LLM decides to call a tool ---");
  const aiResponse = await collectStream(await modelWithTools.stream([userMessage]), streamOpts);

  // Step 2: Execute tools
  console.log("--- Step 2: Execute tool calls ---");
  const toolMessages = await executeToolCalls(aiResponse, tools);

  // Step 3: Stream the final answer
  console.log("\n--- Step 3: Stream final response ---");
  await collectStream(
    await modelWithTools.stream([userMessage, aiResponse, ...toolMessages]),
    streamOpts,
  );
}

// Run a specific part with: npx tsx index.ts A (or B, C). No arg = run all.
const partFilter = process.argv[2]?.toUpperCase();

async function main() {
  if (!partFilter || partFilter === "A") await partA();
  if (!partFilter || partFilter === "B") await partB();
  if (!partFilter || partFilter === "C") await partC();

  // TODO(human): Implement a classifyChunks() async generator that takes
  // a stream of AIMessageChunks and yields typed events, similar to
  // di-agent-ui's parseLangChainStream(). See the StreamEvent type in
  // the README for the target shape. Start with just:
  //   { kind: 'text-delta', content: string }
  //   { kind: 'tool-call-start', name: string, id: string }
  //   { kind: 'tool-call-delta', args: string }
  //
  // Then use it: for await (const event of classifyChunks(stream)) { ... }
}

main();
