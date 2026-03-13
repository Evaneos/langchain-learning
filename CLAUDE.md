# LangChain Learning — Project Instructions

## What is this

Personal learning repo to understand the LangChain/LangGraph/DeepAgents ecosystem through progressive exercises.

## Tech stack

- **Next.js** (TypeScript, App Router) — minimal setup for exercises needing UI
- **LangChain**: `@langchain/anthropic`, `@langchain/core`, `langchain`
- **LangGraph**: `@langchain/langgraph`, `@langchain/langgraph-checkpoint`
- **DeepAgents**: `deepagents` (used in exercise 09 for comparison)
- **Vercel AI SDK**: `ai`, `@ai-sdk/react` (used in exercise 10)
- **Zod** for schemas

## Project structure

- `docs/` — Theory notes, glossary, ecosystem overview
- `exercises/01-*` through `exercises/10-*` — Progressive hands-on exercises
  - Each exercise is self-contained with its own `index.ts` (runnable with `npx tsx`)
  - Each has a `README.md` explaining the concept
- `app/` — Next.js app for exercises needing a frontend (10+)

## Code conventions

- All code in English
- README.md files in French
- Each exercise should be runnable independently
- Use `dotenv` to load env vars from project root `.env` / `.env.local`


## Roadmap

See `docs/ROADMAP.md` for the exercise plan (Section 1: Core, Section 2: Advanced patterns).

## Git workflow

- **Always work on `main`** — no feature branches, no PRs. Direct commits only.
- See `exercises/CLAUDE.md` for exercise-specific conventions.

## Browser

- **Never open files/URLs automatically** — always ask the user to check themselves.

## Reference architecture

### Typical production agent
- **DeepAgents** wraps LangGraph's `createAgent()` with opinionated defaults (skills, store, system prompt)
- An agent factory creates `ChatAnthropic` + `createDeepAgent()` as a singleton
- Tools for domain-specific actions (CRUD on entities, suggestions, display)
- Skills for conversation phases (exploration, profiling, synthesis, closing)
- State backed by a persistent store (e.g. Redis) with TTL and deep-merge updates
- **Streaming**: LangChain stream → StreamEvent → Vercel AI SDK → frontend `useChat()`
- **Observability**: Langfuse + LangSmith

### Typical request flow
```
Frontend useChat() → POST /api/chat
  → orchestrator: executeChatRequest()
    → agent factory: createConfiguredAgent() — creates DeepAgent
    → invoker: invokeAgent()
      → convert messages to LangChain format
      → agent.stream({ messages }, { streamMode: 'messages', callbacks })
      → parse stream → StreamEvent[]
    → stream processor → writer → frontend
    → persist messages
```

### Why explore alternatives to DeepAgents
- DeepAgents is opinionated: it abstracts the agent loop, making custom hooks/flow control harder
- LangGraph provides `StateGraph`, custom nodes, conditional edges — full control over the agent loop
- Potential future need: custom pre/post-processing, multi-agent orchestration, conditional tool selection
