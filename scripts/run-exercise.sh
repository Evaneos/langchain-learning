#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: npm run ex -- <number> [part] [--slow]"
  echo "  npm run ex -- 05        # run exercise 05"
  echo "  npm run ex -- 5 B       # run exercise 05, part B"
  echo "  npm run ex -- 5 B --slow"
  exit 1
fi

num=$(printf "%02d" "$1" 2>/dev/null) || { echo "Error: '$1' is not a valid exercise number"; exit 1; }
shift

dir=$(ls -d exercises/${num}-* 2>/dev/null | head -1 || true)
if [ -z "$dir" ]; then
  echo "Error: no exercise found for number $num (exercises/${num}-*)"
  exit 1
fi

# Determine entry point: if a part letter is given (e.g. B), look for index-b.ts
entry="index.ts"
if [ $# -gt 0 ] && [[ "$1" =~ ^[A-Za-z]$ ]]; then
  part=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  shift
  candidate="${dir}/index-${part}.ts"
  if [ -f "$candidate" ]; then
    entry="index-${part}.ts"
  else
    echo "Error: part '$part' not found ($candidate)"
    exit 1
  fi
fi

echo "→ Running $dir/$entry"
exec npx tsx "$dir/$entry" "$@"
