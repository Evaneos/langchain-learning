// ════════════════════════════════════════════════════════════
// DATA — Exercise nodes and layer metadata for the learning map
// ════════════════════════════════════════════════════════════

const EXERCISES = [
  {
    id: '01', section: 'trunk', title: 'Hello LLM', layer: 'lc', done: true,
    concepts: 'invoke, messages, metadata',
    insights: [
      '<strong>ChatAnthropic, ChatOpenAI, ChatGoogle</strong> — same interface. Learn <code>.invoke()</code> once, switch providers with one line.',
      '<code>stop_reason</code> is the model\'s signal to you: <strong>"end_turn"</strong> = I\'m done talking. <strong>"tool_use"</strong> = your turn to act. <strong>"max_tokens"</strong> = I got cut off mid-sentence.'
    ],
    apis: [
      { name: 'ChatAnthropic',
        from: '@langchain/anthropic',
        detail: 'The main entry point. Wraps the Anthropic API into LangChain\'s <code>BaseChatModel</code> interface. You configure <code>model</code>, <code>temperature</code>, <code>maxTokens</code> here. Once created, it exposes <code>.invoke()</code>, <code>.stream()</code>, <code>.bindTools()</code> — the same interface works for OpenAI, Gemini, etc.' },
      { name: 'HumanMessage',
        from: '@langchain/core/messages',
        detail: 'Represents what the user says. The model reads this as "the human is asking me X." In multi-turn conversations, you alternate <code>HumanMessage</code> and <code>AIMessage</code> in the messages array.' },
      { name: 'SystemMessage',
        from: '@langchain/core/messages',
        detail: 'Invisible to the user, visible to the model. Sets persona, rules, and constraints. Placed first in the messages array. In production agents, this is where skills inject their behavioral instructions.' },
      { name: 'AIMessage',
        from: '@langchain/core/messages',
        detail: 'What you get back from <code>.invoke()</code>. Beyond <code>.content</code> (the text), it carries <code>.response_metadata</code> (stop reason, model ID) and <code>.usage_metadata</code> (token counts). When tools are bound, it may also contain <code>.tool_calls</code> instead of text.' },
      { name: '.invoke()',
        from: 'BaseChatModel',
        signature: 'model.invoke(messages: BaseMessage[]): Promise<AIMessage>',
        detail: 'The synchronous call pattern — sends all messages, waits for the full response. Simple but blocking. For real-time UX, you\'ll switch to <code>.stream()</code> in exercise 04. Returns a single <code>AIMessage</code>.' },
      { name: 'response_metadata',
        from: 'AIMessage',
        detail: 'Provider-specific data attached to the response. For Anthropic: <code>stop_reason</code> ("end_turn", "tool_use", "max_tokens"), the model ID, and raw usage. <code>stop_reason</code> is key — it tells you WHY the model stopped, which changes meaning in exercises 03 and 04.' },
      { name: 'usage_metadata',
        from: 'AIMessage',
        detail: 'Normalized token counts: <code>input_tokens</code>, <code>output_tokens</code>, <code>total_tokens</code>. Useful for cost tracking. Unlike <code>response_metadata</code>, this format is consistent across all LangChain providers.' }
    ],
    code: `const model = new ChatAnthropic({ model: "claude-haiku-4-5" });

const response = await model.invoke([
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("What is LangChain in one sentence?"),
]);

console.log(response.content);
// response.response_metadata.stop_reason → "end_turn"
// response.usage_metadata → { input_tokens, output_tokens }`,
    prereqs: [],
    shared: [
      { concept: 'stop_reason', targets: ['03', '04'] },
      { concept: 'messages', targets: ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'] }
    ]
  },
  {
    id: '02', section: 'trunk', title: 'Structured Output', layer: 'lc', done: true,
    concepts: 'structured output, Zod schemas',
    insights: [
      'Structured output <strong>IS</strong> tool calling in disguise. <code>.withStructuredOutput()</code> converts your Zod schema into a hidden tool the model "calls" to produce JSON.',
      '<code>.describe()</code> is a prompt, not documentation. It\'s the single biggest lever you have on output quality — per field.'
    ],
    apis: [
      { name: '.withStructuredOutput()',
        from: 'BaseChatModel',
        signature: 'model.withStructuredOutput(schema: ZodObject): Runnable',
        detail: 'Returns a new model instance that forces JSON output matching your Zod schema. Under the hood, it uses Anthropic\'s tool_use mode — the schema becomes a "tool" and the model "calls" it with structured data. The result is a plain JS object, not an <code>AIMessage</code>.' },
      { name: 'z.object()',
        from: 'zod',
        signature: 'z.object({ field: z.string(), ... })',
        detail: 'Zod is the schema library LangChain uses everywhere. <code>z.object()</code> defines the shape of your expected output. Each field can be <code>z.string()</code>, <code>z.number()</code>, <code>z.enum()</code>, <code>z.array()</code>, etc. These same schemas are reused in exercise 03 to define tool arguments.' },
      { name: '.describe()',
        from: 'zod',
        signature: 'z.string().describe("explanation for the model")',
        detail: 'Critical for quality. The description string is sent to the model as the field\'s "purpose" — it\'s your main lever to guide what the model puts in each field. A vague <code>.describe("name")</code> gives worse results than <code>.describe("The traveler\'s full name as they\'d like to be addressed")</code>. Think of it as a mini-prompt per field.' }
    ],
    code: `const schema = z.object({
  name: z.string().describe("Destination name"),
  country: z.string().describe("Country"),
  best_season: z.string().describe("Best time to visit"),
  family_score: z.number().min(1).max(10)
    .describe("How family-friendly, 1-10"),
});

const structured = model.withStructuredOutput(schema);
const result = await structured.invoke("Suggest a destination.");
// result is a plain object — not an AIMessage
console.log(result.family_score); // number, not string`,
    prereqs: ['01'],
    shared: [{ concept: 'Zod schemas', targets: ['03'] }]
  },
  {
    id: '03', section: 'trunk', title: 'Tools', layer: 'lc', done: true,
    concepts: 'tools, tool calls, manual dispatch',
    insights: [
      'The model <strong>never executes anything</strong>. <code>tool_calls</code> is a polite request — YOU run the function, then report back with <code>ToolMessage</code>.',
      'The entire "agent loop" is just: invoke &rarr; check <code>tool_calls</code> &rarr; execute &rarr; <code>ToolMessage</code> &rarr; invoke again. <code>createAgent</code> just automates this cycle.'
    ],
    apis: [
      { name: 'tool()',
        from: '@langchain/core/tools',
        signature: 'tool(fn, { name, description, schema })',
        detail: 'Declares a function the model can request to call. The <code>schema</code> is a Zod object (same as exercise 02) that defines the arguments. The <code>description</code> tells the model WHEN to use this tool — like <code>.describe()</code>, writing a precise description is crucial. The function itself runs on YOUR server, not in the model.' },
      { name: '.bindTools()',
        from: 'BaseChatModel',
        signature: 'model.bindTools(tools: ToolDefinition[])',
        detail: 'Attaches tools to the model so it knows what\'s available. Returns a new model instance. After binding, calling <code>.invoke()</code> may return <code>tool_calls</code> instead of text — the model decides whether to use a tool or answer directly. You can bind, unbind, rebind tools at any time.' },
      { name: 'tool_calls',
        from: 'AIMessage',
        detail: 'Array on <code>AIMessage</code> when the model wants to call tools. Each entry has <code>name</code> (which tool), <code>args</code> (parsed from the schema), and <code>id</code> (to match the response). When this array exists, <code>response_metadata.stop_reason</code> switches from <code>"end_turn"</code> to <code>"tool_use"</code>.' },
      { name: 'ToolMessage',
        from: '@langchain/core/messages',
        signature: 'new ToolMessage({ content, tool_call_id })',
        detail: 'You execute the tool yourself, then wrap the result in a <code>ToolMessage</code> and send it back to the model. The model reads this result and decides what to do next — answer the user, or call another tool. This is the "manual dispatch" loop that <code>createAgent</code> automates in exercise 05.' },
      { name: 'tool_call_id',
        from: 'ToolMessage',
        detail: 'Links a <code>ToolMessage</code> response back to the specific <code>tool_call</code> that triggered it. Required by the API — without it, the model can\'t match which result corresponds to which tool request. Copy it from <code>toolCall.id</code>.' }
    ],
    code: `const getWeather = tool(fn, {
  name: "get_weather",
  description: "Get weather for a city",
  schema: z.object({ city: z.string(), month: z.string() }),
});

const modelWithTools = model.bindTools([getWeather]);
const response = await modelWithTools.invoke([msg]);
// stop_reason: "tool_use" — the model wants YOU to act

// Manual dispatch — find, execute, wrap each tool_call
for (const tc of response.tool_calls) {
  const tool = tools.find(t => t.name === tc.name);
  const result = await tool.invoke(tc.args);
  toolMessages.push(new ToolMessage({
    content: result,
    tool_call_id: tc.id,
  }));
}

// Re-invoke with tool results → final answer
const answer = await modelWithTools.invoke([
  msg, response, ...toolMessages,
]);`,
    prereqs: ['01', '02'],
    shared: [{ concept: 'tool loop', targets: ['04', '05'] }]
  },
  {
    id: '04', section: 'trunk', title: 'Streaming', layer: 'lc', done: true,
    concepts: 'streaming, chunks, for await',
    insights: [
      'Streaming changes <strong>when</strong>, not <strong>what</strong>. The same <code>AIMessage</code> arrives — just time-sliced into chunks.',
      'Tool call args arrive as <strong>JSON fragments</strong> across chunks. You can\'t parse mid-stream — accumulate the raw strings, parse once at the end.'
    ],
    apis: [
      { name: '.stream()',
        from: 'BaseChatModel',
        signature: 'model.stream(messages): AsyncIterable<AIMessageChunk>',
        detail: 'The streaming equivalent of <code>.invoke()</code>. Instead of waiting for the full response, you get an async iterator that yields <code>AIMessageChunk</code> objects as the model generates tokens. Each chunk has partial <code>.content</code>. Concatenate them for the full message. In a typical setup, this feeds into a stream parser that converts chunks into UI-friendly events.' },
      { name: 'AIMessageChunk',
        from: '@langchain/core/messages',
        detail: 'One piece of a streaming response. Has <code>.content</code> (partial text), <code>.tool_call_chunks</code> (partial tool calls), and <code>.response_metadata</code> (only populated on the final chunk). You can\'t just read <code>.content</code> — you need to accumulate chunks and handle tool call fragments separately.' },
      { name: 'tool_call_chunks',
        from: 'AIMessageChunk',
        detail: 'When streaming a tool call, the name and JSON args arrive in fragments across multiple chunks. Each <code>tool_call_chunk</code> has partial <code>name</code> and <code>args</code> (as raw string, not parsed). You concatenate the <code>args</code> strings across chunks, then <code>JSON.parse()</code> the result when the stream ends.' },
      { name: 'additional_kwargs',
        from: 'AIMessageChunk',
        detail: 'Raw provider-specific data on each chunk. For Anthropic, this is how you detect that a tool call is starting before the <code>tool_call_chunks</code> array is populated. Useful for building UIs that show "calling tool X..." while args are still streaming in.' },
      { name: 'for await...of',
        from: 'JavaScript',
        detail: 'The native JS pattern for consuming async iterables. <code>for await (const chunk of stream) { ... }</code> processes each chunk as it arrives. You can <code>break</code> out early to cancel the stream. This is what makes real-time UX possible — you update the UI inside the loop body.' }
    ],
    code: `const stream = await model.stream([msg]);

for await (const chunk of stream) {
  // Text chunks — write live
  process.stdout.write(chunk.content);

  // Tool call chunks — JSON args arrive as fragments
  if (chunk.tool_call_chunks?.length) {
    for (const tc of chunk.tool_call_chunks) {
      if (tc.name) console.log(\`Calling: \${tc.name}\`);
      if (tc.args) process.stdout.write(tc.args);
    }
  }
}

// Reconstruct full message from chunks
const full = chunks.reduce((acc, c) => acc.concat(c));`,
    prereqs: ['01', '03'],
    shared: [{ concept: 'streaming', targets: ['11', '13'] }]
  },
  {
    id: '05', section: 'trunk', title: 'createAgent', layer: 'lg', done: true,
    concepts: 'react agent, auto tool loop, streamMode',
    insights: [
      'An "agent" is not a new abstraction — it\'s the manual tool loop from exercise 03, automated as a <strong>2-node graph</strong> with one conditional edge.',
      '<code>streamMode: "messages"</code> gives you the same <code>AIMessageChunk</code>s from exercise 04, but the graph handles re-invocation between tool calls. You stream the whole multi-turn conversation, not just one response.',
      '<code>streamMode: "updates"</code> is like an X-ray of the graph: each yield shows which node just ran and what it produced. You literally see <code>model_request → tools → model_request → END</code> — the conditional edge logic made visible.'
    ],
    apis: [
      { name: 'createAgent',
        from: 'langchain',
        signature: 'createAgent({ model, tools, systemPrompt? })',
        detail: 'Builds a LangGraph <code>StateGraph</code> with 2 nodes: "model_request" (calls the LLM) and "tools" (dispatches tool calls). A conditional edge loops back to "model_request" if the LLM returns <code>tool_calls</code>, or routes to END if it returns text. This replaces the entire manual loop from exercises 03/04. Previously <code>createReactAgent</code> from <code>@langchain/langgraph/prebuilt</code> (now deprecated). Higher-level wrappers like <code>createDeepAgent()</code> build on this with skills and store.' },
      { name: 'agent.invoke()',
        from: 'ReactAgent',
        signature: 'agent.invoke({ messages }): Promise<{ messages: BaseMessage[] }>',
        detail: 'Runs the graph to completion — it loops internally until the LLM stops requesting tools. Returns <code>{ messages }</code> containing the full conversation: <code>[HumanMessage, AIMessage(tool_calls), ToolMessage, ..., AIMessage(final)]</code>. Compare with exercise 03 where you built this array manually.' },
      { name: 'agent.stream()',
        from: 'ReactAgent',
        signature: 'agent.stream({ messages }, { streamMode })',
        detail: 'Streams through the entire agent loop. With <code>streamMode: "messages"</code>, yields <code>[message, metadata]</code> tuples — the same <code>AIMessageChunk</code>s as <code>model.stream()</code> in exercise 04, but across the full multi-turn conversation. This is the standard pattern for streaming agent responses to a frontend.' },
      { name: 'streamMode',
        from: 'ReactAgent',
        detail: 'Controls what the stream yields. <code>"messages"</code> = raw message chunks (for real-time UX, Part B). <code>"updates"</code> = graph state after each node execution — each chunk is <code>{ model_request: { messages } }</code> or <code>{ tools: { messages } }</code>, revealing the graph\'s step-by-step progression (Part D). <code>"values"</code> = full state snapshot after each step. Can be combined: <code>streamMode: ["updates", "messages"]</code>.' },
      { name: 'langgraph_node',
        from: 'StreamMetadata',
        detail: 'In <code>streamMode: "messages"</code>, each tuple includes <code>metadata.langgraph_node</code> telling you which graph node emitted the chunk ("model_request" or "tools"). Lets you distinguish LLM-generated content from tool execution results in the stream.' },
      { name: 'systemPrompt',
        from: 'createAgent options',
        detail: 'A string or <code>SystemMessage</code> injected at the start of every conversation. In production agents, this is typically a large system prompt assembled from skills + context. Passed as a string, the agent wraps it in <code>SystemMessage</code> internally. Previously called <code>prompt</code> in the deprecated <code>createReactAgent</code> API.' }
    ],
    code: `const agent = createAgent({ model, tools, systemPrompt });

// .invoke() — runs the full ReAct loop internally
const result = await agent.invoke({ messages: [msg] });
// result.messages = [Human, AI(tool_calls), Tool, AI(final)]

// .stream() — real-time chunks through the agent loop
const stream = await agent.stream(
  { messages: [msg] },
  { streamMode: "messages" },
);
for await (const [message, metadata] of stream) {
  // metadata.langgraph_node → "model_request" | "tools"
  process.stdout.write(message.content);
}`,
    prereqs: ['03', '04'],
    shared: [{ concept: 'agent graph', targets: ['06', '08'] }]
  },
  {
    id: '06', section: 'trunk', title: 'StateGraph', layer: 'lg', done: true,
    concepts: 'state graph, nodes, edges, custom state, pre/post-processing',
    insights: [
      '<code>createAgent</code> is just <strong>5 lines of StateGraph</strong>: 2 nodes, 3 edges, 1 conditional. Once you see it, "agent" stops being magic.',
      'A node is just <code>async (state) => partialState</code>. No class, no interface — just a function that reads state and returns what changed. The graph handles the rest.',
      'The <strong>append reducer</strong> on <code>messages</code> is why nodes return <code>{ messages: [newMsg] }</code> not the full array. The graph merges, you don\'t.',
      'The order of <code>.addEdge()</code> calls <strong>doesn\'t matter</strong> — you\'re declaring a routing table, not a sequence. You could shuffle every edge declaration and the graph would be identical. Execution order comes from the topology, not the code order.'
    ],
    apis: [
      { name: 'StateGraph',
        from: '@langchain/langgraph',
        signature: 'new StateGraph(annotation)',
        detail: 'The core primitive. Takes a state annotation (shape + reducers) and lets you build a graph with <code>.addNode()</code>, <code>.addEdge()</code>, <code>.addConditionalEdges()</code>. After <code>.compile()</code>, you get a runnable with the same <code>.invoke()</code> and <code>.stream()</code> as <code>createAgent</code>. In exercise 05, <code>createAgent</code> built one for us. Here we build it ourselves.' },
      { name: 'MessagesAnnotation',
        from: '@langchain/langgraph',
        detail: 'A prebuilt state annotation with a single field: <code>messages: BaseMessage[]</code>. Its reducer <strong>appends</strong> new messages instead of replacing — that\'s why each node returns <code>{ messages: [response] }</code> and the full conversation accumulates automatically. This is what <code>createAgent</code> uses internally.' },
      { name: 'Annotation.Root()',
        from: '@langchain/langgraph',
        signature: 'Annotation.Root({ ...MessagesAnnotation.spec, myField: Annotation<T> })',
        detail: 'Extends the state with custom fields beyond <code>messages</code>. Spread <code>MessagesAnnotation.spec</code> to keep the messages reducer, then add your own fields. In Part B, we add <code>travelContext</code> (input) and <code>systemPrompt</code> (built by the prepare node). In production agents, this is where you\'d store user profile, skill context, etc.' },
      { name: 'addNode()',
        from: 'StateGraph',
        signature: '.addNode(name, fn | ToolNode)',
        detail: 'Registers a node in the graph. The function receives the full state and returns a partial state update (only the fields that changed). Can also be a <code>ToolNode</code> instance for automatic tool dispatch. Nodes are the "steps" of your workflow.' },
      { name: 'addEdge()',
        from: 'StateGraph',
        signature: '.addEdge(from, to)',
        detail: 'Unconditional edge: always go from node A to node B. <code>.addEdge(START, "agent")</code> means the graph always begins at the agent. <code>.addEdge("tools", "agent")</code> means after tools execute, always go back to the agent.' },
      { name: 'addConditionalEdges()',
        from: 'StateGraph',
        signature: '.addConditionalEdges(from, routingFn)',
        detail: 'The branching point. The routing function receives the state and returns the name of the next node (or <code>END</code>). This is the ReAct loop\'s heart: check <code>lastMessage.tool_calls</code> → "tools" or <code>END</code>. You can route to any node, enabling complex flows impossible with <code>createAgent</code>.' },
      { name: 'START / END',
        from: '@langchain/langgraph',
        detail: 'Special constants for the graph\'s entry and exit points. <code>START</code> is where <code>.invoke()</code> begins. <code>END</code> is where the graph stops and returns the final state. A routing function returning <code>END</code> terminates the loop.' },
      { name: 'ToolNode',
        from: '@langchain/langgraph/prebuilt',
        signature: 'new ToolNode(tools)',
        detail: 'The same automatic tool dispatcher that <code>createAgent</code> uses. Reads <code>tool_calls</code> from the last <code>AIMessage</code>, invokes the matching tools, and returns <code>ToolMessage</code>s. You don\'t need to write the dispatch loop from exercise 03 — <code>ToolNode</code> does it.' },
      { name: '.compile()',
        from: 'StateGraph',
        detail: 'Freezes the graph and returns a <code>CompiledGraph</code> — a runnable with <code>.invoke()</code>, <code>.stream()</code>, same interface as what <code>createAgent</code> returns. After compile, you can\'t add more nodes or edges.' }
    ],
    code: `const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", async (state) => {
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] }; // append reducer
  })
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", (state) => {
    const last = state.messages.at(-1);
    return last.tool_calls?.length ? "tools" : END;
  })
  .addEdge("tools", "agent")
  .compile();

// Same .invoke() / .stream() as createAgent
const result = await graph.invoke({ messages: [msg] });`,
    prereqs: ['05'],
    shared: [
      { concept: 'custom state', targets: ['07', '10'] },
      { concept: 'graph nodes', targets: ['07', '10'] }
    ]
  },
  {
    id: '07', section: 'trunk', title: 'Checkpointing', layer: 'lg', done: true,
    concepts: 'memory, persistence, thread isolation, state inspection',
    insights: [
      '<code>.compile({ checkpointer })</code> is the <strong>only change</strong> vs exercise 06. Same graph, but now every node execution saves a snapshot. Memory is opt-in, not architectural.',
      'You only send the <strong>new message</strong> — the checkpointer reloads the full conversation from the thread. No more manually passing the entire message history.',
      '<code>getStateHistory()</code> returns one snapshot <strong>per node execution</strong>. You can see exactly what the agent saw at each step — the ultimate debugging tool.'
    ],
    apis: [
      { name: 'MemorySaver',
        from: '@langchain/langgraph',
        detail: 'An in-memory checkpointer that saves graph state after every node execution. Pass it to <code>.compile({ checkpointer })</code> to enable persistence. In production, you\'d swap this for a database-backed checkpointer (PostgreSQL, Redis) — same interface, different storage. <code>MemorySaver</code> gives you persistence with zero configuration.' },
      { name: 'thread_id',
        from: 'configurable',
        signature: '{ configurable: { thread_id: "..." } }',
        detail: 'Identifies a conversation. Same <code>thread_id</code> = same memory. Different <code>thread_id</code> = isolated conversations. Passed as the second argument to <code>.invoke()</code> or <code>.stream()</code>. In production, this is typically mapped to a session or chat ID.' },
      { name: 'getState()',
        from: 'CompiledGraph',
        signature: 'graph.getState(config): Promise<StateSnapshot>',
        detail: 'Returns the latest checkpoint for a thread. The snapshot contains <code>.values</code> (the full state including messages), <code>.next</code> (which nodes would execute next — empty if finished), and <code>.config</code> (with the <code>checkpoint_id</code>). Use it to inspect where a conversation stands.' },
      { name: 'getStateHistory()',
        from: 'CompiledGraph',
        signature: 'graph.getStateHistory(config): AsyncIterable<StateSnapshot>',
        detail: 'Returns ALL checkpoints for a thread in reverse chronological order. One snapshot per node execution — for a tool-using conversation: input → agent (tool_calls) → tools → agent (final). Use it for debugging, time travel, and forking. Exercise 10 (Human-in-the-loop) builds on this.' }
    ],
    code: `const checkpointer = new MemorySaver();
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile({ checkpointer }); // ← the only change

// thread_id = conversation session
const config = { configurable: { thread_id: "trip-1" } };
await graph.invoke({ messages: [msg1] }, config);
// Turn 2: only send the NEW message — checkpointer loads history
await graph.invoke({ messages: [msg2] }, config);`,
    prereqs: ['06'],
    shared: [
      { concept: 'checkpointer', targets: ['08'] },
      { concept: 'thread_id', targets: ['08'] }
    ]
  },
  {
    id: '08', section: 'trunk', title: 'DeepAgents', layer: 'da', done: true,
    concepts: 'createDeepAgent, skills, middleware, FilesystemBackend, progressive disclosure',
    insights: [
      'DeepAgents is <strong>middleware on top of ReactAgent</strong>. Every feature — skills, filesystem tools, subagents, summarization — is a pluggable middleware layer, not a new architecture.',
      'Skills are <strong>natural language middleware</strong>: a SKILL.md file changes agent behavior without touching code. Same agent, different skill → different consultation flow.',
      'Skills use <strong>progressive disclosure</strong>: only name + description live in the system prompt. When the model decides a skill is relevant, it calls <code>read_file</code> to load the full SKILL.md — you can see this in the conversation trace.',
      'The convenience/control trade-off: <code>createDeepAgent</code> gives you 80% instantly, but <strong>custom nodes</strong> (StateGraph, ex06) are the escape hatch when the single-loop model doesn\'t fit.'
    ],
    apis: [
      { name: 'createDeepAgent()',
        from: 'deepagents',
        signature: 'createDeepAgent({ model, tools, skills?, backend?, checkpointer?, store?, name? })',
        detail: 'The one-function agent factory. Under the hood, it creates a <code>ReactAgent</code> (same base as <code>createReactAgent</code> from exercise 05) and wraps it with default middleware: filesystem tools (<code>ls</code>, <code>read_file</code>, <code>write_file</code>, <code>edit_file</code>, <code>glob</code>, <code>grep</code>), subagent delegation (<code>task</code>), skills loading, and conversation summarization. In a typical setup, you call this with your domain tools, skills, and a shared store.' },
      { name: 'FilesystemBackend',
        from: 'deepagents',
        signature: 'new FilesystemBackend({ rootDir?, virtualMode?, maxFileSizeMb? })',
        detail: 'Backend that reads/writes files from disk. <code>virtualMode: true</code> makes <code>/</code> resolve to <code>rootDir</code> instead of the real filesystem root — required because the filesystem system prompt tells the model "all paths must start with /". Without it, <code>read_file("/skills/...")</code> looks at the real <code>/skills/</code>. Typically, <code>rootDir</code> points to a config directory where skills and knowledge files live.' },
      { name: 'skills',
        from: 'createDeepAgent options',
        detail: 'Array of paths (relative to the backend\'s <code>rootDir</code>) where SKILL.md files are stored. <code>SkillsMiddleware</code> loads them and injects metadata into the system prompt. <strong>Progressive disclosure</strong>: only names/descriptions appear in the prompt. When the model recognizes a matching context, it calls <code>read_file</code> to load the full SKILL.md, then follows the procedure inside.' },
      { name: 'SKILL.md',
        from: 'deepagents convention',
        detail: 'A markdown file that defines agent behavior for a specific scenario. Structure: YAML frontmatter with <code>name</code> (lowercase, hyphens) and <code>description</code>, then markdown sections for "when to activate", "procedure", and "rules". In production agents, a set of skills can define an entire consultation flow. Skills are configuration, not code.' },
      { name: 'skillsMetadata',
        from: 'agent state (SkillsMiddleware)',
        detail: 'Array stored in the agent\'s state after first invoke. Each entry has <code>name</code>, <code>description</code>, <code>path</code>, <code>allowedTools</code>, <code>metadata</code>. Shows what skills are <strong>loaded</strong> — not what\'s "active" (the model decides that based on context). Not in the public type — access via <code>(result as any).skillsMetadata</code>.' },
      { name: 'checkpointer',
        from: 'createDeepAgent options',
        detail: 'Same concept as exercise 07\'s <code>MemorySaver</code>, passed directly to <code>createDeepAgent</code>. Enables conversation memory via <code>thread_id</code>. Pass a <code>MemorySaver</code> instance (or any <code>BaseCheckpointSaver</code>). Combined with the agent\'s built-in state management, you get the same multi-turn memory as exercise 07 without manual graph setup.' },
      { name: 'middleware',
        from: 'deepagents architecture',
        detail: 'DeepAgents\' extension mechanism. Each middleware adds tools and/or modifies the system prompt. Defaults: <code>FilesystemMiddleware</code> (file tools), <code>SubAgentMiddleware</code> (<code>task</code> tool), <code>SkillsMiddleware</code> (SKILL.md loading), <code>SummarizationMiddleware</code> (context management). You can add custom middleware via the <code>middleware</code> parameter.' }
    ],
    code: `const backend = new FilesystemBackend({
  rootDir: exerciseDir, virtualMode: true,
});
const agent = createDeepAgent({
  model, tools,
  backend,
  skills: ["skills/"],  // loads skills/*/SKILL.md metadata
  name: "travel-agent",
});

// "Capital of Japan?" → plain answer, no skill influence
// "Plan a trip to Bali" → read_file(SKILL.md) → procedure
//   Trace: read_file → get_weather x2 → search_flights
//   Output: === TRAVEL CARD === (strict format from skill)
const result = await agent.invoke({ messages: [msg] });`,
    prereqs: ['05', '07'],
    shared: [
      { concept: 'agent limitations', targets: ['09'] }
    ]
  },
  {
    id: '09', section: 'branches', title: 'Subagents, Store & Limites', layer: 'da', done: false,
    concepts: 'subagents, task tool, store, backends, custom middleware, abstraction limits',
    apis: [], prereqs: ['08'], shared: [
      { concept: 'abstraction trade-off', targets: ['10'] }
    ]
  },
  {
    id: '10', section: 'branches', title: 'Hooks & Callbacks', layer: 'lg', done: false,
    concepts: 'BaseCallbackHandler, lifecycle events, RunnableConfig callbacks, stream events',
    apis: [], prereqs: ['07', '09'], shared: []
  },
  {
    id: '11', section: 'branches', title: 'Stream Pipeline', layer: 'lg', done: false,
    concepts: 'parseLangChainStream, StreamEvent, StreamEventProcessor, progressive JSON accumulation',
    apis: [], prereqs: ['05'], shared: [
      { concept: 'stream events', targets: ['13'] }
    ]
  },
  {
    id: '12', section: 'branches', title: 'Message Conversion', layer: 'lc', done: false,
    concepts: 'UIMessage ↔ BaseMessage, segmentation, tool-result boundaries, backward compat',
    apis: [], prereqs: ['03'], shared: [
      { concept: 'message formats', targets: ['13'] }
    ]
  },
  {
    id: '13', section: 'branches', title: 'Vercel AI SDK', layer: 'front', done: false,
    concepts: 'useChat, streaming UI, pont LangChain → React, end-to-end',
    apis: [], prereqs: ['11', '12'], shared: []
  }
];

// ════════════════════════════════════════════════════════════
// MUTATIONS — Code morphing data for connections
// Each mutation shows how code evolves between two exercises.
// Shiki Magic Move auto-diffs the before/after code blocks.
// ════════════════════════════════════════════════════════════
const MUTATIONS = [
  {
    from: '03', to: '05',
    blocks: [
      {
        legend: '<code>bindTools()</code> + manual dispatch loop → <code>createAgent()</code> automates the entire ReAct cycle.',
        before: `const modelWithTools = model.bindTools(tools);
// Ask the LLM — it returns tool_calls, not text
const response = await modelWithTools.invoke([msg]);

// Manual dispatch: find each tool, execute, wrap result
const toolMessages = [];
for (const tc of response.tool_calls) {
  const fn = tools.find(t => t.name === tc.name);
  const out = await fn.invoke(tc.args);
  toolMessages.push(new ToolMessage({
    content: out,
    tool_call_id: tc.id,
  }));
}

// Re-invoke with full conversation history
const answer = await modelWithTools.invoke([
  msg, response, ...toolMessages,
]);`,
        after: `const agent = createAgent({ model, tools });
// Agent loops internally until end_turn
const result = await agent.invoke({ messages: [msg] });
// result.messages = full history, including ToolMessages`,
      },
    ],
  },
  {
    from: '01', to: '03',
    blocks: [
      {
        legend: 'Same <code>.invoke()</code> call — but <code>bindTools()</code> augments the model, and the response shifts from text to <code>tool_calls</code>.',
        before: `const response = await model.invoke([msg]);
// stop_reason: "end_turn" — the model is done talking
console.log(response.content);`,
        after: `const modelWithTools = model.bindTools(tools);
const response = await modelWithTools.invoke([msg]);
// stop_reason: "tool_use" — the model wants YOU to act
console.log(response.tool_calls);`,
      },
    ],
  },
  {
    from: '01', to: '04',
    blocks: [
      {
        legend: '<code>.invoke()</code> → <code>.stream()</code> — same question, but the answer arrives token by token via <code>for await</code>.',
        before: `// Wait for the full response, then read it
const response = await model.invoke([msg]);
console.log(response.content);`,
        after: `// Process tokens as they arrive
const stream = await model.stream([msg]);
for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}`,
      },
    ],
  },
  {
    from: '05', to: '06',
    blocks: [
      {
        legend: '<code>createAgent()</code> is just 5 lines of <code>StateGraph</code>: 2 nodes, 3 edges, 1 conditional. Open the black box.',
        before: `const agent = createAgent({ model, tools });
// Black box: 2 nodes, 3 edges, 1 conditional
const result = await agent.invoke({ messages: [msg] });`,
        after: `const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile();
// Same interface — .invoke() works identically
const result = await graph.invoke({ messages: [msg] });`,
      },
    ],
  },
  {
    from: '06', to: '07',
    blocks: [
      {
        legend: 'Same graph, one new argument: <code>.compile({ checkpointer })</code> turns a stateless graph into a persistent conversation.',
        before: `const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile(); // stateless — no memory between calls

await graph.invoke({ messages: [msg1] });
// Must re-send ALL messages for context
await graph.invoke({ messages: [msg1, ...history, msg2] });`,
        after: `const checkpointer = new MemorySaver();
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile({ checkpointer }); // persistent memory

const config = { configurable: { thread_id: "trip-1" } };
await graph.invoke({ messages: [msg1] }, config);
// Only send the NEW message — checkpointer loads history
await graph.invoke({ messages: [msg2] }, config);`,
      },
    ],
  },
  {
    from: '05', to: '08',
    blocks: [
      {
        legend: '<code>createAgent()</code> → <code>createDeepAgent()</code> — same <code>.invoke()</code>, but with skills, filesystem tools, and subagents baked in.',
        before: `const agent = createAgent({ model, tools });

// Agent loops internally until end_turn
const result = await agent.invoke({ messages: [msg] });
// result.messages = full history, including ToolMessages`,
        after: `const agent = createDeepAgent({
  model, tools,
  checkpointer: new MemorySaver(), // ex07 built-in
  backend: new FilesystemBackend({ rootDir }),
  skills: ["skills/"],  // SKILL.md → system prompt
  name: "travel-agent",
});
// Same .invoke() — but behavior guided by skills
const result = await agent.invoke({ messages: [msg] });`,
      },
    ],
  },
];

const LAYER_META = {
  lc: {
    label: 'LangChain',
    className: 'layer--lc',
    glowColor: 'var(--lc-glow)',
    lineColor: 'var(--lc-line)',
    tagline: 'Agent framework — SDK for LLM interaction',
    buildsOn: 'The building blocks<br>models, messages, tools, callbacks',
    tooltip: '<strong>LangChain</strong> is the <strong>agent framework</strong> — the SDK for LLM interaction. It provides a unified interface to call any LLM (<code>ChatAnthropic</code>, <code>ChatOpenAI</code>…), structure inputs/outputs with schemas, and define tools. Think of it as the <strong>building blocks</strong>: you write each step yourself.'
  },
  lg: {
    label: 'LangGraph',
    className: 'layer--lg',
    glowColor: 'var(--lg-glow)',
    lineColor: 'var(--lg-line)',
    tagline: 'Agent runtime — orchestration framework',
    buildsOn: 'Built on LangChain SDK<br>adds graphs, state, agent loops',
    tooltip: '<strong>LangGraph</strong> is the <strong>agent runtime</strong> — an orchestration framework. It sits on top of LangChain and orchestrates multi-step workflows as <strong>state graphs</strong> with nodes, edges, and conditions. <code>createAgent</code> is a pre-built 2-node graph that automates the tool loop. You gain control over flow, memory, and human-in-the-loop.'
  },
  da: {
    label: 'DeepAgents',
    className: 'layer--da',
    glowColor: 'var(--da-glow)',
    lineColor: 'var(--da-line)',
    tagline: 'Agent harness — opinionated wrapper',
    buildsOn: 'Built on LangGraph runtime<br>adds skills, store, middleware',
    tooltip: '<strong>DeepAgents</strong> is the <strong>agent harness</strong> — an opinionated wrapper. It wraps LangGraph\'s <code>createAgent</code> with opinionated defaults (skills, store, system prompt) — less control, faster setup. The convenience/control trade-off: 80% instantly, but custom nodes are the escape hatch.'
  },
  front: {
    label: 'Vercel AI SDK',
    className: 'layer--front',
    glowColor: 'var(--front-glow)',
    lineColor: 'var(--front-line)',
    tagline: 'Frontend integration — streaming UI, React bridge',
    buildsOn: 'Independent<br>connects to any LangChain stream',
    tooltip: '<strong>Vercel AI SDK</strong> handles the frontend: <code>useChat()</code> for streaming UI, bridging the LangChain stream to React. Independent from DeepAgents — it connects to any LangChain/LangGraph stream.'
  }
};
