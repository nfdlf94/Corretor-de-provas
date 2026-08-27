/* teste61.js — reorganizar as questões antes de acrescentar rascunho.

   A v50 prometeu: se a prova de um estudante coube em duas páginas, a
   turma inteira tem de caber em duas. A alavanca de então era só a
   LETRA — descer um degrau até o pior caso alcançar o melhor. Quando a
   letra não bastava, o app desistia e nivelava com uma folha de
   rascunho em branco.

   E a letra às vezes não basta. A diferença de página quase sempre vem
   de um bloco que não se divide — uma figura de 50 mm que não cabe no pé
   de uma coluna e abre uma página inteira. Se ela cai num lugar ruim
   para o estudante 07 e num lugar bom para o 01, os dois recebem
   cadernos de tamanhos diferentes, e reduzir o corpo não muda isso.

   O que muda é a ORDEM. O tempero é um número somado à chave de
   embaralhamento: trocá-lo reembaralha todos os cadernos de uma vez, sem
   mexer numa vírgula do conteúdo. O app experimenta temperos até achar
   um em que a turma inteira cabe no melhor número de páginas.

   O RISCO, e é sério: o tempero define qual reorganização foi impressa.
   Se a correção não usar o mesmo, ela reconstrói outra ordem e lê todas
   as respostas trocadas. Metade deste teste é sobre isso. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(12), {nLP:0, nMAT:10}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste61 — reorganização antes do rascunho");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");
  const Emb = require("./embaralho.js");
  global.chaveDeOrdem = Emb.chaveDeOrdem;
  global.embaralharProva = Emb.embaralharProva;
  global.embaralharEmBlocos = Emb.embaralharEmBlocos;

  /* ── 1. o tempero entra pela chave ── */
  ok(G.comTempero("07", 0) === "07",
     "tempero 0 não mexe na chave — é o padrão, e nada muda");
  ok(G.comTempero("07", null) === "07", "nem tempero ausente");
  ok(G.comTempero("07", 3) !== "07",
     "tempero 3 muda a chave: " + G.comTempero("07", 3));
  ok(G.comTempero("07", 3) === G.comTempero("07", 3),
     "e é determinístico");
  ok(G.comTempero("07", 3) !== G.comTempero("07", 4),
     "temperos diferentes, chaves diferentes");

  const fonte = require("fs").readFileSync(__dirname + "/embaralho.js", "utf8");
  ok(!/tempero/i.test(fonte),
     "embaralho.js não foi tocado — ele é espelho de embaralho.py e " +
     "continua valendo palavra por palavra");

  /* ── 2. trocar o tempero reembaralha de verdade ── */
  const ordens = [0,1,2,3,4].map(t =>
    G.ordemDaProva(10, 5, "3A", G.comTempero("07", t), null, false, []));
  ok(ordens.every(o => o.oq.length === 10),
     "toda ordem tem as dez questões");
  ok(ordens.every(o => new Set(o.oq).size === 10),
     "e nenhuma repete questão — continua sendo uma permutação");
  const distintas = new Set(ordens.map(o => o.oq.join(",")));
  ok(distintas.size >= 4,
     distintas.size + " ordens diferentes em 5 temperos — a alavanca " +
     "existe de verdade");
  ok(ordens[0].oq.join(",") ===
     G.ordemDaProva(10, 5, "3A", "07", null, false, []).oq.join(","),
     "e o tempero 0 devolve exatamente a ordem de sempre");

  /* ── 3. a correção tem de usar o MESMO tempero ── */
  win.eval(`(function(){
    var p=E.provas[0];
    p.nq=10; p.no=5; p.gabC="ACEBDACEBD"; p.tempero=0;
    p.questoes=[];
    for(var i=0;i<10;i++)
      p.questoes.push({enunciado:"Questao "+(i+1)+"?",
        alternativas:["a","b","c","d","e"], correta:null, imagem:null});
    aplicarLayout(p.nq,p.no); E.ativa=p.id;
  })()`);

  const roundTrip = tempero => J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), fora=[];
    p.tempero=${tempero};
    t.alunos.forEach(function(a){
      var gab=gabaritoDe(t.nome,a.numero);          // o que sai impresso no QR
      var reg=registrar({numero:a.numero,nome:a.nome,R:gab.split(""),origem:"qr"});
      fora.push({n:a.numero, gab:gab, acertos:reg.acertos});
    });
    E.res=E.res.filter(function(r){return r.prova!==p.id;});
    return fora;
  })()`);

  const semTempero = roundTrip(0);
  const comTempero3 = roundTrip(3);
  ok(semTempero.every(r => r.acertos === 10),
     "com tempero 0, quem marca o gabarito impresso tira 10 de 10");
  ok(comTempero3.every(r => r.acertos === 10),
     "com tempero 3 também — a correção acompanhou a reorganização");
  const mudou = semTempero.filter((r, i) => r.gab !== comTempero3[i].gab).length;
  ok(mudou >= 8,
     mudou + " dos 12 estudantes receberam gabarito diferente com o outro " +
     "tempero — não é um número decorativo");

  /* e se a correção ESQUECER o tempero, tudo desanda: é a prova de que
     `ordemDe` precisa lê-lo da prova */
  const esquecendo = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), erros=0;
    p.tempero=3;
    t.alunos.forEach(function(a){
      var impresso=gabaritoDe(t.nome,a.numero);
      var chave=chaveDeOrdem(a.numero,tiposDe(p));
      var o=ordemDaProva(p.nq,p.no,t.nome,chave,null,alternaBlocos(p),
        indicesFixos(p.questoes));                  // SEM o tempero
      var LET=LAY.options, semTemp="";
      for(var i=0;i<p.nq;i++){
        var certa=LET.indexOf(p.gabC[o.oq[i]]);
        semTemp+=LET[o.oa[i].indexOf(certa)];
      }
      for(var i=0;i<p.nq;i++) if(semTemp[i]!==impresso[i]) erros++;
    });
    p.tempero=0;
    return erros;
  })()`);
  ok(esquecendo > 20,
     esquecendo + " respostas seriam lidas erradas se a correção " +
     "ignorasse o tempero — por isso ele fica gravado na prova");

  /* ── 4. a prova guarda a reorganização ── */
  const grava = J(`(function(){
    var p=provaAtiva(); p.tempero=0;
    var mudou1=fixarTempero(p,{temperoUsado:5});
    var antes=p.tempero;
    var mudou2=fixarTempero(p,{temperoUsado:5});   // de novo, mesmo valor
    var mudou3=fixarTempero(p,{});                 // sem tempero no doc
    return {mudou1:mudou1, antes:antes, mudou2:mudou2, mudou3:mudou3, fim:p.tempero};
  })()`);
  ok(grava.mudou1 === true && grava.antes === 5, "o tempero escolhido é gravado");
  ok(grava.mudou2 === false, "gravar o mesmo valor de novo não mexe em nada");
  ok(grava.mudou3 === false && grava.fim === 5,
     "e um doc sem tempero não apaga o que estava lá");

  /* ── 5. prova já corrigida NÃO pode ser reorganizada ── */
  const trava = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma);
    p.tempero=0;
    var livre=!temResultados(p);
    registrar({numero:t.alunos[0].numero,nome:t.alunos[0].nome,
      R:gabaritoDe(t.nome,t.alunos[0].numero).split(""),origem:"qr"});
    var preso=!temResultados(p);
    E.res=E.res.filter(function(r){return r.prova!==p.id;});
    return {livre:livre, preso:preso};
  })()`);
  ok(grava && trava.livre === true,
     "sem cartão corrigido, a busca por reorganização é permitida");
  ok(trava.preso === false,
     "com um cartão corrigido, ela é BLOQUEADA — trocar a ordem depois de " +
     "imprimir invalidaria o caderno que está na mão do estudante");

  /* e o gerador respeita a trava */
  const respeitou = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma);
    p.tempero=2;
    var cfg={codigo:p.codigo,titulo:"T",escola:"E",turma:t.nome,disciplina:"M",
      professor:"N",gabaritoCanonico:p.gabC,no:p.no,questoes:p.questoes,
      discursivas:[],comps:null,alternarBlocos:false,tipos:0,
      tempero:2, permitirTempero:false};
    var d=gerarProvas(cfg,t.alunos,window.jspdf.jsPDF);
    return {usado:d.temperoUsado, reembaralhou:!!d.reembaralhou};
  })()`);
  ok(respeitou.usado === 2 && !respeitou.reembaralhou,
     "com a busca bloqueada, o gerador mantém o tempero gravado (" +
     respeitou.usado + ")");

  /* ── 6. a busca acontece, e é o ÚLTIMO recurso ── */
  ok(typeof G.TEMPEROS === "number" && G.TEMPEROS > 0,
     "o app experimenta até " + G.TEMPEROS + " reorganizações");
  const ordemDosRecursos = require("fs")
    .readFileSync(__dirname + "/gerador.js", "utf8");
  const iBusca = ordemDosRecursos.indexOf("nivelar por BAIXO");
  const iRasc  = ordemDosRecursos.indexOf("── tiragem pareja");
  ok(iBusca > 0, "a busca por tiragem pareja existe");
  ok(iRasc > iBusca,
     "e a folha de rascunho vem DEPOIS dela — é o último recurso, não o " +
     "primeiro");
  /* dentro da busca, a preferência é: menos páginas, letra maior,
     espaçamento folgado, tempero menor */
  const trecho = ordemDosRecursos.slice(iBusca, iRasc);
  ok(/for\(const fs of escada\)[\s\S]*for\(const denso of modos\)[\s\S]*for\(let t = temperoBase/
     .test(trecho),
     "e ela varre letra por fora, espaçamento no meio e tempero por " +
     "dentro — a letra maior e o espaçamento folgado ganham do tempero " +
     "menor, que não custa nada ao leitor");

  console.log(falhas ? "\nteste61: " + falhas + " FALHA(S)" : "\nteste61: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
