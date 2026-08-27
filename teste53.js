/* teste53.js — o fim da PÁGINA também tem de respeitar a cola.

   Nas fotos da avaliação apareceram duas coisas que a v43 deveria ter
   impedido:

   - "Assinale a alternativa cujo gráfico representa essa função." no pé
     de uma página, com os cinco gráficos no alto da seguinte;
   - a questão 10 com a alternativa A) numa página e B) a E) na outra.

   A cola era conferida por `melhorCorte` entre as duas COLUNAS, mas
   `leva` — quantas unidades entram na página — era escolhido sem olhar
   para ela. O fim da página partia o grupo no meio.

   Medido numa varredura de 230 provas com gráfico: 153 delas partiam
   pelo menos um grupo colado no fim de uma página. Agora, nenhuma. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(6) });

setTimeout(() => {
  console.log("teste53 — o fim da página respeita a cola");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");

  /* ── 0. a coluna esquerda enche primeiro ── */
  /* A regra da leitura: só se passa para a direita depois que a esquerda
     está cheia. Até a v58 o app EQUILIBRAVA — dividia a página em duas
     metades de altura parecida —, e qualquer página que fechasse antes
     do fim saía com as duas colunas paradas no meio. */
  {
    const A = [20, 20, 20, 20, 20, 20];
    const C = [false, false, false, false, false, false];
    const d = G.distribuirPagina(A, C, 0, A.length, 100);
    ok(d.corte === 5,
       "com 6 unidades de 20 mm numa coluna de 100, a esquerda leva CINCO " +
       "(" + d.corte + ") — enche até o limite");
    ok(d.leva === 6, "e a sexta abre a coluna da direita");
    const esq = A.slice(0, d.corte).reduce((a,b)=>a+b,0);
    ok(esq === 100, "a esquerda fecha exatamente no fundo (" + esq + " mm)");
    ok(A.slice(d.corte, d.leva).reduce((a,b)=>a+b,0) === 20,
       "e a direita fica com o resto, curta — que é o certo: o texto " +
       "acabou, não a coluna");
  }
  {
    /* nada obriga a esquerda a estourar para caber mais: o grupo colado
       que não cabe desce inteiro */
    const A = [40, 40, 40];
    const C = [false, true, false];      // 2ª e 3ª coladas
    const d = G.distribuirPagina(A, C, 0, A.length, 100);
    ok(d.corte === 1,
       "a esquerda para na 1ª unidade porque o grupo colado seguinte " +
       "(80 mm) não caberia inteiro nos 60 mm que sobravam");
    ok(d.leva === 3, "e o grupo inteiro vai para a direita, sem partir");
  }

  /* ── 0b. nenhuma lasca de questão no pé da coluna ── */
  /* O enunciado de duas linhas ficava sozinho no pé da coluna e a tabela
     ou o gráfico iam para a seguinte, com um buraco entre os dois. É a
     regra da viúva no nível da questão: ou entra um trecho de verdade,
     ou não entra nada. */
  {
    const doc2 = {
      internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},
      setFont(){}, setFontSize(v){this.fs=v;}, setTextColor(){}, setDrawColor(){},
      setLineWidth(){}, line(){}, rect(){}, setFillColor(){}, setLineDashPattern(){},
      getTextWidth(t){ return String(t).length*1.75; },
      splitTextToSize(t,l){
        const w=String(t).split(/\s+/).filter(Boolean); const o=[]; let a="";
        w.forEach(p=>{const x=a?a+" "+p:p; if(x.length*1.75<=l||!a)a=x;else{o.push(a);a=p;}});
        if(a)o.push(a); return o.length?o:[""];
      },
      text(){}, addImage(){}
    };
    const L2 = (210-24-7)/2, OP = ["A","B","C","D","E"];
    /* a questão das fotos: enunciado curto e uma figura grande logo depois */
    const curta = {enunciado:"Uma função polinomial f do 1º grau é definida " +
      "por f(x) = −2x + 6.\nAssinale a alternativa cujo gráfico representa essa função.",
      alternativas:["","","","",""], imagem:{dados:"d",w:1169,h:674}};
    const mq = G.medidasQuestao(doc2, curta, L2, 10.5, OP);
    const Uq = G.unidadesQuestao(doc2, 3, curta, L2, 10.5, OP, mq, null);
    let acc = 0, cortesCedo = 0;
    Uq.forEach((u, i) => {
      acc += u.h;
      if(i < Uq.length - 1 && !u.cola && acc < 30) cortesCedo++;
    });
    ok(cortesCedo === 0,
       "nenhum corte permitido antes de a questão comprometer 30 mm com a " +
       "coluna (" + cortesCedo + ")");
    ok(Uq[Uq.length-1].cola === false,
       "e a última unidade NÃO fica colada — senão a questão inteira " +
       "grudaria na seguinte");
    ok(Uq.some(u => !u.cola),
       "a questão continua tendo pelo menos um corte legal");

    /* um texto longo continua podendo ser dividido */
    const longa = {enunciado:"Leia o texto abaixo.\nUm título\n" +
      ("A leitura silenciosa firmou-se tarde na história e mudou o modo como " +
       "as pessoas se relacionam com o texto escrito. ").repeat(6) +
      "\nASSIS, Machado de. Contos. Ática, 1998. Acesso em: 6 fev. 2012.\n" +
      "De acordo com o texto:",
      alternativas:["a","b","c","d","e"], imagem:null};
    const ml = G.medidasQuestao(doc2, 1 && longa, L2, 10.5, OP);
    const Ul = G.unidadesQuestao(doc2, 1, longa, L2, 10.5, OP, ml, null);
    const legais = Ul.filter((u,i) => i < Ul.length-1 && !u.cola).length;
    ok(legais >= 3,
       "um texto longo segue com vários cortes legais (" + legais + ") — a " +
       "regra da lasca não engessa a divisão entre colunas");
    let acc2 = 0, primeiro = -1;
    Ul.forEach((u,i) => { acc2 += u.h;
      if(primeiro < 0 && i < Ul.length-1 && !u.cola) primeiro = acc2; });
    ok(primeiro >= 30,
       "e o primeiro deles só aparece depois de 30 mm (" +
       primeiro.toFixed(1) + " mm)");
  }

  /* ── 0c. o bloco de alternativas não se parte ── */
  /* Saía impresso com A e B numa coluna e C, D e E na outra: o estudante
     virava a página no meio das opções. A regra antiga só impedia que UMA
     ficasse sozinha, o que permitia exatamente esse corte. */
  {
    const doc3 = {
      internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},
      setFont(){}, setFontSize(v){this.fs=v;}, setTextColor(){}, setDrawColor(){},
      setLineWidth(){}, line(){}, rect(){}, setFillColor(){}, setLineDashPattern(){},
      getTextWidth(t){ return String(t).length*1.75; },
      splitTextToSize(t,l){
        const w=String(t).split(/\s+/).filter(Boolean); const o=[]; let a="";
        w.forEach(p=>{const x=a?a+" "+p:p; if(x.length*1.75<=l||!a)a=x;else{o.push(a);a=p;}});
        if(a)o.push(a); return o.length?o:[""];
      },
      text(){}, addImage(){}
    };
    const L3 = (210-24-7)/2, OP3 = ["A","B","C","D","E"];
    const curtas = {enunciado:"Os pontos A(1, 2) e B(3, 8) pertencem ao gráfico " +
      "de uma função polinomial f do 1º grau.\nDetermine a lei de formação dessa " +
      "função e assinale a alternativa correta.",
      alternativas:["f(x) = 3x + 1.","f(x) = 3x − 1.","f(x) = −3x + 1.",
                    "f(x) = x + 1.","f(x) = 2x."], imagem:null};
    const mc = G.medidasQuestao(doc3, curtas, L3, 10.5, OP3);
    const Uc = G.unidadesQuestao(doc3, 4, curtas, L3, 10.5, OP3, mc, null);
    const iAlt = Uc.length - mc.alts.length;
    const cortesNasAlts = Uc.filter((u, i) =>
      i >= iAlt && i < Uc.length - 1 && !u.cola).length;
    ok(mc.alts.length === 5, "a questão tem as cinco alternativas");
    ok(cortesNasAlts === 0,
       "com alternativas de uma linha, nenhum corte é permitido entre elas " +
       "(" + cortesNasAlts + ") — o bloco anda inteiro");

    /* alternativas longas: aí dividir volta a valer */
    const longas = {enunciado:"Leia o texto abaixo.\nUm título qualquer\n" +
      "O texto de apoio desta questão é curto.\nAssinale a alternativa correta.",
      alternativas: Array.from({length:5}, (_, k) =>
        "Alternativa " + "ABCDE"[k] + ": " +
        ("uma justificativa longa o bastante para ocupar três linhas inteiras " +
         "da coluna, como acontece nas questões de interpretação. ").repeat(2)),
      imagem:null};
    const ml2 = G.medidasQuestao(doc3, longas, L3, 10.5, OP3);
    const Ul2 = G.unidadesQuestao(doc3, 5, longas, L3, 10.5, OP3, ml2, null);
    const iAlt2 = Ul2.length - ml2.alts.length;
    const alto = ml2.alts.reduce((a, la) => a + la.length * ml2.passo, 0);
    ok(alto > 42, "o bloco de alternativas longas passa de 42 mm (" +
       alto.toFixed(0) + ")");
    const cortes2 = Ul2.filter((u, i) =>
      i >= iAlt2 && i < Ul2.length - 1 && !u.cola).length;
    ok(cortes2 > 0,
       "aí o bloco volta a poder ser dividido (" + cortes2 + " cortes legais)");
    ok(Ul2[iAlt2].cola === true && Ul2[Ul2.length-2].cola === true,
       "mas a primeira segue colada na segunda e a penúltima na última — " +
       "nenhuma alternativa fica sozinha");
  }

  /* ── 0d. medição e desenho contam a MESMA coisa ── */
  /* `unidadesQuestao` monta as unidades para DESENHAR; `unidadesNaOrdem`
     as remonta na ordem de cada estudante para MEDIR. As duas precisam
     aplicar as mesmas regras de cola.

     Na v63 elas divergiram: mudei a regra do bloco de alternativas numa e
     esqueci a outra. A medição achou 4 páginas, o desenho gastou 5, e a
     turma inteira recebeu uma folha a mais. Este teste é a rede. */
  {
    const doc4 = {
      internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},
      setFont(){}, setFontSize(v){this.fs=v;}, setTextColor(){}, setDrawColor(){},
      setLineWidth(){}, line(){}, rect(){}, setFillColor(){}, setLineDashPattern(){},
      getTextWidth(t){ return String(t).length*1.75; },
      splitTextToSize(t,l){
        const w=String(t).split(/\s+/).filter(Boolean); const o=[]; let a="";
        w.forEach(p=>{const x=a?a+" "+p:p; if(x.length*1.75<=l||!a)a=x;else{o.push(a);a=p;}});
        if(a)o.push(a); return o.length?o:[""];
      },
      text(){}, addImage(){}
    };
    const L4 = (210-24-7)/2, OP4 = ["A","B","C","D","E"];
    const casos = [
      {nome:"alternativas curtas",
       q:{enunciado:"Os pontos A(1, 2) e B(3, 8) pertencem ao gráfico.\n" +
          "Determine a lei de formação e assinale a correta.",
          alternativas:["f(x) = 3x + 1.","f(x) = 3x − 1.","f(x) = −3x + 1.",
                        "f(x) = x + 1.","f(x) = 2x."], imagem:null}},
      {nome:"alternativas longas",
       q:{enunciado:"Leia o texto abaixo.\nUm título\nUm apoio curto.\n" +
          "Assinale a alternativa correta.",
          alternativas: Array.from({length:5}, (_, k) => "Opção " + "ABCDE"[k] +
            ": " + ("uma justificativa longa o bastante para ocupar três " +
            "linhas inteiras da coluna. ").repeat(2)), imagem:null}},
      {nome:"texto de apoio longo",
       q:{enunciado:"Leia o texto abaixo.\nUm título\n" +
          ("A leitura silenciosa firmou-se tarde na história e mudou o modo " +
           "como as pessoas se relacionam com o texto escrito. ").repeat(6) +
          "\nASSIS, Machado de. Contos. Ática, 1998. Acesso em: 6 fev. 2012.\n" +
          "De acordo com o texto:",
          alternativas:["a","b","c","d","e"], imagem:null}}
    ];
    let divergiu = 0;
    casos.forEach(c => {
      const mq2 = G.medidasQuestao(doc4, c.q, L4, 10.5, OP4);
      const Ud = G.unidadesQuestao(doc4, 1, c.q, L4, 10.5, OP4, mq2, null);
      /* o que `alturasCanonicas` guardaria desta questão */
      const guardado = {
        alturas: Ud.map(u => u.h), colas: Ud.map(u => u.cola),
        nAlt: mq2.alts.length,
        altsBase: mq2.alts.map(la => la.length * mq2.passo + G.AR_ALT()),
        divideAlts: mq2.alts.reduce((a, la) =>
          a + la.length * mq2.passo + G.AR_ALT(), 0) >= 42
      };
      /* remontado na ordem CANÔNICA: tem de dar exatamente o mesmo */
      const A = [], C = [];
      G.unidadesNaOrdem(guardado, null, A, C);
      const mesmaAltura = A.length === Ud.length &&
        A.every((h, i) => Math.abs(h - Ud[i].h) < 0.001);
      const mesmaCola = C.length === Ud.length &&
        C.every((v, i) => !!v === !!Ud[i].cola);
      if(!mesmaAltura || !mesmaCola) divergiu++;
      ok(mesmaAltura, c.nome + ": as alturas batem entre medição e desenho");
      ok(mesmaCola, c.nome + ": e as COLAS também — era aqui que a v63 " +
         "divergia");
    });
    ok(divergiu === 0, "nenhum dos três casos diverge");
  }

  /* ── 1. o caso mínimo ── */
  /* três unidades de 40 mm; as duas primeiras coladas. Numa coluna de
     100 mm, cabem duas por coluna. O fim da página não pode cair entre
     a unidade 0 e a 1. */
  const alturas = [40, 40, 40, 40, 40, 40, 40];
  const colas   = [true, false, false, true, false, false, false];
  const d = G.distribuirPagina(alturas, colas, 0, alturas.length, 100);
  ok(d.leva >= 2, "a página leva pelo menos as duas unidades coladas");
  ok(d.leva === alturas.length || !colas[d.leva - 1],
     "e termina num corte legal (leva = " + d.leva + ")");
  ok(d.corte === alturas.length || d.corte === 0 || !colas[d.corte - 1],
     "a divisão entre as colunas também é legal (corte = " + d.corte + ")");

  /* ── 2. varredura: nenhum fim de página parte cola ── */
  /* alturas e colas pseudoaleatórias, mas determinísticas */
  let semente = 20260818;
  const proximo = () => (semente = (Math.imul(1103515245, semente) + 12345) >>> 0) / 4294967296;
  let paginas = 0, quebras = 0, travadas = 0, casos = 0;
  for(let rodada = 0; rodada < 400; rodada++){
    const n = 20 + Math.floor(proximo() * 60);
    const A = [], C = [];
    for(let k = 0; k < n; k++){
      /* de vez em quando uma unidade grande, como a figura de 52 mm */
      A.push(proximo() < 0.12 ? 30 + proximo() * 40 : 3 + proximo() * 10);
      C.push(proximo() < 0.45);
    }
    C[n - 1] = false;
    const cap = 90 + proximo() * 190;
    let i = 0, voltas = 0;
    while(i < n && voltas++ < 500){
      const r = G.distribuirPagina(A, C, i, n, cap);
      casos++;
      if(r.leva < 1){ travadas++; break; }
      /* o fim da página é legal? */
      if(i + r.leva < n && C[i + r.leva - 1]){
        /* só é aceitável quando nem o grupo colado inteiro cabia */
        const grupo = G.grupoColado(C, i, n);
        const soma = A.slice(i, i + grupo).reduce((a, b) => a + b, 0);
        if(soma <= cap) quebras++;
      }
      /* a divisão entre colunas é legal? */
      if(r.corte > 0 && r.corte < r.leva && C[i + r.corte - 1]) quebras++;
      i += r.leva; paginas++;
    }
    if(voltas >= 500) travadas++;
  }
  ok(casos > 1000, casos + " páginas distribuídas na varredura");
  ok(travadas === 0, "nenhuma travou — a paginação sempre avança");
  ok(quebras === 0,
     "e nenhum grupo colado foi partido, nem entre colunas nem entre " +
     "páginas (" + quebras + ")");

  /* ── 3. o comando não se separa do gráfico que ele manda observar ── */
  const Emb = require("./embaralho.js");
  global.chaveDeOrdem = Emb.chaveDeOrdem;
  global.embaralharProva = Emb.embaralharProva;
  global.embaralharEmBlocos = Emb.embaralharEmBlocos;

  const doc = {
    internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},
    setFont(){}, setFontSize(v){this.fs=v;}, setTextColor(){}, setDrawColor(){},
    setLineWidth(){}, line(){}, rect(){}, setFillColor(){}, setLineDashPattern(){},
    getTextWidth(t){return String(t).length*1.75;},
    splitTextToSize(t,l){
      const w=String(t).split(/\s+/).filter(Boolean); const o=[]; let a="";
      w.forEach(p=>{const x=a?a+" "+p:p; if(x.length*1.75<=l||!a)a=x;else{o.push(a);a=p;}});
      if(a)o.push(a); return o.length?o:[""];
    },
    text(){}, addImage(){}
  };
  const LARG=(210-24-7)/2, OPC=["A","B","C","D","E"];
  const grafica = {enunciado:"Uma função polinomial f do 1º grau é definida " +
    "por f(x) = −2x + 6.\nAssinale a alternativa cujo gráfico representa essa função.",
    alternativas:["","","","",""], imagem:{dados:"d", w:1169, h:674}};
  const comum = k => ({enunciado:"Um encanador cobra R$ 60,00 pela visita mais " +
    "R$ 45,00 por hora de serviço. Chamando de f(x) o valor total cobrado, em " +
    "reais, e de x o número de horas trabalhadas, um cliente pagou R$ " +
    (100+k*13) + ",00.\nCalcule o número de horas trabalhadas e assinale a " +
    "alternativa correta.", alternativas:["6.","4.","8.","3.","5."], imagem:null});

  /* varre a posição da questão gráfica: em nenhuma delas o comando pode
     ficar numa página e a figura na outra */
  let separou = 0, testados = 0;
  for(let pos = 0; pos < 10; pos++){
    const A = [], C = [], marca = [];
    for(let k = 0; k < 10; k++){
      const q = (k === pos) ? grafica : comum(k);
      const m = G.medidasQuestao(doc, q, LARG, 10.5, OPC);
      G.unidadesQuestao(doc, k+1, q, LARG, 10.5, OPC, m, null).forEach((u, idx, arr) => {
        A.push(u.h); C.push(u.cola);
        /* a última unidade da questão gráfica é a que carrega a figura */
        marca.push(k === pos && idx === arr.length - 1 ? "figura"
                 : (k === pos && idx === arr.length - 2 ? "comando" : ""));
      });
    }
    let i = 0, topo = 110;
    while(i < A.length){
      const r = G.distribuirPagina(A, C, i, A.length, 287 - topo);
      const fim = i + r.leva;
      if(fim < A.length){
        testados++;
        if(marca[fim - 1] === "comando" && marca[fim] === "figura") separou++;
      }
      i += Math.max(1, r.leva); topo = 12;
    }
  }
  ok(testados > 0, testados + " fins de página conferidos nas dez posições");
  ok(separou === 0,
     "em nenhuma delas o comando ficou numa página e os gráficos na outra");

  /* ── 4. empacotar e fluir contam a mesma coisa ── */
  /* `empacotar` é quem escolhe o corpo da letra; se ele contar diferente
     de `distribuirPagina`, a letra mira um layout que não sai impresso */
  const A2 = [], C2 = [];
  for(let k = 0; k < 10; k++){
    const q = (k === 3 || k === 7) ? grafica : comum(k);
    const m = G.medidasQuestao(doc, q, LARG, 10.5, OPC);
    G.unidadesQuestao(doc, k+1, q, LARG, 10.5, OPC, m, null)
      .forEach(u => { A2.push(u.h); C2.push(u.cola); });
  }
  const pgsEmpacotar = G.empacotar(A2, 110, 287, C2);
  let pgsFluir = 1, j = 0, t = 110;
  while(j < A2.length){
    const r = G.distribuirPagina(A2, C2, j, A2.length, 287 - t);
    j += Math.max(1, r.leva);
    if(j < A2.length){ pgsFluir++; t = 12; }
  }
  ok(pgsEmpacotar === pgsFluir,
     "empacotar e o fluxo do desenho contam as mesmas páginas (" +
     pgsEmpacotar + ")");

  console.log(falhas ? "\nteste53: " + falhas + " FALHA(S)" : "\nteste53: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1000);
