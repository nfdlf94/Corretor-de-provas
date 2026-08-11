/* layout.js — espelho exato de layout.py
   Permite ao scanner reconstruir a geometria do cartão a partir de
   (nq, no), sem depender de nenhum arquivo externo.
   ALTERAR AQUI EXIGE ALTERAR layout.py. */
"use strict";

const LAY_VERSION = 3;

/* Dois perfis. O clássico é o de sempre e vale até 20 questões — as
   provas já impressas dependem dele (10x5 continua 164 x 52 mm). Acima
   disso entra o compacto, de três colunas: um caderno de simulado com
   26 a 30 itens no perfil antigo ocupava quase metade da página. */
const PERFIS = {
  classico: {
    PASSO_Y: 9.0, PASSO_X: 9.0, RAIO: 2.6, FID: 10.0, QUIET: 7.0,
    QR_X: 4.0, QR_Y: 11.0, QR_S: 30.0,
    Y0: 12.0, LABEL_X0: 46.0, LABEL_GAP: 10.0,
    MARGEM_DIR: 14.0, FOLGA_COL: 22.0,
    colunas: nq => (nq <= 6 ? 1 : 2)
  },
  compacto: {
    PASSO_Y: 5.6, PASSO_X: 5.6, RAIO: 1.9, FID: 8.5, QUIET: 5.0,
    QR_X: 3.0, QR_Y: 7.0, QR_S: 26.0,
    Y0: 9.0, LABEL_X0: 34.0, LABEL_GAP: 6.5,
    MARGEM_DIR: 6.0, FOLGA_COL: 12.0,
    colunas: nq => 3
  }
};
const LIMITE_CLASSICO = 20;
const perfilDe = nq => (nq > LIMITE_CLASSICO ? PERFIS.compacto : PERFIS.classico);

const LETRAS = ["A", "B", "C", "D", "E"];
const MIN_Q = 5, MAX_Q = 30;

function colunasDe(nq){ return perfilDe(nq).colunas(nq); }

function montarLayout(nq, no){
  nq = parseInt(nq, 10); no = parseInt(no, 10);
  if (!(nq >= MIN_Q && nq <= MAX_Q)) throw new Error("nq fora de 5..30");
  if (no !== 4 && no !== 5) throw new Error("no deve ser 4 ou 5");

  const P = perfilDe(nq);
  const ncols = P.colunas(nq);
  const nlin = Math.ceil(nq / ncols);
  const passoCol = (no - 1) * P.PASSO_X + P.FOLGA_COL;

  const box_w = P.LABEL_X0 + (ncols - 1) * passoCol
              + P.LABEL_GAP + (no - 1) * P.PASSO_X + P.MARGEM_DIR;
  const row_y = Array.from({length: nlin}, (_, i) => P.Y0 + i * P.PASSO_Y);
  const box_h = Math.max(row_y[nlin - 1] + 4.0, P.QR_Y + P.QR_S + 4.0);

  const groups = [];
  let n = 1;
  for (let c = 0; c < ncols; c++){
    const qs = [];
    for (let i = 0; i < nlin && n <= nq; i++) qs.push(n++);
    if (qs.length) groups.push({
      label_x: P.LABEL_X0 + c * passoCol,
      first_bubble_x: P.LABEL_X0 + c * passoCol + P.LABEL_GAP,
      questions: qs
    });
  }
  return {version: LAY_VERSION, n_questions: nq, n_options: no,
          options: LETRAS.slice(0, no), box_w, box_h, fid_size: P.FID,
          quiet_zone: P.QUIET, bubble_r: P.RAIO, bubble_dx: P.PASSO_X,
          label_gap: P.LABEL_GAP, compacto: P === PERFIS.compacto,
          row_y, qr: {x: P.QR_X, y: P.QR_Y, size: P.QR_S}, groups};
}

/* Layout normalizado 0..1 — formato que o motor de visão já consome hoje. */
function layoutNormalizado(nq, no){
  const L = montarLayout(nq, no), W = L.box_w, H = L.box_h;
  const bubbles = {};
  L.groups.forEach(g => g.questions.forEach((q, i) => {
    bubbles[q] = Array.from({length: L.n_options},
      (_, k) => [(g.first_bubble_x + k * L.bubble_dx) / W, L.row_y[i] / H]);
  }));
  return {version: L.version, n_questions: nq, n_options: no,
    options: L.options, aspect: W / H, bubble_r: L.bubble_r / W,
    qr: {x0: L.qr.x / W, y0: L.qr.y / H,
         x1: (L.qr.x + L.qr.size) / W, y1: (L.qr.y + L.qr.size) / H},
    bubbles};
}

const assinaturaLayout = (nq, no) => nq + "x" + no;

function lerAssinatura(s){
  const m = /^(\d+)x(\d)$/.exec(String(s || "").trim());
  return m ? {nq: +m[1], no: +m[2]} : null;
}

if (typeof module !== "undefined") module.exports =
  {montarLayout, layoutNormalizado, assinaturaLayout, lerAssinatura, LAY_VERSION};
