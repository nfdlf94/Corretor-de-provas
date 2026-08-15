/* teste29.js — o leitor diante de simulados de TAMANHOS DIFERENTES.
   Um simulado de 15 itens, um de 26 e um de 30, na mesma turma, e o
   professor com qualquer um deles ativo. Confere que o cartão certo é
   lido em todos os casos, que o app não confunde um caderno com outro e
   que os limites de tamanho são respeitados. */
"use strict";
const H = require("./harness");
const { desenhar } = require("./cartao-sintetico");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

function estado(){
  const E = H.estadoBase(12);
  E.provas.push({ id:"pNormal", turma:"t1", disciplina:"d1", codigo:"MAT01",
    titulo:"Prova comum", periodo:1, nq:10, no:5, gabC:"ABCDEABCDE",
    habs:[], questoes:[], discursivas:[], criada:1 });
  H.comSimulado(E, { id:"sA", nLP:8,  nMAT:7,  codigo:"SIMA", titulo:"Simulado A", ano:2026 });
  H.comSimulado(E, { id:"sB", nLP:13, nMAT:13, codigo:"SIMB", titulo:"Simulado B", ano:2026 });
  H.comSimulado(E, { id:"sC", nLP:15, nMAT:15, codigo:"SIMC", titulo:"Simulado C", ano:2026 });
  E.ativa = "pNormal";
  return E;
}

const est = estado();
const { win } = H.abrirApp({ estado: est });
const ev = s => win.eval(s);

/* lê o cartão de um caderno com o app na condição em que estiver */
function lerCartao(idProva, numero){
  const pr = est.provas.find(p => p.id === idProva);
  const gabInd = win.gabaritoIndividual(pr.gabC, "3A", numero, 5, pr.comps, true);
  const payload = win.montarPayload(pr.codigo, gabInd, "3A", numero, "Estudante "+(+numero), 5);
  const marcadas = gabInd.split("");
  win.__img = desenhar({ nq: pr.nq, no:5, payload, marcadas }).imageData();
  ev('alunoQR=null; travado=null; atual=null; hist=[]; semQR=0;');
  ev("(function(){ for(var i=0;i<6;i++) analisar(window.__img,false); })()");
  return { marcadas, gabInd, pr };
}

setTimeout(() => {
  console.log("teste29 — simulados de quantidades diferentes");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const tamanhos = JSON.parse(ev('JSON.stringify(E.provas.map(p=>p.nq))'));
  ok(tamanhos.join(",") === "10,15,26,30", "os quatro tamanhos existem: " + tamanhos.join(", "));

  /* os formatos conhecidos precisam cobrir os quatro */
  const fmts = JSON.parse(ev('JSON.stringify(formatosConhecidos().map(f=>f.k))'));
  ok(fmts.length === 4, "formatosConhecidos vê os 4 formatos (" + fmts.join(" ") + ")");

  /* 1. o de 15 itens, com a prova comum de 10 ativa */
  let C = lerCartao("psA", "04");
  ok(ev("E.ativa") === "psA", "cartão de 15 itens: ativou o Simulado A");
  ok(ev("NQ") === 15, "layout foi para 15");
  let R = JSON.parse(ev("JSON.stringify(atual?atual.R:null)"));
  ok(R && R.length === 15 && R.every((x,i)=>x===C.marcadas[i]), "as 15 respostas foram lidas certas");

  /* 2. o de 26, agora com o de 15 ativo — perfis diferentes:
        15 é do perfil clássico, 26 é do compacto */
  ok(ev("layoutNormalizado(15,5).n_questions") === 15, "layout normalizado de 15 itens");
  C = lerCartao("psB", "07");
  ok(ev("E.ativa") === "psB", "cartão de 26 itens: ativou o Simulado B");
  ok(ev("NQ") === 26 && ev("montarLayout(26,5).compacto") === true, "layout foi para 26, perfil compacto");
  R = JSON.parse(ev("JSON.stringify(atual?atual.R:null)"));
  ok(R && R.length === 26 && R.every((x,i)=>x===C.marcadas[i]), "as 26 respostas foram lidas certas");

  /* 3. o de 30 — o teto do cartão — com o de 26 ativo.
        Os dois são compactos: a diferença está só no número de linhas. */
  C = lerCartao("psC", "11");
  ok(ev("E.ativa") === "psC", "cartão de 30 itens: ativou o Simulado C");
  ok(ev("NQ") === 30, "layout foi para 30");
  R = JSON.parse(ev("JSON.stringify(atual?atual.R:null)"));
  ok(R && R.length === 30 && R.every((x,i)=>x===C.marcadas[i]), "as 30 respostas foram lidas certas");

  /* 4. voltar para o menor, de 15, vindo do maior */
  C = lerCartao("psA", "02");
  ok(ev("E.ativa") === "psA" && ev("NQ") === 15, "voltou para o de 15 sem ajuda");
  R = JSON.parse(ev("JSON.stringify(atual?atual.R:null)"));
  ok(R && R.every((x,i)=>x===C.marcadas[i]), "leitura certa na volta");

  /* 5. a prova comum de 10 continua sendo lida no meio dos simulados */
  const gabN = win.gabaritoIndividual("ABCDEABCDE","3A","09",5,null,false);
  win.__img = desenhar({ nq:10, no:5,
    payload: win.montarPayload("MAT01",gabN,"3A","09","Estudante 9",5),
    marcadas: gabN.split("") }).imageData();
  ev('alunoQR=null; travado=null; atual=null; hist=[]; semQR=0;');
  ev("(function(){ for(var i=0;i<6;i++) analisar(window.__img,false); })()");
  ok(ev("E.ativa") === "pNormal" && ev("NQ") === 10, "a prova comum de 10 voltou a ser lida");

  /* 6. cada leitura foi para o caderno certo — nada de nota trocada */
  ["psA","psB","psC"].forEach(id => {
    const n = JSON.parse(ev('JSON.stringify(E.res.filter(r=>r.prova==="'+id+'").length)'));
    ok(n === 0, "nenhuma correção gravada por engano em " + id + " (só lemos, não salvamos)");
  });

  /* 7. os limites do cartão */
  ok(ev('(function(){try{montarLayout(31,5);return "passou";}catch(e){return "recusou";}})()') === "recusou",
     "o cartão recusa 31 itens — acima do teto de 30");
  ok(ev('(function(){try{montarLayout(4,5);return "passou";}catch(e){return "recusou";}})()') === "recusou",
     "o cartão recusa 4 itens — abaixo do mínimo de 5");
  ok(ev("SAEPE_MAX") === 30, "o simulado é barrado no mesmo teto de 30 itens");

  /* 8. o QR carrega a assinatura do layout: um payload de 30 não é
        aceito como se fosse de 26 */
  const ass = ev('lerAssinatura(montarPayload("SIMC","'+("A".repeat(30))+'","3A","01","X",5).split("|")[6])');
  ok(JSON.parse(ev('JSON.stringify('+JSON.stringify(ass)+')')).nq === 30,
     "a assinatura do QR declara 30 itens");

  /* 9. varredura: TODOS os formatos que o app aceita, de 5 a 30 itens,
        com 4 e com 5 alternativas. Foi assim que apareceram as duas
        colisões de geometria (a bolha da última alternativa encostando no
        marcador do canto, e o QR encostando no marcador de baixo). */
  let ruins = [];
  for (let nq = 5; nq <= 30; nq++) for (const no of [4,5]){
    ev("aplicarLayout("+nq+","+no+")");
    const g = "ABCDE".slice(0,no).repeat(7).slice(0,nq);
    win.__img = desenhar({ nq, no, marcadas:g.split(""), escala:10,
      payload: "DBM4|X|"+g+"|3A|01|E|"+nq+"x"+no }).imageData();
    const lido = ev("(function(){try{var s=cinza(window.__img);"+
      "var q=fiduciais(reduzir(s,620)); if(!q) return 'SEM CARTAO';"+
      "var L=lerBolhas(s,q); return L?L.R.join(''):'SEM BOLHAS';"+
      "}catch(e){ return 'ERRO '+e.message; }})()");
    if (lido !== g) ruins.push(nq+"x"+no+" ("+lido+")");
  }
  ok(ruins.length === 0, "os 52 formatos de 5 a 30 itens são lidos corretamente" +
     (ruins.length ? " — falharam: " + ruins.join(", ") : ""));

  console.log(falhas ? "\nteste29: " + falhas + " FALHA(S)" : "\nteste29: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
