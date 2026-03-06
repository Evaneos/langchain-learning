# Exercice 06 — StateGraph custom

## Concept

Construire un StateGraph manuellement pour comprendre ce que `createAgent` fait sous le capot. Puis ajouter un noeud custom (pre-processing) impossible a faire avec `createAgent` seul.

## Ce qu'on apprend

- `StateGraph` — le primitif central de LangGraph : noeuds + edges + state
- `MessagesAnnotation` — state predefini avec `messages[]` et un reducer qui append
- `Annotation.Root()` — etendre le state avec des champs custom (au-dela de `messages`)
- `addNode()`, `addEdge()`, `addConditionalEdges()` — construire le graphe piece par piece
- `START`, `END` — les points d'entree et de sortie du graphe
- `ToolNode` — le meme dispatcher automatique que `createAgent` utilise
- `.compile()` — transformer le graphe en runnable (meme interface que `createAgent`)

## Lancer

```bash
npx tsx exercises/06-state-graph/index.ts       # toutes les parties
npx tsx exercises/06-state-graph/index.ts A      # une seule partie
```

## Mapping vers di-agent-ui

`createDeepAgent()` appelle `createAgent()` qui appelle `StateGraph` sous le capot. Si on avait besoin de :
- Injecter du contexte dynamique (profil voyageur, skills) → noeud `prepare` comme Part B
- Post-traiter la reponse (logging, transformation) → noeud `postprocess` comme Part C
- Router vers differents LLMs selon le type de question → `addConditionalEdges` custom

...on ne pourrait pas le faire avec `createAgent` seul. `StateGraph` donne le controle total.

## Architecture du graphe

### Part A (recreation de createAgent)
```
START → agent → shouldContinue? → tools → agent (loop)
                                → END
```

### Part B (pre-processing)
```
START → prepare → agent → shouldContinue? → tools → agent (loop)
                                           → END
```

### Part C (TODO: post-processing)
```
START → prepare → agent → shouldContinue? → tools → agent (loop)
                                           → postprocess → END
```

## Points cles

- `StateGraph(MessagesAnnotation)` = un graphe dont le state est `{ messages: BaseMessage[] }`
- Le reducer de `messages` **append** les nouveaux messages au lieu de remplacer — c'est pourquoi chaque noeud retourne `{ messages: [newMsg] }` et pas l'array complet
- `addConditionalEdges("agent", shouldContinue)` est le coeur de la boucle ReAct : si `tool_calls` → "tools", sinon → END
- `Annotation.Root({ ...MessagesAnnotation.spec, myField: Annotation<T> })` etend le state — le pattern pour injecter du contexte custom
- Un noeud est juste `async (state) => partialState` — simple function, pas de classe ou interface speciale
