# Exercice 09 — Subagents, Store & Limites

## Concept

Explorer les capacités avancées de DeepAgents : délégation via subagents, persistance cross-conversation avec les backends, et comprendre les limites de l'abstraction face à StateGraph.

## Ce qu'on apprend

- **Subagents** (`task` tool) — déléguer des tâches à des agents spécialisés avec leurs propres tools et system prompt
- **StateBackend** — fichiers éphémères dans le state (perdus après chaque invocation)
- **StoreBackend** — fichiers persistants via `InMemoryStore` (ou Redis en production), namespace pour l'isolation multi-tenant
- **CompositeBackend** — routage par préfixe de chemin, mix éphémère + persistent
- **Request-scoped tools** — pattern closure pour capturer le contexte par requête (sessionId, userId) invisible au LLM
- **Custom middleware** — `createMiddleware` avec hooks lifecycle (`beforeAgent`, `wrapToolCall`, `afterAgent`)
- **Limites de DeepAgents** — single agent loop vs graph topology (StateGraph)

## Lancer

```bash
npx tsx exercises/09-subagents-store-limits/index.ts       # toutes les parties
npx tsx exercises/09-subagents-store-limits/index.ts A      # Part A: Subagents
npx tsx exercises/09-subagents-store-limits/index.ts B      # Part B: Store & backends
npx tsx exercises/09-subagents-store-limits/index.ts C      # Part C: Request-scoped tools & middleware
npx tsx exercises/09-subagents-store-limits/index.ts D      # Part D: Limites vs StateGraph
```

## Architecture des subagents

```
Main Agent (coordinateur, pas de domain tools)
  └─ task tool (ajouté par SubAgentMiddleware)
       ├─ "weather-expert"  → get_weather
       ├─ "flight-expert"   → search_flights
       └─ "general-purpose" → hérité automatiquement
```

Le main agent n'a pas accès aux tools métier — il DOIT déléguer via `task`. Chaque subagent tourne en isolation avec un state filtré (messages, todos, skillsMetadata exclus).

## Backends — où vivent les fichiers

```
StateBackend       → state.files → éphémère
StoreBackend       → InMemoryStore/Redis → persistent (cross-conversation)
CompositeBackend   → routage par préfixe → mix des deux
```

### StateBackend
- `write()` retourne `filesUpdate` — un diff à appliquer au state
- Le middleware applique `filesUpdate` via le state reducer de LangGraph
- Nouvelle invocation = nouvel objet state = fichiers perdus

### StoreBackend
- `write()` persiste directement dans le store (`filesUpdate: null`)
- Namespace pour isolation : `["user-42", "filesystem"]`
- Production : remplacer `InMemoryStore` par un store Redis

### CompositeBackend
- Route par préfixe de chemin (doit commencer par `/`)
- Ex: `/persist/*` → StoreBackend, tout le reste → StateBackend
- Backend factory dans `createDeepAgent` : `backend: (ctx) => new CompositeBackend(...)`

## Patterns de production

### Request-scoped tools (closure)

```typescript
function createScopedTools(sessionId: string, userId: string) {
  return [
    tool(async () => {
      // sessionId capturé dans la closure — invisible pour le LLM
      return fetchPreferences(userId);
    }, { name: "get_preferences", schema: z.object({}) }),
  ];
}

// Chaque requête crée ses propres tools
app.post("/api/chat", (req) => {
  const tools = createScopedTools(req.sessionId, req.userId);
  const agent = createDeepAgent({ model, tools });
});
```

### Suggestion hydration

L'agent retourne des IDs légers (`dest-bali-july`), le backend les hydrate avec les données complètes (prix, images) avant d'envoyer au frontend. Implémenté via `wrapToolCall` ou `afterAgent` middleware.

## DeepAgents vs StateGraph

| | DeepAgents | StateGraph |
|---|---|---|
| Setup | 1 fonction | Graph complet |
| Flow control | LLM décide | Vous décidez (edges) |
| Validation | Skill (espoir) | Node déterministe |
| Subagents | Built-in | Manuel |
| Parallélisme | Non | Fan-out/fan-in |
| Debugging | Middleware layers | Fonction par node |

## Points clés

- Le `task` tool est le mécanisme de délégation — le LLM choisit quel subagent utiliser en se basant sur la `description`
- `filesUpdate` est le pattern central des backends : `StateBackend` retourne le diff pour le state, `StoreBackend` persiste directement (retourne `null`)
- Les closures permettent d'injecter du contexte invisible au LLM dans les tools — pattern essentiel en production
- `createMiddleware` offre 5 hooks : `beforeAgent`, `beforeModel`, `afterModel`, `wrapToolCall`, `wrapModelCall`, `afterAgent` — plus `stateSchema` pour du state persisté et `tools` pour injecter des tools
- DeepAgents = vitesse de développement. StateGraph = contrôle total. Le choix dépend du besoin en flow déterministe
