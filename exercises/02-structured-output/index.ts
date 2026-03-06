import { config } from "dotenv";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
config({ path: ".env.local" });

const model = new ChatAnthropic({
  model: "claude-haiku-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// --- Example 1: Simple structured output ---
// Define a schema the LLM must conform to😜
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

  const TripSummary = z.object({
    destination: z.string().describe("Name of the destination"),
    dates: z.string().describe("Travel dates and duration"),
    activities: z.array(z.string()).describe("Activities to do"),
    accommodations: z.string().describe("Accommodations"),
    transportation: z.string().describe("Transportation"),
    budget: z.number().describe("Estimated budget in euros"),
  });

  const structuredModel2 = model.withStructuredOutput(TripSummary);
  const result2 = await structuredModel2.invoke(
    "Summarize a trip to Tokyo for 5 days, including a visit to the Tokyo Tower and a stay at the Hilton Tokyo.",
  );
  console.log(result2);
  console.log("\nType check — result2.budget is a number:", typeof result2.budget);
}

main();
