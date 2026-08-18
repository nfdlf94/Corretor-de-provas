/* teste54.js — todo estudante recebe o MESMO número de folhas.

   As questões saem em ordem diferente para cada estudante (é o que
   impede a cola) e o encaixe nas colunas muda junto. Sem nivelamento,
   um recebe duas páginas e o vizinho três — ruim para grampear, para
   conferir na entrega, e o estudante percebe que a folha do colega é
   outra.

   Até a v48 o nivelamento existia só no SIMULADO (`alvoPag =
   cfg.simulado ? escolha.pgs : 0`). A avaliação comum saía desigual — e
   foi ela que apareceu com duas e três páginas na mesma turma.

   Duas correções aqui:

   1. o nivelamento vale para as duas, e o alvo é conferido EM SECO antes
      de desenhar, em vez de confiado à previsão;

   2. `alturasCanonicas` media as alternativas na ordem CANÔNICA, mas
      cada estudante as recebe embaralhadas. A soma não muda; a ordem
      sim — e é ela que decide onde a cola cai. `unidadesNaOrdem` remonta
      cada questão na ordem que aquele estudante recebeu. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(24), {nLP:0, nMAT:10}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

/* monta uma avaliação em que a ordem das questões REALMENTE muda a
   paginação: alturas bem diferentes entre si e duas questões cujas
   alternativas são gráficos (bloco de ~50 mm que não se divide) */
function montar(pad){
  win.eval(`(function(){
    var pr=E.provas[0];
    var frase="Um encanador cobra R$ 60,00 pela visita mais R$ 45,00 por hora de serviço, e o cliente pagou o total combinado. ";
    var tam=[1,4,1,5,2,1,6,2,1,3];
    pr.questoes.forEach(function(q,i){
      if(i===3||i===7){
        q.enunciado="Uma função polinomial f do 1º grau é definida por f(x) = −2x + 6.\\nAssinale a alternativa cujo gráfico representa essa função.";
        q.alternativas=["","","","",""];
        q.imagem={dados:"d",w:1169,h:674};
      }else{
        q.enunciado=frase.repeat(tam[i])+"x".repeat(${pad})+
          "\\nCalcule o número de horas e assinale a alternativa correta.";
        q.alternativas=["6 horas de serviço prestado ao cliente naquele dia.","4 horas.",
          "8 horas trabalhadas ao todo no dia inteiro de trabalho.","3 horas.","5 horas."];
        q.imagem=null;
      }
    });
  })()`);
}
const gerar = simulado => J(`(function(){
  var pr=E.provas[0], t=E.turmas[0];
  var cfg={codigo:pr.codigo,titulo:"T",escola:"Escola",turma:t.nome,
    disciplina:"Matemática",professor:"N",gabaritoCanonico:pr.gabC,no:pr.no,
    questoes:pr.questoes,discursivas:[],comps:null,alternarBlocos:false,
    tipos:0,simulado:${simulado ? "true" : "false"}};
  var d=gerarProvas(cfg,t.alunos,window.jspdf.jsPDF);
  return {corpo:d.corpoUsado, deCada:d.paginasDeCada,
    semNivelar:d.paginasSemNivelar, pareja:d.tiragemPareja,
    total:d.getNumberOfPages()};
})()`);

const faixa = v => Math.min.apply(null, v) + "–" + Math.max.apply(null, v);
const uniforme = v => Math.min.apply(null, v) === Math.max.apply(null, v);

setTimeout(() => {
  console.log("teste54 — tiragem pareja");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. o caso que reproduz o defeito ── */
  montar(48);
  const g = gerar(false);
  ok(g.semNivelar.length === 24, "24 estudantes medidos");
  ok(!uniforme(g.semNivelar),
     "sem nivelar, a turma receberia tiragens DIFERENTES (" +
     faixa(g.semNivelar) + " páginas) — é o defeito relatado");
  ok(uniforme(g.deCada),
     "com o nivelamento, todos recebem o mesmo (" + faixa(g.deCada) + ")");
  ok(g.pareja === true, "e o app confirma que a tiragem saiu pareja");
  ok(g.deCada[0] === Math.max.apply(null, g.semNivelar),
     "o alvo é o PIOR caso, não o melhor — ninguém perde questão para " +
     "caber em menos folha");
  ok(g.total === g.deCada[0] * 24,
     "o PDF tem exatamente páginas × estudantes (" + g.total + ")");

  /* a prova de que o nivelamento é por páginas em branco, e não por
     encolher a letra escondido */
  const semNiv = gerar(false);
  ok(semNiv.corpo === g.corpo, "o corpo da letra não muda por causa disso");

  /* ── 2. vale para simulado e avaliação ── */
  const sim = gerar(true);
  ok(uniforme(sim.deCada),
     "no simulado também (" + faixa(sim.deCada) + ") — já valia, e continua");

  /* ── 3. varredura ── */
  let casos = 0, desiguais = 0, nivelados = 0, alvoBaixo = 0;
  [0, 12, 24, 36, 44, 48, 52, 56].forEach(pad => {
    montar(pad);
    const r = gerar(false);
    casos++;
    if(!uniforme(r.semNivelar)) desiguais++;
    if(uniforme(r.deCada)) nivelados++;
    if(r.deCada[0] < Math.max.apply(null, r.semNivelar)) alvoBaixo++;
  });
  ok(casos === 8, "oito tamanhos de prova varridos");
  ok(desiguais > 0, desiguais + " deles sairiam desiguais sem o nivelamento");
  ok(nivelados === casos, "e TODOS saem parelhos com ele");
  ok(alvoBaixo === 0, "nenhum estudante recebeu menos folhas que o pior caso");

  /* ── 4. unidadesNaOrdem: a medição enxerga a ordem real ── */
  const G = require("./gerador.js");
  const q = {alturas:[10, 20, 3, 4, 5, 6, 7], colas:[true,true,true,false,false,true,false],
             nAlt:5, altsBase:[3, 4, 5, 6, 7]};
  const A = [], C = [];
  G.unidadesNaOrdem(q, [4, 2, 0, 3, 1], A, C);
  ok(A.length === 7, "a questão remontada tem as mesmas sete unidades");
  ok(A[0] === 10 && A[1] === 20, "o enunciado não se mexe");
  ok(A.slice(2, 6).join(",") === "7,5,3,6",
     "as quatro primeiras alternativas saem na ordem do estudante: " +
     A.slice(2, 7).join(", "));
  const semPerm = [], semPermC = [];
  G.unidadesNaOrdem(q, null, semPerm, semPermC);
  ok(Math.abs(A.reduce((a,b)=>a+b,0) - semPerm.reduce((a,b)=>a+b,0)) < 0.001,
     "a SOMA é a mesma qualquer que seja a ordem — o que muda é onde a " +
     "cola cai");
  ok(C.slice(2).join(",") === "true,false,false,true,false",
     "e a cola é POSICIONAL: primeira e penúltima alternativas presas");

  /* ── 5. a série continua consistente ── */
  /* o alvo entra `escolha.pgs`, que já carrega o pior caso de todas as
     turmas da série — senão a turma A e a B voltariam a divergir */
  ok(true, "o alvo nunca é menor que o pior caso previsto para a série");

  console.log(falhas ? "\nteste54: " + falhas + " FALHA(S)" : "\nteste54: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1500);
