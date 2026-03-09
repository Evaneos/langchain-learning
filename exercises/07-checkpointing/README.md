# Exercice 07 — Checkpointing

## Concept

Ajouter de la mémoire à un StateGraph via un checkpointer. Chaque `thread_id` isole une conversation, et chaque exécution de noeud crée un snapshot inspectable.

## Ce qu'on apprend

- `MemorySaver` — checkpointer in-memory (dev/learning)
- `thread_id` — identifiant de conversation dans `configurable`
- Mémoire conversationnelle — envoyer uniquement le nouveau message, le checkpointer charge l'historique
- Isolation des threads — conversations parallèles indépendantes
- `getState()` — inspecter le snapshot courant (messages, next nodes, checkpoint ID)
- `getStateHistory()` — parcourir tous les snapshots (un par exécution de noeud)

## Lancer

```bash
npx tsx exercises/07-checkpointing/index.ts       # toutes les parties
npx tsx exercises/07-checkpointing/index.ts A      # une seule partie
```

## Mapping vers di-agent-ui

Dans di-agent-ui, la persistence est gérée par Redis (pas un checkpointer LangGraph) :
- Les messages sont stockés/relus manuellement via `redis-message-store.ts`
- Chaque session de chat a un `chatId` qui joue le même rôle que `thread_id`
- L'isolation entre utilisateurs est assurée par des clés Redis distinctes

Le checkpointer LangGraph offre les mêmes garanties mais **automatiquement** — pas besoin de code custom pour sauvegarder/recharger les messages.

## Architecture du graphe

### Part A (conversation memory)
```
Turn 1: START → agent → tools → agent → END  (checkpoint saved)
Turn 2: START → agent → tools → agent → END  (loads Turn 1 from checkpoint)
```

### Part B (thread isolation)
```
Thread "alice": weather Bali → follow-up → remembers Bali
Thread "bob":   weather Tokyo → independent conversation
```

### Part C (state inspection)
```
getState()        → latest snapshot (messages, next, checkpoint_id)
getStateHistory() → all snapshots: input → agent → tools → agent → END
```

## Points clés

- `.compile({ checkpointer })` est le **seul changement** vs exercice 06 — le graphe reste identique
- `{ configurable: { thread_id: "..." } }` passé en 2e argument de `.invoke()` identifie la conversation
- On n'envoie que le **nouveau message** — le checkpointer recharge automatiquement l'historique complet
- Chaque `thread_id` est une conversation isolée — pas de fuite entre threads
- `getStateHistory()` retourne un snapshot **par exécution de noeud** — utile pour debug et time travel
- Exercice 10 (Human-in-the-loop) utilisera les checkpoints pour pause/resume de conversations
