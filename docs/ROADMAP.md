# Roadmap des exercices

## Section 1 — Core

Chemin principal : LangChain → LangGraph → DeepAgents → intégration front.

| # | Titre | Layer | Status |
|---|-------|-------|--------|
| 01 | Hello LLM | LC | done |
| 02 | Structured Output | LC | done |
| 03 | Tools | LC | done |
| 04 | Streaming | LC | done |
| 05 | createAgent | LG | done |
| 06 | StateGraph | LG | done |
| 07 | Checkpointing | LG | done |
| 08 | DeepAgents | DA | done |
| 09 | Subagents, Store & Limites | DA | done |
| 10 | Hooks & Callbacks | LG | todo — ce que DeepAgents cache : BaseCallbackHandler, lifecycle events (on_llm_start, on_tool_start…), RunnableConfig callbacks, stream events |
| 11 | Stream Pipeline | LG | todo — parseLangChainStream → StreamEvent neutres, StreamEventProcessor, accumulation progressive JSON des tool args |
| 12 | Message Conversion | LC | todo — UIMessage ↔ BaseMessage, segmentation aux boundaries tool-result, backward compat |
| 13 | Vercel AI SDK | Front | todo — useChat, streaming UI, pont LangChain → React (dépend de ex11 + ex12) |

## Section 2 — Advanced patterns (après Section 1)

Patterns avancés de graph et workflows complexes. Patterns qui vont au-delà du chemin principal,
mais nécessaires pour aller plus loin avec LangGraph.

### Human-in-the-loop
- **Interrupts** — `interruptBefore`/`interruptAfter` pour pauser le graph avant/après un noeud.
- **Approval workflows** — le graph s'arrête, un humain valide, le graph reprend (s'appuie sur le checkpointing de l'ex 07).
- **State modification** — modifier le state pendant la pause (`updateState`), puis reprendre.

### Graph topology
- **Router** — `addConditionalEdges` qui envoie vers un seul chemin parmi N selon le state.
- **Fan-out / fan-in** — un noeud déclenche N noeuds en parallèle, un noeud de convergence attend que tous aient fini. Reducers merge les résultats.
- **Dynamic routing** — router vers N noeuds possibles selon le contenu du state.

### Autres candidats (à affiner)
- **Sub-graphs** — graph imbriqué dans un noeud, pour modulariser des workflows complexes.
- **Multi-agent** — plusieurs agents qui communiquent via un state partagé.
