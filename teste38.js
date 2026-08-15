/* teste38.js — TRI ancorada na escala oficial do SAEPE.

   Sem âncora, a dificuldade de cada item sai das respostas da própria
   turma, e o nível do grupo tem de vir do percentual de acerto: uma
   turma que acerta 50% cai sempre no mesmo ponto, tenha ela acertado os
   itens fáceis ou os difíceis.

   Com os itens associados a habilidades dos documentos oficiais, a
   dificuldade vem de fora — e duas turmas com o MESMO percentual de
   acerto passam a se separar conforme QUAIS itens acertaram. */
"use strict";
const H = require("./harness");
const S = require("./saepe-oficial.js");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

/* Dois cadernos com a MESMA estrutura, mudando só a dificuldade oficial
   dos itens: um só de habilidades de nível baixo, outro só de nível alto.
   Nos dois, cada estudante acerta os 4 primeiros e erra os 4 últimos —
   padrão coerente, sem o efeito de "acertou o difícil e errou o fácil",
   que o 3PL lê como chute. A única diferença entre os dois cenários é a
   dificuldade dos itens. */
const hMat = S.habilidadesDe("MAT", "3EM");
const faceis   = hMat.filter(h => h.nivel <= 2).slice(0, 8);
const dificeis = hMat.filter(h => h.nivel >= 8).slice(0, 8);

function estado(habs){
  const E = H.estadoBase(12);
  E.turmas[0].nome = "3º Ano A";
  H.comSimulado(E, { id:"s1", nLP:0, nMAT:8, codigo:"S1", titulo:"1º", ano:2026 });
  const pr = E.provas.find(p => p.id === "ps1");
  if (habs) pr.hab = habs.map(h => h.id);
  const g = pr.gabC;
  E.turmas[0].alunos.forEach(a => {
    const Rc = g.split("").map((L,i) => i < 4 ? L : (L === "A" ? "B" : "A"));
    E.res.push({ prova:pr.id, turma:"t1", numero:a.numero, nome:a.nome,
      R:Rc.slice(), Rc, gab:g, acertos:4, erros:4, certas:[], erradas:[],
      notaDisc:0, nota:0, origem:"manual", t:Date.now() });
  });
  return E;
}

function apurar(habs){
  const { win } = H.abrirApp({ estado: estado(habs) });
  return new Promise(res => setTimeout(() => {
    res(JSON.parse(win.eval('JSON.stringify((function(){' +
      'var A=apurarComp(E.simulados[0],"MAT");' +
      'return {metodo:A.metodo, ancoras:A.ancoras, semAncoraOficial:A.semAncoraOficial,' +
      ' total:A.total, media:A.media,' +
      ' itens:A.itens.map(function(i){return {dif:i.dif, ancorado:i.ancorado};}),' +
      ' profs:A.feitos.map(function(L){return L.prof;}),' +
      ' acertos:A.feitos.map(function(L){return L.acertos;})};})())')));
  }, 900));
}

(async () => {
  console.log("teste38 — TRI ancorada na escala oficial");

  ok(faceis.length === 8 && dificeis.length === 8,
     "há 8 habilidades oficiais de nível baixo e 8 de nível alto");
  ok(S.pontoDoNivel(faceis[0]) < S.pontoDoNivel(dificeis[0]),
     "âncora das fáceis: " + S.pontoDoNivel(faceis[0]) +
     " · das difíceis: " + S.pontoDoNivel(dificeis[0]));

  const sem   = await apurar(null);
  const facil = await apurar(faceis);
  const dif   = await apurar(dificeis);

  const media = r => r.profs.reduce((a,b)=>a+b,0)/r.profs.length;
  console.log("\n  sem âncora        :", sem.metodo, "| média", media(sem).toFixed(0));
  console.log("  caderno FÁCIL     :", facil.metodo, "| média", media(facil).toFixed(0));
  console.log("  caderno DIFÍCIL   :", dif.metodo, "| média", media(dif).toFixed(0), "\n");

  ok([sem,facil,dif].every(r => r.acertos.every(a => a === 4)),
     "nos três cenários todo mundo acerta 4 de 8 — o desempenho bruto é idêntico");

  /* sem âncora, o caderno não importa: o número sai do percentual */
  ok(sem.metodo === "tri", "sem associação, é a TRI de sempre");
  ok(sem.ancoras === 0 && sem.semAncoraOficial === true, "nenhum item ancorado");
  ok(new Set(sem.profs.map(p => p.toFixed(1))).size === 1,
     "sem âncora, todos ficam exatamente no mesmo ponto");

  /* com âncora, o caderno passa a importar */
  ok(facil.metodo === "tri-ancorada" && dif.metodo === "tri-ancorada",
     "com associação, o método é a TRI ancorada");
  ok(facil.ancoras === 8 && dif.ancoras === 8, "os 8 itens estão ancorados nos dois");
  ok(media(dif) > media(facil) + 40,
     "acertar metade de um caderno DIFÍCIL vale mais que metade de um fácil: " +
     media(dif).toFixed(0) + " contra " + media(facil).toFixed(0));

  /* a dificuldade exibida por item vem da escala, não da turma */
  ok(facil.itens.every(i => i.ancorado), "todos os itens usam a dificuldade oficial");
  ok(Math.abs(facil.itens[0].dif - S.pontoDoNivel(faceis[0])) < 0.01,
     "a dificuldade mostrada é o ponto âncora do nível (" +
     facil.itens[0].dif + " · " + S.pontoDoNivel(faceis[0]) + ")");
  ok(dif.itens[0].dif > facil.itens[0].dif + 100,
     "e o caderno difícil aparece com itens bem mais difíceis");

  /* a proficiência continua dentro da faixa da etapa */
  ok(facil.profs.concat(dif.profs).every(p => p >= 175 && p <= 425),
     "nenhuma proficiência sai da faixa");

  /* ── a tela ── */
  const { win } = H.abrirApp({ estado: estado(null), confirmar: true });
  const ev = s => win.eval(s);
  setTimeout(() => {
    ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");
    ev('casaTurma="t1"; casaSim="s1"; casaNivel="habilidades"; habItem=null; montarCasa();');
    const corpo = () => win.document.getElementById("casaCorpo");
    ok(/Habilidades da escala/.test(corpo().textContent), "a tela abre");
    ok(corpo().querySelectorAll("[data-i]").length === 8, "lista os 8 itens");

    /* abrir um item traz sugestões da etapa e do componente */
    corpo().querySelector('[data-i="0"]').click();
    const sug = corpo().querySelectorAll("[data-h]");
    ok(sug.length >= 5, "o item abre com sugestões (" + sug.length + ")");
    const ids = [...sug].map(b => b.dataset.h);
    ok(ids.every(id => { const h = ev('JSON.stringify(habilidadeDe(' + JSON.stringify(id) + '))');
      const o = JSON.parse(h); return o && o.comp === "MAT" && o.etapa === "3EM"; }),
      "todas as sugestões são de Matemática do 3º EM");

    sug[0].click();
    ok(ev('provaDe("ps1").hab[0]') === ids[0], "escolher grava a habilidade no item");
    ok(ev('ancorasDoCaderno(provaDe("ps1")).comAncora') === 1, "o contador sobe para 1");

    /* preenchimento automático dos que faltam */
    ev('habItem=null; montarCasa();');
    win.document.getElementById("habAuto").click();
    const depois = ev('ancorasDoCaderno(provaDe("ps1")).comAncora');
    ok(depois >= 6, "a sugestão automática preenche o resto (" + depois + " de 8)");
    ok(ev('provaDe("ps1").hab[0]') === ids[0], "e não mexe no que já estava escolhido");

    /* com os itens associados, a apuração muda de método sozinha */
    ok(ev('apurarComp(E.simulados[0],"MAT").metodo') === "tri-ancorada",
       "a apuração passa a usar a TRI ancorada");

    console.log(falhas ? "\nteste38: " + falhas + " FALHA(S)" : "\nteste38: tudo certo");
    process.exit(falhas ? 1 : 0);
  }, 900);
})();
