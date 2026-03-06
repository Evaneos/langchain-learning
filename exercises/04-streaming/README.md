# Exercice 04 — Streaming

## Concept

Recevoir la réponse du LLM **token par token** au lieu d'attendre la réponse complète. Comprendre comment les tool calls arrivent en morceaux dans le stream.

## Ce qu'on apprend

- `.stream()` vs `.invoke()` — itérer sur des `AIMessageChunk` au lieu de recevoir un `AIMessage` complet
- `process.stdout.write()` — afficher les tokens en temps réel (pas de `\n` entre chaque)
- Streaming + tools — les tool calls arrivent en morceaux (`tool_call_chunks`) qu'il faut reconstituer
- Le pattern d'événements text/tool qui préfigure `parseLangChainStream()` de di-agent-ui

## Lancer

```bash
npx tsx exercises/04-streaming/index.ts
```

## Mapping vers di-agent-ui

Dans `app/api/chat/agent/agent-invoker.ts:42-51` :

```ts
const langchainStream = await config.agent.stream(
    { messages: langchainMessages },
    { streamMode: 'messages', callbacks: config.callbacks },
);
```

Puis `parseLangChainStream()` (même fichier) itère sur ce stream et classe chaque chunk en événements neutres :

```ts
type StreamEvent =
    | { kind: 'text-start' }
    | { kind: 'text-delta'; content: string }
    | { kind: 'text-end' }
    | { kind: 'tool-call-start'; id: string; name: string }
    | { kind: 'tool-call-delta'; id: string; args: string }
    | { kind: 'tool-invocation'; id: string; name: string; args: unknown }
    | { kind: 'tool-result'; toolCallId: string; toolName: string; content: unknown };
```

C'est exactement ce pattern qu'on explore ici : le stream brut de LangChain contient des `AIMessageChunk` avec soit du texte (`content`), soit des morceaux de tool calls (`tool_call_chunks`). di-agent-ui les transforme en événements typés pour le frontend.

## Points clés

- `.stream()` retourne un `AsyncIterable<AIMessageChunk>` — chaque chunk est un morceau de la réponse
- Un chunk texte a du `content` (string), un chunk tool a des `tool_call_chunks` (args JSON partiels)
- La boucle complète avec tools en streaming : stream → détecter les tool calls → exécuter → re-stream la réponse finale
- C'est la base de toute UX temps réel avec un LLM
