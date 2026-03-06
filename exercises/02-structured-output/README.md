# Exercice 02 — Structured Output

## Concept

Forcer le LLM à retourner des données typées et validées grâce aux schemas Zod + `.withStructuredOutput()`.

## Ce qu'on apprend

- **Schemas Zod** — définir la forme des données que le LLM doit produire
- `.describe()` — chaque description de champ est envoyée au LLM dans le JSON Schema
- `.withStructuredOutput(schema)` — enveloppe le modèle pour retourner des objets parsés et typés
- Sous le capot, ça utilise le mode "tool_use" de l'API Anthropic (le schema devient un pseudo-tool)

## Lancer

```bash
npx tsx exercises/02-structured-output/index.ts
```

## Mapping vers di-agent-ui

Dans `app/api/chat/agent/config/schemas/traveler-project.schema.ts` :

```ts
export const TravelerProjectSchema = z.object({
  destination: DestinationSchema.optional().describe('Destination information'),
  dates: DatesSchema.optional().describe('Travel dates and duration'),
  // ...
});
```

Ces schemas définissent la structure du projet voyageur. Dans di-agent-ui, ils sont utilisés comme paramètres des **tools** (`update_traveler_project` prend un `TravelerProjectSchema` partiel). Ici, on utilise `.withStructuredOutput()` pour obtenir les mêmes réponses validées par Zod directement.

## Points clés

- `.describe()` sur les champs Zod est crucial — c'est l'instruction du LLM pour savoir quoi mettre dans chaque champ
- `.withStructuredOutput()` garantit que la réponse correspond au schema (sinon ça throw)
- C'est la base des tools : un tool est essentiellement un schema + une fonction
