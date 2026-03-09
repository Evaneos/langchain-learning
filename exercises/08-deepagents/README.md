# Exercice 08 — DeepAgents

## Concept

Comprendre DeepAgents comme couche d'abstraction au-dessus de LangGraph. `createDeepAgent` remplace le setup manuel (StateGraph, nodes, edges) par un seul appel de fonction, avec du middleware intégré (filesystem, subagents, skills).

## Ce qu'on apprend

- `createDeepAgent` — remplace StateGraph + nodes + edges + compile en un seul appel
- `checkpointer: new MemorySaver()` — même checkpointer qu'ex07, passé directement à `createDeepAgent`
- `FilesystemBackend` — backend pour charger skills et fichiers depuis le disque
- Skills (SKILL.md) — fichiers markdown qui guident le comportement de l'agent
- Middleware — comprendre les couches ajoutées par défaut (filesystem, subagents, summarization)

## Lancer

```bash
npx tsx exercises/08-deepagents/index.ts       # toutes les parties
npx tsx exercises/08-deepagents/index.ts A      # Part A: createDeepAgent
npx tsx exercises/08-deepagents/index.ts B      # Part B: Skills
```

## Mapping vers di-agent-ui

di-agent-ui utilise exactement ce pattern dans `agent-factory.ts` :

```typescript
const agent = createDeepAgent({
  model: this.baseModel,
  tools,                                          // 8 travel tools
  store: this.sharedStore,                         // InMemoryStore
  systemPrompt: agentInstructions,                 // agent-instructions.md
  backend: new FilesystemBackend({ rootDir }),      // config/
  skills: ['skills/'],                             // 7 skills
  name: 'travel-agent',
});
```

### Couches d'abstraction

```
DeepAgents                    ← exercice 08 (ici)
  └─ createDeepAgent()
       ├─ ReactAgent          ← exercice 05 (createReactAgent)
       │    └─ StateGraph     ← exercice 06 (nodes, edges)
       │         └─ Checkpointer  ← exercice 07 (MemorySaver)
       └─ Middleware
            ├─ FilesystemMiddleware (ls, read, write, edit, glob, grep)
            ├─ SubAgentMiddleware (task tool for delegation)
            ├─ SkillsMiddleware (SKILL.md → system prompt)
            └─ SummarizationMiddleware (context management)
```

### Skills dans di-agent-ui

7 skills définissent le flux de consultation voyage :

1. `exploration-destinations` — trouver des destinations via API
2. `cadrage-projet` — structurer les paramètres concrets (dates, budget, groupe)
3. `profilage-voyageur` — extraire le profil voyageur
4. `projection-experiences` — aider à visualiser des expériences concrètes
5. `synthese-brief` — finaliser le brief du projet
6. `conseil-arbitrage` — résoudre les conflits/ambiguïtés
7. `cloture-conversation` — transition vers contact agence

Chaque skill est un fichier SKILL.md avec frontmatter YAML + instructions markdown.

## Points clés

- `createDeepAgent` = `createReactAgent` + middleware — même résultat, moins de code, plus de fonctionnalités
- `checkpointer` accepte une instance `MemorySaver` (ou tout `BaseCheckpointSaver`) — `true` ne fonctionne que pour les sous-graphes, pas les root graphs
- Les skills sont du **code naturel** : des fichiers markdown qui guident le comportement de l'agent sans changer le code
- Le compromis : DeepAgents offre la vitesse de développement mais contraint le modèle d'exécution à un seul agent loop. Pour des graphs custom (conditional edges, nodes de validation, multi-agent), il faut revenir à StateGraph (ex06)
- Di-agent-ui a fait ce choix : DeepAgents pour la vitesse, avec le risque de devoir migrer si le flow devient trop complexe
