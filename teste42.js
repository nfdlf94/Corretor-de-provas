/* teste42.js — o recorte de gráficos e tabelas, com a geometria REAL dos
   arquivos do professor.

   A detecção acha as faixas da página que serão recortadas como imagem:
   um vão grande entre duas linhas é gráfico ou esquema; um bloco de
   linhas com muitos números é tabela. Dois furos apareceram ao rodar
   isso contra o simulado de Matemática:

   1. O gráfico que ABRE uma página não tinha linha de texto acima, e a
      varredura, que compara pares de linhas, passava direto. Era o caso
      do gráfico da questão 11, que começa a página 4: sumia da prova.

   2. A tabela da questão 10 racha em duas: o cabeçalho em duas linhas
      ("Número dito por" / "Carlos") não passa no teste de linha tabular.
      Saíam dois recortes, cada um com metade da tabela.

   O teste converte o bbox do pdftotext para o formato de linha que o
   pdf.js entrega, então mede a mesma geometria que o app mede. */
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

function bandas(pdf){
  const pgs = paginasDe(pdf);
  const topos = pgs.filter(l => l.length).map(l => l[0].y + l[0].h).sort((a,b)=>a-b);
  const topo = topos[Math.floor(topos.length/2)];
  return pgs.map(linhas => {
    win.__l = linhas;
    return JSON.parse(win.eval('JSON.stringify(bandasDeLinhas(window.__l,' + topo + '))'));
  });
}

setTimeout(() => {
  console.log("teste42 — recorte de gráficos e tabelas");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const MAT = bandas("/mnt/user-data/uploads/1º_Simulado_-_Matema_tica_.pdf");
  const todas = [].concat.apply([], MAT);
  const figs = todas.filter(b => b.tipo === "figura");
  const tabs = todas.filter(b => b.tipo === "tabela");

  ok(figs.length === 5, "os 5 gráficos do simulado de Matemática são achados (veio " +
     figs.length + ")");
  ok(tabs.length === 2, "as 2 tabelas são achadas, cada uma inteira (veio " +
     tabs.length + ")");

  /* o gráfico que abre a página 4 — questão 11 */
  const topoPg4 = MAT[3].filter(b => b.depois < 0);
  ok(topoPg4.length === 1, "a figura no alto da página 4 é achada (questão 11)");
  ok(topoPg4[0] && topoPg4[0].ate - topoPg4[0].de > 120,
     "e com altura de gráfico: " + (topoPg4[0] ? (topoPg4[0].ate-topoPg4[0].de).toFixed(0) : "-") + "pt");

  /* a tabela da questão 10, numa peça só */
  const tabPg3 = MAT[2].filter(b => b.tipo === "tabela");
  ok(tabPg3.length === 1, "a tabela da questão 10 sai num recorte só (veio " +
     tabPg3.length + ")");
  ok(tabPg3[0] && tabPg3[0].ate - tabPg3[0].de > 40,
     "e alta o bastante para conter cabeçalho e dados: " +
     (tabPg3[0] ? (tabPg3[0].ate-tabPg3[0].de).toFixed(0) : "-") + "pt");
  ok(tabPg3[0] && tabPg3[0].engole.length === 2,
     "as linhas da tabela são engolidas, para não repetirem como texto");

  /* toda figura tem altura de desenho, nenhuma é margem confundida */
  ok(figs.every(b => b.ate - b.de >= 45), "nenhuma faixa de figura é fina demais");
  ok(figs.every(b => b.ate - b.de < 400), "nenhuma engole a página inteira");

  /* as páginas de gabarito e descritores não viram imagem */
  ok(MAT[4].length === 0 && MAT[5].length === 0,
     "as páginas de gabarito, descritores e níveis não geram recorte");

  /* ── nenhum falso positivo no arquivo só de texto ── */
  const LP = [].concat.apply([], bandas("/mnt/user-data/uploads/1º_Simulado_-_Portugue_s_.pdf"));
  ok(LP.length === 0,
     "o simulado de Português, que não tem gráfico nem tabela, não gera recorte nenhum" +
     (LP.length ? " — veio " + LP.length : ""));

  /* ── a margem de cima não pode virar figura ── */
  const semTopo = JSON.parse(win.eval('JSON.stringify(bandasDeLinhas(' +
    JSON.stringify([{y:700,h:10,txt:"primeira linha da página"},
                    {y:686,h:10,txt:"segunda linha"}]) + ', 712))'));
  ok(semTopo.length === 0, "página que começa no lugar de sempre não gera figura no topo");

  const comTopo = JSON.parse(win.eval('JSON.stringify(bandasDeLinhas(' +
    JSON.stringify([{y:520,h:10,txt:"texto depois do gráfico"},
                    {y:506,h:10,txt:"mais texto"}]) + ', 712))'));
  ok(comTopo.length === 1 && comTopo[0].depois === -1,
     "página que começa 180pt mais abaixo gera a figura do topo");

  console.log(falhas ? "\nteste42: " + falhas + " FALHA(S)" : "\nteste42: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
