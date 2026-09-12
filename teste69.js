/* teste69.js — as duas telas têm de dizer o MESMO número.

   Relato, com as duas capturas lado a lado: a mesma turma, no mesmo
   simulado, aparecia com

     aba NOTAS    → 274,1  ·  Elementar II
     aba ANÁLISE  → 198,6  ·  Elementar I

   Setenta e cinco pontos e um padrão de diferença. E a explicação estava
   escrita na própria tela: a de Notas dizia "TRI ANCORADA na escala
   oficial", a de Análise dizia "calibrada com as respostas dos 32
   estudantes deste recorte".

   São dois estimadores. `apurarComp` (Notas) ancora a dificuldade dos
   itens na faixa de pontos do nível oficial; `apurarConjunto` (Análise)
   calibrava só com as respostas da turma e posicionava o grupo pelo
   percentual de acerto.

   A diferença não é de arredondamento, é de significado: sem âncora o
   nível do grupo vem de QUANTOS itens foram acertados; com âncora, vem de
   QUAIS. Num caderno todo difícil, "acertou poucos" e "acertou poucos,
   mas os difíceis" são coisas muito diferentes — e foi por isso que
   preencher os níveis mudou uma tela e não a outra. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(32), {nLP:0, nMAT:9}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste69 — Notas e Análise concordam");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  win.eval("window.__T=" +
    JSON.stringify(fs.readFileSync(__dirname + "/fixture-sim-mat.txt","utf8")) + ";");

  /* o caderno real, a turma de 32, acertos em escada */
  const montar = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    sm.qtd={LP:0,MAT:9}; sm.etapa="3EM";
    var lido=lerSimuladoDoc(window.__T,null);
    var sel=selecionarItens(sm,"MAT",lido.itens);
    aplicarImportacao(sm,"MAT",sel.itens);
    E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    t.alunos.forEach(function(a,i){
      var g=gabaritoDe(t.nome,a.numero); if(!g) return;
      var R=g.split("");
      var errar=Math.min(pr.nq, 9-Math.floor(i/4));
      for(var k=0;k<errar;k++) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
    return {corrigidos:resDa(pr.id).length, niveis:pr.niv};
  })()`);
  ok(montar.corrigidos === 32, montar.corrigidos + " cartões corrigidos");
  ok(montar.niveis.filter(x => x != null).length === 9,
     "e os nove itens com nível — é o que permite ancorar");

  /* ── 1. as duas telas ── */
  const duas = J(`(function(){
    var sm=E.simulados[0];
    var N=apurarComp(sm,"MAT");
    var A=apurarConjunto([sm],"MAT");
    return {
      notas:{media:N.media, padrao:N.padraoMedio.nome, metodo:N.metodo,
             dist:N.dist},
      analise:{media:A.media, padrao:A.padraoMedio.nome, metodo:A.metodo,
               dist:A.dist, ancorado:A.ancorado, nAncoradas:A.nAncoradas}};
  })()`);
  ok(duas.notas.metodo === "tri-ancorada",
     "a aba Notas usa TRI ancorada (" + duas.notas.metodo + ")");
  ok(duas.analise.metodo === "tri-ancorada",
     "e a aba Análise também, agora (" + duas.analise.metodo + ")");
  ok(duas.analise.ancorado === true && duas.analise.nAncoradas === 9,
     "com os nove itens ancorados (" + duas.analise.nAncoradas + ")");
  ok(Math.abs(duas.notas.media - duas.analise.media) < 0.05,
     "e as DUAS dão a mesma proficiência: " + duas.notas.media.toFixed(1) +
     " contra " + duas.analise.media.toFixed(1));
  ok(duas.notas.padrao === duas.analise.padrao,
     "o mesmo padrão nos dois lugares (" + duas.notas.padrao + ")");
  ok(String(duas.notas.dist) === String(duas.analise.dist),
     "e a mesma distribuição pelos padrões: [" + duas.analise.dist + "]");

  /* ── 2. sem os níveis, as duas caem juntas ── */
  /* O ponto não é "ancorar sempre"; é as duas telas fazerem a MESMA
     coisa. Tirados os níveis, nenhuma das duas ancora — e elas continuam
     de acordo. */
  const semNivel = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var guarda=pr.niv.slice();
    pr.niv=new Array(pr.nq).fill(null);
    var N=apurarComp(sm,"MAT"), A=apurarConjunto([sm],"MAT");
    pr.niv=guarda;
    return {notasMetodo:N.metodo, analiseMetodo:A.metodo,
      notasMedia:N.media, analiseMedia:A.media,
      ancorado:A.ancorado};
  })()`);
  ok(semNivel.ancorado === false,
     "sem os níveis, a Análise não ancora");
  ok(semNivel.notasMetodo === semNivel.analiseMetodo,
     "e as duas telas usam o MESMO método (" + semNivel.analiseMetodo + ")");
  ok(Math.abs(semNivel.notasMedia - semNivel.analiseMedia) < 0.05,
     "continuando de acordo: " + semNivel.notasMedia.toFixed(1) + " e " +
     semNivel.analiseMedia.toFixed(1));

  /* ── 3. ancorar MUDA o resultado — não é enfeite ── */
  ok(Math.abs(duas.analise.media - semNivel.analiseMedia) > 5,
     "ancorar muda a proficiência em " +
     Math.abs(duas.analise.media - semNivel.analiseMedia).toFixed(1) +
     " pontos — é por isso que preencher os níveis importa, e era por " +
     "isso que só uma tela mudava");

  /* ── 4. a série também ── */
  const serie = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=E.turmas[0];
    sm.matriz="m1";
    var t2={id:"t2", escola:t.escola, nome:"3º Ano B", serie:t.serie, ativa:true,
      disciplina:t.disciplina, disciplinas:t.disciplinas, periodo:t.periodo,
      alunos:t.alunos.slice(0,20).map(function(a){
        return {numero:a.numero, nome:a.nome+" B", desde:1, ate:null};})};
    E.turmas.push(t2);
    var p2=JSON.parse(JSON.stringify(pr)); p2.id="p2"; p2.turma="t2";
    E.provas.push(p2);
    var s2=JSON.parse(JSON.stringify(sm)); s2.id="s2"; s2.turma="t2";
    s2.prova="p2"; s2.matriz="m1"; E.simulados.push(s2);
    E.ativa=p2.id; aplicarLayout(p2.nq,p2.no);
    t2.alunos.forEach(function(a,i){
      var g=gabaritoDe(t2.nome,a.numero); if(!g) return;
      var R=g.split("");
      var errar=Math.min(p2.nq, 9-Math.floor(i/6));
      for(var k=0;k<errar;k++) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
    var A=apurarConjunto([sm,s2],"MAT");
    return {metodo:A.metodo, ancorado:A.ancorado, alunos:A.alunos,
      turmas:A.turmas.map(function(x){
        return {nome:x.turma.nome, media:Math.round(x.media)};})};
  })()`);
  ok(serie.alunos === 52, "a série reúne " + serie.alunos + " estudantes");
  ok(serie.ancorado === true,
     "e a análise de série ancora também (" + serie.metodo + ")");
  ok(serie.turmas.length === 2 &&
     serie.turmas[0].media !== serie.turmas[1].media,
     "as turmas saem com médias distintas: " +
     serie.turmas.map(x => x.nome + " " + x.media).join(" · ") +
     " — sem âncora, cadernos iguais em turmas diferentes achatavam a " +
     "diferença");

  console.log(falhas ? "\nteste69: " + falhas + " FALHA(S)" : "\nteste69: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1800);
