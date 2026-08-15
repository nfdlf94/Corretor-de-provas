/* teste34.js — a TRI de 3 parâmetros distingue PADRÃO de acerto, não só
   quantidade. Dois estudantes com o mesmo número de acertos só têm a
   mesma proficiência se acertaram os mesmos itens.

   E a fronteira que confunde na prática: enquanto não houver cartões
   suficientes, o número mostrado é percentual de acerto — nele, quem
   acerta tudo vai direto ao teto da faixa, quem empata em acertos empata
   em proficiência, e nada muda quando os outros são corrigidos. Isso
   precisa aparecer marcado como provisório. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const E = H.estadoBase(12);
E.turmas[0].nome = "3º Ano A";
H.comSimulado(E, { id:"s1", nLP:8, nMAT:8, codigo:"SIM1", titulo:"1º", ano:2026 });
const pr = E.provas[0], g = pr.gabC;

/* 12 estudantes. Os oito primeiros acertam 4 de 8 em MATEMÁTICA, mas
   itens DIFERENTES: uns acertam os fáceis, outros os difíceis. */
const MAT = [8,9,10,11,12,13,14,15];          // índices canônicos de MAT
const padroes = [
  [0,1,2,3], [0,1,2,3], [0,1,2,3], [0,1,2,3],  // os 4 mais fáceis (todos acertam)
  [4,5,6,7], [4,5,6,7], [0,1,6,7], [2,3,4,5],  // outros padrões, mesmo escore
  [0,1,2,3,4], [0,1,2], [0,1,2,3,4,5], [0,1]
];
padroes.forEach((quais,k) => {
  const a = E.turmas[0].alunos[k];
  const Rc = g.split("").map((L,i) => {
    if (i < 8) return i % 2 === 0 ? L : (L==="A"?"B":"A");   // LP: metade
    const pos = MAT.indexOf(i);
    return quais.includes(pos) ? L : (L==="A"?"B":"A");
  });
  E.res.push({ prova:pr.id, turma:"t1", numero:a.numero, nome:a.nome, R:Rc.slice(), Rc,
    gab:g, acertos:Rc.filter((x,i)=>x===g[i]).length, erros:0, certas:[], erradas:[],
    notaDisc:0, nota:0, origem:"manual", t:Date.now() });
});

const { win } = H.abrirApp({ estado: E });
const ev = s => win.eval(s);
setTimeout(() => {
  console.log("teste34 — a TRI olha o padrão, não só o total");
  const A = JSON.parse(ev('JSON.stringify((function(){var A=apurarComp(E.simulados[0],"MAT");' +
    'return {metodo:A.metodo, media:A.media, itens:A.itens.map(function(i){return {q:i.q,pct:i.pct,b:i.dif,a:i.a};}),' +
    ' linhas:A.feitos.map(function(L){return {n:L.aluno.numero, ac:L.acertos, th:L.theta, prof:L.prof};})};})())'));
  console.log("método:", A.metodo, "| média:", A.media && A.media.toFixed(1));
  console.log("\nnº  acertos  theta   proficiência   padrão de acertos");
  A.linhas.forEach((L,k) => console.log(
    L.n, "   ", L.ac, "     ", L.th==null?"—":L.th.toFixed(2), "   ",
    L.prof==null?"—":L.prof.toFixed(1), "     ", JSON.stringify(padroes[k])));
  console.log("\nitem   % acerto   dificuldade(b na escala)   a");
  A.itens.forEach(i => console.log(" Q"+i.q, "   ", i.pct==null?"—":i.pct.toFixed(0)+"%",
    "        ", i.b==null?"—":i.b.toFixed(1), "     ", i.a==null?"—":i.a.toFixed(2)));

  ok(A.metodo === "tri", "com 12 cartões a TRI roda (veio " + A.metodo + ")");

  const mesmos = A.linhas.filter(L => L.ac === 4);
  const profs = new Set(mesmos.map(L => L.prof.toFixed(2)));
  ok(mesmos.length === 8, "oito estudantes com 4 acertos de 8");
  ok(profs.size >= 4, "eles saem com " + profs.size +
     " proficiências DIFERENTES — o padrão de acerto conta");

  const acha = n => A.linhas.find(L => L.n === n);
  const faceis = acha("01").prof;    // acertou os 4 mais fáceis
  const dificeis = acha("05").prof;  // acertou os 4 mais difíceis
  ok(faceis > dificeis, "acertar os difíceis e errar os fáceis é lido como chute: " +
     dificeis.toFixed(0) + " contra " + faceis.toFixed(0));

  const tres = acha("10").prof, quatro = acha("05").prof;
  ok(tres > quatro, "quem acertou 3 itens coerentes passa na frente de quem acertou 4 " +
     "num padrão improvável (" + tres.toFixed(0) + " contra " + quatro.toFixed(0) + ")");

  const itens = A.itens;
  ok(itens[0].b < itens[itens.length-1].b,
     "item que poucos acertaram tem dificuldade maior (" +
     itens[0].b.toFixed(0) + " → " + itens[itens.length-1].b.toFixed(0) + ")");
  ok(!ev('apurarComp(E.simulados[0],"MAT").provisorio'), "não é marcado como provisório");

  /* ── a fronteira: com poucos cartões, é percentual e precisa avisar ── */
  ev('(function(){ var pr=provaDe("ps1");' +
     ' E.res = E.res.filter(function(r,i){ return i < 5; }); salvar(); })()');
  const B = JSON.parse(ev('JSON.stringify((function(){var A=apurarComp(E.simulados[0],"MAT");' +
    'return {metodo:A.metodo, provisorio:A.provisorio, faltam:A.faltamParaTri,' +
    ' profs:A.feitos.map(function(L){return L.prof;}), acertos:A.feitos.map(function(L){return L.acertos;})};})())'));
  ok(B.metodo === "pct", "com 5 cartões cai para percentual");
  ok(B.provisorio === true, "e o resultado sai marcado como PROVISÓRIO");
  ok(B.faltam === 3, "avisando que faltam 3 cartões (veio " + B.faltam + ")");
  const iguais = B.acertos.filter((a,i) => a === B.acertos[0]).length;
  const profsIguais = B.profs.filter((p,i) => B.acertos[i] === B.acertos[0]);
  ok(new Set(profsIguais.map(p=>p.toFixed(2))).size === 1,
     "no percentual, mesmo número de acertos dá mesma proficiência — é o que o aviso explica");

  /* quem acerta tudo vai ao teto da faixa */
  const teto = JSON.parse(ev('JSON.stringify(faixaDe(E.simulados[0]))'))[1];
  ev('(function(){ var pr=provaDe("ps1"), g=pr.gabC, a=turmaDe("t1").alunos[0];' +
     ' var r=E.res.find(function(x){return x.numero===a.numero;});' +
     ' r.Rc=g.split(""); r.R=g.split(""); r.acertos=g.length; salvar(); })()');
  const C = JSON.parse(ev('JSON.stringify(apurarComp(E.simulados[0],"MAT").feitos[0].prof)'));
  ok(C === teto, "quem acerta tudo no percentual vai ao teto da faixa (" + teto + ")");

  console.log(falhas ? "\nteste34: " + falhas + " FALHA(S)" : "\nteste34: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
