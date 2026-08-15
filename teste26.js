/* teste26.js — análise longitudinal por descritor.
   A comparação é com a ÚLTIMA VEZ em que aquele descritor foi avaliado,
   não com o simulado anterior; descritor ausente é "não avaliado", nunca
   0%; e a chave é aluno + disciplina + descritor — D1 de Português e D1
   de Matemática não podem se comparar. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

/* ── três simulados na mesma turma, com descritores propositalmente
   desalinhados entre eles ─────────────────────────────────────────── */
function caderno(E, id, titulo, criado, comps, descs, gabLetras){
  const letras = ["A","B","C","D","E"];
  const nq = comps.length;
  const questoes = Array.from({length:nq}, (_,i)=>({
    enunciado: id+" item "+(i+1),
    alternativas: letras.map(L=>"alt "+L), correta: letras.indexOf(gabLetras[i]), imagem:null }));
  E.provas.push({ id:"p"+id, turma:"t1", disciplina:null, codigo:id.toUpperCase(),
    titulo, periodo:null, nq, no:5, gabC:gabLetras.join(""), simulado:id,
    comps, desc:descs, orig:comps.map((c,i)=>i+1), gabItens:gabLetras.slice(),
    habs:[], questoes, discursivas:[], criada:criado });
  E.simulados.push({ id, turma:"t1", titulo, etapa:"3EM", ano:2026, prova:"p"+id,
    metodo:"pct", alternarBlocos:true, tipos:0,
    qtd:{LP:comps.filter(c=>c==="LP").length, MAT:comps.filter(c=>c==="MAT").length},
    fontes:{}, criado, valorParticipacao:1.25, partAluno:{} });
}

/* grava um resultado já canonizado: Rc é o que a apuração usa */
function resultado(E, provaId, numero, nome, acertosPorItem){
  const pr = E.provas.find(p=>p.id===provaId);
  const g = pr.gabC;
  const Rc = acertosPorItem.map((certo,i)=> certo===null ? null
    : (certo ? g[i] : (g[i]==="A"?"B":"A")));
  E.res.push({ prova:provaId, turma:"t1", numero, nome, R:Rc.slice(), Rc,
    gab:g, acertos:Rc.filter((x,i)=>x===g[i]).length, erros:0, certas:[], erradas:[],
    notaDisc:0, nota:0, origem:"manual", t:Date.now() });
}

function estado(){
  const E = H.estadoBase(3);
  E.descritores = {
    LP:{ D1:"Localizar informação explícita", D3:"Identificar a tese", D5:"Efeito de sentido" },
    MAT:{ D1:"Porcentagem", D3:"Função do 1º grau", D7:"Área de figuras planas" }
  };

  /* simulado 1: LP D1 (2 itens), LP D3 (2), MAT D1 (2) */
  caderno(E,"s1","1º Simulado", 1000,
    ["LP","LP","LP","LP","MAT","MAT"],
    ["D1","D1","D3","D3","D1","D1"],
    ["A","B","C","D","E","A"]);

  /* simulado 2: SEM LP D3 — o descritor não foi avaliado aqui.
     Traz LP D1 (2), LP D5 (2), MAT D1 (2) */
  caderno(E,"s2","2º Simulado", 2000,
    ["LP","LP","LP","LP","MAT","MAT"],
    ["D1","D1","D5","D5","D1","D1"],
    ["B","C","D","E","A","B"]);

  /* simulado 3: volta o LP D3, e entra MAT D7 */
  caderno(E,"s3","3º Simulado", 3000,
    ["LP","LP","MAT","MAT","MAT","MAT"],
    ["D3","D3","D1","D1","D7","D7"],
    ["C","D","E","A","B","C"]);

  /* ── Estudante 01 ──
     LP D1: s1 = 1/2 (50%), s2 = 2/2 (100%)  → melhorou +50
     LP D3: s1 = 0/2 (0%),  s3 = 1/2 (50%)   → melhorou, pulando o s2
     MAT D1: s1 = 2/2, s2 = 2/2, s3 = 2/2    → manteve                */
  resultado(E,"ps1","01","Ana", [1,0, 0,0, 1,1]);
  resultado(E,"ps2","01","Ana", [1,1, 1,0, 1,1]);
  resultado(E,"ps3","01","Ana", [1,0, 1,1, 0,0]);

  /* ── Estudante 02 —— dificuldade persistente em LP D1 ──
     s1 = 0/2 (0%), s2 = 1/2 (50%→ não, 50 não é < 50)  */
  resultado(E,"ps2","02","Bruno", [0,0, 0,0, 0,0]);
  resultado(E,"ps1","02","Bruno", [0,0, 1,1, 1,0]);

  /* ── Estudante 03 —— só fez o primeiro ── */
  resultado(E,"ps1","03","Carla", [1,1, 1,1, 1,1]);
  return E;
}

const { win } = H.abrirApp({ estado: estado() });
const ev = s => win.eval(s);
const J = s => JSON.parse(ev("JSON.stringify("+s+")"));

setTimeout(() => {
  console.log("teste26 — análise longitudinal por descritor");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const hist = J('historicoPorDescritor(E.simulados)');
  ok(!!hist && Array.isArray(hist.linhas), "histórico calculado");
  ok(hist.avaliacoes.length === 3, "3 simulados entraram no histórico");
  ok(hist.tolerancia === 5, "tolerância padrão de ±5 p.p.");

  const acha = (n,c,d) => hist.linhas.find(L=>L.numero===n && L.comp===c && L.cod===d);

  /* 1. chave lógica separa componentes */
  const lpD1 = acha("01","LP","D1"), matD1 = acha("01","MAT","D1");
  ok(!!lpD1 && !!matD1, "D1 de LP e D1 de MAT são linhas diferentes");
  ok(lpD1.texto === "Localizar informação explícita", "texto do D1 de LP");
  ok(matD1.texto === "Porcentagem", "texto do D1 de MAT — não se misturam");

  /* 2. comparação com a última medida do MESMO descritor */
  ok(lpD1.vezes === 2, "LP D1 do nº 01 medido 2 vezes (veio " + lpD1.vezes + ")");
  ok(lpD1.atual.pct === 100 && lpD1.anterior.pct === 50, "50% → 100%");
  ok(lpD1.delta === 50, "diferença de +50 p.p. (veio " + lpD1.delta + ")");
  ok(lpD1.classe === "melhorou", "classificado como melhorou");

  /* 3. o descritor que faltou no simulado 2 compara com o simulado 1 */
  const lpD3 = acha("01","LP","D3");
  ok(lpD3.vezes === 2, "LP D3 medido 2 vezes — o simulado 2 não conta");
  ok(lpD3.anterior.simulado.id === "s1", "compara com o 1º simulado, não com o 2º");
  ok(lpD3.atual.simulado.id === "s3", "a medida atual é a do 3º simulado");
  ok(lpD3.delta === 50 && lpD3.classe === "melhorou", "0% → 50%, melhorou");

  /* 4. ausência nunca vira 0% */
  const semD3noS2 = (hist.linhas.filter(L=>L.comp==="LP" && L.cod==="D3")
    .some(L=>L.medidas.some(m=>m.simulado.id==="s2")));
  ok(!semD3noS2, "nenhuma medida de LP D3 foi inventada no simulado 2");
  ok(J('acertoNoDescritor(provaDe("ps2"),E.res.find(r=>r.prova==="ps2"),"LP","D3")') === null,
     "acertoNoDescritor devolve null para descritor ausente");

  /* 5. manteve, dentro da tolerância */
  ok(matD1.vezes === 3, "MAT D1 do nº 01 medido 3 vezes");
  ok(matD1.classe === "manteve", "100% → 100% é manter (veio " + matD1.classe + ")");
  ok(matD1.delta === 0, "diferença zero");

  /* 6. primeira avaliação */
  const matD7 = acha("01","MAT","D7");
  ok(matD7.classe === "primeira" && matD7.delta === null,
     "descritor novo é primeira avaliação, sem diferença");
  const carla = acha("03","LP","D1");
  ok(carla && carla.classe === "primeira", "quem só fez um simulado fica em primeira avaliação");

  /* 7. dificuldade persistente: abaixo de 50% em avaliações sucessivas */
  const bruno = acha("02","LP","D1");
  ok(bruno.medidas.length === 2, "LP D1 do nº 02 tem 2 medidas");
  ok(bruno.medidas[0].pct === 0 && bruno.medidas[1].pct === 0, "0% nas duas");
  ok(bruno.persistente === true, "dificuldade persistente sinalizada");
  ok(bruno.abaixoSeguidas === 2, "2 avaliações seguidas abaixo do piso");
  ok(acha("01","MAT","D1").persistente === false, "quem vai bem não é sinalizado");

  /* 8. a ordem das medidas é a do tempo, não a da gravação.
     O nº 02 teve o resultado do 2º simulado gravado ANTES do 1º. */
  ok(bruno.medidas[0].simulado.id === "s1" && bruno.medidas[1].simulado.id === "s2",
     "medidas em ordem cronológica, apesar da ordem de gravação");

  /* 9. tolerância configurável */
  const largo = J('historicoPorDescritor(E.simulados,{tolerancia:60})');
  const lpD1largo = largo.linhas.find(L=>L.numero==="01"&&L.comp==="LP"&&L.cod==="D1");
  ok(lpD1largo.classe === "manteve", "com tolerância de 60 p.p., +50 vira manteve");

  /* 10. resumo por descritor */
  const R = J('resumoLongitudinal(historicoPorDescritor(E.simulados))');
  const rLpD1 = R.find(x=>x.comp==="LP"&&x.cod==="D1");
  ok(!!rLpD1, "resumo traz LP D1");
  ok(rLpD1.estudantes === 3, "3 estudantes no LP D1 (veio " + rLpD1.estudantes + ")");
  ok(rLpD1.persistentes === 1, "1 em dificuldade persistente");
  ok(R.every(x=>x.comp==="LP"||x.comp==="MAT"), "resumo separado por componente");

  console.log(falhas ? "\nteste26: " + falhas + " FALHA(S)" : "\nteste26: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
