/* teste58.js — participação com uma nota por componente.

   O que mudou: a nota de participação era UMA só, do caderno inteiro.
   Agora são duas — uma de Português e uma de Matemática —, e o valor do
   simulado vale INTEIRO para cada uma. Se o simulado vale 1,5, são até
   1,5 de Português E até 1,5 de Matemática; não é 1,5 repartido entre os
   dois.

   Dentro de cada componente o valor se divide pelo número de questões
   DAQUELE componente: 1,25 em nove questões de Português dá 0,1389 por
   questão. A nota é proporcional aos acertos no componente, nunca no
   caderno inteiro.

   E no fim do período sai um PDF por turma, somando todos os simulados,
   com as duas notas de cada estudante. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };
const perto = (a, b, tol) => Math.abs(a - b) < (tol || 0.005);

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(5), {nLP:9, nMAT:11}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste58 — participação por componente");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* corrige a turma: o estudante i erra i questões */
  win.eval(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    sm.valorParticipacao=1.5; E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    t.alunos.forEach(function(a,i){
      var g=gabaritoDe(t.nome,a.numero); if(!g) return;
      var R=g.split("");
      for(var k=0;k<i;k++) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
  })()`);

  /* ── 1. o valor vale inteiro para cada componente ── */
  const base = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    return {valor:valorParticipacao(sm),
      nLP:itensDe(pr,"LP").length, nMAT:itensDe(pr,"MAT").length,
      porQLP:valorPorQuestao(sm,pr,"LP"), porQMAT:valorPorQuestao(sm,pr,"MAT")};
  })()`);
  ok(base.valor === 1.5, "o simulado vale 1,5");
  ok(base.nLP === 9 && base.nMAT === 11,
     "com 9 questões de Português e 11 de Matemática");
  ok(perto(base.porQLP, 1.5/9),
     "cada questão de Português vale 1,5 ÷ 9 = " + base.porQLP.toFixed(4));
  ok(perto(base.porQMAT, 1.5/11),
     "cada questão de Matemática vale 1,5 ÷ 11 = " + base.porQMAT.toFixed(4) +
     " — o divisor é o do COMPONENTE, não as 20 do caderno");
  ok(!perto(base.porQLP, base.porQMAT),
     "e as duas valem coisas diferentes, porque os componentes têm " +
     "quantidades diferentes de questões");
  ok(!perto(base.porQLP, 1.5/20),
     "nem uma nem outra vale 1,5 ÷ 20 — o valor não é repartido entre os " +
     "componentes");

  /* o exemplo do professor, com outro valor */
  const exemplo = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), antes=sm.valorParticipacao;
    sm.valorParticipacao=1.25;
    var v=valorPorQuestao(sm,pr,"LP");
    sm.valorParticipacao=antes;
    return v;
  })()`);
  ok(perto(exemplo, 1.25/9, 0.0001),
     "1,25 em nove questões de Português dá " + exemplo.toFixed(4) +
     " por questão");

  /* ── 2. quem acerta tudo leva o teto em cada um ── */
  const linhas = J(`participacaoDe(E.simulados[0]).map(function(L){
    return {n:L.aluno.numero,
      LP:{a:L.porComp.LP.acertos, t:L.porComp.LP.total, nota:L.porComp.LP.nota},
      MAT:{a:L.porComp.MAT.acertos, t:L.porComp.MAT.total, nota:L.porComp.MAT.nota}};
  })`);
  const primeiro = linhas[0];
  ok(primeiro.LP.nota === 1.5 && primeiro.MAT.nota === 1.5,
     "quem acertou tudo leva 1,5 de Português E 1,5 de Matemática — " +
     "3,0 no total, não 1,5");
  linhas.forEach(L => {
    ["LP","MAT"].forEach(c => {
      if(L[c].nota == null) return;
      const esperado = Math.round(1.5 * (L[c].a / L[c].t) * 100) / 100;
      if(!perto(L[c].nota, esperado)) falhas++;
    });
  });
  ok(true, "e todas as notas são proporcionais aos acertos do próprio " +
     "componente (" + linhas.length + " estudantes conferidos)");
  ok(linhas.every(L => L.LP.nota <= 1.5 && L.MAT.nota <= 1.5),
     "nenhuma passa do teto de 1,5");

  /* ── 3. lançamento à mão, por componente ── */
  const manual = J(`(function(){
    var sm=E.simulados[0], n=E.turmas[0].alunos[2].numero;
    gravarParticipacao(sm, n, 0.75, "LP");
    var L=participacaoDe(sm).find(function(x){return x.aluno.numero===n;});
    return {LP:L.porComp.LP.nota, LPman:L.porComp.LP.manual,
      MAT:L.porComp.MAT.nota, MATman:L.porComp.MAT.manual,
      MATcalc:L.porComp.MAT.calculada};
  })()`);
  ok(manual.LP === 0.75 && manual.LPman === 0.75,
     "a nota lançada à mão em Português vale");
  ok(manual.MATman === null && manual.MAT === manual.MATcalc,
     "e Matemática segue calculada — os dois lançamentos são independentes");

  const teto = J(`(function(){
    var sm=E.simulados[0], n=E.turmas[0].alunos[2].numero;
    gravarParticipacao(sm, n, 9, "LP");
    var L=participacaoDe(sm).find(function(x){return x.aluno.numero===n;});
    var v=L.porComp.LP.nota;
    gravarParticipacao(sm, n, null, "LP");
    var L2=participacaoDe(sm).find(function(x){return x.aluno.numero===n;});
    return {limitado:v, aoApagar:L2.porComp.LP.nota, calc:L2.porComp.LP.calculada};
  })()`);
  ok(teto.limitado === 1.5, "lançar 9 é limitado ao teto de 1,5");
  ok(teto.aoApagar === teto.calc, "apagar volta ao calculado");

  /* ── 4. o fechamento soma todos os simulados ── */
  /* segundo simulado da mesma turma, valendo 1,0 — montado pelo harness,
     que vive fora da página, e injetado no estado do app */
  const estado2 = H.comSimulado(
    JSON.parse(win.eval("JSON.stringify(E)")),
    {nLP:9, nMAT:11, id:"sim2", codigo:"SIM2"});
  win.eval("E.simulados=" + JSON.stringify(estado2.simulados) +
           "; E.provas=" + JSON.stringify(estado2.provas) + "; salvar();");
  const dois = J(`(function(){
    var t=E.turmas[0], sims=simuladosDa(t.id);
    var sm2=sims[sims.length-1];
    sm2.valorParticipacao=1;
    var pr2=provaDoSim(sm2); E.ativa=pr2.id; aplicarLayout(pr2.nq,pr2.no);
    /* só metade da turma faz o segundo */
    t.alunos.slice(0,3).forEach(function(a){
      var g=gabaritoDe(t.nome,a.numero); if(!g) return;
      registrar({numero:a.numero,nome:a.nome,R:g.split(""),origem:"qr"});
    });
    var ac=participacaoAcumulada(t.id);
    return {sims:ac.sims.length, maximo:ac.maximo,
      linhas:ac.linhas.map(function(L){
        return {n:L.aluno.numero, LP:L.comp.LP, MAT:L.comp.MAT,
          fez:L.det.filter(function(d){return d.fez;}).length};
      })};
  })()`);
  ok(dois.sims === 2, "os dois simulados entram no fechamento");
  ok(dois.maximo.LP === 2.5 && dois.maximo.MAT === 2.5,
     "o máximo vira 1,5 + 1,0 = 2,5 em cada componente (" +
     dois.maximo.LP + " e " + dois.maximo.MAT + ")");
  const quemFezOsDois = dois.linhas.find(L => L.fez === 2);
  ok(quemFezOsDois && perto(quemFezOsDois.LP, 2.5) === (quemFezOsDois.n === "01"),
     "quem acertou tudo nos dois chega ao máximo");
  const quemFezUm = dois.linhas.find(L => L.fez === 1);
  ok(quemFezUm && quemFezUm.LP < 2.5,
     "e quem faltou a um leva zero NELE — a nota é do período, faltar " +
     "conta (nº " + (quemFezUm ? quemFezUm.n : "-") + ": " +
     (quemFezUm ? quemFezUm.LP : "-") + " de 2,5)");
  ok(dois.linhas.every(L => L.LP <= 2.5 + 0.001 && L.MAT <= 2.5 + 0.001),
     "ninguém passa do máximo");

  /* ── 5. o PDF ── */
  const pdf = J(`(function(){
    var t=E.turmas[0];
    var doc=pdfParticipacao(t.id);
    if(!doc) return {erro:"sem doc"};
    var txt=doc.output("datauristring").length;
    return {paginas:doc.getNumberOfPages(), tamanho:txt};
  })()`);
  ok(!pdf.erro, "o PDF de fechamento é gerado");
  ok(pdf.paginas >= 1, pdf.paginas + " página(s)");
  ok(pdf.tamanho > 5000, "com conteúdo de verdade");

  const semNada = J(`(function(){
    var t={id:"tvazia"}; return pdfParticipacao("tvazia")===null;
  })()`);
  ok(semNada === true, "turma inexistente não gera PDF nem quebra");

  console.log(falhas ? "\nteste58: " + falhas + " FALHA(S)" : "\nteste58: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
