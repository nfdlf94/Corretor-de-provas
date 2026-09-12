/* teste71.js — os cadernos deste recorte falam a mesma língua?

   O professor mandou o relatório, o arquivo do simulado e o caderno
   impresso, e pediu para eu conferir se as habilidades e os descritores
   estavam tratados corretamente. Não estavam, e o defeito era meu.

   O arquivo tem 9 questões e 5 descritores. O relatório da SÉRIE (quatro
   turmas, 36 itens) mostrava ONZE linhas, com D22 e D31 (numeração SAEB)
   convivendo com D23, D24, D25 e D32 (SAEPE). As contas fecham com
   exatamente UMA turma renumerada:

     D23 nível 7 = "gráfico" da turma renumerada (1)
                 + "algébrica" das três não renumeradas (3) = 4

   Dois descritores diferentes somados no mesmo código, com um percentual
   de acerto que não é de habilidade nenhuma.

   Três defeitos, todos meus:

   1. a renumeração (v72) só alcançava os irmãos de MATRIZ, e as quatro
      turmas do professor não compartilhavam matriz;
   2. ela APAGAVA o texto do código antigo do banco — então o D22 dos
      cadernos não renumerados passava a exibir o texto OFICIAL do D22,
      "P.A./P.G.", que não é o que aquelas questões cobram. Habilidade
      errada com aparência de certa;
   3. nada avisava. O relatório apresentava os percentuais como se
      estivessem bem. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(10), {nLP:0, nMAT:9}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste71 — coerência entre os cadernos");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  win.eval("window.__T=" +
    JSON.stringify(fs.readFileSync(__dirname + "/fixture-sim-mat.txt","utf8")) + ";");

  /* quatro turmas com o mesmo simulado, SEM matriz comum — como o
     professor faz na prática, importando turma por turma */
  const cenario = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=E.turmas[0];
    sm.qtd={LP:0,MAT:9}; sm.etapa="3EM"; sm.titulo="1º Simulado SAEPE";
    delete sm.matriz;
    var lido=lerSimuladoDoc(window.__T,null);
    E.descritores={LP:{},MAT:{}};
    lido.descritores.forEach(function(d){ if(d.texto) E.descritores.MAT[d.cod]=d.texto; });
    aplicarImportacao(sm,"MAT",selecionarItens(sm,"MAT",lido.itens).itens);
    ["B","C","D"].forEach(function(L,k){
      var t2={id:"t"+(k+2),escola:t.escola,nome:"3º Ano "+L,serie:t.serie,
        ativa:true,disciplina:t.disciplina,disciplinas:t.disciplinas,
        periodo:t.periodo,alunos:t.alunos.slice(0,8).map(function(a){
          return {numero:a.numero,nome:a.nome+L,desde:1,ate:null};})};
      E.turmas.push(t2);
      var p2=JSON.parse(JSON.stringify(pr)); p2.id="p"+(k+2); p2.turma=t2.id;
      E.provas.push(p2);
      var s2=JSON.parse(JSON.stringify(sm)); s2.id="s"+(k+2); s2.turma=t2.id;
      s2.prova=p2.id; delete s2.matriz; E.simulados.push(s2);
    });
    return {irmaosPorMatriz:irmaosDaMatriz(sm).length,
            doMesmoSimulado:cadernosDoMesmoSimulado(sm).length};
  })()`);
  ok(cenario.irmaosPorMatriz === 0,
     "as quatro turmas NÃO compartilham matriz — é assim que acontece " +
     "quando o professor importa turma por turma");
  ok(cenario.doMesmoSimulado === 3,
     "mas `cadernosDoMesmoSimulado` acha as três irmãs pelo título e pela " +
     "etapa (" + cenario.doMesmoSimulado + ")");

  /* ── 1. renumerar só UMA turma produz a mistura ── */
  const misto = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    renumerarDescritores(pr,"MAT",conferirNumeracao(pr,"MAT",sm.etapa));
    var todos=[sm].concat(cadernosDoMesmoSimulado(sm));
    var C=conferirCoerencia(todos,"MAT");
    return {misturado:C.misturado, numerados:C.numerados, aNumerar:C.aNumerar,
      cadernos:C.cadernos, ok:C.ok,
      textoD22:(E.descritores.MAT.D22||"(APAGADO)"),
      trocas:C.foraDaMatriz.map(function(t){return t.de+"→"+t.para;})};
  })()`);
  ok(misto.misturado === true,
     "a mistura é detectada: " + misto.numerados + " caderno(s) no SAEPE e " +
     misto.aNumerar + " no SAEB");
  ok(misto.ok === false,
     "e o conjunto NÃO é dado como coerente — é o que segura o relatório");
  ok(misto.trocas.join(",").indexOf("D22→D23") >= 0,
     "as trocas pendentes são identificadas (" + misto.trocas.join(", ") + ")");

  /* ── 2. o texto do código antigo NÃO some ── */
  ok(/gráfico de uma função polinomial/i.test(misto.textoD22),
     "o texto do D22 continua sendo o do ARQUIVO enquanto três cadernos " +
     "ainda o usam: \"" + misto.textoD22.slice(0,44) + "…\"");
  ok(!/P\.A\./i.test(misto.textoD22),
     "e NÃO virou o \"P.A./P.G.\" da matriz oficial — era esse o defeito " +
     "mais perigoso, porque exibia a habilidade errada com cara de certa");

  /* ── 3. corrigir tudo de uma vez resolve ── */
  const corrigido = J(`(function(){
    var sm=E.simulados[0];
    var r=renumerarGrupo([sm].concat(cadernosDoMesmoSimulado(sm)),"MAT");
    var n=r.itens;
    var todos=[sm].concat(cadernosDoMesmoSimulado(sm));
    var C=conferirCoerencia(todos,"MAT");
    var codigos={};
    todos.forEach(function(s2){
      var p2=provaDoSim(s2);
      itensDe(p2,"MAT").forEach(function(i){ codigos[codDesc(p2.desc[i])]=1; });
    });
    return {mexidos:n, ok:C.ok, misturado:C.misturado,
      codigos:Object.keys(codigos).sort(),
      textoD22:(E.descritores.MAT.D22||"(APAGADO)")};
  })()`);
  ok(corrigido.mexidos === 21,
     corrigido.mexidos + " itens renumerados nos três cadernos que faltavam " +
     "(7 por caderno)");
  ok(corrigido.ok === true && corrigido.misturado === false,
     "e o conjunto passa a ser coerente");
  ok(corrigido.codigos.join(",") === "D17,D23,D24,D25,D32",
     "os códigos em uso são só os do SAEPE: " + corrigido.codigos.join(", "));
  ok(corrigido.textoD22 === "(APAGADO)",
     "agora sim o D22 sai do banco — ninguém mais o usa");

  /* ── 4. o aviso chega ao professor ── */
  const fonteTxt = fs.readFileSync(__dirname + "/index.html", "utf8");
  ok(/não estão com a mesma\s*\n?\s*numeração|não estão com a mesma numeração/.test(fonteTxt) ||
     /mesma\s+numeração/.test(fonteTxt),
     "a tela da Análise avisa quando os cadernos divergem");
  ok(/somando questões que não medem a mesma/.test(fonteTxt),
     "dizendo o que está errado com o número, não só que há um problema");
  ok(/Não use estes percentuais até uniformizar/.test(fonteTxt),
     "e o que fazer");
  ok(/Antes de usar os percentuais por descritor/.test(fonteTxt),
     "e o relatório em PDF traz o mesmo aviso ANTES da tabela de acerto " +
     "por descritor");

  console.log(falhas ? "\nteste71: " + falhas + " FALHA(S)" : "\nteste71: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1500);
