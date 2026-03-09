import { createDeepAgent, FilesystemBackend } from "deepagents";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { model, tools, logConversation, logLoadedSkills } from "../utils";

const exerciseDir = path.dirname(fileURLToPath(import.meta.url));

// --- Part A: createDeepAgent — the one-line agent ---
async function partA() {
  console.log("=== Part A: createDeepAgent (one function, batteries included) ===\n");

  // In exercises 05-07, building an agent required 5 steps:
  //   1. model.bindTools(tools)
  //   2. new StateGraph(MessagesAnnotation)
  //   3. .addNode("agent", callModel) + .addNode("tools", new ToolNode(tools))
  //   4. Wire edges: START→agent, conditionalEdges, tools→agent
  //   5. .compile({ checkpointer })
  //
  // createDeepAgent replaces ALL of this with a single function call.
  // Under the hood it creates a ReactAgent (same as createReactAgent from ex05)
  // plus middleware that add extra capabilities: filesystem tools, subagent
  // delegation, skills loading, and conversation summarization.
  const agent = createDeepAgent({
    model,                // our ChatAnthropic from utils
    tools,                // same get_weather + search_flights
    // checkpointer: true only works for subgraphs. Root graphs need an instance.
    checkpointer: new MemorySaver(),  // same MemorySaver as ex07, passed directly
    name: "travel-agent",
  });

  // That's it. No StateGraph, no nodes, no edges, no compile.
  // Invocation is identical to the compiled graph from ex06-07.
  // thread_id works the same way — each thread is an isolated conversation.
  const config = { configurable: { thread_id: "bali-trip" } };

  console.log("--- Turn 1: asking about weather ---");
  const result1 = await agent.invoke(
    { messages: [new HumanMessage("What's the weather in Bali in July?")] },
    config,
  );
  const lastMsg1 = result1.messages[result1.messages.length - 1];
  console.log(`[ai] ${(lastMsg1.content as string).slice(0, 200)}...\n`);

  // Turn 2: the checkpointer gives us conversation memory, just like ex07.
  // We only send the new message — the agent remembers Bali from Turn 1.
  console.log("--- Turn 2: follow-up (agent should remember Bali) ---");
  const result2 = await agent.invoke(
    { messages: [new HumanMessage("And how do I get there from Paris?")] },
    config,
  );
  const lastMsg2 = result2.messages[result2.messages.length - 1];
  console.log(`[ai] ${(lastMsg2.content as string).slice(0, 200)}...\n`);

  // Full conversation trace — same structure as ex07, produced with less code.
  console.log("--- Full conversation ---");
  logConversation(result2.messages);
  console.log();
}

// --- Part B: Skills — behavior configuration as markdown ---
async function partB() {
  console.log("=== Part B: Skills (behavior as configuration) ===\n");

  // Skills are SKILL.md files that DeepAgents injects into the system prompt.
  // They tell the agent WHEN to activate and WHAT procedure to follow —
  // natural language middleware, essentially.
  //
  // In di-agent-ui, 7 skills define the entire travel consultation flow:
  //   exploration-destinations, cadrage-projet, profilage-voyageur,
  //   projection-experiences, synthese-brief, conseil-arbitrage,
  //   cloture-conversation
  // Each is a SKILL.md file with YAML frontmatter + markdown instructions.
  //
  // Here we created a "travel-advisor" skill (see skills/travel-advisor/SKILL.md)
  // that instructs the agent to always check weather before suggesting flights,
  // then present results in structured sections.

  const backend = new FilesystemBackend({ rootDir: exerciseDir, virtualMode: true });

  const agent = createDeepAgent({
    model,
    tools,
    backend,
    skills: ["skills/"],  // loads all SKILL.md files from skills/*/SKILL.md
    name: "travel-agent",
  });

  // --- Call 1: a random question unrelated to travel ---
  // No checkpointer, no thread_id — each invoke is independent (no shared memory).
  // The skill says "When to activate: when the user asks about planning a trip".
  // This question should NOT trigger the skill's procedure.
  console.log("--- Call 1: random question (skill should NOT influence) ---");
  const result1 = await agent.invoke({
    messages: [new HumanMessage("What is the capital of Japan?")],
  });
  const lastMsg1 = result1.messages[result1.messages.length - 1];
  console.log(`[ai] ${(lastMsg1.content as string).slice(0, 200)}`);
  console.log("  Tool calls:", result1.messages.filter((m: any) => m.tool_calls?.length).length ? "yes" : "none");
  // skillsMetadata is populated by SkillsMiddleware on first invoke.
  // It shows what's loaded — not what's "active" (the model decides that).
  logLoadedSkills(result1);
  console.log("\n  Conversation trace:");
  logConversation(result1.messages);
  console.log();

  // --- Call 2: travel question that matches the skill's activation criteria ---
  // Same agent, same skills in the system prompt — but NOW the model recognizes
  // the travel context and follows the skill's procedure (strict TRAVEL CARD format).
  // Progressive disclosure: the model reads the full SKILL.md via read_file,
  // then executes the procedure it found inside.
  console.log("--- Call 2: travel question (skill SHOULD influence) ---");
  const result2 = await agent.invoke({
    messages: [new HumanMessage("I want to plan a trip from Paris to Bali in July")],
  });
  const lastMsg2 = result2.messages[result2.messages.length - 1];
  console.log(`[ai] ${lastMsg2.content as string}\n`);

  console.log("  Conversation trace:");
  logConversation(result2.messages);
  console.log();
}

// TODO(human): Create a second skill "budget-advisor" in skills/budget-advisor/SKILL.md
// that makes the agent:
//   1. Always mention an estimated budget range for the destination
//   2. Suggest cost-saving tips (off-season travel, nearby alternatives)
//   3. Compare the suggested flight price to the average
// Then run Part B again and observe how both skills influence the agent's response.
// Hint: both skills load from the same skills/ directory.

// Run a specific part: npx tsx exercises/08-deepagents/index.ts A (or B). No arg = all.
const partFilter = process.argv[2]?.toUpperCase();

async function main() {
  if (!partFilter || partFilter === "A") await partA();
  if (!partFilter || partFilter === "B") await partB();
}

main();
