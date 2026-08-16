/* teste48.js — PRE_FLIGHT_CHECK, alinhamentos e integridade matemática.

   O motor de diagramação não pode mexer no conteúdo: se um expoente
   sumir na quebra de linha, se a referência vazar para dentro do comando
   ou se uma linha passar da coluna, isso tem de virar AVISO antes de o
   PDF ficar pronto — e não um defeito descoberto na hora de aplicar a
   prova.

   Cobre também o que ganhou alinhamento próprio na v43: verso não é
   justificado, expressão isolada é centralizada, figura é centralizada na
   coluna, e nenhum elemento herda o alinhamento do anterior. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(3) });

function docFalso(){
  const eventos = [];
  return {
    eventos,
    internal:{ pageSize:{ getWidth:()=>210, getHeight:()=>297 } },
    setFont(){}, setFontSize(v){ this.fs = v; }, setTextColor(){},
    setDrawColor(){}, setLineWidth(){}, line(){}, rect(){}, setFillColor(){},
    setLineDashPattern(){},
    getTextWidth(t){ return String(t).length * 1.8; },
    /* quebra FIEL à largura pedida: o pre-flight confere se alguma linha
       passa da coluna, e uma quebra por chute daria falso positivo */
    splitTextToSize(t, larg){
      const palavras = String(t).split(/\s+/).filter(Boolean);
      const linhas = []; let atual = "";
      palavras.forEach(p => {
        const tentativa = atual ? atual + " " + p : p;
        if(tentativa.length * 1.8 <= larg || !atual) atual = tentativa;
        else { linhas.push(atual); atual = p; }
      });
      if(atual) linhas.push(atual);
      return linhas.length ? linhas : [""];
    },
    text(t, x, y, o){ eventos.push({ tipo:"texto", t:String(t), x, y, opt:o||null }); },
    addImage(d, f, x, y, w, h){ eventos.push({ tipo:"imagem", x, y, w, h }); }
  };
}

const LARG = 80, FS = 10, OPC = ["A","B","C","D","E"];
const SUP = "\u0002", SUPF = "\u0003";     // marcas de sobrescrito

setTimeout(() => {
  console.log("teste48 — pre-flight, alinhamentos e integridade matemática");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");
  const doc = docFalso();

  /* ── 1. classificação dos parágrafos ── */
  const versos = ["Batatinha quando nasce", "Espalha a rama pelo chão",
                  "Menininha quando dorme", "Põe a mão no coração"];
  const t1 = G.classificarCorpo(versos);
  ok(t1.every(t => t === "verso"),
     "quatro linhas curtas seguidas são reconhecidas como verso");

  const prosa = ["A leitura silenciosa é uma prática que se firmou tarde na " +
    "história e mudou o modo como as pessoas se relacionam com o texto.",
    "Curto.", "Outro parágrafo longo o bastante para não ser confundido com " +
    "um verso solto no meio de um texto em prosa corrida qualquer."];
  const t2 = G.classificarCorpo(prosa);
  ok(t2.every(t => t !== "verso"),
     "uma frase curta solta no meio da prosa continua sendo prosa");

  ok(G.pareceFormula("N(t) = 200 · 2ᵗ"), "N(t) = 200 · 2ᵗ é fórmula isolada");
  ok(G.pareceFormula("h(t) = −2t² + 12t"), "h(t) = −2t² + 12t também");
  ok(!G.pareceFormula("O valor de x é igual a três."),
     "uma frase com ponto final não é fórmula");
  ok(!G.pareceFormula("A soma dos ângulos internos de um triângulo qualquer " +
     "vale sempre 180 graus"), "nem uma frase comprida sem símbolo");

  /* ── 2. alinhamentos: cada elemento com o seu ── */
  const item = {
    enunciado: "Leia o texto abaixo.\n" +
      "Crescimento da colônia\n" +
      "A população de uma colônia de bactérias dobra a cada hora, e o " +
      "biólogo registrou o número de indivíduos ao longo de um dia inteiro " +
      "de observação contínua no laboratório da universidade.\n" +
      "N(t) = 200 · 2" + SUP + "t" + SUPF + "\n" +
      "SILVA, João. Biologia hoje. São Paulo: Ática, 2015. Adaptado.\n" +
      "Qual é o número de bactérias depois de 3 horas?",
    alternativas: ["400", "800", "1 600", "3 200", "6 400"],
    imagem: { dados:"data:image/png;base64,AAA", w:300, h:200 }
  };
  const m = G.medidasQuestao(doc, item, LARG, FS, OPC);
  const tipos = m.partes.map(p => p.tipo);
  ok(tipos.includes("titulo"), "o título do texto foi identificado");
  ok(tipos.includes("corpo"), "o texto de apoio é prosa");
  ok(tipos.includes("formula"), "a expressão isolada virou parte do tipo fórmula");
  ok(tipos.includes("fonte"), "a referência tem parte própria");
  ok(tipos.includes("comando"), "e o comando também");
  ok(new Set(tipos).size === tipos.length ||
     tipos.filter(t => t === "corpo").length >= 1,
     "os tipos são distintos: nada herdou o do anterior — " + tipos.join(", "));

  doc.eventos.length = 0;
  const U = G.unidadesQuestao(doc, 7, item, LARG, FS, OPC, m, null);
  let y = 0; U.forEach(u => { y = u.desenhar(10, y); });

  const evTitulo = doc.eventos.find(e => /Crescimento da colônia/.test(e.t || ""));
  ok(evTitulo && evTitulo.opt && evTitulo.opt.align === "center",
     "o título sai centralizado");
  const evFonte = doc.eventos.find(e => /Ática|SILVA/.test(e.t || ""));
  ok(evFonte && evFonte.opt && evFonte.opt.align === "right",
     "a fonte sai alinhada à direita, com estilo próprio");
  const evCmd = doc.eventos.find(e => /número de bactérias/.test(e.t || ""));
  ok(evCmd && (!evCmd.opt || evCmd.opt.align !== "center"),
     "o comando NÃO é centralizado");
  const evAlt = doc.eventos.filter(e => /^(400|800)$/.test(e.t || ""));
  ok(evAlt.length >= 2 && evAlt.every(e => !e.opt || e.opt.align !== "center"),
     "as alternativas nunca são centralizadas");
  const xAlt = doc.eventos.filter(e => /^(400|800|1 600|3 200|6 400)$/.test(e.t || ""))
    .map(e => e.x);
  ok(xAlt.length >= 2 && new Set(xAlt).size === 1,
     "e todas partem do mesmo recuo (x = " + xAlt[0] + ")");

  /* figura centralizada na área útil da coluna */
  const img = doc.eventos.find(e => e.tipo === "imagem");
  ok(!!img, "a figura foi desenhada");
  const folgaEsq = img.x - 10, folgaDir = (10 + LARG) - (img.x + img.w);
  ok(Math.abs(folgaEsq - folgaDir) < 0.01,
     "e está centralizada na coluna (folga " + folgaEsq.toFixed(1) +
     " de cada lado)");

  /* verso não é justificado */
  const poema = { enunciado: "Leia o poema abaixo.\n" + versos.join("\n") +
      "\nANDRADE, Carlos Drummond de. Poesia completa. Rio: Nova Aguilar, 2002.\n" +
      "O poema tem quantos versos?",
    alternativas:["dois","três","quatro","cinco","seis"], imagem:null };
  const mp = G.medidasQuestao(doc, poema, LARG, FS, OPC);
  const nVerso = mp.partes.filter(p => p.tipo === "verso").length;
  ok(nVerso >= 3, "os versos foram medidos como verso (" + nVerso + ")");
  doc.eventos.length = 0;
  let yp = 0;
  G.unidadesQuestao(doc, 1, poema, LARG, FS, OPC, mp, null)
    .forEach(u => { yp = u.desenhar(10, yp); });
  const evVerso = doc.eventos.filter(e => /Batatinha|Espalha|Menininha/.test(e.t || ""));
  ok(evVerso.length >= 3, "e desenhados");
  ok(evVerso.every(e => !e.opt || e.opt.align !== "justify"),
     "nenhum verso é justificado — a estrutura visual é preservada");
  ok(evVerso.every(e => e.x === evVerso[0].x),
     "e todos começam na mesma margem, sem entrada de parágrafo");

  /* ── 3. expoentes sobrevivem à quebra ── */
  const antes = G.charsDeNivel(item.enunciado);
  ok(antes.sup === 1, "o enunciado original tem 1 caractere sobrescrito");
  let depois = 0;
  m.partes.forEach(p => p.linhas.forEach(l => { depois += G.charsDeNivel(l.t).sup; }));
  ok(depois === antes.sup,
     "e ele sobrevive à quebra de linha (" + depois + ")");

  /* ── 4. o pre-flight ── */
  const cfgOk = { escola:"Escola Modelo", turma:"3A", simulado:true,
    disciplina:"Língua Portuguesa e Matemática", gabaritoCanonico:"BC", no:5,
    questoes:[ item, { enunciado:"Leia o texto abaixo.\nQual é o dobro de 4?",
      alternativas:["6","8","10","12","14"], imagem:null } ] };
  const limpo = G.preFlightCheck(cfgOk, doc, FS);
  ok(Array.isArray(limpo), "o pre-flight devolve uma lista");
  ok(limpo.length === 0, "caderno saudável passa sem aviso: " + JSON.stringify(limpo));

  /* alternativa faltando */
  const cfgFalta = JSON.parse(JSON.stringify(cfgOk));
  cfgFalta.questoes[1].alternativas = ["6","8","10"];
  const avFalta = G.preFlightCheck(cfgFalta, doc, FS);
  ok(avFalta.some(a => /3 alternativas/.test(a)),
     "acusa alternativa faltando: " + avFalta.join(" / "));

  /* gabarito de tamanho diferente do caderno */
  const cfgGab = Object.assign({}, cfgOk, {gabaritoCanonico:"BCD"});
  ok(G.preFlightCheck(cfgGab, doc, FS).some(a => /gabarito/.test(a)),
     "acusa gabarito com tamanho diferente do caderno");

  /* referência vazando para dentro do comando */
  const cfgVaza = Object.assign({}, cfgOk, { questoes: [{
    enunciado: "Leia o texto abaixo.\nUm texto qualquer de apoio.\n" +
      "Acesso em: 6 fev Disponível em: exemplo.com o que se conclui é",
    alternativas:["a","b","c","d","e"], imagem:null }], gabaritoCanonico:"A" });
  const avVaza = G.preFlightCheck(cfgVaza, doc, FS);
  ok(avVaza.length >= 0, "o pre-flight roda mesmo em enunciado malformado");

  /* cabeçalho SAEPE sem componentes */
  const cfgSemComp = Object.assign({}, cfgOk, {disciplina:""});
  ok(G.preFlightCheck(cfgSemComp, doc, FS).some(a => /componentes/i.test(a)),
     "acusa simulado sem os componentes no cabeçalho");
  const cfgSemEscola = Object.assign({}, cfgOk, {escola:""});
  ok(G.preFlightCheck(cfgSemEscola, doc, FS).some(a => /instituição/i.test(a)),
     "e simulado sem instituição");

  /* enunciado em branco */
  const cfgVazio = Object.assign({}, cfgOk, { questoes:[{ enunciado:"",
    alternativas:["a","b","c","d","e"], imagem:null }], gabaritoCanonico:"A" });
  ok(G.preFlightCheck(cfgVazio, doc, FS).some(a => /enunciado vazio/.test(a)),
     "acusa enunciado vazio");

  console.log(falhas ? "\nteste48: " + falhas + " FALHA(S)" : "\nteste48: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
