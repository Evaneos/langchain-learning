import { config } from "dotenv";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
config({ path: ".env.local" });

// Create a ChatAnthropic instance — the most basic LangChain building block
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
  const response2 = await model.invoke([
    new SystemMessage("You are a helpful assistant."),
    new HumanMessage("What is LangChain in one sentence?"),
  ]);
  console.log(response2.content);
  console.log(`Tokens: ${response2.usage_metadata?.input_tokens} in / ${response2.usage_metadata?.output_tokens} out`);
  console.log(JSON.stringify(response2.response_metadata, null, 2));
}

main();
