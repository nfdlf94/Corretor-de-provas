/* teste78.js — limite de páginas variável e distribuição por descritor.

   Quatro pedidos do professor, numa peça só:

   1. o limite de 4 páginas do simulado deixa de ser fixo — vira escolha,
      com opção de NÃO ter limite;
   2. ao subir o arquivo, garantir pelo menos uma questão de cada
      descritor quando houver vaga, e distribuir o resto o mais
      igualmente possível;
   3. quando houver mais descritores do que vagas, registrar e mostrar
      quais ficaram de fora;
   4. usar esse histórico para o simulado seguinte não repetir a mesma
      distribuição.

   Os três exemplos que ele deu viraram asserções diretas. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(6), {nLP:0, nMAT:5}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste78 — páginas e distribuição");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. limite de páginas ── */
  const pag = J(`(function(){
    var sm=E.simulados[0], r={};
    [["padrão",undefined],["sem limite",0],["duas",2],["oito",8],["nulo",null]]
      .forEach(function(par){ sm.maxPaginas=par[1];
        r[par[0]]={n:maxPaginasDe(sm), rot:rotuloPaginas(sm)}; });
    sm.maxPaginas=undefined;
    return r;
  })()`);
  ok(pag["padrão"].n === 4,
     "sem escolher nada, o limite segue 4 — é o que os simulados " +
     "anteriores usaram");
  ok(pag["sem limite"].n >= 999 && pag["sem limite"].rot === "sem limite",
     "0 quer dizer SEM LIMITE (" + pag["sem limite"].rot + ")");
  ok(pag["nulo"].n >= 999, "e null também, para estados antigos");
  ok(pag.duas.n === 2 && pag.oito.n === 8,
     "2 e 8 valem 2 e 8 (" + pag.duas.rot + " · " + pag.oito.rot + ")");

  const fonte = require("fs").readFileSync(__dirname + "/index.html", "utf8");
  ok(/id="smPag"/.test(fonte), "o campo está na tela do simulado");
  ok(!/[^_]MAX_PAG_SIMULADO\b(?!=)/.test(
       fonte.replace(/const MAX_PAG_SIMULADO=4;/,"")
            .replace(/return MAX_PAG_SIMULADO;/g,"")
            .replace(/: MAX_PAG_SIMULADO;/g,"")),
     "e nenhum lugar usa mais o limite fixo por fora de `maxPaginasDe`");

  /* ── 2. os exemplos do professor ── */
  const casos = J(`(function(){
    var sm=E.simulados[0], out={};
    [[10,13],[10,20],[10,25],[20,13]].forEach(function(par){
      var nd=par[0], pedido=par[1];
      sm.qtd={LP:0,MAT:pedido};
      var sel=selecionarItens(sm,"MAT",(function(){
        var itens=[];
        for(var d=1;d<=nd;d++) for(var k=0;k<6;k++)
          itens.push({comp:"MAT", desc:"D"+d, gab:"A", niv:5,
            questao:{enunciado:"D"+d+" q"+k, alternativas:["a","b","c","d","e"]}});
        return itens;
      })());
      if(sel.erro){ out[nd+"/"+pedido]={erro:sel.erro}; return; }
      var c={}; sel.itens.forEach(function(x){ c[x.desc]=(c[x.desc]||0)+1; });
      var v=Object.keys(c).map(function(k){return c[k];});
      out[nd+"/"+pedido]={contemplados:Object.keys(c).length,
        min:Math.min.apply(null,v), max:Math.max.apply(null,v),
        total:sel.itens.length, fora:sel.descritoresFora};
    });
    return out;
  })()`);

  const a = casos["10/13"];
  ok(a.total === 13 && a.contemplados === 10,
     "13 questões para 10 descritores: as 13 entram e os 10 são " +
     "contemplados");
  ok(a.min === 1 && a.max === 2,
     "uma de cada, e as 3 que sobram distribuídas — nenhum descritor " +
     "fica com mais de " + a.max);
  ok(a.fora.length === 0, "e nenhum fica de fora");

  const b = casos["10/20"];
  ok(b.min === 2 && b.max === 2,
     "20 questões para 10 descritores: exatamente 2 de cada");

  const c = casos["10/25"];
  ok(c.min === 2 && c.max === 3,
     "25 para 10: uns com 3 e outros com 2 (" + c.min + "–" + c.max + ")");
  ok(c.contemplados === 10, "com os 10 contemplados");

  /* ── 3. mais descritores do que vagas ── */
  const d = casos["20/13"];
  ok(d.total === 13,
     "13 questões para 20 descritores: a quantidade pedida é respeitada");
  ok(d.min === 1 && d.max === 1,
     "uma questão de cada descritor contemplado, nenhum repetido");
  ok(d.contemplados === 13 && d.fora.length === 7,
     d.contemplados + " descritores entram e " + d.fora.length +
     " ficam registrados de fora: " + d.fora.join(", "));
  ok(d.contemplados + d.fora.length === 20,
     "contemplados + de fora = os 20 do arquivo — nenhum se perde da conta");

  ok(/descritores não contemplados nesta avaliação/.test(fonte),
     "e a tela da importação avisa quais foram");

  /* ── 4. o histórico muda a escolha do simulado seguinte ── */
  /* Dois simulados iguais, com o mesmo arquivo e a mesma quantidade: sem
     histórico dariam a mesma seleção. Com histórico, o segundo tem de
     puxar os que ficaram de fora do primeiro. */
  const historico = J(`(function(){
    var t=E.turmas[0];
    var sm1=E.simulados[0];
    sm1.turma=t.id; sm1.qtd={LP:0,MAT:13}; sm1.criado=1;
    var mk=function(){ var itens=[];
      for(var d=1;d<=20;d++) for(var k=0;k<6;k++)
        itens.push({comp:"MAT", desc:"D"+d, gab:"A", niv:5,
          questao:{enunciado:"D"+d+" q"+k, alternativas:["a","b","c","d","e"]}});
      return itens; };
    var s1=selecionarItens(sm1,"MAT",mk());
    aplicarImportacao(sm1,"MAT",s1.itens);
    var pr1=provaDoSim(sm1);
    pr1.descritoresFora={MAT:(s1.descritoresFora||[]).slice()};

    /* o segundo simulado da MESMA turma */
    var Hh=historicoDescritores(t.id,"MAT");
    var foraDoPrimeiro=(s1.descritoresFora||[]).slice();
    var prioridades={};
    foraDoPrimeiro.forEach(function(cod){
      prioridades[cod]=prioridadeDescritor(Hh,cod); });
    var cobrados={};
    itensDe(pr1,"MAT").forEach(function(i){
      cobrados[codDesc(pr1.desc[i])]=prioridadeDescritor(Hh,codDesc(pr1.desc[i])); });
    return {fora:foraDoPrimeiro,
      priFora:foraDoPrimeiro.map(function(k){return prioridades[k];}),
      priCobrado:Object.keys(cobrados).map(function(k){return cobrados[k];})};
  })()`);
  ok(historico.fora.length > 0,
     historico.fora.length + " descritores ficaram de fora do 1º simulado");
  const menorFora = Math.min.apply(null, historico.priFora);
  const maiorCobrado = Math.max.apply(null, historico.priCobrado);
  ok(menorFora > maiorCobrado,
     "e todos eles têm prioridade MAIOR (" + menorFora + ") que qualquer " +
     "descritor já cobrado (" + maiorCobrado + ") — o próximo simulado " +
     "puxa eles primeiro");

  /* ── 5. o painel na tela ── */
  ok(/Cobertura dos descritores/.test(fonte),
     "a análise mostra a cobertura");
  ok(/Ficaram de fora por falta de vaga/.test(fonte),
     "com os que ficaram de fora");
  ok(/Já apareceram três vezes ou mais/.test(fonte) &&
     /Nunca cobrados nesta turma/.test(fonte),
     "os que já apareceram muito e os que nunca apareceram");
  ok(/ficou de fora por falta de vaga/.test(fonte),
     "e a sugestão do próximo simulado usa esse registro como motivo");

  console.log(falhas ? "\nteste78: " + falhas + " FALHA(S)" : "\nteste78: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
