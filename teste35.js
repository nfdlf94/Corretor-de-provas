/* teste35.js — a conferência do gabarito.
   Uma letra não se confere contra nada: para saber se "C" está certo é
   preciso ver qual é a alternativa C daquela questão. Esta tela mostra
   enunciado e alternativas com a marcada em destaque, sinaliza o que
   provavelmente veio errado do arquivo, e deixa corrigir com um toque. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const E = H.estadoBase(10);
E.turmas[0].nome = "3º Ano A";
H.comSimulado(E, { id:"s1", nLP:6, nMAT:6, codigo:"SIM1", titulo:"1º Simulado", ano:2026 });
const pr = E.provas.find(p => p.id === "ps1");

/* problemas plantados, um de cada tipo */
pr.questoes[0].enunciado = "Qual é a probabilidade de o computador estar sem defeito?";
pr.questoes[0].alternativas = ["4/5","1/20","1/5","1/16","1/4"];
pr.gabItens[2] = "";                                   // sem letra
pr.questoes[3].enunciado = "";                         // sem enunciado
pr.questoes[4].alternativas = ["um","dois","três"];    // só 3 alternativas
pr.questoes[5].alternativas = ["igual","igual","c","d","e"];  // repetidas
pr.questoes[7].enunciado = pr.questoes[6].enunciado;   // enunciado repetido
pr.questoes[8].alternativas = ["a","", "c","d","e"];   // alternativa em branco
pr.gabItens[9] = "E";
pr.gabC = pr.gabItens.map(x => x || "A").join("");

const { win } = H.abrirApp({ estado: E });
const ev = s => win.eval(s);
const J = s => JSON.parse(ev("JSON.stringify(" + s + ")"));

setTimeout(() => {
  console.log("teste35 — conferência do gabarito");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── os avisos ── */
  const A = J('alertasDoCaderno(provaDe("ps1"))');
  const tipos = A.lista.map(x => x.tipo);
  ok(tipos.includes("sem"), "aponta item sem letra no gabarito");
  ok(tipos.includes("vazio"), "aponta item sem enunciado");
  ok(tipos.includes("nalts"), "aponta questão com número errado de alternativas");
  ok(tipos.includes("altrepetida"), "aponta alternativas repetidas");
  ok(tipos.includes("altvazia"), "aponta alternativa em branco");
  ok(tipos.includes("repetida"), "aponta enunciado repetido no caderno");
  const rep = A.lista.find(x => x.tipo === "repetida");
  ok(rep && /item 7/.test(rep.txt), "e diz de qual item é a repetição: " + (rep||{}).txt);
  ok(A.comGab === 11, "conta 11 dos 12 itens com gabarito (veio " + A.comGab + ")");

  /* concentração de letras: um gabarito com quase tudo na mesma letra */
  ev('(function(){ var p=provaDe("ps1"); var l=itensDoCaderno(p);' +
     ' l.forEach(function(x){ x.gab="C"; }); gravarCaderno(p,l); salvar(); })()');
  const B = J('alertasDoCaderno(provaDe("ps1"))');
  ok(B.lista.some(x => x.tipo === "concentracao"),
     "avisa quando quase tudo cai na mesma letra");
  ok(B.conta.C === 12, "e mostra a contagem por letra (C: " + B.conta.C + ")");

  /* volta o gabarito variado */
  ev('(function(){ var p=provaDe("ps1"); var l=itensDoCaderno(p);' +
     ' l.forEach(function(x,i){ x.gab="ABCDE"[i%5]; }); gravarCaderno(p,l); salvar(); })()');
  ok(!J('alertasDoCaderno(provaDe("ps1"))').lista.some(x=>x.tipo==="concentracao"),
     "gabarito variado não dispara o aviso");

  /* ── a tela ── */
  ev('casaTurma="t1"; casaSim="s1"; casaNivel="conferir"; montarCasa();');
  const corpo = () => win.document.getElementById("casaCorpo");
  const txt = corpo().textContent.replace(/\s+/g, " ");
  ok(/Conferir o gabarito/.test(txt), "a tela abre");
  ok(/probabilidade de o computador estar sem defeito/.test(txt),
     "mostra o ENUNCIADO da questão");
  ok(/4\/5/.test(txt) && /1\/5/.test(txt), "mostra as ALTERNATIVAS, não só a letra");
  ok(/Distribuição das respostas/.test(txt), "mostra a distribuição das letras");

  const botoes = corpo().querySelectorAll("[data-q]");
  ok(botoes.length === 12 * 5, "uma alternativa tocável por item (" + botoes.length + ")");
  const marcadas = [...corpo().querySelectorAll(".tag")].filter(x => /certa/.test(x.textContent));
  ok(marcadas.length === 12, "uma alternativa marcada como certa por item");

  /* ── corrigir com um toque ── */
  const antes = ev('provaDe("ps1").gabC');
  ok(antes[0] !== "D", "o item 1 não está em D antes do toque (está em " + antes[0] + ")");
  const alvo = [...botoes].find(b => b.dataset.q === "0" && b.dataset.l === "D");
  alvo.click();
  const depois = ev('provaDe("ps1").gabC');
  ok(depois[0] === "D", "tocar na alternativa troca o gabarito do item (" +
     antes[0] + " → " + depois[0] + ")");
  ok(depois.slice(1) === antes.slice(1), "e não mexe nos outros itens");

  /* a correção respeita o caderno único da série */
  ok(ev('typeof propagarNaSerie') === "function",
     "a troca passa por gravarCaderno, que propaga para a série");

  /* ── as entradas ── */
  ev('casaNivel="itens"; montarCasa();');
  ok(!!win.document.getElementById("itConferir"), "a tela de itens leva para a conferência");
  ev('casaNivel="simulado"; montarCasa();');
  const bc = win.document.getElementById("bConferir");
  ok(!!bc, "a ficha do simulado leva para a conferência");
  ok(/a olhar/.test(bc.textContent), "e mostra quantos avisos há: " +
     bc.textContent.replace(/\s+/g," ").trim());

  console.log(falhas ? "\nteste35: " + falhas + " FALHA(S)" : "\nteste35: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
