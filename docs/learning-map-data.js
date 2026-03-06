// ════════════════════════════════════════════════════════════
// DATA — Exercise nodes and layer metadata for the learning map
// ════════════════════════════════════════════════════════════

const EXERCISES = [
  {
    id: '01', title: 'Hello LLM', layer: 'lc', done: true,
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
        detail: 'Invisible to the user, visible to the model. Sets persona, rules, and constraints. Placed first in the messages array. In di-agent-ui, this is where skills inject their behavioral instructions.' },
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
    prereqs: [],
    shared: [
      { concept: 'stop_reason', targets: ['03', '04'] },
      { concept: 'messages', targets: ['02', '03', '04', '05', '06', '07', '08'] }
    ]
  },
  {
    id: '02', title: 'Structured Output', layer: 'lc', done: true,
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
    prereqs: ['01'],
    shared: [{ concept: 'Zod schemas', targets: ['03'] }]
  },
  {
    id: '03', title: 'Tools', layer: 'lc', done: true,
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
    prereqs: ['01', '02'],
    shared: [{ concept: 'tool loop', targets: ['04', '05'] }]
  },
  {
    id: '04', title: 'Streaming', layer: 'lc', done: true,
    concepts: 'streaming, chunks, for await',
    insights: [
      'Streaming changes <strong>when</strong>, not <strong>what</strong>. The same <code>AIMessage</code> arrives — just time-sliced into chunks.',
      'Tool call args arrive as <strong>JSON fragments</strong> across chunks. You can\'t parse mid-stream — accumulate the raw strings, parse once at the end.'
    ],
    apis: [
      { name: '.stream()',
        from: 'BaseChatModel',
        signature: 'model.stream(messages): AsyncIterable<AIMessageChunk>',
        detail: 'The streaming equivalent of <code>.invoke()</code>. Instead of waiting for the full response, you get an async iterator that yields <code>AIMessageChunk</code> objects as the model generates tokens. Each chunk has partial <code>.content</code>. Concatenate them for the full message. In di-agent-ui, this feeds into <code>parseLangChainStream()</code>.' },
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
    prereqs: ['01', '03'],
    shared: [{ concept: 'streaming', targets: ['10'] }]
  },
  {
    id: '05', title: 'createAgent', layer: 'lg', done: true,
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
        detail: 'Builds a LangGraph <code>StateGraph</code> with 2 nodes: "model_request" (calls the LLM) and "tools" (dispatches tool calls). A conditional edge loops back to "model_request" if the LLM returns <code>tool_calls</code>, or routes to END if it returns text. This replaces the entire manual loop from exercises 03/04. Previously <code>createReactAgent</code> from <code>@langchain/langgraph/prebuilt</code> (now deprecated). In di-agent-ui, <code>createDeepAgent()</code> wraps this with skills and store.' },
      { name: 'agent.invoke()',
        from: 'ReactAgent',
        signature: 'agent.invoke({ messages }): Promise<{ messages: BaseMessage[] }>',
        detail: 'Runs the graph to completion — it loops internally until the LLM stops requesting tools. Returns <code>{ messages }</code> containing the full conversation: <code>[HumanMessage, AIMessage(tool_calls), ToolMessage, ..., AIMessage(final)]</code>. Compare with exercise 03 where you built this array manually.' },
      { name: 'agent.stream()',
        from: 'ReactAgent',
        signature: 'agent.stream({ messages }, { streamMode })',
        detail: 'Streams through the entire agent loop. With <code>streamMode: "messages"</code>, yields <code>[message, metadata]</code> tuples — the same <code>AIMessageChunk</code>s as <code>model.stream()</code> in exercise 04, but across the full multi-turn conversation. This is the exact pattern used in di-agent-ui\'s <code>agent-invoker.ts</code>.' },
      { name: 'streamMode',
        from: 'ReactAgent',
        detail: 'Controls what the stream yields. <code>"messages"</code> = raw message chunks (for real-time UX, Part B). <code>"updates"</code> = graph state after each node execution — each chunk is <code>{ model_request: { messages } }</code> or <code>{ tools: { messages } }</code>, revealing the graph\'s step-by-step progression (Part D). <code>"values"</code> = full state snapshot after each step. Can be combined: <code>streamMode: ["updates", "messages"]</code>.' },
      { name: 'langgraph_node',
        from: 'StreamMetadata',
        detail: 'In <code>streamMode: "messages"</code>, each tuple includes <code>metadata.langgraph_node</code> telling you which graph node emitted the chunk ("model_request" or "tools"). Lets you distinguish LLM-generated content from tool execution results in the stream.' },
      { name: 'systemPrompt',
        from: 'createAgent options',
        detail: 'A string or <code>SystemMessage</code> injected at the start of every conversation. In di-agent-ui, this is the massive system prompt built from skills + context. Passed as a string, the agent wraps it in <code>SystemMessage</code> internally. Previously called <code>prompt</code> in the deprecated <code>createReactAgent</code> API.' }
    ],
    prereqs: ['03', '04'],
    shared: [{ concept: 'agent graph', targets: ['06', '09'] }]
  },
  {
    id: '06', title: 'StateGraph', layer: 'lg', done: false,
    concepts: 'state graph, nodes, edges',
    apis: [], prereqs: ['05'], shared: []
  },
  {
    id: '07', title: 'Checkpointing', layer: 'lg', done: false,
    concepts: 'memory, persistence, replay',
    apis: [], prereqs: ['06'], shared: []
  },
  {
    id: '08', title: 'Human-in-the-loop', layer: 'lg', done: false,
    concepts: 'interrupts, approval, review',
    apis: [], prereqs: ['07'], shared: []
  },
  {
    id: '09', title: 'DeepAgents', layer: 'da', done: false,
    concepts: 'skills, deep agent, store',
    apis: [], prereqs: ['05'], shared: []
  },
  {
    id: '10', title: 'Vercel AI SDK', layer: 'da', done: false,
    concepts: 'useChat, streaming UI',
    apis: [], prereqs: ['04', '05'], shared: []
  }
];

const LAYER_META = {
  lc: {
    label: 'LangChain',
    className: 'layer--lc',
    glowColor: 'var(--lc-glow)',
    lineColor: 'var(--lc-line)',
    tagline: 'SDK for LLM interaction — models, messages, tools',
    tooltip: '<strong>LangChain</strong> is the foundational SDK. It provides a unified interface to call any LLM (<code>ChatAnthropic</code>, <code>ChatOpenAI</code>…), structure inputs/outputs with schemas, and define tools. Think of it as the <strong>building blocks</strong>: you write each step yourself.'
  },
  lg: {
    label: 'LangGraph',
    className: 'layer--lg',
    glowColor: 'var(--lg-glow)',
    lineColor: 'var(--lg-line)',
    tagline: 'Orchestration framework — graphs, state, agent loops',
    tooltip: '<strong>LangGraph</strong> sits on top of LangChain. It orchestrates multi-step workflows as <strong>state graphs</strong> with nodes, edges, and conditions. <code>createAgent</code> is a pre-built 2-node graph that automates the tool loop. You gain control over flow, memory, and human-in-the-loop.'
  },
  da: {
    label: 'DeepAgents / Vercel AI',
    className: 'layer--da',
    glowColor: 'var(--da-glow)',
    lineColor: 'var(--da-line)',
    tagline: 'High-level wrappers — opinionated agents & streaming UI',
    tooltip: '<strong>DeepAgents</strong> wraps LangGraph\'s <code>createAgent</code> with opinionated defaults (skills, store, system prompt) — less control, faster setup. <strong>Vercel AI SDK</strong> handles the frontend: <code>useChat()</code> for streaming UI, bridging the LangChain stream to React.'
  }
};
