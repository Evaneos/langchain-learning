# The AI Agent Ecosystem — Glossary

## The layers

```
┌─────────────────────────────────────────────────┐
│  Your App (di-agent-ui)                         │
├─────────────────────────────────────────────────┤
│  DeepAgents          │  Vercel AI SDK (ai)      │
│  Opinionated agent   │  Streaming + React hooks  │
│  framework           │  useChat(), createUI...   │
├──────────────────────┤                           │
│  LangGraph           │                           │
│  Agent orchestration │                           │
│  (state machines)    │                           │
├──────────────────────┤                           │
│  LangChain           │                           │
│  LLM abstractions    │                           │
│  (models, tools,     │                           │
│   messages, callbacks)│                          │
├─────────────────────────────────────────────────┤
│  LLM Provider API (Anthropic, OpenAI, etc.)     │
└─────────────────────────────────────────────────┘

Observability (side-car):
  LangSmith — tracing & debugging platform by LangChain
  Langfuse  — open-source alternative
```

## What each thing is

### LangChain (`langchain`, `@langchain/core`)

**What**: A framework / toolkit for building applications with LLMs.

**Provides**:
- **Chat models** (`ChatAnthropic`, `ChatOpenAI`) — unified interface to call any LLM
- **Messages** (`HumanMessage`, `AIMessage`, `SystemMessage`, `ToolMessage`) — standardized message format
- **Tools** (`tool()` function) — define tools with Zod schemas that LLMs can call
- **Callbacks** (`on_llm_start`, `on_llm_end`, `on_tool_start`, `on_tool_end`) — hooks to intercept the LLM lifecycle
- **Output parsers** — parse LLM output into structured data
- **Chains** — compose multiple steps (mostly legacy, replaced by LangGraph)

**Analogy**: LangChain is like React — it gives you the building blocks, but doesn't tell you how to architect your app.

**In di-agent-ui**: Used for `ChatAnthropic` model, `tool()` definitions, message types, and callbacks (Langfuse).

### LangGraph (`@langchain/langgraph`)

**What**: A framework for building **stateful, multi-step agents** as **graphs** (state machines).

**Provides**:
- **StateGraph** — define nodes (functions) and edges (transitions) that form the agent's decision loop
- **Annotations** — typed state that flows through the graph
- **createAgent()** — pre-built ReAct agent (reason + act loop)
- **Checkpointing** — save/restore agent state between interactions
- **Human-in-the-loop** — pause the agent and wait for user input
- **Subgraphs** — compose multiple agents together

**Key concept**: An agent is a graph where:
- **Nodes** = functions (call LLM, run tool, update state)
- **Edges** = transitions (if tool call → run tool → loop back to LLM)
- **State** = data that flows through the graph (messages, custom fields)

**The ReAct loop**:
```
         ┌──────────────┐
         │   LLM Node   │ ← Decides what to do
         └──────┬───────┘
                │
         Has tool calls?
        ┌───────┴───────┐
        │ Yes           │ No
        ▼               ▼
  ┌──────────┐    ┌──────────┐
  │ Tool Node│    │   END    │
  └────┬─────┘    └──────────┘
       │
       └──── back to LLM
```

**Analogy**: LangGraph is like Next.js — it provides the architecture (routing = graph, middleware = nodes) on top of the building blocks.

**In di-agent-ui**: Not used directly — DeepAgents wraps it. But `createDeepAgent()` internally uses LangGraph's `createAgent()`.

### DeepAgents (`deepagents`)

**What**: An opinionated framework on top of LangGraph that simplifies agent creation.

**Provides**:
- `createDeepAgent()` — one function to create a full agent with: model, tools, system prompt, skills, store, backend
- **Skills** — markdown files that define agent capabilities (loaded from filesystem)
- **FilesystemBackend** — load config from disk
- **InMemoryStore** — shared key-value store for agent state

**What it hides**:
- The LangGraph state graph (you don't see nodes/edges)
- The ReAct loop implementation
- Checkpointing details
- Custom node/edge logic

**Tradeoff**: Quick to get started, but limited when you need:
- Custom agent loops (conditional branching, multi-agent)
- Pre/post-processing hooks on specific nodes
- Fine-grained control over the state graph

**In di-agent-ui**: Main agent framework. `agent-factory.ts` calls `createDeepAgent()` with model, tools, skills, system prompt.

### Vercel AI SDK (`ai`, `@ai-sdk/react`)

**What**: SDK for building AI-powered UIs, specifically streaming.

**Provides**:
- **Backend**: `createUIMessageStream()` — transform any stream into a UI-compatible format
- **Frontend**: `useChat()` — React hook that handles messages, loading state, streaming display
- **Transports**: `DefaultChatTransport` — HTTP streaming transport
- **Adapters**: `@ai-sdk/langchain` — bridge between LangChain and Vercel AI SDK

**Analogy**: It's the "plumbing" between your backend agent and your React UI. It doesn't care what agent framework you use.

**In di-agent-ui**: Frontend uses `useChat()`, backend uses `createUIMessageStream()`. The custom `parseLangChainStream()` converts LangChain's stream format into Vercel AI SDK's format.

### LangSmith

**What**: SaaS platform by LangChain for **tracing, debugging, and evaluating** LLM applications.

**Not a library** — it's a web service. You enable it with env vars (`LANGCHAIN_TRACING_V2=true`) and it auto-instruments all LangChain calls.

**Provides**: Trace visualization, token counts, latency, cost tracking, prompt playground, evaluations.

**In di-agent-ui**: Optional tracing, enabled via env vars. Feedback submission via API.

### Langfuse

**What**: Open-source alternative to LangSmith for LLM observability.

**Provides**: Same as LangSmith (tracing, cost, evals) but self-hostable. Integrates via LangChain callbacks.

**In di-agent-ui**: Primary observability tool. Uses `langfuse-langchain` callback handler.

## How they relate in di-agent-ui

```
User types message
  → useChat() [Vercel AI SDK]
  → POST /api/chat
  → ChatAnthropic [LangChain] inside createDeepAgent() [DeepAgents/LangGraph]
  → agent.stream() with Langfuse callbacks [LangChain callbacks]
  → parseLangChainStream() → createUIMessageStream() [Vercel AI SDK]
  → useChat() renders streaming response
```

## npm packages cheat sheet

| Package | What | Layer |
|---------|------|-------|
| `@langchain/core` | Messages, tools, callbacks, base classes | LangChain |
| `@langchain/anthropic` | `ChatAnthropic` model | LangChain |
| `langchain` | High-level utilities, tool() helper, createAgent | LangChain |
| `@langchain/langgraph` | StateGraph, nodes/edges | LangGraph |
| `@langchain/langgraph-checkpoint` | InMemoryStore, checkpointing | LangGraph |
| `deepagents` | createDeepAgent, FilesystemBackend, skills | DeepAgents |
| `ai` | createUIMessageStream, server utilities | Vercel AI SDK |
| `@ai-sdk/react` | useChat(), useCompletion() | Vercel AI SDK |
| `@ai-sdk/langchain` | Bridge LangChain ↔ Vercel AI SDK | Bridge |
| `langfuse-langchain` | Langfuse callback handler for LangChain | Observability |
| `langsmith` | LangSmith client | Observability |
