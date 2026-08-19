/* teste57.js — o QR do caderno impresso contra o cálculo de agora.

   Onde a investigação terminou: a tela de conferência mostrava
   `alunoQR.gab` — o gabarito que foi calculado quando a prova foi
   GERADA e ficou impresso dentro do QR. A planilha, essa sim, usa
   `gabaritoDe`, que calcula na hora. Enquanto a regra não muda, os dois
   dão o mesmo resultado.

   Só que a regra MUDOU: na v47/v51 as questões cujas alternativas estão
   dentro da figura pararam de embaralhar. Um caderno impresso antes
   disso carrega no QR um gabarito que não vale mais. A tela confiava
   nele; a planilha, não. Daí a mesma prova ter dois gabaritos
   igualmente oficiais e o professor não ter como saber qual seguir.

   Quando o app SABE a prova, quem manda é o cálculo de agora: o gabarito
   canônico é o que o professor conferiu e a regra atual é a correta. O
   QR continua sendo a saída para quando não há prova cadastrada — e a
   divergência é dita em voz alta, porque significa que o papel na mão
   saiu de uma versão anterior. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(6), {nLP:0, nMAT:10}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste57 — QR impresso × cálculo atual");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* a prova do relato: questões 3 e 6 com os gráficos dentro da imagem */
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

  /* o gabarito que teria sido impresso no QR pela versão ANTIGA */
  const dados = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), a=t.alunos[0], LET=LAY.options;
    var chave=chaveDeOrdem(a.numero,tiposDe(p));
    var o=ordemDaProva(p.nq,p.no,t.nome,chave,null,alternaBlocos(p),[]);
    var qrVelho="";
    for(var i=0;i<p.nq;i++){
      var certa=LET.indexOf(p.gabC[o.oq[i]]);
      qrVelho+=LET[o.oa[i].indexOf(certa)];
    }
    return {numero:a.numero, nome:a.nome, turma:t.nome,
      qrVelho:qrVelho, atual:gabaritoDe(t.nome,a.numero)};
  })()`);
  ok(dados.qrVelho !== dados.atual,
     "o QR de um caderno antigo diverge do cálculo de hoje: " +
     dados.qrVelho + " × " + dados.atual);

  /* ── 1. quem manda é o cálculo de agora ── */
  const v = J(`gabaritoVigente(${JSON.stringify(dados.turma)},
    ${JSON.stringify(dados.numero)}, ${JSON.stringify(dados.qrVelho)})`);
  ok(v.gab === dados.atual,
     "gabaritoVigente devolve o gabarito ATUAL, não o do QR");
  ok(v.origem === "app-diverge", "e marca que houve divergência");
  ok(v.divergem.length === 2,
     "apontando as duas questões gráficas (" + v.divergem.join(", ") + ")");

  /* QR igual ao cálculo: nada a dizer */
  const v2 = J(`gabaritoVigente(${JSON.stringify(dados.turma)},
    ${JSON.stringify(dados.numero)}, ${JSON.stringify(dados.atual)})`);
  ok(v2.origem === "app" && v2.divergem.length === 0,
     "caderno impresso pela versão atual: nenhum recado");

  /* sem QR, calcula */
  const v3 = J(`gabaritoVigente(${JSON.stringify(dados.turma)},
    ${JSON.stringify(dados.numero)}, "")`);
  ok(v3.gab === dados.atual && v3.origem === "app",
     "sem QR, usa o cálculo");

  /* sem prova cadastrada, o QR continua sendo a saída */
  const v4 = J(`(function(){
    var guarda=E.ativa; E.ativa=null;
    var r=gabaritoVigente("3A","01","ABCDEABCDE");
    E.ativa=guarda; return r;
  })()`);
  ok(v4.gab === "ABCDEABCDE" && v4.origem === "qr",
     "sem prova cadastrada, o QR é a autoridade — como sempre foi");

  /* ── 2. a correção usa o gabarito certo ── */
  /* a estudante respondeu seguindo a PLANILHA (o gabarito atual) e o
     caderno na mão foi impresso pela versão antiga */
  const reg = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), a=t.alunos[0];
    var certo=gabaritoDe(t.nome,a.numero);
    var r=registrar({numero:a.numero, nome:a.nome, gab:${JSON.stringify(dados.qrVelho)},
      R:certo.split(""), origem:"qr"});
    return {acertos:r.acertos, gab:r.gab, regra:r.regra};
  })()`);
  ok(reg.acertos === 10,
     "quem acertou tudo tira 10 de 10, mesmo com o QR velho no papel " +
     "(saiu " + reg.acertos + ")");
  ok(reg.gab === dados.atual,
     "o registro grava o gabarito atual, não o do QR");
  ok(reg.regra === require("./gerador.js").REGRA_GABARITO,
     "carimbado com a regra vigente");

  /* e quem seguiu o QR velho perde as duas — é o papel que está errado,
     e agora o app diz isso em vez de calar */
  const reg2 = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), a=t.alunos[1];
    var chave=chaveDeOrdem(a.numero,tiposDe(p)), LET=LAY.options;
    var o=ordemDaProva(p.nq,p.no,t.nome,chave,null,alternaBlocos(p),[]);
    var qrVelho="";
    for(var i=0;i<p.nq;i++){
      var certa=LET.indexOf(p.gabC[o.oq[i]]);
      qrVelho+=LET[o.oa[i].indexOf(certa)];
    }
    var r=registrar({numero:a.numero, nome:a.nome, gab:qrVelho,
      R:qrVelho.split(""), origem:"qr"});
    var v=gabaritoVigente(t.nome,a.numero,qrVelho);
    return {acertos:r.acertos, divergem:v.divergem};
  })()`);
  ok(reg2.acertos === 10 - reg2.divergem.length,
     "quem seguiu o QR velho erra exatamente as questões divergentes (" +
     reg2.acertos + " de 10)");

  /* ── 3. a tela e o salvar não podem discordar ── */
  /* `montarPainel` mostra o gabarito e `registrar` grava outro? era o
     defeito de origem: um lia do QR, o outro calculava */
  const coerente = J(`(function(){
    var p=provaAtiva(), t=turmaDe(p.turma), a=t.alunos[2];
    var qr="AAAAAAAAAA";
    var naTela=gabaritoVigente(t.nome,a.numero,qr).gab;
    var r=registrar({numero:a.numero,nome:a.nome,gab:qr,
      R:naTela.split(""),origem:"qr"});
    return {naTela:naTela, gravado:r.gab, acertos:r.acertos};
  })()`);
  ok(coerente.naTela === coerente.gravado,
     "o gabarito mostrado na conferência é o mesmo que o salvar grava");
  ok(coerente.acertos === 10,
     "então o que a tela mostra como acerto é acerto no registro");

  console.log(falhas ? "\nteste57: " + falhas + " FALHA(S)" : "\nteste57: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
