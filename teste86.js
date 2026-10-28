/* teste86.js — o cartão tem de achar o caderno, e cartões já soltos têm
   de poder voltar para ele.

   Relato do professor: o simulado novo foi corrigido, o app contava os
   acertos, mas nível, habilidade, desempenho individual e nota de
   participação não saíam — "como se o arquivo original da prova tivesse
   sumido e ficou apenas o gabarito do estudante".

   Era isso mesmo. O QR leva o CÓDIGO da prova, passado por `soAscii`
   ("4º SIMULADO" vira "4o SIMULADO"), e `aplicarQR` comparava ao pé da
   letra. Sem casar, o app criava uma prova FANTASMA, só com o gabarito
   do QR: sem componentes, descritores, níveis. Segundo furo: o código
   padrão é igual para todos os simulados da turma no ano, e o `find`
   devolvia o mais ANTIGO. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

function montar(codigo, extra){
  const E = H.comSimulado(H.estadoBase(4), {});
  E.provas[0].codigo = codigo;
  if (extra) extra(E);
  return { E, ...H.abrirApp({ estado: E }) };
}
const J = (win, js) => JSON.parse(win.eval("JSON.stringify(" + js + ")"));
const payloadDe = (win, codigo, gab, numero) => win.eval(
  "montarPayload(" + JSON.stringify(codigo) + "," + JSON.stringify(gab) +
  ',"3A",' + JSON.stringify(numero) + ',"Estudante ' + numero + '",5)');

setTimeout(() => {
  console.log("teste86 — cartão → caderno");

  /* ── 1. código com º: antes criava fantasma ── */
  {
    const { E, win } = montar("4º SIMULADO");
    ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");
    const gab = E.provas[0].gabC;
    win.eval("aplicarQR(" + JSON.stringify(payloadDe(win, "4º SIMULADO", gab, "01")) + ")");
    const r = J(win, "({provas:E.provas.length, ativa:E.ativa, comps:(provaAtiva().comps||[]).length})");
    ok(r.provas === 1, "código com “º”: nenhuma prova nova é criada (" + r.provas + ")");
    ok(r.ativa === "psim1" && r.comps === 12,
       "e o cartão cai no caderno do simulado, com seus 12 componentes");
  }

  /* ── 2. acento, ç e minúsculas ── */
  for (const cod of ["SIMULADO ÚNICO", "AVALIAÇÃO 3", "sim-1"]) {
    const { E, win } = montar(cod);
    win.eval("aplicarQR(" + JSON.stringify(payloadDe(win, cod, E.provas[0].gabC, "01")) + ")");
    ok(win.eval("E.provas.length") === 1 && win.eval("E.ativa") === "psim1",
       "código “" + cod + "” casa com o caderno");
  }

  /* ── 3. dois simulados, mesmo código e tamanho: vale o aberto; sem aberto, o mais novo ── */
  {
    const { E, win } = montar("3A-SAEPE-26", E => {
      const velho = JSON.parse(JSON.stringify(E.provas[0]));
      velho.id = "pVELHO"; velho.simulado = "simVELHO"; velho.criada = 1;
      E.provas.unshift(velho);
      E.simulados.push({ ...E.simulados[0], id: "simVELHO", prova: "pVELHO",
        titulo: "1º Simulado SAEPE", criado: 1 });
      E.provas[1].criada = 999;
    });
    const gab = E.provas[1].gabC;
    const pl = payloadDe(win, "3A-SAEPE-26", gab, "01");
    win.eval("E.ativa=null; aplicarQR(" + JSON.stringify(pl) + ")");
    ok(win.eval("E.ativa") === "psim1",
       "sem prova aberta: o simulado MAIS NOVO, não o mais antigo");
    win.eval("E.ativa='pVELHO'; aplicarQR(" + JSON.stringify(pl) + ")");
    ok(win.eval("E.ativa") === "pVELHO",
       "com um deles aberto para corrigir: vale o aberto");
  }

  /* ── 4. código novo nunca repete na turma ── */
  {
    const { win } = montar("3A-SAEPE-26");
    const cods = J(win, `(function(){
      var t=turmaDe("t1"), out=[];
      for(var i=0;i<3;i++){ var sm=criarSimulado(t); out.push(provaDoSim(sm).codigo); }
      return out; })()`);
    ok(new Set(cods).size === 3 && cods.every(c => c.length <= 16 && c !== "3A-SAEPE-26"),
       "três simulados novos, três códigos diferentes: " + cods.join(", "));
  }

  /* ── 5. o fantasma antigo (sem marca) é reconhecido e reconectado ── */
  {
    const { E, win } = montar("4º SIMULADO");
    /* o que a versão anterior deixava: prova sem simulado/comps, só com
       gabC e cartões — mas os cartões vêm de folhas impressas com a ordem
       do CADERNO REAL (`pr`), que é o que o QR carrega */
    const resultado = J(win, `(function(){
      var pr=E.provas[0], t=turmaDe("t1");
      var f={id:"pFANT",turma:"t1",disciplina:"d1",codigo:"4o SIMULADO",titulo:"",
        nq:pr.nq,no:5,gabC:pr.gabC,habs:[],criada:5};
      E.provas.push(f);
      /* cartões de dois alunos, corrigidos pelo caminho normal dentro do fantasma */
      E.ativa="pFANT";
      [["01",0],["02",3]].forEach(function(par){
        var num=par[0], erros=par[1];
        var o=ordemDe(pr,t.nome,num), letras=["A","B","C","D","E"], R=[];
        for(var i=0;i<f.nq;i++){
          var certa=letras.indexOf(pr.gabC[o.oq[i]]);
          R.push(letras[o.oa[i].indexOf(certa)]);
        }
        for(var e=0;e<erros;e++) R[e]= R[e]==="A"?"B":"A";
        var gab=""; for(var j=0;j<f.nq;j++){ gab+=letras[o.oa[j].indexOf(letras.indexOf(pr.gabC[o.oq[j]]))]; }
        registrar({numero:num,nome:"Estudante "+num,gab:gab,R:R,origem:"auto"});
      });
      E.ativa=null;
      var antes={fant:ehFantasma(f), cands:candidatosDoFantasma(f).length,
        avisoNaTela:fantasmasDaTurma("t1").length,
        resNoFant:E.res.filter(function(r){return r.prova==="pFANT";}).length};
      var rec=reconectarCartoes("pFANT","sim1");
      var cartoes=E.res.filter(function(r){return r.prova==="psim1";});
      var a=apurarComp(simuladoDe("sim1"),"LP");
      return {antes:antes, rec:rec,
        existeFantasma:!!provaDe("pFANT"),
        noCaderno:cartoes.length,
        acertos:cartoes.map(function(r){return r.acertos;}).sort(),
        comAnalise:!!a && a.feitos.length===2 && a.itens.length>0 &&
                   a.itens.every(function(i){return i.cod;}),
        padrao:a&&a.feitos.every(function(L){return !!L.padrao;}),
        sobraRes:E.res.filter(function(r){return r.prova==="pFANT";}).length};
    })()`);
    ok(resultado.antes.fant && resultado.antes.cands === 1 && resultado.antes.avisoNaTela === 1,
       "o fantasma antigo é reconhecido e o app oferece o caderno certo");
    ok(resultado.rec.ok && resultado.rec.movidos === 2 && resultado.rec.divergentes.length === 0,
       "dois cartões reconectados, nenhum divergente");
    ok(!resultado.existeFantasma && resultado.sobraRes === 0,
       "e a prova fantasma some depois de esvaziada");
    ok(resultado.noCaderno === 2, "os cartões agora são do caderno do simulado");
    ok(resultado.acertos.join(",") === "12,9",
       "os acertos refeitos pelo caderno certo batem (" + resultado.acertos.join(", ") + " de 12)");
    ok(resultado.comAnalise,
       "e a análise por componente funciona: descritores por item, estudantes apurados");
    ok(resultado.padrao, "cada estudante tem nível/padrão de desempenho");
  }

  /* ── 6. cartão impresso com outra ordem NÃO é movido ── */
  {
    const { win } = montar("4º SIMULADO");
    const r = J(win, `(function(){
      var pr=E.provas[0];
      var f={id:"pFANT",turma:"t1",disciplina:"d1",codigo:"4o SIMULADO",titulo:"",
        nq:pr.nq,no:5,gabC:pr.gabC,habs:[],criada:5};
      E.provas.push(f);
      E.res.push({prova:"pFANT",turma:"t1",numero:"01",nome:"Estudante 1",
        R:Array(pr.nq).fill("A"),Rc:Array(pr.nq).fill("A"),
        gab:Array(pr.nq).fill("A").join(""),   /* ordem que o app não calcula */
        acertos:3,erros:9,certas:[],erradas:[],t:1});
      var rec=reconectarCartoes("pFANT","sim1");
      return {rec:rec, naoMexeu:E.res.filter(function(x){return x.prova==="pFANT";}).length,
              fantasmaFicou:!!provaDe("pFANT")};
    })()`);
    ok(r.rec.divergentes.length === 1 && r.naoMexeu === 1 && r.fantasmaFicou,
       "folha com ordem de alternativas diferente fica onde está e é listada para ler de novo");
  }

  /* ── 7. a tela de simulados mostra o aviso e o botão funciona ── */
  {
    const { win } = montar("4º SIMULADO");
    win.eval(`(function(){
      var pr=E.provas[0], t=turmaDe("t1");
      var f={id:"pFANT",turma:"t1",disciplina:"d1",codigo:"4o SIMULADO",titulo:"",
        nq:pr.nq,no:5,gabC:pr.gabC,habs:[],criada:5};
      E.provas.push(f);
      E.ativa="pFANT";
      var o=ordemDe(pr,t.nome,"01"), letras=["A","B","C","D","E"], R=[], gab="";
      for(var i=0;i<f.nq;i++){
        var c=letras.indexOf(pr.gabC[o.oq[i]]); R.push(letras[o.oa[i].indexOf(c)]);
      }
      gab=R.join("");
      registrar({numero:"01",nome:"Estudante 1",gab:gab,R:R,origem:"auto"});
      E.ativa=null; casaTurma="t1"; casaNivel="simulados"; montarCasa();
    })()`);
    const doc = win.document;
    const aviso = doc.querySelector("#casaCorpo .aviso");
    ok(!!aviso && /sem simulado/.test(aviso.textContent),
       "a lista de simulados avisa que há cartão sem simulado");
    const btn = doc.querySelector("[data-recon]");
    ok(!!btn, "e oferece o botão de ligar ao caderno");
    if (btn) { btn.onclick(); }
    ok(win.eval("E.res.filter(function(r){return r.prova==='psim1';}).length") === 1 &&
       !win.eval("!!provaDe('pFANT')"),
       "clicar liga o cartão ao caderno e remove a prova fantasma");
    ok(!doc.querySelector("[data-recon]"), "e o aviso some da tela");
  }

  /* ── 8. a conferência avisa na hora, quando o cartão não casa com nada ── */
  {
    const { E, win } = montar("XYZ-1");
    win.eval("aplicarQR(" + JSON.stringify(payloadDe(win, "OUTRO-CODIGO", E.provas[0].gabC, "01")) + ")");
    const marcado = win.eval("!!(provaAtiva()&&provaAtiva().origemQR)");
    ok(marcado, "cartão que não casa com nada cria prova marcada como fantasma (origemQR)");
  }

  console.log(falhas ? "\nteste86: " + falhas + " FALHA(S)" : "\nteste86: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 800);
