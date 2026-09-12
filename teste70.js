/* teste70.js — por que 5 acertos podem cair em dois padrões.

   Pergunta do professor, e ele já sabia que não era bug: por que alguém
   com 7 acertos e alguém com 5 ficam os dois no Desejável, e alguém com 4
   ou 3 fica no Básico?

   Reproduzido com o caderno real e 32 estudantes:

     0 acertos →  175          Elementar I
     2 acertos →  281 a 287    Elementar II
     3 acertos →  299          Básico
     4 acertos →  304 a 317    Básico
     5 acertos →  324 a 333    Básico / Desejável   ← dois padrões
     6 acertos →  349 a 353    Desejável
     7 acertos →  362 a 367    Desejável

   São duas coisas, e nenhuma é erro:

   1. **O corte é uma linha no meio da faixa.** O Desejável começa em 325
      e quem acertou 5 ficou entre 324 e 333 — uns de um lado, outros do
      outro.
   2. **O mesmo número de acertos não dá a mesma proficiência**, porque a
      escala ancorada mede QUAIS itens foram acertados, não quantos.

   O relatório passa a mostrar essa tabela com os números da própria
   turma. Explicação genérica não sobrevive a uma reunião; a tabela da
   turma, sim. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(32), {nLP:0, nMAT:9}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste70 — acertos × padrão");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  win.eval("window.__T=" +
    JSON.stringify(fs.readFileSync(__dirname + "/fixture-sim-mat.txt","utf8")) + ";");

  /* caderno real, 32 estudantes, erros pseudoaleatórios com semente fixa
     para o cenário ser sempre o mesmo */
  const cenario = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    sm.qtd={LP:0,MAT:9}; sm.etapa="3EM";
    var lido=lerSimuladoDoc(window.__T,null);
    aplicarImportacao(sm,"MAT",selecionarItens(sm,"MAT",lido.itens).itens);
    E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    var semente=12345;
    var rnd=function(){ semente=(semente*1103515245+12345)%2147483648;
      return semente/2147483648; };
    t.alunos.forEach(function(a){
      var g=gabaritoDe(t.nome,a.numero); if(!g) return;
      var R=g.split("");
      for(var k=0;k<pr.nq;k++) if(rnd()<0.55) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
    var A=apurarConjunto([sm],"MAT");
    return {metodo:A.metodo, ancorado:A.ancorado, alunos:A.alunos,
            cortes:etapaDe("3EM").cortes.MAT};
  })()`);
  ok(cenario.ancorado === true,
     "cenário ancorado com " + cenario.alunos + " estudantes");
  ok(cenario.cortes[2] === 325,
     "o corte do Desejável em MAT 3EM é " + cenario.cortes[2] + " pontos");

  /* ── 1. a tabela ── */
  const D = J(`dispersaoPorAcertos(apurarConjunto([E.simulados[0]],"MAT"))`);
  ok(D.length >= 5, D.length + " faixas de acerto na turma");
  D.forEach(x => console.log("         " + x.acertos + " acertos (" + x.n +
    "): " + Math.round(x.min) + " a " + Math.round(x.max) + " · " +
    x.padroes.join(" / ")));

  ok(D.every((x,i,a) => i === 0 || a[i-1].max <= x.max + 0.01),
     "mais acertos nunca dá proficiência máxima menor — a relação é " +
     "crescente, o que descarta erro de conta");

  /* ── 2. o mesmo nº de acertos, proficiências diferentes ── */
  const varia = D.filter(x => x.n > 1 && x.variacao >= 3);
  ok(varia.length > 0,
     varia.length + " faixas em que o MESMO número de acertos deu " +
     "proficiências diferentes — a maior variação é de " +
     Math.max.apply(null, varia.map(x => x.variacao)) + " pontos");
  ok(varia.every(x => x.n > 1),
     "e sempre com mais de um estudante, senão não haveria o que comparar");

  /* ── 3. o corte passando no meio da faixa ── */
  const duplos = D.filter(x => x.padroes.length > 1);
  ok(duplos.length > 0,
     duplos.map(x => x.acertos).join(" e ") + " acertos caíram em DOIS " +
     "padrões — é exatamente o que o professor viu");
  duplos.forEach(x => {
    const corte = cenario.cortes.find(c => c > x.min && c <= x.max);
    ok(corte != null,
       "com " + x.acertos + " acertos (" + Math.round(x.min) + " a " +
       Math.round(x.max) + "), o corte de " + corte + " passa no meio da " +
       "faixa — não é erro, é a linha caindo ali");
  });

  /* ── 4. o relatório explica com os números da turma ── */
  const fonte = fs.readFileSync(__dirname + "/index.html", "utf8");
  ok(/Por que os acertos e o padrão não andam juntos/.test(fonte),
     "o relatório tem a seção que responde a essa pergunta");
  ok(/cada número de acertos valeu isto/.test(fonte),
     "e mostra a tabela com os números DESTA turma, não um exemplo " +
     "inventado");
  ok(/corte do padrão passando no meio da faixa/.test(fonte),
     "explicando o corte no meio da faixa");
  ok(/acertaram os MESMOS itens/.test(fonte),
     "e a variação dentro do mesmo número de acertos");
  ok(/acertar um item de 425 pontos é evidência de estar perto dos 425/.test(fonte),
     "com a frase que torna o princípio concreto");

  /* ── 5. o PDF sai ── */
  const pdf = J(`(function(){
    var sm=E.simulados[0], t=turmaDe(sm.turma);
    var doc=pdfAnalise({nivel:"turma", recorte:t.nome, titulo:sm.titulo,
      etapa:sm.etapa, escola:"EREM", sims:[sm],
      individual:[{turma:t, sims:[sm]}]});
    return {paginas:doc.getNumberOfPages()};
  })()`);
  ok(pdf.paginas >= 3, "o relatório é gerado (" + pdf.paginas + " páginas)");

  console.log(falhas ? "\nteste70: " + falhas + " FALHA(S)" : "\nteste70: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1800);
