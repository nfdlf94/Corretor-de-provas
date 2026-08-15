/* teste36.js — a faixa em que a proficiência é projetada.

   Conferida contra a Revista da Escola SAEPE 2024 (Matemática):
     5º EF  níveis 1..9, o último "acima de 325"
     9º EF  níveis 1..8, o último "acima de 375"
     3º EM  níveis 1..9, o último "acima de 425"
   O teto do 3º EM era 400 e cortava a escala no meio — os níveis 8
   (400 a 425) e 9 (acima de 425) existem, têm habilidades descritas, e
   nenhum estudante conseguia chegar lá.

   Os pontos de corte dos padrões do 3º EM em Matemática também vêm do
   caderno de 2024: até 250 / 251 a 290 / 291 a 325 / 326 ou mais. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const E = H.estadoBase(10);
E.turmas[0].nome = "3º Ano A";
H.comSimulado(E, { id:"s1", nLP:8, nMAT:8, codigo:"S1", titulo:"1º Simulado", ano:2026 });

const { win } = H.abrirApp({ estado: E });
const ev = s => win.eval(s);
const J = s => JSON.parse(ev("JSON.stringify(" + s + ")"));

setTimeout(() => {
  console.log("teste36 — faixa da escala e pontos de corte");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── as faixas cobrem a escala documentada ── */
  const faixas = {};
  J('ETAPAS').forEach(e => faixas[e.id] = e.faixa);
  ok(faixas["5EF"][1] === 325, "5º EF projeta até 325 (último nível: acima de 325)");
  ok(faixas["9EF"][1] === 375, "9º EF projeta até 375 (último nível: acima de 375)");
  ok(faixas["3EM"][1] === 425, "3º EM projeta até 425 (era 400, cortava os níveis 8 e 9)");

  /* ── os cortes do 3º EM em Matemática, do caderno de 2024 ── */
  const c = J('etapaDe("3EM").cortes');
  ok(c.MAT.join(",") === "250,290,325",
     "cortes de Matemática do 3º EM: até 250 · 251 a 290 · 291 a 325 · 326 ou mais");
  ok(J('padraoDe(240,"3EM","MAT").nome') === "Elementar I", "240 é Elementar I");
  ok(J('padraoDe(270,"3EM","MAT").nome') === "Elementar II", "270 é Elementar II");
  ok(J('padraoDe(300,"3EM","MAT").nome') === "Básico", "300 é Básico");
  ok(J('padraoDe(326,"3EM","MAT").nome') === "Desejável", "326 é Desejável");
  ok(J('padraoDe(410,"3EM","MAT").nome') === "Desejável", "410 continua Desejável");

  /* ── o teto deixou de truncar ── */
  const cheio = ev('profPorPercentual(E.simulados[0],8,8,5)');
  ok(cheio === 425, "acerto total no 3º EM chega a 425 (chegava a 400)");
  ok(ev('profPorPercentual(E.simulados[0],0,8,5)') === 175, "acerto zero fica no piso, 175");
  const meio = ev('profPorPercentual(E.simulados[0],4,8,5)');
  ok(meio > 175 && meio < 425, "meio acerto cai no meio da faixa (" + meio.toFixed(0) + ")");

  /* a correção do chute continua valendo: 20% de acerto = piso */
  ok(Math.abs(ev('profPorPercentual(E.simulados[0],1.6,8,5)') - 175) < 0.01,
     "20% de acerto com 5 alternativas é tratado como chute e fica no piso");

  /* ── a faixa é editável por simulado ── */
  ev('casaTurma="t1"; casaSim="s1"; casaNivel="simulado"; montarCasa();');
  const d = win.document;
  ok(!!d.getElementById("smPiso") && !!d.getElementById("smTeto"),
     "a ficha do simulado tem os campos de piso e teto");
  ok(+d.getElementById("smTeto").value === 425, "o campo abre com o padrão da etapa");
  ok(/projeção, não medida/.test(d.getElementById("casaCorpo").textContent),
     "a tela diz que é projeção, não medida");

  d.getElementById("smTeto").value = "500";
  d.getElementById("smTeto").dispatchEvent(new win.Event("change"));
  ok(J('simuladoDe("s1").faixa').join(",") === "175,500", "editar o teto grava no simulado");
  ok(ev('profPorPercentual(simuladoDe("s1"),8,8,5)') === 500,
     "e a projeção passa a usar o valor novo");
  ok(J('etapaDe("3EM").faixa').join(",") === "175,425",
     "sem alterar o padrão da etapa, que vale para os outros simulados");

  ev('casaNivel="simulado"; montarCasa();');
  ok(!!d.getElementById("smFaixaPadrao"), "aparece o botão de voltar ao padrão");
  d.getElementById("smFaixaPadrao").click();
  ok(ev('simuladoDe("s1").faixa') === undefined, "voltar ao padrão limpa a faixa do simulado");
  ok(ev('profPorPercentual(simuladoDe("s1"),8,8,5)') === 425, "e a projeção volta a 425");

  /* teto abaixo do piso é recusado */
  ev('casaNivel="simulado"; montarCasa();');
  d.getElementById("smTeto").value = "100";
  d.getElementById("smTeto").dispatchEvent(new win.Event("change"));
  ok(ev('simuladoDe("s1").faixa') === undefined, "teto menor que o piso é recusado");
  ok((win.__alertas||[]).some(m => /maior que o piso/.test(m)), "e o app avisa por quê");

  console.log(falhas ? "\nteste36: " + falhas + " FALHA(S)" : "\nteste36: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
