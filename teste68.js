/* teste68.js — a versão do app tem de ser visível e estar sincronizada.

   `VERSAO_APP` era referenciada na planilha de gabaritos e NUNCA foi
   declarada. A planilha saía com "—" e nem o professor nem eu tínhamos
   como saber qual versão estava rodando.

   Num app que vive em cache de service worker isso não é detalhe. Depois
   de várias entregas seguidas, a pergunta "não atualizou?" não tinha como
   ser respondida: o app não dizia quem era. Metade da dúvida morre com um
   número na tela.

   Este teste guarda três coisas:
   1. a versão existe e está na tela;
   2. ela CASA com a do sw.js — se divergirem, o cache é invalidado por
      um número e a tela mostra outro;
   3. existe um jeito de forçar a atualização sem reinstalar o app. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(3) });

setTimeout(() => {
  console.log("teste68 — versão do app visível e sincronizada");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const indexTxt = fs.readFileSync(__dirname + "/index.html", "utf8");
  const swTxt = fs.readFileSync(__dirname + "/sw.js", "utf8");

  /* ── 1. declarada ── */
  const noApp = win.eval("typeof VERSAO_APP!=='undefined' ? VERSAO_APP : null");
  ok(noApp, "VERSAO_APP está declarada (" + noApp + ")");
  ok(/^v\d+$/.test(String(noApp)),
     "no formato vNN, o mesmo do histórico do projeto");

  /* ── 2. sincronizada com o service worker ── */
  const mSw = /const VERSAO\s*=\s*"([^"]+)"/.exec(swTxt);
  ok(mSw, "o sw.js declara VERSAO");
  ok(mSw && mSw[1] === noApp,
     "e é a MESMA do app (sw: " + (mSw?mSw[1]:"-") + " · app: " + noApp + ") — " +
     "divergir significa invalidar o cache por um número e mostrar outro " +
     "na tela");

  /* ── 3. aparece para o professor ── */
  ok(/Versão do app/.test(indexTxt),
     "a tela de Configurações mostra a versão");
  ok(/Buscar atualização/.test(indexTxt),
     "e oferece \"Buscar atualização\" — sem isso, a única saída é " +
     "desinstalar o app");
  ok(/getRegistrations|registration\.update|\.update\(\)/.test(indexTxt),
     "o botão fala com o service worker de verdade, não só recarrega");

  /* ── 4. o consumidor que estava quebrado ── */
  /* a planilha de gabaritos por estudante escrevia "—" na aba de
     identificação porque a variável não existia */
  const abas = JSON.parse(win.eval(`JSON.stringify((function(){
    var p=E.provas[0]; if(!p) return null;
    var t=turmaDe(p.turma);
    return abasGabaritoPorEstudante(p,t);
  })())`));
  if(abas){
    const txt = JSON.stringify(abas);
    ok(txt.indexOf(noApp) >= 0,
       "e a planilha de gabaritos agora sai carimbada com a versão (" +
       noApp + "), não com \"—\"");
  }else{
    ok(true, "(sem prova no estado base para conferir a planilha)");
  }

  console.log(falhas ? "\nteste68: " + falhas + " FALHA(S)" : "\nteste68: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
