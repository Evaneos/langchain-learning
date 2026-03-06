# LangChain Learning — Project Instructions

## What is this

Personal learning repo to understand the LangChain/LangGraph/DeepAgents ecosystem through progressive exercises.
Reference project: `../evaneos/di-agent-ui/` (travel agent built with DeepAgents + LangChain + Claude).

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
  - Each has a `README.md` explaining the concept and mapping to di-agent-ui
- `app/` — Next.js app for exercises needing a frontend (10+)

## Code conventions

- All code in English
- README.md files in French
- Each exercise should be runnable independently
- Use `dotenv` to load env vars from project root `.env` / `.env.local`
- When referencing di-agent-ui, use relative paths from this repo root (`../evaneos/di-agent-ui/`)

## Git workflow for exercises

See `exercises/CLAUDE.md` for detailed conventions.

## Key context about di-agent-ui

### Architecture overview
- **DeepAgents** wraps LangGraph's `createReactAgent()` with opinionated defaults (skills, store, system prompt)
- **Agent factory** (`app/api/chat/agent/agent-factory.ts`): Singleton that creates `ChatAnthropic` + `createDeepAgent()`
- **8 tools**: get/update_traveler_project, get/update_traveler_profile, suggest_destinations, suggest_itineraries, suggest_agencies, display_relevant_suggestion
- **7 skills**: exploration-destinations, cadrage-projet, profilage-voyageur, projection-experiences, synthese-brief, conseil-arbitrage, cloture-conversation
- **State**: Redis-backed traveler project/profile with 30-day TTL, deep-merge updates
- **Streaming**: LangChain stream → parseLangChainStream() → StreamEvent → Vercel AI SDK → frontend useChat()
- **Model**: claude-haiku-4-5 (configurable in `config/model.ts`)
- **Observability**: Langfuse + LangSmith (not focus of this learning repo)

### Request flow in di-agent-ui
```
Frontend useChat() → POST /api/chat
  → chat-orchestrator.ts: executeChatRequest()
    → agent-factory.ts: createConfiguredAgent() — creates DeepAgent
    → agent-invoker.ts: invokeAgent()
      → message-converter.ts: convertToLangChainMessages()
      → agent.stream({ messages }, { streamMode: 'messages', callbacks })
      → parseLangChainStream() → StreamEvent[]
    → stream-handler.ts: StreamEventProcessor → writer → frontend
    → Redis: persist messages
```

### Why explore alternatives to DeepAgents
- DeepAgents is opinionated: it abstracts the agent loop, making custom hooks/flow control harder
- LangGraph provides `StateGraph`, custom nodes, conditional edges — full control over the agent loop
- Potential future need: custom pre/post-processing, multi-agent orchestration, conditional tool selection
