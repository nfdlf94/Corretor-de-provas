/* teste43.js — o gráfico recortado precisa CHEGAR ao caderno.

   A detecção e o recorte já existiam e funcionavam (é o que a prova
   comum usa há tempo). O que faltava era o caminho: a importação do
   SIMULADO passava por `textoDePdf`, que apaga as marcas de figura na
   última linha antes de devolver o texto. Os gráficos eram achados,
   recortados — e jogados fora ali mesmo. Nenhum chegava à questão.

   Este teste monta o texto como `conteudoDePdf` monta (linhas de texto
   com a marca da figura no lugar certo), usando a geometria REAL do
   arquivo de Matemática do professor, e confere que cada gráfico cai na
   questão certa. */
"use strict";
const H = require("./harness");
const { execFileSync } = require("child_process");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

function paginasDe(pdf){
  const xml = execFileSync("pdftotext", ["-bbox-layout", pdf, "-"],
    { encoding:"utf8", maxBuffer: 1e8 });
  return xml.split(/<page /).slice(1).map(p => {
    const alt = parseFloat(/height="([\d.]+)"/.exec(p)[1]);
    const linhas = [];
    const re = /<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/line>/g;
    let m;
    while ((m = re.exec(p))){
      const txt = m[5].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (txt) linhas.push({ y: alt - (+m[4]), h: (+m[4]) - (+m[2]), txt });
    }
    return linhas.sort((a,b) => b.y - a.y);
  });
}

const { win } = H.abrirApp({ estado: H.estadoBase(3) });

setTimeout(() => {
  console.log("teste43 — as figuras chegam ao caderno");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const MARCA = win.eval("MARCA_FIG");
  const pgs = paginasDe("/mnt/user-data/uploads/1º_Simulado_-_Matema_tica_.pdf");
  const topos = pgs.filter(l => l.length).map(l => l[0].y + l[0].h).sort((a,b)=>a-b);
  const topo = topos[Math.floor(topos.length/2)];

  /* monta o texto do jeito que `conteudoDePdf` monta */
  const figuras = [];
  const saida = [];
  pgs.forEach(linhas => {
    win.__l = linhas;
    const bandas = JSON.parse(win.eval(
      'JSON.stringify(bandasDeLinhas(window.__l,' + topo + '))'));
    const engolidas = new Set();
    bandas.forEach(b => { if (b.engole.length)
      for (let x = b.engole[0]; x <= b.engole[1]; x++) engolidas.add(x); });
    bandas.forEach(b => { if (b.depois < 0){
      figuras.push({ dados:"data:image/png;base64,FIG" + figuras.length, tipo:b.tipo });
      saida.push(MARCA + (figuras.length - 1)); }});
    linhas.forEach((L, idx) => {
      if (L.txt && !engolidas.has(idx)) saida.push(L.txt);
      bandas.forEach(b => { if (b.depois === idx){
        figuras.push({ dados:"data:image/png;base64,FIG" + figuras.length, tipo:b.tipo });
        saida.push(MARCA + (figuras.length - 1)); }});
    });
  });

  ok(figuras.length === 7, "o arquivo rende 7 recortes: 5 gráficos e 2 tabelas (veio " +
     figuras.length + ")");

  win.__txt = saida.join("\n");
  win.__figs = figuras;

  /* ── o caminho antigo: as marcas eram apagadas ── */
  const semFig = JSON.parse(win.eval('JSON.stringify(lerSimuladoDoc(' +
    'window.__txt.replace(new RegExp(MARCA_FIG+"\\\\d+","g"),"")).itens' +
    '.map(function(x){return !!(x.questao&&x.questao.imagem);}))'));
  ok(semFig.filter(Boolean).length === 0,
     "sem as marcas — como era antes — nenhuma questão recebe figura");

  /* ── o caminho novo ── */
  const L = JSON.parse(win.eval('JSON.stringify((function(){' +
    'var L=lerSimuladoDoc(window.__txt, window.__figs);' +
    'return {n:L.itens.length, comFigura:L.comFigura,' +
    ' quais:L.itens.map(function(x,i){return x.questao&&x.questao.imagem?(i+1):0;})' +
    '  .filter(Boolean)};})())'));

  ok(L.n === 15, "as 15 questões continuam sendo lidas (veio " + L.n + ")");
  ok(L.comFigura >= 6, L.comFigura + " questões receberam a figura recortada");
  console.log("       questões com figura: " + L.quais.join(", "));

  /* as questões que citam gráfico ou quadro são justamente essas */
  [2, 3, 7, 9, 10, 11, 14].forEach(q =>
    ok(L.quais.includes(q), "a questão " + q + ", que cita gráfico ou quadro, tem figura"));

  /* e as puramente textuais não ganharam figura à toa */
  [1, 4, 5, 6, 8, 15].forEach(q =>
    ok(!L.quais.includes(q), "a questão " + q + ", só de texto, não recebeu figura"));

  console.log(falhas ? "\nteste43: " + falhas + " FALHA(S)" : "\nteste43: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
