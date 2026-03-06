# Exercises — Conventions

## Format des exercices

Chaque exercice contient :
- Un **exemple 1** complet et fonctionnel avec des **commentaires inline** qui expliquent les **nouveaux concepts** introduits. Ne pas ré-expliquer les concepts déjà couverts dans les exercices précédents.
- Un **exemple 2** optionnel sous forme de `TODO(human)` pour que l'humain pratique le concept.

Les commentaires doivent expliquer le "quoi" et le "pourquoi", pas le "comment" évident.

### Consistance entre exercices

- **Réutiliser les mêmes tools** (ex: `get_weather`, `search_flights`) d'un exercice à l'autre sauf si le concept nécessite un tool différent. L'apprenant doit reconnaître le code familier et se concentrer sur le nouveau concept.
- **Garder les mêmes patterns de code** : si un exercice utilise `const userMessage = new HumanMessage(...)` avant l'appel, les exercices suivants doivent faire pareil (pas de `new HumanMessage(...)` inline).
- **Découper en fonctions** quand un exercice a plusieurs parties autonomes (Part A, B, C…). Chaque partie = une `async function partX()` appelée depuis `main()`. Si les parties sont courtes et interdépendantes, un seul `main()` suffit.
- **Filtrage par partie** : quand l'exercice a des parties, lire `process.argv[2]` pour permettre `npm run latest -- A` (une seule partie) ou `npm run latest` (toutes). Pattern : `const partFilter = process.argv[2]?.toUpperCase();` puis `if (!partFilter || partFilter === "A") await partA();`.
- **Slow-motion mode** : quand un exercice implique du streaming ou des flux rapides, ajouter un flag `--slow` (via `process.argv.includes("--slow")`) avec un délai configurable entre chaque chunk/itération. Permet d'observer le comportement en temps réel. Pattern : `const SLOW_MODE = process.argv.includes("--slow");` + `if (SLOW_MODE) await delay(CHUNK_DELAY_MS);` dans les boucles.
- **Utiliser `exercises/utils.ts`** pour les patterns déjà appris dans les exercices précédents (`collectStream`, `executeToolCalls`, `logAIMessage`, `writeChunkText`). Importer depuis `../utils` au lieu de dupliquer. **Mais** : tout concept **nouveau** pour l'exercice DOIT rester visible inline dans le code, même si ça ressemble à du code utilitaire. L'apprenant doit voir le code des concepts qu'il apprend.
- En résumé : seul ce qui est **nouveau** pour l'exercice change. Le reste reste identique.

### Liens entre exercices

Quand un concept d'un exercice précédent est **observable** dans l'exercice courant (ex: `stop_reason` change de valeur), **ajouter un `console.log`** plutôt qu'un simple commentaire. L'apprenant doit voir le lien dans la sortie, pas seulement dans le code source. Le commentaire accompagne le log pour expliquer le contexte.

## Workflow par exercice

1. Claude crée l'exercice (exemple 1 complet + TODO(human) pour l'exemple 2)
2. Claude exécute pour vérifier que l'exemple 1 marche
3. Claude met à jour la **Learning Map** (voir ci-dessous)
4. Claude commit : `feat(exNN): create ...`
5. L'humain fait l'exemple 2 (ou pas) et dit qu'il a fini
6. Claude vérifie le code (exécute, review, donne un feedback/insight)
7. Claude commit : `feat(exNN): complete ...`
8. Claude propose l'exercice suivant
9. L'humain valide → retour à 1.

## Learning Map

Avant le commit de création (étape 4), mettre à jour le noeud dans `docs/learning-map.html` :

### Données du noeud

- **`done: true`** si l'exemple 1 fonctionne
- **`concepts`** : concepts clés, courts, séparés par virgule
- **`apis[]`** : chaque API clé avec `name`, `from` (package d'origine), `detail` (explication pédagogique riche avec `<code>`, contexte di-agent-ui si pertinent, et liens vers les autres exercices), `signature` optionnelle
- **`insights[]`** : phrases "aha moment" qui créent un déclic de compréhension. Non-obvious, intelligentes. Peuvent faire le pont entre exercices ("Structured output IS tool calling in disguise"). Laisser vide si rien de pertinent — mieux vaut 0 insight que des insights médiocres

### Connexions

- **`prereqs[]`** : exercices nécessaires pour comprendre celui-ci. Vérifier que le graphe de dépendances reste cohérent (pas de cycle, pas de prereq manquant)
- **`shared[]`** : concepts qui traversent les exercices et changent de sens ou de forme (ex: `stop_reason` évolue entre 01→03→04, `Zod schemas` réutilisés entre 02→03). Vérifier aussi si des exercices **existants** doivent ajouter un `shared` pointant vers le nouveau
