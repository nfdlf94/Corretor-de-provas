/* teste88.js — simulados maiores que 30 itens (20 + 20, 45 + 45…).

   Pedido do professor: um simulado de 20 questões POR disciplina (40 no
   total) não saía, porque o app barrava em 30 itens no total. O teto era
   do CARTÃO-RESPOSTA (layout.js: MAX_Q = 30), e o simulado só repetia
   esse número (SAEPE_MAX). Agora o teto é um só, MAX_Q = 90, e vale para
   o formulário de quantidade, a prova avulsa e a leitura do QR.

   Até 30 itens a geometria do cartão é a mesma de sempre — os cadernos
   já impressos continuam sendo lidos. Acima de 60 itens o cartão passa
   de 3 para 4 colunas, para não ficar mais alto do que a página. */
"use strict";
const H = require("./harness");
const { desenhar } = require("./cartao-sintetico");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const E = H.estadoBase(12);
H.comSimulado(E, { id:"s20", nLP:20, nMAT:20, codigo:"SIM20", titulo:"Simulado 20+20", ano:2026 });
H.comSimulado(E, { id:"s45", nLP:45, nMAT:45, codigo:"SIM45", titulo:"Simulado 45+45", ano:2026 });
H.comSimulado(E, { id:"s15", nLP:15, nMAT:15, codigo:"SIM15", titulo:"Simulado 15+15", ano:2026 });
E.ativa = "ps15";
const { win } = H.abrirApp({ estado: E });
const ev = s => win.eval(s);
const J = s => JSON.parse(ev("JSON.stringify(" + s + ")"));

function lerCartao(idProva, numero){
  const pr = E.provas.find(p => p.id === idProva);
  const gabInd = win.gabaritoIndividual(pr.gabC, "3A", numero, 5, pr.comps, true);
  const payload = win.montarPayload(pr.codigo, gabInd, "3A", numero, "Estudante "+(+numero), 5);
  win.__img = desenhar({ nq: pr.nq, no:5, payload, marcadas: gabInd.split("") }).imageData();
  ev('alunoQR=null; travado=null; atual=null; hist=[]; semQR=0;');
  /* ao vivo: se o cartão não casa com o layout ativo, o app gira os
     formatos conhecidos a cada 28 quadros — é assim que a câmera acha */
  ev("(function(){ for(var i=0;i<120 && !alunoQR;i++) analisar(window.__img,true);"+
     " for(var j=0;j<6;j++) analisar(window.__img,true); })()");
  return { marcadas: gabInd.split(""), pr };
}

setTimeout(() => {
  console.log("teste88 — simulados acima de 30 itens");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. um teto só ── */
  ok(ev("SAEPE_MAX") === 90 && ev("MAX_Q") === 90, "teto único de 90 itens (cartão e simulado)");
  ok(ev('(function(){try{montarLayout(90,5);return 1}catch(e){return 0}})()') === 1, "cartão de 90 itens é montado");
  ok(ev('(function(){try{montarLayout(91,5);return 1}catch(e){return 0}})()') === 0, "91 itens é recusado");
  ok(ev('(function(){try{montarLayout(4,5);return 1}catch(e){return 0}})()') === 0, "4 itens continua recusado");

  /* ── 2. cartões até 30 itens não mudaram de geometria ── */
  const g30 = J("montarLayout(30,5)");
  ok(g30.compacto === true && g30.groups.length === 3, "30 itens: perfil compacto, 3 colunas (como antes)");
  const g40 = J("montarLayout(40,5)");
  ok(g40.groups.length === 3 && g40.box_h < 100, "40 itens: 3 colunas, cartão com " + g40.box_h.toFixed(0) + " mm de altura");
  const g90 = J("montarLayout(90,5)");
  ok(g90.groups.length === 4 && g90.box_h < 150 && g90.box_w + 2*g90.quiet_zone < 186,
     "90 itens: 4 colunas, " + g90.box_w.toFixed(0) + " × " + g90.box_h.toFixed(0) + " mm — cabe na folha A4");

  /* ── 3. a leitura de TODOS os formatos de 31 a 90 itens ── */
  const ruins = [];
  for (let nq = 31; nq <= 90; nq++) for (const no of [4,5]){
    ev("aplicarLayout("+nq+","+no+")");
    const g = "ABCDE".slice(0,no).repeat(20).slice(0,nq);
    win.__img = desenhar({ nq, no, marcadas:g.split(""), escala:10,
      payload: "DBM4|X|"+g+"|3A|01|E|"+nq+"x"+no }).imageData();
    const lido = ev("(function(){try{var s=cinza(window.__img);var q=fiduciais(reduzir(s,620)); if(!q) return 'SEM CARTAO';var L=lerBolhas(s,q); return L?L.R.join(''):'SEM BOLHAS';}catch(e){return 'ERRO '+e.message;}})()");
    if (lido !== g) ruins.push(nq+"x"+no);
  }
  ok(ruins.length === 0, "os 120 formatos de 31 a 90 itens são lidos certos" + (ruins.length ? " — falharam: "+ruins.join(", ") : ""));

  /* ── 4. o QR com gabarito longo é lido, mesmo com resolução baixa ── */
  const qrRuim = [];
  for (const nq of [40, 60, 61, 90]){
    const g = "ABCDE".repeat(20).slice(0,nq);
    win.__img = desenhar({ nq, no:5, marcadas:g.split(""), escala:5,
      payload: "DBM4|3ANOA-SAEPE-26|"+g+"|3A|01|NOME COMPLETO DO ESTUDANTE|"+nq+"x5" }).imageData();
    const n = ev("(function(){var r=jsQR(window.__img.data,window.__img.width,window.__img.height);return r?r.data.length:0;})()");
    if (!n) qrRuim.push(nq);
  }
  ok(qrRuim.length === 0, "o QR de 40, 60, 61 e 90 itens é decodificado a 5 px/mm" + (qrRuim.length ? " — falhou: "+qrRuim : ""));

  /* ── 5. o fluxo completo da câmera: 20+20 e 45+45 ── */
  let C = lerCartao("ps20", "05");
  ok(ev("E.ativa") === "ps20" && ev("NQ") === 40, "cartão de 20+20: ativou o simulado e o layout foi para 40");
  let R = J("atual?atual.R:null");
  ok(R && R.length === 40 && R.every((x,i)=>x===C.marcadas[i]), "as 40 respostas foram lidas certas");
  C = lerCartao("ps45", "07");
  console.log("         diag 45+45:", ev("E.ativa"), ev("NQ"), JSON.stringify(J("atual?atual.R.length:null")), ev("typeof travado"));
  ok(ev("E.ativa") === "ps45" && ev("NQ") === 90, "cartão de 45+45: ativou o simulado e o layout foi para 90");
  R = J("atual?atual.R:null");
  ok(R && R.length === 90 && R.every((x,i)=>x===C.marcadas[i]), "as 90 respostas foram lidas certas");
  C = lerCartao("ps15", "02");
  ok(ev("E.ativa") === "ps15" && ev("NQ") === 30, "e a volta para o de 15+15 continua funcionando");

  /* ── 6. a tela de quantidade aceita 20 + 20 sem reclamar ── */
  ev("simuladoDe('s20').maxPaginas=0;");
  ev("casaTurma='t1'; casaSim='s20'; casaNivel='simulado'; montarCasa();");
  const doc = win.document;
  const inLP = doc.querySelector("#smQLP"), inMAT = doc.querySelector("#smQMAT");
  ok(!!inLP && inLP.value === "20" && inLP.max === "90", "campo de Português mostra 20 e aceita até 90");
  const achado = (doc.querySelector("#casaCorpo").textContent.match(/.{0,60}(acima do limite|comporta até).{0,40}/)||[""])[0];
  ok(!achado, "sem aviso de limite para 20 + 20" + (achado ? " — apareceu: "+achado : ""));
  inLP.value = "25"; inLP.onchange();
  ok(ev("simuladoDe('s20').qtd.LP") === 25, "digitar 25 grava 25 (antes o app cortava em 30 no total)");
  const inLP2 = doc.querySelector("#smQLP"); inLP2.value = "20"; inLP2.onchange();
  ok(ev("simuladoDe('s20').qtd.LP") === 20, "e voltar a 20 também");
  ev("simuladoDe('s20').qtd.LP=50; simuladoDe('s20').qtd.MAT=50; montarCasa();");
  ok(/acima do limite|comporta até 90/.test(doc.querySelector("#casaCorpo").textContent), "100 itens no total: o aviso aparece, com o teto de 90");
  ev("simuladoDe('s20').qtd.LP=20; simuladoDe('s20').qtd.MAT=20;");

  /* ── 7. o PDF de 20+20 é gerado: cartão de 40 itens na primeira página ── */
  const pdf = J(`(function(){
    var sm=simuladoDe("s20"), pr=provaDoSim(sm), t=turmaDe(sm.turma);
    var d=gerarProvas(cfgDoCaderno(sm,pr,t), t.alunos.slice(0,3), window.jspdf.jsPDF);
    return {nq:pr.nq, pgs:d.paginasPorAluno, total:d.getNumberOfPages(), corpo:d.corpoUsado};
  })()`);
  ok(pdf.nq === 40 && pdf.total >= 3, "gerarProvas montou o caderno de 40 itens (" + pdf.pgs + " pág./estudante, corpo " + pdf.corpo + " pt)");
  const pdf90 = J(`(function(){
    var sm=simuladoDe("s45"), pr=provaDoSim(sm), t=turmaDe(sm.turma);
    var d=gerarProvas(cfgDoCaderno(sm,pr,t), t.alunos.slice(0,2), window.jspdf.jsPDF);
    return {nq:pr.nq, pgs:d.paginasPorAluno, total:d.getNumberOfPages()};
  })()`);
  ok(pdf90.nq === 90 && pdf90.total >= 2, "e o de 90 itens também (" + pdf90.pgs + " pág./estudante)");
  const folhas = J(`(function(){
    var sm=simuladoDe("s20"), pr=provaDoSim(sm), t=turmaDe(sm.turma);
    var d=gerarFolhasDeCartoes(cfgDoCaderno(sm,pr,t), t.alunos);
    return d.getNumberOfPages();
  })()`);
  ok(folhas >= 1, "a folha avulsa de cartões de 40 itens sai (" + folhas + " página/s)");

  /* ── 8. o QR de 40 itens é aceito por aplicarQR (a regra que antes cortava em 30) ── */
  const gab40 = "ABCDE".repeat(8);
  ev("E.ativa=null");
  ok(ev('aplicarQR("DBM4|SIM20|'+gab40+'|3A|01|X|40x5")') !== false, "aplicarQR aceita gabarito de 40 letras");
  ok(ev('aplicarQR("DBM4|SIM20|'+"A".repeat(91)+'|3A|01|X|91x5")') === false, "e recusa 91 letras");
  console.log(falhas ? "\nteste88: " + falhas + " FALHA(S)" : "\nteste88: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
