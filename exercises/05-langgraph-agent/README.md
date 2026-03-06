# Exercice 05 — LangGraph Agent (createAgent)

## Concept

Automatiser la boucle ReAct (LLM -> tool calls -> execute -> LLM -> ...) avec `createAgent` de LangGraph. Plus besoin de gérer manuellement le cycle qu'on codait en exercices 03 et 04.

## Ce qu'on apprend

- `createAgent()` — crée un graphe LangGraph avec 2 noeuds : "model_request" (LLM) et "tools" (ToolNode)
- La boucle automatique : le graphe reboucle tant que le LLM demande des tool calls
- `.invoke()` sur l'agent — retourne l'état final avec tous les messages (user, AI, tool, AI final)
- `.stream()` avec `streamMode: "messages"` — le pattern exact de di-agent-ui pour le streaming token par token
- `systemPrompt` — injecter un system message pour configurer le comportement de l'agent

## Lancer

```bash
npx tsx exercises/05-langgraph-agent/index.ts       # toutes les parties
npx tsx exercises/05-langgraph-agent/index.ts A      # une seule partie
npx tsx exercises/05-langgraph-agent/index.ts B --slow  # streaming au ralenti
```

## Mapping vers di-agent-ui

Dans `app/api/chat/agent/agent-factory.ts:78-85` :

```ts
this.agent = createDeepAgent({
  model: this.baseModel,
  tools: [...toolInstances],
  skills: [...skillInstances],
  // ...
});
```

`createDeepAgent()` appelle `createAgent()` sous le capot avec des defaults opinionés (skills, store, system prompt). Ici on utilise `createAgent()` directement pour comprendre le mécanisme brut.

Dans `app/api/chat/agent/agent-invoker.ts:42-51`, le streaming utilise `streamMode: 'messages'` — exactement ce qu'on fait en Part B.

## Points cles

- `createAgent` = la même boucle manuelle des exercices 03/04, mais encapsulée dans un graphe
- Le graphe a un edge conditionnel : si `stop_reason === "tool_use"` → noeud tools → noeud model_request (reboucle), sinon → END
- `ToolNode` résout le problème du dispatch manuel (plus de `tools.find(t => t.name === ...)`)
- `streamMode: "messages"` donne les mêmes `AIMessageChunk` que `.stream()` de l'exercice 04, mais à travers le graphe entier (tool calls incluses)
