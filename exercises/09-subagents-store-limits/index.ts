import { createDeepAgent, StateBackend, StoreBackend, CompositeBackend } from "deepagents";
import { createMiddleware } from "langchain";
import type { AIMessage } from "@langchain/core/messages";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MemorySaver, InMemoryStore } from "@langchain/langgraph";
import { z } from "zod";
import { model, getWeatherTool, searchFlightsTool, logConversation } from "../utils";

// --- Part A: Subagents — task delegation via the task tool ---
async function partA() {
  console.log("=== Part A: Subagents (task tool delegation) ===\n");

  // In ex08, createDeepAgent gave us a single agent with all tools.
  // But what if a task is too complex for one agent? DeepAgents adds
  // SubAgentMiddleware that injects a `task` tool. The main agent
  // delegates work to specialized subagents, each with their own tools
  // and system prompt.
  //
  // Architecture:
  //   Main Agent (orchestrator, no domain tools)
  //     └─ task tool (added by SubAgentMiddleware)
  //          ├─ "weather-expert"  → has get_weather
  //          └─ "flight-expert"   → has search_flights
  //
  // The main agent CANNOT call get_weather or search_flights directly.
  // It MUST delegate via the task tool — like a manager assigning work.
  const agent = createDeepAgent({
    model,
    // No domain tools on the main agent — forces delegation
    tools: [],
    subagents: [
      {
        // Each subagent has: name (for selection), description (shown to the model),
        // systemPrompt (identity), and tools (what it can do).
        name: "weather-expert",
        description: "Specialized in weather analysis and climate data for any destination",
        systemPrompt: "You are a weather expert. Provide concise climate analysis. Always use the get_weather tool.",
        tools: [getWeatherTool],
      },
      {
        name: "flight-expert",
        description: "Specialized in flight search and travel logistics between cities",
        systemPrompt: "You are a flight booking expert. Always use the search_flights tool to find options.",
        tools: [searchFlightsTool],
      },
    ],
    systemPrompt: "You are a travel planning coordinator. You have no domain tools yourself. " +
      "Use the task tool to delegate weather questions to weather-expert " +
      "and flight questions to flight-expert. Be concise.",
    checkpointer: new MemorySaver(),
  });

  const config = { configurable: { thread_id: "subagent-demo" } };

  // The main agent receives a multi-part question.
  // It should delegate weather to weather-expert and flights to flight-expert.
  console.log("--- Asking a question that requires both subagents ---");
  const result = await agent.invoke(
    { messages: [new HumanMessage("What's the weather in Bali in July, and find me a flight from Paris?")] },
    config,
  );

  const lastMsg = result.messages[result.messages.length - 1];
  console.log(`\n[ai] ${(lastMsg.content as string).slice(0, 300)}\n`);

  // The conversation trace reveals the delegation pattern:
  // [human] question → [ai → task] delegate to weather-expert → [tool result] weather data
  //                   → [ai → task] delegate to flight-expert → [tool result] flight data
  //                   → [ai → final] combined answer
  console.log("--- Conversation trace (look for task tool calls) ---");
  logConversation(result.messages);
  console.log();

  // Key insight: the main agent never called get_weather or search_flights.
  // It used the `task` tool to delegate. Each subagent ran in isolation
  // with its own tools, system prompt, and filtered state.
  // State isolation: subagents don't see the parent's full message history
  // (filtered via EXCLUDED_STATE_KEYS: messages, todos, skillsMetadata, etc.)
}

// --- Part B: Store & backends — persistence layers ---
async function partB() {
  console.log("=== Part B: Store & Backends (ephemeral vs persistent) ===\n");

  // DeepAgents gives the agent filesystem tools (ls, read_file, write_file, etc.)
  // via FilesystemMiddleware. WHERE those files live depends on the backend:
  //
  //   StateBackend   → files live in agent state → gone after invocation
  //   StoreBackend   → files live in a LangGraph Store → persist across invocations
  //   CompositeBackend → routes by path prefix, mix both strategies
  //
  // In production: StoreBackend backed by Redis for cross-conversation persistence.
  // Here we use InMemoryStore (same API, no infra needed).

  // --- 1. StateBackend: ephemeral files ---
  console.log("--- 1. StateBackend (ephemeral) ---");
  // StateBackend reads/writes to `state.files` — the in-memory state object.
  // write() returns a WriteResult with `filesUpdate` — a diff to apply to state.
  // The middleware applies this automatically; here we do it manually.
  const ephemeralState: { files: Record<string, unknown> } = { files: {} };
  const ephemeralBackend = new StateBackend({ state: ephemeralState });

  // Write returns filesUpdate — the middleware merges this into state.files
  const writeResult = ephemeralBackend.write("/notes.md", "Trip preferences: business class, direct flights");
  // In middleware, filesUpdate is applied via LangGraph's state reducer.
  // Here we apply it manually to simulate what the middleware does.
  if (writeResult.filesUpdate) Object.assign(ephemeralState.files, writeResult.filesUpdate);

  console.log("  Wrote /notes.md → filesUpdate applied to state.files");
  console.log("  state.files keys:", Object.keys(ephemeralState.files));
  console.log("  Read back:", ephemeralBackend.read("/notes.md"));

  // Simulate a new invocation — new state object → files are gone
  const freshBackend = new StateBackend({ state: { files: {} } });
  // StateBackend.read returns an error string (not an exception) when file is missing
  const freshRead = freshBackend.read("/notes.md");
  console.log("  After new invocation:", freshRead.includes("not found") ? "NOT FOUND (ephemeral!)" : freshRead);
  console.log();

  // --- 2. StoreBackend: persistent files ---
  console.log("--- 2. StoreBackend (persistent via InMemoryStore) ---");
  // StoreBackend uses LangGraph's BaseStore (InMemoryStore, Redis, etc.)
  // Files survive across invocations because they're in the store, not in state.
  const store = new InMemoryStore();

  const persistentBackend = new StoreBackend(
    { state: {}, store },
    // namespace isolates data — like a directory per user/org
    { namespace: ["user-42", "filesystem"] },
  );

  await persistentBackend.write("/prefs.md", "Business class, window seat, vegetarian meals");
  console.log("  Wrote /prefs.md to StoreBackend (namespace: user-42)");
  console.log("  Read back:", await persistentBackend.read("/prefs.md"));

  // Simulate a new invocation — SAME store, new backend instance
  const persistentBackend2 = new StoreBackend(
    { state: {}, store },  // same store reference
    { namespace: ["user-42", "filesystem"] },
  );
  console.log("  After new invocation:", await persistentBackend2.read("/prefs.md"));
  console.log("  → File persists across invocations!\n");

  // Different namespace = isolated data (multi-tenant)
  const otherUserBackend = new StoreBackend(
    { state: {}, store },
    { namespace: ["user-99", "filesystem"] },
  );
  try {
    await otherUserBackend.read("/prefs.md");
  } catch {
    console.log("  user-99 namespace: /prefs.md → NOT FOUND (namespace isolation)\n");
  }

  // --- 3. CompositeBackend: mix strategies ---
  console.log("--- 3. CompositeBackend (route by path prefix) ---");
  // CompositeBackend routes operations by path prefix.
  // Route keys must start with / to match absolute paths (e.g., "/persist/").
  // Pattern: scratch files ephemeral, user data persistent.
  const compositeState: { files: Record<string, unknown> } = { files: {} };
  const composite = new CompositeBackend(
    new StateBackend({ state: compositeState }),                            // default → ephemeral
    { "/persist/": new StoreBackend({ state: {}, store }, { namespace: ["composite-demo"] }) },
  );

  // /scratch.md → no matching prefix → default StateBackend (ephemeral)
  const scratchResult = await composite.write("/scratch.md", "Temporary computation");
  if (scratchResult.filesUpdate) Object.assign(compositeState.files, scratchResult.filesUpdate);

  // /persist/prefs.md → matches "/persist/" prefix → StoreBackend (persistent)
  await composite.write("/persist/prefs.md", "Direct flights only");
  console.log("  Wrote /scratch.md (→ StateBackend) and /persist/prefs.md (→ StoreBackend)");

  // After "new invocation", only /persist/* survives
  const composite2 = new CompositeBackend(
    new StateBackend({ state: { files: {} } }),                            // fresh state → scratch gone
    { "/persist/": new StoreBackend({ state: {}, store }, { namespace: ["composite-demo"] }) },
  );
  const scratchRead = await composite2.read("/scratch.md");
  console.log("  New invocation: /scratch.md →", scratchRead.includes("not found") ? "GONE" : scratchRead);
  console.log("  New invocation: /persist/prefs.md →", await composite2.read("/persist/prefs.md"));

  // --- Plugging into createDeepAgent ---
  console.log("\n  How to use with createDeepAgent:");
  console.log("  ```");
  console.log("  const store = new InMemoryStore(); // or Redis in production");
  console.log("  const agent = createDeepAgent({");
  console.log("    model, tools, store,");
  console.log("    backend: (ctx) => new StoreBackend(ctx, { namespace: ['user-42', 'fs'] }),");
  console.log("  });");
  console.log("  ```");
  console.log("  The backend factory receives { state, store } at each invocation.\n");
}

// --- Part C: Request-scoped tools & custom middleware ---
async function partC() {
  console.log("=== Part C: Request-scoped Tools & Custom Middleware ===\n");

  // --- 1. Request-scoped tools (closure pattern) ---
  console.log("--- 1. Request-scoped tools (closure captures per-request context) ---\n");

  // In production, each API request creates FRESH tool instances
  // with request-specific context captured in closure.
  // The LLM never sees sessionId or userId — they're invisible parameters.
  //
  // Pattern:
  //   POST /api/chat → createScopedTools(sessionId, userId) → createDeepAgent({ tools })
  //
  // Why closures? Because LangChain tools have a fixed schema (what the LLM sees).
  // The sessionId isn't a tool parameter — it's baked into the tool at creation time.

  function createScopedTools(sessionId: string, userId: string) {
    // Each tool closes over sessionId/userId — invisible to the LLM
    const getUserPreferences = tool(
      async () => {
        // In production: fetch from DB using userId
        console.log(`    [tool internal] Fetching prefs for user=${userId}, session=${sessionId}`);
        return `User ${userId} preferences: window seat, vegetarian, direct flights only`;
      },
      {
        name: "get_user_preferences",
        description: "Get the current user's travel preferences",
        schema: z.object({}),
      },
    );

    const saveTripNote = tool(
      async ({ note }) => {
        // In production: save to DB scoped to session
        console.log(`    [tool internal] Saving note for session=${sessionId}: "${note}"`);
        return `Note saved to session ${sessionId}`;
      },
      {
        name: "save_trip_note",
        description: "Save a note about the current trip planning session",
        schema: z.object({ note: z.string().describe("The note to save") }),
      },
    );

    return [getUserPreferences, saveTripNote, getWeatherTool];
  }

  // Simulate two different API requests with different session contexts
  console.log("  Request 1: user=alice, session=sess-001");
  const tools1 = createScopedTools("sess-001", "alice");
  const agent1 = createDeepAgent({ model, tools: tools1, name: "travel-agent" });
  const result1 = await agent1.invoke({
    messages: [new HumanMessage("What are my preferences and what's the weather in Tokyo in April?")],
  });
  console.log(`  [ai] ${(result1.messages[result1.messages.length - 1].content as string).slice(0, 200)}\n`);

  console.log("  Request 2: user=bob, session=sess-002 (different context, same agent code)");
  const tools2 = createScopedTools("sess-002", "bob");
  const agent2 = createDeepAgent({ model, tools: tools2, name: "travel-agent" });
  const result2 = await agent2.invoke({
    messages: [new HumanMessage("Save a note: I want to visit Japan in cherry blossom season")],
  });
  console.log(`  [ai] ${(result2.messages[result2.messages.length - 1].content as string).slice(0, 200)}\n`);

  // --- 2. Custom middleware (createMiddleware) ---
  console.log("--- 2. Custom middleware (lifecycle hooks) ---\n");

  // Middleware wraps agent execution with hooks:
  //   beforeAgent  → runs once before the agent loop starts
  //   beforeModel  → runs before each LLM call
  //   afterModel   → runs after each LLM call
  //   wrapToolCall → wraps each tool execution (logging, auth, caching)
  //   afterAgent   → runs once after the agent loop ends
  //
  // Plus: stateSchema (persisted state), contextSchema (per-invocation context), tools
  const metricsMiddleware = createMiddleware({
    name: "MetricsMiddleware",
    stateSchema: z.object({
      toolCallCount: z.number().default(0),
    }),
    beforeAgent: async (_state) => {
      console.log("  [middleware] Agent invocation started");
      return { toolCallCount: 0 };
    },
    wrapToolCall: async (request, handler) => {
      const start = Date.now();
      console.log(`  [middleware] Tool call: ${request.toolCall.name}`);
      const result = await handler(request);
      console.log(`  [middleware] Tool ${request.toolCall.name} completed in ${Date.now() - start}ms`);
      return result;
    },
    afterAgent: async (_state) => {
      console.log(`  [middleware] Agent invocation complete`);
      return undefined;
    },
  });

  const agentWithMiddleware = createDeepAgent({
    model,
    tools: [getWeatherTool],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- createMiddleware return type has internal brand mismatch
    middleware: [metricsMiddleware as any],
    name: "monitored-agent",
  });

  const resultMw = await agentWithMiddleware.invoke({
    messages: [new HumanMessage("What's the weather in Bali in July?")],
  });
  console.log(`\n  [ai] ${(resultMw.messages[resultMw.messages.length - 1].content as string).slice(0, 200)}\n`);

  // --- 3. Suggestion hydration pattern (conceptual) ---
  console.log("--- 3. Suggestion hydration pattern (production concept) ---\n");
  console.log("  In production, agents return lightweight suggestion IDs:");
  console.log("    agent output: { suggestions: ['dest-bali-july', 'dest-tokyo-april'] }");
  console.log("  The backend hydrates them with full data before sending to frontend:");
  console.log("    hydrated: [{ id: 'dest-bali-july', name: 'Bali', price: 650€, image: '...' }]");
  console.log("  This decouples the agent's reasoning from the display format.");
  console.log("  Implementation: a wrapToolCall middleware or afterAgent hook that");
  console.log("  intercepts suggestion IDs and fetches full data from the DB.\n");
}

// --- Part D: Limits — DeepAgents vs StateGraph ---
async function partD() {
  console.log("=== Part D: Limits — DeepAgents vs StateGraph ===\n");

  // DeepAgents = single agent loop (ReactAgent under the hood)
  // The LLM decides everything: which tools to call, in what order, when to stop.
  // You influence behavior via skills (markdown) and tools — but can't GUARANTEE execution order.
  //
  // StateGraph (ex06) = arbitrary graph topology
  // YOU control the flow: nodes, edges, conditional routing, parallel branches.
  // The LLM is just ONE node — other nodes can be deterministic code.

  console.log("  Scenario: flight booking with mandatory validation\n");

  console.log("  With DeepAgents (skill-based, non-deterministic):");
  console.log("  ┌──────────────────────────────────────────────────┐");
  console.log("  │  Agent Loop (single loop, LLM decides flow)     │");
  console.log("  │                                                  │");
  console.log("  │  1. LLM reads skill: 'validate before booking'  │");
  console.log("  │  2. LLM calls validate_booking tool... maybe    │");
  console.log("  │  3. LLM calls book_flight tool                  │");
  console.log("  │                                                  │");
  console.log("  │  ⚠ No guarantee step 2 happens before step 3   │");
  console.log("  │  ⚠ The LLM might skip validation entirely      │");
  console.log("  └──────────────────────────────────────────────────┘\n");

  console.log("  With StateGraph (deterministic, guaranteed flow):");
  console.log("  ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌───────┐");
  console.log("  │  START  │───→│  agent   │───→│validate │───→│ tools │───→ ...");
  console.log("  └─────────┘    └──────────┘    └─────────┘    └───────┘");
  console.log("                  (LLM node)    (code node,     (execute)");
  console.log("                               ALWAYS runs)");
  console.log();
  console.log("  The validation node is deterministic code — it ALWAYS executes.");
  console.log("  If validation fails, the graph routes to an error node, not tools.\n");

  // Let's demonstrate with a real StateGraph that enforces validation.
  // This is the kind of flow that DeepAgents CANNOT express.
  console.log("--- Live demo: StateGraph with mandatory validation ---\n");

  const { StateGraph, MessagesAnnotation, START, END } = await import("@langchain/langgraph");
  const { ToolNode } = await import("@langchain/langgraph/prebuilt");

  // A booking tool that should NEVER be called without validation
  const bookFlightTool = tool(
    async ({ from, to, validated }) => {
      if (!validated) return "ERROR: Booking attempted without validation!";
      return `Flight booked: ${from} → ${to}, confirmation #FLT-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    },
    {
      name: "book_flight",
      description: "Book a flight between two cities. Call this when the user wants to book a flight.",
      schema: z.object({
        from: z.string().describe("Departure city"),
        to: z.string().describe("Destination city"),
        // The LLM sets this to false; the validation node overrides it to true.
        // This demonstrates that deterministic code can modify tool call args.
        validated: z.boolean().default(false).describe("Validation status"),
      }),
    },
  );

  const graphTools = [bookFlightTool];
  const boundModel = model.bindTools(graphTools);

  // Node: call the LLM
  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await boundModel.invoke(state.messages);
    return { messages: [response] };
  }

  // Node: mandatory validation — ALWAYS runs before tool execution.
  // This is deterministic code, not an LLM decision.
  function validateBooking(state: typeof MessagesAnnotation.State) {
    const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
    if (!lastMsg.tool_calls?.length) return { messages: [] };

    console.log("  [validate node] Checking tool calls...");
    for (const tc of lastMsg.tool_calls) {
      if (tc.name === "book_flight") {
        // Force validated=true — the graph guarantees this runs
        tc.args.validated = true;
        console.log(`  [validate node] ✓ book_flight validated (injected validated=true)`);
      }
    }
    return { messages: [] };
  }

  // Routing: agent → validate (if tool calls) or END (if done)
  function route(state: typeof MessagesAnnotation.State) {
    const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMsg.tool_calls?.length) return "validate";
    return END;
  }

  // The graph enforces: agent → validate → tools → agent
  // Validation ALWAYS happens — no way to skip it.
  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("validate", validateBooking)
    .addNode("tools", new ToolNode(graphTools))
    .addEdge(START, "agent")
    .addConditionalEdges("agent", route)
    .addEdge("validate", "tools")
    .addEdge("tools", "agent")
    .compile();

  const result = await graph.invoke({
    messages: [new HumanMessage("Book me a flight from Paris to Bali")],
  });

  const lastMsg = result.messages[result.messages.length - 1];
  console.log(`\n  [ai] ${lastMsg.content as string}\n`);
  console.log("  Conversation trace:");
  logConversation(result.messages);

  // Summary of trade-offs
  console.log("\n  ┌─────────────────────────────────────────────────────────────┐");
  console.log("  │ DeepAgents vs StateGraph — when to use what                │");
  console.log("  ├─────────────────────────────────────────────────────────────┤");
  console.log("  │ DeepAgents (ex08-09):                                      │");
  console.log("  │   ✓ Fast to build (one function call)                      │");
  console.log("  │   ✓ Skills, subagents, filesystem, summarization built-in  │");
  console.log("  │   ✗ Single agent loop — can't enforce execution order      │");
  console.log("  │   ✗ No conditional edges, no parallel branches             │");
  console.log("  │   ✗ Harder to debug (middleware layers)                    │");
  console.log("  ├─────────────────────────────────────────────────────────────┤");
  console.log("  │ StateGraph (ex06):                                         │");
  console.log("  │   ✓ Full control: nodes, edges, conditions, parallelism   │");
  console.log("  │   ✓ Deterministic flow (validation, approval, routing)    │");
  console.log("  │   ✓ Debuggable (each node is a function)                  │");
  console.log("  │   ✗ More code to write and maintain                       │");
  console.log("  │   ✗ No built-in skills, subagents, or summarization       │");
  console.log("  └─────────────────────────────────────────────────────────────┘\n");
}

// TODO(human): Create a third subagent in Part A: a "budget-expert" that estimates
// trip costs. Give it a tool `estimate_budget` that takes destination and duration.
// Then ask the main agent: "Plan a 10-day trip to Japan from Paris, with budget."
// Observe how the coordinator delegates to all three subagents.
// Bonus: add a custom middleware that counts how many subagent delegations happened.

const partFilter = process.argv[2]?.toUpperCase();

async function main() {
  if (!partFilter || partFilter === "A") await partA();
  if (!partFilter || partFilter === "B") await partB();
  if (!partFilter || partFilter === "C") await partC();
  if (!partFilter || partFilter === "D") await partD();
}

main();
