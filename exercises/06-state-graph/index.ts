import { config } from "dotenv";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
// StateGraph is the core primitive of LangGraph. In exercise 05, createAgent
// built a StateGraph for us. Here we build one from scratch to understand
// what's inside the box.
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
// ToolNode is the same automatic tool dispatcher that createAgent uses internally.
// It reads tool_calls from the last AIMessage and invokes the matching tools.
import { ToolNode } from "@langchain/langgraph/prebuilt";

config({ path: ".env.local" });

const model = new ChatAnthropic({
  model: "claude-haiku-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Same tools as exercises 03/04/05 — familiar code, focus on the new concept
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
  const graph = new StateGraph(MessagesAnnotation)
    // addNode(name, function) — registers a node in the graph
    .addNode("agent", callModel)
    // ToolNode is a prebuilt node that reads tool_calls from the last AI message,
    // dispatches them to the matching tool, and returns ToolMessages.
    // This is the same ToolNode that createAgent uses internally.
    .addNode("tools", new ToolNode(tools))
    // addEdge(from, to) — unconditional edge: always go from A to B
    // START → "agent": the graph always begins by calling the LLM
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
  for (const msg of result.messages) {
    const { type } = msg;
    if (type === "human") {
      console.log(`[human] ${(msg.content as string).slice(0, 80)}...`);
    } else if (type === "ai" && (msg as AIMessage).tool_calls?.length) {
      const calls = (msg as AIMessage).tool_calls!.map(
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

// --- Part B: Custom pre-processing node (context injection) ---
async function partB() {
  console.log("=== Part B: Custom pre-processing node ===\n");

  // The real power of StateGraph: you can add nodes BEFORE or AFTER the LLM.
  // In di-agent-ui, the system prompt is built dynamically from skills + traveler context.
  // Here we simulate that: a "prepare" node reads raw traveler data from the state
  // and builds a systemPrompt that the agent node will use.

  // Extend the state with custom fields — Annotation.Root lets you add
  // fields beyond just messages.
  // NOTE: We import Annotation from @langchain/langgraph (same package as StateGraph).
  const { Annotation } = await import("@langchain/langgraph");
  const GraphState = Annotation.Root({
    // Spread MessagesAnnotation.spec to inherit the `messages` field with its reducer
    ...MessagesAnnotation.spec,
    // Raw traveler context — the input data
    travelContext: Annotation<string>,
    // Built by the prepare node, read by the agent node
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
    // Update the systemPrompt field — other nodes can read it
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
    systemPrompt: "", // will be overwritten by prepare node
  });

  console.log(`Total messages: ${result.messages.length}\n`);

  const lastMessage = result.messages[result.messages.length - 1];
  console.log(lastMessage.content);
  console.log();
}

// --- Part C: TODO(human) ---
// Add a post-processing node that runs AFTER the LLM's final response.
//
// Idea: a "summarize" node that takes the last AI message and appends a
// short summary line (e.g., key facts extracted). This is the mirror of
// Part B's pre-processing — together they form a prepare → agent → post-process pipeline.
//
// Hints:
// 1. Add a new node "postprocess" after the agent (when shouldContinue returns END)
// 2. The routing function should return "postprocess" instead of END when the LLM is done
// 3. Add an edge from "postprocess" → END
// 4. The postprocess function can call the LLM again with a different prompt,
//    or simply parse/transform the last message
//
// Stretch goal: make the postprocess node call the LLM with:
//   "Summarize the above conversation in 1 bullet point per key fact."
//   and append that as the final message.

// Run a specific part with: npx tsx index.ts A (or B, C). No arg = run all.
const partFilter = process.argv[2]?.toUpperCase();

async function main() {
  if (!partFilter || partFilter === "A") await partA();
  if (!partFilter || partFilter === "B") await partB();
  // if (!partFilter || partFilter === "C") await partC();
}

main();
