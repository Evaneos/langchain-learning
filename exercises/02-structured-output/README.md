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

## En production

En production, les schemas Zod sont utilisés comme paramètres des **tools** (ex: un tool `update_project` prend un schema partiel). Ici, on utilise `.withStructuredOutput()` pour obtenir des réponses validées par Zod directement — c'est la base des tools (exercice 03).

## Points clés

- `.describe()` sur les champs Zod est crucial — c'est l'instruction du LLM pour savoir quoi mettre dans chaque champ
- `.withStructuredOutput()` garantit que la réponse correspond au schema (sinon ça throw)
- C'est la base des tools : un tool est essentiellement un schema + une fonction
