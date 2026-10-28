/* teste90.js — tirinha/charge: a referência vem ABAIXO da figura.

   O professor mostrou a "Maitena" (questão 06) e a "Mafalda" (questão 14):
   no material de origem a referência fica sob o desenho, e o caderno
   gerado a imprimia ACIMA dele. Quando a figura é o próprio texto de apoio
   (não há parágrafo nenhum), a ordem é instrução → figura → referência →
   comando. Com texto corrido, a ordem de sempre (texto, fonte, figura). */
"use strict";
const H = require("./harness");
let falhas = 0;
const ok = (c, m) => { console.log((c ? "  ok   " : "  FALHA") + "  " + m); if(!c) falhas++; };
const { win } = H.abrirApp({ estado: H.estadoBase(3) });

function docFalso(){
  const eventos = [];
  return {
    eventos, fs: 10, estilo: "normal",
    internal:{ pageSize:{ getWidth:()=>210, getHeight:()=>297 } },
    setFont(f, e){ this.estilo = e || "normal"; }, setFontSize(v){ this.fs = v; },
    setTextColor(){}, setDrawColor(){}, setLineWidth(){}, setFillColor(){},
    line(){}, rect(){}, setLineDashPattern(){},
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
    addImage(d, f, x, y, w, h){ eventos.push({ tipo:"imagem", y, h }); }
  };
}
const FIG = { dados:"data:image/jpeg;base64,AAAA", w:600, h:400 };
const OPC = ["A","B","C","D","E"];
const alts = ["a","b","c","d","e"].map(x => "alternativa " + x);

function desenha(G, enunciado, imagem){
  const doc = docFalso();
  const item = { enunciado, imagem, alternativas: alts };
  const m = G.medidasQuestao(doc, item, 80, 10, OPC);
  const U = G.unidadesQuestao(doc, 1, item, 80, 10, OPC, m, null);
  let y = 0; U.forEach(u => { y = u.desenhar(10, y); });
  return doc.eventos;
}
const yDe = (ev, re) => { const e = ev.find(e => e.tipo === "texto" && re.test(e.t)); return e ? e.y : null; };

setTimeout(() => {
  console.log("teste90 — figura acima da referência");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");
  const G = require("./gerador.js");
  global.tipoDoAluno = require("./embaralho.js").tipoDoAluno;

  /* 1. tirinha: sem parágrafo → figura, depois referência, depois comando */
  let ev = desenha(G, "Leia o texto abaixo.\nQUINO. Mafalda. http://clubedamafalda.blogspot.com/. Acesso em: 08/06/2008.\nNesse texto, o efeito de humor é obtido pela", FIG);
  const yImg = ev.find(e => e.tipo === "imagem").y;
  const yRef = yDe(ev, /QUINO|Mafalda|clubedamafalda|08\/06/);
  const yCmd = yDe(ev, /efeito|Nesse|obtido|pela/);
  const yIns = yDe(ev, /Leia/);
  ok(yIns < yImg && yImg < yRef && yRef < yCmd,
     "instrução < figura < referência < comando (" + [yIns, yImg, yRef, yCmd].map(v => v.toFixed(1)).join(" < ") + ")");

  /* 2. charge com referência de duas linhas (Maitena) */
  ev = desenha(G, "Leia o texto abaixo.\nMAITENA. Superadas. Folha de S. Paulo, São Paulo, 21 set. 2003.Ilustrada, p. 8.\nSobre as funções desempenhadas pelas mulheres na sociedade, afirma-se que", FIG);
  ok(ev.find(e => e.tipo === "imagem").y < yDe(ev, /MAITENA|Superadas|Ilustrada|Paulo/),
     "charge: a figura vem antes da referência");

  /* 3. com texto corrido, nada muda: texto, fonte, figura */
  const par = "A única coisa que perturba a harmonia do ambiente são os turistas. Alguns viajam só para mudar de cenário e fazer o que fazem sempre.";
  ev = desenha(G, "Leia o texto abaixo.\nTurismo\n" + par + "\nALVES, Rubem. Turismo. In: Quarto de Badulaques. São Paulo: Parábola, 2003. p. 158.\nNo trecho, o autor quis dizer que", FIG);
  const yTexto = yDe(ev, /harmonia|turistas|única|Alguns|fazem/);
  const yFonte = yDe(ev, /ALVES|Badulaques|Parábola|158/);
  const yImg3 = ev.find(e => e.tipo === "imagem").y;
  ok(yTexto < yFonte && yFonte < yImg3, "com texto corrido: texto < fonte < figura (ordem de sempre)");

  /* 4. soma das alturas continua batendo com a medida */
  const doc = docFalso();
  const item = { enunciado:"Leia o texto abaixo.\nQUINO. Mafalda. Acesso em: 08/06/2008.\nNesse texto, o humor vem da", imagem:FIG, alternativas:alts };
  const m = G.medidasQuestao(doc, item, 80, 10, OPC);
  const U = G.unidadesQuestao(doc, 1, item, 80, 10, OPC, m, null);
  const soma = U.reduce((a, u) => a + u.h, 0);
  ok(Math.abs(soma - (m.h + G.AR_QUESTAO())) < 0.01, "a soma das unidades bate com a altura medida");
  let y = 0; U.forEach(u => { y = u.desenhar(10, y); });
  ok(Math.abs(y - soma) < 0.01, "e o desenho consome a mesma altura");

  process.exit(falhas ? 1 : 0);
}, 800);
