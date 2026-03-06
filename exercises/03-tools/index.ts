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

// TODO(human): Create 2 tools for a mini travel assistant:
//
// 1. A "get_weather" tool that takes { city: string, month: string }
//    and returns fake weather data (e.g. "25°C, sunny").
//    Think about what the description should say so the LLM knows
//    WHEN to call it.
//
// 2. A "search_flights" tool that takes { from: string, to: string }
//    and returns fake flight data (e.g. "Paris → Tokyo: 650€, 12h").
//
// Use the `tool()` function from @langchain/core/tools:
//   const myTool = tool(handlerFn, { name, description, schema })
//
// Then:
//   - Bind them to the model with model.bindTools([...])
//   - Invoke with a message like "I want to go to Bali in July, flying from Paris"
//   - Log the response's tool_calls (response.tool_calls)
//   - For each tool call, execute the matching tool and create a ToolMessage
//   - Send everything back to the model for a final answer
//
// Hint: a ToolMessage needs { content, tool_call_id } to match the request.

async function main() {
  // Your code here
}

main();
