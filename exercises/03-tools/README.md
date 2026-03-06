# Exercice 03 — Tools

## Concept

Définir des fonctions (tools) que le LLM peut appeler. Le LLM ne les exécute pas lui-même — il **demande** à les appeler, et c'est le runtime qui exécute.

## Ce qu'on apprend

- `tool()` de LangChain — créer un tool avec un nom, une description, un schema Zod et un handler
- `model.bindTools()` — attacher des tools au modèle pour qu'il puisse les appeler
- `AIMessage.tool_calls` — inspecter les appels de tools demandés par le LLM
- `ToolMessage` — le format pour retourner le résultat d'un tool au LLM

## Lancer

```bash
npx tsx exercises/03-tools/index.ts
```

## Mapping vers di-agent-ui

Dans `app/api/chat/agent/tools/suggest-destinations/index.ts` :

```ts
tool(async (input) => handler(input, sessionId), definition);
```

Où `definition` (dans `config/tools/suggest-destinations.ts`) est :
```ts
{ name: 'suggest_destinations', description: '...', schema: z.object({...}) }
```

C'est exactement le même pattern : schema Zod pour les paramètres + handler async. Dans di-agent-ui, les 8 tools sont passés à `createDeepAgent()`. Ici on va les binder directement au modèle pour comprendre le mécanisme brut.

## Points clés

- Le LLM ne peut pas exécuter de code — il produit un JSON `{ name, args }` (tool call) que le runtime exécute
- La `description` du tool détermine **quand** le LLM l'appelle
- Les `.describe()` du schema déterminent **comment** il remplit les paramètres
- `stop_reason: "tool_use"` dans la réponse signifie que le LLM veut appeler un tool au lieu de répondre
