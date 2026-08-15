/* teste33.js — o mesmo caderno para a série inteira, e a conversão dos
   simulados que já existiam.

   Duas garantias:
   1. Criar na série produz UM caderno só: mesmas questões, mesmo
      gabarito canônico e mesmos `qid` em todas as turmas — e mexer nos
      itens de uma turma muda o de todas. Com isso a TRI conjunta ganha
      itens âncora e volta a distinguir turma melhor de caderno fácil.
   2. A conversão dos simulados antigos NÃO move nota nenhuma e NÃO funde
      turmas: cada uma sorteou o seu, e sem itens em comum não existe
      informação que ligue as escalas. Eles ficam como legado. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

/* três turmas da mesma série */
function base(){
  const E = H.estadoBase(10);
  E.turmas[0].nome = "3º Ano A"; E.turmas[0].serie = "3º ano do Ensino Médio";
  ["B","C"].forEach((L,n) => {
    const t = JSON.parse(JSON.stringify(E.turmas[0]));
    t.id = "t" + (n+2); t.nome = "3º Ano " + L;
    E.turmas.push(t);
  });
  E.descritores = { LP:{D1:"a",D2:"b"}, MAT:{D1:"c",D2:"d"} };
  return E;
}

/* ───────── parte 1: criação na série ───────── */
const E1 = base();
const { win } = H.abrirApp({ estado: E1, confirmar: true });
const ev = s => win.eval(s);
const J = s => JSON.parse(ev("JSON.stringify(" + s + ")"));

setTimeout(() => {
  console.log("teste33 — caderno único por série e conversão do que já existia");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  ok(J('turmasDaSerie(turmaDe("t1")).map(t=>t.nome)').length === 3,
     "as três turmas são reconhecidas como a mesma série");

  const sm = J('criarSimuladoNaSerie(turmaDe("t1"))');
  ok(!!sm.matriz, "o simulado nasce com uma matriz");
  const irmaos = J('E.simulados.filter(x=>x.matriz===' + JSON.stringify(sm.matriz) + ')');
  ok(irmaos.length === 3, "há um registro de simulado por turma (" + irmaos.length + ")");
  ok(new Set(irmaos.map(x=>x.turma)).size === 3, "um para cada turma");
  ok(irmaos.every(x=>x.titulo === sm.titulo && x.ano === sm.ano),
     "todos com o mesmo título e ano");

  /* monta os itens em UMA turma */
  ev('(function(){' +
     ' var pr=provaDoSim(simuladoDe(' + JSON.stringify(sm.id) + '));' +
     ' var lista=[];' +
     ' for(var i=0;i<12;i++) lista.push({comp: i<6?"LP":"MAT",' +
     '   questao:{enunciado:"Enunciado do item "+(i+1), alternativas:["a","b","c","d","e"], correta:i%5, imagem:null},' +
     '   gab:"ABCDE"[i%5], desc:"D"+((i%2)+1), orig:i+1});' +
     ' gravarCaderno(pr,lista); salvar(); })()');

  const cadernos = J('E.simulados.filter(x=>x.matriz===' + JSON.stringify(sm.matriz) + ')' +
    '.map(function(x){var p=provaDoSim(x);' +
    ' return {turma:turmaDe(x.turma).nome, nq:p.nq, gabC:p.gabC,' +
    '  qids:(p.qids||[]).join(","), enunciados:(p.questoes||[]).map(function(q){return q.enunciado;}).join("|")};})');

  ok(cadernos.every(c => c.nq === 12), "as três turmas ficaram com 12 itens");
  ok(new Set(cadernos.map(c=>c.gabC)).size === 1,
     "o gabarito canônico é o mesmo nas três: " + cadernos[0].gabC);
  ok(new Set(cadernos.map(c=>c.enunciados)).size === 1, "as questões são as mesmas");
  ok(new Set(cadernos.map(c=>c.qids)).size === 1, "e carregam os MESMOS qid");
  ok(cadernos[0].qids.split(",").every(q => q && q.length > 3), "os qid são estáveis");

  /* mexer numa turma muda todas */
  ev('(function(){' +
     ' var sm2=E.simulados.filter(function(x){return x.matriz===' + JSON.stringify(sm.matriz) + ';})[1];' +
     ' var pr=provaDoSim(sm2); var lista=itensDoCaderno(pr);' +
     ' lista[0].gab="E"; lista[0].questao.enunciado="Enunciado trocado";' +
     ' gravarCaderno(pr,lista); salvar(); })()');
  const depois = J('E.simulados.filter(x=>x.matriz===' + JSON.stringify(sm.matriz) + ')' +
    '.map(x=>provaDoSim(x).gabC)');
  ok(new Set(depois).size === 1 && depois[0][0] === "E",
     "editar o caderno de uma turma muda o das três (" + depois[0].slice(0,6) + "…)");

  /* o embaralhamento continua por estudante */
  ev('ativar(provaDoSim(simuladoDe(' + JSON.stringify(sm.id) + ')).id);');
  const g1 = ev('gabaritoDe("3º Ano A","01")');
  const g2 = ev('gabaritoDe("3º Ano A","02")');
  const g3 = ev('gabaritoDe("3º Ano B","01")');
  ok(g1 !== g2, "estudantes da mesma turma continuam com ordens diferentes");
  ok(g1 !== g3, "e turmas diferentes também — o caderno é o mesmo, a ordem não");

  /* a TRI conjunta agora tem âncoras */
  ev('(function(){ var letras=["A","B","C","D","E"];' +
     ' E.simulados.filter(function(x){return x.matriz===' + JSON.stringify(sm.matriz) + ';})' +
     ' .forEach(function(s2,k){ var pr=provaDoSim(s2); var g=pr.gabC;' +
     '  (turmaDe(s2.turma).alunos||[]).forEach(function(a,i){' +
     '    var taxa=0.8-0.25*k+0.02*i;' +
     '    var Rc=g.split("").map(function(L,j){ return ((j*7)%pr.nq)<Math.round(pr.nq*taxa)?L:(L==="A"?"B":"A"); });' +
     '    E.res.push({prova:pr.id,turma:s2.turma,numero:a.numero,nome:a.nome,R:Rc.slice(),Rc:Rc,' +
     '      gab:g,acertos:Rc.filter(function(x,j){return x===g[j];}).length,erros:0,certas:[],erradas:[],' +
     '      notaDisc:0,nota:0,origem:"manual",t:Date.now()}); }); }); salvar(); })()');

  const A = J('(function(){var sims=E.simulados.filter(function(x){return x.matriz===' +
    JSON.stringify(sm.matriz) + ';}); var A=apurarConjunto(sims,"LP");' +
    'return {metodo:A.metodo, ancoras:A.ancoras, semAncora:A.semAncora,' +
    ' turmas:A.turmas.map(function(x){return {nome:x.turma.nome, media:x.media, pct:x.pct};})};})()');
  ok(A.ancoras >= 5, "a matriz da TRI ganhou itens âncora (" + A.ancoras + ")");
  ok(A.semAncora === false, "o recorte deixou de ser marcado como sem âncora");
  ok(A.metodo === "tri", "a TRI conjunta volta a ser usada na série");
  const esp = Math.max.apply(null, A.turmas.map(x=>x.media)) -
              Math.min.apply(null, A.turmas.map(x=>x.media));
  ok(esp > 40, "e separa as turmas em " + esp.toFixed(0) + " pontos");
  console.log("       turmas: " + A.turmas.map(x =>
    x.turma_nome || x.nome + " " + x.media.toFixed(0) + " (" + x.pct.toFixed(0) + "%)").join(" · "));

  parte2();
}, 900);

/* ───────── parte 2: conversão do que já existia ───────── */
function parte2(){
  const E2 = base();
  /* dois simulados antigos, sorteios diferentes, SEM qid e SEM matriz */
  [["sa","t1","SORTEIO A"], ["sb","t2","SORTEIO B"]].forEach(([id,tid,pre]) => {
    const letras = ["A","B","C","D","E"];
    const comps = ["LP","LP","LP","LP","MAT","MAT","MAT","MAT"];
    const questoes = comps.map((c,i)=>({ enunciado: pre + "  item " + (i+1) + "  ",
      alternativas: letras.map(L=>"alt "+L), correta:i%5, imagem:null }));
    const gabC = questoes.map(q=>letras[q.correta]).join("");
    E2.provas.push({ id:"p"+id, turma:tid, disciplina:null, codigo:id.toUpperCase(),
      titulo:"1º Simulado", periodo:null, nq:8, no:5, gabC, simulado:id, comps,
      desc:comps.map((c,i)=>"D"+((i%2)+1)), orig:comps.map((c,i)=>i+1),
      gabItens:gabC.split(""), habs:[], questoes, discursivas:[], criada:1 });
    E2.simulados.push({ id, turma:tid, titulo:"1º Simulado", etapa:"3EM", ano:2026,
      prova:"p"+id, metodo:"tri", alternarBlocos:true, tipos:0,
      qtd:{LP:4,MAT:4}, fontes:{}, criado:1, valorParticipacao:1.25, partAluno:{} });
    /* uma nota gravada, para provar que a conversão não a toca */
    E2.res.push({ prova:"p"+id, turma:tid, numero:"01", nome:"Estudante 1",
      R:gabC.split(""), Rc:gabC.split(""), gab:gabC, acertos:8, erros:0,
      certas:[1,2,3,4,5,6,7,8], erradas:[], notaDisc:0, nota:10, origem:"manual", t:1 });
  });
  const antes = JSON.stringify(E2.res);

  const { win: w2 } = H.abrirApp({ estado: E2 });
  const e2 = s => w2.eval(s);
  setTimeout(() => {
    console.log();
    const depois = e2('JSON.stringify(E.res)');
    ok(depois === antes, "a conversão NÃO mexeu em nenhuma nota já gravada");

    const qids = JSON.parse(e2('JSON.stringify(E.provas.filter(ehCaderno).map(p=>p.qids))'));
    ok(qids.every(q => Array.isArray(q) && q.length === 8), "todo caderno antigo ganhou qid");
    ok(new Set(qids[0]).size === 8, "os 8 itens do caderno têm qid distintos");
    ok(qids[0].every((q,i) => q !== qids[1][i]),
       "cadernos de sorteios diferentes têm qid diferentes — não são fundidos");

    const sims = JSON.parse(e2('JSON.stringify(E.simulados.map(s=>({m:s.matriz,l:s.legado})))'));
    ok(sims.every(s => s.m === null), "nenhum simulado antigo ganhou matriz");
    ok(sims.every(s => s.l === true), "todos ficaram marcados como legado");

    /* o qid vem do enunciado: espaço e acento não criam item novo */
    const a = e2('qidDoTexto("  Enunciado   do  item 1 ")');
    const b = e2('qidDoTexto("Enunciado do item 1")');
    const c = e2('qidDoTexto("Enunciádo do item 1")');
    ok(a === b, "espaço a mais não muda o qid");
    ok(a === c, "acento não muda o qid");
    ok(a !== e2('qidDoTexto("Enunciado do item 2")'), "questão diferente, qid diferente");

    /* o recorte legado continua sem âncora e sem TRI conjunta */
    const A2 = JSON.parse(e2('JSON.stringify((function(){var A=apurarConjunto(E.simulados,"LP");' +
      'return {metodo:A.metodo, ancoras:A.ancoras, semAncora:A.semAncora};})())'));
    ok(A2.ancoras === 0 && A2.semAncora === true,
       "o recorte legado continua sem âncoras, como tem de ser");

    console.log(falhas ? "\nteste33: " + falhas + " FALHA(S)" : "\nteste33: tudo certo");
    process.exit(falhas ? 1 : 0);
  }, 900);
}
