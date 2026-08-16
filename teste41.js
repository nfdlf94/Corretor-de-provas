/* teste41.js — duas correções que vieram das fotos do aparelho.

   1. EXPOENTES. No PDF, "5t²" não é um pedaço de texto só: é "5t" na
      linha de base e "2" acima, em corpo menor. O agrupamento em linhas
      olhava só o y e punha o expoente numa LINHA À PARTE — levando o
      resto da frase junto. Na prova impressa saía:

          A expressão h(t) = 20t − 5t
          2 descreve a trajetória de uma bola de golfe…

   2. SIMULADO FANTASMA. Um registro de simulado cujo caderno já não
      existe aparecia na lista, não abria nada e a tela rebatia. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const E = H.estadoBase(6);
E.turmas[0].nome = "3º Ano A";
H.comSimulado(E, { id:"s1", nLP:6, nMAT:6, codigo:"S1", titulo:"1º Simulado SAEPE", ano:2026 });
/* fantasma: o registro existe, o caderno não */
E.simulados.push({ id:"morto", turma:"t1", titulo:"1º Simulado SAEPE", etapa:"3EM",
  ano:2026, prova:"pFoiEmbora", metodo:"tri", alternarBlocos:true, tipos:0,
  qtd:{LP:7,MAT:7}, fontes:{}, criado:2, valorParticipacao:1.25, partAluno:{} });

const { win } = H.abrirApp({ estado: E });
const ev = s => win.eval(s);
const J = s => JSON.parse(ev("JSON.stringify(" + s + ")"));

setTimeout(() => {
  console.log("teste41 — expoentes na leitura e simulado fantasma");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. expoentes ── */
  /* pedaços como o pdf.js entrega: [texto, y, altura] */
  const linha = (partes) => JSON.parse(ev('JSON.stringify(agruparLinhas(' +
    JSON.stringify(partes.map(([str, y, h]) => ({ str, height:h, transform:[0,0,0,0,0,y] }))) +
    ').map(function(l){return l.txt;}))'));

  ok(linha([["A expressão h(t) = 20t − 5t", 700, 10],
            ["2", 704, 6],
            [" descreve a trajetória de uma bola de golfe.", 700, 10]]).join("|")
     === "A expressão h(t) = 20t − 5t² descreve a trajetória de uma bola de golfe.",
     "o expoente volta para a linha: 5t²");

  ok(linha([["N(x) = 500 · 2", 700, 10], ["0,5x", 704, 6]])[0]
     === "N(x) = 500 · 2^(0,5x)",
     "expoente sem versão sobrescrita vira ^( ): " + linha([["N(x) = 500 · 2",700,10],["0,5x",704,6]])[0]);

  ok(linha([["f(t) = 20 · 2", 700, 10], ["t − 1", 704, 6], [", em que f(t)…", 700, 10]])[0]
     === "f(t) = 20 · 2^(t − 1), em que f(t)…",
     "e a frase continua na mesma linha depois do expoente");

  ok(linha([["x", 700, 10], ["3", 704, 6]])[0] === "x³", "x³ em algarismo sobrescrito");
  ok(linha([["a", 700, 10], ["n", 704, 6]])[0] === "aⁿ", "aⁿ também tem sobrescrito próprio");
  ok(linha([["H", 700, 10], ["2", 697, 6], ["O", 700, 10]])[0] === "H₂O",
     "índice vira subscrito: H₂O");

  /* uma linha nova de verdade continua sendo uma linha nova */
  const duas = linha([["primeira linha do enunciado", 700, 10],
                      ["segunda linha do enunciado", 686, 10]]);
  ok(duas.length === 2, "linha seguinte não é engolida (veio " + duas.length + ")");
  const titulo = linha([["texto corrido", 700, 10], ["TÍTULO MENOR ABAIXO", 680, 7]]);
  ok(titulo.length === 2, "texto menor numa linha abaixo não vira subscrito");

  /* ── 2. o fantasma ── */
  ok(J('E.simulados.length') === 1,
     "o registro sem caderno foi removido ao abrir o app (sobrou " +
     J('E.simulados.length') + ")");
  ok(J('E.simulados.map(s=>s.id)')[0] === "s1", "o simulado bom continua lá");

  /* mesmo que reapareça em memória, não entra na lista */
  ev('E.simulados.push({id:"morto2",turma:"t1",titulo:"Fantasma",etapa:"3EM",' +
     'ano:2026,prova:"pSumiu",metodo:"tri",alternarBlocos:true,tipos:0,' +
     'qtd:{LP:7,MAT:7},fontes:{},criado:3,valorParticipacao:1.25,partAluno:{}});');
  ok(J('simuladosDa("t1").map(s=>s.id)').join(",") === "s1",
     "a lista da turma ignora simulado sem caderno");

  ev('casaTurma="t1"; casaNivel="simulados"; montarCasa();');
  const corpo = win.document.getElementById("casaCorpo");
  ok(!/Fantasma/.test(corpo.textContent), "a tela de simulados não mostra o fantasma");
  ok(corpo.querySelectorAll("[data-s]").length === 1, "só um simulado na lista");

  /* abrir um fantasma pelo id não deixa a tela rebatendo */
  ev('casaSim="morto2"; casaNivel="simulado"; montarCasa();');
  ok(ev('casaNivel') === "simulados", "abrir o fantasma volta para a lista");
  ok(!J('E.simulados.map(s=>s.id)').includes("morto2"),
     "e o registro é apagado no caminho, em vez de ficar rebatendo");

  console.log(falhas ? "\nteste41: " + falhas + " FALHA(S)" : "\nteste41: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
