/* teste59.js — a moldura do texto de apoio, como no caderno oficial.

   O caderno do SAEPE cerca o texto de apoio com um fio fino: o estudante
   vê de relance onde começa e onde termina o que ele tem de ler, e o
   comando fica visivelmente do lado de fora. É a marca visual mais
   reconhecível da prova, e o app não tinha.

   Regras que este teste fixa:

   - o fio entra quando há "Leia o texto abaixo." ou um título — a
     assinatura de um texto de apoio de verdade. Sem os dois, o enunciado
     É o problema (a maioria das questões de Matemática) e cercá-lo não
     diria nada;
   - ficam DENTRO título e texto; ficam FORA a instrução, a referência
     bibliográfica, o comando e as alternativas;
   - o texto é medido na largura já descontada, senão a linha encosta no
     fio;
   - e o fio é desenhado POR UNIDADE, para que um texto que se divida
     entre as colunas saia com o fio aberto do lado do corte, como uma
     tabela partida. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(3) });

function docFalso(){
  const d = {
    ev:[], linhas:[],
    internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},
    setFont(){}, setFontSize(v){this.fs=v;}, setTextColor(){}, setDrawColor(){},
    setLineWidth(){}, rect(){}, setFillColor(){}, setLineDashPattern(){},
    line(x1,y1,x2,y2){ this.linhas.push({x1,y1,x2,y2}); },
    getTextWidth(t){ return String(t).length*1.75; },
    splitTextToSize(t,l){
      const w=String(t).split(/\s+/).filter(Boolean); const o=[]; let a="";
      w.forEach(p=>{const x=a?a+" "+p:p; if(x.length*1.75<=l||!a)a=x;else{o.push(a);a=p;}});
      if(a)o.push(a); return o.length?o:[""];
    },
    text(t,x,y,op){ this.ev.push({t:String(t),x,y,op:op||null}); },
    addImage(){}
  };
  return d;
}

const LARG = 89.5, FS = 10.5, OPC = ["A","B","C","D","E"];

/* a questão da foto: SAEPE, "É hora de escutar Emicida" */
const emicida = {
  enunciado: "Leia o texto abaixo.\n" +
    "É hora de escutar Emicida\n" +
    "Em momentos de crise, a impressão que se tem é de que a criatividade " +
    "artística se aguça. Num período em que muitos artistas e o mercado " +
    "valorizam o single, o álbum volta a mostrar força.\n" +
    "AmarElo é daqueles materiais que vale ser ouvido até por quem não está " +
    "acostumado a consumir rap. O discurso é forte e, ao mesmo tempo, sutil.\n" +
    "IZEL, Adriana. Correio Braziliense, 5 nov. 2019. Acesso em: 8 jul. 2024. Fragmento.\n" +
    "Qual trecho desse texto apresenta um argumento utilizado pela autora?",
  alternativas:["“Em momentos de crise […]”. (1º parágrafo)",
                "“Num período em que muitos artistas […]”. (1º parágrafo)",
                "“Emicida disponibilizou […]”. (1º parágrafo)",
                "“As letras falam de temas atuais […]”. (2º parágrafo)",
                "“O discurso é forte […]”. (2º parágrafo)"],
  imagem: null
};

/* questão de Matemática: o enunciado É o problema, não há texto de apoio */
const matematica = {
  enunciado: "Um encanador cobra R$ 60,00 pela visita mais R$ 45,00 por hora " +
    "de serviço. Um cliente pagou R$ 240,00 por um serviço.\n" +
    "Calcule o número de horas trabalhadas e assinale a alternativa correta.",
  alternativas:["6.","4.","8.","3.","5."], imagem:null
};

setTimeout(() => {
  console.log("teste59 — moldura do texto de apoio");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");
  const doc = docFalso();

  /* ── 1. quem leva moldura ── */
  const m = G.medidasQuestao(doc, emicida, LARG, FS, OPC);
  const tipos = m.partes.map(p => p.tipo);
  ok(m.abreMold >= 0, "a questão com texto de apoio leva moldura");
  ok(tipos[m.abreMold] === "titulo",
     "o fio abre no título (" + tipos[m.abreMold] + ")");
  ok(tipos[m.fechaMold] === "corpo",
     "e fecha no último parágrafo do texto (" + tipos[m.fechaMold] + ")");
  ok(m.partes.filter(p => p.moldura).map(p => p.tipo).join(",") ===
     "titulo,corpo,corpo",
     "dentro do fio: título e texto — nada mais");
  ["instrucao","fonte","comando"].forEach(t => {
    const pt = m.partes.find(p => p.tipo === t);
    ok(pt && !pt.moldura, "a " + t + " fica FORA do fio");
  });

  const mm = G.medidasQuestao(doc, matematica, LARG, FS, OPC);
  ok(mm.abreMold === -1,
     "a questão de Matemática, sem \"Leia o texto\" e sem título, NÃO leva " +
     "moldura — o enunciado dela é o próprio problema");
  ok(mm.partes.every(p => !p.moldura), "nenhuma parte dela é cercada");

  /* título sozinho, sem instrução, também conta */
  const soTitulo = G.medidasQuestao(doc, {enunciado:
    "O Peixe\nTendo por berço o lago cristalino, folga o peixe a nadar todo " +
    "inocente, medo ou receio do porvir não sente.\nO texto trata de:",
    alternativas:["a","b","c","d","e"], imagem:null}, LARG, FS, OPC);
  ok(soTitulo.abreMold >= 0, "só o título já basta para o fio entrar");

  /* ── 2. o texto respira dentro do fio ── */
  const cercadas = m.partes.filter(p => p.moldura);
  const soltas = m.partes.filter(p => !p.moldura);
  ok(cercadas.every(p => p.larg < LARG),
     "as partes cercadas são medidas mais estreitas (" +
     cercadas[0].larg.toFixed(1) + " contra " + LARG + ")");
  ok(soltas.every(p => p.larg === LARG),
     "e as de fora continuam na largura cheia da coluna");

  /* ── 3. o desenho ── */
  doc.ev.length = 0; doc.linhas.length = 0;
  const U = G.unidadesQuestao(doc, 13, emicida, LARG, FS, OPC, m, null);
  let y = 0; U.forEach(u => { y = u.desenhar(12, y); });

  const soma = U.reduce((a, u) => a + u.h, 0);
  ok(Math.abs(y - soma) < 0.01,
     "a altura desenhada bate com a soma das unidades (" + y.toFixed(2) + ")");
  ok(Math.abs(soma - (m.h + G.AR_QUESTAO())) < 0.01,
     "e com a altura medida — o respiro do fio entra na conta uma vez só");

  const vert = doc.linhas.filter(l => l.x1 === l.x2 && Math.abs(l.y2-l.y1) > 0.5);
  const horiz = doc.linhas.filter(l => l.y1 === l.y2 && Math.abs(l.x2-l.x1) > LARG*0.8);
  ok(horiz.length === 2, "duas horizontais: o fio abre e fecha uma vez (" +
     horiz.length + ")");
  const xs = [...new Set(vert.map(l => Math.round(l.x1*10)/10))].sort((a,b)=>a-b);
  ok(xs.length === 2 && xs[0] === 12 && xs[1] === 12 + LARG,
     "as verticais correm nas duas bordas da coluna (" + xs.join(" e ") + ")");
  ok(vert.length === cercadas.reduce((n,p)=>n+(p.linhas.length>=4?p.linhas.length:1),0)*2,
     "uma vertical por unidade cercada, de cada lado (" + vert.length + ")");

  /* o texto de dentro começa depois da borda; o de fora, na borda */
  const dentroX = doc.ev.filter(e => /Em momentos|AmarElo é daqueles/.test(e.t))
    .map(e => e.x);
  ok(dentroX.every(x => x > 12), "o texto cercado não encosta no fio");
  const cmd = doc.ev.find(e => /Qual trecho/.test(e.t));
  ok(cmd && cmd.x === 12, "o comando volta à margem da coluna, fora do fio");
  const fonte = doc.ev.find(e => /IZEL/.test(e.t));
  ok(fonte && fonte.op && fonte.op.align === "right",
     "e a referência segue alinhada à direita, abaixo do fio");

  /* ── 4. o fio sobrevive à quebra de coluna ── */
  /* um texto longo dividido entre as colunas: cada metade tem de sair com
     o fio aberto do lado do corte, e não com o fio fechado no meio */
  const longo = {enunciado: "Leia o texto abaixo.\nUm título qualquer\n" +
    ("A leitura silenciosa firmou-se tarde na história e mudou o modo como as " +
     "pessoas se relacionam com o texto escrito, porque permitiu que cada " +
     "leitor seguisse o próprio ritmo. ").repeat(4) +
    "\nASSIS, Machado de. Contos. Ática, 1998. Acesso em: 6 fev. 2012.\n" +
    "De acordo com o texto:",
    alternativas:["a","b","c","d","e"], imagem:null};
  const ml = G.medidasQuestao(doc, longo, LARG, FS, OPC);
  const Ul = G.unidadesQuestao(doc, 1, longo, LARG, FS, OPC, ml, null);
  const cercadasU = [];
  doc.linhas.length = 0;
  Ul.forEach((u, i) => {
    doc.linhas.length = 0;
    u.desenhar(12, 0);
    const temVert = doc.linhas.some(l => l.x1 === l.x2 && Math.abs(l.y2-l.y1) > 0.5);
    const temHoriz = doc.linhas.filter(l => l.y1 === l.y2 && Math.abs(l.x2-l.x1) > LARG*0.8);
    if(temVert) cercadasU.push({i, horiz: temHoriz.length});
  });
  ok(cercadasU.length >= 4,
     cercadasU.length + " unidades cercadas — o texto pode ser dividido " +
     "entre as colunas");
  ok(cercadasU.filter(u => u.horiz > 0).length === 2,
     "e só DUAS delas fecham o fio: a primeira e a última. As do meio saem " +
     "abertas, para a quebra ler como continuação");
  ok(cercadasU[0].horiz === 1 && cercadasU[cercadasU.length-1].horiz === 1,
     "a de cima abre e a de baixo fecha");

  console.log(falhas ? "\nteste59: " + falhas + " FALHA(S)" : "\nteste59: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
