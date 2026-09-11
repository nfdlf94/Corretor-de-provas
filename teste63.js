/* teste63.js — relatório de análise em PDF: série, turma e individual.

   O documento tem de se explicar sozinho: quem abre pode ser o professor,
   a gestão, a mãe de um estudante ou alguém da Secretaria, e nenhum deles
   é obrigado a saber o que é proficiência, padrão de desempenho ou
   descritor.

   A parte nova de verdade é o TETO DO SIMULADO — até onde o caderno
   consegue medir. Um simulado só enxerga as habilidades que cobra: se o
   item mais difícil está no nível 4 da escala, ninguém pode ser
   posicionado acima disso, nem acertando tudo. É a diferença entre "a
   turma não chegou lá" e "o instrumento não foi até lá". */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(8), {nLP:5, nMAT:5}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste63 — relatório de análise em PDF");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* níveis nos itens: LP do 2 ao 5, MAT do 1 ao 4 — o caderno não chega
     no topo da escala, que é o caso interessante */
  win.eval(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    sm.etapa="3EM";
    pr.niv=[2,3,4,5,3, 1,2,3,4,2];
    pr.desc=["D1","D3","D5","D8","D3", "D12","D15","D20","D22","D15"];
    E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    t.alunos.forEach(function(a,i){
      var g=gabaritoDe(t.nome,a.numero); if(!g) return;
      var R=g.split("");
      for(var k=0;k<i;k++) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
  })()`);

  /* ── 1. o teto ── */
  const teto = J(`(function(){
    var sm=E.simulados[0];
    return {LP:tetoDoSimulado([sm],"LP"), MAT:tetoDoSimulado([sm],"MAT")};
  })()`);
  ok(teto.LP.minNivel === 2 && teto.LP.maxNivel === 5,
     "LP: o caderno vai do nível " + teto.LP.minNivel + " ao " + teto.LP.maxNivel);
  ok(teto.MAT.minNivel === 1 && teto.MAT.maxNivel === 4,
     "MAT: do nível " + teto.MAT.minNivel + " ao " + teto.MAT.maxNivel);
  ok(teto.LP.ultimoDaEscala > teto.LP.maxNivel,
     "e a escala do 3º EM vai até o " + teto.LP.ultimoDaEscala + " — o " +
     "simulado não alcança o topo, e o relatório precisa dizer isso");
  ok(teto.LP.pontoTeto != null && teto.LP.padraoTeto,
     "o teto vira pontos da escala (" + teto.LP.pontoTeto + ") e um padrão (" +
     (teto.LP.padraoTeto ? teto.LP.padraoTeto.nome : "-") + ")");
  ok(teto.LP.habilidades.length === 4,
     "as habilidades observadas saem sem repetir descritor (" +
     teto.LP.habilidades.length + " para 5 itens, porque D3 aparece duas vezes)");
  ok(teto.LP.habilidades.every((h,i,a) =>
       i === 0 || (a[i-1].nivel||99) <= (h.nivel||99)),
     "e vêm ordenadas do nível mais fácil ao mais difícil");
  const d3 = teto.LP.habilidades.find(h => h.cod === "D3");
  ok(d3 && d3.itens === 2, "o descritor repetido soma os itens (D3: " +
     (d3 ? d3.itens : "-") + ")");

  /* item sem nível não entra na conta, e isso é declarado */
  const semNivel = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var guarda=pr.niv.slice();
    pr.niv[0]=null; pr.niv[1]=null;
    var r=tetoDoSimulado([sm],"LP");
    pr.niv=guarda;
    return {total:r.total, comNivel:r.comNivel, max:r.maxNivel};
  })()`);
  ok(semNivel.total === 5 && semNivel.comNivel === 3,
     "itens sem nível ficam de fora da conta (" + semNivel.comNivel +
     " de " + semNivel.total + ") — o relatório informa quantos são");

  /* ── 2. o PDF da turma ── */
  const turma = J(`(function(){
    var sm=E.simulados[0], t=turmaDe(sm.turma), e=escolaDe(t.escola)||{nome:"E"};
    var doc=pdfAnalise({nivel:"turma", recorte:t.nome, titulo:sm.titulo,
      etapa:sm.etapa, escola:e.nome, sims:[sm],
      individual:[{turma:t, sims:[sm]}]});
    return {paginas:doc.getNumberOfPages(),
            tamanho:doc.output("datauristring").length};
  })()`);
  ok(turma.paginas >= 4,
     "o relatório da turma tem " + turma.paginas + " páginas — capa com as " +
     "explicações, um componente por página e o individual");
  ok(turma.tamanho > 20000, "com conteúdo de verdade");

  /* ── 3. o PDF da série, com várias turmas ── */
  const serie = J(`(function(){
    /* segunda turma, mesmo simulado */
    var t2={id:"t2", escola:E.turmas[0].escola, nome:"3º Ano B", serie:"3EM",
      ativa:true, disciplina:"Matemática",
      disciplinas:E.turmas[0].disciplinas, periodo:E.turmas[0].periodo,
      alunos:E.turmas[0].alunos.map(function(a){
        return {numero:a.numero, nome:a.nome+" (B)", desde:1, ate:null};})};
    E.turmas.push(t2);
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var sm2=JSON.parse(JSON.stringify(sm)); sm2.id="sim2"; sm2.turma="t2";
    var pr2=JSON.parse(JSON.stringify(pr)); pr2.id="psim2"; pr2.turma="t2";
    sm2.prova=pr2.id; E.simulados.push(sm2); E.provas.push(pr2);
    E.ativa=pr2.id; aplicarLayout(pr2.nq,pr2.no);
    t2.alunos.forEach(function(a,i){
      var g=gabaritoDe(t2.nome,a.numero); if(!g) return;
      var R=g.split("");
      for(var k=0;k<(i+2);k++) if(R[k]) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
    var t1=turmaDe(sm.turma), e=escolaDe(t1.escola)||{nome:"E"};
    var doc=pdfAnalise({nivel:"série", recorte:"3ª série do EM",
      titulo:sm.titulo, etapa:sm.etapa, escola:e.nome, sims:[sm,sm2],
      individual:[{turma:t1,sims:[sm]},{turma:t2,sims:[sm2]}]});
    var A=apurarConjunto([sm,sm2],"LP");
    return {paginas:doc.getNumberOfPages(), turmas:A?A.turmas.length:0,
            alunos:A?A.alunos:0};
  })()`);
  ok(serie.turmas === 2, "a análise de série reúne as duas turmas");
  ok(serie.alunos === 16, "com os 16 estudantes somados (" + serie.alunos + ")");
  ok(serie.paginas >= 6,
     "e o PDF ganha uma seção individual por turma (" + serie.paginas +
     " páginas)");

  /* ── 4. o individual traz acertos E proficiência ── */
  /* o número de acertos é o dado direto; a proficiência de um simulado só
     tem margem de erro grande e serve para agrupar, não para classificar
     um estudante isolado. O relatório diz isso com todas as letras. */
  const fonte = require("fs").readFileSync(__dirname + "/index.html", "utf8");
  ok(/margem de erro/.test(fonte) && /vale para agrupar estudantes/.test(fonte),
     "o relatório avisa que a proficiência individual serve para agrupar, " +
     "não para classificar");
  ok(/o instrumento não foi até lá/.test(fonte),
     "e explica a diferença entre a turma não chegar e o instrumento não ir");
  ok(/Elementar I/.test(fonte) && /recuperação/.test(fonte),
     "os padrões vêm com a ação recomendada, não só com o nome");

  /* ── 5. sem cartão corrigido, não quebra ── */
  const vazio = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var guarda=E.res.slice();
    E.res=[];
    var doc=pdfAnalise({nivel:"turma", recorte:"Vazia", titulo:sm.titulo,
      etapa:sm.etapa, escola:"E", sims:[sm], individual:[]});
    E.res=guarda;
    return {paginas:doc.getNumberOfPages()};
  })()`);
  ok(vazio.paginas >= 1,
     "sem cartão corrigido o PDF ainda sai, só com a capa e as explicações " +
     "(" + vazio.paginas + " página[s])");

  console.log(falhas ? "\nteste63: " + falhas + " FALHA(S)" : "\nteste63: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1500);
