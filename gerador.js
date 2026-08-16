/* gerador.js — monta as provas personalizadas em PDF, no próprio navegador
   Desbugando a Matemática

   Espelho de cartao_omr.py. A geometria vem de layout.js e o embaralhamento
   de embaralho.js, exatamente como no pipeline em Python — de modo que um
   cartão gerado aqui e um gerado lá são o mesmo cartão.

   Depende de: layout.js, embaralho.js, fonte.js, jspdf.umd.min.js, qrcode.min.js

   O texto das questões usa a fonte embutida DBMSans (DejaVu reduzida), que
   cobre os símbolos matemáticos — as fontes internas do jsPDF param no
   Latin-1 e engolem ∩, ⊂, √, π, ³. Os rótulos do cartão continuam em
   Helvetica, para ficarem idênticos aos do gerador em Python.
*/
"use strict";

let FONTE_TEXTO = "helvetica";      // vira "DBMSans" quando fonte.js está presente

function prepararFontes(doc){
  if(typeof registrarFontes === "function"){
    try{ registrarFontes(doc); FONTE_TEXTO = "DBMSans"; }
    catch(e){ console.warn("fonte embutida indisponível, usando Helvetica", e);
              FONTE_TEXTO = "helvetica"; }
  } else FONTE_TEXTO = "helvetica";
  return FONTE_TEXTO;
}

const COR = {
  navy:  [14, 33, 69],
  orange:[249, 115, 22],
  grey:  [158, 166, 179],
  zebra: [245, 246, 249],
  preto: [0, 0, 0],
  branco:[255, 255, 255]
};

/* ── nome abreviado para caber no QR (espelho de encurtar_nome) ──── */
const NOME_MAX = 30;
function encurtarNome(nome, limite){
  const lim = limite || NOME_MAX;
  const p = String(nome||"").trim().toUpperCase().split(/\s+/).filter(Boolean);
  if(!p.length) return "";
  let nm = p.join(" "), i = 1;
  while(nm.length > lim && i < p.length - 1){
    p[i] = p[i][0] + "."; nm = p.join(" "); i++;
  }
  return nm.slice(0, lim);
}

/* O nome vai CURTO no QR de propósito. Cada caractere a mais empurra o
   QR para uma versão maior, com mais módulos no mesmo espaço de 30 mm —
   e é o número de PIXELS POR MÓDULO na câmera que decide se o cartão é
   lido ou não. Um caderno de simulado ("3ANOA-SAEPE-26", 16 letras de
   gabarito, nome completo) chegava a 81 bytes e 37 módulos: a 3,9 px/mm
   de enquadramento, 3,2 px por módulo — no limite do decodificador, e
   por isso o QR ficava ilegível justamente nos simulados, enquanto as
   provas comuns (43 bytes, 33 módulos) liam sem esforço.
   Quem identifica o estudante é turma + número; o nome no QR é só
   cortesia, para o app poder cadastrar quem ainda não está na lista. */
/* ═══════════════════════════════════════════════════════════════════
   O PAYLOAD DO QR É ASCII PURO — NÃO MEXA NISTO
   O decodificador de QR do app (jsQR) devolve STRING VAZIA, sem erro
   nenhum, quando o conteúdo tem qualquer byte fora do ASCII. Não é
   "lê errado": é "lê nada". Bastava a turma se chamar "3º Ano A" — ou
   o estudante ser GONÇALO, JOÃO, SÁ — para o cartão ficar impossível de
   corrigir pela câmera. Os marcadores eram encontrados, o QR era
   localizado e decodificado, e o resultado vinha vazio: na tela,
   "Cartão localizado / aproxime um pouco" e depois "QR ilegível".
   Por isso tudo que entra no payload passa por `soAscii`. Acentos viram
   as letras sem acento, "º"/"ª" viram "o"/"a", e o que sobrar de
   estranho é descartado. Nada disso muda a identificação: quem casa o
   cartão com a prova é o código, e o embaralhamento usa o nome REAL da
   turma, que continua guardado no aparelho. */
function soAscii(txt){
  return String(txt == null ? "" : txt)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // tira os acentos
    .replace(/[ºª]/g, m => (m === "º" ? "o" : "a"))
    .replace(/[ﬁﬂ]/g, m => (m === "ﬁ" ? "fi" : "fl"))
    .replace(/[^\x20-\x7E]/g, "")                       // o resto sai
    .replace(/\|/g, " ")                                 // "|" separa campos
    .replace(/\s+/g, " ").trim();
}

const NOME_QR_MAX = 14;
function nomeCurtoQR(nome){
  const p = soAscii(nome).toUpperCase().split(/\s+/).filter(Boolean);
  if(!p.length) return "";
  if(p[0].length >= NOME_QR_MAX) return p[0].slice(0, NOME_QR_MAX);
  return p.length > 1 ? (p[0] + " " + p[p.length-1][0]).slice(0, NOME_QR_MAX) : p[0];
}
function montarPayload(codigo, gabIndividual, turma, numero, nome, no){
  const gab = String(gabIndividual).toUpperCase();
  return ["DBM4", soAscii(codigo), gab, soAscii(turma),
          soAscii(numero), nomeCurtoQR(nome),
          assinaturaLayout(gab.length, no)].join("|");
}

/* Nomes dos blocos do simulado, para o cabeçalho de cada parte. */
const NOME_COMP = {LP: "LÍNGUA PORTUGUESA", MAT: "MATEMÁTICA"};

/* A ordem das questões: sorteio de sempre, agrupado por componente
   quando o caderno tem blocos. Cartão e prova PRECISAM usar esta mesma
   função — se divergirem, a turma inteira sai com nota errada. */
function ordemDaProva(nq, no, turma, numero, comps, alternar){
  return (comps && comps.length === nq)
    ? embaralharEmBlocos(nq, no, turma, numero, comps, alternar)
    : embaralharProva(nq, no, turma, numero);
}

/* ── gabarito individual: espelho de embaralho.py ─────────────────── */
function gabaritoIndividual(gabCanonico, turma, numero, no, comps, alternar){
  const gab = String(gabCanonico).toUpperCase(), nq = gab.length;
  const letras = ["A","B","C","D","E"].slice(0, no);
  const {oq, oa} = ordemDaProva(nq, no, turma, numero, comps, alternar);
  let out = "";
  for(let p = 0; p < nq; p++){
    const certa = letras.indexOf(gab[oq[p]]);
    out += letras[oa[p].indexOf(certa)];
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   CARTÃO-RESPOSTA
   (x, y) = canto superior-esquerdo do fiducial superior-esquerdo,
   em mm a partir do canto superior-esquerdo da página.
   ═══════════════════════════════════════════════════════════════════ */
function desenharCartao(doc, opt){
  const gabC = String(opt.gabaritoCanonico).toUpperCase();
  const nq = gabC.length, no = opt.no || 5;
  const L = montarLayout(nq, no);
  const W = L.box_w, H = L.box_h, fid = L.fid_size, qz = L.quiet_zone, r = L.bubble_r;
  const gab = gabaritoIndividual(gabC, opt.turma, opt.chave || opt.numero, no,
                                 opt.comps, opt.alternar);

  const cx = opt.x + fid/2, cy = opt.y + fid/2;      // centro do fiducial ↖
  const P = (mx, my) => [cx + mx, cy + my];

  // zona de silêncio
  doc.setFillColor(...COR.branco);
  doc.rect(cx - qz, cy - qz, W + 2*qz, H + 2*qz, "F");

  // moldura tracejada
  if(opt.moldura !== false){
    doc.setDrawColor(...COR.grey); doc.setLineWidth(0.5);
    if(doc.setLineDashPattern) doc.setLineDashPattern([3,3], 0);
    doc.rect(cx - (qz-1.5), cy - (qz-1.5), W + 2*(qz-1.5), H + 2*(qz-1.5), "S");
    if(doc.setLineDashPattern) doc.setLineDashPattern([], 0);
  }

  // fiduciais
  doc.setFillColor(...COR.preto);
  [[0,0],[W,0],[W,H],[0,H]].forEach(([mx,my])=>{
    const [px,py] = P(mx,my);
    doc.rect(px - fid/2, py - fid/2, fid, fid, "F");
  });

  // QR
  const payload = montarPayload(opt.codigo, gab, opt.turma, opt.numero, opt.nome, no);
  /* Correção de erro "L": o cartão é lido de perto, em papel, e não
     precisa dos 15% de redundância do nível "M" — que aqui só encolhia
     os módulos. */
  const q = qrcode(0, "L"); q.addData(payload); q.make();
  const n = q.getModuleCount(), passo = L.qr.size / n;
  const [qx, qy] = P(L.qr.x, L.qr.y);
  doc.setFillColor(...COR.preto);
  for(let i = 0; i < n; i++) for(let j = 0; j < n; j++)
    if(q.isDark(i, j)) doc.rect(qx + j*passo, qy + i*passo, passo*1.02, passo*1.02, "F");

  // rótulos
  doc.setTextColor(...COR.navy); doc.setFont("helvetica","bold");
  doc.setFontSize(L.compacto ? 5.5 : 7);
  let [tx,ty] = P(L.qr.x + 1, L.compacto ? 4.5 : 7.5); doc.text("CARTÃO-RESPOSTA", tx, ty);
  doc.setTextColor(...COR.orange); doc.setFontSize(L.compacto ? 5.5 : 6.5);
  [tx,ty] = P(L.qr.x + 1, L.qr.y + L.qr.size + (L.compacto ? 4.5 : 5.5));
  doc.text(((opt.turma||"") + "  " + (opt.numero||"")).trim() ||
           String(opt.codigo).toUpperCase().slice(0,16), tx, ty);
  doc.setTextColor(...COR.grey); doc.setFont("helvetica","normal");
  doc.setFontSize(L.compacto ? 4.8 : 5.5);
  [tx,ty] = P(L.qr.x + 1, L.qr.y + L.qr.size + (L.compacto ? 8.5 : 10.5));
  doc.text(nq + " questões · A a " + L.options[no-1], tx, ty);

  // grade de bolhas
  const fsNum = L.compacto ? 6 : 8, fsLetra = L.compacto ? 5 : 6;
  const recuo = L.compacto ? 3.6 : 6;
  const larguraFaixa = L.label_gap + L.bubble_dx * (no - 1) + 2*r + recuo + 1;
  L.groups.forEach(g => {
    doc.setTextColor(...COR.grey); doc.setFont("helvetica","bold"); doc.setFontSize(fsLetra);
    L.options.forEach((letra, k) => {
      const [px,py] = P(g.first_bubble_x + k*L.bubble_dx, L.row_y[0] - r - 2.2);
      doc.text(letra, px, py, {align:"center"});
    });
    g.questions.forEach((qn, i) => {
      const yy = L.row_y[i];
      if(i % 2 === 1){
        doc.setFillColor(...COR.zebra);
        const [fx,fy] = P(g.label_x - recuo, yy - r - 1.3);
        doc.rect(fx, fy, larguraFaixa, 2*r + 2.6, "F");
      }
      doc.setTextColor(...COR.navy); doc.setFont("helvetica","bold"); doc.setFontSize(fsNum);
      const [nx,ny] = P(g.label_x, yy + r*0.55);
      doc.text(String(qn).padStart(2,"0"), nx, ny, {align:"center"});

      doc.setDrawColor(...COR.navy); doc.setLineWidth(0.7); doc.setFillColor(...COR.branco);
      for(let k = 0; k < no; k++){
        const [bx,by] = P(g.first_bubble_x + k*L.bubble_dx, yy);
        doc.circle(bx, by, r, "FD");
      }
    });
  });
  return {altura: H + 2*qz, largura: W + 2*qz, gabarito: gab, payload};
}

/* ═══════════════════════════════════════════════════════════════════
   PROVA COMPLETA — uma por aluno, questões e alternativas embaralhadas
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   DIAGRAMAÇÃO DA PROVA
   Segue o modelo em uso: faixa da escola, identificação do estudante,
   cartão-resposta no alto, questões em duas colunas e rascunho no fim.
   O corpo do texto encolhe automaticamente até caber em 2 páginas.
   ═══════════════════════════════════════════════════════════════════ */
const MARG = 12, GUT = 7, TOPO = 12, MARGEM_INF = 10;
const MARGEM_CARTAO = 6;
const CORPOS = [10.5, 10];   // legibilidade tem piso: nunca menor que 10 pt
const CORPOS_APERTO = [9.5, 9];  // só entram se 10 pt estourar o limite de folhas
const MAX_PAGINAS = 4;           // uma prova não passa de quatro páginas por aluno

/* Escada do simulado SAEPE: desce de meio em meio ponto até 9, que é o
   piso de legibilidade. A prova comum NÃO usa esta escada — lá o corpo
   continua em 10,5 com piso de 10. */
const CORPOS_SAEPE = [10.5, 10.2, 10, 9.8, 9.5, 9.2, 9];
const ALT_CABECALHO = 8.5;       // faixa que abre cada bloco do simulado

const larguraColuna = doc =>
  (doc.internal.pageSize.getWidth() - 2 * MARG - GUT) / 2;
const xColuna = (doc, c) => MARG + c * (larguraColuna(doc) + GUT);

/* ── cabeçalho ──────────────────────────────────────────────────── */
function cabecalho(doc, cfg, aluno, dry){
  const W = doc.internal.pageSize.getWidth(), util = W - 2 * MARG;
  const alturaFaixa = 13;
  if(!dry){
    doc.setFillColor(...COR.navy);
    doc.rect(0, 0, W, alturaFaixa, "F");
    doc.setTextColor(...COR.branco); doc.setFont(FONTE_TEXTO, "bold"); doc.setFontSize(9);
    doc.text(String(cfg.escola || "").toUpperCase(), MARG, 6);
    doc.setTextColor(...COR.orange); doc.setFontSize(7);
    doc.text([cfg.titulo || "AVALIAÇÃO DE APRENDIZAGEM", cfg.periodoLabel]
               .filter(Boolean).join("  •  ").toUpperCase(), MARG, 10.5);
    /* com tipos de prova, o professor precisa ver de longe qual é qual */
    const tp = tipoDoAluno(aluno && aluno.numero, cfg.tipos);
    if(tp){
      doc.setFillColor(...COR.orange);
      doc.rect(W - MARG - 18, 2.5, 18, 7.5, "F");
      doc.setTextColor(...COR.branco); doc.setFont(FONTE_TEXTO, "bold"); doc.setFontSize(8);
      doc.text("TIPO " + tp, W - MARG - 9, 7.6, {align: "center"});
    }
  }
  let y = alturaFaixa + 5;

  // faixa de identificação: ALUNO(A) | TURMA | Nº
  const hLinha = 11, colTurma = util - 40, colNum = util - 16;
  if(!dry){
    doc.setDrawColor(...COR.grey); doc.setLineWidth(0.3);
    doc.rect(MARG, y, util, hLinha, "S");
    doc.line(MARG + colTurma, y, MARG + colTurma, y + hLinha);
    doc.line(MARG + colNum, y, MARG + colNum, y + hLinha);
    doc.setTextColor(...COR.grey); doc.setFont(FONTE_TEXTO, "bold"); doc.setFontSize(5.5);
    doc.text("ALUNO(A)", MARG + 2, y + 3.4);
    doc.text("TURMA", MARG + colTurma + 2, y + 3.4);
    doc.text("Nº", MARG + colNum + 2, y + 3.4);
    doc.setTextColor(...COR.navy); doc.setFont(FONTE_TEXTO, "bold"); doc.setFontSize(9);
    doc.text(String(aluno.nome || "").toUpperCase(), MARG + 2, y + 8.6);
    doc.text(String(cfg.turma || ""), MARG + colTurma + 2, y + 8.6);
    doc.text(String(aluno.numero || ""), MARG + colNum + 2, y + 8.6);
  }
  y += hLinha + 4;

  if(!dry){
    doc.setTextColor(80, 88, 100); doc.setFont(FONTE_TEXTO, "normal"); doc.setFontSize(7);
    const linha = "DISCIPLINA: " + (cfg.disciplina || "") +
      "        PROFESSOR: " + (cfg.professor || "") +
      "        DATA: ____ / ____ / ______";
    doc.text(linha, MARG, y);
  }
  return y + 4;
}

/* figura: nunca mais larga que a coluna nem mais alta que meia página */
const FIG_MAX_H = 52;
function medirFigura(img, larguraDisponivel){
  if(!img || !img.dados) return null;
  const pw = img.w || 400, ph = img.h || 300;
  const teto = larguraDisponivel || 78;
  let w = Math.min(teto, pw * 0.2646);          // px -> mm a ~96 dpi
  let h = w * ph / pw;
  if(h > FIG_MAX_H){ h = FIG_MAX_H; w = h * pw / ph; }
  return {w, h};
}

/* ── medidas de uma questão dentro da coluna ────────────────────── */
/* No simulado o espaço é apertado ANTES de a letra encolher e muito
   antes de sair questão: entrelinha um pouco menor e menos ar entre o
   rótulo, o enunciado e as alternativas. A prova comum não muda. */
let DENSO = false;
const ENTRELINHA = () => DENSO ? 0.395 : 0.42;
const AR_ROTULO  = () => DENSO ? 4.6 : 5.2;
const AR_ENUN    = () => DENSO ? 0.9 : 1.4;
const AR_ALT     = () => DENSO ? 0.5 : 0.9;
const AR_QUESTAO = () => DENSO ? 2.2 : 3.4;

/* ── anatomia do enunciado ─────────────────────────────────────────
   Uma questão de avaliação externa tem partes com pesos diferentes:
   a instrução ("Leia o texto abaixo."), o título do texto, o texto de
   apoio, a REFERÊNCIA bibliográfica e o COMANDO. Impressas todas iguais,
   viram um bloco em que o endereço do site parece parte do texto e o
   comando desaparece. Aqui elas são separadas e recebem tipos próprios. */
const RE_INSTRUCAO = /^leia(\s+(o|os)\s+(texto|textos|trecho|fragmento)s?)?(\s+abaixo)?\s*[.:]?$/i;
const RE_COMANDO = /^(qual|quais|que\s|quantos|quantas|de acordo|segundo|nesse|neste|no trecho|na frase|em qual|assinale|o assunto|a ideia|a tese|a expressão|a repetição|a palavra|o autor|o texto|o efeito|o uso|considerando)/i;
/* fim de referência: são fórmulas fixas da bibliografia */
const FIM_FONTE = [
  /Mantida a ortografia original do texto\.\s*/g,
  /Fragmento\.\s*/g,
  /Acesso em:[^.]*\.\s*/g,
  /\bp\.\s*\d+\.\s*/g
];

/* posição depois do último ponto final seguido de maiúscula — sem
   lookbehind, que não existe em Safari antigo */
function ultimoCorteDeFrase(txt){
  const re = /[.!?]["”’)]?\s+/g;
  let m, corte = -1;
  while((m = re.exec(txt)) !== null){
    const fim = m.index + m[0].length;
    if(/[A-ZÀ-Ý“"(]/.test(txt.charAt(fim))) corte = fim;
  }
  return corte;
}

/* parece uma referência bibliográfica inteira? */
function pareceReferencia(txt){
  return /(19|20)\d{2}|Dispon[ií]vel em|Acesso em|p\.\s*\d+|\bIn:/.test(txt)
      || /^[A-ZÀ-Ý]{2,}[,.]/.test(txt);
}
/* onde a referência começa dentro de um parágrafo que também traz texto */
function inicioDaReferencia(txt){
  const forte = /^(Dispon[ií]vel em|[A-ZÀ-Ý]{2,}[,.]\s|In:)/;
  const re = /[.!?]["”’)]?\s+/g;
  let m;
  while((m = re.exec(txt)) !== null){
    const p = m.index + m[0].length;
    if(forte.test(txt.slice(p))) return p;
  }
  return -1;
}

function segmentarEnunciado(texto){
  const paras = String(texto == null ? "" : texto).split("\n")
    .map(t => t.trim()).filter(Boolean);
  if(!paras.length) return {corpo: []};
  const seg = {instrucao: null, titulo: null, corpo: [], fonte: null, comando: null};

  if(RE_INSTRUCAO.test(paras[0])) seg.instrucao = paras.shift();
  /* título: linha curta, sem ponto final, logo depois da instrução */
  if(paras.length > 1 && paras[0].length <= 70 && !/[.?!:;]$/.test(paras[0]))
    seg.titulo = paras.shift();

  /* referência: procura de trás para frente o fim de uma fórmula
     bibliográfica; o que vier depois dela é o comando */
  for(let i = paras.length - 1; i >= 0 && !seg.fonte; i--){
    let fim = -1;
    FIM_FONTE.forEach(re => {
      re.lastIndex = 0; let m;
      while((m = re.exec(paras[i])) !== null) fim = Math.max(fim, m.index + m[0].length);
    });
    if(fim < 0) continue;
    const antes = paras[i].slice(0, fim).trim();
    const depois = paras[i].slice(fim).trim();
    let fonte = antes, sobra = "";
    if(!pareceReferencia(antes)){
      /* a referência veio colada ao fim do texto de apoio: acha onde ela
         começa, senão o texto inteiro sairia impresso como se fosse a
         fonte, em letra miúda e alinhado à direita */
      const ini = inicioDaReferencia(antes);
      if(ini <= 0) continue;
      fonte = antes.slice(ini).trim();
      sobra = antes.slice(0, ini).trim();
      if(!pareceReferencia(fonte)) continue;
    }
    seg.fonte = fonte;
    const resto = (depois ? [depois] : []).concat(paras.slice(i + 1));
    seg.comando = resto.length ? resto.join(" ") : null;
    paras.length = i;                       // o corpo é tudo o que veio antes
    if(sobra) paras.push(sobra);
  }

  /* sem referência: o comando é o último parágrafo, se parecer um */
  if(!seg.comando && paras.length > 1){
    const ultimo = paras[paras.length - 1];
    if(/\?$/.test(ultimo) || RE_COMANDO.test(ultimo) || !/[.!]$/.test(ultimo))
      seg.comando = paras.pop();
  }
  /* Último recurso: o comando pode ter ficado colado ao fim do parágrafo,
     quando a linha do texto de apoio terminou quase na margem e não deu
     para saber se a quebra foi do autor. Aí separa pela última frase. */
  if(!seg.comando && paras.length){
    const ultimo = paras[paras.length - 1];
    const corte = ultimoCorteDeFrase(ultimo);
    if(corte > 0){
      const cauda = ultimo.slice(corte).trim();
      if(cauda.length >= 15 && (/\?$/.test(cauda) || RE_COMANDO.test(cauda))){
        paras[paras.length - 1] = ultimo.slice(0, corte).trim();
        seg.comando = cauda;
      }
    }
  }
  /* Os parágrafos do texto de apoio são preservados SEMPRE. Juntá-los
     num bloco só economizava quase quatro linhas por questão, e chegou a
     render duas questões a mais — mas o estudante perdia de vista onde
     cada parágrafo começa, e um texto de interpretação sem parágrafo
     visível é um texto pior de ler. Espaço se procura na letra e, em
     último caso, na quantidade de questões. */
  seg.corpo = paras;
  return seg;
}

/* Quebra o parágrafo dando entrada na primeira linha. Não dá para só
   deslocar a primeira linha depois de quebrada: ela foi calculada para a
   largura cheia e passaria da margem. */
function quebrarComRecuo(doc, txt, larg, recuo){
  const texto = String(txt || "").trim();
  if(!texto) return [];
  if(!recuo) return doc.splitTextToSize(texto, larg).map(t => ({t, dx: 0}));
  const comRecuo = doc.splitTextToSize(texto, larg - recuo);
  const primeira = comRecuo[0] || texto;
  const resto = texto.slice(primeira.length).replace(/^\s+/, "");
  const demais = resto ? doc.splitTextToSize(resto, larg) : [];
  return [{t: primeira, dx: recuo}].concat(demais.map(t => ({t, dx: 0})));
}

/* ── expoentes e índices no papel ───────────────────────────────────
   O texto guarda marcas invisíveis em volta do que é sobrescrito
   (\u0002…\u0003) ou subscrito (\u0004…\u0005). Elas nascem na leitura
   do PDF de origem, onde "2^{0,5x}" vem em dois pedaços de tamanhos
   diferentes. Aqui viram tipografia de verdade: corpo menor, levantado
   ou baixado em relação à linha de base.

   A quebra de linha mede o texto SEM as marcas (a diferença de largura
   é pequena e a favor da segurança, porque o sobrescrito é mais estreito
   que o corpo normal). Linha que traz expoente não é justificada — o
   justificado do jsPDF distribui espaços na string inteira e não sabe
   destes pedaços. */
const M_SUP_INI="\u0002", M_SUP_FIM="\u0003";
const M_SUB_INI="\u0004", M_SUB_FIM="\u0005";
const semMarcas = t => String(t == null ? "" : t).replace(/[\u0002-\u0005]/g, "");
const temMarcas = t => /[\u0002-\u0005]/.test(String(t == null ? "" : t));

/* Depois de quebrar o texto limpo em linhas, devolve as marcas para os
   lugares certos, andando pelas duas versões em paralelo. É assim que a
   medida da linha ignora as marcas e o desenho continua sabendo onde
   estão os expoentes. */
function remarcar(linhas, marcado){
  if(!temMarcas(marcado)) return linhas;
  const src = String(marcado);
  let i = 0;
  return linhas.map(l => {
    let out = "", j = 0;
    while(j < l.length && i < src.length){
      const c = src[i];
      if(c >= "\u0002" && c <= "\u0005"){ out += c; i++; continue; }
      if(c === l[j]){ out += c; i++; j++; continue; }
      i++;                       // espaço engolido na quebra de linha
    }
    /* só as marcas de FECHAMENTO ficam no fim da linha; uma marca de
       abertura pertence ao pedaço que vem na linha seguinte */
    while(i < src.length && (src[i] === "\u0003" || src[i] === "\u0005")){ out += src[i]; i++; }
    return out;
  });
}

/* quebra a linha em pedaços {t, nivel} — nivel 0 normal, 1 sobrescrito,
   -1 subscrito */
function pedacosDeNivel(txt){
  const out = [];
  let atual = {t: "", nivel: 0};
  for(const ch of String(txt == null ? "" : txt)){
    if(ch === M_SUP_INI || ch === M_SUB_INI){
      if(atual.t) out.push(atual);
      atual = {t: "", nivel: ch === M_SUP_INI ? 1 : -1};
    }else if(ch === M_SUP_FIM || ch === M_SUB_FIM){
      if(atual.t) out.push(atual);
      atual = {t: "", nivel: 0};
    }else atual.t += ch;
  }
  if(atual.t) out.push(atual);
  return out;
}

/* desenha uma linha que pode ter expoente; devolve a largura usada */
function textoComNiveis(doc, txt, x, y, fs){
  let dx = 0;
  pedacosDeNivel(txt).forEach(p => {
    if(p.nivel === 0){
      doc.setFontSize(fs);
      doc.text(p.t, x + dx, y);
      dx += doc.getTextWidth(p.t);
    }else{
      const menor = fs * 0.68;
      doc.setFontSize(menor);
      const sobe = p.nivel > 0 ? fs * 0.32 : -fs * 0.12;
      doc.text(p.t, x + dx, y - sobe);
      dx += doc.getTextWidth(p.t);
      doc.setFontSize(fs);
    }
  });
  return dx;
}

function medidasQuestao(doc, item, larg, fs, opcoes){
  doc.setFont(FONTE_TEXTO, "normal"); doc.setFontSize(fs);
  const passo = fs * ENTRELINHA();
  const seg = segmentarEnunciado(item.enunciado);
  const partes = [];
  const medir = (txt, tipo, tamanho, estilo, recuo) => {
    doc.setFont(FONTE_TEXTO, estilo); doc.setFontSize(tamanho);
    const bruto = String(txt);
    const linhas = quebrarComRecuo(doc, semMarcas(bruto), larg, recuo || 0);
    const remarcadas = remarcar(linhas.map(o => o.t), bruto);
    linhas.forEach((o, k) => { o.t = remarcadas[k]; });
    partes.push({tipo, linhas, fs: tamanho, estilo,
                 passo: tamanho * ENTRELINHA()});
  };
  const RECUO = DENSO ? 4.4 : 5.2;      // entrada de parágrafo, bem visível
  if(seg.instrucao) medir(seg.instrucao, "instrucao", fs - 1.4, "normal");
  if(seg.titulo)    medir(seg.titulo,    "titulo",    fs,       "bold");
  (seg.corpo || []).forEach(p => medir(p, "corpo", fs, "normal", RECUO));
  if(seg.fonte)     medir(seg.fonte,     "fonte",     fs - 2.2, "normal");
  if(seg.comando)   medir(seg.comando,   "comando",   fs,       "bold");

  let h = AR_ROTULO();
  partes.forEach((pt, i) => {
    h += pt.linhas.length * pt.passo + espacoDepois(pt.tipo, partes[i + 1]);
  });
  h += AR_ENUN();
  const fig = medirFigura(item.imagem, larg);
  if(fig) h += fig.h + 2.5;
  doc.setFont(FONTE_TEXTO, "normal"); doc.setFontSize(fs);
  const alts = (item.alternativas || []).map(a => {
    const bruto = String(a == null ? "" : a);
    return remarcar(doc.splitTextToSize(semMarcas(bruto), larg - 7), bruto);
  });
  alts.forEach(la => { h += la.length * passo + AR_ALT(); });
  return {h, partes, alts, fig, passo};
}

/* o ar entre as partes: pouco dentro do texto, mais antes do comando */
function espacoDepois(tipo, proxima){
  const alvo = proxima ? proxima.tipo : null;
  if(tipo === "instrucao") return DENSO ? 0.6 : 0.9;
  if(tipo === "titulo")    return DENSO ? 0.8 : 1.2;
  if(tipo === "fonte")     return DENSO ? 1.4 : 2.0;
  if(alvo === "fonte")     return DENSO ? 0.9 : 1.3;
  if(alvo === "comando")   return DENSO ? 1.6 : 2.2;
  if(tipo === "corpo")     return DENSO ? 0.7 : 1.0;
  return DENSO ? 0.5 : 0.8;
}

function desenharQuestaoCol(doc, x, y, n, item, larg, fs, opcoes, m){
  doc.setTextColor(...COR.navy); doc.setFont(FONTE_TEXTO, "bold"); doc.setFontSize(fs - 1.5);
  doc.text("QUESTÃO " + String(n).padStart(2, "0"), x, y + 2.4);
  doc.setDrawColor(...COR.orange); doc.setLineWidth(0.6);
  doc.line(x, y + 3.6, x + 15, y + 3.6);
  y += AR_ROTULO();

  m.partes.forEach((pt, i) => {
    doc.setFont(FONTE_TEXTO, pt.estilo); doc.setFontSize(pt.fs);
    if(pt.tipo === "instrucao" || pt.tipo === "fonte") doc.setTextColor(...COR.grey);
    else if(pt.tipo === "titulo") doc.setTextColor(...COR.navy);
    else doc.setTextColor(25, 28, 34);
    /* justificado no texto corrido, como na prova oficial; a última
       linha do parágrafo fica solta, senão as palavras se esparramam */
    const justifica = (pt.tipo === "corpo" || pt.tipo === "comando");
    pt.linhas.forEach((ln, k) => {
      const yy = y + pt.passo * (0.75 + k);
      if(temMarcas(ln.t)){
        /* linha com expoente: desenhada pedaço a pedaço, sem justificar */
        textoComNiveis(doc, ln.t, x + ln.dx, yy, pt.fs);
      }else if(pt.tipo === "fonte"){
        doc.text(ln.t, x + larg, yy, {align: "right"});
      }else if(pt.tipo === "titulo"){
        doc.text(ln.t, x + larg / 2, yy, {align: "center"});
      }else if(justifica && k < pt.linhas.length - 1){
        doc.text(ln.t, x + ln.dx, yy, {align: "justify", maxWidth: larg - ln.dx});
      }else{
        doc.text(ln.t, x + ln.dx, yy);
      }
    });
    y += pt.linhas.length * pt.passo + espacoDepois(pt.tipo, m.partes[i + 1]);
  });
  y += AR_ENUN();

  if(m.fig){
    try{ doc.addImage(item.imagem.dados, "JPEG", x, y, m.fig.w, m.fig.h); }catch(e){}
    y += m.fig.h + 2.5;
  }
  m.alts.forEach((la, k) => {
    doc.setFont(FONTE_TEXTO, "bold"); doc.setTextColor(...COR.orange); doc.setFontSize(fs);
    doc.text(opcoes[k] + ")", x + 1, y + m.passo * 0.75);
    doc.setFont(FONTE_TEXTO, "normal"); doc.setTextColor(25, 28, 34);
    la.forEach((ln, i2) => {
      const yy = y + m.passo * (0.75 + i2);
      if(temMarcas(ln)) textoComNiveis(doc, ln, x + 7, yy, fs);
      else doc.text(ln, x + 7, yy);
    });
    y += la.length * m.passo + AR_ALT();
  });
  return y + AR_QUESTAO();
}

/* folha inteira de rascunho, para igualar a tiragem do simulado */
function paginaDeRascunho(doc){
  const H = doc.internal.pageSize.getHeight();
  desenharRascunho(doc, TOPO, H - TOPO - MARGEM_INF);
}

/* ── rascunho ───────────────────────────────────────────────────── */
function desenharRascunho(doc, y, altura){
  const W = doc.internal.pageSize.getWidth(), util = W - 2 * MARG;
  doc.setDrawColor(...COR.grey); doc.setLineWidth(0.3);
  if(doc.setLineDashPattern) doc.setLineDashPattern([2, 2], 0);
  doc.rect(MARG, y, util, altura, "S");
  if(doc.setLineDashPattern) doc.setLineDashPattern([], 0);
  doc.setTextColor(...COR.grey); doc.setFont(FONTE_TEXTO, "normal"); doc.setFontSize(6.5);
  doc.text("RASCUNHO — esta área não será corrigida", MARG + 3, y + 4.5);
}

/* ── fluxo: monta blocos e os distribui equilibrando as colunas ──── */
function blocosDaProva(doc, cfg, aluno, fs){
  const larg = larguraColuna(doc);
  const gabC = String(cfg.gabaritoCanonico).toUpperCase();
  const nq = gabC.length, no = cfg.no || 5;
  const opcoes = ["A", "B", "C", "D", "E"].slice(0, no);
  const comps = (cfg.comps && cfg.comps.length === nq) ? cfg.comps : null;
  const chave = chaveDeOrdem(aluno.numero, cfg.tipos);
  const {oq, oa} = ordemDaProva(nq, no, cfg.turma, chave, comps, cfg.alternarBlocos);
  const blocos = [];
  const ALT_CAB = ALT_CABECALHO;

  /* faixa que abre cada parte do caderno (LÍNGUA PORTUGUESA, MATEMÁTICA).
     Vai grudada na primeira questão do bloco para nunca ficar órfã no pé
     de uma coluna. */
  const cabecalhoBloco = (x, y, texto) => {
    doc.setFillColor(...COR.navy);
    doc.rect(x, y, larg, 5.5, "F");
    doc.setTextColor(...COR.branco); doc.setFont(FONTE_TEXTO, "bold"); doc.setFontSize(6.5);
    doc.text(String(texto).toUpperCase(), x + 2, y + 3.9);
    return y + ALT_CAB;
  };

  for(let p = 0; p < nq; p++){
    const base = (cfg.questoes || [])[oq[p]] ||
      {enunciado: "(questão " + (oq[p] + 1) + ")", alternativas: []};
    const item = {enunciado: base.enunciado, imagem: base.imagem,
      alternativas: oa[p].map(ci => (base.alternativas || [])[ci])};
    const m = medidasQuestao(doc, item, larg, fs, opcoes);
    const compAtual = comps ? comps[oq[p]] : null;
    const abre = !!compAtual && (p === 0 || comps[oq[p - 1]] !== compAtual);
    const rotulo = abre
      ? ((cfg.rotulosComp || {})[compAtual] || NOME_COMP[compAtual] || compAtual)
      : null;
    blocos.push({h: m.h + AR_QUESTAO() + (abre ? ALT_CAB : 0), juntoComProximo: false,
      desenhar: (x, y) => {
        const yy = rotulo ? cabecalhoBloco(x, y, rotulo) : y;
        return desenharQuestaoCol(doc, x, yy, p + 1, item, larg, fs, opcoes, m);
      }});
  }

  const disc = cfg.discursivas || [];
  if(disc.length){
    blocos.push({h: 8, juntoComProximo: true, desenhar: (x, y) => {
      doc.setFillColor(...COR.navy);
      doc.rect(x, y, larg, 5.5, "F");
      doc.setTextColor(...COR.branco); doc.setFont(FONTE_TEXTO, "bold"); doc.setFontSize(6.5);
      doc.text("PARTE II — DISCURSIVAS", x + 2, y + 3.9);
      return y + 8;
    }});
    disc.forEach((q, i) => {
      doc.setFont(FONTE_TEXTO, "normal"); doc.setFontSize(fs);
      const passo = fs * 0.42;
      const linhas = doc.splitTextToSize(String(q.enunciado || ""), larg);
      const espaco = Math.max(14, (q.linhas || 4) * 5.5);
      const h = 5 + linhas.length * passo + espaco + 4;
      blocos.push({h, juntoComProximo: false, desenhar: (x, y) => {
        doc.setTextColor(...COR.navy); doc.setFont(FONTE_TEXTO, "bold"); doc.setFontSize(fs - 1.5);
        doc.text((i + 1) + ".  (" + (q.pontos != null ? q.pontos : "") + " pt)", x, y + 2.4);
        doc.setFont(FONTE_TEXTO, "normal"); doc.setFontSize(fs); doc.setTextColor(25, 28, 34);
        doc.text(linhas, x, y + 5 + passo * 0.75);
        let yy = y + 5 + linhas.length * passo + 2;
        doc.setDrawColor(210, 214, 220); doc.setLineWidth(0.25);
        for(let l = 0; l < Math.round(espaco / 5.5); l++)
          doc.line(x, yy + l * 5.5, x + larg, yy + l * 5.5);
        return y + h;
      }});
    });
  }
  return blocos;
}

/* Onde cortar uma página em duas colunas: o corte que deixa as colunas
   mais parecidas, sem estourar nenhuma. -1 se não couber. */
function melhorCorte(alturas, capacidade){
  const total = alturas.reduce((a, b) => a + b, 0);
  let melhor = -1, dif = Infinity;
  let esq = 0;
  for(let k = 1; k <= alturas.length; k++){
    esq += alturas[k - 1];
    const dir = total - esq;
    if(esq <= capacidade && dir <= capacidade){
      const d = Math.abs(esq - dir);
      if(d < dif){ dif = d; melhor = k; }
    }
  }
  return melhor;
}

/* ── contagem de páginas para TODOS os alunos ──────────────────────
   A altura de cada questão não depende da ordem — o embaralhamento só
   muda o encaixe nas colunas. Então mede-se cada questão UMA vez por
   corpo e simula-se o empacotamento de cada aluno em cima dos números.
   Sem isso a fonte era escolhida olhando só o primeiro aluno, e um
   colega com outra ordem recebia uma prova de cinco páginas. */
function alturasCanonicas(doc, cfg, fs){
  const larg = larguraColuna(doc);
  const nq = String(cfg.gabaritoCanonico).length, no = cfg.no || 5;
  const opcoes = ["A", "B", "C", "D", "E"].slice(0, no);
  return Array.from({length: nq}, (_, idx) => {
    const base = (cfg.questoes || [])[idx] ||
      {enunciado: "(questão " + (idx + 1) + ")", alternativas: []};
    /* a permutação das alternativas não muda a soma das alturas */
    const m = medidasQuestao(doc, {enunciado: base.enunciado, imagem: base.imagem,
      alternativas: base.alternativas || []}, larg, fs, opcoes);
    return m.h + AR_QUESTAO();
  });
}

function empacotar(alturas, topoPrimeira, fundo){
  let paginas = 1, i = 0, topo = topoPrimeira;
  while(i < alturas.length){
    const cap = fundo - topo;
    let leva = 0;
    for(let n = 1; i + n <= alturas.length; n++){
      if(melhorCorte(alturas.slice(i, i + n), cap) < 0) break;
      leva = n;
    }
    if(leva === 0) leva = 1;              // bloco maior que a coluna: transborda
    i += leva;
    if(i < alturas.length){ paginas++; topo = TOPO; }
  }
  return paginas;
}

/* as ordens distintas que serão impressas: com tipos de prova são só N */
function chavesDaTurma(cfg, alunos){
  if(cfg.tipos > 0)
    return Array.from({length: cfg.tipos}, (_, k) => "TIPO" + (k + 1));
  return (alunos || []).map(a => chaveDeOrdem(a.numero, 0));
}

function paginasNoPior(doc, cfg, alunos, fs, topoPrimeira, fundo){
  const h = alturasCanonicas(doc, cfg, fs);
  const nq = h.length, no = cfg.no || 5;
  const comps = (cfg.comps && cfg.comps.length === nq) ? cfg.comps : null;
  let pior = 1;
  chavesDaTurma(cfg, alunos).forEach(chave => {
    const {oq} = ordemDaProva(nq, no, cfg.turma, chave, comps, cfg.alternarBlocos);
    const alturas = oq.map((idx, p) => {
      const abre = comps && (p === 0 || comps[oq[p - 1]] !== comps[idx]);
      return h[idx] + (abre ? ALT_CABECALHO : 0);
    });
    pior = Math.max(pior, empacotar(alturas, topoPrimeira, fundo));
  });
  return pior;
}

function fluir(doc, cfg, aluno, fs, dry){
  const alturaPag = doc.internal.pageSize.getHeight();
  const fundo = alturaPag - MARGEM_INF;
  const gabC = String(cfg.gabaritoCanonico).toUpperCase();
  const nq = gabC.length, no = cfg.no || 5;

  let paginas = 1;
  let y = cabecalho(doc, cfg, aluno, dry);

  const L = montarLayout(nq, no);
  const altCartao = L.box_h + 2 * L.quiet_zone;
  if(!dry){
    desenharCartao(doc, {x: MARG + 2, y: y + L.quiet_zone,
      codigo: cfg.codigo, gabaritoCanonico: gabC, no,
      comps: (cfg.comps && cfg.comps.length === nq) ? cfg.comps : null,
      alternar: cfg.alternarBlocos, chave: chaveDeOrdem(aluno.numero, cfg.tipos),
      turma: cfg.turma, numero: aluno.numero, nome: aluno.nome});
  }
  const topoPrimeira = y + altCartao + 8;   // folga para não colidir com a moldura

  const blocos = blocosDaProva(doc, cfg, aluno, fs);
  const alturas = blocos.map(b => b.h);

  let i = 0, topo = topoPrimeira, ultimoUso = topo;
  while(i < blocos.length){
    const cap = fundo - topo;
    // maior conjunto de blocos que cabe nesta página, já equilibrado
    let leva = 0, corte = 1;
    for(let n = 1; i + n <= blocos.length; n++){
      const k = melhorCorte(alturas.slice(i, i + n), cap);
      if(k < 0) break;
      leva = n; corte = k;
    }
    if(leva === 0){ leva = 1; corte = 1; }   // bloco maior que a coluna: transborda

    if(!dry){
      let ye = topo, yd = topo;
      for(let n = 0; n < leva; n++){
        const b = blocos[i + n];
        if(n < corte){ ye = b.desenhar(xColuna(doc, 0), ye); }
        else { yd = b.desenhar(xColuna(doc, 1), yd); }
      }
      ultimoUso = Math.max(ye, yd);
    } else {
      const somaE = alturas.slice(i, i + corte).reduce((a, b) => a + b, 0);
      const somaD = alturas.slice(i + corte, i + leva).reduce((a, b) => a + b, 0);
      ultimoUso = topo + Math.max(somaE, somaD);
    }
    i += leva;
    if(i < blocos.length){
      // sobrou espaço embaixo desta página? vira rascunho, não vazio
      const folga = fundo - ultimoUso;
      if(!dry && !cfg.simulado && folga >= 30) desenharRascunho(doc, ultimoUso + 3, folga - 3);
      paginas++;
      if(!dry) doc.addPage();
      topo = TOPO;
    }
  }

  // o rascunho é um bônus: só entra no espaço que sobrou, nunca
  // pede uma página nova — papel a mais não vale por área de rabisco
  const sobra = fundo - ultimoUso;
  if(!dry && !cfg.simulado && sobra >= 26) desenharRascunho(doc, ultimoUso + 3, sobra - 3);
  return paginas;
}

/**
 * cfg = {codigo, titulo, escola, turma, disciplina, professor, periodoLabel,
 *        gabaritoCanonico, no, questoes:[...], discursivas:[...]}
 */
function gerarProvas(cfg, alunos, jsPDFctor){
  const Ctor = jsPDFctor || (window.jspdf && window.jspdf.jsPDF);
  const doc = new Ctor({unit: "mm", format: "a4", compress: true});
  prepararFontes(doc);
  DENSO = !!cfg.simulado;      // aperta o espaço só no simulado

  if(typeof caracteresFaltando === "function"){
    const textos = [cfg.titulo, cfg.escola, cfg.disciplina, cfg.professor];
    (cfg.questoes || []).forEach(q => { textos.push(q.enunciado);
      (q.alternativas || []).forEach(a => textos.push(a)); });
    (cfg.discursivas || []).forEach(q => textos.push(q.enunciado));
    alunos.forEach(a => textos.push(a.nome));
    const fora = caracteresFaltando(textos);
    if(fora.length) doc.avisoCaracteres = fora;
  }

  /* Regra: gastar o menor número de folhas possível; havendo empate,
     usar a letra maior. Assim uma prova curta cabe em uma lauda só e
     uma longa cresce para três, sem nunca descer de 10 pt. */
  const molde = new Ctor({unit: "mm", format: "a4"});
  prepararFontes(molde);
  const referencia = alunos[0] || {numero: "01", nome: "MODELO"};
  const teto = cfg.maxPaginas || MAX_PAGINAS;
  /* ponto de partida da primeira página: cabeçalho + cartão-resposta */
  const alturaPag = molde.internal.pageSize.getHeight();
  const fundo = alturaPag - MARGEM_INF;
  const Lcartao = montarLayout(String(cfg.gabaritoCanonico).length, cfg.no || 5);
  const topoPrimeira = cabecalho(molde, cfg, referencia, true)
    + Lcartao.box_h + 2 * Lcartao.quiet_zone + 8;
  const medir = fs => paginasNoPior(molde, cfg, alunos, fs, topoPrimeira, fundo);

  let escolha;
  if(cfg.simulado){
    /* Simulado: desce a letra de degrau em degrau até 9 pt. Não couber
       nem assim, quem chama corta questões — os parágrafos ficam. */
    const medidas = [];
    for(const fs of CORPOS_SAEPE){
      const pgs = medir(fs);
      medidas.push({fs, pgs});
      if(pgs <= teto) break;
    }
    escolha = medidas.find(m => m.pgs <= teto) || medidas[medidas.length - 1];
    doc.escadaCorpo = medidas;
  }else{
    let medidas = CORPOS.map(fs => ({fs, pgs: medir(fs)}));
    let minimo = Math.min(...medidas.map(m => m.pgs));
    /* Passou de quatro folhas por aluno? Aí sim vale apertar a letra abaixo
       do piso de 10 pt — é menos ruim do que imprimir uma quinta página. */
    if(minimo > teto){
      medidas = medidas.concat(
        CORPOS_APERTO.map(fs => ({fs, pgs: medir(fs)})));
      minimo = Math.min(...medidas.map(m => m.pgs));
    }
    escolha = medidas.find(m => m.pgs === minimo);   // CORPOS vem do maior
  }
  const corpo = escolha.fs;
  doc.corpoUsado = corpo;
  doc.paginasPorAluno = escolha.pgs;
  if(escolha.pgs > teto) doc.avisoPaginas = escolha.pgs;

  /* guarda quantas páginas cada estudante recebeu de fato: o encaixe
     nas colunas muda com a ordem, e o professor precisa saber se a
     tiragem sai pareja antes de grampear */
  /* No simulado todos os cadernos saem com o MESMO número de folhas: a
     ordem das questões muda o encaixe e faria um estudante receber três
     páginas e o vizinho quatro — ruim para grampear, conferir e aplicar.
     A folha que sobra vira rascunho, que numa prova longa é útil. */
  const alvoPag = cfg.simulado ? escolha.pgs : 0;
  doc.paginasDeCada = alunos.map((aluno, idx) => {
    if(idx) doc.addPage();
    let pgs = fluir(doc, cfg, aluno, corpo, false);
    while(pgs < alvoPag){
      doc.addPage();
      paginaDeRascunho(doc);
      pgs++;
    }
    return pgs;
  });
  if(doc.paginasDeCada.length){
    const pior = Math.max.apply(null, doc.paginasDeCada);
    doc.paginasPorAluno = pior;
    doc.paginasMinimas = Math.min.apply(null, doc.paginasDeCada);
    doc.avisoPaginas = pior > teto ? pior : 0;
  }
  DENSO = false;               // não vaza para a próxima geração
  return doc;
}

if(typeof module !== "undefined") module.exports =
  {desenharCartao, gerarProvas, gabaritoIndividual, montarPayload, encurtarNome, nomeCurtoQR, soAscii,
   pedacosDeNivel, remarcar, semMarcas, temMarcas, prepararFontes, medirFigura};
