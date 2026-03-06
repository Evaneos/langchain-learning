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
- En résumé : seul ce qui est **nouveau** pour l'exercice change. Le reste reste identique.

### Liens entre exercices

Quand un concept d'un exercice précédent est **observable** dans l'exercice courant (ex: `stop_reason` change de valeur), **ajouter un `console.log`** plutôt qu'un simple commentaire. L'apprenant doit voir le lien dans la sortie, pas seulement dans le code source. Le commentaire accompagne le log pour expliquer le contexte.

## Workflow par exercice

1. Claude crée l'exercice (exemple 1 complet + TODO(human) pour l'exemple 2)
2. Claude exécute pour vérifier que l'exemple 1 marche
3. Claude commit : `feat(exNN): create ...`
4. L'humain fait l'exemple 2 (ou pas) et dit qu'il a fini
5. Claude vérifie le code (exécute, review, donne un feedback/insight)
6. Claude commit : `feat(exNN): complete ...`
7. Claude propose l'exercice suivant
8. L'humain valide → retour à 1.
