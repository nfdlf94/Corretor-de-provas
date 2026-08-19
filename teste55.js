/* teste55.js — o estudante acerta tudo, o app tem de dar tudo certo.

   Relato: numa avaliação com DUAS questões de "assinale a alternativa
   cujo gráfico representa essa função", o professor respondeu todas
   corretamente e o app marcou essas duas como erradas — dizia que a
   certa era B quando o gabarito oficial e o caderno impresso diziam A.

   A v47 já tinha travado o embaralhamento dessas questões: como as cinco
   opções são cinco gráficos dentro de UMA imagem, e a imagem é a mesma
   para todos e não gira junto, permutar as letras faz o gabarito
   individual apontar para a bolha errada.

   O que escapou: `alternativasNaFigura` só reconhecia o caso em que o
   arquivo trazia "A)" a "E)" SEM TEXTO — cinco alternativas em branco.
   Quando o arquivo não traz alternativa nenhuma (o normal, porque as
   letras estão desenhadas dentro da imagem), a lista chega VAZIA, e o
   `if(!alts.length) return false` mandava a questão de volta para o
   embaralhamento.

   Este teste vai do gerador até a correção: monta a prova, descobre o
   que o estudante VÊ no papel, marca as respostas certas e confere que
   o app conta tudo como acerto. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.comSimulado(H.estadoBase(6),{nLP:0,nMAT:10}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste55 — o estudante acerta tudo e o app concorda");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");

  /* ── 1. as três formas de a questão gráfica chegar ── */
  const IMG = {dados:"d", w:1169, h:674};
  const base = {enunciado:"Uma função polinomial f do 1º grau é definida por " +
    "f(x) = −2x + 6.\nAssinale a alternativa cujo gráfico representa essa função."};

  ok(G.alternativasNaFigura(Object.assign({}, base,
      {alternativas:["","","","",""], imagem:IMG})) === true,
     "cinco alternativas em branco: travada (já era)");
  ok(G.alternativasNaFigura(Object.assign({}, base,
      {alternativas:[], imagem:IMG})) === true,
     "lista de alternativas VAZIA: travada — é o caso que escapava");
  ok(G.alternativasNaFigura(Object.assign({}, base, {imagem:IMG})) === true,
     "sem o campo alternativas: travada também");
  ok(G.alternativasNaFigura(Object.assign({}, base,
      {alternativas:["f(x) = 2x","b","c","d","e"], imagem:IMG})) === false,
     "gráfico de APOIO, com alternativas de texto: continua embaralhando");
  ok(G.alternativasNaFigura(Object.assign({}, base,
      {alternativas:[], imagem:null})) === false,
     "sem imagem: não é o caso, e não trava nada por acidente");

  /* ── 2. a prova do relato, de ponta a ponta ── */
  /* 10 questões, as de número 6 e 9 com os gráficos na imagem e SEM
     alternativa nenhuma no arquivo — exatamente como o professor
     importou */
  win.eval(`(function(){
    var p=E.provas[0];
    p.nq=10; p.no=5; p.gabC="ACEBDACEBD";
    p.questoes=[];
    for(var i=0;i<10;i++){
      if(i===5||i===8){
        p.questoes.push({enunciado:"Uma função polinomial f do 1º grau é definida "+
          "por f(x) = −2x + 6.\\nAssinale a alternativa cujo gráfico representa essa função.",
          alternativas:[], correta:null,
          imagem:{dados:"d", w:1169, h:674}});
      }else{
        p.questoes.push({enunciado:"Questão "+(i+1)+" de texto comum. Qual é a resposta?",
          alternativas:["primeira","segunda","terceira","quarta","quinta"],
          correta:null, imagem:null});
      }
    }
    aplicarLayout(p.nq,p.no);
    E.ativa=p.id;
  })()`);

  const fixas = J("indicesFixos(provaAtiva().questoes)");
  ok(fixas.join(",") === "5,8",
     "o app reconhece as duas questões gráficas (índices " + fixas.join(", ") + ")");

  /* Para cada estudante: descobre a ordem impressa, monta as respostas
     que um aluno que acertou TUDO marcaria, e confere a correção.

     Numa questão travada, o papel mostra os gráficos na ordem original,
     então a letra certa no papel é a MESMA do gabarito canônico. Numa
     questão embaralhada, é a letra que o gabarito individual indica. */
  const resultado = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), fora=[];
    t.alunos.forEach(function(a){
      var o=ordemDe(p,t.nome,a.numero);
      var gabInd=gabaritoDe(t.nome,a.numero);
      var LET=LAY.options;
      /* o que o estudante vê e marca, acertando tudo */
      var R=[];
      for(var i=0;i<p.nq;i++){
        var canon=p.gabC[o.oq[i]];
        if(indicesFixos(p.questoes).indexOf(o.oq[i])>=0){
          R.push(canon);                       // imagem não gira: letra canônica
        }else{
          R.push(LET[o.oa[i].indexOf(LET.indexOf(canon))]);
        }
      }
      var acertos=0, errou=[];
      for(var i=0;i<p.nq;i++){
        if(R[i]===gabInd[i]) acertos++;
        else errou.push({pos:i+1, canonica:o.oq[i]+1, marcou:R[i], app:gabInd[i]});
      }
      /* e a conversão de volta para o canônico tem de bater com o gabarito */
      var Rc=canonizar(R,t.nome,a.numero);
      var canonOk=true;
      for(var i=0;i<p.nq;i++) if(Rc[i]!==p.gabC[i]) canonOk=false;
      fora.push({numero:a.numero, acertos:acertos, errou:errou, canonOk:canonOk});
    });
    return fora;
  })()`);

  ok(resultado.length === 6, "seis estudantes conferidos");
  const perfeitos = resultado.filter(r => r.acertos === 10).length;
  ok(perfeitos === 6,
     "todos os seis tiram 10 de 10 — quem acertou tudo é contado como " +
     "tendo acertado tudo");
  const canonOk = resultado.every(r => r.canonOk);
  ok(canonOk, "e a conversão de volta para o gabarito canônico bate em todos");

  if(!perfeitos || !canonOk){
    resultado.filter(r => r.errou.length).slice(0, 3).forEach(r =>
      r.errou.forEach(e => console.log("         nº " + r.numero + ": questão " +
        e.pos + " (canônica " + e.canonica + ") marcou " + e.marcou +
        ", app esperava " + e.app)));
  }

  /* ── 3. a mesma prova ANTES da correção erraria ── */
  /* refaz a conta com a detecção antiga (só reconhece cinco em branco),
     para provar que o teste está exercitando o defeito e não passando
     por acaso */
  const comoEra = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), LET=LAY.options, ruins=0;
    var fixasAntigas=[];   // a regra antiga: lista vazia não travava
    p.questoes.forEach(function(q,i){
      var alts=q.alternativas||[];
      if(q.imagem && q.imagem.dados && alts.length &&
         alts.every(function(a){return !String(a==null?"":a).trim();}))
        fixasAntigas.push(i);
    });
    t.alunos.forEach(function(a){
      var chave=chaveDeOrdem(a.numero,tiposDe(p));
      var o=ordemDaProva(p.nq,p.no,t.nome,chave,null,alternaBlocos(p),fixasAntigas);
      for(var i=0;i<p.nq;i++){
        if(indicesFixos(p.questoes).indexOf(o.oq[i])<0) continue;
        var canon=p.gabC[o.oq[i]];
        var appEsperava=LET[o.oa[i].indexOf(LET.indexOf(canon))];
        if(appEsperava!==canon) ruins++;   // o papel mostra a letra canonica
      }
    });
    return {fixasAntigas:fixasAntigas, ruins:ruins};
  })()`);
  ok(comoEra.fixasAntigas.length === 0,
     "com a regra antiga, NENHUMA das duas era travada");
  ok(comoEra.ruins > 0,
     comoEra.ruins + " questões seriam marcadas como erradas mesmo " +
     "respondidas certo — é exatamente o relato");

  /* ── 4. o gráfico de apoio continua embaralhando ── */
  const apoio = J(`(function(){
    var p=provaAtiva();
    p.questoes[2].imagem={dados:"d",w:600,h:400};
    p.questoes[2].alternativas=["f(x) = 2x − 6","f(x) = −2x + 6","f(x) = 2x + 6",
      "f(x) = −2x − 6","f(x) = x − 6"];
    return indicesFixos(p.questoes);
  })()`);
  ok(apoio.join(",") === "5,8",
     "a questão com gráfico de apoio e alternativas de texto NÃO entra na " +
     "trava (" + apoio.join(", ") + ")");

  /* ── 5. o pre-flight explica em vez de acusar contagem ── */
  const av = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma);
    var cfg={escola:"E",disciplina:"Matemática",simulado:true,no:p.no,
      gabaritoCanonico:p.gabC,questoes:p.questoes,comps:null,
      rotulosComp:{}};
    var doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"});
    return preFlightCheck(cfg,doc,10);
  })()`);
  ok(av.some(a => /alternativas estão dentro da figura/.test(a)),
     "avisa que as opções estão na figura");
  ok(!av.some(a => /0 alternativas/.test(a)),
     "e NÃO acusa \"0 alternativas\" — não é erro, é o formato: " +
     av.filter(a => /alternativa/.test(a)).join(" / "));

  console.log(falhas ? "\nteste55: " + falhas + " FALHA(S)" : "\nteste55: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
