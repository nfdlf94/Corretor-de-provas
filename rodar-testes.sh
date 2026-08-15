#!/bin/bash
# rodar-testes.sh — roda todas as suítes em jsdom, contra o app de verdade.
# Uso:  NODE_PATH=<caminho de node_modules> bash rodar-testes.sh
cd "$(dirname "$0")"
falhas=0
for t in $(ls teste*.js | sort -V); do
  if node "$t" > /tmp/saida_$t 2>&1; then
    echo "  PASSOU   $t"
  else
    echo "  FALHOU   $t"
    tail -20 /tmp/saida_$t | sed 's/^/           /'
    falhas=$((falhas+1))
  fi
done
echo
[ $falhas -eq 0 ] && echo "todas as suítes passaram" || echo "$falhas suíte(s) com falha"
exit $falhas
