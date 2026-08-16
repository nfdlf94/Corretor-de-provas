/* teste45.js — onde a figura entra na questão, e o cabeçalho de tabela
   que ocupa duas linhas.

   1. ORDEM. No material oficial a sequência é: texto, gráfico ou tabela,
      comando, alternativas. O app desenhava o comando ANTES da figura —
      "Qual é a lei de formação dessa função?" aparecia acima do gráfico
      que ela manda observar.

   2. CABEÇALHO EM DUAS LINHAS. "Número dito por" / "Carlos" é um
      cabeçalho de tabela partido em duas linhas. O recorte puxava só
      uma; a outra sobrava solta no enunciado e saía impressa por cima da
      imagem da tabela. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(3) });
const ev = s => win.eval(s);
const J = s => JSON.parse(ev("JSON.stringify(" + s + ")"));

/* jsPDF de mentira: registra a ordem em que as coisas são desenhadas */
function docFalso(){
  const eventos = [];
  const doc = {
    eventos,
    internal:{ pageSize:{ getWidth:()=>210, getHeight:()=>297 } },
    setFont(){}, setFontSize(v){ this.fs=v; }, setTextColor(){},
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
    text(t, x, y){ eventos.push({ tipo:"texto", t:String(t), y }); },
    addImage(d, f, x, y, w, h){ eventos.push({ tipo:"imagem", y, h }); }
  };
  return doc;
}

setTimeout(() => {
  console.log("teste45 — ordem da figura e cabeçalho de tabela");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");
  const doc = docFalso();
  const item = {
    enunciado: "Observe abaixo o gráfico de uma função polinomial do 1º grau.\n" +
               "Qual é a lei de formação dessa função?",
    alternativas: ["f(x) = 3x + 3", "f(x) = − x + 4", "f(x) = 2x + 1",
                   "f(x) = − 3x + 3", "f(x) = − x + 3"],
    imagem: { dados:"data:image/png;base64,AAA", w:600, h:400 }
  };

  const m = G.medidasQuestao(doc, item, 80, 10, ["A","B","C","D","E"]);
  ok(!!m.fig, "a figura foi medida");
  ok(typeof m.posFig === "number", "a posição da figura entre as partes foi guardada");
  const tipos = m.partes.map(p => p.tipo);
  ok(tipos.includes("comando"), "a questão tem comando: " + tipos.join(", "));
  ok(m.posFig === tipos.indexOf("comando"),
     "a figura entra exatamente antes do comando (posição " + m.posFig + ")");

  doc.eventos.length = 0;
  G.desenharQuestaoCol(doc, 10, 20, 11, item, 80, 10, ["A","B","C","D","E"], m);

  const seq = doc.eventos.filter(e =>
    e.tipo === "imagem" || /lei de formação|Observe abaixo|f\(x\)/.test(e.t));
  const iImg = seq.findIndex(e => e.tipo === "imagem");
  const iTexto = seq.findIndex(e => /Observe abaixo/.test(e.t || ""));
  const iComando = seq.findIndex(e => /lei de formação/.test(e.t || ""));
  const iAlt = seq.findIndex(e => /f\(x\)/.test(e.t || ""));

  ok(iTexto >= 0 && iImg >= 0 && iComando >= 0 && iAlt >= 0,
     "texto, imagem, comando e alternativas foram todos desenhados");
  ok(iTexto < iImg, "o texto vem antes da imagem");
  ok(iImg < iComando, "a IMAGEM vem antes do comando — era o que estava trocado");
  ok(iComando < iAlt, "e o comando vem antes das alternativas");

  /* nada é desenhado por cima: cada coisa abaixo da anterior */
  const img = doc.eventos.find(e => e.tipo === "imagem");
  const comando = doc.eventos.find(e => /lei de formação/.test(e.t || ""));
  ok(comando.y >= img.y + img.h,
     "o comando começa abaixo do rodapé da imagem (" +
     comando.y.toFixed(1) + " ≥ " + (img.y + img.h).toFixed(1) + ")");

  /* questão sem comando continua com a figura no fim do enunciado */
  const semCmd = { enunciado:"Observe o quadro abaixo.",
    alternativas:["a","b","c","d","e"], imagem:item.imagem };
  const m2 = G.medidasQuestao(doc, semCmd, 80, 10, ["A","B","C","D","E"]);
  doc.eventos.length = 0;
  G.desenharQuestaoCol(doc, 10, 20, 5, semCmd, 80, 10, ["A","B","C","D","E"], m2);
  ok(doc.eventos.some(e => e.tipo === "imagem"),
     "questão sem comando também desenha a figura");

  /* ── cabeçalho de tabela em duas linhas ── */
  const linhas = [
    { y:700, h:10, txt:"10. Carlos e Ricardo estão fazendo uma brincadeira." },
    { y:686, h:10, txt:"O resultado está apresentado no quadro abaixo." },
    { y:660, h:10, txt:"Número dito por" },
    { y:648, h:10, txt:"Carlos" },
    { y:636, h:10, txt:"1 2 3 4 5" },
    { y:624, h:10, txt:"Resultado de Ricardo − 3 − 1 1 3 5" },
    { y:600, h:10, txt:"Chamando de x o número dito por Carlos…" }
  ];
  win.__l = linhas;
  const b = J('bandasDeLinhas(window.__l)');
  const tab = b.filter(x => x.tipo === "tabela");
  ok(tab.length === 1, "a tabela é achada (veio " + tab.length + ")");
  ok(tab[0] && tab[0].engole[0] === 2,
     "o recorte começa em “Número dito por”, a PRIMEIRA linha do cabeçalho " +
     "(começou em " + (tab[0] ? tab[0].engole[0] : "-") + ")");
  ok(tab[0] && tab[0].engole[1] === 5, "e vai até a última linha de dados");
  ok(tab[0] && tab[0].depois === 1,
     "a imagem entra logo depois da linha que anuncia o quadro");

  /* nenhuma linha do cabeçalho sobra como texto solto */
  const engolidas = [];
  for(let i = tab[0].engole[0]; i <= tab[0].engole[1]; i++) engolidas.push(linhas[i].txt);
  ok(engolidas.includes("Número dito por") && engolidas.includes("Carlos"),
     "as duas linhas do cabeçalho entram na imagem, nenhuma sobra no enunciado");

  console.log(falhas ? "\nteste45: " + falhas + " FALHA(S)" : "\nteste45: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
