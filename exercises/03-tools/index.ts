import { config } from "dotenv";
config({ path: ".env.local" });
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";

const model = new ChatAnthropic({
  model: "claude-haiku-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// --- Example 1: Full tool-calling cycle ---

// tool() wraps a function so the LLM can call it.
// It combines: a handler (the actual function), a name, a description
// (tells the LLM WHEN to use it), and a Zod schema (tells the LLM
// WHAT parameters to provide). Same pattern used in production agents:
// { name, description, schema }
const getWeatherTool = tool(
  async ({ city, month }) => {
    // Fake implementation — in production, handlers call real APIs
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

// bindTools() attaches the tool definitions to the model.
// The LLM doesn't execute them — it returns tool_calls[] in the AIMessage
// saying "I want to call this tool with these args". The runtime (us)
// must execute them and send results back.
const tools = [getWeatherTool, searchFlightsTool];
const modelWithTools = model.bindTools(tools);

async function main() {
  console.log("=== Example 1: Full tool-calling cycle ===\n");

  const userMessage = new HumanMessage(
    "I want to go to Bali in July, flying from Paris. What's the weather like?",
  );

  // Step 1: The LLM decides which tools to call
  // Instead of responding with text, it returns tool_calls[]
  const aiResponse = await modelWithTools.invoke([userMessage]);

  // When tools are bound, stop_reason = "tool_use" instead of "end_turn" (seen in exercise 01)
  console.log("Stop reason:", aiResponse.response_metadata?.stop_reason);
  console.log("\nTool calls requested by LLM:");
  console.log(JSON.stringify(aiResponse.tool_calls, null, 2));

  // Step 2: Execute each tool manually and build ToolMessages
  // A ToolMessage links the result back to the request via tool_call_id
  // — this is how the LLM knows which result corresponds to which call.
  // Note: LangGraph's ToolNode automates this dispatch (exercise 05),
  // but here we do it manually to understand the mechanics.
  const toolMessages: ToolMessage[] = [];
  for (const toolCall of aiResponse.tool_calls ?? []) {
    const selectedTool = tools.find((t) => t.name === toolCall.name)!;
    // @ts-expect-error -- union of tool types not callable, resolved by ToolNode in exercise 05
    const result = await selectedTool.invoke(toolCall.args);
    toolMessages.push(
      new ToolMessage({
        content: result,
        tool_call_id: toolCall.id!,
      }),
    );
    console.log(`\nExecuted ${toolCall.name}:`, result);
  }

  // Step 3: Send the full conversation back to the LLM
  // [user message, AI response with tool_calls, tool results]
  // The LLM now has the tool results and can produce a final answer.
  // This is ONE iteration of the ReAct loop — exercise 05 will automate it.
  const finalResponse = await modelWithTools.invoke([
    userMessage,
    aiResponse,
    ...toolMessages,
  ]);

  console.log("\n--- Final response ---");
  console.log(finalResponse.content);

  // TODO(human): Create a third tool (e.g. "search_hotels") and add it to the flow.
  // Try a prompt that triggers all 3 tools at once — does the LLM call them all?
}

main();
