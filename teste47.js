/* teste47.js — a coluna direita vazia da primeira página.

   Era o item 3 da v41, diagnosticado e não resolvido: as duas colunas de
   uma página começam na mesma altura, e na primeira elas começam ABAIXO
   do cartão-resposta, que come uns 90 mm. Uma questão mais alta que a
   coluna encurtada não cabia em nenhuma das duas, e como a ordem não pode
   mudar (o gabarito individual depende dela), a página fechava com a
   coluna direita em branco.

   A correção foi trocar o bloco indivisível por UNIDADES com altura
   própria e marca de cola. Este teste cobre as duas metades disso:

   1. as unidades somam exatamente a altura medida da questão — se não
      somassem, a escolha do corpo mediria uma coisa e o desenho gastaria
      outra;
   2. as colas seguram o que não pode ser separado (rótulo, fonte,
      comando, alternativas);
   3. o empacotamento aproveita a coluna encurtada em vez de deixá-la
      vazia. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(3) });

function docFalso(){
  const eventos = [];
  return {
    eventos,
    internal:{ pageSize:{ getWidth:()=>210, getHeight:()=>297 } },
    setFont(){}, setFontSize(v){ this.fs = v; }, setTextColor(){},
    setDrawColor(){}, setLineWidth(){}, line(){}, rect(){}, setFillColor(){},
    setLineDashPattern(){},
    getTextWidth(t){ return String(t).length * 1.8; },
    splitTextToSize(t, larg){
      const palavras = String(t).split(/\s+/).filter(Boolean);
      const porLinha = Math.max(1, Math.floor(larg / 1.8 / 6));
      const linhas = [];
      for(let i = 0; i < palavras.length; i += porLinha)
        linhas.push(palavras.slice(i, i + porLinha).join(" "));
      return linhas.length ? linhas : [""];
    },
    text(t, x, y){ eventos.push({ tipo:"texto", t:String(t), x, y }); },
    addImage(d, f, x, y, w, h){ eventos.push({ tipo:"imagem", x, y, w, h }); }
  };
}

const LARG = 80, FS = 10, OPC = ["A","B","C","D","E"];

/* questão comprida, do tipo que não cabia na coluna encurtada */
function questaoLonga(n){
  const paragrafo = ("Texto " + n + " de apoio. ").repeat(1) +
    "A leitura silenciosa é uma prática que se firmou tarde na história e " +
    "mudou o modo como as pessoas se relacionam com o texto escrito, porque " +
    "permitiu que cada leitor seguisse o seu próprio ritmo sem depender da " +
    "voz de quem lia em voz alta para todos os demais presentes na sala.";
  return {
    enunciado: "Leia o texto abaixo.\n" + paragrafo + "\n" + paragrafo + "\n" +
      "ASSIS, Machado de. Contos. São Paulo: Ática, 1998. Adaptado.\n" +
      "De acordo com o texto, a leitura silenciosa:",
    alternativas: ["primeira alternativa da questão " + n,
                   "segunda alternativa da questão " + n,
                   "terceira alternativa da questão " + n,
                   "quarta alternativa da questão " + n,
                   "quinta alternativa da questão " + n],
    imagem: null
  };
}

setTimeout(() => {
  console.log("teste47 — colunas divisíveis e a coluna direita vazia");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");
  const doc = docFalso();
  const item = questaoLonga(1);
  const m = G.medidasQuestao(doc, item, LARG, FS, OPC);
  const U = G.unidadesQuestao(doc, 1, item, LARG, FS, OPC, m, null);

  /* ── 1. as alturas fecham ── */
  ok(U.length > 5, "a questão virou várias unidades (" + U.length + ")");
  const soma = U.reduce((a, u) => a + u.h, 0);
  /* `m.h` é a questão sem o ar que a separa da seguinte — era assim que
     blocosDaProva empilhava (`m.h + AR_QUESTAO()`), e as unidades
     carregam esse ar na última alternativa */
  const alvo = m.h + G.AR_QUESTAO();
  ok(Math.abs(soma - alvo) < 0.01,
     "a soma das unidades bate com a altura medida (" +
     soma.toFixed(2) + " ≈ " + alvo.toFixed(2) + ")");

  /* e o desenho gasta exatamente isso */
  doc.eventos.length = 0;
  let y = 0; U.forEach(u => { y = u.desenhar(10, y); });
  ok(Math.abs(y - soma) < 0.01,
     "e o desenho consome a mesma altura (" + y.toFixed(2) + ")");

  /* a faixa de bloco entra como primeira unidade, colada */
  const Ucab = G.unidadesQuestao(doc, 1, item, LARG, FS, OPC, m, "LÍNGUA PORTUGUESA");
  ok(Ucab.length === U.length + 1, "a faixa de bloco é uma unidade a mais");
  ok(Ucab[0].cola === true, "e vai colada na questão — nunca fica órfã");
  const somaCab = Ucab.reduce((a, u) => a + u.h, 0);
  ok(Math.abs(somaCab - (alvo + Ucab[0].h)) < 0.01,
     "a soma com a faixa também fecha");

  /* ── 2. as colas ── */
  ok(U[0].cola === true, "o rótulo QUESTÃO nunca fica sozinho no pé da coluna");
  const ultimaAlt = U.length - 1;
  ok(U[ultimaAlt].cola === false,
     "depois da última alternativa o corte é livre — é o fim da questão");
  ok(U[ultimaAlt - 1].cola === true,
     "mas a penúltima anda colada na última: nenhuma alternativa fica sozinha");
  ok(U[ultimaAlt - 4].cola === true,
     "e a primeira alternativa anda colada na segunda");
  /* a unidade imediatamente antes das cinco alternativas é o rabicho do
     enunciado, que carrega o ar entre comando e alternativas */
  ok(U[ultimaAlt - 5].cola === true,
     "o enunciado não se separa da primeira alternativa");

  /* nenhuma unidade colada pode ser a última: seria cola sem par */
  ok(U[U.length - 1].cola === false, "a última unidade da questão não fica colada");

  /* ── 3. melhorCorte respeita a cola ── */
  const alturas = [10, 10, 10, 10];
  const semCola = [false, false, false, false];
  const comCola = [true, true, true, false];   // as três primeiras coladas
  ok(G.melhorCorte(alturas, 25, semCola) === 2,
     "sem cola, corta no meio: duas unidades de cada lado");
  ok(G.melhorCorte(alturas, 25, comCola) === -1,
     "com as três primeiras coladas, não há corte legal que caiba em 25");
  ok(G.melhorCorte(alturas, 40, comCola) === 4,
     "aumentando a coluna, o único corte legal é depois do grupo inteiro");
  ok(G.grupoColado(comCola, 0, 4) === 4, "o grupo colado tem as quatro unidades");
  ok(G.grupoColado(semCola, 0, 4) === 1, "sem cola, cada unidade é o seu grupo");

  /* ── 4. a coluna encurtada deixa de ficar vazia ── */
  /* Uma página cuja coluna mede 100 mm e uma questão de altura maior que
     isso: com blocos indivisíveis nada entraria e a página inteira ficaria
     com uma questão só, ou nenhuma. */
  const capCurta = 100;
  ok(m.h > capCurta,
     "a questão de teste é MAIS ALTA que a coluna encurtada (" +
     m.h.toFixed(1) + " > " + capCurta + " mm)");

  const alt = U.map(u => u.h), col = U.map(u => u.cola);
  let leva = 0, corte = -1;
  for(let n = 1; n <= alt.length; n++){
    const k = G.melhorCorte(alt.slice(0, n), capCurta, col.slice(0, n));
    if(k < 0) break;
    leva = n; corte = k;
  }
  ok(leva === alt.length,
     "a questão inteira cabe na página, distribuída entre as duas colunas");
  ok(corte > 0 && corte < alt.length,
     "e o corte cai NO MEIO da questão (unidade " + corte + " de " + alt.length + ")");
  const esq = alt.slice(0, corte).reduce((a, b) => a + b, 0);
  const dir = alt.slice(corte).reduce((a, b) => a + b, 0);
  ok(esq <= capCurta && dir <= capCurta,
     "as duas colunas cabem (" + esq.toFixed(1) + " e " + dir.toFixed(1) + " mm)");
  ok(dir > 1, "a coluna DIREITA não fica vazia — era o defeito da v41/v42");
  ok(!col[corte - 1], "o corte não partiu nenhum grupo colado");

  /* ── 5. empacotar conta as mesmas páginas que o fluxo desenha ── */
  const alturas5 = [], colas5 = [];
  for(let q = 0; q < 5; q++){
    const it = questaoLonga(q + 1);
    const mq = G.medidasQuestao(doc, it, LARG, FS, OPC);
    G.unidadesQuestao(doc, q + 1, it, LARG, FS, OPC, mq, null)
      .forEach(u => { alturas5.push(u.h); colas5.push(u.cola); });
  }
  const pgs = G.empacotar(alturas5, 100, 287, colas5);
  const totalAltura = alturas5.reduce((a, b) => a + b, 0);
  /* piso teórico: a primeira página oferece 2×(287−100) e as demais
     2×(287−12); o empacotamento não pode gastar mais páginas que o
     dobro desse piso, senão está deixando coluna vazia */
  const pisoTeorico = Math.max(1, Math.ceil((totalAltura - 2 * 187) / (2 * 275)) + 1);
  ok(pgs >= pisoTeorico,
     "o número de páginas é coerente com a altura total (" + pgs + " ≥ " + pisoTeorico + ")");
  ok(pgs <= pisoTeorico + 1,
     "e não desperdiça páginas (" + pgs + " ≤ " + (pisoTeorico + 1) + ")");

  console.log(falhas ? "\nteste47: " + falhas + " FALHA(S)" : "\nteste47: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
