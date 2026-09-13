/* teste74.js — a matriz de Língua Portuguesa do 3º EM.

   O professor mandou a lista dos descritores corretos do SAEPE para LP, e
   ela não é a que o app tinha. O app trazia a matriz do SAEB — 21
   descritores com textos como "Identificar o tema de um texto" no D6 —,
   enquanto o SAEPE usa outra numeração e outra redação, com o D6 sendo
   "Localizar informação explícita em um texto".

   Consequência séria, e é sorte que não tenha acontecido: a normalização
   da v78 casa o TEXTO do arquivo com a matriz. Com a matriz errada, ela
   teria remapeado os códigos corretos do professor para os do SAEB. Não
   aconteceu porque as redações são diferentes o bastante para nenhum
   texto casar — o app deixou tudo como estava e declarou "sem par". A
   regra de não adivinhar por proximidade de número foi o que segurou.

   O `Caderno.pdf` que o professor enviou é de Matemática e não traz a
   lista de LP; a única fonte é ele. Matemática fica intocada, porque
   aquela sim foi conferida contra o documento oficial (v72). */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const G = require("./saepe-oficial.js");
const { win } = H.abrirApp({ estado: H.estadoBase(3) });

setTimeout(() => {
  console.log("teste74 — matriz de LP do 3º EM");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const lp = G.matrizDe("LP","3EM");

  /* ── 1. a lista do professor, na íntegra ── */
  const esperado = {
    D6:"Localizar informação explícita em um texto.",
    D7:"Inferir informação em um texto.",
    D8:"Inferir o sentido de palavra ou expressão a partir do contexto.",
    D9:"Identificar o tema central de um texto.",
    D10:"Distinguir fato de uma opinião.",
    D11:"Interpretar textos não verbais e textos que articulam elementos verbais e não verbais.",
    D12:"Identificar o gênero do texto.",
    D13:"Identificar a finalidade de diferentes gêneros textuais.",
    D14:"Reconhecer semelhanças e/ou diferenças de ideias e opiniões na comparação entre textos que tratam da mesma temática.",
    D16:"Estabelecer relação de causa e consequência entre partes de um texto.",
    D17:"Estabelecer relações lógico-discursivas entre partes de um texto, marcadas por locuções adverbiais, advérbios, conjunções e locuções conjuntivas.",
    D18:"Reconhecer relações entre partes de um texto, identificando os recursos coesivos que contribuem para sua continuidade (substituições e repetições).",
    D19:"Identificar a tese de um texto.",
    D21:"Reconhecer o conflito gerador do enredo e os elementos de uma narrativa.",
    D22:"Identificar efeitos de humor no texto.",
    D23:"Identificar efeitos de sentido decorrente do uso de pontuação e outras notações.",
    D24:"Reconhecer o efeito de sentido decorrente do emprego de recursos estilísticos e morfossintáticos.",
    D25:"Reconhecer o efeito de sentido decorrente da escolha de palavras, frases ou expressões.",
    D26:"Identificar as marcas linguísticas que evidenciam o locutor e/ou o interlocutor.",
    D27:"Diferenciar as partes principais das secundárias em um texto."
  };
  const cods = Object.keys(esperado);
  ok(Object.keys(lp).length === cods.length,
     "a matriz tem " + Object.keys(lp).length + " descritores");
  let iguais = 0;
  cods.forEach(c => { if(lp[c] === esperado[c]) iguais++; });
  ok(iguais === cods.length,
     "e os " + iguais + " textos batem palavra por palavra com a lista do " +
     "professor");

  /* ── 2. a numeração tem buracos, e isso é deliberado ── */
  /* A lista não traz D15 nem D20. Não é erro de transcrição a corrigir: é
     a matriz que pula esses códigos nesta etapa, e inventar um texto para
     eles seria pior que a ausência. */
  ok(!lp.D15 && !lp.D20,
     "D15 e D20 não existem nesta etapa, e o app não os inventa");
  ok(!lp.D1 && !lp.D5,
     "a numeração começa no D6 — os anteriores são de etapas anteriores");

  /* a lista do professor trazia o D24 repetido; é uma linha duplicada,
     não dois descritores */
  ok(typeof lp.D24 === "string",
     "o D24, que aparecia duas vezes na lista, entrou uma vez só");

  /* ── 3. não é mais a matriz do SAEB ── */
  ok(!/Identificar o tema de um texto\.$/.test(lp.D6),
     "o D6 deixou de ser o \"Identificar o tema de um texto\" do SAEB");
  ok(/Localizar informação explícita/.test(lp.D6),
     "e passou a ser \"" + lp.D6 + "\"");

  /* ── 4. o que NÃO foi tocado ── */
  const mat = G.matrizDe("MAT","3EM");
  ok(Object.keys(mat).length === 35,
     "Matemática do 3º EM segue com " + Object.keys(mat).length +
     " descritores — aquela foi conferida contra o documento oficial e " +
     "estava certa");
  ok(/P\.A\./.test(mat.D22),
     "com o D22 ainda em P.A./P.G.");
  const ef = G.matrizDe("LP","9EF");
  ok(Object.keys(ef).length > 0 && ef.D6 !== lp.D6,
     "e o 9º EF NÃO foi alterado: a lista recebida é do 3º EM, e supor que " +
     "vale para as outras etapas seria inventar");

  /* ── 5. o casamento por texto funciona com a matriz nova ── */
  const casa = win.eval(`(function(){
    var lido={itens:[{desc:"D3"},{desc:"D18"}],
      descritores:[
        {cod:"D3", texto:"Localizar informação explícita em um texto."},
        {cod:"D18", texto:"Identificar a tese de um texto."}]};
    var n=normalizarDescritores(lido,"LP","3EM");
    return lido.itens.map(function(x){return x.desc;}).join(",")+"|"+
           n.trocas.map(function(t){return t.de+"→"+t.para;}).join(",");
  })()`).split("|");
  ok(casa[0] === "D6,D19",
     "um arquivo com a numeração trocada é corrigido pelo texto: " + casa[0]);
  ok(casa[1] === "D3→D6,D18→D19",
     "com as trocas declaradas: " + casa[1]);

  /* ── 6. o que sustentou tudo: não adivinhar por número ── */
  /* Com a matriz errada no lugar, a normalização teria remapeado os
     códigos CORRETOS do professor para os do SAEB. Não aconteceu porque
     as redações são diferentes e nenhum texto casou — o app deixou como
     estava e declarou "sem par". */
  const naoAdivinha = win.eval(`(function(){
    var lido={itens:[{desc:"D6"}],
      descritores:[{cod:"D6", texto:"Um texto que não existe em matriz nenhuma."}]};
    var n=normalizarDescritores(lido,"LP","3EM");
    return lido.itens[0].desc+"|"+n.trocas.length+"|"+n.semPar.length;
  })()`).split("|");
  ok(naoAdivinha[0] === "D6" && naoAdivinha[1] === "0" && naoAdivinha[2] === "1",
     "texto que não casa NÃO é remapeado — fica como está e é declarado " +
     "sem par. Foi essa regra que impediu a matriz errada de corromper os " +
     "dados de Português");

  console.log(falhas ? "\nteste74: " + falhas + " FALHA(S)" : "\nteste74: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
