/* teste79.js — evolução dos descritores entre simulados.

   Completa o pedido da v89: "além da distribuição equilibrada, o sistema
   deve considerar o histórico de evolução dos descritores — quais estão
   evoluindo mais rápido e quais mais devagar — para orientar os próximos
   simulados".

   Um simulado só não tem evolução: há um ponto, não uma reta. Por isso a
   suíte monta DOIS simulados corrigidos da mesma turma, com percentuais
   de acerto EXATOS por descritor (controlados item a item, via
   `ordemDe`, para não depender de como o embaralho posiciona cada
   questão no caderno de cada estudante):

     D17 — vai mal nos dois simulados (20% → 30%): evolução LENTA
     D22 — vai mal e piora (60% → 20%): PIORANDO
     D23 — decola (40% → 90%): evolução RÁPIDA
     D24 — só aparece no 2º: ponto novo, sem variação */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(6), {nLP:0, nMAT:10}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

/* corrige um estudante contra os índices ORIGINAIS que devem sair
   errados (`erradosOrig`), usando ordemDe para saber em que POSIÇÃO do
   caderno daquele estudante cada índice original caiu */
const helper = `
function corrigirAlvo(pr, turma, numero, erradosOrig){
  var o=ordemDe(pr,turma,numero);
  var g=gabaritoDe(turma,numero).split("");
  var R=g.slice();
  o.oq.forEach(function(origIdx,pos){
    if(erradosOrig.indexOf(origIdx)>=0) R[pos]=(R[pos]==="A"?"B":"A");
  });
  registrar({numero:numero, nome:"E"+numero, R:R, origem:"qr"});
}`;

setTimeout(() => {
  console.log("teste79 — evolução entre simulados");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");
  win.eval(helper);

  const cenario1 = J(`(function(){
    var sm1=E.simulados[0], pr1=provaDoSim(sm1), t=turmaDe(sm1.turma);
    sm1.qtd={LP:0,MAT:10}; sm1.etapa="3EM"; sm1.titulo="1º Simulado";
    sm1.criado=1000;
    pr1.desc=["D17","D17","D17","D17","D22","D22","D22","D23","D23","D23"];
    pr1.niv=[6,6,6,6,7,7,7,7,7,7];
    pr1.comps=new Array(10).fill("MAT");
    pr1.questoes=pr1.desc.map(function(d,i){
      return {enunciado:d+" q"+i, alternativas:["a","b","c","d","e"],
        correta:null, imagem:null};});
    pr1.habs=pr1.desc.map(function(d){return "MAT "+d;});
    E.ativa=pr1.id; aplicarLayout(pr1.nq,pr1.no);

    var alunos=t.alunos.slice(0,5).map(function(a){return a.numero;});
    /* D17=[0,1,2,3] D22=[4,5,6] D23=[7,8,9]
       20% de D17: só o aluno[0] acerta as 4 (4/20)
       60% de D22: alunos[0,1,2] acertam as 3 (9/15)
       40% de D23: alunos[0,1] acertam as 3 (6/15) */
    alunos.forEach(function(num,ai){
      var errados=[];
      if(ai!==0) errados=errados.concat([0,1,2,3]);
      if(ai>2) errados=errados.concat([4,5,6]);
      if(ai>1) errados=errados.concat([7,8,9]);
      corrigirAlvo(pr1,t.nome,num,errados);
    });
    var A1=apurarConjunto([sm1],"MAT");
    var m={}; A1.descritores.forEach(function(d){ m[d.cod]=d.pct; });
    return m;
  })()`);
  ok(Math.round(cenario1.D17) === 20,
     "1º simulado — D17: " + Math.round(cenario1.D17) + "% (alvo 20%)");
  ok(Math.round(cenario1.D22) === 60,
     "1º simulado — D22: " + Math.round(cenario1.D22) + "% (alvo 60%)");
  ok(Math.round(cenario1.D23) === 40,
     "1º simulado — D23: " + Math.round(cenario1.D23) + "% (alvo 40%)");

  const cenario2 = J(`(function(){
    var sm1=E.simulados[0], t=turmaDe(sm1.turma);
    var pr2={id:"pr2", turma:sm1.turma, disciplina:sm1.disciplina,
      codigo:"S2", titulo:"2º Simulado", nq:10, no:5, gabC:"AAAAAAAAAA",
      desc:["D17","D17","D17","D17","D22","D22","D22","D23","D23","D24"],
      niv:[6,6,6,6,7,7,7,7,7,7], comps:new Array(10).fill("MAT"),
      discursivas:[]};
    pr2.questoes=pr2.desc.map(function(d,i){
      return {enunciado:d+" novo "+i, alternativas:["a","b","c","d","e"],
        correta:null, imagem:null};});
    pr2.habs=pr2.desc.map(function(d){return "MAT "+d;});
    E.provas.push(pr2);
    var sm2={id:"sm2", turma:sm1.turma, disciplina:sm1.disciplina,
      etapa:"3EM", titulo:"2º Simulado", codigo:"S2", prova:pr2.id,
      criado:2000, qtd:{LP:0,MAT:10}};
    E.simulados.push(sm2);
    E.ativa=pr2.id; aplicarLayout(pr2.nq,pr2.no);

    var alunos=t.alunos.slice(0,5).map(function(a){return a.numero;});
    /* D17=[0,1,2,3] D22=[4,5,6] D23=[7,8] D24=[9]
       25% de D17: aluno[0] acerta as 4 (4) + aluno[1] acerta 1 (1) = 5/20
       20% de D22: só aluno[0] acerta as 3 (3/15)
       90% de D23: alunos[0..3] acertam as 2 (8) + aluno[4] acerta 1 (1) = 9/10 */
    alunos.forEach(function(num,ai){
      var errados=[];
      if(ai===0){ /* D17 tudo certo */ }
      else if(ai===1){ errados=errados.concat([1,2,3]); }    // acerta só 0
      else{ errados=errados.concat([0,1,2,3]); }
      if(ai!==0) errados=errados.concat([4,5,6]);
      if(ai===4) errados=errados.concat([8]);                // erra só uma de D23
      corrigirAlvo(pr2,t.nome,num,errados);
    });
    var A2=apurarConjunto([sm2],"MAT");
    var m={}; A2.descritores.forEach(function(d){ m[d.cod]=d.pct; });
    return m;
  })()`);
  ok(Math.round(cenario2.D17) === 25,
     "2º simulado — D17: " + Math.round(cenario2.D17) + "% (alvo 25%)");
  ok(Math.round(cenario2.D22) === 20,
     "2º simulado — D22: " + Math.round(cenario2.D22) + "% (alvo 20%)");
  ok(Math.round(cenario2.D23) === 90,
     "2º simulado — D23: " + Math.round(cenario2.D23) + "% (alvo 90%)");
  ok("D24" in cenario2, "D24 aparece só no 2º simulado");

  /* ── a evolução calculada ── */
  const ev = J(`evolucaoDescritores(E.simulados[0].turma,"MAT")`);
  const porCod = {}; ev.forEach(d => porCod[d.cod] = d);

  ok(porCod.D17 && porCod.D17.vezes === 2, "D17 tem dois pontos");
  ok(porCod.D22 && porCod.D22.vezes === 2, "D22 tem dois pontos");
  ok(porCod.D23 && porCod.D23.vezes === 2, "D23 tem dois pontos");
  ok(porCod.D24 && porCod.D24.vezes === 1, "D24 tem só um ponto");
  ok(porCod.D24.variacao === null,
     "e a variação dele é null, não zero — não há o que comparar ainda");

  /* D17: 20% → 25%, variação +5 — dentro da faixa "lenta" (< 10) */
  ok(Math.round(porCod.D17.variacao) === 5,
     "D17 variou +" + Math.round(porCod.D17.variacao) + " pontos");
  ok(porCod.D17.tendencia === "lenta",
     "tendência \"lenta\" (" + porCod.D17.tendencia + ")");
  ok(porCod.D17.precisaContinuidade === true,
     "D17 precisa de continuidade: ainda abaixo de 50% e sem avanço rápido");

  /* D22: 60% → 20%, variação -40 */
  ok(porCod.D22.variacao < 0,
     "D22 piorou (" + Math.round(porCod.D22.variacao) + " pts)");
  ok(porCod.D22.tendencia === "piorando",
     "tendência \"piorando\" (" + porCod.D22.tendencia + ")");
  ok(porCod.D22.precisaContinuidade === true,
     "e precisa de continuidade — vai mal e piorou");

  /* D23: 40% → 90%, variação +50 */
  ok(porCod.D23.variacao >= 20,
     "D23 avançou " + Math.round(porCod.D23.variacao) +
     " pontos — acima do limiar de rápida");
  ok(porCod.D23.tendencia === "rápida",
     "tendência \"rápida\" (" + porCod.D23.tendencia + ")");
  ok(porCod.D23.precisaContinuidade === false,
     "e NÃO entra como prioridade — já está indo bem");

  /* ── na tela e no relatório ── */
  const fonte = require("fs").readFileSync(__dirname + "/index.html", "utf8");
  ok(/Evolução entre simulados/.test(fonte),
     "a tela e o relatório trazem a seção de evolução");
  ok(/precisa de continuidade — ainda abaixo de 50%/.test(fonte),
     "com a explicação de quem precisa de continuidade");
  ok(/já apareceu.*mais de um simulado desta turma|já apareceram.*mais de um/.test(fonte),
     "e o texto deixa claro que é comparação entre simulados");

  /* ── a sugestão do próximo simulado ── */
  const sug = J(`sugerirProximos([E.simulados[0]],"MAT",7)`);
  const cods = sug.lista.map(d => d.cod);
  ok(cods.indexOf("D22") >= 0,
     "D22 (piorando) entra na sugestão do próximo simulado");
  ok(sug.lista.every(d => d.cod !== "D23" || d.motivo !== "piorando entre simulados"),
     "D23 (indo bem) não entra como \"piorando\"");

  /* ── um único simulado não tem evolução ── */
  const soUm = J(`(function(){
    var t={id:"tX", escola:E.turmas[0].escola, nome:"Isolada", serie:"3EM",
      ativa:true, disciplina:"d1", disciplinas:E.turmas[0].disciplinas,
      periodo:E.turmas[0].periodo, alunos:E.turmas[0].alunos.slice(0,3)};
    E.turmas.push(t);
    var pr={id:"prX", turma:t.id, disciplina:"d1", codigo:"X", titulo:"Único",
      nq:3, no:5, gabC:"AAA", desc:["D17","D17","D17"], niv:[6,6,6],
      comps:["MAT","MAT","MAT"], habs:["MAT D17","MAT D17","MAT D17"],
      questoes:[{enunciado:"u1",alternativas:["a","b","c","d","e"]},
        {enunciado:"u2",alternativas:["a","b","c","d","e"]},
        {enunciado:"u3",alternativas:["a","b","c","d","e"]}], discursivas:[]};
    E.provas.push(pr);
    var sm={id:"smX", turma:t.id, disciplina:"d1", etapa:"3EM", titulo:"Único",
      codigo:"X", prova:pr.id, criado:1, qtd:{LP:0,MAT:3}};
    E.simulados.push(sm);
    return evolucaoDescritores(t.id,"MAT").length;
  })()`);
  ok(soUm === 0,
     "com um único simulado, nenhum descritor tem 2 pontos para comparar " +
     "(" + soUm + ")");

  /* ── 10 descritores, e a regra de "não ficar preso" ─────────────
     Pedido do professor: a sugestão passa a trazer 10 descritores, não
     7. E um descritor que já foi cobrado muitas vezes sem sair do lugar
     não deve travar o topo da lista para sempre — mas também não pode
     simplesmente SUMIR, porque o professor precisa continuar vendo que
     ele existe para decidir o que fazer com ele. */
  const dez = J(`sugerirProximos([E.simulados[0]],"MAT",10)`);
  ok(dez.lista.length <= 10 || dez.travadosForaDoCorte.length > 0,
     "o pedido padrão é 10 descritores (" + dez.lista.length + " agora, " +
     "porque este cenário tem poucos travados)");

  /* quatro simulados de um descritor que nunca decola de 20% */
  const preso = J(`(function(){
    var t=E.turmas[0];
    var helper=function(pr,turma,numero,errados){
      var o=ordemDe(pr,turma,numero);
      var g=gabaritoDe(turma,numero).split("");
      var R=g.slice();
      o.oq.forEach(function(idx,pos){
        if(errados.indexOf(idx)>=0) R[pos]=(R[pos]==="A"?"B":"A");
      });
      registrar({numero:numero,nome:"P"+numero,R:R,origem:"qr"});
    };
    for(var s=1;s<=4;s++){
      var pr={id:"prP"+s, turma:t.id, disciplina:"d1", codigo:"P"+s,
        titulo:"Preso "+s, nq:5, no:5, gabC:"AAAAA",
        desc:["D40","D40","D41","D42","D43"], niv:[6,6,6,6,6],
        comps:["MAT","MAT","MAT","MAT","MAT"],
        habs:["MAT D40","MAT D40","MAT D41","MAT D42","MAT D43"],
        questoes:[0,1,2,3,4].map(function(i){return {enunciado:"P"+s+"q"+i,
          alternativas:["a","b","c","d","e"]};}), discursivas:[]};
      E.provas.push(pr);
      var sm={id:"smP"+s, turma:t.id, disciplina:"d1", etapa:"3EM",
        titulo:"Preso "+s, codigo:"P"+s, prova:pr.id, criado:100000+s*1000,
        qtd:{LP:0,MAT:5}};
      E.simulados.push(sm);
      E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
      t.alunos.slice(0,5).forEach(function(a,ai){
        helper(pr,t.nome,a.numero,(ai!==0)?[0,1]:[]);   // D40: sempre 20%
      });
    }
    var ultimo=E.simulados[E.simulados.length-1];
    var S=sugerirProximos([ultimo],"MAT",10);
    var pos=S.lista.map(function(x){return x.cod;}).indexOf("D40");
    return {qtd:S.lista.length, pos:pos,
      motivo:pos>=0?S.lista[pos].motivo:null,
      foraDoCorte:S.travadosForaDoCorte};
  })()`);
  ok(preso.pos >= 0,
     "D40, cobrado 4× sempre em 20%, CONTINUA na lista (posição " +
     preso.pos + ")");
  ok(/sem avançar/.test(preso.motivo||""),
     "com o motivo explicando o porquê: \"" + preso.motivo + "\"");
  ok(preso.foraDoCorte.indexOf("D40") >= 0,
     "e o app registra que ele perdeu o corte natural das 10 vagas — " +
     "ficou visível À CUSTA de estourar o número redondo, de propósito");

  const fonte79 = require("fs").readFileSync(__dirname + "/index.html", "utf8");
  ok(/Dez descritores/.test(fonte79),
     "a tela e o relatório dizem \"dez descritores\", não mais \"sete\"");
  ok(/TENTATIVAS_SEM_TRAVAR/.test(fonte79),
     "e a regra de não travar está nomeada no código, não escondida " +
     "dentro de um número mágico");

  console.log(falhas ? "\nteste79: " + falhas + " FALHA(S)" : "\nteste79: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1500);
