import { config } from "dotenv";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
config({ path: ".env.local" });

// Create a ChatAnthropic instance — same as agent-factory.ts:65-68 in di-agent-ui
const model = new ChatAnthropic({
  model: "claude-haiku-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  // --- Example 1: Simple string invoke ---
  console.log("=== Example 1: Simple string invoke ===\n");
  const response1 = await model.invoke("What is LangChain in one sentence?");
  console.log(response1.content);
  console.log(
    `\nTokens: ${response1.usage_metadata?.input_tokens} in / ${response1.usage_metadata?.output_tokens} out`,
  );

  // --- Example 2: Message objects + AIMessage inspection ---
  console.log("\n=== Example 2: Message objects ===\n");

  // TODO(human): Call model.invoke() with an array of typed messages:
  //   - A SystemMessage that gives the assistant a persona
  //   - A HumanMessage with your question
  // Then log:
  //   - The response content
  //   - The AIMessage type (constructor.name)
  //   - The response_metadata (JSON.stringify it to explore what's inside)
}

main();
