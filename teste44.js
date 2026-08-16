/* teste44.js — as duas correções de diagramação.

   1. EXPOENTE. O texto guarda marcas invisíveis em volta do que é
      sobrescrito. Nas telas viram <sup>; no papel, corpo menor levantado
      da linha de base. O "2^(0,5x)" que aparecia impresso não existe
      mais em lugar nenhum.

   2. CASCATA. Não cabendo em 4 páginas: primeiro a escada de fonte (já
      rodava dentro do gerador), depois a TROCA da questão comprida por
      outra do mesmo descritor e texto menor, tirada do próprio arquivo
      enviado, e só então o corte de questões. */
"use strict";
const H = require("./harness");
const G = require("./gerador.js");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const SUP = "\u0002", FSUP = "\u0003", SUB = "\u0004", FSUB = "\u0005";

const E = H.estadoBase(8);
E.turmas[0].nome = "3º Ano A";
H.comSimulado(E, { id:"s1", nLP:4, nMAT:4, codigo:"S1", titulo:"1º", ano:2026 });

const { win } = H.abrirApp({ estado: E });
const ev = s => win.eval(s);
const J = s => JSON.parse(ev("JSON.stringify(" + s + ")"));

setTimeout(() => {
  console.log("teste44 — expoentes no papel e cascata de ajuste");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. expoentes ── */
  const linha = partes => JSON.parse(ev('JSON.stringify(agruparLinhas(' +
    JSON.stringify(partes.map(([str,y,h]) => ({str, height:h, transform:[0,0,0,0,0,y]}))) +
    ').map(function(l){return l.txt;}))'));

  const compl = linha([["N(x) = 500 · 2", 700, 10], ["0,5x", 704, 6], [".", 700, 10]])[0];
  ok(compl === "N(x) = 500 · 2" + SUP + "0,5x" + FSUP + ".",
     "o expoente sai marcado, não como ^( ): " + JSON.stringify(compl));
  ok(!/\^\(/.test(compl), "a notação ^( ) não existe mais no texto");

  ok(linha([["5t", 700, 10], ["2", 704, 6]])[0] === "5t²",
     "o que cabe em algarismo sobrescrito continua sendo Unicode: 5t²");

  /* nas telas vira <sup> */
  ok(ev('esc(' + JSON.stringify(compl) + ')') ===
     "N(x) = 500 · 2<sup>0,5x</sup>.",
     "na tela o app mostra <sup>, não os caracteres de controle");
  ok(!/[\u0002-\u0005]/.test(ev('esc(' + JSON.stringify(compl) + ')')),
     "nenhuma marca invisível escapa para o HTML");

  /* no papel, o gerador separa os pedaços */
  const pd = G.pedacosDeNivel(compl);
  ok(pd.length === 3, "o gerador vê três pedaços: texto, expoente, texto");
  ok(pd[1].t === "0,5x" && pd[1].nivel === 1, "o do meio é sobrescrito");
  ok(pd[0].nivel === 0 && pd[2].nivel === 0, "os outros dois são normais");
  ok(G.semMarcas(compl) === "N(x) = 500 · 20,5x.", "a medida da linha ignora as marcas");

  /* a quebra em linhas devolve as marcas ao lugar */
  const remarcadas = G.remarcar(["N(x) = 500 · 2", "0,5x."], compl);
  ok(remarcadas.join("|") === "N(x) = 500 · 2|" + SUP + "0,5x" + FSUP + ".",
     "as marcas voltam para a linha certa depois da quebra");
  ok(G.temMarcas(remarcadas[1]) && !G.temMarcas(remarcadas[0]),
     "só a linha que tem expoente é desenhada pedaço a pedaço");

  const sub = linha([["H", 700, 10], ["2", 696, 6], ["O", 700, 10]])[0];
  ok(sub === "H₂O", "índice simples continua em Unicode: H₂O");

  /* ── 2. cascata ── */
  /* reserva: questões do arquivo que não entraram no caderno */
  ev('(function(){ var sm=simuladoDe("s1");' +
     ' sm.reserva={LP:[{questao:{enunciado:"Curta.",alternativas:["a","b","c","d","e"]},' +
     '   gab:"A", desc:"D1", niv:5}], MAT:[]};' +
     ' var pr=provaDoSim(sm), l=itensDoCaderno(pr);' +
     ' l[0].desc="D1";' +
     ' l[0].questao.enunciado="Enunciado bem comprido ".repeat(30);' +
     ' gravarCaderno(pr,l); salvar(); })()');

  const cands = J('trocasPossiveis(simuladoDe("s1"), itensDoCaderno(provaDoSim(simuladoDe("s1"))))');
  ok(cands.length === 1, "acha a troca possível (veio " + cands.length + ")");
  ok(cands[0] && cands[0].i === 0, "e é a questão comprida, a de índice 0");
  ok(cands[0] && cands[0].ganho > 500, "com ganho grande de texto: " +
     (cands[0] ? cands[0].ganho : "-") + " caracteres");

  /* descritor diferente não é candidato */
  ev('simuladoDe("s1").reserva.LP[0].desc="D9";');
  ok(J('trocasPossiveis(simuladoDe("s1"), itensDoCaderno(provaDoSim(simuladoDe("s1"))))')
     .length === 0, "questão de OUTRO descritor nunca é oferecida como troca");
  ev('simuladoDe("s1").reserva.LP[0].desc="D1";');

  /* questão que já está no caderno não é oferecida */
  ev('(function(){ var sm=simuladoDe("s1"), pr=provaDoSim(sm), l=itensDoCaderno(pr);' +
     ' sm.reserva.LP=[{questao:{enunciado:l[1].questao.enunciado,' +
     '   alternativas:l[1].questao.alternativas}, gab:l[1].gab, desc:l[0].desc, niv:5}];})()');
  ok(J('trocasPossiveis(simuladoDe("s1"), itensDoCaderno(provaDoSim(simuladoDe("s1"))))')
     .length === 0, "questão que já está no caderno não é oferecida de novo");

  /* texto quase do mesmo tamanho também não vale a troca */
  ev('(function(){ var sm=simuladoDe("s1"), pr=provaDoSim(sm), l=itensDoCaderno(pr);' +
     ' sm.reserva.LP=[{questao:{enunciado:l[0].questao.enunciado.slice(0,-3),' +
     '   alternativas:["a","b","c","d","e"]}, gab:"A", desc:l[0].desc, niv:5}];})()');
  ok(J('trocasPossiveis(simuladoDe("s1"), itensDoCaderno(provaDoSim(simuladoDe("s1"))))')
     .length === 0, "troca que quase não encurta o texto é descartada");

  /* a ordem da cascata: caber sem mexer devolve corte 0 e nenhuma troca */
  ev('(function(){ var sm=simuladoDe("s1"), pr=provaDoSim(sm), l=itensDoCaderno(pr);' +
     ' l[0].questao.enunciado="Enunciado curto."; gravarCaderno(pr,l); salvar(); })()');
  const aj = J('melhorAjuste(simuladoDe("s1"))');
  ok(aj && aj.corte === 0, "cabendo em 4 páginas, não há corte");
  ok(aj && (aj.trocas || []).length === 0, "nem troca: o caderno fica como está");
  ok(aj && aj.paginas <= 4, "e a previsão confirma " + (aj ? aj.paginas : "?") + " páginas");

  console.log(falhas ? "\nteste44: " + falhas + " FALHA(S)" : "\nteste44: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
