import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
// MemorySaver is an in-memory checkpointer — it saves the graph state after
// every node execution. In production you'd use a database-backed checkpointer
// (PostgreSQL, Redis, etc.), but MemorySaver is perfect for learning.
// It lives in @langchain/langgraph (not a separate checkpoint package).
import { MemorySaver } from "@langchain/langgraph";
import { model, tools, logConversation } from "../utils";

// --- Part A: Conversation memory with MemorySaver + thread_id ---
async function partA() {
  console.log("=== Part A: Conversation memory (MemorySaver + thread_id) ===\n");

  // In exercise 06, each .invoke() was stateless — the graph had no memory
  // of previous conversations. Here we add a checkpointer to change that.

  const modelWithTools = model.bindTools(tools);

  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
  }

  function shouldContinue(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls?.length) return "tools";
    return END;
  }

  // Step 1: Create the checkpointer — it stores state snapshots in memory.
  const checkpointer = new MemorySaver();

  // Step 2: Pass checkpointer to .compile() — this is the ONLY change vs exercise 06.
  // The graph is identical, but now every node execution saves a checkpoint.
  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .compile({ checkpointer }); // ← the magic line

  // Step 3: thread_id identifies a conversation — same thread_id = same memory.
  // This is the equivalent of a session ID. In di-agent-ui, each chat session
  // has a unique thread_id stored alongside messages in Redis.
  const config = { configurable: { thread_id: "trip-planning-1" } };

  // First message: ask about weather
  console.log("--- Turn 1: asking about weather ---");
  const result1 = await graph.invoke(
    { messages: [new HumanMessage("What's the weather like in Bali in July?")] },
    config,
  );
  const lastMsg1 = result1.messages[result1.messages.length - 1];
  console.log(`[ai] ${(lastMsg1.content as string).slice(0, 150)}...\n`);

  // Second message: follow-up — the agent remembers the context!
  // We only send the NEW message. The checkpointer automatically loads
  // all previous messages from the thread. This is why we don't need to
  // re-send the full conversation history like we did in exercises 01-06.
  console.log("--- Turn 2: follow-up (agent should remember Bali) ---");
  const result2 = await graph.invoke(
    { messages: [new HumanMessage("And how do I get there from Paris?")] },
    config, // same thread_id → same conversation
  );
  const lastMsg2 = result2.messages[result2.messages.length - 1];
  console.log(`[ai] ${(lastMsg2.content as string).slice(0, 150)}...\n`);

  // Proof: result2 contains ALL messages from both turns
  console.log(`Total messages after 2 turns: ${result2.messages.length}`);
  logConversation(result2.messages);
  console.log();
}

// --- Part B: Thread isolation — parallel conversations don't leak ---
async function partB() {
  console.log("=== Part B: Thread isolation (multiple conversations) ===\n");

  // Each thread_id is a separate conversation with its own state.
  // Thread "alice" and thread "bob" don't share any messages or context.
  // This is how di-agent-ui handles multiple users chatting simultaneously.

  const modelWithTools = model.bindTools(tools);

  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
  }

  function shouldContinue(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls?.length) return "tools";
    return END;
  }

  const checkpointer = new MemorySaver();
  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .compile({ checkpointer });

  // Two separate threads — two separate conversations
  const aliceConfig = { configurable: { thread_id: "alice-trip" } };
  const bobConfig = { configurable: { thread_id: "bob-trip" } };

  // Alice asks about Bali
  console.log("--- Alice (thread: alice-trip) ---");
  const aliceResult = await graph.invoke(
    { messages: [new HumanMessage("What's the weather in Bali in July?")] },
    aliceConfig,
  );
  const aliceLast = aliceResult.messages[aliceResult.messages.length - 1];
  console.log(`[ai → alice] ${(aliceLast.content as string).slice(0, 120)}...\n`);

  // Bob asks about Tokyo — completely independent conversation
  console.log("--- Bob (thread: bob-trip) ---");
  const bobResult = await graph.invoke(
    { messages: [new HumanMessage("What's the weather in Tokyo in December?")] },
    bobConfig,
  );
  const bobLast = bobResult.messages[bobResult.messages.length - 1];
  console.log(`[ai → bob] ${(bobLast.content as string).slice(0, 120)}...\n`);

  // Alice follows up — she gets HER context (Bali), not Bob's (Tokyo)
  console.log("--- Alice follow-up (should remember Bali, not Tokyo) ---");
  const aliceResult2 = await graph.invoke(
    { messages: [new HumanMessage("How do I get there from Paris?")] },
    aliceConfig, // same thread → Alice's conversation
  );
  const aliceLast2 = aliceResult2.messages[aliceResult2.messages.length - 1];
  console.log(`[ai → alice] ${(aliceLast2.content as string).slice(0, 150)}...\n`);

  // Proof: message counts are independent
  console.log(`Alice's thread: ${aliceResult2.messages.length} messages`);
  console.log(`Bob's thread: ${bobResult.messages.length} messages`);
  console.log();
}

// --- Part C: State inspection — getState + getStateHistory ---
async function partC() {
  console.log("=== Part C: State inspection (getState + getStateHistory) ===\n");

  // Beyond memory, checkpointing enables state inspection and time travel.
  // getState() returns the current snapshot, getStateHistory() returns ALL
  // snapshots — one per node execution. This is how you debug agent behavior:
  // see exactly what the state looked like after each step.

  const modelWithTools = model.bindTools(tools);

  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
  }

  function shouldContinue(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls?.length) return "tools";
    return END;
  }

  const checkpointer = new MemorySaver();
  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .compile({ checkpointer });

  const config = { configurable: { thread_id: "inspection-demo" } };

  // Run a conversation that will trigger tools (more interesting checkpoints)
  await graph.invoke(
    { messages: [new HumanMessage("What's the weather in Bali in July and flights from Paris?")] },
    config,
  );

  // --- getState: current snapshot ---
  // Returns the LATEST checkpoint — the final state after the graph finished.
  const currentState = await graph.getState(config);
  console.log("--- Current state (getState) ---");
  console.log(`Messages: ${currentState.values.messages.length}`);
  console.log(`Next nodes: [${currentState.next.join(", ")}]`); // empty = graph finished
  // The checkpoint metadata tells you which node created this snapshot
  console.log(`Created by: ${currentState.metadata?.source}`);
  console.log(`Checkpoint ID: ${currentState.config?.configurable?.checkpoint_id}\n`);

  // --- getStateHistory: all checkpoints (reverse chronological) ---
  // Each checkpoint is a snapshot taken AFTER a node executed.
  // For a tool-using conversation: START → agent (tool_calls) → tools → agent (final) → END
  // That's ~4 checkpoints (plus the initial input checkpoint).
  const history: Awaited<ReturnType<typeof graph.getState>>[] = [];
  for await (const snapshot of graph.getStateHistory(config)) {
    history.push(snapshot);
  }

  console.log(`--- State history: ${history.length} checkpoints ---`);
  // History is reverse-chronological — latest first. Reverse for readability.
  for (const [i, snapshot] of history.reverse().entries()) {
    const msgCount = snapshot.values.messages?.length ?? 0;
    const source = snapshot.metadata?.source ?? "unknown";
    const step = snapshot.metadata?.step ?? "?";
    const nextNodes = snapshot.next?.join(", ") || "END";
    console.log(
      `  [${i}] step=${step} source=${source} messages=${msgCount} next=[${nextNodes}]`,
    );
  }

  // Key insight: every intermediate state is preserved. You can:
  // 1. Debug: see exactly what the agent saw at each step
  // 2. Replay: re-run from any checkpoint (time travel)
  // 3. Fork: modify a past state and continue from there (branching)
  // Exercise 10 (Human-in-the-loop) builds on this for approval workflows.
  console.log();
}

// Run a specific part with: npx tsx index.ts A (or B, C). No arg = run all.
const partFilter = process.argv[2]?.toUpperCase();

async function main() {
  if (!partFilter || partFilter === "A") await partA();
  if (!partFilter || partFilter === "B") await partB();
  if (!partFilter || partFilter === "C") await partC();
}

main();
