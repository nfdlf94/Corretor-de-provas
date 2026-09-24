/* teste82.js — propagação da troca de questão, e o bug que apagava
   habilidades e níveis silenciosamente.

   Dois pedidos do professor nesta mensagem, e um bug real que a
   investigação encontrou no caminho.

   1. Trocar uma questão deve valer para TODAS as turmas que compartilham
      o simulado — sem precisar repetir a troca manualmente em cada uma.
   2. A habilidade oficial (associada em "Habilidades da escala") NÃO
      pode se perder — nem na troca (a antiga não serve para a questão
      nova) nem em nenhum outro momento do uso normal do app.

   Investigando o segundo ponto apareceu um bug concreto: a tela "Itens
   do caderno" reconstruía cada item do zero ao salvar, e a reconstrução
   esquecia `hab` e `niv` — toda vez que o professor visitava aquela tela
   (rotineira: é onde se confere gabarito e descritor) e saía, ou tocava
   no rótulo Port./Mat. de uma questão, as duas informações eram
   apagadas do caderno inteiro, em silêncio. Era isso, não a troca, que
   fazia "habilidades desaparecerem" — e explica por que reassociar
   ("subir as habilidades") parecia precisar ser feito de novo e de
   novo. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(6), {nLP:0, nMAT:5}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste82 — propagação da troca e preservação de habilidades");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ═══ PARTE 1: o bug que apagava hab/niv ═══ */

  const antesDoConserto = J(`(function(){
    var pr=provaDoSim(E.simulados[0]);
    pr.nq=5; pr.no=5; pr.gabC="ABCDE";
    pr.desc=["D17","D22","D22","D23","D24"];
    pr.comps=["MAT","MAT","MAT","MAT","MAT"];
    pr.questoes=pr.desc.map(function(d,i){
      return {enunciado:d+" q"+i, alternativas:["a","b","c","d","e"]};});
    pr.hab=["H1","","H3","",""];
    pr.niv=[6,7,8,5,9];
    E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    return {hab:pr.hab.slice(), niv:pr.niv.slice()};
  })()`);
  ok(antesDoConserto.hab.filter(Boolean).length === 2,
     "cenário: duas questões com habilidade oficial associada");
  ok(antesDoConserto.niv.every(x => x != null),
     "e as cinco com nível da escala");

  /* visitar "Itens do caderno" e sair — o gatilho exato do bug */
  const depoisDeVisitar = J(`(function(){
    var sm=E.simulados[0];
    casaSim=sm.id; casaNivel="itens"; montarCasa();
    document.querySelector("#mVolta").onclick();
    var pr=provaDoSim(sm);
    return {hab:pr.hab, niv:pr.niv};
  })()`);
  ok(JSON.stringify(depoisDeVisitar.hab) === JSON.stringify(antesDoConserto.hab),
     "a habilidade oficial sobrevive a visitar a tela e voltar: " +
     JSON.stringify(depoisDeVisitar.hab));
  ok(JSON.stringify(depoisDeVisitar.niv) === JSON.stringify(antesDoConserto.niv),
     "e o nível da escala também: " + JSON.stringify(depoisDeVisitar.niv));

  /* tocar no rótulo Port./Mat. de uma questão é o outro gatilho do
     mesmo bug — precisa sobreviver também */
  const depoisDeTocarTag = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    casaNivel="itens"; montarCasa();
    var tag=document.querySelector('[data-c="0"]');
    tag.onclick();
    return {hab:provaDoSim(sm).hab};
  })()`);
  ok(JSON.stringify(depoisDeTocarTag.hab) === JSON.stringify(antesDoConserto.hab),
     "e sobrevive também a tocar no rótulo do componente de uma questão");

  const fonte = require("fs").readFileSync(__dirname + "/index.html", "utf8");
  ok(/gab:g\[i\],desc:d\[i\],orig:x\.orig,hab:x\.hab,niv:x\.niv/.test(fonte),
     "a reconstrução da tela de itens agora leva hab e niv adiante");

  /* ═══ PARTE 2: a propagação da troca ═══ */

  const cenario = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=E.turmas[0];
    sm.titulo="1º Simulado SAEPE"; sm.etapa="3EM";
    pr.desc=["D17","D22","D22","D23","D24"];
    pr.hab=["","OLD_HAB_ID","","",""];   // a posição 1 tem hab da questão ANTIGA
    E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    sm.reserva={MAT:[{questao:{enunciado:"D22 nova",
      alternativas:["a","b","c","d","e"]}, gab:"C", desc:"D22", niv:6, orig:9}]};

    /* duas turmas irmãs, SEM matriz compartilhada — o caso comum:
       importadas turma por turma, não geradas juntas */
    var irmas=[];
    ["B","C"].forEach(function(L,k){
      var t2={id:"t"+(k+2), escola:t.escola, nome:"3º Ano "+L, serie:t.serie,
        ativa:true, disciplina:t.disciplina, disciplinas:t.disciplinas,
        periodo:t.periodo, alunos:t.alunos.slice(0,3).map(function(a){
          return {numero:a.numero, nome:a.nome+L, desde:1, ate:null};})};
      E.turmas.push(t2);
      var p2=JSON.parse(JSON.stringify(pr)); p2.id="p"+(k+2); p2.turma=t2.id;
      E.provas.push(p2);
      var s2=JSON.parse(JSON.stringify(sm)); s2.id="s"+(k+2); s2.turma=t2.id;
      s2.prova=p2.id; delete s2.matriz;
      E.simulados.push(s2); irmas.push(s2);
    });

    /* a turma B já tem um cartão corrigido */
    var tB=turmaDe(irmas[0].turma);
    registrar({numero:tB.alunos[0].numero, nome:"X",
      R:gabaritoDe(tB.nome,tB.alunos[0].numero).split(""), origem:"qr"});

    return {irmaosPorMatriz:irmaosDaMatriz(sm).length,
      irmaosPorSimulado:cadernosDoMesmoSimulado(sm).length};
  })()`);
  ok(cenario.irmaosPorMatriz === 0,
     "as turmas NÃO compartilham matriz — é como o professor de fato usa");
  ok(cenario.irmaosPorSimulado === 2,
     "mas são achadas por título+etapa (" + cenario.irmaosPorSimulado + ")");

  const troca = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var res=trocarQuestaoDoCaderno(sm,1);
    var irmas=cadernosDoMesmoSimulado(sm);
    return {ok:res.ok, cadernosAtualizados:res.cadernosAtualizados,
      enunciadoPrincipal:itensDoCaderno(pr)[1].questao.enunciado,
      enunciadosIrmas:irmas.map(function(s2){
        return itensDoCaderno(provaDoSim(s2))[1].questao.enunciado;}),
      descIrmas:irmas.map(function(s2){
        return itensDoCaderno(provaDoSim(s2))[1].desc;}),
      outrasPosicoesNaIrma0:itensDoCaderno(provaDoSim(irmas[0]))
        .filter(function(x,i){return i!==1;})
        .map(function(x){return x.questao.enunciado;}),
      habNaoHerdouAntiga:pr.hab[1]!=="OLD_HAB_ID"};
  })()`);
  ok(troca.ok === true, "a troca teve sucesso");
  ok(troca.cadernosAtualizados === 3,
     "e alcançou os 3 cadernos: o aberto mais os 2 irmãos");
  ok(troca.enunciadoPrincipal === "D22 nova",
     "a questão nova está no caderno principal");
  ok(troca.enunciadosIrmas.every(e => e === "D22 nova"),
     "e a MESMA questão está nos dois irmãos: " +
     troca.enunciadosIrmas.join(", "));
  ok(troca.descIrmas.every(d => d === "D22"),
     "com o descritor certo nos irmãos também");
  ok(JSON.stringify(troca.outrasPosicoesNaIrma0) ===
     JSON.stringify(["D17 q0","D22 q2","D23 q3","D24 q4"]),
     "e as outras quatro posições da turma irmã continuam exatamente " +
     "como estavam: " + troca.outrasPosicoesNaIrma0.join(" | "));
  ok(troca.habNaoHerdouAntiga,
     "a habilidade oficial da questão ANTIGA não foi carregada para a nova");

  /* a confirmação, ao clicar, precisa contar os cartões das turmas
     IRMÃS também — não só da que está na tela */
  ok(/somando as turmas que/.test(fonte),
     "a mensagem de confirmação avisa quando o cálculo soma outras turmas");
  ok(/cadernosAtualizados>1[\s\S]{0,80}alert\("Questão trocada em/.test(fonte),
     "e o professor é avisado quando a troca alcançou mais de um caderno");

  console.log(falhas ? "\nteste82: " + falhas + " FALHA(S)" : "\nteste82: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1500);
