import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
// StateGraph is the core primitive of LangGraph. In exercise 05, createAgent
// built a StateGraph for us. Here we build one from scratch to understand
// what's inside the box.
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
// ToolNode is the same automatic tool dispatcher that createAgent uses internally.
// It reads tool_calls from the last AIMessage and invokes the matching tools.
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { model, tools, logConversation } from "../utils";

// --- Part A: Rebuild createAgent from scratch ---
async function partA() {
  console.log("=== Part A: StateGraph from scratch (recreating createAgent) ===\n");

  // In exercise 05, createAgent({ model, tools }) built a graph with 2 nodes
  // and a conditional edge. Here we build the exact same thing manually.

  // Step 1: Bind tools to the model — same as exercise 03's .bindTools(),
  // but now the graph node will call this instead of us calling it directly.
  const modelWithTools = model.bindTools(tools);

  // Step 2: Define the "agent" node — calls the LLM with current messages.
  // A node is just an async function: (state) => partial state update.
  // It receives the full state and returns ONLY the fields to update.
  // MessagesAnnotation has a single field: `messages` (with append semantics).
  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await modelWithTools.invoke(state.messages);
    // Return { messages: [response] } — the graph APPENDS this to state.messages
    // (not replaces!) because MessagesAnnotation uses a reducer that merges arrays.
    return { messages: [response] };
  }

  // Step 3: Define the conditional edge — the routing logic.
  // After the "agent" node runs, this function decides: continue or stop?
  // This is the EXACT logic that createAgent hides from you.
  function shouldContinue(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    // If the LLM returned tool_calls → route to "tools" node
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    // Otherwise → END (the LLM is done, no more tools to call)
    return END;
  }

  // Step 4: Wire everything into a StateGraph.
  // MessagesAnnotation defines the state shape: { messages: BaseMessage[] }
  // with a built-in reducer that appends new messages instead of replacing.
  //
  // IMPORTANT: The order of .addEdge() / .addConditionalEdges() calls DOES NOT MATTER.
  // You're declaring a routing table (graph topology), not writing sequential instructions.
  // The lines below could be reordered freely — the graph would be identical.
  // Execution order is determined by the graph structure, not by declaration order.
  const graph = new StateGraph(MessagesAnnotation)
    // addNode(name, function) — registers a node in the graph
    .addNode("agent", callModel)
    // ToolNode is a prebuilt node that reads tool_calls from the last AI message,
    // dispatches them to the matching tool, and returns ToolMessages.
    // This is the same ToolNode that createAgent uses internally.
    .addNode("tools", new ToolNode(tools))
    // addEdge(from, to) — unconditional edge: always go from A to B
    // START declared first arbitrarily — declaration order doesn't matter.
    // The graph still begins here because START is the entry point by definition.
    .addEdge(START, "agent")
    // addConditionalEdges(from, routingFn) — the routing function returns
    // the name of the next node (or END). This is the ReAct loop's branching point.
    .addConditionalEdges("agent", shouldContinue)
    // After tools execute, always go back to the agent for another LLM call
    .addEdge("tools", "agent")
    // compile() freezes the graph and returns a runnable (same interface as createAgent's result)
    .compile();

  // The compiled graph has the same .invoke() and .stream() as createAgent!
  const userMessage = new HumanMessage(
    "I want to go to Bali in July, flying from Paris. What's the weather like and how do I get there?",
  );

  const result = await graph.invoke({ messages: [userMessage] });

  console.log(`Total messages in conversation: ${result.messages.length}\n`);

  // Same output format as exercise 05 Part A — proving our hand-built graph
  // behaves identically to createAgent.
  logConversation(result.messages);
  console.log();
}

// --- Part B: Custom pre-processing node (context injection) ---
async function partB() {
  console.log("=== Part B: Custom pre-processing node ===\n");

  // The real power of StateGraph: you can add nodes BEFORE or AFTER the LLM.
  // In di-agent-ui, the system prompt is built dynamically from skills + traveler context.
  // Here we simulate that: a "prepare" node reads raw traveler data from the state
  // and builds a systemPrompt that the agent node will use.

  // Annotation defines state — the name is misleading but the idea is:
  // it "annotates" each field with HOW to update it (replace? append? merge?).
  // So Annotation.Root() = "define a state shape where each field knows its update strategy."
  // MessagesAnnotation's `messages` field is annotated with "append", custom fields default to "replace".
  const { Annotation } = await import("@langchain/langgraph");
  const GraphState = Annotation.Root({
    // Without this spread, our custom state would have NO messages field.
    // MessagesAnnotation.spec contains the `messages` field definition + its append reducer.
    ...MessagesAnnotation.spec,
    // Raw traveler context — the input data.
    // Explicit reducer: (old, new) => new = replace strategy (last write wins).
    travelContext: Annotation<string>({
      reducer: (_current, update) => update,
      default: () => "",
    }),
    // Annotation<T> with no options is shorthand for the same "replace" strategy above.
    systemPrompt: Annotation<string>,
  });

  const modelWithTools = model.bindTools(tools);

  // The "prepare" node: reads travelContext from state, builds a systemPrompt.
  // This is a pure data transformation — no LLM call, no side effects.
  // In di-agent-ui, this would be where skills + profile get assembled into the prompt.
  async function prepare(state: typeof GraphState.State) {
    const prompt =
      `You are a travel advisor. Here is context about the traveler:\n${state.travelContext}\n\n` +
      "Use this context to personalize your recommendations. Be concise — 3 sentences max.";
    console.log("[prepare node] Built system prompt from traveler context");
    // Partial return: only the keys you include get updated. travelContext and messages
    // are untouched. If we added `messages` here, the append reducer would kick in.
    // If we added `travelContext`, it would be replaced (last write wins).
    return { systemPrompt: prompt };
  }

  // The agent node reads systemPrompt from state and prepends it as a SystemMessage.
  // This is the key insight: nodes can read AND write custom state fields,
  // not just messages. The graph state is the shared memory between nodes.
  async function callModel(state: typeof GraphState.State) {
    const messagesWithSystem = [
      new SystemMessage(state.systemPrompt),
      ...state.messages,
    ];
    const response = await modelWithTools.invoke(messagesWithSystem);
    // We return an array with ONE message, but the append reducer from
    // MessagesAnnotation.spec merges it into the existing messages array.
    // That's why we don't return all messages — just the new one.
    return { messages: [response] };
  }

  function shouldContinue(state: typeof GraphState.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls?.length) return "tools";
    return END;
  }

  // Build the graph with 3 nodes: prepare → agent → tools (loop)
  const graph = new StateGraph(GraphState)
    .addNode("prepare", prepare)
    .addNode("agent", callModel)
    .addNode("tools", new ToolNode(tools))
    // START → prepare: first, build the system prompt from context
    .addEdge(START, "prepare")
    // prepare → agent: then call the LLM with the enriched state
    .addEdge("prepare", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .compile();

  // Invoke with both messages AND custom state fields
  const result = await graph.invoke({
    messages: [
      new HumanMessage("I want to go to Bali in July from Paris."),
    ],
    // This custom field flows through the state — the prepare node reads it
    travelContext: "Budget traveler, prefers hostels, vegetarian, first time in Asia.",
    // systemPrompt: "", // will be overwritten by prepare node
  });

  console.log(`Total messages: ${result.messages.length}\n`);

  const lastMessage = result.messages[result.messages.length - 1];
  console.log(lastMessage.content);
  console.log();
}

// --- Part C: Post-processing node (the mirror of Part B's prepare) ---
async function partC() {
  console.log("=== Part C: Post-processing node (prepare → agent → postprocess) ===\n");

  // Part B added a node BEFORE the agent. Now we add one AFTER.
  // Together: prepare → agent ↔ tools → postprocess → END
  // This is the full pipeline pattern used in production agents for
  // logging, summarization, or response transformation.

  const { Annotation } = await import("@langchain/langgraph");
  const GraphState = Annotation.Root({
    ...MessagesAnnotation.spec,
    travelContext: Annotation<string>,
    systemPrompt: Annotation<string>,
  });

  const modelWithTools = model.bindTools(tools);

  async function prepare(state: typeof GraphState.State) {
    const prompt =
      `You are a travel advisor. Here is context about the traveler:\n${state.travelContext}\n\n` +
      "Use this context to personalize your recommendations.";
    console.log("[prepare] Built system prompt");
    return { systemPrompt: prompt };
  }

  async function callModel(state: typeof GraphState.State) {
    const messagesWithSystem = [
      new SystemMessage(state.systemPrompt),
      ...state.messages,
    ];
    const response = await modelWithTools.invoke(messagesWithSystem);
    return { messages: [response] };
  }

  // The NEW part: postprocess calls the LLM again with a summarization prompt.
  // It reads ALL messages from state (the full conversation) and asks for a summary.
  // The summary is appended as a new AIMessage — the append reducer handles it.
  async function postprocess(state: typeof GraphState.State) {
    console.log("[postprocess] Summarizing conversation...");
    // Call the base model (no tools) — we just want text, not tool calls.
    const summary = await model.invoke([
      ...state.messages,
      new HumanMessage(
        "Summarize the above conversation in 1 bullet point per key fact. Start with '📋 Summary:'",
      ),
    ]);
    return { messages: [summary] };
  }

  // The routing function now has 3 possible destinations instead of 2:
  // "tools" (continue the ReAct loop) or "postprocess" (LLM is done, summarize).
  function shouldContinue(state: typeof GraphState.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls?.length) return "tools";
    // Instead of END, route to postprocess — this is the key change vs Part A/B.
    return "postprocess";
  }

  // The graph: prepare → agent ↔ tools → postprocess → END
  const graph = new StateGraph(GraphState)
    .addNode("prepare", prepare)
    .addNode("agent", callModel)
    .addNode("tools", new ToolNode(tools))
    .addNode("postprocess", postprocess)
    .addEdge(START, "prepare")
    .addEdge("prepare", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    // postprocess → END: after summarizing, we're done.
    .addEdge("postprocess", END)
    .compile();

  const result = await graph.invoke({
    messages: [
      new HumanMessage("I want to go to Bali in July from Paris."),
    ],
    travelContext: "Budget traveler, prefers hostels, vegetarian, first time in Asia.",
    systemPrompt: "",
  });

  console.log(`\nTotal messages: ${result.messages.length}\n`);
  logConversation(result.messages);

  // The LAST message is now the summary, not the agent's response.
  console.log("\n--- Summary (last message) ---");
  console.log(result.messages[result.messages.length - 1].content);
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
