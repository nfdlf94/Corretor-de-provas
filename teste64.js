/* teste64.js — o arquivo REAL do 1º Simulado de Matemática.

   Até aqui as suítes usavam arquivos reconstruídos por mim, e quatro
   delas (39, 40, 42, 43) estão paradas há dezenas de versões esperando
   os PDFs de verdade. Este teste usa o texto extraído do arquivo que o
   professor de fato sobe no app — `fixture-sim-mat.txt`, tirado do
   "1º Simulado SAEPE 3EM Matemática".

   O que ele guarda:

   1. a leitura completa do arquivo (9 questões, gabarito, 5 descritores,
      níveis da escala);
   2. a COSTURA da faixa quebrada. O PDF parte a faixa do nível no meio:

        1 Nível 7 (375 a Reconhecer gráfico de função afim ... Desejável
        400) algébrica.

      Sem costurar, `de`/`ate` saem nulos e o texto da habilidade sai
      embaralhado com os números — foi o que apareceu no relatório;
   3. o caminho inteiro até `tetoDoSimulado`, que é o que alimenta o
      "até onde este simulado consegue medir" no PDF de análise. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(4), {nLP:0, nMAT:9}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste64 — arquivo real do 1º Simulado de Matemática");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const texto = fs.readFileSync(__dirname + "/fixture-sim-mat.txt", "utf8");
  ok(texto.length > 3000, "a fixture tem o texto do arquivo (" +
     texto.length + " caracteres)");
  win.eval("window.__T=" + JSON.stringify(texto) + ";");

  /* ── 1. a leitura ── */
  const lido = J("(function(){var L=lerSimuladoDoc(window.__T,null);" +
    "return {itens:L.itens.length, semGab:L.semGab, semDesc:L.semDesc," +
    " semNivel:L.semNivel, descritores:L.descritores.map(function(d){return d.cod;})," +
    " chave:L.chave, niveis:L.niveis};})()");
  ok(lido.itens === 9, "nove questões lidas (" + lido.itens + ")");
  ok(lido.semGab === 0, "todas com gabarito");
  ok(lido.semDesc === 0, "todas com descritor");
  ok(lido.semNivel === 0, "e todas com o nível da escala — que é o dado que " +
     "faltava no relatório");
  ok(lido.descritores.join(",") === "D17,D22,D23,D24,D31",
     "os cinco descritores do arquivo: " + lido.descritores.join(", "));
  ok(lido.chave["1"] === "A" && lido.chave["9"] === "D",
     "o gabarito em colunas foi lido (1=A … 9=D)");

  /* ── 2. a costura da faixa quebrada ── */
  /* estes quatro são exatamente os que quebram a linha no PDF */
  const quebrados = [["1",7,375,400],["3",9,null,425],["5",7,375,400],
                     ["7",8,400,425]];
  quebrados.forEach(([q,nivel,de,ate]) => {
    const n = lido.niveis[q];
    ok(n && n.nivel === nivel && n.de === de && n.ate === ate,
       "questão " + q + ": nível " + (n?n.nivel:"-") + " com a faixa costurada (" +
       (n?n.de:"-") + "–" + (n?n.ate:"-") + ")");
  });
  ok(Object.keys(lido.niveis).every(k =>
       !/\d{3}\)/.test(lido.niveis[k].texto)),
     "e nenhum texto de habilidade ficou com o \"400)\" perdido dentro");
  ok(!/Desej[áa]vel/.test(lido.niveis["1"].texto),
     "o padrão também não vaza para o texto da habilidade");
  ok(/^Reconhecer gráfico de função afim/.test(lido.niveis["1"].texto),
     "a habilidade sai limpa: \"" + lido.niveis["1"].texto.slice(0,48) + "…\"");

  /* uma linha que NÃO quebra continua funcionando */
  const n2 = lido.niveis["2"];
  ok(n2.nivel === 6 && n2.de === 350 && n2.ate === 375,
     "e a linha inteira, sem quebra, segue lida igual (questão 2)");

  /* ── 3. da importação até o teto ── */
  const fim = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    sm.qtd={LP:0,MAT:9}; sm.etapa="3EM";
    var lido=lerSimuladoDoc(window.__T,null);
    var sel=selecionarItens(sm,"MAT",lido.itens);
    if(sel.erro) return {erro:sel.erro};
    aplicarImportacao(sm,"MAT",sel.itens);
    var T=tetoDoSimulado([sm],"MAT");
    return {niv:pr.niv, desc:pr.desc, gab:pr.gabC,
      teto:{min:T.minNivel, max:T.maxNivel, total:T.total, comNivel:T.comNivel,
            ponto:T.pontoTeto, padrao:T.padraoTeto?T.padraoTeto.nome:null,
            ultimo:T.ultimoDaEscala, habs:T.habilidades.length}};
  })()`);
  ok(!fim.erro, "a importação aceita o arquivo" + (fim.erro?": "+fim.erro:""));
  ok(String(fim.niv) === "7,6,9,6,7,9,8,8,8",
     "os níveis chegam gravados na prova: [" + fim.niv + "]");
  ok(String(fim.desc) === "D22,D17,D31,D17,D23,D31,D23,D22,D24",
     "e os descritores junto: [" + fim.desc + "]");
  ok(fim.teto.comNivel === 9 && fim.teto.total === 9,
     "o teto vê os nove itens com nível (" + fim.teto.comNivel + " de " +
     fim.teto.total + ") — nada de \"sem nível informado\"");
  ok(fim.teto.min === 6 && fim.teto.max === 9,
     "o caderno vai do nível " + fim.teto.min + " ao " + fim.teto.max);
  ok(fim.teto.max === fim.teto.ultimo,
     "e alcança o topo da escala do 3º EM (nível " + fim.teto.ultimo + ") — " +
     "este simulado NÃO tem teto baixo, e o relatório deve dizer isso");
  ok(fim.teto.padrao === "Desejável",
     "o teto corresponde ao padrão " + fim.teto.padrao);
  /* SETE, não cinco: um DESCRITOR não corresponde a um nível. Neste
     arquivo, o D22 aparece no nível 7 (questão 1) e no nível 8 (questão 8);
     o D23, no 7 e no 8. São habilidades diferentes sob o mesmo código, e a
     escala oficial as posiciona em lugares diferentes — o `saepe-oficial.js`
     avisa isso no cabeçalho. Agrupar só pelo código esconderia justamente a
     variação de dificuldade que o teto existe para mostrar. */
  ok(fim.teto.habs === 7,
     "as habilidades observadas são SETE para cinco descritores (" +
     fim.teto.habs + "): D22 e D23 aparecem em dois níveis cada");

  /* ── 4. o relatório sai com o teto preenchido ── */
  const pdf = J(`(function(){
    var sm=E.simulados[0], t=turmaDe(sm.turma);
    var doc=pdfAnalise({nivel:"turma", recorte:t.nome, titulo:sm.titulo,
      etapa:sm.etapa, escola:"EREM", sims:[sm], individual:[]});
    return {paginas:doc.getNumberOfPages()};
  })()`);
  ok(pdf.paginas >= 2, "o relatório é gerado (" + pdf.paginas + " páginas)");

  console.log(falhas ? "\nteste64: " + falhas + " FALHA(S)" : "\nteste64: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
