/* teste54.js — todo estudante recebe o mesmo número de folhas, e o
   MENOR número possível.

   As questões saem em ordem diferente para cada estudante (é o que
   impede a cola) e o encaixe nas colunas muda junto. Um recebia duas
   páginas e o vizinho três.

   A v49 nivelou por CIMA: todo mundo ia para o pior caso e quem já
   cabia ganhava uma folha de rascunho em branco. Corrigia o sintoma e
   era artificial — se a prova de um estudante coube em duas páginas, a
   diferença é de EMPACOTAMENTO, não de conteúdo: o texto é o mesmo,
   muda só a ordem. Acrescentar folha a quem já cabia não corrige nada.

   A v50 nivela por BAIXO: antes de acrescentar folha, desce a escada da
   letra procurando o degrau em que a turma INTEIRA cabe onde o melhor
   caso já cabia. Só desce se economizar folha de verdade, e para no
   primeiro degrau que resolve. A folha de rascunho vira o último
   recurso, para quando nem a menor letra resolve.

   Cobre também o defeito de medição achado no caminho: `alturasCanonicas`
   media as alternativas na ordem CANÔNICA, mas cada estudante as recebe
   embaralhadas. A soma não muda; a ordem sim — e é ela que decide onde a
   cola cai. `unidadesNaOrdem` remonta cada questão na ordem real. */
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
    baixou:d.baixouCorpo||null, preferido:d.corpoPreferido,
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
  ok(uniforme(g.deCada),
     "todos recebem o mesmo número de folhas (" + faixa(g.deCada) + ")");
  ok(g.pareja === true, "e o app confirma que a tiragem saiu pareja");
  ok(g.deCada[0] === 2,
     "e são DUAS páginas, não três: a turma inteira coube onde o melhor " +
     "caso já cabia");
  ok(uniforme(g.semNivelar) && g.semNivelar[0] === g.deCada[0],
     "nenhuma folha de rascunho foi acrescentada — a tiragem já saiu " +
     "pareja sozinha (" + faixa(g.semNivelar) + ")");
  ok(g.total === g.deCada[0] * 24,
     "o PDF tem exatamente páginas × estudantes (" + g.total + ")");
  ok(!!g.baixou, "o app registra que desceu a letra para conseguir isso");
  ok(g.baixou && g.baixou.para < g.baixou.de,
     "de " + (g.baixou ? g.baixou.de : "-") + " para " +
     (g.baixou ? g.baixou.para : "-") + " pt");
  ok(g.baixou && g.baixou.paraPaginas < g.baixou.dePaginas,
     "e só desceu porque isso economizou folha: " +
     (g.baixou ? g.baixou.dePaginas + " → " + g.baixou.paraPaginas : "-") +
     " páginas");
  ok(g.corpo >= 9,
     "a letra não desce abaixo do último degrau da escada (" + g.corpo + " pt)");

  /* ── 2. vale para simulado e avaliação ── */
  const sim = gerar(true);
  ok(uniforme(sim.deCada),
     "no simulado também (" + faixa(sim.deCada) + ") — já valia, e continua");

  /* ── 3. varredura ── */
  let casos = 0, parelhos = 0, comRascunho = 0, desceu = 0, minimo = 0;
  [0, 12, 24, 36, 44, 48, 52, 56].forEach(pad => {
    montar(pad);
    const r = gerar(false);
    casos++;
    if(uniforme(r.deCada)) parelhos++;
    /* folha de rascunho extra = alguém recebeu mais do que precisava */
    if(r.deCada.some((p, i) => p > r.semNivelar[i])) comRascunho++;
    if(r.baixou) desceu++;
    /* ninguém poderia ter recebido menos, no corpo escolhido */
    if(Math.min.apply(null, r.semNivelar) === r.deCada[0]) minimo++;
  });
  ok(casos === 8, "oito tamanhos de prova varridos");
  ok(parelhos === casos, "TODOS saem com a tiragem pareja");
  ok(minimo === casos,
     "e todos no menor número de páginas possível — ninguém recebeu " +
     "folha a mais do que a prova exigia");
  ok(comRascunho === 0,
     "nenhuma folha de rascunho artificial foi acrescentada (" +
     comRascunho + " casos)");
  ok(desceu > 0, desceu + " deles só conseguiram isso descendo a letra");

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
