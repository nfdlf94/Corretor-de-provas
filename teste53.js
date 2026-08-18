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
