/* Espelho exato de embaralho.py — permite ao app desembaralhar qualquer
   cartão usando só turma e número, que já estão no QR. */
function semente(turma, numero){
  let h = 2166136261 >>> 0;
  const s = String(turma) + "|" + String(numero);
  for (let i = 0; i < s.length; i++){
    h = (h ^ (s.charCodeAt(i) & 0xFF)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function lcg(s){
  let e = s >>> 0;
  return () => { e = (Math.imul(e, 1664525) + 1013904223) >>> 0; return e / 4294967296; };
}
function permutacao(n, s){
  const r = lcg(s), p = Array.from({length:n}, (_, i) => i);
  for (let i = n - 1; i > 0; i--){
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}
function embaralharProva(nq, na, turma, numero){
  const s = semente(turma, numero);
  const oq = permutacao(nq, s), oa = [];
  for (let p = 0; p < nq; p++)
    oa.push(permutacao(na, (Math.imul(0x9E3779B9, p + 1) + s) >>> 0));
  return {oq, oa};
}
/* Simulado: os itens saem AGRUPADOS por componente, e o sorteio acontece
   dentro de cada bloco. O sorteio em si é o mesmo de sempre — só a ordem
   das posições muda, juntando cada bloco. Como depende apenas de
   (turma, número, comps), o corretor reconstrói exatamente igual.
   ESPELHO DE embaralho.py. */
function embaralharEmBlocos(nq, na, turma, numero, comps, alternar){
  const {oq, oa} = embaralharProva(nq, na, turma, numero);
  if (!comps || !comps.length) return {oq, oa};

  /* ordem natural: a que os componentes aparecem no caderno */
  let ordemBlocos = [];
  comps.forEach(c => { if (c && ordemBlocos.indexOf(c) < 0) ordemBlocos.push(c); });

  /* `alternar` sorteia QUAL bloco abre a prova de cada estudante — um
     começa por Língua Portuguesa, o vizinho por Matemática. Sorteado a
     partir da mesma dupla (turma, número), então o corretor reconstrói.
     Só vale para aplicação em dia único: com blocos em posições
     diferentes não dá para aplicar um componente por dia. */
  if (alternar && ordemBlocos.length > 1){
    const p = permutacao(ordemBlocos.length, (semente(turma, numero) ^ 0x5BF03635) >>> 0);
    ordemBlocos = p.map(k => ordemBlocos[k]);
  }

  const fora = [], dentro = [];
  ordemBlocos.forEach(c => oq.forEach(i => { if (comps[i] === c) dentro.push(i); }));
  oq.forEach(i => { if (dentro.indexOf(i) < 0) fora.push(i); });
  return {oq: dentro.concat(fora), oa};
}

/* posição p do cartão -> índice do item canônico */
const itemCanonico = (oq, p) => oq[p];
/* letra marcada na posição p -> letra canônica daquele item */
function letraCanonica(oa, p, letra, opcoes){
  const k = opcoes.indexOf(letra);
  return k < 0 ? null : opcoes[oa[p][k]];
}
if (typeof module !== "undefined") module.exports = {semente, permutacao, embaralharProva, embaralharEmBlocos, itemCanonico, letraCanonica};
