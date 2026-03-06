# Plan de Learning — LangChain / LangGraph / DeepAgents

## Résumé

Repo de learning personnel (Next.js minimal + scripts TS) pour comprendre de zéro l'écosystème LangChain/LangGraph/DeepAgents, en partant de petits exercices de code qui s'empilent progressivement jusqu'à reconstruire un mini-agent de voyage similaire à `di-agent-ui`, d'abord avec DeepAgents puis sans.

## Contexte

- L'équipe travaille sur `../evaneos/di-agent-ui/`, un agent conversationnel de voyage construit avec **DeepAgents** (v1.8.0), **LangChain** (`@langchain/anthropic`, `@langchain/core`), **Claude Haiku 4.5**, et le **Vercel AI SDK** pour le streaming
- DeepAgents est une couche "opinionated" au-dessus de LangChain/LangGraph qui abstrait la création d'agents (system prompt, skills, tools, store) via `createDeepAgent()`
- À terme, l'équipe pourrait avoir besoin de plus de contrôle (custom agent loop, hooks) que ce que DeepAgents expose
- Clés API : copiées depuis `di-agent-ui/.env` et `.env.local`

## Scope

**Inclus :**
- Overview théorique de l'écosystème → `docs/00-ecosystem.md`
- 10 exercices bottom-up : LLM call → tools → agent → state → streaming → mini-app Next.js
- Mapping de chaque concept sur le code de `di-agent-ui`
- Reconstruction d'un mini-agent sans DeepAgents (LangGraph pur)
- Comparaison DeepAgents vs vanilla

**Exclu :**
- Observabilité (Langfuse/LangSmith) — pas le focus
- UI élaborée — frontend minimal
- Déploiement — tout en local

## Exercices

| # | Exercice | Concept | Référence di-agent-ui |
|---|----------|---------|----------------------|
| 01 | Hello LLM | `ChatAnthropic` appel basique | `agent-factory.ts:65-68` |
| 02 | Structured Output | Zod schema + réponse typée | `traveler-project.schema.ts` |
| 03 | Tools | `langchain.tool()` + tool calling | `tools/*/index.ts` (8 tools) |
| 04 | Callbacks | `on_llm_start`, `on_tool_end`, etc. | `tracing.ts` (Langfuse handler) |
| 05 | ReAct Agent | `createReactAgent()` de LangGraph | Ce que `createDeepAgent()` fait |
| 06 | Custom State | `Annotation` + `StateGraph` + mémoire | Projet voyageur, `InMemoryStore` |
| 07 | Streaming | Stream token par token | `agent.stream()` + `parseLangChainStream()` |
| 08 | Mini Travel Agent | Tools + state + streaming combinés | Version simplifiée de di-agent-ui |
| 09 | DeepAgents vs Vanilla | Même agent avec/sans DeepAgents | Valeur ajoutée / limites |
| 10 | Next.js Integration | API route + `useChat()` + streaming frontend | Flow complet de di-agent-ui |

## TODOs

- [ ] Setup : init Next.js, installer deps, copier env vars
- [ ] Exercice 01 : Hello LLM
- [ ] Exercice 02 : Structured Output
- [ ] Exercice 03 : Tools
- [ ] Exercice 04 : Callbacks
- [ ] Exercice 05 : ReAct Agent (LangGraph)
- [ ] Exercice 06 : Custom State
- [ ] Exercice 07 : Streaming
- [ ] Exercice 08 : Mini Travel Agent
- [ ] Exercice 09 : DeepAgents vs Vanilla
- [ ] Exercice 10 : Next.js Integration

## Questions ouvertes

1. **DeepAgents est-il open source ?** — À vérifier pour comprendre son code source
2. **Quelle version de LangGraph ?** — `di-agent-ui` utilise `@langchain/langgraph-checkpoint` mais pas `@langchain/langgraph` directement (DeepAgents l'encapsule)
