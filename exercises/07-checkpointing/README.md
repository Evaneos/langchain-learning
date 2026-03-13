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

## En production

En production, la persistence peut être gérée manuellement (ex: Redis, PostgreSQL) ou via un checkpointer LangGraph. L'approche manuelle nécessite du code custom pour sauvegarder/recharger les messages et isoler les sessions. Le checkpointer LangGraph offre les mêmes garanties mais **automatiquement** — chaque `thread_id` est une conversation isolée sans code supplémentaire.

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
