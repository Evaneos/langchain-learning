import { config } from "dotenv";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
// createReactAgent is LangGraph's prebuilt agent — it wires up the ReAct loop
// as a graph: agent node (LLM) ↔ tools node (ToolNode), with a conditional
// edge that loops back if the LLM requests tool calls.
import { createReactAgent } from "@langchain/langgraph/prebuilt";
config({ path: ".env.local" });

// --- Slow-motion mode: `npx tsx index.ts B --slow` to observe chunks at human speed ---
const SLOW_MODE = process.argv.includes("--slow");
const CHUNK_DELAY_MS = 150;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const model = new ChatAnthropic({
  model: "claude-haiku-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Same tools as exercises 03/04 — familiar code, focus on the new concept
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

const searchFlightsTool = tool(
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

const tools = [getWeatherTool, searchFlightsTool];

// --- Part A: createReactAgent + invoke ---
async function partA() {
  console.log("=== Part A: createReactAgent with .invoke() ===\n");

  // createReactAgent() builds a LangGraph StateGraph with:
  //   - "agent" node: calls the LLM with the current messages
  //   - "tools" node: a ToolNode that dispatches tool calls automatically
  //   - conditional edge: if LLM returns tool_calls → go to "tools" → back to "agent"
  //                       if LLM returns text (end_turn) → END
  // This replaces the entire manual loop from exercises 03/04.
  const agent = createReactAgent({ llm: model, tools });

  const userMessage = new HumanMessage(
    "I want to go to Bali in July, flying from Paris. What's the weather like and how do I get there?",
  );

  // .invoke() runs the graph to completion — it loops internally until the LLM
  // stops requesting tools. The result contains ALL messages from the conversation.
  const result = await agent.invoke({ messages: [userMessage] });

  // result.messages is the full conversation history:
  // [HumanMessage, AIMessage(tool_calls), ToolMessage, ToolMessage, AIMessage(final)]
  // Compare with exercise 03 where we manually built this array step by step.
  console.log(`Total messages in conversation: ${result.messages.length}\n`);

  for (const msg of result.messages) {
    const type = msg._getType();
    if (type === "human") {
      console.log(`[human] ${(msg.content as string).slice(0, 80)}...`);
    } else if (type === "ai" && "tool_calls" in msg && (msg.tool_calls as unknown[])?.length) {
      // ToolNode automated what we did manually in exercise 03:
      // no more tools.find() + selectedTool.invoke() + new ToolMessage(...)
      const calls = (msg.tool_calls as { name: string; args: Record<string, unknown> }[]).map(
        (tc) => `${tc.name}(${JSON.stringify(tc.args)})`,
      );
      console.log(`[ai → tool_calls] ${calls.join(", ")}`);
    } else if (type === "tool") {
      console.log(`[tool result] ${(msg.content as string).slice(0, 80)}`);
    } else if (type === "ai") {
      console.log(`[ai → final] ${(msg.content as string).slice(0, 120)}...`);
    }
  }
  console.log();
}

// --- Part B: Streaming from the agent ---
async function partB() {
  console.log("=== Part B: Agent streaming (streamMode: 'messages') ===\n");

  const agent = createReactAgent({ llm: model, tools });

  const userMessage = new HumanMessage("What's the weather in Bali in July?");

  // streamMode: "messages" yields [message, metadata] tuples — same AIMessageChunk
  // objects as model.stream() in exercise 04, but through the entire agent loop.
  // This is the exact pattern used in di-agent-ui's agent-invoker.ts:
  //   agent.stream({ messages }, { streamMode: 'messages' })
  const stream = await agent.stream(
    { messages: [userMessage] },
    { streamMode: "messages" },
  );

  // Each iteration yields a tuple: [message, metadata]
  // metadata.langgraph_node tells you which graph node emitted it ("agent" or "tools")
  for await (const [message, metadata] of stream) {
    if (SLOW_MODE) await delay(CHUNK_DELAY_MS);

    // Only process AI message chunks (skip tool messages emitted by the tools node)
    if (message._getType() === "ai") {
      // Text content — stream it live (same as exercise 04 Part A)
      if (typeof message.content === "string" && message.content.length > 0) {
        process.stdout.write(message.content);
      } else if (Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block.type === "text" && block.text) {
            process.stdout.write(block.text as string);
          }
        }
      }

      // Tool call chunks — the agent node streams them before the tools node executes.
      // We use "in" check because the stream yields BaseMessage, but AI chunks
      // carry tool_call_chunks at runtime (same shape as exercise 04 Part B).
      const chunk = message as unknown as { tool_call_chunks?: { name?: string; args?: string; id?: string }[] };
      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        for (const tc of chunk.tool_call_chunks) {
          if (tc.name) {
            // metadata.langgraph_node confirms this comes from the "agent" node
            process.stdout.write(
              `\n[${metadata.langgraph_node}] tool-call: ${tc.name} (id: ${tc.id})\n`,
            );
          }
          if (tc.args) process.stdout.write(`  [args] ${tc.args}`);
        }
      }
    }
  }
  console.log("\n");
}

// --- Part C: Agent with system prompt ---
async function partC() {
  console.log("=== Part C: Agent with system prompt ===\n");

  // The `prompt` parameter injects a system message at the start of every conversation.
  // In di-agent-ui, this is the massive system prompt built from skills + context.
  // createReactAgent accepts it as a string — it wraps it in SystemMessage internally.
  const agent = createReactAgent({
    llm: model,
    tools,
    prompt:
      "You are a travel advisor specialized in Southeast Asia. " +
      "Always mention visa requirements and best travel season. " +
      "Be concise — answer in 3 sentences max.",
  });

  const userMessage = new HumanMessage(
    "I want to go to Bali in July from Paris. What do I need to know?",
  );

  const result = await agent.invoke({ messages: [userMessage] });

  // The system prompt steers the agent's behavior — compare this output
  // with Part A (same question, no system prompt). The agent should now
  // mention visa requirements and be more concise.
  const lastMessage = result.messages[result.messages.length - 1];
  console.log(lastMessage.content);
  console.log();
}

// TODO(human): Part D — streamMode: "updates"
// Implement a Part D that uses streamMode: "updates" instead of "messages".
// This mode yields the graph state after each node execution, letting you
// observe the agent's step-by-step progression through the graph.
//
// Your task:
// 1. Create the agent (same as Part B)
// 2. Use agent.stream({ messages: [...] }, { streamMode: "updates" })
// 3. Each iteration yields an object like { agent: { messages: [...] } }
//    or { tools: { messages: [...] } } — the key is the node name
// 4. Log each step: which node ran, what messages it produced
//
// This reveals the graph structure: you'll see "agent" → "tools" → "agent" → END
// which maps to the conditional edge logic described in the README.

// Run a specific part with: npx tsx index.ts A (or B, C). No arg = run all.
const partFilter = process.argv[2]?.toUpperCase();

async function main() {
  if (!partFilter || partFilter === "A") await partA();
  if (!partFilter || partFilter === "B") await partB();
  if (!partFilter || partFilter === "C") await partC();
  // if (!partFilter || partFilter === "D") await partD();
}

main();
