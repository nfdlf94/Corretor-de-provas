/* teste49.js — o expoente que ia parar no fim da frase, e a estrofe
   centralizada.

   1. LEITURA. O pdf.js não entrega o expoente no meio da sequência: ele
      emite primeiro o corpo da linha e depois os pedaços deslocados da
      linha de base. `agruparLinhas` concatenava na ORDEM DE CHEGADA, e
      o resultado impresso era:

        P(t) = P · 1,01 , em que P = 10 000 … o tempo em₀  ₀ anos.

      com os dois "₀" de P₀ atirados para o fim da frase e o "ᵗ" de 1,01ᵗ
      fora do lugar em que significa alguma coisa. Dentro de uma linha,
      x crescente É a ordem de leitura — é por x que os pedaços têm de
      ser juntados.

      ATENÇÃO: esta correção é na LEITURA do arquivo. O caderno guarda o
      que foi lido na importação, então os simulados já importados
      precisam ser importados de novo para se beneficiarem dela.

   2. POEMA. A estrofe é centralizada como BLOCO — deslocada para o meio
      da coluna, com os versos alinhados à esquerda entre si. Centralizar
      cada verso isoladamente faria a estrofe virar um losango. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(2) });
const J = s => JSON.parse(win.eval("JSON.stringify(" + s + ")"));

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
    text(t, x, y, o){ ev.push({ t:String(t), x, y, fs:this.fs, opt:o||null }); },
    addImage(){}
  };
}

setTimeout(() => {
  console.log("teste49 — expoente no lugar certo e estrofe centralizada");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");

  /* ── 1. leitura: os pedaços fora de ordem ── */
  /* N(t) = 2 · 3ᵗ — o "t" chega DEPOIS do resto da linha */
  win.__a = [
    {transform:[0,0,0,0, 70,700], height:10, str:"A evolução prevista para certa cultura de bactérias é dada por N(t) = 2 · 3"},
    {transform:[0,0,0,0,340,700], height:10, str:", em que N é o número de bactérias e t, o tempo em anos."},
    {transform:[0,0,0,0,336,703], height: 6, str:"t"}
  ];
  const L1 = J("agruparLinhas(window.__a)");
  ok(L1.length === 1, "os três pedaços formam UMA linha");
  ok(/3\u0002t\u0003,/.test(L1[0].txt),
     "o expoente ficou colado no 3, antes da vírgula: " + JSON.stringify(L1[0].txt));
  ok(!/anos\.\u0002/.test(L1[0].txt),
     "e NÃO foi parar depois de \"anos.\" — era o defeito");

  /* P(t) = P₀ · 1,01ᵗ … Adote 1,01²⁰ = 1,22. */
  win.__b = [
    {transform:[0,0,0,0, 70,680], height:10, str:"dada pela expressão P(t) = P"},
    {transform:[0,0,0,0,210,680], height:10, str:" · 1,01"},
    {transform:[0,0,0,0,250,680], height:10, str:", em que P"},
    {transform:[0,0,0,0,300,680], height:10, str:" = 10 000 é a população inicial e t, o tempo em"},
    {transform:[0,0,0,0,205,677], height: 6, str:"0"},
    {transform:[0,0,0,0,246,683], height: 6, str:"t"},
    {transform:[0,0,0,0,297,677], height: 6, str:"0"},
    {transform:[0,0,0,0, 70,660], height:10, str:"anos. Adote 1,01"},
    {transform:[0,0,0,0,150,660], height:10, str:" = 1,22."},
    {transform:[0,0,0,0,146,663], height: 6, str:"20"}
  ];
  const L2 = J("agruparLinhas(window.__b)");
  ok(L2.length === 2, "duas linhas (" + L2.length + ")");
  ok(/P₀ · 1,01\u0002t\u0003, em que P₀ = 10 000/.test(L2[0].txt),
     "P₀ · 1,01ᵗ, em que P₀ = 10 000 — tudo no lugar: " + JSON.stringify(L2[0].txt));
  ok(!/em₀/.test(L2[0].txt) && !/em\u0002/.test(L2[0].txt),
     "nada foi atirado para o fim da frase");
  ok(L2[1].txt === "anos. Adote 1,01²⁰ = 1,22.",
     "e o expoente 20 saiu inteiro: " + JSON.stringify(L2[1].txt));

  /* texto sem expoente nenhum continua exatamente igual */
  win.__c = [
    {transform:[0,0,0,0, 70,700], height:10, str:"A cidade cresceu depressa "},
    {transform:[0,0,0,0,180,700], height:10, str:"nos últimos anos."},
    {transform:[0,0,0,0, 70,684], height:10, str:"Outra linha do texto."}
  ];
  const L3 = J("agruparLinhas(window.__c)");
  ok(L3[0].txt === "A cidade cresceu depressa nos últimos anos.",
     "linha comum não muda: " + JSON.stringify(L3[0].txt));
  ok(L3.length === 2, "e a quebra de linha continua sendo pelo y");

  /* ── 2. o expoente sobrevive até o papel ── */
  const doc = docFalso();
  const enun = L1[0].txt + "\nQual será o tempo necessário para que o " +
    "número de bactérias seja de 486?";
  const item = {enunciado: enun,
    alternativas:["1 ano.","2 anos.","3 anos.","4 anos.","5 anos."], imagem:null};
  const m = G.medidasQuestao(doc, item, 80, 10, ["A","B","C","D","E"]);
  let sup = 0;
  m.partes.forEach(p => p.linhas.forEach(l => { sup += G.charsDeNivel(l.t).sup; }));
  ok(G.charsDeNivel(enun).sup === 1, "o enunciado tem 1 caractere sobrescrito");
  ok(sup === 1, "e ele sobrevive à quebra de linha");

  doc.ev.length = 0;
  G.desenharQuestaoCol(doc, 10, 0, 15, item, 80, 10, ["A","B","C","D","E"], m);
  const pedacoT = doc.ev.filter(e => e.t === "t" && e.fs < 10);
  ok(pedacoT.length === 1, "o \"t\" é desenhado em corpo menor, como expoente");
  const antesDoT = doc.ev.filter(e => /dada por N\(t\) = 2 · 3$/.test(e.t));
  ok(antesDoT.length === 1, "o trecho que termina no 3 foi desenhado");
  const base = antesDoT[0], elevado = pedacoT[0];
  ok(base && elevado && elevado.y < base.y && base.y - elevado.y < 5,
     "e o \"t\" sai LEVANTADO da linha de base do 3, não numa linha à parte (" +
     (base ? (base.y - elevado.y).toFixed(1) : "-") + " mm acima)");
  ok(base && elevado && elevado.x > base.x,
     "e à direita dele, logo depois do 3");

  /* o pre-flight não acusa perda */
  const cfg = {escola:"E", disciplina:"Matemática", gabaritoCanonico:"C", no:5,
    questoes:[item]};
  const av = G.preFlightCheck(cfg, doc, 10);
  ok(av.length === 0, "e o pre-flight passa sem aviso: " + JSON.stringify(av));

  /* ── 3. a estrofe centralizada ── */
  const versos = ["Tendo por berço o lago cristalino",
                  "Folga o peixe a nadar todo inocente",
                  "Medo ou receio do porvir não sente",
                  "Pois vive incauto do fatal destino"];
  const poema = { enunciado: "Leia o texto abaixo.\nO Peixe\n" + versos.join("\n") +
      "\nDisponível em: revista.agulha.nom.br. Acesso em: 25 nov. 2009. Fragmento.\n" +
      "No verso “Se na ponta de um fio longo e fino”, a expressão destacada refere-se à palavra",
    alternativas:["pescador.","anzol.","isca.","lago.","rede."], imagem:null };
  const LARG = 80;
  const mp = G.medidasQuestao(doc, poema, LARG, 10, ["A","B","C","D","E"]);
  const pv = mp.partes.filter(p => p.tipo === "verso");
  ok(pv.length === versos.length,
     "os quatro versos foram medidos como verso (" + pv.length + ")");
  ok(pv.every(p => typeof p.dxBloco === "number"),
     "cada verso carrega o deslocamento da estrofe");
  ok(pv.every(p => p.dxBloco === pv[0].dxBloco),
     "e o deslocamento é o MESMO para todos — o bloco anda inteiro");
  ok(pv[0].dxBloco > 0, "a estrofe está deslocada do canto (" +
     pv[0].dxBloco.toFixed(1) + " mm)");

  doc.ev.length = 0;
  let y = 0;
  G.unidadesQuestao(doc, 15, poema, LARG, 10, ["A","B","C","D","E"], mp, null)
    .forEach(u => { y = u.desenhar(10, y); });
  const ev = versos.map(v => doc.ev.find(e => e.t === v));
  ok(ev.every(Boolean), "os quatro versos foram desenhados");
  ok(new Set(ev.map(e => e.x)).size === 1,
     "todos começam no MESMO x — alinhados à esquerda entre si, não em losango");
  ok(ev.every(e => !e.opt || e.opt.align !== "center"),
     "nenhum verso é centralizado individualmente");

  /* o bloco está de fato no meio da coluna */
  const larguras = versos.map(v => v.length * 1.8);
  const maior = Math.max.apply(null, larguras);
  const esperado = 10 + (LARG - maior) / 2;
  ok(Math.abs(ev[0].x - esperado) < 0.01,
     "e a estrofe está centralizada pelo verso mais largo (x = " +
     ev[0].x.toFixed(1) + ", esperado " + esperado.toFixed(1) + ")");
  const folgaDir = (10 + LARG) - (ev[0].x + maior);
  ok(Math.abs((ev[0].x - 10) - folgaDir) < 0.01,
     "folga igual dos dois lados (" + (ev[0].x - 10).toFixed(1) + " mm)");

  /* o título do poema continua centralizado, e a prosa não se mexeu */
  const evTitulo = doc.ev.find(e => e.t === "O Peixe");
  ok(evTitulo && evTitulo.opt && evTitulo.opt.align === "center",
     "o título do poema segue centralizado");
  const prosa = { enunciado:"Leia o texto abaixo.\n" +
      "A leitura silenciosa firmou-se tarde na história e mudou o modo como as " +
      "pessoas se relacionam com o texto escrito ao longo dos séculos seguintes.\n" +
      "Qual é o assunto do texto?",
    alternativas:["a","b","c","d","e"], imagem:null };
  const mpr = G.medidasQuestao(doc, prosa, LARG, 10, ["A","B","C","D","E"]);
  ok(mpr.partes.filter(p => p.tipo === "corpo").every(p => !p.dxBloco),
     "a prosa NÃO ganhou deslocamento de bloco");

  console.log(falhas ? "\nteste49: " + falhas + " FALHA(S)" : "\nteste49: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1000);
