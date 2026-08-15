/* cartao-sintetico.js — desenha um cartão-resposta em pixels, direto,
   a partir da MESMA geometria que o gerador usa (montarLayout) e do
   MESMO payload que o gerador grava no QR (montarPayload).

   Serve para as suítes de câmera: em vez de rasterizar o PDF (que exige
   pdf.js e não roda igual em Node), o cartão é desenhado com as
   coordenadas oficiais. Se o scanner errar aqui, ele erra no papel —
   a geometria é a mesma de onde vem o desenho impresso.
   Não faz parte do app publicado. */
"use strict";
const path = require("path");
const { montarLayout } = require(path.join(__dirname, "layout.js"));
const qrcode = require(path.join(__dirname, "qrcode.min.js"));

/* tela de cinza simples, 1 byte por pixel, depois expandida para RGBA */
function tela(w, h){
  const g = new Uint8ClampedArray(w*h).fill(255);
  return {
    w, h, g,
    ret(x0, y0, ww, hh, cor){
      const xa = Math.max(0, Math.round(x0)), ya = Math.max(0, Math.round(y0));
      const xb = Math.min(w, Math.round(x0+ww)), yb = Math.min(h, Math.round(y0+hh));
      for(let y=ya; y<yb; y++) for(let x=xa; x<xb; x++) g[y*w+x] = cor;
    },
    disco(cx, cy, r, cor){
      const xa=Math.max(0,Math.floor(cx-r)), xb=Math.min(w,Math.ceil(cx+r));
      const ya=Math.max(0,Math.floor(cy-r)), yb=Math.min(h,Math.ceil(cy+r));
      for(let y=ya;y<yb;y++) for(let x=xa;x<xb;x++){
        const dx=x-cx+0.5, dy=y-cy+0.5;
        if(dx*dx+dy*dy <= r*r) g[y*w+x] = cor;
      }
    },
    anel(cx, cy, r, esp, cor){
      const re=r+esp/2, ri=r-esp/2;
      const xa=Math.max(0,Math.floor(cx-re)), xb=Math.min(w,Math.ceil(cx+re));
      const ya=Math.max(0,Math.floor(cy-re)), yb=Math.min(h,Math.ceil(cy+re));
      for(let y=ya;y<yb;y++) for(let x=xa;x<xb;x++){
        const dx=x-cx+0.5, dy=y-cy+0.5, d2=dx*dx+dy*dy;
        if(d2<=re*re && d2>=ri*ri) g[y*w+x] = cor;
      }
    },
    imageData(){
      const data = new Uint8ClampedArray(w*h*4);
      for(let i=0;i<w*h;i++){ const o=i*4; data[o]=data[o+1]=data[o+2]=g[i]; data[o+3]=255; }
      return { data, width:w, height:h };
    }
  };
}

/* gabInd = string com a letra MARCADA em cada questão (null = em branco) */
function desenhar(opc){
  const nq = opc.nq, no = opc.no || 5;
  const L = montarLayout(nq, no);
  const esc = opc.escala || 7;                    // pixels por mm
  const margem = opc.margem != null ? opc.margem : 26;
  const W = Math.round(L.box_w*esc + 2*margem);
  const Hh = Math.round(L.box_h*esc + 2*margem);
  const T = tela(W, Hh);
  const mx = m => margem + m*esc;

  // fiduciais: quadrados pretos centrados nos quatro cantos da caixa
  const fid = L.fid_size*esc;
  [[0,0],[L.box_w,0],[L.box_w,L.box_h],[0,L.box_h]].forEach(([a,b])=>{
    T.ret(mx(a)-fid/2, mx(b)-fid/2, fid, fid, 0);
  });

  // QR
  if(opc.payload){
    const q = qrcode(0, "M"); q.addData(opc.payload); q.make();
    const n = q.getModuleCount(), passo = L.qr.size*esc/n;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++)
      if(q.isDark(i,j)) T.ret(mx(L.qr.x)+j*passo, mx(L.qr.y)+i*passo, passo*1.02, passo*1.02, 0);
  }

  // bolhas
  const r = L.bubble_r*esc;
  L.groups.forEach(g=>{
    g.questions.forEach((qn,i)=>{
      const y = mx(L.row_y[i]);
      L.options.forEach((letra,k)=>{
        const x = mx(g.first_bubble_x + k*L.bubble_dx);
        const marcada = opc.marcadas && opc.marcadas[qn-1] === letra;
        if(marcada) T.disco(x, y, r*0.92, 15);
        else T.anel(x, y, r, Math.max(1, esc*0.25), 110);
      });
    });
  });
  return T;
}

module.exports = { desenhar, tela };
