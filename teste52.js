/* teste52.js — questões cujas ALTERNATIVAS estão dentro da figura.

   O caso: "Assinale a alternativa cujo gráfico representa essa função",
   com os cinco gráficos numa imagem só. Comparando o original com o
   caderno gerado apareceram três coisas:

   1. a figura saía ANTES do comando — o aluno via as cinco opções antes
      de saber o que procurar nelas. A regra de pôr o gráfico entre o
      texto e a pergunta vale para o gráfico de APOIO; aqui a figura é a
      resposta;

   2. embaixo da figura saíam cinco linhas "A)" "B)" … vazias, porque as
      alternativas não têm texto — ruído e meia coluna desperdiçada;

   3. e o defeito silencioso: o app embaralha as alternativas por
      estudante e monta o gabarito individual a partir desse
      embaralhamento. A imagem é a mesma para todos e não gira junto —
      então o gabarito apontava para a bolha errada e a questão saía
      MAL CORRIGIDA sem ninguém perceber. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(6) });

function docFalso(){
  const ev = [];
  return {
    ev,
    internal:{ pageSize:{ getWidth:()=>210, getHeight:()=>297 } },
    setFont(){}, setFontSize(v){ this.fs = v; }, setTextColor(){},
    setDrawColor(){}, setLineWidth(){}, line(){}, rect(){}, setFillColor(){},
    setLineDashPattern(){},
    getTextWidth(t){ return String(t).length * 1.8; },
    splitTextToSize(t, larg){
      const w = String(t).split(/\s+/).filter(Boolean);
      const o = []; let a = "";
      w.forEach(p => { const x = a ? a+" "+p : p;
        if(x.length*1.8 <= larg || !a) a = x; else { o.push(a); a = p; } });
      if(a) o.push(a);
      return o.length ? o : [""];
    },
    text(t, x, y){ ev.push({tipo:"texto", t:String(t), x, y}); },
    addImage(d, f, x, y, w, h){ ev.push({tipo:"imagem", x, y, w, h}); }
  };
}

const LARG = 80, FS = 10, OPC = ["A","B","C","D","E"];
const IMG = {dados:"data:image/png;base64,AAA", w:1169, h:674};

/* a questão da foto: enunciado, comando, e os cinco gráficos na imagem */
const grafica = {
  enunciado: "Considere uma função polinomial do 1º grau f: R → R cujo " +
    "coeficiente angular é 2 e cujo coeficiente linear é −6.\n" +
    "Assinale a alternativa cujo gráfico representa essa função.",
  alternativas: ["", "", "", "", ""],
  imagem: IMG
};
/* questão comum de gráfico de APOIO: a imagem ilustra, as opções são texto */
const apoio = {
  enunciado: "Observe o gráfico abaixo.\nQual é a lei de formação dessa função?",
  alternativas: ["f(x) = 2x − 6", "f(x) = −2x + 6", "f(x) = 2x + 6",
                 "f(x) = −2x − 6", "f(x) = x − 6"],
  imagem: IMG
};

setTimeout(() => {
  console.log("teste52 — alternativas dentro da figura");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");
  /* gerador.js conta com o embaralho vindo do escopo global da página */
  const Emb = require("./embaralho.js");
  global.chaveDeOrdem = Emb.chaveDeOrdem;
  global.embaralharProva = Emb.embaralharProva;
  global.embaralharEmBlocos = Emb.embaralharEmBlocos;

  /* ── 1. a detecção ── */
  ok(G.alternativasNaFigura(grafica) === true,
     "cinco alternativas vazias + imagem = opções na figura");
  ok(G.alternativasNaFigura(apoio) === false,
     "alternativas com texto = gráfico de apoio, não de resposta");
  ok(G.alternativasNaFigura({enunciado:"x", alternativas:["","","","",""],
     imagem:null}) === false, "sem imagem, alternativa vazia é só alternativa vazia");
  ok(G.alternativasNaFigura({enunciado:"x", alternativas:["a","","","",""],
     imagem:IMG}) === false, "com UMA alternativa preenchida, não é o caso");
  ok(G.indicesFixos([apoio, grafica, apoio, grafica]).join(",") === "1,3",
     "indicesFixos aponta as questões travadas");

  /* ── 2. a figura vai DEPOIS do comando ── */
  const doc = docFalso();
  const m = G.medidasQuestao(doc, grafica, LARG, FS, OPC);
  doc.ev.length = 0;
  let y = 0;
  G.unidadesQuestao(doc, 2, grafica, LARG, FS, OPC, m, null)
    .forEach(u => { y = u.desenhar(10, y); });
  const img = doc.ev.find(e => e.tipo === "imagem");
  const cmd = doc.ev.find(e => /Assinale a alternativa/.test(e.t || ""));
  const enun = doc.ev.find(e => /coeficiente angular/.test(e.t || ""));
  ok(!!img && !!cmd && !!enun, "enunciado, comando e figura foram desenhados");
  ok(enun && cmd && enun.y < cmd.y, "o enunciado vem antes do comando");
  ok(cmd && img && cmd.y < img.y,
     "e o COMANDO vem antes da figura (" + (cmd ? cmd.y.toFixed(1) : "-") +
     " < " + (img ? img.y.toFixed(1) : "-") + ") — era o contrário");

  /* o gráfico de apoio continua onde sempre esteve */
  const doc2 = docFalso();
  const m2 = G.medidasQuestao(doc2, apoio, LARG, FS, OPC);
  doc2.ev.length = 0;
  let y2 = 0;
  G.unidadesQuestao(doc2, 3, apoio, LARG, FS, OPC, m2, null)
    .forEach(u => { y2 = u.desenhar(10, y2); });
  const img2 = doc2.ev.find(e => e.tipo === "imagem");
  const cmd2 = doc2.ev.find(e => /lei de formação/.test(e.t || ""));
  ok(img2 && cmd2 && img2.y < cmd2.y,
     "gráfico de APOIO segue antes do comando — nada mudou lá");

  /* ── 3. sem linhas A) B) C) vazias ── */
  ok(m.alts.length === 0, "a questão gráfica não gera alternativas de texto");
  const letrasSoltas = doc.ev.filter(e => /^[A-E]\)$/.test(e.t || ""));
  ok(letrasSoltas.length === 0,
     "e nenhuma letra solta é impressa (" + letrasSoltas.length + ")");
  ok(m2.alts.length === 5, "a questão de apoio continua com as cinco");
  ok(doc2.ev.filter(e => /^[A-E]\)$/.test(e.t || "")).length === 5,
     "e imprime as cinco letras");

  /* as alturas continuam fechando */
  ok(Math.abs(y - (m.h + G.AR_QUESTAO())) < 0.01,
     "a altura desenhada bate com a medida (" + y.toFixed(2) + ")");
  ok(Math.abs(y2 - (m2.h + G.AR_QUESTAO())) < 0.01,
     "na questão de apoio também");

  /* ── 4. a trava do embaralhamento ── */
  const nq = 4, no = 5;
  const fixas = [1, 3];
  const identidade = [0,1,2,3,4];
  let travadas = 0, livres = 0, giradas = 0;
  ["01","02","03","07","15"].forEach(num => {
    const r = G.ordemDaProva(nq, no, "3A", num, null, false, fixas);
    for(let p = 0; p < nq; p++){
      const ehFixa = fixas.indexOf(r.oq[p]) >= 0;
      const igual = JSON.stringify(r.oa[p]) === JSON.stringify(identidade);
      if(ehFixa){ travadas++; if(!igual) falhas++; }
      else { livres++; if(!igual) giradas++; }
    }
  });
  ok(travadas === 10, "dez posições travadas conferidas");
  ok(giradas > 0, "e as outras continuam embaralhando normalmente");

  /* sem fixas, o comportamento é exatamente o de antes */
  const semFixas = G.ordemDaProva(nq, no, "3A", "01", null, false);
  const comVazio = G.ordemDaProva(nq, no, "3A", "01", null, false, []);
  ok(JSON.stringify(semFixas) === JSON.stringify(comVazio),
     "lista de travadas vazia não muda nada");

  /* ── 5. o gabarito individual respeita a trava ── */
  /* na questão travada, a letra do gabarito individual tem de ser a
     MESMA do gabarito canônico — é o que garante que a bolha marcada
     sobre a imagem seja lida certo */
  const gabC = "BDAC";
  let conferidas = 0;
  ["01","02","05","09"].forEach(num => {
    const g = G.gabaritoIndividual(gabC, "3A", num, no, null, false, fixas);
    const {oq} = G.ordemDaProva(gabC.length, no, "3A", num, null, false, fixas);
    for(let p = 0; p < gabC.length; p++){
      if(fixas.indexOf(oq[p]) < 0) continue;
      conferidas++;
      if(g[p] !== gabC[oq[p]]) falhas++;
    }
  });
  ok(conferidas === 8,
     "oito posições travadas conferidas no gabarito individual");
  ok(true, "e em todas a letra individual é igual à canônica — a bolha " +
     "marcada sobre a imagem é lida certo");

  /* sem a trava, o gabarito diverge: é a prova de que o defeito existia */
  let divergiu = 0;
  ["01","02","05","09"].forEach(num => {
    const g = G.gabaritoIndividual(gabC, "3A", num, no, null, false);
    const {oq} = G.ordemDaProva(gabC.length, no, "3A", num, null, false);
    for(let p = 0; p < gabC.length; p++)
      if(fixas.indexOf(oq[p]) >= 0 && g[p] !== gabC[oq[p]]) divergiu++;
  });
  ok(divergiu > 0,
     "sem a trava, " + divergiu + " dessas posições sairiam com a letra " +
     "errada — era a correção silenciosamente furada");

  /* ── 6. o pre-flight explica em vez de acusar ── */
  const cfg = {escola:"E", disciplina:"Matemática", simulado:true, no:5,
    gabaritoCanonico:"AB", questoes:[apoio, grafica],
    comps:["MAT","MAT"], rotulosComp:{MAT:"Matemática"}};
  const av = G.preFlightCheck(cfg, docFalso(), FS);
  ok(av.some(a => /alternativas estão dentro da figura/.test(a)),
     "avisa que a questão 2 tem as opções na figura");
  ok(av.some(a => /travada/.test(a)),
     "e que a ordem delas fica travada");
  ok(!av.some(a => /alternativa em branco/.test(a)),
     "e NÃO acusa alternativa em branco — não é erro, é o formato");

  const brancoDeVerdade = Object.assign({}, cfg, {questoes:[apoio,
    {enunciado:"Uma questão qualquer?", alternativas:["a","","c","d","e"],
     imagem:null}]});
  ok(G.preFlightCheck(brancoDeVerdade, docFalso(), FS)
     .some(a => /alternativa em branco/.test(a)),
     "alternativa em branco de verdade continua sendo acusada");

  console.log(falhas ? "\nteste52: " + falhas + " FALHA(S)" : "\nteste52: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1000);
