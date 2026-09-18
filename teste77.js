/* teste77.js — o QR impresso manda sobre o cálculo de hoje.

   O professor mandou três coisas do MESMO simulado: a prova impressa, o
   arquivo que subiu e a planilha de gabaritos. O app avisava:

     "O gabarito impresso no QR deste caderno é de uma versão anterior do
      app e diverge nas questões 1,2,3,4,5,7,9,10. Estou usando o gabarito
      atual, que é o mesmo da planilha."

   Oito de dez questões. E as provas já estavam impressas.

   A decisão da v53 — "quando o app conhece a prova, o cálculo atual
   manda" — estava errada. O QR é impresso NA MESMA FOLHA das questões, no
   mesmo instante, pela mesma versão do app: ele não pode estar
   dessincronizado com o papel que o estudante respondeu. Se o cálculo de
   hoje dá outra permutação, é o cálculo de hoje que está errado PARA
   AQUELA FOLHA — e corrigir por ele é comparar as marcações com o
   gabarito de uma prova que ninguém recebeu.

   Existe um caso em que o cálculo deve mandar: o professor consertou o
   gabarito CANÔNICO depois de imprimir. Aí a permutação é a mesma e só as
   letras mudaram. `pr.impressao` (gravado ao gerar o PDF) é o que permite
   separar os dois casos. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.comSimulado(H.estadoBase(6), {nLP:0, nMAT:10}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste77 — o QR impresso manda");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const base = J(`(function(){
    var p=E.provas[0], t=turmaDe(p.turma);
    p.simulado=null; p.comps=null;      // avaliação comum, como a do 8º ano
    p.nq=10; p.no=5; p.gabC="BDDAEACBEC";
    p.questoes=[]; for(var i=0;i<10;i++)
      p.questoes.push({enunciado:"Q"+(i+1),
        alternativas:["a","b","c","d","e"], correta:null, imagem:null});
    E.ativa=p.id; aplicarLayout(p.nq,p.no);
    return {gabC:p.gabC, aluno:gabaritoDe(t.nome,"01"), turma:t.nome};
  })()`);
  ok(base.aluno && base.aluno.length === 10,
     "o estudante 01 recebe o gabarito individual " + base.aluno);

  /* ── 1. sem divergência, nada muda ── */
  const igual = J(`(function(){
    var t=turmaDe(E.provas[0].turma);
    var g=gabaritoDe(t.nome,"01");
    return gabaritoVigente(t.nome,"01",g);
  })()`);
  ok(igual.origem === "app" && igual.divergem.length === 0,
     "QR e cálculo iguais: sem divergência");

  /* ── 2. a REGRA mudou: o QR manda ── */
  /* simula o caderno impresso por uma versão cuja permutação era outra */
  const regraMudou = J(`(function(){
    var t=turmaDe(E.provas[0].turma), p=E.provas[0];
    delete p.impressao;
    var g=gabaritoDe(t.nome,"01").split("");
    /* uma permutação DIFERENTE, como a de uma versão anterior */
    var qr=g.slice().reverse().join("");
    var v=gabaritoVigente(t.nome,"01",qr);
    return {origem:v.origem, gab:v.gab, qr:qr, calc:g.join(""),
            n:v.divergem.length, motivo:v.motivo};
  })()`);
  ok(regraMudou.origem === "qr-impresso",
     "com a permutação diferente, quem manda é o QR (" +
     regraMudou.origem + ")");
  ok(regraMudou.gab === regraMudou.qr,
     "o gabarito usado é o do QR (" + regraMudou.gab + "), não o " +
     "recalculado (" + regraMudou.calc + ")");
  ok(/permutação impressa nesta folha/.test(regraMudou.motivo||""),
     "e o motivo é dito: " + regraMudou.motivo);

  /* ── 3. o professor corrigiu o CANÔNICO: o cálculo manda ── */
  /* aqui a permutação é a mesma; só as letras do gabarito mudaram */
  const canonicoCorrigido = J(`(function(){
    var t=turmaDe(E.provas[0].turma), p=E.provas[0];
    var antigo="BDDAEACBEC";
    p.gabC=antigo;
    var qr=gabaritoDe(t.nome,"01");        // QR gerado com o canônico antigo
    p.impressao={gabC:antigo, regra:REGRA_GABARITO, quando:1, versao:"v84"};
    /* agora o professor conserta a questão 3 */
    p.gabC="BDAAEACBEC";
    var v=gabaritoVigente(t.nome,"01",qr);
    return {origem:v.origem, usou:v.gab, qr:qr,
            calc:gabaritoDe(t.nome,"01"), motivo:v.motivo,
            n:v.divergem.length};
  })()`);
  ok(canonicoCorrigido.origem === "app-corrigido",
     "quando só o canônico mudou, o cálculo manda (" +
     canonicoCorrigido.origem + ")");
  ok(canonicoCorrigido.usou === canonicoCorrigido.calc,
     "usando o gabarito corrigido (" + canonicoCorrigido.usou +
     ") no lugar do impresso (" + canonicoCorrigido.qr + ")");
  ok(canonicoCorrigido.n <= 2,
     "e a divergência é pequena — " + canonicoCorrigido.n +
     " questão(ões) —, que é a assinatura desse caso");
  ok(/corrigido depois da impressão/.test(canonicoCorrigido.motivo||""),
     "com o motivo certo: " + canonicoCorrigido.motivo);

  /* ── 4. sem registro de impressão, o QR manda ── */
  /* é o caso das provas que já estavam impressas quando isto foi escrito:
     não há como saber o que mudou, e a folha é a única verdade física */
  const semRegistro = J(`(function(){
    var t=turmaDe(E.provas[0].turma), p=E.provas[0];
    delete p.impressao;
    p.gabC="BDAAEACBEC";
    var qr=gabaritoDe(t.nome,"01").split("").reverse().join("");
    var v=gabaritoVigente(t.nome,"01",qr);
    return {origem:v.origem, usou:v.gab, qr:qr};
  })()`);
  ok(semRegistro.origem === "qr-impresso" && semRegistro.usou === semRegistro.qr,
     "sem registro da impressão, o QR manda — a folha é a única verdade " +
     "física disponível");

  /* ── 5. o registro é gravado ao gerar o PDF ── */
  const fonte = require("fs").readFileSync(__dirname + "/index.html", "utf8");
  ok(/p\.impressao=\{gabC:p\.gabC, regra:REGRA_GABARITO/.test(fonte),
     "gerar o PDF grava o canônico e a regra em vigor naquele momento");
  ok(/Estou corrigindo pelo QR, que é o gabarito da folha/.test(fonte),
     "e a mensagem diz o que está sendo usado e por quê");
  ok(/Baixe a planilha de gabaritos de novo/.test(fonte),
     "avisando que a planilha antiga pode estar na outra ordem");
  ok(!/que é o mesmo da planilha/.test(fonte),
     "a frase antiga, que afirmava sem verificar, saiu");

  console.log(falhas ? "\nteste77: " + falhas + " FALHA(S)" : "\nteste77: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1000);
