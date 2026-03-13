# Exercice 01 — Hello LLM

## Concept

Le building block le plus basique : appeler un LLM via `ChatAnthropic`.

## Ce qu'on apprend

- `ChatAnthropic` — le wrapper LangChain autour de l'API Anthropic
- `HumanMessage`, `SystemMessage`, `AIMessage` — les types de messages standardisés
- `.invoke()` — la façon la plus simple d'appeler un modèle (non-streaming)
- La réponse est un `AIMessage` avec `.content`, `.usage_metadata`, `.response_metadata`

## Lancer

```bash
npx tsx exercises/01-hello-llm/index.ts
```

## En production

`ChatAnthropic` est le point d'entrée de tout agent LangChain. En production, cette instance est ensuite passée à `createAgent()` ou `createDeepAgent()` qui l'enveloppent dans un graphe LangGraph. Ici on l'appelle directement pour comprendre le building block brut.

## Points clés

- `ChatAnthropic` est un wrapper fin autour de l'API Anthropic — il gère le formatage, les retries, et retourne des objets typés
- Les messages sont des objets simples (`{ role, content }`) mais LangChain fournit des classes typées pour la sécurité
- `.invoke()` retourne un `AIMessage` complet — pas juste une string. C'est important car LangGraph chaîne ces messages ensemble
