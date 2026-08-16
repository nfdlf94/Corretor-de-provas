/* teste46.js — cabeçalho do Simulado SAEPE e a fonte bibliográfica que
   virava frase do comando.

   1. CABEÇALHO. No simulado o nome do professor não pode aparecer, e
      "SIMULADO SAEPE" precisa sair com peso tipográfico maior que o
      resto do cabeçalho. A prova comum continua exatamente como era,
      com DISCIPLINA e PROFESSOR na mesma linha.

   2. FONTE. "Disponível em: veja.abril.com.br. Acesso em: 6 fev. 2012."
      seguido de "A informação principal desse texto é:" saía como UM
      bloco só: a regra antiga (`Acesso em:[^.]*\.`) parava no ponto de
      "fev." e devolvia "2012. A informação principal…" como comando. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(3) });

/* jsPDF de mentira: registra o que foi escrito e com que corpo */
function docFalso(){
  const eventos = [];
  const doc = {
    eventos, fs: 10, estilo: "normal",
    internal:{ pageSize:{ getWidth:()=>210, getHeight:()=>297 } },
    setFont(f, e){ this.estilo = e || "normal"; }, setFontSize(v){ this.fs = v; },
    setTextColor(){}, setDrawColor(){}, setLineWidth(){}, setFillColor(){},
    line(){}, rect(){}, setLineDashPattern(){},
    getTextWidth(t){ return String(t).length * 1.8; },
    splitTextToSize(t, larg){
      const palavras = String(t).split(/\s+/).filter(Boolean);
      const porLinha = Math.max(1, Math.floor(larg / 1.8 / 6));
      const linhas = [];
      for(let i = 0; i < palavras.length; i += porLinha)
        linhas.push(palavras.slice(i, i + porLinha).join(" "));
      return linhas.length ? linhas : [""];
    },
    text(t, x, y){ eventos.push({ t:String(t), x, y, fs:this.fs, estilo:this.estilo }); },
    addImage(){}
  };
  return doc;
}

setTimeout(() => {
  console.log("teste46 — cabeçalho SAEPE e fonte bibliográfica");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");
  /* gerador.js contava com tipoDoAluno vindo do escopo global da página;
     fora do navegador é preciso emprestá-lo do embaralho */
  global.tipoDoAluno = require("./embaralho.js").tipoDoAluno;

  /* ── 1. cabeçalho ── */
  const base = { escola:"Escola Modelo", turma:"3A", disciplina:"Língua Portuguesa e Matemática",
    professor:"Natanael", periodoLabel:"Simulado SAEPE · 2026", tipos:0 };
  const aluno = { nome:"Estudante 1", numero:"01" };

  const dSim = docFalso();
  const ySim = G.cabecalho(dSim, Object.assign({}, base, {simulado:true}), aluno, false);
  const textoSim = dSim.eventos.map(e => e.t).join(" | ");

  ok(!/Natanael/.test(textoSim), "o nome do professor NÃO aparece no simulado");
  ok(!/PROFESSOR/i.test(textoSim), "nem o rótulo PROFESSOR");
  const tituloSim = dSim.eventos.find(e => /^SIMULADO SAEPE$/.test(e.t));
  ok(!!tituloSim, "SIMULADO SAEPE está impresso");
  const escolaSim = dSim.eventos.find(e => /ESCOLA MODELO/.test(e.t));
  ok(!!escolaSim, "a instituição continua no cabeçalho");
  ok(tituloSim && escolaSim && tituloSim.fs > escolaSim.fs,
     "o título tem corpo MAIOR que o nome da escola (" +
     (tituloSim ? tituloSim.fs : "-") + " > " + (escolaSim ? escolaSim.fs : "-") + ")");
  ok(tituloSim && tituloSim.estilo === "bold", "e sai em negrito");
  const outros = dSim.eventos.filter(e => e !== tituloSim).map(e => e.fs);
  ok(tituloSim && outros.every(f => f <= tituloSim.fs),
     "nenhum outro texto do cabeçalho é maior que o título");
  ok(/COMPONENTES:/.test(textoSim), "os componentes aparecem");
  ok(/Língua Portuguesa e Matemática/.test(textoSim), "com os dois nomes");
  ok(/DATA:/.test(textoSim), "e a data continua");
  ok(/ESTUDANTE 1/.test(textoSim) && /3A/.test(textoSim) && /01/.test(textoSim),
     "aluno, turma e número seguem identificados");

  /* a prova comum não muda */
  const dCom = docFalso();
  const yCom = G.cabecalho(dCom, Object.assign({}, base, {simulado:false, titulo:"Avaliação"}), aluno, false);
  const textoCom = dCom.eventos.map(e => e.t).join(" | ");
  ok(/PROFESSOR: Natanael/.test(textoCom),
     "na prova COMUM o professor continua aparecendo — nada mudou lá");
  ok(/DISCIPLINA:/.test(textoCom), "e o rótulo continua sendo DISCIPLINA");

  /* dry devolve a mesma altura que o desenho: é dela que sai o topo da
     primeira coluna, e uma diferença aqui desalinharia a paginação */
  const dSeco = docFalso();
  const ySeco = G.cabecalho(dSeco, Object.assign({}, base, {simulado:true}), aluno, true);
  ok(ySeco === ySim, "o modo dry devolve a MESMA altura do desenho (" +
     ySeco + " = " + ySim + ")");
  ok(dSeco.eventos.length === 0, "e não desenha nada");

  /* ── 2. fonte bibliográfica ── */
  const doc = docFalso();
  const enun = "Leia o texto abaixo.\n" +
    "O consumo de carboidratos antes do treino melhora o desempenho de quem " +
    "corre longas distâncias, segundo pesquisadores da universidade.\n" +
    "Disponível em: veja.abril.com.br. Acesso em: 6 fev. 2012. " +
    "A informação principal desse texto é:";
  const seg = G.segmentarEnunciado(enun);

  ok(!!seg.fonte, "a referência foi separada: " + JSON.stringify(seg.fonte));
  ok(!!seg.comando, "e o comando também: " + JSON.stringify(seg.comando));
  ok(/2012/.test(seg.fonte || ""),
     "o ANO ficou com a referência — era ele que vazava para o comando");
  ok(!/^2012/.test(seg.comando || ""),
     "o comando NÃO começa com \"2012.\"");
  ok(/^A informação principal/.test(seg.comando || ""),
     "o comando começa onde devia: " + JSON.stringify(seg.comando));
  ok(!/Acesso em/.test(seg.comando || ""), "e não traz pedaço da referência");

  /* Fonte: … num parágrafo próprio, sem nenhuma fórmula de FIM_FONTE */
  const seg2 = G.segmentarEnunciado(
    "Leia o texto abaixo.\n" +
    "A cidade cresceu depressa nos últimos anos e hoje concentra quase toda a " +
    "população da região metropolitana, que dobrou de tamanho.\n" +
    "Fonte: Revista Veja, 2012.\n" +
    "Qual é o assunto do texto?");
  ok(/^Fonte:/.test(seg2.fonte || ""),
     "\"Fonte: Revista Veja, 2012.\" é reconhecida como referência");
  ok(/^Qual é o assunto/.test(seg2.comando || ""), "e o comando fica inteiro");

  /* "Adaptado." pertence à referência, não ao comando */
  const seg3 = G.segmentarEnunciado(
    "Leia o texto abaixo.\n" +
    "O pescador saiu antes do amanhecer e voltou com a rede vazia, como vinha " +
    "acontecendo todas as manhãs daquele inverno comprido.\n" +
    "ASSIS, Machado de. Contos. São Paulo: Ática, 1998. Adaptado. " +
    "No trecho, o narrador mostra que:");
  ok(/Adaptado\./.test(seg3.fonte || ""),
     "\"Adaptado.\" fica com a referência");
  ok(!/Adaptado/.test(seg3.comando || ""), "e não abre o comando");

  /* a fonte tem estilo próprio: corpo menor que o do texto */
  const item = { enunciado: enun, alternativas:["a","b","c","d","e"], imagem:null };
  const m = G.medidasQuestao(doc, item, 80, 10, ["A","B","C","D","E"]);
  const pFonte = m.partes.find(p => p.tipo === "fonte");
  const pCorpo = m.partes.find(p => p.tipo === "corpo");
  const pCmd   = m.partes.find(p => p.tipo === "comando");
  ok(!!pFonte && !!pCorpo && !!pCmd, "texto, fonte e comando são partes distintas");
  ok(pFonte && pCorpo && pFonte.fs < pCorpo.fs,
     "a fonte usa corpo menor que o texto (" + (pFonte&&pFonte.fs) + " < " + (pCorpo&&pCorpo.fs) + ")");
  ok(pFonte && pFonte.fs >= 7.5 && pFonte.fs <= 9,
     "e fica na faixa de 8–9 pt (" + (pFonte&&pFonte.fs) + ")");

  /* e ar suficiente entre a fonte e o comando */
  const U = G.unidadesQuestao(doc, 1, item, 80, 10, ["A","B","C","D","E"], m, null);
  doc.eventos.length = 0;
  let y = 0; U.forEach(u => { y = u.desenhar(10, y); });
  const evFonte = doc.eventos.filter(e => /Acesso em|abril/.test(e.t)).pop();
  const evCmd = doc.eventos.find(e => /A informação principal/.test(e.t));
  ok(!!evFonte && !!evCmd, "os dois foram desenhados");
  ok(evFonte && evCmd && evCmd.y - evFonte.y > 5,
     "há espaço vertical de sobra entre a fonte e o comando (" +
     (evCmd && evFonte ? (evCmd.y - evFonte.y).toFixed(1) : "-") + " mm)");

  console.log(falhas ? "\nteste46: " + falhas + " FALHA(S)" : "\nteste46: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
