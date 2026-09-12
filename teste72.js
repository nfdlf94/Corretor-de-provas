/* teste72.js — a numeração é acertada na IMPORTAÇÃO.

   O professor: "o arquivo que subi pode estar com a numeração errada.
   Faça o app ler o nome completo de cada descritor, comparar com a matriz
   do SAEPE e ajustar sozinho."

   É o lugar certo, e a v72 fez no lugar errado. Corrigir DEPOIS, caderno a
   caderno, deixou quatro turmas com numerações diferentes e o relatório
   somando habilidades distintas sob o mesmo código. Normalizando na
   entrada, o problema não chega a existir: todo caderno nasce com a
   numeração da matriz.

   O casamento é pelo TEXTO COMPLETO da habilidade, normalizado — sem
   acento, sem pontuação, sem caixa. O app não adivinha por proximidade de
   número: texto que não bate com nada fica como está, e ele diz quais. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(8), {nLP:0, nMAT:9}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste72 — numeração normalizada na importação");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  win.eval("window.__T=" +
    JSON.stringify(fs.readFileSync(__dirname + "/fixture-sim-mat.txt","utf8")) + ";");

  /* ── 1. o arquivo real ── */
  const norm = J(`(function(){
    var lido=lerSimuladoDoc(window.__T,null);
    var antes=lido.itens.map(function(x){return x.desc;});
    var n=normalizarDescritores(lido,"MAT","3EM");
    return {antes:antes, depois:lido.itens.map(function(x){return x.desc;}),
      trocas:n.trocas, itens:n.itens, semPar:n.semPar,
      descritores:lido.descritores.map(function(d){return d.cod;})};
  })()`);

  ok(norm.antes.join(",") === "D22,D17,D31,D17,D23,D31,D23,D22,D24",
     "o arquivo declara: " + norm.antes.join(", "));
  ok(norm.depois.join(",") === "D23,D17,D32,D17,D24,D32,D24,D23,D25",
     "e entra no app como: " + norm.depois.join(", "));
  ok(norm.itens === 7, norm.itens + " dos 9 itens tiveram o código ajustado");
  ok(norm.trocas.map(t => t.de + "→" + t.para).join(", ") ===
     "D22→D23, D23→D24, D24→D25, D31→D32",
     "as quatro trocas: " + norm.trocas.map(t => t.de+"→"+t.para).join(", "));
  ok(norm.semPar.length === 0,
     "e todos os textos foram encontrados na matriz — nenhum ficou de fora");
  ok(norm.descritores.join(",") === "D17,D23,D24,D25,D32",
     "os descritores do simulado passam a ser os do SAEPE: " +
     norm.descritores.join(", "));

  /* o D17 não foi tocado: no arquivo e na matriz ele é o mesmo */
  ok(!norm.trocas.some(t => t.de === "D17"),
     "o D17 bate com a matriz e não é mexido");

  /* ── 2. cada troca carrega o texto que a justifica ── */
  ok(norm.trocas.every(t => t.texto && t.texto.length > 20),
     "cada troca guarda o texto completo da habilidade que fez o casamento");
  const t22 = norm.trocas.find(t => t.de === "D22");
  ok(/gráfico de uma função polinomial de 1º grau/i.test(t22.texto),
     "o D22 do arquivo era \"" + t22.texto.slice(0,46) + "…\", que na matriz " +
     "é o " + t22.para);

  /* ── 3. texto que não existe na matriz fica como está ── */
  const estranho = J(`(function(){
    var lido={itens:[{desc:"D99", niv:5},{desc:"D22", niv:7}],
      descritores:[{cod:"D99", texto:"Uma habilidade que não existe na matriz."},
                   {cod:"D22", texto:"Reconhecer o gráfico de uma função polinomial de 1º grau por meio de seus coeficientes."}]};
    var n=normalizarDescritores(lido,"MAT","3EM");
    return {desc:lido.itens.map(function(x){return x.desc;}),
      trocas:n.trocas.map(function(t){return t.de+"→"+t.para;}),
      semPar:n.semPar.map(function(x){return x.cod;})};
  })()`);
  ok(estranho.desc[0] === "D99",
     "descritor cujo texto não existe na matriz fica com o código do " +
     "arquivo (" + estranho.desc[0] + ")");
  ok(estranho.semPar.join(",") === "D99",
     "e é declarado como sem par: " + estranho.semPar.join(", "));
  ok(estranho.desc[1] === "D23",
     "enquanto o que bate é ajustado normalmente (D22 → " + estranho.desc[1] + ")");

  /* ── 4. o casamento ignora acento, caixa e pontuação ── */
  const variacoes = J(`(function(){
    var base="Reconhecer o gráfico de uma função polinomial de 1º grau por meio de seus coeficientes.";
    /* sem acento DE VERDADE (NFD), e não trocando todo acentuado por "a",
       que produziria outra palavra e deveria mesmo falhar */
    var semAcento=base.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    var formas=[base, base.toUpperCase(), semAcento,
                base.replace(/[.,]/g,""), "  "+base+"  "];
    return formas.map(function(t){
      var lido={itens:[{desc:"D22"}], descritores:[{cod:"D22", texto:t}]};
      normalizarDescritores(lido,"MAT","3EM");
      return lido.itens[0].desc;
    });
  })()`);
  ok(variacoes.every(x => x === "D23"),
     "o casamento sobrevive a caixa alta, acentos trocados, pontuação e " +
     "espaços (" + [...new Set(variacoes)].join(", ") + ")");

  /* ── 5. arquivo JÁ correto não é mexido ── */
  const jaCerto = J(`(function(){
    var lido={itens:[{desc:"D23"},{desc:"D17"}],
      descritores:[
        {cod:"D23", texto:"Reconhecer o gráfico de uma função polinomial de 1º grau por meio de seus coeficientes."},
        {cod:"D17", texto:"Resolver problema envolvendo equação do 2º grau."}]};
    var n=normalizarDescritores(lido,"MAT","3EM");
    return {trocas:n.trocas.length, itens:n.itens,
      desc:lido.itens.map(function(x){return x.desc;})};
  })()`);
  ok(jaCerto.trocas === 0 && jaCerto.itens === 0,
     "um arquivo já na numeração do SAEPE não sofre nenhuma troca");
  ok(jaCerto.desc.join(",") === "D23,D17", "e os códigos ficam como estavam");

  /* ── 6. a importação de verdade entra normalizada ── */
  const importado = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    sm.qtd={LP:0,MAT:9}; sm.etapa="3EM";
    var lido=lerSimuladoDoc(window.__T,null);
    normalizarDescritores(lido,"MAT",sm.etapa);
    E.descritores={LP:{},MAT:{}};
    lido.descritores.forEach(function(d){ if(d.texto) E.descritores.MAT[d.cod]=d.texto; });
    aplicarImportacao(sm,"MAT",selecionarItens(sm,"MAT",lido.itens).itens);
    return {desc:pr.desc,
      pendentes:conferirNumeracao(pr,"MAT","3EM").length,
      coerente:conferirCoerencia([sm],"MAT").ok,
      textoD23:(E.descritores.MAT.D23||"")};
  })()`);
  ok(importado.pendentes === 0,
     "depois de importado, não sobra NENHUMA troca pendente — a " +
     "conferência da v72 não tem mais o que fazer");
  ok(importado.coerente === true, "e o caderno nasce coerente");
  ok(/gráfico de uma função polinomial/i.test(importado.textoD23),
     "com o D23 apontando para a habilidade certa: \"" +
     importado.textoD23.slice(0,52) + "…\"");

  /* ── 7. o professor é avisado ── */
  const fonte = fs.readFileSync(__dirname + "/index.html", "utf8");
  ok(/numeração ajustada à matriz do SAEPE/.test(fonte),
     "a tela da importação diz o que foi ajustado — o professor escreveu " +
     "D22 no arquivo e vai ver D23 na tela");
  ok(/texto da habilidade é o que manda/.test(fonte),
     "explicando por que o texto vence o número");
  ok(/não foi encontrado na/.test(fonte),
     "e avisa quando algum descritor não teve par na matriz");

  console.log(falhas ? "\nteste72: " + falhas + " FALHA(S)" : "\nteste72: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
