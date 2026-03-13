# Exercice 05 — LangGraph Agent (createAgent)

## Concept

Automatiser la boucle ReAct (LLM -> tool calls -> execute -> LLM -> ...) avec `createAgent` de LangGraph. Plus besoin de gérer manuellement le cycle qu'on codait en exercices 03 et 04.

## Ce qu'on apprend

- `createAgent()` — crée un graphe LangGraph avec 2 noeuds : "model_request" (LLM) et "tools" (ToolNode)
- La boucle automatique : le graphe reboucle tant que le LLM demande des tool calls
- `.invoke()` sur l'agent — retourne l'état final avec tous les messages (user, AI, tool, AI final)
- `.stream()` avec `streamMode: "messages"` — le pattern standard pour le streaming token par token en production
- `systemPrompt` — injecter un system message pour configurer le comportement de l'agent

## Lancer

```bash
npx tsx exercises/05-langgraph-agent/index.ts       # toutes les parties
npx tsx exercises/05-langgraph-agent/index.ts A      # une seule partie
npx tsx exercises/05-langgraph-agent/index.ts B --slow  # streaming au ralenti
```

## En production

En production, `createDeepAgent()` appelle `createAgent()` sous le capot avec des defaults opinionés (skills, store, system prompt). Ici on utilise `createAgent()` directement pour comprendre le mécanisme brut. Le streaming en production utilise `streamMode: 'messages'` — exactement ce qu'on fait en Part B.

## Points cles

- `createAgent` = la même boucle manuelle des exercices 03/04, mais encapsulée dans un graphe
- Le graphe a un edge conditionnel : si `stop_reason === "tool_use"` → noeud tools → noeud model_request (reboucle), sinon → END
- `ToolNode` résout le problème du dispatch manuel (plus de `tools.find(t => t.name === ...)`)
- `streamMode: "messages"` donne les mêmes `AIMessageChunk` que `.stream()` de l'exercice 04, mais à travers le graphe entier (tool calls incluses)

## Les streamMode disponibles

| Mode | Ce qu'on reçoit | Cas d'usage |
|---|---|---|
| `"messages"` | Tuples `[message, metadata]` — tokens LLM un par un + metadata du noeud source | **Apps chat** — le mode standard pour le streaming token par token en production |
| `"updates"` | État partiel après chaque noeud (`{ model_request: { messages: [...] } }`) | **Observer le graphe** — voir quel noeud a produit quoi, étape par étape |
| `"values"` | État **complet** du graphe après chaque super-step | **Inspecter l'état global** — utile pour debug ou quand on a un state complexe au-delà de `messages` |
| `"debug"` | Maximum d'infos (noeud, état complet, timings…) | **Debug poussé** — tout voir pendant le développement |
| `"custom"` | Données custom émises depuis les noeuds du graphe | **Données métier** — streamer des infos spécifiques (progression, données intermédiaires) |
| `"events"` | Tous les événements (via `.astream_events()`) | **Migration LCEL** — rarement utilisé directement |

On peut combiner plusieurs modes : `streamMode: ["updates", "messages"]` — chaque chunk est alors un tuple `[mode, data]`.
