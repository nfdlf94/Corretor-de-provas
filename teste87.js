/* teste87.js — falha de gravação nunca mais é silenciosa.

   Depois do primeiro aviso de "armazenamento cheio" o app seguia falhando
   em silêncio pelo resto da sessão (`avisouEspaco` só alertava uma vez), e
   o app instalado na tela inicial fica aberto em segundo plano por dias.
   O trabalho ficava só na memória e sumia ao fechar. Agora há uma faixa
   vermelha fixa até uma gravação dar certo, e o alerta volta a cada 2 min. */
"use strict";
const H = require("./harness");
let falhas = 0;
const ok = (c, m) => { console.log((c ? "  ok   " : "  FALHA") + "  " + m); if(!c) falhas++; };
const { win } = H.abrirApp({ estado: H.estadoBase(4) });
setTimeout(() => {
  console.log("teste87 — aviso permanente de gravação");
  const doc = win.document;
  const r = JSON.parse(win.eval(`JSON.stringify((function(){
    var proto=Object.getPrototypeOf(window.localStorage), real=proto.setItem, cheio=true;
    proto.setItem=function(k,v){ if(cheio && k==="dbm_omr_v8") throw new Error("Quota"); return real.call(this,k,v); };
    window.__alertas=[]; avisouEspaco=false; ultimoAvisoEspaco=0;
    var o={};
    o.r1=salvar(); o.faixa1=!!document.getElementById("faixaSemSalvar"); o.alertas1=window.__alertas.length;
    o.r2=salvar(); o.alertas2=window.__alertas.length;                 // dentro dos 2 min: sem novo alerta
    ultimoAvisoEspaco=Date.now()-130000;
    o.r3=salvar(); o.alertas3=window.__alertas.length;                 // passou de 2 min: alerta de novo
    o.faixaAinda=!!document.getElementById("faixaSemSalvar");
    o.textoAlerta=window.__alertas[0]||"";
    cheio=false;
    o.r4=salvar(); o.faixa4=!!document.getElementById("faixaSemSalvar");
    proto.setItem=real; return o; })())`));
  ok(r.r1 === false && r.faixa1, "gravação que não cabe: devolve falso e mostra a faixa vermelha");
  ok(r.alertas1 === 1 && r.alertas2 === 1, "o alerta aparece uma vez e não repete a cada gravação");
  ok(r.alertas3 === 2 && r.faixaAinda, "depois de 2 minutos o alerta VOLTA, e a faixa continua");
  ok(/Baixar cópia agora/.test(r.textoAlerta), "o alerta diz o que fazer (baixar a cópia)");
  ok(r.r4 === true && !r.faixa4, "quando uma gravação dá certo, a faixa some");
  console.log(falhas ? "\nteste87: " + falhas + " FALHA(S)" : "\nteste87: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 800);
