/* teste31.js — TRI conjunta e itens âncora.
   Uma calibração conjunta só põe estudantes de CADERNOS DIFERENTES na
   mesma escala se houver itens em comum entre eles. Sem âncoras, o
   modelo não distingue "turma melhor" de "caderno mais fácil": assume
   que os grupos são iguais e achata a diferença entre as turmas.
   Cenário do professor: três turmas do 3º ano, cada uma com o SEU
   sorteio, com desempenhos bem diferentes. */
"use strict";
const H = require("./harness");

function caderno(E, id, turmaId, titulo, criado, nLP, nMAT, prefixo){
  const letras = ["A","B","C","D","E"];
  const comps = [].concat(Array(nLP).fill("LP"), Array(nMAT).fill("MAT"));
  const nq = comps.length;
  const questoes = comps.map((c,i) => ({
    enunciado: prefixo + " " + c + " item " + (i+1),   // texto é a chave hoje
    alternativas: letras.map(L=>"alt "+L), correta: i % 5, imagem: null }));
  const gabC = questoes.map(q=>letras[q.correta]).join("");
  E.provas.push({ id:"p"+id, turma:turmaId, disciplina:null, codigo:id.toUpperCase(),
    titulo, periodo:null, nq, no:5, gabC, simulado:id, comps,
    desc: comps.map((c,i)=>"D"+((i%5)+1)), orig: comps.map((c,i)=>i+1),
    gabItens:gabC.split(""), habs:[], questoes, discursivas:[], criada:criado });
  E.simulados.push({ id, turma:turmaId, titulo, etapa:"3EM", ano:2026, prova:"p"+id,
    metodo:"tri", alternarBlocos:true, tipos:0, qtd:{LP:nLP,MAT:nMAT}, fontes:{},
    criado, valorParticipacao:1.25, partAluno:{} });
}

/* grava resultados com uma taxa de acerto alvo por estudante */
function respostas(E, provaId, alunos, taxa){
  const pr = E.provas.find(p=>p.id===provaId), g = pr.gabC;
  alunos.forEach((a,k) => {
    const acertar = Math.round(pr.nq * taxa[k]);
    /* espalha os acertos pelo caderno inteiro, não só no começo */
    const Rc = g.split("").map((letra,i) =>
      ((i*7) % pr.nq) < acertar ? letra : (letra==="A"?"B":"A"));
    E.res.push({ prova:provaId, turma:pr.turma, numero:a.numero, nome:a.nome,
      R:Rc.slice(), Rc, gab:g, acertos:Rc.filter((x,i)=>x===g[i]).length, erros:pr.nq-acertar,
      certas:[], erradas:[], notaDisc:0, nota:0, origem:"manual", t:Date.now() });
  });
}

function estado(mesmo){
  const E = H.estadoBase(12);
  E.turmas[0].nome = "3º Ano A"; E.turmas[0].serie = "3º ano do Ensino Médio";
  ["B","C"].forEach((L,n) => {
    E.turmas.push(JSON.parse(JSON.stringify(E.turmas[0])));
    const t = E.turmas[E.turmas.length-1];
    t.id = "t" + (n+2); t.nome = "3º Ano " + L;
  });
  E.descritores = { LP:{D1:"a",D2:"b",D3:"c",D4:"d",D5:"e"},
                    MAT:{D1:"a",D2:"b",D3:"c",D4:"d",D5:"e"} };

  /* cada turma com o SEU sorteio: enunciados diferentes */
  caderno(E,"sa","t1","1º Simulado SAEPE",1000,8,8,"SORTEIO A");
  caderno(E,"sb","t2","1º Simulado SAEPE",1000,8,8, mesmo?"SORTEIO A":"SORTEIO B");
  caderno(E,"sc","t3","1º Simulado SAEPE",1000,8,8, mesmo?"SORTEIO A":"SORTEIO C");

  /* A é forte (75%), B média (55%), C fraca (35%) */
  respostas(E,"psa",E.turmas[0].alunos, E.turmas[0].alunos.map((_,i)=>0.60+0.03*i));
  respostas(E,"psb",E.turmas[1].alunos, E.turmas[1].alunos.map((_,i)=>0.40+0.03*i));
  respostas(E,"psc",E.turmas[2].alunos, E.turmas[2].alunos.map((_,i)=>0.20+0.03*i));
  return E;
}

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

function medir(mesmoCaderno){
  const E = estado(mesmoCaderno);
  const { win } = H.abrirApp({ estado: E });
  return new Promise(res => setTimeout(() => {
    const J = q => JSON.parse(win.eval("JSON.stringify("+q+")"));
    res(J('(function(){var A=apurarConjunto(E.simulados,"LP");'+
      'return {metodo:A.metodo, ancoras:A.ancoras, nCadernos:A.nCadernos,'+
      ' semAncora:A.semAncora, media:A.media,'+
      ' turmas:A.turmas.map(x=>({nome:x.turma.nome, media:x.media, pct:x.pct}))};})()'));
  }, 900));
}

(async () => {
  console.log("teste31 — TRI conjunta só compara turmas com itens âncora");

  const dif = await medir(false);
  const igual = await medir(true);

  const espalho = t => Math.max.apply(null,t.map(x=>x.media)) - Math.min.apply(null,t.map(x=>x.media));
  const espalhoPct = t => Math.max.apply(null,t.map(x=>x.pct)) - Math.min.apply(null,t.map(x=>x.pct));

  console.log("\n  sorteios diferentes:", dif.metodo,
    "| âncoras:", dif.ancoras, "| turmas:", dif.turmas.map(x=>x.media.toFixed(0)).join(" / "));
  console.log("  mesmo caderno      :", igual.metodo,
    "| âncoras:", igual.ancoras, "| turmas:", igual.turmas.map(x=>x.media.toFixed(0)).join(" / "));
  console.log("  (% de acerto igual nos dois:", dif.turmas.map(x=>x.pct.toFixed(1)).join(" / "), ")\n");

  /* os dois cenários partem do MESMO desempenho */
  ok(Math.abs(espalhoPct(dif.turmas) - espalhoPct(igual.turmas)) < 0.01,
     "o desempenho real das turmas é o mesmo nos dois cenários (" +
     espalhoPct(dif.turmas).toFixed(1) + " p.p. de diferença)");

  /* com o mesmo caderno, a TRI conjunta roda e separa as turmas */
  ok(igual.metodo === "tri", "com o mesmo caderno, a TRI conjunta é usada");
  ok(igual.ancoras >= 5, "há itens âncora entre as turmas (" + igual.ancoras + ")");
  ok(!igual.semAncora, "o recorte não é marcado como sem âncora");
  ok(espalho(igual.turmas) > 50, "a TRI separa as turmas em mais de 50 pontos (veio " +
     espalho(igual.turmas).toFixed(0) + ")");

  /* com sorteios diferentes, NÃO há âncora: a TRI conjunta fica de fora */
  ok(dif.nCadernos === 3, "o recorte tem 3 cadernos diferentes");
  ok(dif.ancoras === 0, "nenhum item em comum entre eles (veio " + dif.ancoras + ")");
  ok(dif.semAncora === true, "o recorte é marcado como sem âncora");
  ok(dif.metodo === "pct", "a apuração cai para percentual de acerto, e não finge TRI");

  /* e o percentual, sendo honesto, preserva a diferença entre as turmas */
  ok(espalho(dif.turmas) > 50, "o percentual preserva a diferença real (veio " +
     espalho(dif.turmas).toFixed(0) + " pontos)");

  /* a ordem das turmas é a mesma nos dois métodos */
  ok(dif.turmas.map(x=>x.nome).join() === igual.turmas.map(x=>x.nome).join(),
     "as turmas ficam na mesma ordem nos dois cenários");

  console.log(falhas ? "\nteste31: " + falhas + " FALHA(S)" : "\nteste31: tudo certo");
  process.exit(falhas ? 1 : 0);
})();
