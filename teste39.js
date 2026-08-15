/* teste39.js — o formato novo do arquivo de simulado e a exclusão que
   alcança a série inteira.

   O material do professor traz, depois das questões, três blocos com os
   títulos espaçados letra a letra: "G A B A R I T O", "D E S C R I T O
   R E S" e "R E L A Ç Ã O  D E  N Í V E L  D E  P R O F I C I Ê N C I A".
   O leitor antigo só enxergava as questões: os títulos não batiam com o
   que ele procurava, e o gabarito vinha em três colunas na mesma linha.

   O terceiro bloco é o mais valioso: liga cada questão ao nível da
   escala do SAEPE, o que dá ao item uma dificuldade oficial sem depender
   de adivinhar a habilidade pelo texto. */
"use strict";
const H = require("./harness");
const { execFileSync } = require("child_process");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const pdf = f => execFileSync("pdftotext", ["-layout", f, "-"],
  { encoding:"utf8", maxBuffer: 1e8 });
const txtLP  = pdf("/mnt/user-data/uploads/1º_Simulado_-_Portugue_s_.pdf");
const txtMAT = pdf("/mnt/user-data/uploads/1º_Simulado_-_Matema_tica_.pdf");

/* três turmas da mesma série, com um simulado de série */
function estado(){
  const E = H.estadoBase(10);
  E.turmas[0].nome = "3º Ano A"; E.turmas[0].serie = "3º ano do Ensino Médio";
  ["B","C"].forEach((L,n) => {
    const t = JSON.parse(JSON.stringify(E.turmas[0]));
    t.id = "t" + (n+2); t.nome = "3º Ano " + L;
    E.turmas.push(t);
  });
  return E;
}

const { win } = H.abrirApp({ estado: estado(), confirmar: true });
const ev = s => win.eval(s);
const J = s => JSON.parse(ev("JSON.stringify(" + s + ")"));

setTimeout(() => {
  console.log("teste39 — formato novo do arquivo e exclusão em série");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── leitura dos dois arquivos ── */
  ["LP", "MAT"].forEach(comp => {
    win.__t = comp === "LP" ? txtLP : txtMAT;
    const L = J('lerSimuladoDoc(window.__t)');
    ok(L.itens.length === 15, comp + ": 15 questões lidas");
    ok(Object.keys(L.chave).length === 15,
       comp + ": as 15 letras do gabarito, mesmo em três colunas por linha");
    ok(L.semGab === 0, comp + ": nenhum item ficou sem letra");
    ok(L.descritores.length >= 6, comp + ": " + L.descritores.length + " descritores");
    ok(L.descritores.every(d => d.questoes.length > 0),
       comp + ": todo descritor traz a lista de questões");
    ok(Object.keys(L.niveis).length === 15, comp + ": os 15 níveis da escala");
    ok(L.semNivel === 0, comp + ": nenhum item ficou sem nível");
    ok(L.itens.every(x => x.niv >= 1 && x.niv <= 10), comp + ": níveis dentro de 1 a 10");
  });

  /* os valores conferem com o arquivo */
  win.__t = txtLP;
  const LP = J('lerSimuladoDoc(window.__t)');
  ok(LP.chave["1"] === "C" && LP.chave["15"] === "E", "LP: gabarito 1=C e 15=E");
  ok(LP.itens[3].niv === 9, "LP: a questão 4 está no nível 9 (tese em paráfrase)");
  ok(LP.itens[1].niv === 4, "LP: a questão 2 está no nível 4");
  ok(!/Desej[áa]vel/.test(LP.itens[3].nivTexto),
     "a coluna Padrão não vaza para dentro do texto da habilidade");
  const d21 = LP.descritores.find(d => d.cod === "D21");
  ok(d21 && d21.questoes.join(",") === "4,10", "LP: D21 nas questões 4 e 10");

  win.__t = txtMAT;
  const MT = J('lerSimuladoDoc(window.__t)');
  ok(MT.chave["1"] === "D" && MT.chave["9"] === "A", "MAT: gabarito 1=D e 9=A");
  ok(MT.itens[3].niv === 8, "MAT: a questão 4 está no nível 8");
  ok(MT.itens[0].niv === 4, "MAT: a questão 1 está no nível 4");

  /* ── o nível vira âncora de dificuldade ── */
  ev('casaTurma="t1"; criarSimuladoNaSerie(turmaDe("t1"));');
  const sm = J('E.simulados.filter(s=>s.turma==="t1")')[0];
  ev('casaSim=' + JSON.stringify(sm.id) + ';');
  ev('(function(){ var sm=simuladoDe(casaSim); sm.qtd={LP:15,MAT:15};' +
     ' ajustarQuantidade(sm,"LP"); ajustarQuantidade(sm,"MAT"); })()');
  win.__t = txtLP;
  ev('(function(){ var sm=simuladoDe(casaSim); var L=lerSimuladoDoc(window.__t);' +
     ' aplicarImportacao(sm,"LP",L.itens.map(function(x,i){x.orig=i+1;return x;})); })()');
  win.__t = txtMAT;
  ev('(function(){ var sm=simuladoDe(casaSim); var L=lerSimuladoDoc(window.__t);' +
     ' aplicarImportacao(sm,"MAT",L.itens.map(function(x,i){x.orig=i+1;return x;})); salvar(); })()');

  const pr = J('provaDoSim(simuladoDe(casaSim))');
  ok(pr.nq === 30, "o caderno ficou com 30 itens (veio " + pr.nq + ")");
  ok((pr.niv || []).filter(Boolean).length === 30, "os 30 itens guardaram o nível do arquivo");
  ok(J('ancorasDoCaderno(provaDoSim(simuladoDe(casaSim)))').comAncora === 30,
     "os 30 itens já entram ancorados, sem ninguém associar nada à mão");

  const a = J('ancoraDoItem(provaDoSim(simuladoDe(casaSim)),0,"LP","3EM")');
  ok(a && a.doArquivo === true, "a âncora do item 1 veio do arquivo");
  ok(a && a.ponto === 312.5, "nível 6 de LP ancora em 312,5 (veio " + (a||{}).ponto + ")");

  /* o caderno chegou igual nas três turmas */
  const cadernos = J('E.simulados.filter(x=>x.matriz===' + JSON.stringify(sm.matriz) + ')' +
    '.map(x=>{var p=provaDoSim(x); return {turma:turmaDe(x.turma).nome, gabC:p.gabC,' +
    ' niv:(p.niv||[]).join(",")};})');
  ok(cadernos.length === 3, "o simulado existe nas três turmas");
  ok(new Set(cadernos.map(c => c.gabC)).size === 1, "mesmo gabarito nas três");
  ok(new Set(cadernos.map(c => c.niv)).size === 1, "e os mesmos níveis nas três");

  /* ── exclusão alcança a série ── */
  const antesProvas = J('E.provas.length'), antesSims = J('E.simulados.length');
  ok(antesSims === 3, "há 3 registros de simulado antes de excluir");
  ev('casaNivel="simulado"; montarCasa();');
  const bot = win.document.getElementById("smDel");
  ok(!!bot, "a ficha tem o botão de excluir");
  ok(/das 3 turmas/.test(bot.textContent),
     "o botão avisa o alcance: " + bot.textContent.replace(/\s+/g," ").trim());
  bot.click();
  ok(J('E.simulados.length') === 0, "excluir numa turma tira o simulado das três");
  ok(J('E.provas.length') === antesProvas - 3, "os três cadernos foram removidos");
  ok(J('E.res.length') === 0, "e as correções deles também");
  ok(J('casaNivel') === "simulados", "a tela volta para a lista");

  console.log(falhas ? "\nteste39: " + falhas + " FALHA(S)" : "\nteste39: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
