/* teste40.js — o padrão de acerto não pode maquiar a nota.

   Com a dificuldade ancorada na escala, acertar item difícil vale mais.
   A pergunta é se isso abre uma brecha: quem acerta SÓ as dificílimas e
   erra tudo o que é fácil ficaria com nota alta?

   No 3PL não deveria. Item difícil tem o acerto ao acaso embutido (c),
   então acertar um punhado deles errando os fáceis é lido como CHUTE, e
   não como domínio. Esta suíte confere isso com o caderno real do
   professor — 15 itens de Matemática, com os níveis declarados no
   arquivo do simulado. */
"use strict";
const H = require("./harness");
const { execFileSync } = require("child_process");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const txtMAT = execFileSync("pdftotext",
  ["-layout", "/mnt/user-data/uploads/1º_Simulado_-_Matema_tica_.pdf", "-"],
  { encoding:"utf8", maxBuffer: 1e8 });

/* 15 itens, 20 estudantes. Cada perfil aparece 4 vezes para a
   calibração ter gente suficiente. */
const PERFIS = [
  "so_dificeis",   // acerta apenas os 5 itens de nível mais alto
  "so_faceis",     // acerta apenas os 5 de nível mais baixo
  "equilibrado",   // acerta 5 espalhados pela escala
  "quase_tudo",    // acerta 12 dos 15, deixando os mais difíceis
  "nada"           // acerta 1, no nível mais baixo
];

const { win } = H.abrirApp({ estado: H.estadoBase(20) });
const ev = s => win.eval(s);
const J = s => JSON.parse(ev("JSON.stringify(" + s + ")"));

setTimeout(() => {
  console.log("teste40 — o padrão de acerto não maquia a nota");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* monta o caderno a partir do arquivo real */
  ev('casaTurma="t1"; casaSim=criarSimulado(turmaDe("t1")).id;');
  ev('(function(){ var sm=simuladoDe(casaSim); sm.etapa="3EM"; sm.qtd={LP:0,MAT:15};' +
     ' ajustarQuantidade(sm,"LP"); ajustarQuantidade(sm,"MAT"); })()');
  win.__t = txtMAT;
  ev('(function(){ var sm=simuladoDe(casaSim); var L=lerSimuladoDoc(window.__t);' +
     ' aplicarImportacao(sm,"MAT",L.itens.map(function(x,i){x.orig=i+1;return x;}));' +
     ' salvar(); })()');

  const pr = J('provaDoSim(simuladoDe(casaSim))');
  ok(pr.nq === 15, "o caderno tem os 15 itens do arquivo");
  const niveis = pr.niv;
  ok(niveis.filter(Boolean).length === 15, "todos com nível da escala");

  /* ordena os itens por dificuldade oficial */
  const porDif = niveis.map((n,i) => ({ i, n })).sort((a,b) => a.n - b.n);
  const faceis  = porDif.slice(0, 5).map(x => x.i);
  const dificeis = porDif.slice(-5).map(x => x.i);
  const espalhados = [porDif[0].i, porDif[3].i, porDif[7].i, porDif[10].i, porDif[13].i];
  console.log("       níveis do caderno:", niveis.join(" "));
  ok(niveis[dificeis[0]] > niveis[faceis[4]],
     "há itens de níveis bem diferentes no caderno");

  const acertaDe = perfil => {
    if (perfil === "so_dificeis")  return dificeis;
    if (perfil === "so_faceis")    return faceis;
    if (perfil === "equilibrado")  return espalhados;
    if (perfil === "quase_tudo")   return porDif.slice(0, 12).map(x => x.i);
    return [porDif[0].i];
  };

  /* grava as respostas */
  ev('(function(){ var sm=simuladoDe(casaSim), pr=provaDoSim(sm), g=pr.gabC;' +
     ' var perfis=' + JSON.stringify(PERFIS.map(acertaDe)) + ';' +
     ' (turmaDe("t1").alunos||[]).forEach(function(a,k){' +
     '   var certos=perfis[k%5];' +
     '   var Rc=g.split("").map(function(L,i){' +
     '     return certos.indexOf(i)>=0 ? L : (L==="A"?"B":"A"); });' +
     '   E.res.push({prova:pr.id,turma:"t1",numero:a.numero,nome:a.nome,' +
     '     R:Rc.slice(),Rc:Rc,gab:g,acertos:certos.length,erros:15-certos.length,' +
     '     certas:[],erradas:[],notaDisc:0,nota:0,origem:"manual",t:Date.now()}); });' +
     ' salvar(); })()');

  const A = J('(function(){var A=apurarComp(simuladoDe(casaSim),"MAT");' +
    'return {metodo:A.metodo, ancoras:A.ancoras,' +
    ' linhas:A.feitos.map(function(L){return {n:L.aluno.numero, ac:L.acertos,' +
    '  th:L.theta, prof:L.prof, padrao:L.padrao?L.padrao.nome:""};})};})()');

  ok(A.metodo === "tri-ancorada", "a apuração é a TRI ancorada (veio " + A.metodo + ")");
  ok(A.ancoras === 15, "os 15 itens estão ancorados");

  const media = nome => {
    const k = PERFIS.indexOf(nome);
    const sub = A.linhas.filter((_, j) => j % 5 === k);
    return sub.reduce((x, L) => x + L.prof, 0) / sub.length;
  };
  const r = {};
  PERFIS.forEach(p => r[p] = media(p));
  console.log();
  console.log("       perfil            acertos   proficiência");
  console.log("       só as difíceis        5        " + r.so_dificeis.toFixed(0));
  console.log("       só as fáceis          5        " + r.so_faceis.toFixed(0));
  console.log("       equilibrado           5        " + r.equilibrado.toFixed(0));
  console.log("       quase tudo           12        " + r.quase_tudo.toFixed(0));
  console.log("       quase nada            1        " + r.nada.toFixed(0));
  console.log();

  /* ── a pergunta do professor ── */
  ok(r.so_dificeis < r.quase_tudo,
     "quem acertou só as difíceis NÃO passa na frente de quem fez a prova quase toda (" +
     r.so_dificeis.toFixed(0) + " contra " + r.quase_tudo.toFixed(0) + ")");
  ok(r.so_dificeis <= r.equilibrado + 1,
     "nem na frente de quem acertou o mesmo tanto, espalhado pela escala (" +
     r.so_dificeis.toFixed(0) + " contra " + r.equilibrado.toFixed(0) + ")");
  ok(r.so_dificeis < r.so_faceis + 30,
     "acertar só as difíceis não vira vantagem grande sobre acertar só as fáceis");

  /* ── e o que deve valer, continua valendo ── */
  ok(r.quase_tudo > r.equilibrado, "quem acerta mais continua tirando mais");
  ok(r.equilibrado > r.nada, "e quem acerta quase nada fica embaixo");
  ok(r.quase_tudo > r.nada + 60, "a distância entre o topo e a base é grande");

  /* ── continua sendo por aluno, item a item ── */
  const cinco = A.linhas.filter(L => L.ac === 5);
  ok(cinco.length === 12, "doze estudantes com 5 acertos (três perfis diferentes)");
  ok(new Set(cinco.map(L => L.prof.toFixed(1))).size >= 3,
     "e eles saem com " + new Set(cinco.map(L => L.prof.toFixed(1))).size +
     " proficiências distintas — o padrão conta, não só o total");

  /* dois estudantes com o MESMO padrão têm de dar exatamente o mesmo */
  const mesmoPerfil = A.linhas.filter((_, j) => j % 5 === 0);
  ok(new Set(mesmoPerfil.map(L => L.prof.toFixed(4))).size === 1,
     "quem acertou exatamente os mesmos itens tem exatamente a mesma proficiência");

  console.log(falhas ? "\nteste40: " + falhas + " FALHA(S)" : "\nteste40: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
