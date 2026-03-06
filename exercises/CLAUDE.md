# Exercises — Conventions

## Format des exercices

Chaque exercice contient :
- Un **exemple 1** complet et fonctionnel avec des **commentaires inline** qui expliquent les **nouveaux concepts** introduits. Ne pas ré-expliquer les concepts déjà couverts dans les exercices précédents.
- Un **exemple 2** optionnel sous forme de `TODO(human)` pour que l'humain pratique le concept.

Les commentaires doivent expliquer le "quoi" et le "pourquoi", pas le "comment" évident.

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
