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
/* ── alternativas desenhadas DENTRO da figura ───────────────────────
   Questão de "assinale a alternativa cujo gráfico representa a função":
   as cinco opções são cinco gráficos, e vêm todas na mesma imagem. O
   caderno não tem texto nenhum para escrever ao lado de A), B), C)…

   Duas consequências, e a segunda é grave:

   1. a figura é a RESPOSTA, não o apoio — tem de ser desenhada DEPOIS do
      comando, e não entre o texto e a pergunta como um gráfico comum;

   2. as alternativas NÃO PODEM ser embaralhadas. O app troca as letras
      de lugar por estudante e monta o gabarito individual a partir dessa
      troca. Como a imagem é a mesma para todos e não gira junto, o
      gabarito apontaria para a bolha errada e a questão inteira sairia
      mal corrigida — em silêncio. Nestas questões a ordem das
      alternativas fica travada na original. */
function alternativasNaFigura(q){
  if(!q || !q.imagem || !q.imagem.dados) return false;
  const alts = q.alternativas || [];
  /* Duas formas de a MESMA coisa chegar aqui, e a segunda passava batido:

     1. o arquivo trazia "A)" a "E)" sem texto ao lado → cinco
        alternativas em branco;
     2. o arquivo não trazia alternativa NENHUMA, porque as letras estão
        desenhadas dentro da imagem → lista vazia.

     O caso 2 é o mais comum, e era o que escapava: `if(!alts.length)
     return false` mandava a questão de volta para o embaralhamento. A
     imagem não gira junto, então o gabarito individual apontava para
     outra bolha e a questão saía marcada como errada mesmo respondida
     certo. Lista vazia satisfaz `every` — é exatamente o que se quer. */
  return alts.every(a => !semMarcas(String(a == null ? "" : a)).trim());
}
function indicesFixos(questoes){
  const out = [];
  (questoes || []).forEach((q, i) => { if(alternativasNaFigura(q)) out.push(i); });
  return out;
}

/* Versão da REGRA que transforma o gabarito canônico no gabarito de cada
   estudante. Sobe sempre que essa transformação mudar — e ela já mudou
   uma vez, na v47/v51, quando as questões cujas alternativas estão
   dentro da figura deixaram de embaralhar.

   Existe porque o gabarito individual é impresso no QR, gravado em cada
   resultado corrigido e exportado na planilha. Quando a regra muda, tudo
   isso que ficou por aí passa a discordar do app — e o professor não tem
   como saber, porque os dois números parecem igualmente oficiais. Com o
   carimbo, o app reconhece o que foi calculado com regra velha e se
   oferece para refazer as contas. */
const REGRA_GABARITO = 2;

/* ── tempero: mudar a REORGANIZAÇÃO sem mudar o conteúdo ─────────
   A ordem das questões sai de uma semente formada por turma + número.
   Isso é uma única ordem possível para cada estudante — e quando ela
   cai mal (uma figura de 50 mm parando no pé de uma coluna), aquele
   estudante precisa de uma página a mais que o colega.

   O tempero é um número pequeno somado à chave. Trocar de tempero
   reembaralha TODOS os cadernos de uma vez, sem mudar uma vírgula do
   conteúdo: mesmas questões, mesmo gabarito canônico, mesma letra. O app
   experimenta temperos até achar um em que a turma INTEIRA cabe no menor
   número de páginas — que é o "pensar na reorganização" no lugar de
   tapar a diferença com folha de rascunho.

   Ele entra pela CHAVE, e não pela função `semente`, de propósito:
   `embaralho.js` é espelho de `embaralho.py` e continua valendo palavra
   por palavra. Com tempero 0 — o padrão — nada muda.

   CUIDADO: o tempero fica gravado na prova. Trocá-lo depois de imprimir
   invalidaria os cadernos que já estão na mão do estudante, então a
   busca só acontece enquanto nenhum cartão foi corrigido. */
function comTempero(chave, tempero){
  return tempero ? String(chave) + "~" + tempero : chave;
}

function ordemDaProva(nq, no, turma, numero, comps, alternar, fixas){
  const r = (comps && comps.length === nq)
    ? embaralharEmBlocos(nq, no, turma, numero, comps, alternar)
    : embaralharProva(nq, no, turma, numero);
  if(fixas && fixas.length){
    /* `oa[p]` é a permutação da POSIÇÃO p, e o item canônico que caiu ali
       é `oq[p]` — por isso a trava é aplicada aqui, depois de os blocos
       reordenarem `oq`, e não dentro de embaralho.js. Assim o espelho em
       embaralho.py continua valendo palavra por palavra. */
    const presa = {};
    fixas.forEach(i => { presa[i] = 1; });
    const identidade = Array.from({length: no}, (_, k) => k);
    r.oa = r.oa.map((perm, p) => presa[r.oq[p]] ? identidade.slice() : perm);
  }
  return r;
}

/* ── gabarito individual: espelho de embaralho.py ─────────────────── */
function gabaritoIndividual(gabCanonico, turma, numero, no, comps, alternar, fixas){
  const gab = String(gabCanonico).toUpperCase(), nq = gab.length;
  const letras = ["A","B","C","D","E"].slice(0, no);
  const {oq, oa} = ordemDaProva(nq, no, turma, numero, comps, alternar, fixas);
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
                                 opt.comps, opt.alternar, opt.fixas);

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
  /* O Simulado SAEPE ganha dois milímetros a mais de faixa para o título
     caber com peso tipográfico de verdade. É a única diferença de altura
     entre os dois cabeçalhos. */
  const saepe = !!cfg.simulado;
  const alturaFaixa = alturaFaixaCabecalho(cfg);
  if(!dry){
    doc.setFillColor(...COR.navy);
    doc.rect(0, 0, W, alturaFaixa, "F");
    doc.setTextColor(...COR.branco); doc.setFont(FONTE_TEXTO, "bold");
    if(saepe){
      /* escola pequena em cima, SIMULADO SAEPE grande embaixo. O título
         vai em BRANCO sobre o navy porque é o par de maior contraste —
         em laranja ele empalidece quando a folha sai em preto e branco,
         que é como a prova é impressa. O laranja fica no filete, que é
         enfeite e não carrega informação. */
      doc.setFontSize(7);
      doc.text(String(cfg.escola || "").toUpperCase(), MARG, 5.2);
      doc.setFontSize(13);
      const titulo = "SIMULADO SAEPE";
      doc.text(titulo, MARG, 12.2);
      doc.setDrawColor(...COR.orange); doc.setLineWidth(0.8);
      doc.line(MARG, 13.6, MARG + doc.getTextWidth(titulo), 13.6);
      const aoLado = String(cfg.periodoLabel || "").replace(/^Simulado SAEPE\s*·?\s*/i, "");
      if(aoLado){
        doc.setFont(FONTE_TEXTO, "normal"); doc.setFontSize(7);
        doc.text(aoLado.toUpperCase(), W - MARG, 12.2, {align: "right"});
      }
    }else{
      doc.setFontSize(9);
      doc.text(String(cfg.escola || "").toUpperCase(), MARG, 6);
      doc.setTextColor(...COR.orange); doc.setFontSize(7);
      doc.text([cfg.titulo || "AVALIAÇÃO DE APRENDIZAGEM", cfg.periodoLabel]
                 .filter(Boolean).join("  •  ").toUpperCase(), MARG, 10.5);
    }
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
    /* No simulado o nome do professor NÃO aparece: a avaliação é da rede,
       não da turma de alguém. Os componentes e a data continuam. */
    const linha = saepe
      ? "COMPONENTES: " + (cfg.disciplina || "") +
        "        DATA: ____ / ____ / ______"
      : "DISCIPLINA: " + (cfg.disciplina || "") +
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
/* fim de referência: são fórmulas fixas da bibliografia.
   A ordem não importa — todas são aplicadas e vale o corte MAIS À DIREITA.
   Cuidado com "Acesso em: 6 fev. 2012.": a versão antiga (`[^.]*\.`) parava
   no ponto de "fev." e devolvia "2012. A informação principal desse texto
   é:" como se fosse o comando. A regra gulosa até o ANO vem antes, e a
   antiga fica como rede de segurança para datas sem ano. */
const FIM_FONTE = [
  /Mantida a ortografia original do texto\.\s*/g,
  /\bFragmento\.\s*/g,
  /\bAdaptado(\s+de[^.]{0,80})?\.\s*/g,
  /Acesso em:[^\n]{0,60}?\b(19|20)\d{2}\s*\.\s*/g,
  /Acesso em:[^.]*\.\s*/g,
  /Dispon[ií]vel em:\s*[^\s]+\s*\.?\s*/g,
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
      || /^\s*(Fonte|Revista|Jornal)\b\s*:?/i.test(txt)
      || /^[A-ZÀ-Ý]{2,}[,.]/.test(txt);
}
/* onde a referência começa dentro de um parágrafo que também traz texto */
function inicioDaReferencia(txt){
  const forte = /^(Dispon[ií]vel em|Fonte\s*:|Revista\s|Jornal\s|[A-ZÀ-Ý]{2,}[,.]\s|In:)/;
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

  /* Rede de segurança: a referência pode vir num parágrafo próprio que não
     casa com nenhuma das fórmulas de FIM_FONTE — "Fonte: Revista Veja,
     2012." é o caso típico. Se o parágrafo INTEIRO tem cara de referência
     e é curto, ele é a fonte, e o que vier depois é o comando. */
  if(!seg.fonte){
    for(let i = paras.length - 1; i >= 1; i--){
      const p = paras[i];
      if(p.length > 160 || !pareceReferencia(p)) continue;
      if(!/^\s*(Fonte|Revista|Jornal|Dispon[ií]vel em|In:)\b/i.test(p) &&
         !/^[A-ZÀ-Ý]{2,}[,.]/.test(p)) continue;
      seg.fonte = p;
      const resto = paras.slice(i + 1);
      if(resto.length) seg.comando = resto.join(" ");
      paras.length = i;
      break;
    }
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
  seg.tiposCorpo = classificarCorpo(paras);
  return seg;
}

/* ── que tipo de parágrafo é cada pedaço do texto de apoio ──────────
   Prosa é justificada e com entrada de parágrafo. Verso e fórmula NÃO:
   justificar um verso espalha as palavras até a margem e destrói a
   estrutura visual de que o poema depende; e uma expressão isolada
   (`N(t) = 200 · 2ᵗ`) fica centralizada, como no material oficial. */
const RE_SIMBOLO = /[=<>≤≥≠±×÷√∑∫∞·]/;
function pareceFormula(txt){
  const t = semMarcas(String(txt || "")).trim();
  if(!t || t.length > 48) return false;
  if(/[.,;:!?]$/.test(t)) return false;
  if(!RE_SIMBOLO.test(t)) return false;
  const palavras = t.split(/\s+/).filter(Boolean);
  if(palavras.length > 9) return false;
  /* proporção de letras baixa o bastante para não ser frase */
  const letras = (t.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return letras <= t.length * 0.6;
}

/* verso não se reconhece linha a linha, e sim pela SEQUÊNCIA: três ou
   mais linhas curtas seguidas, quebradas pelo autor. Uma frase curta
   solta no meio da prosa continua sendo prosa. */
function classificarCorpo(paras){
  const n = paras.length;
  const curto = paras.map(p => semMarcas(p).trim().length <= 58);
  const tipos = new Array(n).fill("corpo");
  let i = 0;
  while(i < n){
    if(!curto[i]){ i++; continue; }
    let j = i;
    while(j < n && curto[j]) j++;
    if(j - i >= 3) for(let k = i; k < j; k++) tipos[k] = "verso";
    i = j;
  }
  for(let k = 0; k < n; k++)
    if(tipos[k] !== "verso" && pareceFormula(paras[k])) tipos[k] = "formula";
  return tipos;
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

/* quanto ocupa, em mm, uma linha que mistura corpo normal e expoentes.
   Precisa disso para centralizar uma fórmula ou alinhar a fonte à
   direita sem que o `align` do jsPDF — que não conhece os pedaços —
   jogue o expoente para fora da coluna. */
function larguraComNiveis(doc, txt, fs){
  let larg = 0;
  pedacosDeNivel(txt).forEach(p => {
    doc.setFontSize(p.nivel === 0 ? fs : fs * 0.68);
    larg += doc.getTextWidth(p.t);
  });
  doc.setFontSize(fs);
  return larg;
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
      /* CUIDADO COM AS UNIDADES. `fs` está em PONTOS e `y` em MILÍMETROS.
         A conta antiga era `fs * 0.32` — 3,4 mm para um corpo de 10,5 pt,
         numa entrelinha de 4,4 mm. O expoente subia 76% de uma linha e
         ia colidir com o texto de cima: no PDF, o ᵗ de `2 · 3ᵗ` aparecia
         encavalado na linha anterior, e a linha dele ficava com um buraco.
         Só apareceu quando o PDF foi rasterizado e olhado.

         A referência certa é a ENTRELINHA, que já está em milímetros: o
         expoente sobe menos de um terço dela e nunca sai da própria
         linha. */
      const entre = fs * ENTRELINHA();
      const sobe = p.nivel > 0 ? entre * 0.30 : -entre * 0.14;
      doc.text(p.t, x + dx, y - sobe);
      dx += doc.getTextWidth(p.t);
      doc.setFontSize(fs);
    }
  });
  return dx;
}

/* ── poema: a estrofe centralizada como BLOCO ───────────────────────
   É o que as provas oficiais fazem, e o que o professor pediu. A estrofe
   inteira é deslocada para o meio da coluna, mas os versos continuam
   alinhados à ESQUERDA entre si — centralizar cada verso isoladamente
   transformaria a estrofe num losango e destruiria justamente a
   estrutura visual de que o poema depende. O deslocamento é calculado
   pelo verso MAIS LARGO do bloco. */
function centralizarVersos(doc, partes, larg){
  let i = 0;
  while(i < partes.length){
    if(partes[i].tipo !== "verso"){ i++; continue; }
    let j = i, maior = 0;
    while(j < partes.length && partes[j].tipo === "verso"){
      doc.setFont(FONTE_TEXTO, partes[j].estilo); doc.setFontSize(partes[j].fs);
      partes[j].linhas.forEach(ln => {
        const w = temMarcas(ln.t) ? larguraComNiveis(doc, ln.t, partes[j].fs)
                                  : doc.getTextWidth(semMarcas(ln.t));
        if(w > maior) maior = w;
      });
      j++;
    }
    /* centraliza na largura ÚTIL: dentro da moldura o verso mais largo
       é medido contra a largura já descontada do fio, não contra a coluna
       inteira — senão a estrofe sai empurrada para a direita */
    const util = (partes[i].larg != null) ? partes[i].larg : larg;
    const dx = Math.max(0, (util - maior) / 2);
    for(let k = i; k < j; k++) partes[k].dxBloco = dx;
    i = j;
  }
}

/* ── moldura do texto de apoio ──────────────────────────────────────
   O caderno oficial do SAEPE cerca o texto de apoio com um fio fino: o
   estudante vê de relance onde começa e onde termina o que ele tem de
   ler, e o comando fica visivelmente do lado de fora. É a marca visual
   mais reconhecível da prova, e o app não tinha.

   Entra quando a questão traz "Leia o texto abaixo." ou um título — que
   é a assinatura de um texto de apoio de verdade. Sem os dois, o
   enunciado é o próprio problema (o caso da maioria das questões de
   Matemática) e cercá-lo com um fio não diria nada.

   Ficam DENTRO: título e texto. Ficam FORA: a instrução, a referência
   bibliográfica (que no oficial vem logo abaixo do fio, alinhada à
   direita), o comando e as alternativas. */
const PAD_MOLDURA = 2.6;
const DENTRO_DA_MOLDURA = {titulo: 1, corpo: 1, verso: 1, formula: 1};

function medidasQuestao(doc, item, larg, fs, opcoes){
  doc.setFont(FONTE_TEXTO, "normal"); doc.setFontSize(fs);
  const passo = fs * ENTRELINHA();
  const seg = segmentarEnunciado(item.enunciado);
  const partes = [];
  const moldura = !!(seg.instrucao || seg.titulo) && (seg.corpo || []).length > 0;
  const medir = (txt, tipo, tamanho, estilo, recuo) => {
    doc.setFont(FONTE_TEXTO, estilo); doc.setFontSize(tamanho);
    const bruto = String(txt);
    /* dentro do fio o texto respira: mede-se na largura já descontada,
       senão a linha encosta na borda */
    const dentro = moldura && !!DENTRO_DA_MOLDURA[tipo];
    const util = dentro ? larg - 2 * PAD_MOLDURA : larg;
    const linhas = quebrarComRecuo(doc, semMarcas(bruto), util, recuo || 0);
    const remarcadas = remarcar(linhas.map(o => o.t), bruto);
    linhas.forEach((o, k) => { o.t = remarcadas[k]; });
    partes.push({tipo, linhas, fs: tamanho, estilo, moldura: dentro,
                 larg: util, passo: tamanho * ENTRELINHA()});
  };
  const RECUO = DENSO ? 4.4 : 5.2;      // entrada de parágrafo, bem visível
  if(seg.instrucao) medir(seg.instrucao, "instrucao", fs - 1.4, "normal");
  if(seg.titulo)    medir(seg.titulo,    "titulo",    fs,       "bold");
  /* verso e fórmula não levam entrada de parágrafo: o recuo desmancha o
     alinhamento do poema e desloca a expressão que deveria centralizar */
  const tiposCorpo = seg.tiposCorpo || [];
  (seg.corpo || []).forEach((p, i) => {
    const tipo = tiposCorpo[i] || "corpo";
    medir(p, tipo, fs, "normal", tipo === "corpo" ? RECUO : 0);
  });
  /* SOURCE_REFERENCE: corpo menor (≈8–9 pt), cinza, alinhada à direita e
     com ar próprio antes e depois. O piso de 8 pt existe porque na escada
     do simulado o corpo chega a 9 pt, e `fs − 2,2` daria 6,8 — ilegível
     numa folha xerocada. Itálico ficaria melhor, mas a DBMSans embutida
     só traz normal e bold, e trocar de família aqui quebraria os
     símbolos matemáticos. */
  if(seg.fonte)     medir(seg.fonte,     "fonte",  Math.max(8, fs - 2.2), "normal");
  /* O gráfico e a tabela entram AQUI, entre o texto e o comando, como no
     material oficial: primeiro o que se lê, depois o que se vê, e só
     então a pergunta. Desenhá-los depois do comando — como era —
     empurrava "Qual é a lei de formação dessa função?" para cima do
     gráfico que ela manda observar. */
  const fig = medirFigura(item.imagem, larg);
  /* Quando as alternativas estão DENTRO da figura, ela é a resposta e
     não o apoio: vai DEPOIS do comando. Desenhá-la antes faria o aluno
     ver as cinco opções antes de saber o que procurar nelas. */
  const naFigura = alternativasNaFigura(item);
  const posFig = partes.length + (naFigura && seg.comando ? 1 : 0);
  if(seg.comando)   medir(seg.comando,   "comando",   fs,       "bold");
  centralizarVersos(doc, partes, larg);

  /* onde o fio abre e onde fecha; -1 quando a questão não leva moldura */
  const abreMold = partes.findIndex(pt => pt.moldura);
  let fechaMold = -1;
  partes.forEach((pt, i) => { if(pt.moldura) fechaMold = i; });

  let h = AR_ROTULO();
  partes.forEach((pt, i) => {
    h += pt.linhas.length * pt.passo + espacoDepois(pt.tipo, partes[i + 1]);
  });
  /* o respiro entre o fio e o texto, em cima e embaixo */
  if(abreMold >= 0) h += 2 * PAD_MOLDURA;
  h += AR_ENUN();
  /* 1,5 mm acima + 1,5 mm abaixo: é exatamente o que desenharFig gasta.
     Media-se 2,5 e desenhava-se 3 — meio milímetro de dívida por figura,
     que o novo empacotamento por unidades não pode ter. */
  if(fig) h += fig.h + 3;
  doc.setFont(FONTE_TEXTO, "normal"); doc.setFontSize(fs);
  /* Cinco linhas "A)" vazias embaixo de uma figura que já traz as cinco
     opções não ajudam ninguém e ainda comem meia coluna. */
  const alts = naFigura ? [] : (item.alternativas || []).map(a => {
    const bruto = String(a == null ? "" : a);
    return remarcar(doc.splitTextToSize(semMarcas(bruto), larg - 7), bruto);
  });
  alts.forEach(la => { h += la.length * passo + AR_ALT(); });
  return {h, partes, alts, fig, posFig, passo, naFigura, abreMold, fechaMold};
}

/* o ar entre as partes: pouco dentro do texto, mais antes do comando */
function espacoDepois(tipo, proxima){
  const alvo = proxima ? proxima.tipo : null;
  if(tipo === "instrucao") return DENSO ? 0.6 : 0.9;
  if(tipo === "titulo")    return DENSO ? 1.0 : 1.5;
  /* a fonte nunca pode ficar colada no comando seguinte: era daí que
     saía "2012. A informação principal desse texto é:" com cara de
     frase única */
  if(tipo === "fonte")     return DENSO ? 1.8 : 2.6;
  if(alvo === "fonte")     return DENSO ? 1.0 : 1.4;
  if(alvo === "comando")   return DENSO ? 1.6 : 2.2;
  /* verso: entrelinha apertada dentro da estrofe, para o poema não
     parecer uma lista de frases soltas */
  if(tipo === "verso")     return alvo === "verso" ? (DENSO ? 0.1 : 0.2)
                                                   : (DENSO ? 1.0 : 1.4);
  if(tipo === "formula")   return DENSO ? 1.2 : 1.8;
  if(alvo === "formula")   return DENSO ? 1.2 : 1.8;
  if(tipo === "corpo")     return DENSO ? 0.7 : 1.0;
  return DENSO ? 0.5 : 0.8;
}

/* Desenha as linhas [de, ate) de uma parte do enunciado. Cada tipo tem o
   seu alinhamento — e nenhum herda o do anterior, que era como o endereço
   do site acabava justificado no meio do parágrafo. */
function desenharLinhasParte(doc, pt, x, y, largCol, de, ate){
  /* dentro da moldura o texto anda para dentro e é medido mais estreito;
     fora dela, `pt.larg` é a própria largura da coluna */
  const larg = (pt.larg != null) ? pt.larg : largCol;
  if(pt.moldura) x += PAD_MOLDURA;
  doc.setFont(FONTE_TEXTO, pt.estilo); doc.setFontSize(pt.fs);
  if(pt.tipo === "instrucao" || pt.tipo === "fonte") doc.setTextColor(...COR.grey);
  else if(pt.tipo === "titulo") doc.setTextColor(...COR.navy);
  else doc.setTextColor(25, 28, 34);
  /* justificado só no texto corrido e no comando; verso e fórmula têm
     estrutura visual própria e o justificado a destruiria */
  const justifica = (pt.tipo === "corpo" || pt.tipo === "comando");
  /* deslocamento da ESTROFE inteira; zero em tudo que não é verso */
  const dxBloco = pt.dxBloco || 0;
  for(let k = de; k < ate; k++){
    const ln = pt.linhas[k];
    const yy = y + pt.passo * (0.75 + (k - de));
    if(pt.tipo === "fonte"){
      /* a fonte é medida pedaço a pedaço quando traz marcas, senão o
         alinhamento à direita some junto com o expoente */
      if(temMarcas(ln.t)){
        const larguraDaLinha = larguraComNiveis(doc, ln.t, pt.fs);
        textoComNiveis(doc, ln.t, x + larg - larguraDaLinha, yy, pt.fs);
      }else doc.text(ln.t, x + larg, yy, {align: "right"});
    }else if(pt.tipo === "titulo" || pt.tipo === "formula"){
      if(temMarcas(ln.t)){
        const larguraDaLinha = larguraComNiveis(doc, ln.t, pt.fs);
        textoComNiveis(doc, ln.t, x + (larg - larguraDaLinha) / 2, yy, pt.fs);
      }else doc.text(ln.t, x + larg / 2, yy, {align: "center"});
    }else if(temMarcas(ln.t)){
      /* linha com expoente: desenhada pedaço a pedaço, sem justificar */
      textoComNiveis(doc, ln.t, x + dxBloco + ln.dx, yy, pt.fs);
    }else if(justifica && k < pt.linhas.length - 1){
      doc.text(ln.t, x + ln.dx, yy, {align: "justify", maxWidth: larg - ln.dx});
    }else{
      doc.text(ln.t, x + dxBloco + ln.dx, yy);
    }
  }
  return y + (ate - de) * pt.passo;
}

/* ── unidades: os pedaços em que uma questão PODE ser partida ───────
   Até a v42 a questão era um bloco só, com um `desenhar()` indivisível.
   Numa página de duas colunas isso significava que uma questão mais alta
   que a coluna encurtada pelo cartão-resposta não cabia em nenhuma das
   duas — e, como a ordem não pode mudar (o gabarito individual depende
   dela), a página fechava com a coluna direita vazia.

   Agora a questão vira uma lista de unidades com altura própria. Quem
   NÃO pode ser separado do seguinte carrega `cola: true`:

   - o rótulo QUESTÃO NN nunca fica sozinho no pé da coluna;
   - instrução, título e figura vão grudados no que vem depois;
   - a fonte nunca fica isolada — anda com o comando;
   - o comando nunca se separa da primeira alternativa;
   - as duas primeiras e as duas últimas alternativas andam juntas, para
     nenhuma alternativa cair sozinha na coluna seguinte;
   - um parágrafo só se divide deixando pelo menos DUAS linhas de cada
     lado (viúvas e órfãs).

   A soma das alturas das unidades é exatamente `m.h + AR_QUESTAO()`
   (mais a faixa de bloco, quando houver) — a paginação continua medindo
   a mesma coisa que o desenho gasta. */
function unidadesQuestao(doc, n, item, larg, fs, opcoes, m, rotuloBloco){
  const U = [];
  const push = (h, cola, desenhar) => U.push({h, cola: !!cola, desenhar});

  if(rotuloBloco){
    push(ALT_CABECALHO, true, (x, y) => {
      doc.setFillColor(...COR.navy);
      doc.rect(x, y, larg, 5.5, "F");
      doc.setTextColor(...COR.branco); doc.setFont(FONTE_TEXTO, "bold"); doc.setFontSize(6.5);
      doc.text(String(rotuloBloco).toUpperCase(), x + 2, y + 3.9);
      return y + ALT_CABECALHO;
    });
  }

  push(AR_ROTULO(), true, (x, y) => {
    doc.setTextColor(...COR.navy); doc.setFont(FONTE_TEXTO, "bold"); doc.setFontSize(fs - 1.5);
    doc.text("QUESTÃO " + String(n).padStart(2, "0"), x, y + 2.4);
    doc.setDrawColor(...COR.orange); doc.setLineWidth(0.6);
    doc.line(x, y + 3.6, x + 15, y + 3.6);
    return y + AR_ROTULO();
  });

  /* gráficos e figuras centralizados na área útil da coluna, e nunca
     separados do comando que manda observá-los */
  const figH = m.fig ? m.fig.h + 3 : 0;
  const desenharFig = (x, y) => {
    if(!m.fig) return y;
    const xf = x + Math.max(0, (larg - m.fig.w) / 2);
    try{ doc.addImage(item.imagem.dados, "JPEG", xf, y + 1.5, m.fig.w, m.fig.h); }catch(e){}
    return y + figH;
  };

  /* Estes nunca podem ser o último elemento de uma coluna: a instrução e
     o título ficariam órfãos, a fonte ficaria solta e o comando se
     separaria das alternativas que ele manda escolher. */
  const GRUDA = {instrucao: 1, titulo: 1, fonte: 1, comando: 1};

  /* O fio da moldura é desenhado POR UNIDADE: as duas verticais em toda
     unidade cercada, a horizontal de cima só na primeira e a de baixo só
     na última. Assim, se o texto se dividir entre as colunas, cada metade
     sai com um fio aberto do lado do corte — que é como uma tabela
     partida se comporta, e lê-se naturalmente como continuação. Desenhar
     a moldura inteira de uma vez exigiria saber, na hora do desenho, onde
     a coluna vai quebrar; a unidade não sabe, e não precisa saber. */
  const cercar = (fn, abre, fecha, altura) => (x, y) => {
    const r = fn(x, y + (abre ? PAD_MOLDURA : 0));
    const y1 = y + altura;
    doc.setDrawColor(...COR.grey); doc.setLineWidth(0.25);
    doc.line(x, y, x, y1);
    doc.line(x + larg, y, x + larg, y1);
    if(abre)  doc.line(x, y, x + larg, y);
    if(fecha) doc.line(x, y1, x + larg, y1);
    return r;
  };

  m.partes.forEach((pt, i) => {
    if(i === m.posFig && m.fig) push(figH, true, desenharFig);
    const ultima = (i === m.partes.length - 1);
    const cola = !!GRUDA[pt.tipo] || ultima;
    const depois = espacoDepois(pt.tipo, m.partes[i + 1]);
    const L = pt.linhas.length;
    const abreAqui  = pt.moldura && i === m.abreMold;
    const fechaAqui = pt.moldura && i === m.fechaMold;
    /* prosa e verso longos podem começar numa coluna e terminar na
       outra; título, fonte e comando são curtos e ficam inteiros */
    const divisivel = (pt.tipo === "corpo" || pt.tipo === "verso") && L >= 4;
    if(!divisivel){
      const alturaTexto = L * pt.passo + (abreAqui ? PAD_MOLDURA : 0) +
                          (fechaAqui ? PAD_MOLDURA : 0);
      /* o `depois` da última parte cercada é o ar entre o fio e a fonte:
         fica FORA do fio; entre parágrafos internos, fica dentro */
      const dentroDoFio = pt.moldura ? alturaTexto + (fechaAqui ? 0 : depois)
                                     : 0;
      /* o respiro de CIMA já entra pelo deslocamento que `cercar` faz no y;
         somar aqui de novo cobraria dois respiros e a soma das unidades
         deixaria de bater com a altura desenhada */
      let fn = (x, y) => desenharLinhasParte(doc, pt, x, y, larg, 0, L) + depois +
        (fechaAqui ? PAD_MOLDURA : 0);
      if(pt.moldura) fn = cercar(fn, abreAqui, fechaAqui, dentroDoFio);
      push(L * pt.passo + depois + (abreAqui ? PAD_MOLDURA : 0) +
           (fechaAqui ? PAD_MOLDURA : 0), cola, fn);
      return;
    }
    for(let k = 0; k < L; k++){
      const fim = (k === L - 1);
      const abreL  = abreAqui  && k === 0;
      const fechaL = fechaAqui && fim;
      /* corte legal só entre a 2ª linha e a antepenúltima: nunca deixa
         uma linha só de um lado */
      const podeCortar = (k >= 1 && k <= L - 3);
      const extra = (abreL ? PAD_MOLDURA : 0) + (fechaL ? PAD_MOLDURA : 0);
      const alt = pt.passo + (fim ? depois : 0) + extra;
      const dentroDoFio = pt.moldura ? pt.passo + extra + (fechaL ? 0 : (fim ? depois : 0))
                                     : 0;
      let fn = ((kk, fe, fi) => (x, y) =>
        desenharLinhasParte(doc, pt, x, y, larg, kk, kk + 1) + (fi ? depois : 0) +
        (fe ? PAD_MOLDURA : 0)
      )(k, fechaL, fim);
      if(pt.moldura) fn = cercar(fn, abreL, fechaL, dentroDoFio);
      push(alt, fim ? cola : !podeCortar, fn);
    }
  });

  /* rabicho do enunciado: a figura da questão SEM comando (que a v42 já
     desenhava no fim) mais o ar que separa o enunciado das alternativas.
     Fica sempre numa unidade própria para que a soma das alturas bata
     com `m.h` qualquer que seja o formato da questão. */
  /* a figura que não coube em nenhum índice de parte — a da questão sem
     comando, e a que carrega as alternativas e vai depois dele */
  const figNoFim = (m.posFig >= m.partes.length);
  /* sem alternativas de texto (elas estão na figura), é este rabicho que
     carrega o ar que separa uma questão da seguinte */
  const rabicho = AR_ENUN() + (m.alts.length ? 0 : AR_QUESTAO());
  push((figNoFim ? figH : 0) + rabicho, m.alts.length > 0, (x, y) => {
    if(figNoFim) y = desenharFig(x, y);
    return y + rabicho;
  });

  const nAlt = m.alts.length;
  m.alts.forEach((la, k) => {
    const ultima = (k === nAlt - 1);
    const extra = AR_ALT() + (ultima ? AR_QUESTAO() : 0);
    /* nenhuma alternativa fica sozinha: as duas primeiras e as duas
       últimas viajam sempre juntas */
    const cola = (k === 0 && nAlt > 1) || (k === nAlt - 2 && nAlt > 1);
    push(la.length * m.passo + extra, cola, (x, y) => {
      doc.setFont(FONTE_TEXTO, "bold"); doc.setTextColor(...COR.orange); doc.setFontSize(fs);
      doc.text(opcoes[k] + ")", x + 1, y + m.passo * 0.75);
      doc.setFont(FONTE_TEXTO, "normal"); doc.setTextColor(25, 28, 34);
      la.forEach((ln, i2) => {
        const yy = y + m.passo * (0.75 + i2);
        /* linha seguinte de uma alternativa longa mantém o recuo */
        if(temMarcas(ln)) textoComNiveis(doc, ln, x + 7, yy, fs);
        else doc.text(ln, x + 7, yy);
      });
      return y + la.length * m.passo + extra;
    });
  });
  return U;
}

/* a questão inteira, de uma vez — é o que a v42 fazia, agora escrito em
   cima das unidades para não existirem dois desenhos diferentes */
function desenharQuestaoCol(doc, x, y, n, item, larg, fs, opcoes, m){
  unidadesQuestao(doc, n, item, larg, fs, opcoes, m, null)
    .forEach(u => { y = u.desenhar(x, y); });
  return y;
}

/* folha inteira de rascunho, para igualar a tiragem do simulado */
/* ── moldura da página e rodapé ───────────────────────────────
   Um fio fechando a mancha e o nome do estudante no pé de CADA folha.

   O nome no rodapé não é enfeite. As folhas se soltam do grampo e caem no
   chão, e um caderno cujas questões estão em ordem diferente para cada
   estudante NÃO pode ser remontado por dedução: sem o nome em toda folha,
   uma página solta é uma página perdida.

   O rodapé come 7 mm de altura útil. `fundoUtil()` é a única fonte desse
   número — `fluir` e `gerarProvas` têm de medir a MESMA mancha, senão a
   escolha do corpo mira uma página que não é a que sai impressa. */
/* quantas reorganizações o app experimenta antes de desistir e nivelar
   com folha de rascunho. Cada tentativa custa uma medição da turma
   inteira; 24 leva menos de um segundo e resolve na prática sempre. */
const TEMPEROS = 24;
const RODAPE = 7;
/* a faixa do cabeçalho é sangrada de borda a borda; a moldura começa
   logo abaixo dela */
const alturaFaixaCabecalho = cfg => (cfg && cfg.simulado) ? 15 : 13;
const fundoUtil = doc => doc.internal.pageSize.getHeight() - MARGEM_INF - RODAPE;

function molduraDaPagina(doc, cfg, aluno, pagina, total, topoMancha, topoQuadro){
  const W = doc.internal.pageSize.getWidth();
  const base = fundoUtil(doc);
  const x0 = MARG - 3, x1 = W - MARG + 3;
  /* O fio cerca a PROVA INTEIRA, e não só a área das questões: na
     primeira página ele passa por fora da identificação do estudante e do
     cartão-resposta também. Começa logo abaixo da faixa do cabeçalho, que
     é sangrada de borda a borda e já fecha o topo da folha sozinha.

     Ele passa a 5 mm do cartão, que é desenhado em MARG+2 — longe o
     bastante para não se confundir com a borda tracejada de recorte nem
     chegar perto dos quatro marcadores pretos que a câmera procura. */
  const y0 = (topoQuadro != null ? topoQuadro : topoMancha - 4);
  const y1 = base + 4;

  doc.setDrawColor(...COR.grey); doc.setLineWidth(0.4);
  if(doc.setLineDashPattern) doc.setLineDashPattern([], 0);
  doc.rect(x0, y0, x1 - x0, y1 - y0, "S");

  /* O fio entre as colunas começa onde as colunas começam — na primeira
     página, abaixo do cartão. Subir até o topo cortaria a identificação
     do estudante ao meio. */
  doc.setLineWidth(0.2);
  const meio = MARG + (W - 2 * MARG - GUT) / 2 + GUT / 2;
  doc.line(meio, Math.max(y0 + 3, topoMancha - 3), meio, y1 - 3);

  doc.setFont(FONTE_TEXTO, "normal"); doc.setFontSize(6.5);
  doc.setTextColor(...COR.grey);
  const quem = [encurtarNome(String(aluno && aluno.nome || ""), 46),
                cfg.turma, aluno && aluno.numero ? "nº " + aluno.numero : ""]
    .filter(Boolean).join("  ·  ");
  doc.text(quem, MARG, y1 + 4);
  doc.text(total ? "pág. " + pagina + " de " + total : "pág. " + pagina,
           W - MARG, y1 + 4, {align: "right"});
}

function paginaDeRascunho(doc){
  desenharRascunho(doc, TOPO, fundoUtil(doc) - TOPO);
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
  const {oq, oa} = ordemDaProva(nq, no, cfg.turma, comTempero(chave, cfg.tempero),
                                comps, cfg.alternarBlocos, indicesFixos(cfg.questoes));
  /* A prova não é mais uma fila de blocos indivisíveis: cada questão
     entra como uma sequência de unidades, e a faixa de bloco
     (LÍNGUA PORTUGUESA, MATEMÁTICA) é a primeira unidade da questão que
     abre o componente — colada, para nunca ficar órfã no pé da coluna. */
  let blocos = [];

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
    blocos = blocos.concat(
      unidadesQuestao(doc, p + 1, item, larg, fs, opcoes, m, rotulo));
  }

  const disc = cfg.discursivas || [];
  if(disc.length){
    blocos.push({h: 8, cola: true, desenhar: (x, y) => {
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
      blocos.push({h, cola: false, desenhar: (x, y) => {
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
function melhorCorte(alturas, capacidade, colas){
  const total = alturas.reduce((a, b) => a + b, 0);
  let melhor = -1, dif = Infinity;
  let esq = 0;
  for(let k = 1; k <= alturas.length; k++){
    esq += alturas[k - 1];
    /* cortar depois da unidade k−1 só vale se ela não estiver colada na
       seguinte — é isso que impede o comando de ficar numa coluna e as
       alternativas na outra. O corte no fim da lista é sempre legal. */
    if(k < alturas.length && colas && colas[k - 1]) continue;
    const dir = total - esq;
    if(esq <= capacidade && dir <= capacidade){
      const d = Math.abs(esq - dir);
      if(d < dif){ dif = d; melhor = k; }
    }
  }
  return melhor;
}

/* quantas unidades formam o grupo colado que começa em `i`. Serve de
   piso quando nem o grupo inteiro cabe na coluna: em vez de partir a
   cola no meio, o grupo transborda junto. */
function grupoColado(colas, i, total){
  let n = 1;
  while(i + n < total && colas[i + n - 1]) n++;
  return n;
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
    /* a contagem de páginas precisa enxergar as MESMAS unidades que o
       desenho vai empacotar — medir a questão inteira daria um número
       diferente agora que ela pode ser dividida entre as colunas */
    const U = unidadesQuestao(doc, idx + 1, {enunciado: base.enunciado,
      imagem: base.imagem, alternativas: base.alternativas || []},
      larg, fs, opcoes, m, null);
    /* As alternativas são as ÚLTIMAS unidades, e cada estudante as
       recebe embaralhadas. A soma não muda, mas a ordem sim — e é a
       ordem que decide onde a cola cai e, com ela, quantas páginas a
       prova ocupa. Por isso as alturas das alternativas voltam CRUAS,
       para `paginasNoPior` remontá-las na ordem de cada estudante. */
    const nAlt = m.alts.length;
    const altsBase = m.alts.map(la => la.length * m.passo + AR_ALT());
    return {alturas: U.map(u => u.h), colas: U.map(u => u.cola), nAlt, altsBase};
  });
}

/* remonta as unidades de uma questão na ordem de alternativas que ESTE
   estudante recebeu. `perm[k]` é o índice canônico que aparece na
   posição k. O ar entre questões (`AR_QUESTAO`) anda pendurado na
   última posição, seja qual for a alternativa que caiu lá. */
function unidadesNaOrdem(q, perm, destinoA, destinoC){
  const cab = q.alturas.length - q.nAlt;
  for(let k = 0; k < cab; k++){ destinoA.push(q.alturas[k]); destinoC.push(q.colas[k]); }
  for(let k = 0; k < q.nAlt; k++){
    const canonico = (perm && perm[k] != null) ? perm[k] : k;
    const base = q.altsBase[canonico];
    destinoA.push(base + (k === q.nAlt - 1 ? AR_QUESTAO() : 0));
    destinoC.push((q.nAlt > 1) && (k === 0 || k === q.nAlt - 2));
  }
}

/* Até onde uma coluna chega a partir de `i`, sem partir grupo colado.
   Devolve o índice EXCLUSIVO do primeiro bloco que ficou de fora.
   Quando nem o primeiro grupo cabe, devolve o grupo inteiro assim mesmo:
   a página precisa andar, e transbordar é melhor que travar. */
function encherColuna(alturas, colas, i, fim, cap){
  if(i >= fim) return i;
  let soma = 0, ultimo = -1;
  for(let k = i; k < fim; k++){
    soma += alturas[k];
    const legal = (k === fim - 1) || !colas[k];
    if(legal){
      if(soma <= cap) ultimo = k + 1; else break;
    }else if(soma > cap && ultimo >= 0) break;
  }
  return ultimo >= 0 ? ultimo : Math.min(fim, i + grupoColado(colas, i, fim));
}

/* Como fica UMA página a partir de `i`: onde termina a coluna esquerda
   (`corte`) e onde termina a página (`leva`), ambos contados a partir
   de `i`.

   A REGRA é a da leitura: só se passa para a coluna da direita depois
   que a da esquerda está cheia. É assim que o estudante lê, e uma
   página em que as duas colunas param no meio faz parecer que a prova
   acabou ali.

   Até a v58 o app EQUILIBRAVA: dividia o conteúdo da página em duas
   metades de altura parecida. Numa página cheia dava quase no mesmo,
   mas na última — e em qualquer uma que fechasse antes do fim — as
   duas colunas paravam na metade, com um rasgo de branco atravessando o
   pé da folha.

   Os dois limites caem sempre num corte legal, então nem a divisão entre
   as colunas nem o fim da página partem um grupo colado. */
function distribuirPagina(alturas, colas, i, fim, cap){
  const corte = encherColuna(alturas, colas, i, fim, cap) - i;
  const leva = encherColuna(alturas, colas, i + corte, fim, cap) - i;
  return {corte, leva: Math.max(leva, corte)};
}

function empacotar(alturas, topoPrimeira, fundo, colas){
  let paginas = 1, i = 0, topo = topoPrimeira;
  while(i < alturas.length){
    const {leva} = distribuirPagina(alturas, colas, i, alturas.length, fundo - topo);
    i += Math.max(1, leva);
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

/* ── quem recebe este caderno ───────────────────────────────────────
   Num simulado de série o caderno é o MESMO em todas as turmas, mas a
   ordem das questões é semeada por turma + número — então o encaixe nas
   colunas muda de turma para turma. Medir só com a turma da vez fazia a
   turma A fechar em 20 questões e a B, lendo exatamente o mesmo arquivo,
   cair para 18: cada uma decidia sozinha o corpo da letra e quantas
   questões cortar.

   A decisão tem de ser da SÉRIE. `cfg.serie` traz todas as turmas que
   recebem o caderno, e o pior caso é procurado no conjunto inteiro. Sem
   `cfg.serie` — prova comum, ou simulado de turma única — o
   comportamento é o de antes. */
function paresDeOrdem(cfg, alunos){
  const pares = [], vistos = Object.create(null);
  const add = (turma, chave) => {
    const k = String(turma) + "\u0000" + String(chave);
    if(vistos[k]) return;
    vistos[k] = 1; pares.push({turma: turma, chave: chave});
  };
  const turmas = (cfg.serie && cfg.serie.length)
    ? cfg.serie : [{turma: cfg.turma, alunos: alunos}];
  turmas.forEach(t => chavesDaTurma(cfg, t.alunos).forEach(c => add(t.turma, c)));
  if(!pares.length) add(cfg.turma, "01");
  return pares;
}

/* Quantas páginas cada ordem impressa ocupa. Devolve o pior E o melhor
   caso: a diferença entre os dois é pura ineficiência de empacotamento
   — o conteúdo é idêntico, só a ordem muda —, e é ela que o nivelamento
   tem de atacar antes de sair acrescentando folha de rascunho. */
function paginasDaTurma(doc, cfg, alunos, fs, topoPrimeira, fundo, hPronto){
  /* `hPronto` é a medição das questões, que depende do corpo e do
     espaçamento mas NÃO do tempero. A busca por reorganização chama esta
     função dezenas de vezes com o mesmo corpo; remedir tudo a cada volta
     custaria segundos de espera no celular. */
  const h = hPronto || alturasCanonicas(doc, cfg, fs);
  const nq = h.length, no = cfg.no || 5;
  const comps = (cfg.comps && cfg.comps.length === nq) ? cfg.comps : null;
  const fixas = indicesFixos(cfg.questoes);
  let pior = 1, melhor = Infinity;
  paresDeOrdem(cfg, alunos).forEach(par => {
    const {oq, oa} = ordemDaProva(nq, no, par.turma,
      comTempero(par.chave, cfg.tempero), comps, cfg.alternarBlocos, fixas);
    const alturas = [], colas = [];
    oq.forEach((idx, p) => {
      const abre = comps && (p === 0 || comps[oq[p - 1]] !== comps[idx]);
      if(abre){ alturas.push(ALT_CABECALHO); colas.push(true); }
      unidadesNaOrdem(h[idx], oa[p], alturas, colas);
    });
    const pgs = empacotar(alturas, topoPrimeira, fundo, colas);
    if(pgs > pior) pior = pgs;
    if(pgs < melhor) melhor = pgs;
  });
  return {pior, melhor: melhor === Infinity ? 1 : melhor};
}

function paginasNoPior(doc, cfg, alunos, fs, topoPrimeira, fundo){
  return paginasDaTurma(doc, cfg, alunos, fs, topoPrimeira, fundo).pior;
}

function fluir(doc, cfg, aluno, fs, dry, totalPag){
  const alturaPag = doc.internal.pageSize.getHeight();
  const fundo = fundoUtil(doc);
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
      alternar: cfg.alternarBlocos,
      chave: comTempero(chaveDeOrdem(aluno.numero, cfg.tipos), cfg.tempero),
      fixas: indicesFixos(cfg.questoes),
      turma: cfg.turma, numero: aluno.numero, nome: aluno.nome});
  }
  const topoPrimeira = y + altCartao + 8;   // folga para não colidir com a moldura

  /* A moldura da página 1 começa ABAIXO do cartão-resposta, e não no alto
     da folha: o cartão já tem a sua própria borda tracejada de recorte, e
     um segundo retângulo em volta dela confundiria o professor na hora de
     cortar — e passaria perto demais dos quatro marcadores pretos que a
     câmera procura. O cartão é componente protegido; a moldura não chega
     nele. */
  const moldurar = (pg, topoMancha, topoQuadro) => {
    if(!dry) molduraDaPagina(doc, cfg, aluno, pg, totalPag, topoMancha, topoQuadro);
  };
  moldurar(1, topoPrimeira, alturaFaixaCabecalho(cfg) + 3);

  const blocos = blocosDaProva(doc, cfg, aluno, fs);
  const alturas = blocos.map(b => b.h);
  const colas = blocos.map(b => !!b.cola);

  let i = 0, topo = topoPrimeira, ultimoUso = topo;
  while(i < blocos.length){
    /* a MESMA conta que `empacotar` faz ao contar as páginas: se as duas
       divergirem, a escolha do corpo mira um layout que não é o que sai
       impresso */
    const d = distribuirPagina(alturas, colas, i, blocos.length, fundo - topo);
    const corte = d.corte, leva = Math.max(1, d.leva);

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
      moldurar(paginas, topo, topo - 4);
    }
  }

  // o rascunho é um bônus: só entra no espaço que sobrou, nunca
  // pede uma página nova — papel a mais não vale por área de rabisco
  const sobra = fundo - ultimoUso;
  if(!dry && !cfg.simulado && sobra >= 26) desenharRascunho(doc, ultimoUso + 3, sobra - 3);
  return paginas;
}

/* ── PRE_FLIGHT_CHECK ───────────────────────────────────────────────
   Conferência da diagramação ANTES de o PDF ficar pronto. Não corrige
   conteúdo — só avisa quando a forma comeu alguma coisa: um expoente que
   sumiu, uma referência que vazou para dentro do comando, uma linha mais
   larga que a coluna, uma alternativa a menos.

   Roda sobre o MOLDE, com o corpo já escolhido, e devolve uma lista de
   avisos em português. Lista vazia = passou. */
function charsDeNivel(txt){
  let sup = 0, sub = 0;
  pedacosDeNivel(txt).forEach(p => {
    const n = p.t.replace(/\s/g, "").length;
    if(p.nivel > 0) sup += n; else if(p.nivel < 0) sub += n;
  });
  return {sup, sub};
}
/* soma dos caracteres sobrescritos/subscritos que sobreviveram à quebra
   de linha. Conta CARACTERES e não pedaços porque uma quebra no meio de
   um expoente divide o pedaço em dois sem perder nada. */
function niveisRenderizados(m){
  let sup = 0, sub = 0;
  m.partes.forEach(pt => pt.linhas.forEach(ln => {
    const c = charsDeNivel(ln.t); sup += c.sup; sub += c.sub;
  }));
  m.alts.forEach(la => la.forEach(ln => {
    const c = charsDeNivel(ln); sup += c.sup; sub += c.sub;
  }));
  return {sup, sub};
}

const RE_VAZOU_FONTE = /(Dispon[ií]vel em|Acesso em:|Fragmento\.|Adaptado\.)/;

function preFlightCheck(cfg, doc, fs){
  const avisos = [];
  const larg = larguraColuna(doc);
  const gab = String(cfg.gabaritoCanonico || "").toUpperCase();
  const nq = gab.length, no = cfg.no || 5;
  const opcoes = ["A", "B", "C", "D", "E"].slice(0, no);
  const qs = cfg.questoes || [];

  /* ── CONTEÚDO ── */
  if(qs.length !== nq)
    avisos.push("o caderno tem " + qs.length + " questões e o gabarito tem " +
                nq + " letras");
  if(cfg.comps && cfg.comps.length && cfg.comps.length !== nq)
    avisos.push("a lista de componentes não tem o mesmo tamanho do gabarito");

  qs.forEach((q, idx) => {
    const n = idx + 1;
    const alts = q.alternativas || [];
    const item = {enunciado: q.enunciado, imagem: q.imagem, alternativas: alts};
    const naFigura = alternativasNaFigura(item);
    if(!semMarcas(q.enunciado).trim())
      avisos.push("questão " + n + ": enunciado vazio");
    if(alts.length !== no && !naFigura)
      avisos.push("questão " + n + ": " + alts.length + " alternativas, " +
                  "eram para ser " + no);
    if(naFigura)
      avisos.push("questão " + n + ": as alternativas estão dentro da figura — " +
                  "a ordem delas fica travada na original (não dá para embaralhar " +
                  "uma imagem), e a figura foi desenhada depois do comando");
    else if(alts.some(a => !semMarcas(a).trim()))
      avisos.push("questão " + n + ": alternativa em branco");

    let m;
    try{ m = medidasQuestao(doc, item, larg, fs, opcoes); }
    catch(e){ avisos.push("questão " + n + ": não foi possível medir (" + e.message + ")"); return; }

    /* ── MATEMÁTICA: expoentes e índices ── */
    const antes = charsDeNivel(q.enunciado);
    alts.forEach(a => { const c = charsDeNivel(a); antes.sup += c.sup; antes.sub += c.sub; });
    const depois = niveisRenderizados(m);
    if(depois.sup < antes.sup || depois.sub < antes.sub)
      avisos.push("questão " + n + ": ERRO DE RENDERIZAÇÃO — expoente ou índice " +
                  "sumiu na diagramação (tinha " + antes.sup + "/" + antes.sub +
                  ", sobrou " + depois.sup + "/" + depois.sub + ")");

    /* ── DIAGRAMAÇÃO ── */
    const comando = m.partes.filter(p => p.tipo === "comando")
      .map(p => p.linhas.map(l => semMarcas(l.t)).join(" ")).join(" ");
    if(comando && RE_VAZOU_FONTE.test(comando))
      avisos.push("questão " + n + ": a referência bibliográfica vazou para " +
                  "dentro do comando");
    m.partes.forEach(pt => {
      doc.setFont(FONTE_TEXTO, pt.estilo); doc.setFontSize(pt.fs);
      pt.linhas.forEach(ln => {
        const w = temMarcas(ln.t) ? larguraComNiveis(doc, ln.t, pt.fs)
                                  : doc.getTextWidth(semMarcas(ln.t));
        if(w + (ln.dx || 0) > larg + 0.6)
          avisos.push("questão " + n + ": linha do " + pt.tipo +
                      " passa da largura da coluna");
      });
    });
    if(m.fig && m.fig.w > larg + 0.6)
      avisos.push("questão " + n + ": a figura é mais larga que a coluna");
    if(q.imagem && !m.fig)
      avisos.push("questão " + n + ": tem imagem no arquivo e nenhuma foi medida");
  });

  /* ── CABEÇALHO SAEPE ── */
  if(cfg.simulado){
    if(!String(cfg.disciplina || "").trim())
      avisos.push("cabeçalho: os componentes do simulado não aparecem");
    if(!String(cfg.escola || "").trim())
      avisos.push("cabeçalho: a instituição não aparece");
  }

  /* ── EQUILÍBRIO POR DESCRITOR ──
     Com n questões e k descritores, o certo é n÷k de cada, com a sobra
     distribuída — nunca mais de uma questão de diferença entre o
     descritor mais e o menos representado. A escolha dos itens já
     equilibra o que dá; se ainda assim sobrar diferença, ela veio do
     ARQUIVO (um descritor com poucas questões disponíveis), e é o
     professor quem precisa saber. */
  if(cfg.desc && cfg.desc.length === nq){
    const porComp = {};
    for(let i = 0; i < nq; i++){
      const c = (cfg.comps && cfg.comps[i]) || "geral";
      const d = String(cfg.desc[i] || "").trim() || "(sem descritor)";
      porComp[c] = porComp[c] || {};
      porComp[c][d] = (porComp[c][d] || 0) + 1;
    }
    Object.keys(porComp).forEach(c => {
      const contas = Object.keys(porComp[c]).map(d => porComp[c][d]);
      if(contas.length < 2) return;
      const maior = Math.max.apply(null, contas), menor = Math.min.apply(null, contas);
      if(maior - menor <= 1) return;
      const nome = (cfg.rotulosComp && cfg.rotulosComp[c]) || c;
      const detalhe = Object.keys(porComp[c]).sort()
        .map(d => d + ": " + porComp[c][d]).join(", ");
      avisos.push(nome + ": os descritores estão desequilibrados (" + detalhe +
                  ") — o arquivo não tem questões suficientes de algum deles");
    });
    if(cfg.desc.some(d => !String(d || "").trim()))
      avisos.push("há questões sem descritor — elas ficam de fora da análise " +
                  "por habilidade");
  }
  return avisos;
}
function gerarProvas(cfgEntrada, alunos, jsPDFctor){
  let cfg = cfgEntrada;
  const Ctor = jsPDFctor || (window.jspdf && window.jspdf.jsPDF);
  const doc = new Ctor({unit: "mm", format: "a4", compress: true});
  prepararFontes(doc);
  /* o simulado já nasce apertado; a avaliação comum começa folgada e só
     aperta se a busca por tiragem pareja precisar */
  DENSO = !!cfg.simulado || !!cfg.denso;

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
  const fundo = fundoUtil(molde);      // a MESMA mancha que `fluir` desenha
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
  /* ── nivelar por BAIXO: letra, ordem e espaçamento juntos ────────
     Levar todo mundo para o pior caso e tapar a diferença com uma folha
     de rascunho é honesto e burro. Se a prova de um estudante coube em
     duas páginas, a diferença para o colega que precisou de três é de
     EMPACOTAMENTO, não de conteúdo: o texto é o mesmo, muda só a ordem.

     São TRÊS alavancas, e o erro da v50 e da v60 foi tentar uma de cada
     vez:

     1. a LETRA — descer um degrau na escada;
     2. a ORDEM — trocar o tempero e reembaralhar todos os cadernos;
     3. o ESPAÇAMENTO — o modo denso, que o simulado já usava e a
        avaliação comum não.

     Isoladas, cada uma falha em casos que a combinação resolve: com uma
     figura de 50 mm no meio do caderno, reduzir o corpo não ajuda (a
     figura não encolhe) e reembaralhar no corpo grande também não (ela
     não cabe em posição nenhuma) — mas corpo menor MAIS outra ordem cabe.

     A busca varre as combinações preferindo, nesta ordem: menos páginas,
     letra maior, espaçamento folgado, tempero menor. Para na primeira que
     alcança o alvo, e o alvo é o melhor caso da turma — se alguém coube
     em duas, ninguém deveria precisar de três. */
  const escada = cfg.simulado ? CORPOS_SAEPE : CORPOS.concat(CORPOS_APERTO);
  const temperoBase = cfg.tempero || 0;
  const corpo0 = escolha.fs, densoOriginal = DENSO;
  const cacheH = {};
  const medirTurma = (fs, temp, denso) => {
    DENSO = denso;
    const chave = fs + "|" + (denso ? 1 : 0);
    if(!cacheH[chave]) cacheH[chave] = alturasCanonicas(molde, cfg, fs);
    const c = (temp === temperoBase && denso === densoOriginal)
      ? cfg : Object.assign({}, cfg, {tempero: temp});
    const r = paginasDaTurma(molde, c, alunos, fs, topoPrimeira, fundo, cacheH[chave]);
    DENSO = densoOriginal;
    return r;
  };

  const inicial = medirTurma(corpo0, temperoBase, densoOriginal);
  const alvo = inicial.melhor;
  let achado = {fs: corpo0, tempero: temperoBase, denso: densoOriginal,
                pgs: inicial.pior};

  if(inicial.pior > inicial.melhor){
    const modos = cfg.simulado ? [true] : [false, true];
    const nTemperos = cfg.permitirTempero ? TEMPEROS : 0;
    busca:
    for(const fs of escada){
      if(fs > corpo0) continue;                    // a letra nunca aumenta
      for(const denso of modos){
        for(let t = temperoBase; t <= temperoBase + nTemperos; t++){
          const e = medirTurma(fs, t, denso);
          if(e.pior < achado.pgs) achado = {fs, tempero: t, denso, pgs: e.pior};
          if(e.pior <= alvo){ achado = {fs, tempero: t, denso, pgs: e.pior}; break busca; }
        }
      }
    }
  }

  if(achado.fs !== corpo0)
    doc.baixouCorpo = {de: corpo0, para: achado.fs,
                       dePaginas: inicial.pior, paraPaginas: achado.pgs};
  if(achado.tempero !== temperoBase)
    doc.reembaralhou = {tempero: achado.tempero, de: inicial.pior, para: achado.pgs};
  if(achado.denso !== densoOriginal)
    doc.apertouEspaco = {de: inicial.pior, para: achado.pgs};

  DENSO = achado.denso;
  escolha = {fs: achado.fs, pgs: achado.pgs};
  doc.temperoUsado = achado.tempero;
  doc.densoUsado = achado.denso;
  cfg = (achado.tempero === temperoBase) ? cfg
      : Object.assign({}, cfg, {tempero: achado.tempero});

  const corpo = escolha.fs;
  doc.corpoUsado = corpo;
  doc.paginasPorAluno = escolha.pgs;
  doc.corpoPreferido = corpo0;
  if(escolha.pgs > teto) doc.avisoPaginas = escolha.pgs;

  /* PRE_FLIGHT_CHECK: com o corpo já escolhido, confere a diagramação
     antes de desenhar. O que dá para corrigir sozinho já foi corrigido
     na medição; o que resta vira aviso na tela. */
  try{ doc.preFlight = preFlightCheck(cfg, molde, corpo); }
  catch(e){ doc.preFlight = ["a conferência automática falhou: " + e.message]; }

  /* ── tiragem pareja ──────────────────────────────────────────────
     TODO estudante recebe o mesmo número de folhas. A ordem das questões
     muda de estudante para estudante (é ela que impede a cola) e o
     encaixe nas colunas muda junto — sem isto, um recebe duas páginas e
     o vizinho três. Prova de tamanhos diferentes é ruim para grampear,
     para conferir na hora de entregar e para o estudante, que percebe
     que a folha do colega é outra.

     Até a v48 isto valia só para o simulado. Vale para a avaliação
     comum também: foi ela que apareceu com dois e três páginas na mesma
     turma.

     O alvo é conferido em seco ANTES de desenhar, e não confiado à
     previsão: `paginasNoPior` é uma estimativa muito boa, mas a garantia
     tem de ser exata. E entra `escolha.pgs` no máximo porque ele já
     carrega o pior caso da SÉRIE inteira (v45) — assim a turma A e a
     turma B saem com a mesma tiragem, não só os colegas de sala.

     A folha que sobra vira rascunho, que numa prova longa é útil. */
  const previsto = alunos.map(aluno => fluir(doc, cfg, aluno, corpo, true));
  doc.paginasSemNivelar = previsto;      // quantas cada um teria sem o nivelamento
  const alvoPag = Math.max.apply(null, [escolha.pgs].concat(previsto));
  doc.paginasDeCada = alunos.map((aluno, idx) => {
    if(idx) doc.addPage();
    let pgs = fluir(doc, cfg, aluno, corpo, false, alvoPag);
    while(pgs < alvoPag){
      doc.addPage();
      pgs++;
      /* a folha de rascunho também leva moldura e nome: solta do grampo,
         ela precisa se identificar como as outras */
      molduraDaPagina(doc, cfg, aluno, pgs, alvoPag, TOPO, TOPO - 4);
      paginaDeRascunho(doc);
    }
    return pgs;
  });
  if(doc.paginasDeCada.length){
    const pior = Math.max.apply(null, doc.paginasDeCada);
    doc.paginasPorAluno = pior;
    doc.paginasMinimas = Math.min.apply(null, doc.paginasDeCada);
    /* se isto disparar, a tiragem saiu desigual e o professor precisa
       saber ANTES de imprimir */
    doc.tiragemPareja = (doc.paginasMinimas === pior);
    doc.avisoPaginas = pior > teto ? pior : 0;
  }
  DENSO = false;               // não vaza para a próxima geração
  return doc;
}

if(typeof module !== "undefined") module.exports =
  {desenharCartao, gerarProvas, gabaritoIndividual, montarPayload, encurtarNome, nomeCurtoQR, soAscii,
   pedacosDeNivel, remarcar, semMarcas, temMarcas, medidasQuestao, desenharQuestaoCol, prepararFontes, medirFigura,
   segmentarEnunciado, classificarCorpo, pareceFormula, unidadesQuestao, melhorCorte,
   grupoColado, empacotar, distribuirPagina, encherColuna, molduraDaPagina, fundoUtil, RODAPE, unidadesNaOrdem, paginasDaTurma, paginasNoPior, preFlightCheck, alternativasNaFigura, indicesFixos, ordemDaProva, paresDeOrdem, chavesDaTurma, charsDeNivel, cabecalho, larguraComNiveis,
   AR_QUESTAO, REGRA_GABARITO, alturaFaixaCabecalho, comTempero, TEMPEROS};
