/* teste30.js — o QR do cartão de simulado precisa ser LEGÍVEL na câmera,
   não só correto. O que decide isso é o número de PIXELS POR MÓDULO no
   quadro. Um caderno de simulado tem código longo ("3ANOA-SAEPE-26"),
   gabarito longo e o nome do estudante: o payload chegava a 81 bytes e
   37 módulos em 30 mm. Com o cartão deitado (164 x 79 mm) numa tela de
   celular em pé, o professor precisa afastar para caber tudo — e nesse
   enquadramento os 37 módulos ficavam com ~3 px cada, abaixo do que o
   decodificador aguenta. Era o "QR ilegível" das fotos.

   Esta suíte fixa o enquadramento em px/mm e exige que o cartão seja
   lido nele. */
"use strict";
const H = require("./harness");
const { desenhar } = require("./cartao-sintetico");
const qrcode = require("./qrcode.min.js");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

/* o caso das fotos: 3º Ano A, 16 questões (8 + 8), código do simulado */
function estado(){
  const E = H.estadoBase(30);
  E.turmas[0].nome = "3º Ano A";
  E.turmas[0].alunos[6].nome = "BRUNA LORENA LOPES ALMEIDA";
  H.comSimulado(E, { id:"sim1", nLP:8, nMAT:8, codigo:"3ANOA-SAEPE-26",
                     titulo:"1º Simulado SAEPE", ano:2026 });
  E.ativa = "psim1";
  return E;
}

const est = estado();
const caderno = est.provas.find(p => p.id === "psim1");
const { win } = H.abrirApp({ estado: est });
const ev = s => win.eval(s);

const modulos = (p, ec) => { const q = qrcode(0, ec||"L"); q.addData(p); q.make(); return q.getModuleCount(); };

setTimeout(() => {
  console.log("teste30 — legibilidade do QR do cartão de simulado");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");
  ok(caderno.nq === 16, "o caderno das fotos tem 16 questões");

  const nome = "BRUNA LORENA LOPES ALMEIDA";
  const gabInd = win.gabaritoIndividual(caderno.gabC, "3º Ano A", "07", 5, caderno.comps, true);
  const payload = win.montarPayload(caderno.codigo, gabInd, "3º Ano A", "07", nome, 5);

  /* 1. o payload encolheu */
  const bytes = Buffer.byteLength(payload, "utf8");
  ok(bytes <= 64, "payload com " + bytes + " bytes (era 81 com o nome inteiro)");
  const mods = modulos(payload);
  ok(mods <= 33, "QR com " + mods + " módulos (eram 37)");
  ok(30 / mods >= 0.90, "cada módulo tem " + (30/mods).toFixed(2) + " mm (eram 0,81)");

  /* 2. turma e número continuam no QR — são eles que identificam */
  const t = payload.split("|");
  ok(t[3] === "3o Ano A", "a turma vai em ASCII no QR: " + JSON.stringify(t[3]));
  ok(!/[^\x20-\x7E]/.test(payload), "o payload inteiro é ASCII — jsQR zera com qualquer outro byte");
  ok(t[4] === "07", "o número vai inteiro no QR");
  ok(t[5] === "BRUNA A", "o nome vai abreviado: " + JSON.stringify(t[5]));
  ok(t[2] === gabInd && t[2].length === 16, "o gabarito individual vai inteiro");

  /* 3. o nome CHEIO volta da lista da turma, não do QR */
  const marcadas = gabInd.split("");
  const enquadrar = pxmm => {
    win.__img = desenhar({ nq:16, no:5, payload, marcadas, escala: pxmm }).imageData();
    ev('alunoQR=null; travado=null; atual=null; hist=[]; semQR=0;');
    ev("(function(){ for(var i=0;i<6;i++) analisar(window.__img,false); })()");
  };

  /* 4 px/mm ≈ o enquadramento das fotos: cartão deitado, tela em pé */
  enquadrar(4);
  ok(ev("!!alunoQR"), "o QR foi lido no enquadramento das fotos (4 px/mm)");
  ok(ev("alunoQR && alunoQR.numero") === "07", "identificou o nº 07");
  ok(ev("alunoQR && alunoQR.nome") === nome,
     "o nome COMPLETO veio da lista da turma: " + ev("alunoQR && alunoQR.nome"));

  const R = JSON.parse(ev("JSON.stringify(atual? atual.R : null)"));
  ok(R && R.length === 16, "leu as 16 respostas");
  ok(R && R.every((x,i) => x === marcadas[i]), "as 16 marcações foram lidas certas");

  /* 4. e continua lendo quando o professor chega mais perto */
  [6, 9].forEach(px => {
    enquadrar(px);
    ok(ev("!!alunoQR"), "lê também a " + px + " px/mm");
  });

  /* 5. o cartão de um estudante que NÃO está na lista ainda entra pelo
        nome abreviado do QR — é para isso que ele continua lá */
  const pay2 = win.montarPayload(caderno.codigo, gabInd, "3º Ano A", "99", "NOVO ALUNO", 5);
  win.__img = desenhar({ nq:16, no:5, payload:pay2, marcadas, escala:6 }).imageData();
  ev('alunoQR=null; travado=null; atual=null; hist=[]; semQR=0;');
  ev("(function(){ for(var i=0;i<6;i++) analisar(window.__img,false); })()");
  ok(ev("alunoQR && alunoQR.numero") === "99", "cartão de estudante novo foi lido");
  ok(ev("alunoQR && alunoQR.nome") === "NOVO A", "usou o nome do QR para quem não está na lista");
  ok(ev('(turmaDe("t1").alunos||[]).some(a=>a.numero==="99")'), "e cadastrou o estudante na turma");

  /* 6. cartões antigos, com o nome inteiro, continuam sendo aceitos: o
        FORMATO do payload não mudou, só o conteúdo encolheu. (Os cartões
        antigos de turma com acento nunca funcionaram — é o bug que esta
        versão corrige —, então o caso de compatibilidade é o ASCII.) */
  const antigo = "DBM4|3ANOA-SAEPE-26|" + gabInd + "|3o Ano A|07|BRUNA LORENA LOPES ALMEIDA|16x5";
  win.__img = desenhar({ nq:16, no:5, payload:antigo, marcadas, escala:9 }).imageData();
  ev('alunoQR=null; travado=null; atual=null; hist=[]; semQR=0;');
  ev("(function(){ for(var i=0;i<6;i++) analisar(window.__img,false); })()");
  ok(ev("!!alunoQR"), "cartão impresso pela versão antiga continua sendo lido");
  ok(ev("alunoQR && alunoQR.gab") === gabInd, "e o gabarito individual dele confere");

  /* 7. a câmera passou a pedir mais resolução */
  const html = require("fs").readFileSync("index.html", "utf8");
  ok(/width:\{ideal:1920\}/.test(html), "a câmera pede 1920 de largura (eram 1280)");

  /* 8. a varredura que achou o bug: qualquer byte fora do ASCII zera o
        QR. Turma "3º Ano A", estudante GONÇALO, JOÃO, SÁ — todos comuns
        numa escola brasileira. */
  const perigosos = [["3º Ano A","JOAO S"], ["3A","GONÇALO"], ["3ª série","JOÃO S"],
                     ["3º A","SÁ P"], ["Turma Ação","MARIA J"]];
  let quebrou = [];
  perigosos.forEach(([turma, nome]) => {
    const pay = win.montarPayload(caderno.codigo, gabInd, turma, "07", nome, 5);
    if (/[^\x20-\x7E]/.test(pay)){ quebrou.push(turma+"/"+nome+" (payload não-ASCII)"); return; }
    win.__img = desenhar({ nq:16, no:5, payload:pay, marcadas, escala:7 }).imageData();
    ev('alunoQR=null; travado=null; atual=null; hist=[]; semQR=0;');
    ev("(function(){ for(var i=0;i<6;i++) analisar(window.__img,false); })()");
    if (!ev("!!alunoQR")) quebrou.push(turma + " / " + nome);
  });
  ok(quebrou.length === 0, "turmas e nomes com acento, ç, º e ª são lidos" +
     (quebrou.length ? " — falharam: " + quebrou.join("; ") : ""));

  console.log(falhas ? "\nteste30: " + falhas + " FALHA(S)" : "\nteste30: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
