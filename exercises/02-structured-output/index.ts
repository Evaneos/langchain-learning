import { config } from "dotenv";
config({ path: ".env.local" });
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";

const model = new ChatAnthropic({
  model: "claude-haiku-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// --- Example 1: Simple structured output ---
// Define a schema the LLM must conform to
const DestinationSuggestion = z.object({
  name: z.string().describe("Name of the destination"),
  country: z.string().describe("Country where it is located"),
  best_season: z.string().describe("Best time of year to visit"),
  family_score: z
    .number()
    .min(1)
    .max(10)
    .describe("How family-friendly it is, from 1 to 10"),
  why: z.string().describe("One-sentence reason to go"),
});

// .withStructuredOutput() wraps the model: it adds the schema as a tool
// and parses the response automatically
const structuredModel = model.withStructuredOutput(DestinationSuggestion);

async function main() {
  console.log("=== Example 1: Single structured output ===\n");
  const result = await structuredModel.invoke(
    "Suggest a family-friendly travel destination in Southeast Asia.",
  );
  console.log(result);
  console.log("\nType check — result.family_score is a number:", typeof result.family_score);

  // --- Example 2: Array of structured outputs ---
  console.log("\n=== Example 2: Array schema (mini TravelerProject) ===\n");

  // TODO(human): Define a TripSummary schema inspired by di-agent-ui's TravelerProjectSchema.
  // It should capture the essence of a trip plan with 4-6 fields.
  // Think about: what fields matter for a trip? what types make sense?
  // Use .describe() on each field — these descriptions guide the LLM.
  //
  // Then create a structuredModel2 with model.withStructuredOutput(TripSummary)
  // and invoke it with a prompt asking to summarize a trip plan.
}

main();
