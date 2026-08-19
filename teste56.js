/* teste56.js — a planilha baixada ontem discorda do app de hoje.

   Relato: a planilha "Gabarito por estudante", baixada do próprio app,
   dizia que o gabarito da estudante nº 01 era A A B D A A E D A C. A
   tela de conferência, no mesmo app, dizia A A A D A B E D A C. As duas
   discordam exatamente nas questões 3 e 6 — as duas questões cujas
   alternativas são gráficos dentro de uma imagem.

   Não é bug de cálculo: as duas saem da MESMA função `gabaritoDe`. É
   bug de VERSÃO. A planilha foi baixada antes da v51, quando essas
   questões ainda embaralhavam; a tela é depois, quando pararam. Os dois
   números parecem igualmente oficiais e nada no app dizia qual era o
   velho.

   A correção não é de conta, é de rastro:

   - `REGRA_GABARITO` marca a versão da transformação canônico → individual;
   - cada resultado corrigido guarda a regra com que foi conferido;
   - a tela de Resultados avisa quantas notas vieram de regra anterior e
     oferece refazer as contas SEM reescanear;
   - a planilha sai carimbada com data, versão e regra. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(6), {nLP:0, nMAT:10}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste56 — carimbo de regra e recálculo das notas antigas");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");
  ok(typeof G.REGRA_GABARITO === "number" && G.REGRA_GABARITO >= 2,
     "a regra do gabarito tem número de versão (" + G.REGRA_GABARITO + ")");

  /* monta a prova do relato: questões 3 e 6 com os gráficos na imagem */
  win.eval(`(function(){
    var p=E.provas[0];
    p.nq=10; p.no=5; p.gabC="ACEBDACEBD";
    p.questoes=[];
    for(var i=0;i<10;i++){
      if(i===2||i===5){
        p.questoes.push({enunciado:"Assinale a alternativa cujo gráfico representa essa função.",
          alternativas:[], correta:null, imagem:{dados:"d",w:1169,h:674}});
      }else{
        p.questoes.push({enunciado:"Questão "+(i+1)+". Qual é a resposta?",
          alternativas:["primeira","segunda","terceira","quarta","quinta"],
          correta:null, imagem:null});
      }
    }
    aplicarLayout(p.nq,p.no); E.ativa=p.id;
  })()`);

  /* ── 1. a divergência entre as duas regras ── */
  const comparacao = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), a=t.alunos[0], LET=LAY.options;
    var hoje=gabaritoDe(t.nome,a.numero);
    /* a regra ANTIGA: nada travado */
    var chave=chaveDeOrdem(a.numero,tiposDe(p));
    var o=ordemDaProva(p.nq,p.no,t.nome,chave,null,alternaBlocos(p),[]);
    var antes="";
    for(var i=0;i<p.nq;i++){
      var certa=LET.indexOf(p.gabC[o.oq[i]]);
      antes+=LET[o.oa[i].indexOf(certa)];
    }
    var difere=[];
    for(var i=0;i<p.nq;i++) if(hoje[i]!==antes[i]) difere.push(i+1);
    return {hoje:hoje, antes:antes, difere:difere, numero:a.numero};
  })()`);
  ok(comparacao.hoje !== comparacao.antes,
     "a regra nova e a antiga dão gabaritos diferentes para o mesmo " +
     "estudante: " + comparacao.antes + " → " + comparacao.hoje);
  ok(comparacao.difere.length > 0 && comparacao.difere.length <= 2,
     "e diferem SÓ nas questões gráficas (" + comparacao.difere.join(", ") +
     ") — é o desenho do conflito relatado");

  /* ── 2. um resultado gravado com a regra velha ── */
  win.eval(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), a=t.alunos[0];
    var LET=LAY.options, chave=chaveDeOrdem(a.numero,tiposDe(p));
    var o=ordemDaProva(p.nq,p.no,t.nome,chave,null,alternaBlocos(p),[]);
    var gabVelho="";
    for(var i=0;i<p.nq;i++){
      var certa=LET.indexOf(p.gabC[o.oq[i]]);
      gabVelho+=LET[o.oa[i].indexOf(certa)];
    }
    /* a estudante marcou exatamente o gabarito velho — acertou tudo,
       segundo a planilha que ela tinha em mãos */
    E.res.push({prova:p.id, turma:p.turma, numero:a.numero, nome:a.nome,
      R:gabVelho.split(""), Rc:[], gab:gabVelho, acertos:p.nq, erros:0,
      certas:[], erradas:[], notaDisc:0, nota:10, origem:"qr",
      t:Date.now()});          // SEM o campo regra: é registro antigo
  })()`);

  ok(J("resultadosComRegraVelha(provaAtiva())") === 1,
     "o app reconhece 1 nota conferida com regra anterior");
  ok(J("E.res[0].regra||1") === 1,
     "registro sem carimbo conta como regra 1");

  /* ── 3. refazer as contas conserta, sem reescanear ── */
  const depois = J(`(function(){
    var p=provaAtiva();
    var n=recalcular(p);
    var r=E.res[0];
    return {refeitas:n, mudaram:recalcular.mudaram, regra:r.regra,
      acertos:r.acertos, gab:r.gab, R:r.R.join("")};
  })()`);
  ok(depois.refeitas === 1, "uma nota reconferida");
  ok(depois.mudaram === 1, "e o app avisa que ela MUDOU");
  ok(depois.regra === G.REGRA_GABARITO, "o registro fica carimbado com a regra nova");
  ok(depois.gab === comparacao.hoje,
     "o gabarito gravado passa a ser o da regra nova (" + depois.gab + ")");
  ok(depois.R === comparacao.antes,
     "as marcações do papel NÃO foram tocadas (" + depois.R + ") — não " +
     "precisou reescanear");
  ok(depois.acertos === 10 - comparacao.difere.length,
     "e a nota reflete o que a estudante de fato marcou: " + depois.acertos +
     " de 10");
  ok(J("resultadosComRegraVelha(provaAtiva())") === 0,
     "não sobra nenhuma nota com regra anterior");

  /* refazer de novo não muda mais nada */
  const denovo = J(`(function(){ recalcular(provaAtiva());
    return {mudaram:recalcular.mudaram}; })()`);
  ok(denovo.mudaram === 0, "refazer outra vez não mexe em nada");

  /* ── 4. registro novo já nasce carimbado ── */
  const novo = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), a=t.alunos[1];
    var g=gabaritoDe(t.nome,a.numero);
    var reg=registrar({numero:a.numero, nome:a.nome, R:g.split(""), origem:"qr"});
    return {regra:reg.regra, acertos:reg.acertos};
  })()`);
  ok(novo.regra === G.REGRA_GABARITO, "quem é corrigido agora já nasce carimbado");
  ok(novo.acertos === 10,
     "e quem marca o gabarito de hoje tira 10 de 10");
  ok(J("resultadosComRegraVelha(provaAtiva())") === 0,
     "e não entra na lista de pendentes");

  /* ── 5. a planilha sai identificada ── */
  const abas = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma);
    return abasGabaritoPorEstudante(p,t);
  })()`);
  const txt = JSON.stringify(abas);
  ok(/Regra de gabarito/.test(txt),
     "a planilha leva o carimbo da regra de gabarito");
  ok(/Gerada em/.test(txt), "com data de geração");
  ok(/baixe-a de novo/.test(txt),
     "e o recado de que atualizar o app invalida a planilha baixada");
  /* o carimbo vem antes das linhas dos estudantes, para ser a primeira
     coisa que se lê ao abrir o arquivo */
  const linhas = abas[0].linhas;
  ok(/CANÔNICO/.test(JSON.stringify(linhas[1])),
     "o gabarito canônico segue na 2ª linha — o carimbo foi para uma aba " +
     "própria justamente para não custar uma linha aqui");
  ok(abas.some(x => /Sobre esta planilha/.test(x.nome)),
     "e existe a aba \"Sobre esta planilha\"");

  console.log(falhas ? "\nteste56: " + falhas + " FALHA(S)" : "\nteste56: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
