/* teste51.js — mesma quantidade de questões por descritor.

   Regra do professor: com 10 questões e 5 descritores, 2 de cada. Com 9,
   quatro descritores ficam com 2 e um com 1 — a sobra se distribui, não
   se concentra.

   O que havia antes: escolher n itens de uma lista era `slice(0, n)`.
   Como o arquivo traz as questões AGRUPADAS por descritor, cortar o fim
   apagava um descritor inteiro — um caderno de 20 questões em 5
   descritores virava 16 em 4, e a habilidade sumia da prova e da análise
   junto com ela. Isso acontecia em TRÊS lugares: a seleção do arquivo,
   a mudança da quantidade pedida e o corte por excesso de páginas. Agora
   os três chamam `escolherEquilibrado`. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.comSimulado(H.estadoBase(6), {nLP:10, nMAT:10}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

/* conta quantas de cada descritor, em ordem alfabética de descritor */
const contar = lista => {
  const c = {};
  lista.forEach(x => { const d = x.desc || "(vazio)"; c[d] = (c[d] || 0) + 1; });
  return c;
};
const espalho = c => {
  const v = Object.keys(c).map(k => c[k]);
  return v.length < 2 ? 0 : Math.max.apply(null, v) - Math.min.apply(null, v);
};

/* lista agrupada por descritor, como o arquivo entrega */
function lista(porDesc){
  const out = [];
  Object.keys(porDesc).forEach(d => {
    for(let i = 0; i < porDesc[d]; i++)
      out.push({comp:"MAT", desc:d, gab:"A", orig:out.length+1,
                questao:{enunciado:d+" item "+(i+1), alternativas:["a","b","c","d","e"]}});
  });
  return out;
}

setTimeout(() => {
  console.log("teste51 — mesma quantidade de questões por descritor");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. o caso do professor ── */
  win.__L = lista({D22:4, D23:4, D17:4, D28:4, D24:4});   // 20, agrupadas

  const dez = J("escolherEquilibrado(window.__L, 10)");
  const c10 = contar(dez);
  ok(dez.length === 10, "10 escolhidas de 20");
  ok(Object.keys(c10).length === 5, "os cinco descritores continuam na prova");
  ok(Object.keys(c10).every(d => c10[d] === 2),
     "2 questões de cada — exatamente o pedido: " + JSON.stringify(c10));

  const nove = J("escolherEquilibrado(window.__L, 9)");
  const c9 = contar(nove);
  ok(nove.length === 9, "9 escolhidas de 20");
  ok(Object.keys(c9).length === 5, "os cinco descritores sobrevivem");
  const vals9 = Object.keys(c9).map(d => c9[d]).sort();
  ok(vals9.join(",") === "1,2,2,2,2",
     "quatro descritores com 2 e um com 1: " + JSON.stringify(c9));

  /* 18 de 20 — o caso real do corte por excesso de páginas */
  const dez8 = contar(J("escolherEquilibrado(window.__L, 18)"));
  ok(Object.keys(dez8).length === 5, "cortando 2 de 20, nenhum descritor some");
  ok(Object.keys(dez8).map(d => dez8[d]).sort().join(",") === "3,3,4,4,4",
     "e a diferença é de uma questão: " + JSON.stringify(dez8));

  /* o defeito antigo, para deixar claro o que mudou */
  const cortandoOFim = contar(J("window.__L.slice(0, 16)"));
  ok(Object.keys(cortandoOFim).length === 4,
     "cortando o FIM da lista, um descritor inteiro sumia (" +
     Object.keys(cortandoOFim).length + " sobravam) — era o defeito");

  /* ── 2. nunca mais de uma questão de diferença ── */
  let pior = 0, ondePior = "";
  for(let n = 1; n <= 20; n++){
    const c = contar(J("escolherEquilibrado(window.__L, " + n + ")"));
    const e = espalho(c);
    if(e > pior){ pior = e; ondePior = n + " → " + JSON.stringify(c); }
  }
  ok(pior <= 1, "para qualquer quantidade de 1 a 20, a diferença nunca passa " +
     "de uma questão" + (pior > 1 ? " (falhou em " + ondePior + ")" : ""));

  /* ── 3. fonte desequilibrada: faz o melhor possível ── */
  win.__D = lista({D22:8, D23:1, D17:6, D28:1, D24:4});   // 20, torto
  const t10 = contar(J("escolherEquilibrado(window.__D, 10)"));
  ok(Object.keys(t10).length === 5,
     "com o arquivo torto, os cinco descritores ainda entram: " + JSON.stringify(t10));
  ok(t10.D23 === 1 && t10.D28 === 1,
     "os escassos entram com tudo o que têm");
  ok(t10.D22 <= 3 && t10.D17 <= 3,
     "e os abundantes cedem — ninguém domina a prova");

  /* ── 4. a ordem original de quem fica é preservada ── */
  const ordem = J("escolherEquilibrado(window.__L, 10).map(function(x){return x.orig;})");
  const crescente = ordem.slice().sort((a,b) => a-b);
  ok(JSON.stringify(ordem) === JSON.stringify(crescente),
     "quem fica mantém a ordem do arquivo: " + ordem.join(", "));

  /* ── 5. bordas ── */
  ok(J("escolherEquilibrado(window.__L, 25)").length === 20,
     "pedir mais do que existe devolve tudo");
  ok(J("escolherEquilibrado(window.__L, 0)").length === 0, "pedir zero devolve nada");
  ok(J("escolherEquilibrado([], 5)").length === 0, "lista vazia não quebra");
  /* itens em branco formam o seu próprio grupo e saem primeiro */
  win.__B = lista({D22:3, D23:3}).concat(lista({"":4}).map(x =>
    Object.assign({}, x, {questao:null})));
  const semBranco = contar(J("escolherEquilibrado(window.__B, 6)"));
  ok(!semBranco["(vazio)"] && !semBranco[""],
     "itens sem descritor saem antes das questões de verdade: " +
     JSON.stringify(semBranco));

  /* ── 6. os três pontos de corte usam a mesma regra ── */
  win.eval(`(function(){
    var pr=E.provas[0];
    var descLP=["D27","D17","D18","D21","D25"], descMAT=["D22","D23","D17","D28","D24"];
    var itens=itensDoCaderno(pr);
    itens.forEach(function(x,i){
      var k=i%10;
      x.desc=(x.comp==="LP"?descLP:descMAT)[Math.floor(k/2)];
    });
    gravarCaderno(pr,itens);
  })()`);
  const antes = J("contagemPorDescritor(itensDoCaderno(E.provas[0]))");
  ok(Object.keys(antes.LP).length === 5 && Object.keys(antes.MAT).length === 5,
     "o caderno de teste tem 5 descritores por componente");

  /* baixar a quantidade pedida */
  const depois = J(`(function(){
    var sm=E.simulados[0];
    sm.qtd={LP:8, MAT:10};
    ajustarQuantidade(sm,"LP");
    return contagemPorDescritor(itensDoCaderno(provaDoSim(sm)));
  })()`);
  ok(Object.keys(depois.LP).length === 5,
     "baixando LP de 10 para 8, os cinco descritores continuam: " +
     JSON.stringify(depois.LP));
  ok(espalho(depois.LP) <= 1,
     "e a diferença é de no máximo uma questão");
  ok(Object.keys(depois.MAT).length === 5 &&
     Object.keys(depois.MAT).every(d => depois.MAT[d] === 2),
     "Matemática não foi tocada: " + JSON.stringify(depois.MAT));

  /* seleção do arquivo: sorteia dentro do descritor, equilibra entre eles */
  const daImportacao = J(`(function(){
    var sm=E.simulados[0];
    sm.qtd=Object.assign({},sm.qtd,{MAT:10});
    var brutos=[];
    ["D22","D23","D17","D28","D24"].forEach(function(d){
      for(var i=0;i<6;i++) brutos.push({desc:d, gab:"A", niv:null, hab:"",
        questao:{enunciado:d+" item "+(i+1), alternativas:["a","b","c","d","e"]}});
    });
    var sel=selecionarItens(sm,"MAT",brutos);
    if(sel.erro) return {erro:sel.erro};
    var c={}; sel.itens.forEach(function(x){ c[x.desc]=(c[x.desc]||0)+1; });
    return {conta:c, origs:sel.itens.map(function(x){return x.orig;})};
  })()`);
  ok(!daImportacao.erro, "a importação simulada rodou");
  ok(Object.keys(daImportacao.conta).length === 5 &&
     Object.keys(daImportacao.conta).every(d => daImportacao.conta[d] === 2),
     "de 30 no arquivo, escolhe 2 de cada descritor: " +
     JSON.stringify(daImportacao.conta));
  const ord = daImportacao.origs;
  ok(JSON.stringify(ord) === JSON.stringify(ord.slice().sort((a,b)=>a-b)),
     "e o caderno sai na ordem do arquivo");

  /* ── 7. o pre-flight avisa quando o arquivo não permite equilibrar ── */
  const G = require("./gerador.js");
  const doc = {
    internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},
    setFont(){}, setFontSize(){}, setTextColor(){}, setDrawColor(){},
    setLineWidth(){}, line(){}, rect(){}, setFillColor(){}, setLineDashPattern(){},
    getTextWidth(t){return String(t).length*1.8;},
    splitTextToSize(t){return [String(t)];},
    text(){}, addImage(){}
  };
  const q = n => Array.from({length:n}, (_,i) => ({
    enunciado:"Questão "+(i+1)+"?", alternativas:["a","b","c","d","e"], imagem:null}));
  const base = {escola:"E", disciplina:"Matemática", no:5, simulado:true,
    rotulosComp:{MAT:"Matemática"}};

  const equilibrado = Object.assign({}, base, {gabaritoCanonico:"AAAAAA",
    questoes:q(6), comps:["MAT","MAT","MAT","MAT","MAT","MAT"],
    desc:["D22","D22","D23","D23","D17","D17"]});
  ok(G.preFlightCheck(equilibrado, doc, 10).length === 0,
     "2 de cada: o pre-flight não reclama");

  const quase = Object.assign({}, base, {gabaritoCanonico:"AAAAA",
    questoes:q(5), comps:["MAT","MAT","MAT","MAT","MAT"],
    desc:["D22","D22","D23","D23","D17"]});
  ok(G.preFlightCheck(quase, doc, 10).length === 0,
     "2,2,1: diferença de uma questão é o normal, não reclama");

  const torto = Object.assign({}, base, {gabaritoCanonico:"AAAAAA",
    questoes:q(6), comps:["MAT","MAT","MAT","MAT","MAT","MAT"],
    desc:["D22","D22","D22","D22","D23","D17"]});
  const avTorto = G.preFlightCheck(torto, doc, 10);
  ok(avTorto.some(a => /desequilibrados/.test(a)),
     "4,1,1: avisa que estão desequilibrados — " + avTorto.join(" / "));
  ok(avTorto.some(a => /Matemática/.test(a)),
     "dizendo de qual componente");

  const semDesc = Object.assign({}, base, {gabaritoCanonico:"AAAA",
    questoes:q(4), comps:["MAT","MAT","MAT","MAT"],
    desc:["D22","D22","","D23"]});
  ok(G.preFlightCheck(semDesc, doc, 10).some(a => /sem descritor/.test(a)),
     "e avisa quando há questão sem descritor");

  console.log(falhas ? "\nteste51: " + falhas + " FALHA(S)" : "\nteste51: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1000);
