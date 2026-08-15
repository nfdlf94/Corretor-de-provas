/* teste28.js — regressão. As mudanças desta versão mexeram em pontos
   compartilhados (a aba Notas, o giro de layout da câmera, a partida do
   app). Esta suíte confere que as provas normais continuam se
   comportando exatamente como antes. */
"use strict";
const H = require("./harness");
const { desenhar } = require("./cartao-sintetico");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

function estado(){
  const E = H.estadoBase(10);
  E.provas.push({ id:"pA", turma:"t1", disciplina:"d1", codigo:"MAT01",
    titulo:"Prova 1", periodo:1, nq:10, no:5, gabC:"ABCDEABCDE",
    habs:[], questoes:[], discursivas:[], pontosObj:10, pontosDisc:0, criada:100 });
  E.provas.push({ id:"pB", turma:"t1", disciplina:"d1", codigo:"MAT02",
    titulo:"Prova 2", periodo:2, nq:15, no:5, gabC:"ABCDEABCDEABCDE",
    habs:[], questoes:[], discursivas:[], pontosObj:10, pontosDisc:0, criada:200 });
  H.comSimulado(E, { nLP:13, nMAT:13 });
  E.ativa = "pA";
  return E;
}

const { win } = H.abrirApp({ estado: estado() });
const ev = s => win.eval(s);

setTimeout(() => {
  console.log("teste28 — regressão das provas normais");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* 1. a aba Notas continua navegando e ativando provas normais */
  ev('irNotas("escola","e1"); irNotas("turma","t1"); irNotas("disc","d1");'+
     'irNotas("per",2); irNotas("prova","pB");');
  ok(ev("E.ativa") === "pB", "abrir uma prova na aba Notas continua ativando-a");
  ok(ev("NQ") === 15, "o layout acompanha a prova aberta em Notas");
  ok(ev("notaNav.prova") === "pB", "o caminho da aba Notas foi gravado");

  /* 2. a guarda nova só impede o roubo quando o ativo é um CADERNO */
  ev('ativar("pA");');
  ok(ev("E.ativa") === "pA", "trocar para outra prova normal continua valendo");
  ok(ev("notaNav.prova") === "pA", "e a aba Notas acompanha a troca");

  ev('ativar("psim1"); pintarResultados();');
  ok(ev("E.ativa") === "psim1", "o caderno ativo NÃO é roubado pela aba Notas");
  ok(ev("notaNav.prova") === "pA", "e notaNav segue apontando para a última prova normal");

  ev('ativar("pB"); pintarResultados();');
  ok(ev("E.ativa") === "pB", "voltar para prova normal continua funcionando");

  /* 3. o seletor das abas Ler e Manual lista as provas normais também */
  win.irPara("man");
  const sel = win.document.getElementById("manSel");
  sel.querySelector("button").click();
  const ids = [...sel.querySelectorAll("[data-sel]")].map(b => b.dataset.sel);
  ok(ids.includes("pA") && ids.includes("pB"), "as provas normais aparecem no seletor");
  ok(ids.includes("psim1"), "o caderno de simulado também aparece");
  const btnA = [...sel.querySelectorAll("[data-sel]")].find(b => b.dataset.sel === "pA");
  btnA.click();
  ok(ev("E.ativa") === "pA", "escolher prova normal pelo seletor funciona");
  ok(win.document.getElementById("manPasso").querySelectorAll("[data-n]").length === 10,
     "a lista de estudantes da prova normal aparece");

  /* 4. correção manual de prova normal, ponta a ponta */
  win.document.getElementById("manPasso").querySelectorAll("[data-n]")[0].click();
  const gab = ev('gabaritoDe("3A","01")');
  ok(gab.length === 10, "gabarito individual de 10 letras");
  const grade = win.document.getElementById("manGridBox");
  for (let q = 0; q < 10; q++){
    const letra = q < 7 ? gab[q] : (gab[q] === "A" ? "B" : "A");
    const b = grade.querySelector('[data-q="'+q+'"][data-o="'+letra+'"]');
    if (b) b.click();
  }
  win.document.getElementById("bEnviaMan").click();
  const reg = JSON.parse(ev('JSON.stringify(E.res.filter(r=>r.prova==="pA"))'));
  ok(reg.length === 1 && reg[0].acertos === 7, "7 acertos de 10 (veio " + (reg[0]||{}).acertos + ")");
  ok(reg[0].nota === 7, "nota 7,0 na escala de 10 pontos (veio " + reg[0].nota + ")");

  /* 5. câmera com prova normal: o cartão de 10 é lido com o layout certo */
  ev('ativar("pA");');
  const turma = "3A", numero = "05";
  const gabInd = win.gabaritoIndividual("ABCDEABCDE", turma, numero, 5, null, false);
  const payload = win.montarPayload("MAT01", gabInd, turma, numero, "Estudante 5", 5);
  const marcadas = gabInd.split("");
  win.__img = desenhar({ nq:10, no:5, payload, marcadas }).imageData();
  ev("(function(){ for(var i=0;i<4;i++) analisar(window.__img,false); })()");
  ok(ev("!!alunoQR"), "o QR da prova normal foi lido");
  ok(ev("alunoQR && alunoQR.numero") === "05", "identificou o nº 05");
  ok(ev("NQ") === 10, "o layout continuou em 10 — não girou à toa");
  const R = JSON.parse(ev("JSON.stringify(atual? atual.R : null)"));
  ok(R && R.length === 10 && R.every((x,i) => x === marcadas[i]),
     "as 10 marcações foram lidas certas");

  /* 6. o giro de formato não muda nada quando só há um formato possível */
  ok(ev('(function(){ var antes=NQ; var r=tentarOutroLayout(); return antes+"/"+NQ+"/"+r; })()')
      .startsWith("10/"), "tentarOutroLayout não quebra com a prova normal ativa");

  /* 7. provasDe continua sem listar cadernos, como manda a invariante */
  const ps = JSON.parse(ev('JSON.stringify(provasDe("t1","d1").map(p=>p.id))'));
  ok(!ps.includes("psim1"), "provasDe() continua excluindo o caderno de simulado");
  ok(ps.includes("pA") && ps.includes("pB"), "e continua trazendo as provas normais");

  /* 8. o caderno não entra na média do período */
  const F = JSON.parse(ev('JSON.stringify(fechamentoDe(turmaDe("t1"),"d1",1).ps.map(p=>p.id))'));
  ok(!F.includes("psim1"), "o simulado não entra no fechamento do período");

  console.log(falhas ? "\nteste28: " + falhas + " FALHA(S)" : "\nteste28: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
