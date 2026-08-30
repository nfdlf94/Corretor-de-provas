/* teste50.js — o mesmo simulado tem de sair IGUAL em todas as turmas
   da série.

   O defeito relatado: a turma A fechava com 20 questões e a turma B,
   lendo exatamente o mesmo arquivo, caía para 18.

   A causa não estava na leitura nem no conteúdo — a propagação de
   matriz já copiava os itens corretamente. Estava na MEDIÇÃO. A ordem
   das questões é semeada por turma + número (`ordemDaProva`), então cada
   turma embaralha de um jeito e o encaixe nas colunas muda. `melhorAjuste`
   media com `turmaDe(sm.turma)` — só a turma da vez —, e `paginasNoPior`
   só percorria `chavesDaTurma(cfg, alunos)`. Quem clicasse em gerar na
   turma B decidia o corpo da letra e o corte de questões olhando apenas
   para os alunos da B.

   Agora `cfg.serie` traz TODAS as turmas que recebem o caderno e
   `paresDeOrdem` procura o pior caso no conjunto inteiro: a decisão é da
   série, não de quem clicou primeiro. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

/* três turmas da mesma série, com quantidades e números BEM diferentes de
   estudantes — é a diferença entre elas que produzia decisões diferentes */
function estadoSerie(){
  const E = H.estadoBase(9);
  const alunos = n => Array.from({length:n}, (_,i) => ({
    numero:String(i+1).padStart(2,"0"), nome:"Estudante "+(i+1), desde:1, ate:null}));
  E.turmas = [
    {id:"t1", escola:"e1", nome:"3A", serie:"3º ano do Ensino Médio", ativa:true,
     disciplina:"Matemática", disciplinas:[{id:"d1",nome:"Matemática",ativa:true}],
     periodo:{tipo:"bimestre",qtd:4}, alunos:alunos(9)},
    {id:"t2", escola:"e1", nome:"3B", serie:"3º ano do Ensino Médio", ativa:true,
     disciplina:"Matemática", disciplinas:[{id:"d1",nome:"Matemática",ativa:true}],
     periodo:{tipo:"bimestre",qtd:4}, alunos:alunos(31)},
    {id:"t3", escola:"e1", nome:"3C", serie:"3º ano do Ensino Médio", ativa:true,
     disciplina:"Matemática", disciplinas:[{id:"d1",nome:"Matemática",ativa:true}],
     periodo:{tipo:"bimestre",qtd:4}, alunos:alunos(24)}
  ];
  ["t1","t2","t3"].forEach((tid,k) => H.comSimulado(E, {
    id:"sim"+(k+1), turma:tid, nLP:10, nMAT:10,
    codigo:"SIM"+(k+1), titulo:"1º Simulado SAEPE"}));
  /* é a MATRIZ que diz "estas três turmas recebem o mesmo caderno" */
  E.simulados.forEach(s => { s.matriz = "m-3em-1"; });
  return E;
}

const { win } = H.abrirApp({ estado: estadoSerie() });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste50 — o mesmo caderno em todas as turmas da série");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. as três turmas estão na mesma matriz ── */
  ok(J("irmaosDaMatriz(E.simulados[0]).length") === 2,
     "o simulado da 3A tem duas turmas irmãs");
  const nomes = J("turmasDoCaderno(E.simulados[0]).map(x=>x.turma)");
  ok(nomes.length === 3 && nomes.indexOf("3A") >= 0 &&
     nomes.indexOf("3B") >= 0 && nomes.indexOf("3C") >= 0,
     "e cfg.serie lista as três: " + nomes.join(", "));
  const tamanhos = J("turmasDoCaderno(E.simulados[0]).map(x=>x.alunos.length)");
  ok(tamanhos.join(",") === "9,31,24",
     "com os estudantes de cada uma (" + tamanhos.join(", ") + ")");

  /* partindo de QUALQUER turma, cfg.serie é o mesmo conjunto */
  const deB = J("turmasDoCaderno(E.simulados[1]).map(x=>x.turma).sort()");
  const deA = nomes.slice().sort();
  ok(JSON.stringify(deB) === JSON.stringify(deA),
     "e é o mesmo conjunto partindo da 3B — não depende de quem clicou");

  /* ── 2. o pior caso é o da série, não o da turma ── */
  /* O que faz a ORDEM pesar na paginação são blocos grandes e
     indivisíveis. Desde a v43 o texto corrido se divide entre as
     colunas, e por isso um caderno só de texto pagina praticamente igual
     em qualquer ordem — foi por isso que o conjunto de dados antigo, de
     parágrafos de tamanhos variados, deixou de exercitar o defeito
     quando a mancha mudou de altura na v57.

     Figuras não se dividem. Cinco questões com gráfico alto, num caderno
     de vinte, e a ordem passa a decidir quantas páginas a prova ocupa. */
  win.eval(`(function(){
    E.provas.forEach(function(pr){
      pr.questoes.forEach(function(q,i){
        if(i % 4 === 0){
          q.enunciado="Observe o grafico abaixo.\\nQual e a lei de formacao dessa funcao polinomial do primeiro grau?";
          q.alternativas=["f(x) = 2x - 4","f(x) = -2x + 4","f(x) = 2x + 4",
                          "f(x) = -x + 4","f(x) = -2x - 4"];
          q.imagem={dados:"d", w:900, h:440};
        }else{
          q.enunciado="Leia o texto abaixo.\\nUm titulo\\n"+
            ("A leitura silenciosa firmou-se tarde na historia e mudou o modo como as pessoas se relacionam com o texto escrito. ").repeat(1+(i%3))+
            "\\nASSIS, Machado. Contos. Atica, 1998. Acesso em: 6 fev. 2012.\\nDe acordo com o texto:";
          q.alternativas=["primeira","segunda","terceira","quarta","quinta"];
          q.imagem=null;
        }
      });
    });
  })()`);

  const gerar = i => J(`(function(){
    var sm=E.simulados[${"${i}"}], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    var d=gerarProvas(cfgDoCaderno(sm,pr,t), t.alunos, window.jspdf.jsPDF);
    return {turma:t.nome, corpo:d.corpoUsado, pgs:d.paginasPorAluno, nq:pr.nq};
  })()`.replace("${i}", i));

  const g = [gerar(0), gerar(1), gerar(2)];
  g.forEach(x => console.log("         " + x.turma + ": " + x.nq +
    " questões · corpo " + x.corpo + " pt · " + x.pgs + " páginas"));
  ok(new Set(g.map(x => x.corpo)).size === 1,
     "as três turmas escolhem o MESMO corpo de letra (" + g[0].corpo + " pt)");
  ok(new Set(g.map(x => x.pgs)).size === 1,
     "e o mesmo número de páginas (" + g[0].pgs + ")");
  ok(new Set(g.map(x => x.nq)).size === 1,
     "com o mesmo número de questões (" + g[0].nq + ")");

  /* A comparação do defeito é feita num corpo FIXO, e não pelo resultado
     de `gerarProvas`: a escada da letra colapsa diferenças (duas turmas
     que precisam de 4 e 5 páginas em 10,5 pt podem acabar as duas em
     9 pt e 4 páginas). A grandeza que `cfg.serie` de fato conserta é o
     PIOR CASO por turma num dado corpo. */
  const porTurma = J(`(function(){
    var J2=window.jspdf.jsPDF, saida=[];
    [0,1,2].forEach(function(i){
      var sm=E.simulados[i], pr=provaDoSim(sm), t=turmaDe(sm.turma);
      var cfg=cfgDoCaderno(sm,pr,t);
      var molde=new J2({unit:"mm",format:"a4"}); prepararFontes(molde);
      var Lc=montarLayout(pr.nq,pr.no);
      var topo=cabecalho(molde,cfg,t.alunos[0],true)+Lc.box_h+2*Lc.quiet_zone+8;
      var fundo=fundoUtil(molde);
      var so=Object.assign({},cfg); delete so.serie;
      var linha={turma:t.nome, so:[], serie:[]};
      [10.5,10,9.5,9].forEach(function(fs){
        linha.so.push(paginasNoPior(molde,so,t.alunos,fs,topo,fundo));
        linha.serie.push(paginasNoPior(molde,cfg,t.alunos,fs,topo,fundo));
      });
      saida.push(linha);
    });
    return saida;
  })()`);
  porTurma.forEach(x => console.log("         " + x.turma +
    "  sozinha: " + x.so.join(", ") + "   com a série: " + x.serie.join(", ")));

  ok([0,1,2,3].some(k => new Set(porTurma.map(x => x.so[k])).size > 1),
     "medindo cada turma por si, o pior caso DIVERGE entre elas em pelo " +
     "menos um corpo — é o defeito relatado, e sem isto o resto do teste " +
     "passaria por acidente");
  ok([0,1,2,3].every(k => new Set(porTurma.map(x => x.serie[k])).size === 1),
     "com cfg.serie, as três chegam ao MESMO pior caso em todos os corpos");
  ok([0,1,2,3].every(k => {
       const alvo = Math.max.apply(null, porTurma.map(x => x.so[k]));
       return porTurma.every(x => x.serie[k] === alvo);
     }),
     "e esse valor é exatamente o pior caso entre as turmas — nem mais, " +
     "nem menos");

  /* ── 3. paresDeOrdem ── */
  const G = require("./gerador.js");
  /* gerador.js conta com chaveDeOrdem vindo do escopo global da página */
  global.chaveDeOrdem = require("./embaralho.js").chaveDeOrdem;
  const cfgSerie = {turma:"3A", tipos:0, serie:[
    {turma:"3A", alunos:[{numero:"01"},{numero:"02"}]},
    {turma:"3B", alunos:[{numero:"01"},{numero:"03"}]}]};
  const pares = G.paresDeOrdem(cfgSerie, []);
  ok(pares.length === 4, "quatro pares turma+chave (" + pares.length + ")");
  ok(pares.some(p => p.turma === "3B" && p.chave === "03"),
     "incluindo o estudante que só existe na 3B");
  /* o mesmo número em turmas diferentes NÃO é o mesmo par: a semente é
     turma + número, e o embaralhamento sai diferente */
  ok(pares.filter(p => p.chave === "01").length === 2,
     "o número 01 aparece uma vez por turma — a semente inclui a turma");

  const cfgSozinho = {turma:"3A", tipos:0};
  const p2 = G.paresDeOrdem(cfgSozinho, [{numero:"01"},{numero:"02"}]);
  ok(p2.length === 2 && p2.every(p => p.turma === "3A"),
     "sem cfg.serie, o comportamento é o de antes: só a turma da vez");

  /* com tipos de prova, as chaves são TIPO1..N — mas ainda por turma,
     porque a semente continua incluindo o nome da turma */
  const p3 = G.paresDeOrdem({turma:"3A", tipos:2, serie:[
    {turma:"3A", alunos:[{numero:"01"}]}, {turma:"3B", alunos:[{numero:"01"}]}]}, []);
  ok(p3.length === 4, "com 2 tipos e 2 turmas, quatro pares (" + p3.length + ")");
  ok(p3.filter(p => p.chave === "TIPO1").length === 2,
     "TIPO1 medido nas duas turmas");

  /* pares repetidos não são medidos duas vezes */
  const p4 = G.paresDeOrdem({turma:"3A", tipos:0, serie:[
    {turma:"3A", alunos:[{numero:"01"},{numero:"01"}]}]}, []);
  ok(p4.length === 1, "pares repetidos são medidos uma vez só");

  /* ── 4. o corte, quando acontece, vale para a série ── */
  const ajuste = J(`(function(){
    var sm=E.simulados[1];              // decidido a partir da 3B
    var aj=melhorAjuste(sm);
    if(!aj) return null;
    aplicarAjuste(sm,aj);
    return {qtd:aj.qtd, corte:aj.corte,
      nq:E.simulados.map(function(s){ return provaDoSim(s).nq; }),
      qtds:E.simulados.map(function(s){ return s.qtd; }),
      gab:E.simulados.map(function(s){ return provaDoSim(s).gabC; })};
  })()`);
  ok(!!ajuste, "melhorAjuste devolveu uma decisão");
  ok(new Set(ajuste.nq).size === 1,
     "depois de aplicar, as três provas têm o MESMO nº de questões (" +
     ajuste.nq.join(", ") + ")");
  ok(new Set(ajuste.gab).size === 1,
     "e o mesmo gabarito canônico — é o mesmo caderno");
  ok(JSON.stringify(ajuste.qtds[0]) === JSON.stringify(ajuste.qtds[1]) &&
     JSON.stringify(ajuste.qtds[1]) === JSON.stringify(ajuste.qtds[2]),
     "e o contador por componente acompanhou nas três: " +
     JSON.stringify(ajuste.qtds[0]));

  /* e continua igual quando a decisão parte de outra turma */
  const outra = J(`(function(){
    var sm=E.simulados[2];              // agora a partir da 3C
    var aj=melhorAjuste(sm);
    return aj ? {qtd:aj.qtd, corte:aj.corte} : null;
  })()`);
  ok(!!outra && outra.corte === 0,
     "partindo da 3C, o caderno já cabe: não há novo corte");

  /* ── 5. depois de gerar, as três continuam idênticas ── */
  const g2 = [gerar(0), gerar(1), gerar(2)];
  ok(new Set(g2.map(x => x.nq)).size === 1 &&
     new Set(g2.map(x => x.corpo)).size === 1,
     "gerando de novo nas três: " + g2[0].nq + " questões, corpo " +
     g2[0].corpo + " pt em todas");

  console.log(falhas ? "\nteste50: " + falhas + " FALHA(S)" : "\nteste50: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
