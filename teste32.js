/* teste32.js — o que é IMPRESSO tem de ser o que é CORRIGIDO.
   Três coisas precisam falar a mesma língua para a nota sair certa:
     1. a ordem das questões no caderno de cada estudante (gerador.js);
     2. o gabarito individual gravado no QR do cartão (gerador.js);
     3. o gabarito recalculado na correção (index.html).
   Se qualquer uma divergir, a turma inteira sai com nota errada e ninguém
   percebe. Esta suíte confere as três, estudante por estudante, com e sem
   blocos alternados e com tipos de prova.

   Confere também o efeito ESPERADO do embaralhamento: cada estudante tem
   um caderno diferente, então o mesmo conjunto de marcações em cartões de
   estudantes diferentes PRECISA dar notas diferentes. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const E = H.estadoBase(12);
E.turmas[0].nome = "3º Ano A";
H.comSimulado(E, { id:"sim1", nLP:8, nMAT:8, codigo:"3ANOA-SAEPE-26",
                   titulo:"1º Simulado SAEPE", ano:2026 });
E.ativa = "psim1";

const { win } = H.abrirApp({ estado: E });
const ev = s => win.eval(s);
const caderno = E.provas.find(p => p.id === "psim1");
const LETRAS = ["A","B","C","D","E"];

setTimeout(() => {
  console.log("teste32 — impressão × cartão × correção");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const turma = "3º Ano A";
  const alunos = E.turmas[0].alunos;

  /* ── 1. as três fontes concordam, estudante por estudante ── */
  [true, false].forEach(alternar => {
    E.simulados[0].alternarBlocos = alternar;
    ev('E.simulados[0].alternarBlocos=' + alternar + ';');
    let divergiram = [];
    alunos.forEach(a => {
      /* o que o gerador imprime no QR do cartão */
      const doCartao = win.gabaritoIndividual(caderno.gabC, turma, a.numero, 5,
                                              caderno.comps, alternar);
      /* o que a correção recalcula na hora de conferir */
      const daCorrecao = ev('gabaritoDe(' + JSON.stringify(turma) + ',' +
                            JSON.stringify(a.numero) + ')');
      /* a ordem das questões impressa no caderno do estudante */
      const ordem = JSON.parse(ev('JSON.stringify(ordemDe(provaDe("psim1"),' +
        JSON.stringify(turma) + ',' + JSON.stringify(a.numero) + '))'));
      /* o gabarito individual TEM de ser o canônico reordenado pela ordem
         impressa, com as alternativas remapeadas */
      const esperado = ordem.oq.map((q,i) => {
        const certa = LETRAS.indexOf(caderno.gabC[q]);
        return LETRAS[ordem.oa[i].indexOf(certa)];
      }).join("");
      if (doCartao !== daCorrecao || doCartao !== esperado)
        divergiram.push(a.numero + " (cartão " + doCartao + " / correção " + daCorrecao + ")");
    });
    ok(divergiram.length === 0,
       "blocos " + (alternar ? "alternados" : "fixos") + ": cartão, correção e caderno " +
       "batem nos 12 estudantes" + (divergiram.length ? " — divergiram: " + divergiram.join("; ") : ""));
  });

  /* com tipos de prova, a semente é o tipo, não o número */
  ev('E.simulados[0].tipos=3;');
  let divTipos = [];
  alunos.forEach(a => {
    const chave = ev('chaveDeOrdem(' + JSON.stringify(a.numero) + ',3)');
    const doCartao = win.gabaritoIndividual(caderno.gabC, turma, chave, 5, caderno.comps, false);
    const daCorrecao = ev('gabaritoDe(' + JSON.stringify(turma) + ',' + JSON.stringify(a.numero) + ')');
    if (doCartao !== daCorrecao) divTipos.push(a.numero);
  });
  ok(divTipos.length === 0, "com 3 tipos de prova, cartão e correção continuam batendo" +
     (divTipos.length ? " — divergiram: " + divTipos.join(", ") : ""));
  ev('E.simulados[0].tipos=0; E.simulados[0].alternarBlocos=true;');

  /* ── 2. cada estudante tem um caderno diferente ── */
  const gabs = alunos.map(a => win.gabaritoIndividual(caderno.gabC, turma, a.numero, 5,
                                                      caderno.comps, true));
  const distintos = new Set(gabs).size;
  ok(distintos >= 10, "os 12 estudantes recebem gabaritos diferentes (" + distintos + " distintos)");

  /* ── 3. a armadilha: usar o gabarito CANÔNICO em qualquer cartão ──
     O canônico é a ordem do documento do simulado, que não é a ordem de
     nenhum caderno impresso. Preencher o cartão com ele acerta só por
     acaso — e um acaso diferente para cada estudante. */
  const canonico = caderno.gabC;
  const acertosCom = gab => gab.split("").filter((L,i) => L === canonico[i]).length;
  const porAluno = alunos.map(a => {
    const g = win.gabaritoIndividual(canonico, turma, a.numero, 5, caderno.comps, true);
    const lp = [0,1,2,3,4,5,6,7].filter(i => g[i] === canonico[i]).length;
    return { numero:a.numero, total: acertosCom(g), lp };
  });
  const totais = porAluno.map(x => x.total);
  ok(new Set(totais).size > 1,
     "o MESMO conjunto de marcações dá notas diferentes por estudante: " +
     totais.join(", ") + " de 16");
  const mediaLP = porAluno.reduce((s,x)=>s+x.lp,0)/porAluno.length;
  ok(mediaLP < 8, "e em Língua Portuguesa acerta em média " + mediaLP.toFixed(1) +
     " de 8 — perto de metade, como o professor observou");
  console.log("       por estudante (total/16 · LP/8): " +
    porAluno.map(x => x.numero+": "+x.total+"/"+x.lp).join("  "));

  /* ── 4. o caminho certo: o gabarito do próprio cartão dá 16/16 ── */
  ev('ativar("psim1");');
  const a3 = alunos[2];
  const gabDele = ev('gabaritoDe(' + JSON.stringify(turma) + ',' + JSON.stringify(a3.numero) + ')');
  ev('registrar({numero:' + JSON.stringify(a3.numero) + ',nome:"x",R:' +
     JSON.stringify(gabDele.split("")) + ',origem:"manual",notaDisc:0})');
  const reg = JSON.parse(ev('JSON.stringify(E.res.find(r=>r.prova==="psim1"))'));
  ok(reg && reg.acertos === 16, "marcando o gabarito DO PRÓPRIO cartão: 16/16 (veio " +
     (reg||{}).acertos + ")");

  /* e as mesmas marcações no cartão de OUTRO estudante erram */
  const a5 = alunos[4];
  ev('registrar({numero:' + JSON.stringify(a5.numero) + ',nome:"y",R:' +
     JSON.stringify(gabDele.split("")) + ',origem:"manual",notaDisc:0})');
  const reg2 = JSON.parse(ev('JSON.stringify(E.res.find(r=>r.numero==="' + a5.numero + '"))'));
  ok(reg2 && reg2.acertos < 16, "as mesmas marcações no cartão de outro estudante erram (" +
     (reg2||{}).acertos + "/16) — é o embaralhamento funcionando");

  /* ── 5. o acerto por componente respeita os blocos ── */
  const lpOk = ev('acertosComp(provaDe("psim1"),E.res.find(r=>r.numero==="' + a3.numero + '"),"LP")');
  const matOk = ev('acertosComp(provaDe("psim1"),E.res.find(r=>r.numero==="' + a3.numero + '"),"MAT")');
  ok(lpOk === 8 && matOk === 8, "quem acertou tudo tem 8 em LP e 8 em MAT (veio " +
     lpOk + " e " + matOk + ")");

  /* ── 6. a planilha de gabaritos por estudante ── */
  const abas = JSON.parse(ev('JSON.stringify(abasGabaritoPorEstudante(provaDe("psim1"),turmaDe("t1")))'));
  ok(abas.length === 2, "a planilha tem as duas abas");
  const L = abas[0].linhas;
  ok(L[0][0] === "nº" && L[0].length === 2 + 16, "cabeçalho com as 16 questões");
  ok(/CANÔNICO/.test(L[1][1]), "a 2ª linha é o gabarito canônico, marcado como tal");
  ok(L[1].slice(2).join("") === caderno.gabC, "e traz mesmo o canônico");
  ok(L.length === 2 + 12, "uma linha por estudante (veio " + (L.length-2) + ")");
  const linhaDe = n => L.find(x => x[0] === n);
  const l3 = linhaDe("03");
  ok(l3 && l3.slice(2).join("") === gabDele, "o gabarito do nº 03 na planilha é o mesmo da correção");
  const chaves = L.slice(2).map(x => x.slice(2).join(""));
  ok(new Set(chaves).size === 12, "os 12 gabaritos da planilha são diferentes entre si");
  ok(!chaves.includes(caderno.gabC), "nenhum estudante recebe o canônico como gabarito");

  const C = abas[1].linhas;
  const compsDe = n => C.find(x => x[0] === n).slice(2);
  ok(compsDe("03").filter(x => x === "LP").length === 8,
     "a aba de componentes mostra 8 posições de LP para o nº 03");
  ok(compsDe("03").join("") !== compsDe("04").join("") ||
     compsDe("03").join("") !== compsDe("05").join(""),
     "a posição dos blocos muda entre estudantes com blocos alternados");

  console.log(falhas ? "\nteste32: " + falhas + " FALHA(S)" : "\nteste32: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
