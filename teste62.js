/* teste62.js — prova de recuperação: só os estudantes indicados.

   A prova de recuperação é uma avaliação como qualquer outra — mesmo
   arquivo, mesmo gabarito, mesma correção. A ÚNICA diferença é o conjunto
   de estudantes que a recebe.

   Por isso o filtro entra num ponto só: `alunosDaProva`. É por lá que já
   passam as telas que perguntam "quem faz esta prova?" — gerar o PDF, os
   cartões, a planilha de gabaritos, os resultados, quem falta corrigir, a
   análise. Filtrar em cada uma seria onze lugares para esquecer um, e
   este teste confere que nenhum ficou de fora. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(10), {nLP:0, nMAT:8}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste62 — prova de recuperação");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* prova comum de 8 questões, turma de 10 */
  win.eval(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma);
    p.simulado=null; p.comps=null; p.periodo=1;
    p.nq=8; p.no=5; p.gabC="ACEBDACE";
    p.questoes=[];
    for(var i=0;i<8;i++)
      p.questoes.push({enunciado:"Questao "+(i+1)+". Qual e a resposta correta?",
        alternativas:["primeira","segunda","terceira","quarta","quinta"],
        correta:null, imagem:null});
    aplicarLayout(p.nq,p.no); E.ativa=p.id;
  })()`);

  /* ── 1. sem recuperação, é a turma inteira ── */
  const inteira = J(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma);
    return {ehRec:ehRecuperacao(p), quantos:alunosDaProva(t,p).length,
            naTurma:alunosEm(t,1).length};
  })()`);
  ok(inteira.ehRec === false, "prova sem lista não é de recuperação");
  ok(inteira.quantos === inteira.naTurma && inteira.quantos === 10,
     "e sai para a turma inteira (" + inteira.quantos + ")");

  /* ── 2. marcando três, só três ── */
  const tres = J(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma);
    p.recuperacao=["02","05","09"];
    var q=alunosDaProva(t,p);
    return {ehRec:ehRecuperacao(p), numeros:q.map(function(a){return a.numero;})};
  })()`);
  ok(tres.ehRec === true, "com a lista, a prova vira de recuperação");
  ok(tres.numeros.join(",") === "02,05,09",
     "e só os três indicados fazem a prova (" + tres.numeros.join(", ") + ")");

  /* ── 3. o PDF sai com três cadernos, não dez ── */
  const pdf = J(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma), e=escolaDe(t.escola);
    var cfg={codigo:p.codigo,titulo:"Recuperação",escola:e?e.nome:"",turma:t.nome,
      disciplina:"Matemática",professor:"N",periodoLabel:"1º Bimestre",
      gabaritoCanonico:p.gabC,no:p.no,questoes:p.questoes,discursivas:[],
      comps:null,alternarBlocos:false,tipos:0,simulado:false,
      tempero:p.tempero||0,permitirTempero:true};
    var quem=alunosDaProva(t,p);
    var d=gerarProvas(cfg,quem,window.jspdf.jsPDF);
    return {alunos:quem.length, paginas:d.getNumberOfPages(),
            porAluno:d.paginasPorAluno, deCada:d.paginasDeCada};
  })()`);
  ok(pdf.alunos === 3, "o PDF é montado para três estudantes");
  ok(pdf.paginas === pdf.porAluno * 3,
     "e tem exatamente páginas × 3 (" + pdf.paginas + ")");
  ok(new Set(pdf.deCada).size === 1,
     "a tiragem continua pareja entre eles (" + pdf.deCada.join(", ") + ")");

  /* ── 4. a correção não muda ── */
  /* a ordem é semeada por turma + número: o estudante 05 recebe a MESMA
     prova estando ou não em recuperação. É o que garante que corrigir
     uma recuperação é igual a corrigir qualquer avaliação. */
  const mesmaOrdem = J(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma);
    var comRec=gabaritoDe(t.nome,"05");
    delete p.recuperacao;
    var semRec=gabaritoDe(t.nome,"05");
    p.recuperacao=["02","05","09"];
    return {comRec:comRec, semRec:semRec};
  })()`);
  ok(mesmaOrdem.comRec === mesmaOrdem.semRec,
     "o gabarito do nº 05 é o mesmo com ou sem recuperação (" +
     mesmaOrdem.comRec + ") — a recuperação não mexe no embaralhamento");

  const corrige = J(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma);
    var a=t.alunos.filter(function(x){return x.numero==="05";})[0];
    var r=registrar({numero:a.numero,nome:a.nome,
      R:gabaritoDe(t.nome,a.numero).split(""),origem:"qr"});
    return {acertos:r.acertos, nq:p.nq};
  })()`);
  ok(corrige.acertos === corrige.nq,
     "e quem acerta tudo tira " + corrige.acertos + " de " + corrige.nq);

  /* ── 5. os resultados só cobram os três ── */
  const res = J(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma);
    return {esperados:alunosDaProva(t,p).length, feitos:resDa(p.id).length};
  })()`);
  ok(res.esperados === 3,
     "a tela de resultados espera três correções, não dez — os outros " +
     "sete não estão em recuperação e não devem aparecer como pendentes");
  ok(res.feitos === 1, "uma já foi corrigida");

  /* ── 6. a planilha de gabaritos também ── */
  const abas = J(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma);
    var a=abasGabaritoPorEstudante(p,t);
    /* cabeçalho + canônico + uma linha por estudante */
    return {linhas:a[0].linhas.length, nomes:a.map(function(x){return x.nome;})};
  })()`);
  ok(abas.linhas === 2 + 3,
     "a planilha traz cabeçalho, canônico e três estudantes (" +
     abas.linhas + " linhas)");

  /* ── 7. marcar a turma inteira é o mesmo que não ter recuperação ── */
  /* guardar a lista completa faria a prova "esquecer" quem entrasse na
     turma depois */
  const todos = J(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma);
    var numeros=alunosEm(t,1).map(function(a){return a.numero;});
    p.recuperacao=numeros.slice();
    var antes=alunosDaProva(t,p).length;
    /* é o que telaRecuperacao faz ao salvar */
    if(p.recuperacao.length===numeros.length) delete p.recuperacao;
    return {antes:antes, ehRec:ehRecuperacao(p), depois:alunosDaProva(t,p).length};
  })()`);
  ok(todos.antes === 10 && todos.depois === 10,
     "marcar todos dá o mesmo resultado");
  ok(todos.ehRec === false,
     "mas a prova deixa de ser de recuperação — senão um estudante novo " +
     "na turma ficaria de fora para sempre");

  /* ── 8. lista vazia não gera para ninguém ── */
  const vazia = J(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma);
    p.recuperacao=[];
    var r={ehRec:ehRecuperacao(p), quantos:alunosDaProva(t,p).length};
    delete p.recuperacao;
    return r;
  })()`);
  ok(vazia.ehRec === true && vazia.quantos === 0,
     "recuperação sem ninguém marcado não gera para a turma toda — gera " +
     "para ninguém, e o app avisa em vez de imprimir 40 provas por engano");

  console.log(falhas ? "\nteste62: " + falhas + " FALHA(S)" : "\nteste62: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
