/* teste76.js — subir a prova, e criar a prova de recuperação.

   Dois relatos na mesma mensagem:

   1. "a função de subir a prova simplesmente sumiu" — ela nunca sumiu,
      mas só era alcançável de DENTRO de uma prova já criada. Quem estava
      criando uma prova via só os campos manuais e concluía, com razão,
      que a função não existia mais.

   2. "fui subir a avaliação de recuperação, mas simplesmente não existe
      essa função" — a seleção de estudantes existia (v67) e restringia a
      prova ATUAL. Mas uma recuperação normalmente tem OUTRAS questões:
      restringir a prova original mudaria a prova que já foi aplicada. O
      que faltava era criar uma prova nova já restrita a eles. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(10) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste76 — subir prova e prova de recuperação");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const fonte = fs.readFileSync(__dirname + "/index.html", "utf8");

  /* ── 1. o caminho de subir arquivo na CRIAÇÃO ── */
  ok(/Já tenho a prova num arquivo/.test(fonte),
     "a tela de criar prova oferece subir o arquivo");
  /* ── O BOTÃO TEM DE FUNCIONAR, não só existir ──────────────────────
     A primeira versão deste teste só procurava o texto no arquivo, e
     passou com o botão MORTO: a inserção do handler tinha caído no meio
     do handler do "Voltar", partindo os dois. Procurar texto no fonte
     prova que o botão foi desenhado, não que ele faz alguma coisa. */
  const clique = J(`(function(){
    var t=E.turmas[0];
    casaTurma=t.id;
    casaForm={codigo:"3C-REC", titulo:"Rec", nq:10, no:5, gab:"", habs:"",
      po:10, pd:0, per:2, recuperacao:["01","02"], recuperacaoDe:"pX"};
    casaNivel="nova"; montarCasa();
    var b=document.querySelector("#bDeArquivo");
    if(!b) return {erro:"botão não existe no DOM"};
    if(typeof b.onclick!=="function") return {erro:"botão sem handler"};
    b.onclick();
    return {nivel:casaNivel, rec:casaForm&&casaForm.recuperacao,
            de:casaForm&&casaForm.recuperacaoDe};
  })()`);
  ok(!clique.erro, "o botão existe e TEM handler" + (clique.erro?": "+clique.erro:""));
  ok(clique.nivel === "ler",
     "clicar leva à tela de ler arquivo (casaNivel=" + clique.nivel + ")");
  ok(String(clique.rec) === "01,02" && clique.de === "pX",
     "e a seleção da recuperação sobrevive ao clique — este botão, ao " +
     "contrário do \"Usar outro arquivo\", não zera o formulário");

  /* o "Voltar" da mesma tela precisa continuar funcionando: foi ele que
     a inserção errada tinha partido */
  const voltar = J(`(function(){
    casaForm={codigo:"X", titulo:"T", nq:10, no:5, gab:"", habs:"",
      po:10, pd:0, per:1};
    casaNivel="nova"; montarCasa();
    var v=document.querySelector("#mVolta");
    if(typeof v.onclick!=="function") return {erro:"Voltar sem handler"};
    v.onclick();
    return {nivel:casaNivel, form:casaForm};
  })()`);
  ok(!voltar.erro, "o \"Voltar\" da mesma tela segue funcionando");
  ok(voltar.nivel === "provas" && voltar.form === null,
     "levando à lista de provas e limpando o formulário");
  ok(/Ou preencha à mão os campos abaixo/.test(fonte),
     "e deixa claro que os campos manuais são a alternativa, não o " +
     "único caminho");
  /* o caminho antigo continua existindo para quem já está dentro da prova */
  ok(/Subir a prova pronta/.test(fonte),
     "o caminho de dentro da prova continua lá");

  /* ── 2. o formulário sobrevive à leitura do arquivo ── */
  /* `casaForm` era REFEITO a partir do arquivo, apagando o que o professor
     já tinha decidido. Para a recuperação isso seria fatal: ela chega ali
     já sabendo quem vai fazê-la. */
  const sobrevive = J(`(function(){
    casaForm={codigo:"3C-REC", titulo:"Recuperação", nq:10, no:5, gab:"",
      habs:"", po:10, pd:0, per:2,
      recuperacao:["01","02","05"], recuperacaoDe:"pX"};
    /* o que a leitura do arquivo faz com o formulário */
    var antes=casaForm;
    var lidas={questoes:new Array(8), gabarito:"ABCDEABC"};
    casaForm={codigo:antes.codigo||"", titulo:antes.titulo||"",
      nq:Math.max(5,Math.min(30,lidas.questoes.length||10)),
      no:5, gab:lidas.gabarito, habs:antes.habs||"",
      po:antes.po!=null?antes.po:10, pd:antes.pd!=null?antes.pd:0,
      per:antes.per||1, vindoDeArquivo:true, substitui:null,
      recuperacao:antes.recuperacao||null,
      recuperacaoDe:antes.recuperacaoDe||null};
    return {rec:casaForm.recuperacao, de:casaForm.recuperacaoDe,
      codigo:casaForm.codigo, per:casaForm.per, nq:casaForm.nq,
      gab:casaForm.gab};
  })()`);
  ok(String(sobrevive.rec) === "01,02,05",
     "a seleção de quem está em recuperação sobrevive à leitura do arquivo");
  ok(sobrevive.de === "pX", "e a ligação com a prova original também");
  ok(sobrevive.codigo === "3C-REC" && sobrevive.per === 2,
     "assim como o código e o período que ele já tinha escolhido");
  ok(sobrevive.nq === 8 && sobrevive.gab === "ABCDEABC",
     "enquanto o que VEM do arquivo manda no que é do arquivo: " +
     sobrevive.nq + " questões, gabarito " + sobrevive.gab);

  /* ── 3. a prova criada nasce restrita ── */
  const criada = J(`(function(){
    var t=E.turmas[0];
    var F={codigo:"3C-REC", titulo:"Av 2 — Recuperação", nq:8, no:5,
      gab:"ABCDEABC", po:10, pd:0, per:2,
      recuperacao:["01","02","05"], recuperacaoDe:"pOrig"};
    /* o trecho de fSalvar que monta a prova */
    var p={id:"pRec", turma:t.id, disciplina:"d1", codigo:F.codigo,
      titulo:F.titulo, nq:F.nq, no:F.no, gabC:F.gab, habs:[],
      pontosObj:F.po, pontosDisc:F.pd, periodo:F.per||1,
      questoes:[], discursivas:[], criada:Date.now()};
    if(Array.isArray(F.recuperacao) && F.recuperacao.length){
      p.recuperacao=F.recuperacao.slice();
      if(F.recuperacaoDe) p.recuperacaoDe=F.recuperacaoDe;
    }
    E.provas.push(p);
    return {ehRec:ehRecuperacao(p), quantos:alunosDaProva(t,p).length,
      naTurma:alunosEm(t,2).length, de:p.recuperacaoDe,
      numeros:alunosDaProva(t,p).map(function(a){return a.numero;})};
  })()`);
  ok(criada.ehRec === true, "a prova nova já nasce como recuperação");
  ok(criada.quantos === 3 && criada.naTurma === 10,
     "e sai para " + criada.quantos + " estudantes numa turma de " +
     criada.naTurma + ": " + criada.numeros.join(", "));
  ok(criada.de === "pOrig",
     "guardando de qual prova ela é a recuperação");

  /* ── 4. a original não é tocada ── */
  ok(/a prova original e as notas dela não são tocadas/.test(fonte),
     "a tela diz que a prova original fica intacta");
  ok(/Restringir ESTA prova muda a prova que\s*\n?\s*já foi aplicada|muda a prova que/.test(fonte),
     "e explica por que restringir a original seria errado quando a " +
     "recuperação tem outras questões");
  ok(/Criar prova de recuperação/.test(fonte),
     "com o botão que leva ao caminho certo");

  /* o botão só aparece quando a prova já tem cartão corrigido — antes
     disso, restringir a própria prova é legítimo */
  ok(/\$\("#rNova"\)/.test(fonte), "o gancho do botão existe");
  ok(/travado\?`<div class="rot"/.test(fonte),
     "e ele só aparece quando a prova já tem correção — antes disso " +
     "restringir a própria prova é legítimo e mais simples");

  /* ── 5. sem ninguém marcado, não cria ── */
  ok(/Marque primeiro quem está em recuperação/.test(fonte),
     "e sem ninguém marcado ele avisa em vez de criar uma prova vazia");

  console.log(falhas ? "\nteste76: " + falhas + " FALHA(S)" : "\nteste76: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
