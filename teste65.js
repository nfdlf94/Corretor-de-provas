/* teste65.js — completar os níveis sem reimportar o simulado.

   Um caderno importado por uma versão anterior do app não tem o nível da
   escala em `pr.niv`, e sem ele o relatório não consegue dizer até onde o
   simulado mede.

   Reimportar resolveria — e TROCARIA as questões, invalidando todos os
   cartões já corrigidos. Para um simulado já aplicado isso não é opção.

   Esta importação lê o mesmo arquivo e preenche APENAS `pr.niv`. O
   casamento é pelo DESCRITOR mais a posição dentro dele: a ordem das
   questões no caderno não é a do arquivo, mas o descritor de cada item
   foi gravado na importação original e é o que amarra os dois.

   O teste roda contra o arquivo REAL do 1º Simulado de Matemática. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(6), {nLP:0, nMAT:9}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste65 — completar os níveis sem reimportar");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  win.eval("window.__T=" +
    JSON.stringify(fs.readFileSync(__dirname + "/fixture-sim-mat.txt","utf8")) + ";");

  /* Monta o cenário do professor: simulado importado, cartões corrigidos,
     e os níveis APAGADOS — como ficaria um caderno da versão antiga. */
  const antes = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    sm.qtd={LP:0,MAT:9}; sm.etapa="3EM";
    var lido=lerSimuladoDoc(window.__T,null);
    var sel=selecionarItens(sm,"MAT",lido.itens);
    aplicarImportacao(sm,"MAT",sel.itens);
    E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    /* corrige a turma inteira */
    t.alunos.forEach(function(a,i){
      var g=gabaritoDe(t.nome,a.numero); if(!g) return;
      var R=g.split("");
      for(var k=0;k<i;k++) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
    var guarda={niv:pr.niv.slice(), desc:pr.desc.slice(), gab:pr.gabC,
      questoes:pr.questoes.map(function(q){return q.enunciado;}),
      notas:E.res.filter(function(r){return r.prova===pr.id;})
        .map(function(r){return r.numero+":"+r.acertos;}).sort().join(",")};
    /* apaga os níveis — o caderno "antigo" */
    pr.niv=new Array(pr.nq).fill(null);
    window.__guarda=guarda;
    return {nq:pr.nq, corrigidos:resDa(pr.id).length,
      comNivel:pr.niv.filter(function(x){return x!=null;}).length};
  })()`);
  ok(antes.nq === 9 && antes.corrigidos === 6,
     "cenário: 9 itens, " + antes.corrigidos + " cartões corrigidos");
  ok(antes.comNivel === 0, "e nenhum item com nível — é o caderno antigo");

  const semTeto = J(`tetoDoSimulado([E.simulados[0]],"MAT")`);
  ok(semTeto.maxNivel === null,
     "sem os níveis, o relatório não tem como dizer o teto");

  /* ── a operação: preencher só os níveis ── */
  const depois = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var lido=lerSimuladoDoc(window.__T,null);
    var fila={};
    lido.itens.forEach(function(x){
      if(x.niv==null) return;
      var k=codDesc(x.desc||"");
      (fila[k]=fila[k]||[]).push(x.niv);
    });
    var preenchidos=0, faltaram=0;
    for(var i=0;i<pr.nq;i++){
      if(pr.niv[i]!=null) continue;
      var k=codDesc((pr.desc||[])[i]||"");
      if(k && fila[k] && fila[k].length){ pr.niv[i]=fila[k].shift(); preenchidos++; }
      else faltaram++;
    }
    var sobraram=Object.keys(fila).reduce(function(n,k){return n+fila[k].length;},0);
    var g=window.__guarda;
    return {preenchidos:preenchidos, faltaram:faltaram, sobraram:sobraram,
      niv:pr.niv, igualAoOriginal:String(pr.niv)===String(g.niv),
      descIntacto:String(pr.desc)===String(g.desc),
      gabIntacto:pr.gabC===g.gab,
      questoesIntactas:String(pr.questoes.map(function(q){return q.enunciado;}))===String(g.questoes),
      notasIntactas:E.res.filter(function(r){return r.prova===pr.id;})
        .map(function(r){return r.numero+":"+r.acertos;}).sort().join(",")===g.notas,
      corrigidos:resDa(pr.id).length};
  })()`);

  ok(depois.preenchidos === 9,
     "os nove itens receberam o nível (" + depois.preenchidos + ")");
  ok(depois.faltaram === 0 && depois.sobraram === 0,
     "sem sobra nem falta — o casamento por descritor fechou certo");
  ok(depois.igualAoOriginal,
     "e os níveis são EXATAMENTE os da importação original: [" +
     depois.niv + "]");

  /* ── o que não podia ser tocado ── */
  ok(depois.questoesIntactas, "nenhum enunciado foi alterado");
  ok(depois.gabIntacto, "o gabarito canônico segue o mesmo");
  ok(depois.descIntacto, "os descritores seguem os mesmos");
  ok(depois.corrigidos === antes.corrigidos,
     "os " + depois.corrigidos + " cartões corrigidos continuam lá");
  ok(depois.notasIntactas,
     "e com as MESMAS notas — era isso que reimportar destruiria");

  /* ── o teto volta ── */
  const comTeto = J(`tetoDoSimulado([E.simulados[0]],"MAT")`);
  ok(comTeto.minNivel === 6 && comTeto.maxNivel === 9,
     "agora o relatório sabe o teto: do nível " + comTeto.minNivel +
     " ao " + comTeto.maxNivel);
  ok(comTeto.comNivel === 9, "com os nove itens contados");

  /* ── rodar de novo não mexe em nada ── */
  const denovo = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var lido=lerSimuladoDoc(window.__T,null);
    var fila={};
    lido.itens.forEach(function(x){
      if(x.niv==null) return;
      var k=codDesc(x.desc||"");
      (fila[k]=fila[k]||[]).push(x.niv);
    });
    var preenchidos=0;
    for(var i=0;i<pr.nq;i++){
      if(pr.niv[i]!=null) continue;
      var k=codDesc((pr.desc||[])[i]||"");
      if(k && fila[k] && fila[k].length){ pr.niv[i]=fila[k].shift(); preenchidos++; }
    }
    return {preenchidos:preenchidos, niv:pr.niv};
  })()`);
  ok(denovo.preenchidos === 0,
     "rodar de novo não preenche nada — só entra onde está vazio");
  ok(String(denovo.niv) === String(depois.niv), "e os níveis não mudam");

  /* ── item já com nível não é sobrescrito ── */
  const preserva = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    pr.niv[0]=3;                       // valor posto à mão pelo professor
    pr.niv[1]=null;                    // este está faltando
    var lido=lerSimuladoDoc(window.__T,null);
    var fila={};
    lido.itens.forEach(function(x){
      if(x.niv==null) return;
      var k=codDesc(x.desc||"");
      (fila[k]=fila[k]||[]).push(x.niv);
    });
    for(var i=0;i<pr.nq;i++){
      if(pr.niv[i]!=null) continue;
      var k=codDesc((pr.desc||[])[i]||"");
      if(k && fila[k] && fila[k].length) pr.niv[i]=fila[k].shift();
    }
    return {primeiro:pr.niv[0], segundo:pr.niv[1]};
  })()`);
  ok(preserva.primeiro === 3,
     "um nível ajustado à mão não é sobrescrito (segue " +
     preserva.primeiro + ")");
  ok(preserva.segundo != null,
     "e o que faltava foi preenchido (" + preserva.segundo + ")");

  console.log(falhas ? "\nteste65: " + falhas + " FALHA(S)" : "\nteste65: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
