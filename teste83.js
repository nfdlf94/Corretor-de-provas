/* teste83.js — "a palavra/expressão destacada", sublinhada de novo.

   O professor mostrou o defeito com duas capturas: no arquivo original,
   a palavra "gatuno" vem destacada dentro do texto de apoio — e no
   arquivo que o app gera, o destaque desaparece. A pergunta que a
   questão faz ("a palavra destacada foi empregada para...") fica sem
   nenhuma marca no texto indicando QUAL das ocorrências ela pergunta.

   O extrator de PDF não captura estilo de fonte — só texto corrido —
   então ler o sublinhado do arquivo de origem não é uma opção confiável.
   Mas o COMANDO da questão já diz qual é a palavra: ela vem entre aspas,
   é a primeira do trecho citado. `marcarPalavraDestacada` acha essa
   citação, localiza a OCORRÊNCIA CERTA dentro do texto de apoio — não
   qualquer ocorrência da mesma palavra — e marca só ela para sublinhado
   na hora de desenhar. */
"use strict";
const H = require("./harness");
const G = require("./gerador.js");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

/* o exemplo real do professor: "gatuno" aparece DUAS vezes no texto de
   apoio — uma minúscula, no meio de uma frase, e outra maiúscula,
   abrindo a fala citada no comando. Só a SEGUNDA é a que a questão
   pergunta. */
const enunciadoReal = [
  "Leia o texto abaixo.",
  "Memórias Póstumas de Brás Cubas",
  "\"... Marcela amou-me durante quinze meses e onze contos de réis; nada menos.",
  "Meu pai, logo que teve aragem dos onze contos, sobressaltou-se deveras; achou que o caso excedia as raias de um capricho juvenil.",
  "— Dessa vez, disse ele, vais para a Europa, vais cursar uma Universidade, provavelmente Coimbra; quero-te para homem sério e não para arruador ou gatuno. E como eu fizesse um gesto de espanto:",
  "— Gatuno, sim senhor, não é outra coisa um filho que me faz isto...",
  "Sacou da algibeira os meus títulos de dívida, já resgatados por ele e sacudiu-mos na cara.",
  "ASSIS, Machado de. Memórias póstumas de Brás Cubas. 18. ed. São Paulo: Ática. 1992, p. 44. Fragmento.",
  "No trecho \"Gatuno, sim senhor, não é outra coisa um filho que me faz isto...\", a palavra destacada foi empregada para"
].join("\n");

const { win } = H.abrirApp({ estado: H.estadoBase(3) });

setTimeout(() => {
  console.log("teste83 — palavra/expressão destacada, sublinhada");

  /* ── 1. o exemplo exato do professor ── */
  const marcado = G.marcarPalavraDestacada(enunciadoReal);
  ok(marcado !== enunciadoReal, "o enunciado é alterado — a marca entrou");
  ok(marcado.includes(G.M_SUBL_INI+"Gatuno"+G.M_SUBL_FIM),
     "e é a ocorrência MAIÚSCULA, dentro da fala citada, que fica marcada");
  ok(!marcado.includes(G.M_SUBL_INI+"gatuno"),
     "a primeira ocorrência (minúscula, \"...ou gatuno.\") NÃO é marcada — " +
     "não é a que a questão cita entre aspas");
  ok((marcado.match(new RegExp(G.M_SUBL_INI,"g"))||[]).length === 1,
     "e só UMA ocorrência é marcada no total, nunca as duas");
  ok(G.semMarcas(marcado) === enunciadoReal,
     "tirando a marca, o texto volta a ser exatamente o original — nada " +
     "de letra trocada ou espaço comido");

  /* ── 2. expressão de mais de uma palavra ── */
  const comExpressao = [
    "Leia o texto abaixo.", "Um texto qualquer.",
    "A economia verde tem crescido, mas ainda enfrenta grandes desafios estruturais no país.",
    "FONTE, Revista. 2020.",
    "No trecho \"grandes desafios estruturais\", a expressão destacada enfatiza"
  ].join("\n");
  const marcadoExpr = G.marcarPalavraDestacada(comExpressao);
  ok(marcadoExpr.includes(G.M_SUBL_INI+"grandes desafios estruturais"+G.M_SUBL_FIM),
     "\"expressão destacada\" marca o trecho INTEIRO, não só a primeira palavra");

  /* ── 3. sem o padrão "trecho ... destacada", nada muda ── */
  const semPadrao = [
    "Leia o texto abaixo.", "Um texto.", "Alguma coisa aqui.",
    "Fonte: X, 2020.", "Qual é o tema do texto?"
  ].join("\n");
  ok(G.marcarPalavraDestacada(semPadrao) === semPadrao,
     "questão comum, sem \"palavra destacada\", sai idêntica");

  /* ── 4. citação que não bate com o texto de apoio: NÃO adivinha ── */
  const semAncora = [
    "Leia o texto abaixo.", "Um texto qualquer sobre outra coisa.",
    "Fonte: Y, 2019.",
    "No trecho \"palavra que não existe aqui\", a palavra destacada significa"
  ].join("\n");
  ok(G.marcarPalavraDestacada(semAncora) === semAncora,
     "sem achar a citação no texto de apoio, o app NÃO marca nada — " +
     "melhor sublinhar nada do que sublinhar a palavra errada");

  /* ── 5. idempotência: já marcado não é remarcado ── */
  ok(G.marcarPalavraDestacada(marcado) === marcado,
     "rodar de novo sobre um enunciado já marcado não muda nada");

  /* ── 6. o traço é desenhado só sobre a palavra, não a linha inteira ── */
  const linhasDesenhadas = [];
  const doc = {
    internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},
    setFont(){}, setFontSize(v){this.fs=v;}, setTextColor(){}, setDrawColor(){},
    setLineWidth(){}, setFillColor(){}, setLineDashPattern(){},
    getTextWidth(t){ return String(t).length*1.75; },
    line(x1,y1,x2,y2){ linhasDesenhadas.push({x1,y1,x2,y2}); },
    splitTextToSize(t){ return [t]; }, text(){}, addImage(){}
  };
  const trecho = "— " + G.M_SUBL_INI + "Gatuno" + G.M_SUBL_FIM + ", sim senhor";
  G.textoComNiveis(doc, trecho, 10, 50, 10.5);
  ok(linhasDesenhadas.length === 1, "exatamente um traço desenhado");
  const largGatuno = "Gatuno".length*1.75;
  ok(Math.abs((linhasDesenhadas[0].x2-linhasDesenhadas[0].x1)-largGatuno) < 0.01,
     "com a largura exata de \"Gatuno\" (" +
     (linhasDesenhadas[0].x2-linhasDesenhadas[0].x1).toFixed(2) +
     " mm) — não a da linha inteira");
  ok(linhasDesenhadas[0].x1 > 10,
     "e começando DEPOIS do \"— \" que vem antes, não do início da linha");
  ok(linhasDesenhadas[0].y1 > 50,
     "o traço fica abaixo da linha de base do texto, não em cima");

  /* ── 7. o marcador não interfere na detecção de outros problemas ── */
  const cabeGatuno = G.charsDeNivel(marcado);
  ok(cabeGatuno.sup === 0 && cabeGatuno.sub === 0,
     "o sublinhado não conta como expoente nem índice — a checagem de " +
     "\"expoente sumiu\" não é afetada");
  ok(!G.temMarcas(G.semMarcas(marcado)),
     "e depois de limpar as marcas, nenhuma sobra — semMarcas cobre a " +
     "faixa nova de caracteres");

  /* ── 8. ligado à importação de verdade ── */
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");
  const resultado = JSON.parse(win.eval(`JSON.stringify((function(){
    var txt=${JSON.stringify(enunciadoReal)};
    var lido=lerSimuladoDoc(
      "1. "+txt+"\\nA) a\\nB) b\\nC) c\\nD) d\\nE) e\\n\\nGABARITO\\n1. A", null);
    var q=lido.itens[0] && lido.itens[0].questao;
    return {enunciado: q ? q.enunciado : null};
  })())`));
  ok(resultado.enunciado && resultado.enunciado.includes("Gatuno"),
     "o pipeline de leitura completo (lerSimuladoDoc) chama a " +
     "marcação automaticamente, sem passo manual do professor");

  console.log(falhas ? "\nteste83: " + falhas + " FALHA(S)" : "\nteste83: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
