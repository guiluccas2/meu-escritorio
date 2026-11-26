#!/bin/bash
# Roda todos os testes (Playwright). Cada teste imprime "ERROS [...]" ou "errs [...]" no fim — tem que sair vazio.
cd "$(dirname "$0")"
for t in tarm twf tbk tvinc tfin1 tfin2 tfin3 tfin4 tfin5 tserv trel tcomp tlote tproc2 tpes2 tnovos tpub trecorte trobo-recorte tleadgcal tleadpassos taudgcal tlembeu tjuris tanexo trobo-arq taparencia tinicio tprzsec taudconcluir tdigitalizar tdigrecorte tdigrevisao tcel; do
  [ -f $t.js ] || continue
  out=$(timeout 240 node $t.js 2>&1); fim=$(echo "$out" | grep -iE "^(ERROS|errs):? " | tail -1)
  if echo "$fim" | grep -qE "\[ *\]$"; then echo "✔ $t"; else echo "✘ $t"; echo "$out" | tail -8; fi
done
