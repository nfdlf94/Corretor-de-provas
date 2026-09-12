/* teste66.js — numeração SAEB → SAEPE, e o que cobrar no próximo.

   Conferi o arquivo real do professor contra a matriz oficial que está no
   app e encontrei duas coisas:

   1. Quatro dos cinco descritores estão com a numeração do SAEB. As
      HABILIDADES são as do SAEPE; os CÓDIGOS estão um número abaixo —
      o "D22 — reconhecer o gráfico de função do 1º grau" é o D23 no
      SAEPE, onde o D22 é P.A./P.G. Para a análise interna dá no mesmo;
      para conversar com a rede, muda tudo.

   2. Os nove itens estão nos níveis 6 a 9, e o corte do Desejável em
      Matemática 3EM é 326 pontos. O item MAIS FÁCIL do caderno vale ~362.
      Não há um único item abaixo do Desejável — a prova mede bem quem já
      está no topo e não distingue os demais entre si. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(6), {nLP:0, nMAT:9}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste66 — numeração e sugestão do próximo simulado");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  win.eval("window.__T=" +
    JSON.stringify(fs.readFileSync(__dirname + "/fixture-sim-mat.txt","utf8")) + ";");

  const montar = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    sm.qtd={LP:0,MAT:9}; sm.etapa="3EM"; sm.matriz="m1";
    var lido=lerSimuladoDoc(window.__T,null);
    E.descritores=E.descritores||{LP:{},MAT:{}};
    lido.descritores.forEach(function(d){ if(d.texto) E.descritores.MAT[d.cod]=d.texto; });
    var sel=selecionarItens(sm,"MAT",lido.itens);
    aplicarImportacao(sm,"MAT",sel.itens);
    E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    t.alunos.forEach(function(a,i){
      var g=gabaritoDe(t.nome,a.numero); if(!g) return;
      var R=g.split("");
      for(var k=0;k<i+1;k++) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
    return {desc:pr.desc, corrigidos:resDa(pr.id).length};
  })()`);
  ok(montar.corrigidos === 6, "cenário montado com " + montar.corrigidos +
     " cartões corrigidos");

  /* ── 1. a conferência encontra as trocas ── */
  const trocas = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    return conferirNumeracao(pr,"MAT",sm.etapa);
  })()`);
  const mapa = {};
  trocas.forEach(t => mapa[t.de] = t.para);
  ok(trocas.length === 4,
     "quatro códigos não batem com a matriz do SAEPE (" + trocas.length + ")");
  ok(mapa.D22 === "D23" && mapa.D23 === "D24" && mapa.D24 === "D25" &&
     mapa.D31 === "D32",
     "e as trocas são: " + trocas.map(t => t.de + "→" + t.para).join(", "));
  ok(!mapa.D17, "o D17 bate com o oficial e NÃO é tocado");
  ok(trocas.every(t => t.texto),
     "cada troca carrega o texto que fez o casamento — nada é adivinhado " +
     "por proximidade de número");

  /* ── 2. aplicar: mexe no código, não no resto ── */
  const antes = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    return {niv:pr.niv.slice(), gab:pr.gabC,
      questoes:pr.questoes.map(function(q){return q.enunciado;}),
      notas:E.res.filter(function(r){return r.prova===pr.id;})
        .map(function(r){return r.numero+":"+r.acertos;}).sort().join(",")};
  })()`);
  const aplicado = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var n=renumerarDescritores(pr,"MAT",conferirNumeracao(pr,"MAT",sm.etapa));
    return {mexidos:n, desc:pr.desc, niv:pr.niv,
      gab:pr.gabC, questoes:pr.questoes.map(function(q){return q.enunciado;}),
      notas:E.res.filter(function(r){return r.prova===pr.id;})
        .map(function(r){return r.numero+":"+r.acertos;}).sort().join(","),
      bancoD23:E.descritores.MAT.D23||"", bancoD22:E.descritores.MAT.D22||""};
  })()`);
  ok(aplicado.mexidos === 7,
     aplicado.mexidos + " itens renumerados (os 7 que usavam código do SAEB)");
  ok(String(aplicado.desc) === "D23,D17,D32,D17,D24,D32,D24,D23,D25",
     "os descritores viraram: [" + aplicado.desc + "]");
  ok(String(aplicado.niv) === String(antes.niv), "os níveis não foram tocados");
  ok(aplicado.gab === antes.gab, "o gabarito canônico não foi tocado");
  ok(String(aplicado.questoes) === String(antes.questoes),
     "os enunciados não foram tocados");
  ok(aplicado.notas === antes.notas,
     "e as seis notas seguem idênticas — nenhum cartão foi invalidado");
  ok(/gráfico de uma função polinomial de 1º grau/i.test(aplicado.bancoD23),
     "o texto acompanhou o código novo (D23 agora é o gráfico da função afim)");
  ok(!aplicado.bancoD22,
     "e o código antigo saiu do banco, para não sobrar um D22 apontando " +
     "para a habilidade errada");

  /* rodar de novo não acha mais nada */
  const denovo = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    return conferirNumeracao(pr,"MAT",sm.etapa).length;
  })()`);
  ok(denovo === 0, "depois de corrigido, a conferência não acha mais nada");

  /* ── 3. o achado sobre a dificuldade ── */
  const faixa = J(`(function(){
    var sm=E.simulados[0];
    var T=tetoDoSimulado([sm],"MAT");
    var cortes=etapaDe("3EM").cortes.MAT;
    var h0=SAEPE_NIVEIS.find(function(x){return x.comp==="MAT"&&x.etapa==="3EM"&&
      x.nivel===T.minNivel;});
    return {min:T.minNivel, max:T.maxNivel, corteDesejavel:cortes[2],
      pisoDoItemMaisFacil:h0?h0.de:null};
  })()`);
  ok(faixa.corteDesejavel === 325 || faixa.corteDesejavel === 326,
     "o corte do Desejável em MAT 3EM é " + faixa.corteDesejavel + " pontos");
  ok(faixa.pisoDoItemMaisFacil > faixa.corteDesejavel,
     "e o item MAIS FÁCIL do caderno começa em " + faixa.pisoDoItemMaisFacil +
     " — acima do corte. Nenhum item mede a faixa onde a maioria dos " +
     "estudantes está");

  const fonte = fs.readFileSync(__dirname + "/index.html", "utf8");
  ok(/o item mais FÁCIL deste caderno já está acima do corte/.test(fonte),
     "e o relatório avisa isso em vermelho, em vez de deixar o professor " +
     "descobrir pela nota baixa de todo mundo");

  /* ── 4. a sugestão do próximo simulado ── */
  const sug = J(`sugerirProximos([E.simulados[0]],"MAT",7)`);
  ok(sug.lista.length === 7, "sete descritores sugeridos (" +
     sug.lista.length + ")");
  ok(sug.naMatriz === 35, "a matriz MAT 3EM tem " + sug.naMatriz +
     " descritores");
  ok(sug.jaCobrados === 5, "e cinco já foram cobrados nesta turma");
  ok(sug.lista.every(d => d.motivo),
     "cada sugestão vem com o motivo — lista de códigos sem justificativa " +
     "é palpite");
  ok(sug.lista.every(d => d.texto),
     "e com o texto da habilidade, para o professor conferir sem abrir a matriz");
  const motivos = [...new Set(sug.lista.map(d => d.motivo))];
  ok(motivos.length >= 1,
     "motivos usados: " + motivos.join(" · "));
  /* o que teve acerto baixo vem primeiro */
  const baixos = sug.lista.filter(d => d.motivo === "acerto baixo neste simulado");
  const nunca = sug.lista.filter(d => d.motivo === "nunca cobrado nesta turma");
  if(baixos.length && nunca.length)
    ok(sug.lista.indexOf(baixos[0]) < sug.lista.indexOf(nunca[0]),
       "e o que a turma não domina vem ANTES do que nunca foi cobrado");
  else
    ok(true, "só um tipo de motivo neste cenário (" +
       baixos.length + " por acerto baixo, " + nunca.length + " por cobertura)");
  ok(sug.lista.every(d => !/^D(17|23|24|25|32)$/.test(d.cod) ||
       d.motivo !== "nunca cobrado nesta turma"),
     "nenhum descritor já cobrado é sugerido como \"nunca cobrado\"");

  console.log(falhas ? "\nteste66: " + falhas + " FALHA(S)" : "\nteste66: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1500);
