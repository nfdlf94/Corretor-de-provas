/* teste23.js — corrigir um caderno de simulado PELA ABA MANUAL.
   Reproduz o cenário real: o professor acabou de corrigir uma prova
   normal (é ela que está ativa) e agora quer lançar à mão o cartão de um
   estudante no simulado. A aba Manual não usa câmera nenhuma — se falhar
   aqui, o problema não é o motor de visão. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

/* estado: uma prova normal ativa + um caderno de simulado de 26 itens */
function montarEstado(){
  const E = H.estadoBase(12);
  E.provas.push({ id:"pNormal", turma:"t1", disciplina:"d1", codigo:"MAT01",
    titulo:"Prova de Matemática", periodo:1, nq:10, no:5,
    gabC:"ABCDEABCDE", habs:[], questoes:[], discursivas:[], criada: Date.now()-1000 });
  H.comSimulado(E, { nLP:13, nMAT:13 });
  E.ativa = "pNormal";                        // é a prova normal que está ativa
  return E;
}

const { win } = H.abrirApp({ estado: montarEstado() });
const ev = s => win.eval(s);

setTimeout(() => {
  console.log("teste23 — correção de simulado pela aba Manual");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");
  ok(ev("E.ativa") === "pNormal", "a prova ativa é a prova normal");

  win.irPara("man");

  /* 1. o caderno precisa ser alcançável de dentro da aba Manual */
  const sel = win.document.getElementById("manSel");
  ok(!!sel, "a aba Manual tem seletor de prova");
  const abrir = sel && sel.querySelector("button");
  if (abrir) abrir.click();                    // abre a lista
  const itens = sel ? [...sel.querySelectorAll("[data-sel]")] : [];
  ok(itens.length > 0, "o seletor lista as provas da turma");
  const doSim = itens.find(b => b.dataset.sel === "psim1");
  ok(!!doSim, "o CADERNO DE SIMULADO aparece na lista da aba Manual");

  /* 2. escolher o caderno tem de ativá-lo e trocar o layout */
  if (doSim) doSim.click();
  ok(ev("E.ativa") === "psim1", "escolher o simulado o torna a prova ativa");
  ok(ev("NQ") === 26, "o layout ativo passa a ser o do caderno (26 itens)");

  /* 3. a lista de estudantes do simulado aparece */
  const box = win.document.getElementById("manPasso");
  const alunos = box.querySelectorAll("[data-n]");
  ok(alunos.length === 12, "os 12 estudantes aparecem para escolha (veio " + alunos.length + ")");

  /* 4. lançar as respostas de um estudante e conferir a nota */
  if (alunos.length) alunos[2].click();        // estudante nº 03
  const gab = ev('gabaritoDe("3A","03")');
  ok(typeof gab === "string" && gab.length === 26, "gabarito individual de 26 letras");

  const grade = win.document.getElementById("manGridBox");
  ok(!!grade, "a grade de marcação do simulado é desenhada");
  const linhas = grade ? grade.querySelectorAll(".opt").length - 1 : 0;
  ok(linhas === 26, "a grade tem 26 linhas (veio " + linhas + ")");

  /* marca a alternativa certa nas 20 primeiras e erra as 6 últimas */
  let marcadas = 0;
  for (let q = 0; q < 26; q++){
    const letra = q < 20 ? gab[q] : (gab[q] === "A" ? "B" : "A");
    const b = grade.querySelector('[data-q="'+q+'"][data-o="'+letra+'"]');
    if (b){ b.click(); marcadas++; }
  }
  ok(marcadas === 26, "todas as 26 questões puderam ser marcadas");

  win.document.getElementById("bEnviaMan").click();

  const reg = ev('JSON.stringify(E.res.filter(r=>r.prova==="psim1"))');
  const res = JSON.parse(reg);
  ok(res.length === 1, "o registro do simulado foi gravado");
  ok(res[0] && res[0].acertos === 20, "20 acertos de 26 (veio " + (res[0]||{}).acertos + ")");
  ok(res[0] && res[0].origem === "manual", "origem gravada como manual");
  ok(res[0] && res[0].Rc && res[0].Rc.length === 26, "respostas canônicas gravadas");

  /* 5. a apuração por componente enxerga o registro */
  const porComp = ev('(function(){try{ var p=provaDe("psim1");'+
    'return JSON.stringify(COMPONENTES.map(c=>itensDe(p,c.id).length)); }catch(e){return "erro:"+e.message;}})()');
  ok(porComp === "[13,13]", "o caderno continua com 13 + 13 itens (" + porComp + ")");

  console.log(falhas ? "\nteste23: " + falhas + " FALHA(S)" : "\nteste23: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
