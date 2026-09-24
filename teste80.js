/* teste80.js — trocar uma questão por outra do mesmo descritor.

   Pedido do professor: "tem uma questão que eu não curti. Queria clicar
   em trocar para outra, e que automaticamente você selecionasse outra do
   mesmo descritor."

   A fonte é `sm.reserva[comp]` — até 60 questões do arquivo importado,
   já guardadas desde a v?? para o ajuste automático de páginas
   (`trocasPossiveis`). Esta função é a mesma ideia, sem a exigência de
   texto menor: aqui o motivo é gosto, não espaço.

   Testado montando a tela de verdade e clicando no botão — não só lendo
   texto no arquivo (lição da v85 e da v92). */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(4), {nLP:0, nMAT:5}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste80 — trocar questão pelo mesmo descritor");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── cenário: caderno de 5, reserva com candidatas de D22 ── */
  const montar = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    pr.nq=5; pr.no=5; pr.gabC="ABCDE";
    pr.desc=["D17","D22","D22","D23","D24"];
    pr.comps=["MAT","MAT","MAT","MAT","MAT"];
    pr.questoes=pr.desc.map(function(d,i){
      return {enunciado:d+" original "+i, alternativas:["a","b","c","d","e"]};});
    pr.orig=[1,2,3,4,5];
    E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    sm.reserva={MAT:[
      {questao:{enunciado:"D22 original 2",alternativas:["a","b","c","d","e"]},
       gab:"B",desc:"D22",niv:6,orig:2},          // já em uso na posição 2
      {questao:{enunciado:"D22 original 3",alternativas:["a","b","c","d","e"]},
       gab:"C",desc:"D22",niv:6,orig:3},          // livre
      {questao:{enunciado:"D22 extra do arquivo",alternativas:["a","b","c","d","e"]},
       gab:"D",desc:"D22",niv:7,orig:8},          // livre
      {questao:{enunciado:"D17 original 1",alternativas:["a","b","c","d","e"]},
       gab:"A",desc:"D17",niv:5,orig:1}
    ]};
    return {nq:pr.nq};
  })()`);
  ok(montar.nq === 5, "caderno de 5 questões montado");

  /* ── 1. o botão aparece, com a contagem certa ── */
  const tela = J(`(function(){
    var sm=E.simulados[0];
    casaSim=sm.id; casaNivel="conferir"; montarCasa();
    var btn=document.querySelector('[data-tq="1"]');
    return {existe:!!btn, texto:btn?btn.textContent.trim():null};
  })()`);
  ok(tela.existe, "o botão \"Trocar\" aparece na questão de D22");
  ok(/2 disponíveis/.test(tela.texto),
     "e mostra 2 disponíveis — a 3ª candidata do arquivo já está em uso " +
     "na posição 3, então não conta (\"" + tela.texto + "\")");

  /* ── 2. clicar troca SÓ aquela posição ── */
  const clique = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var btn=document.querySelector('[data-tq="1"]');
    btn.onclick();
    var depois=itensDoCaderno(pr);
    return {
      enunciadoNovo:depois[1].questao.enunciado,
      descManteve:depois[1].desc, gabNovo:depois[1].gab, origNovo:depois[1].orig,
      restoIntacto:depois.filter(function(x,i){return i!==1;})
        .map(function(x){return x.questao.enunciado;})};
  })()`);
  ok(clique.enunciadoNovo === "D22 original 3",
     "a questão trocou para a primeira candidata LIVRE (\"D22 original 2\" " +
     "está em uso na posição 3 e foi pulada): " + clique.enunciadoNovo);
  ok(clique.descManteve === "D22", "o descritor continua D22");
  ok(clique.gabNovo === "C" && clique.origNovo === 3,
     "gabarito e origem vêm da nova questão (" + clique.gabNovo + ", #" +
     clique.origNovo + ")");
  ok(JSON.stringify(clique.restoIntacto) ===
     JSON.stringify(["D17 original 0","D22 original 2","D23 original 3","D24 original 4"]),
     "e as outras quatro posições não foram tocadas: " +
     clique.restoIntacto.join(" | "));

  /* ── 3. clicar de novo troca para OUTRA candidata ── */
  const segundoClique = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    casaNivel="conferir"; montarCasa();
    var btn=document.querySelector('[data-tq="1"]');
    var textoAntes=btn.textContent;
    btn.onclick();
    return {texto:textoAntes,
      enunciado:itensDoCaderno(pr)[1].questao.enunciado};
  })()`);
  ok(/1 dispon/.test(segundoClique.texto),
     "na segunda vez, só resta 1 candidata (a que acabou de sair também " +
     "conta como \"em uso\" em outro lugar do arquivo, não mais aqui)");
  ok(segundoClique.enunciado === "D22 extra do arquivo",
     "e o segundo clique pega a outra candidata: " + segundoClique.enunciado);

  /* ── 4. sem candidata, mensagem clara e nada muda ── */
  const semCand = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    sm.reserva={MAT:[]};
    var antes=itensDoCaderno(pr)[0].questao.enunciado;
    var r=trocarQuestaoDoCaderno(sm,0);
    var depois=itensDoCaderno(pr)[0].questao.enunciado;
    return {ok:r.ok, motivo:r.motivo, mudou:antes!==depois};
  })()`);
  ok(semCand.ok === false, "sem candidata na reserva, a troca não acontece");
  ok(/D17/.test(semCand.motivo||""),
     "e diz qual descritor não tinha mais opção: \"" + semCand.motivo + "\"");
  ok(semCand.mudou === false, "a questão original continua intacta");

  /* ── 5. já usada em QUALQUER lugar do caderno não é oferecida de novo ── */
  const jaUsada = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    /* a reserva só tem uma candidata de D23, e ela é IDÊNTICA à questão
       que já está na posição 3 */
    sm.reserva={MAT:[{questao:{enunciado:"D23 original 3",
      alternativas:["a","b","c","d","e"]}, gab:"D", desc:"D23", niv:6, orig:4}]};
    var cand=candidatosParaTrocar(sm,pr,3);
    return {qtd:cand.length};
  })()`);
  ok(jaUsada.qtd === 0,
     "uma candidata cujo texto já está em uso no caderno não é oferecida, " +
     "mesmo vindo de uma posição diferente do arquivo");

  /* ── 6. cartão já corrigido: pede confirmação e RESPEITA a recusa ── */
  const comCorrecao = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    sm.reserva={MAT:[{questao:{enunciado:"D24 nova",
      alternativas:["a","b","c","d","e"]}, gab:"E", desc:"D24", niv:6, orig:9}]};
    registrar({numero:t.alunos[0].numero, nome:"X",
      R:["A","B","C","D","E"], origem:"qr"});
    casaNivel="conferir"; montarCasa();
    window.confirm=function(){ return false; };  // o professor recusa
    var btn=document.querySelector('[data-tq="4"]');
    var antes=itensDoCaderno(pr)[4].questao.enunciado;
    btn.onclick();
    return {existiaBotao:!!btn,
      naoMudou:itensDoCaderno(pr)[4].questao.enunciado===antes};
  })()`);
  ok(comCorrecao.existiaBotao, "o botão aparece mesmo com cartão corrigido");
  ok(comCorrecao.naoMudou,
     "mas recusando a confirmação, a troca NÃO acontece");

  /* ── 7. questão sem descritor não oferece troca ── */
  const semDesc = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    pr.desc[0]="";
    casaNivel="conferir"; montarCasa();
    var btn=document.querySelector('[data-tq="0"]');
    pr.desc[0]="D17";
    return {existe:!!btn};
  })()`);
  ok(!semDesc.existe,
     "sem descritor não há como saber \"outra igual a quê\" — o botão " +
     "não aparece");

  console.log(falhas ? "\nteste80: " + falhas + " FALHA(S)" : "\nteste80: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
