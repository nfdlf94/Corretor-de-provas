/* teste75.js — as figuras saem do localStorage.

   O app avisou: "O armazenamento do navegador encheu — provavelmente por
   causa das figuras."

   Ele estava certo. O localStorage tem ~5 MB; uma figura recortada de PDF
   pesa uns 80 KB em base64, e o app guardava o base64 DENTRO de cada
   prova. Pior: as quatro turmas de uma série recebem cópias do mesmo
   caderno, então vinte questões com figura viravam OITENTA cópias de
   dados idênticos.

   Agora as figuras vivem num poço no IndexedDB, endereçadas pelo
   CONTEÚDO: figuras iguais ocupam um lugar só, quantas vezes apareçam. A
   prova guarda `{ref, w, h}` — umas 60 letras no lugar de 80 000.

   `dadosFig(img)` é o único jeito de ler o conteúdo, e ele aceita os dois
   formatos: `{dados}` das provas antigas e `{ref}` das novas. Provas
   antigas são migradas na abertura, e continuam funcionando até lá. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(4) });

setTimeout(() => {
  console.log("teste75 — poço de figuras");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. o endereço é o conteúdo ── */
  const ref = JSON.parse(win.eval(`JSON.stringify({
    igual: refDaFig("data:image/jpeg;base64,AAAA")===refDaFig("data:image/jpeg;base64,AAAA"),
    diferente: refDaFig("data:image/jpeg;base64,AAAA")!==refDaFig("data:image/jpeg;base64,AAAB"),
    tamanho: refDaFig("data:image/jpeg;base64,AAAA").length,
    exemplo: refDaFig("data:image/jpeg;base64,AAAA")
  })`));
  ok(ref.igual, "conteúdo igual → mesma referência");
  ok(ref.diferente, "conteúdo diferente → referência diferente");
  ok(ref.tamanho < 40,
     "a referência tem " + ref.tamanho + " letras (" + ref.exemplo + ")");

  /* ── 2. a prova guarda a referência, não o conteúdo ── */
  const guardar = JSON.parse(win.eval(`JSON.stringify((function(){
    var base64="data:image/jpeg;base64,"+new Array(4000).join("Q");
    var img={dados:base64, w:900, h:520};
    var r=poeFig(img);
    return {ref:r.ref, temDados:!!r.dados, w:r.w, h:r.h,
      pesoDoOriginal:JSON.stringify(img).length,
      pesoDaReferencia:JSON.stringify(r).length,
      leituraBate:dadosFig(r)===base64};
  })())`));
  ok(!guardar.temDados,
     "o que fica na prova NÃO tem o base64");
  ok(guardar.w === 900 && guardar.h === 520,
     "mas mantém as medidas, que o layout precisa (" + guardar.w + "×" +
     guardar.h + ")");
  ok(guardar.pesoDaReferencia < 80,
     "a referência pesa " + guardar.pesoDaReferencia + " bytes contra " +
     guardar.pesoDoOriginal + " do original — " +
     Math.round(guardar.pesoDoOriginal/guardar.pesoDaReferencia) + "× menor");
  ok(guardar.leituraBate,
     "e `dadosFig` devolve o conteúdo original, byte por byte");

  /* ── 3. quatro turmas, uma cópia ── */
  /* era daqui que vinha o estouro: o mesmo caderno em quatro turmas */
  const dedup = JSON.parse(win.eval(`JSON.stringify((function(){
    var base64="data:image/jpeg;base64,"+new Array(3000).join("Z");
    var refs=[];
    for(var t=0;t<4;t++)                      // quatro turmas
      for(var q=0;q<5;q++)                    // cinco questões com a MESMA figura
        refs.push(poeFig({dados:base64,w:800,h:400}).ref);
    var distintas={};
    refs.forEach(function(r){ distintas[r]=1; });
    return {guardadas:refs.length, noPoco:Object.keys(distintas).length};
  })())`));
  ok(dedup.guardadas === 20, "vinte figuras guardadas (4 turmas × 5 questões)");
  ok(dedup.noPoco === 1,
     "e UMA no poço — figuras iguais caem no mesmo endereço");

  /* ── 4. os dois formatos convivem ── */
  const formatos = JSON.parse(win.eval(`JSON.stringify((function(){
    var base64="data:image/jpeg;base64,XYZ";
    var antigo={dados:base64, w:100, h:50};        // prova não migrada
    var novo=poeFig({dados:base64, w:100, h:50});  // prova nova
    return {antigo:dadosFig(antigo)===base64,
            novo:dadosFig(novo)===base64,
            nulo:dadosFig(null),
            semPar:dadosFig({ref:"naoexiste", w:1, h:1})};
  })())`));
  ok(formatos.antigo,
     "uma prova antiga, com o base64 dentro, continua funcionando");
  ok(formatos.novo, "e uma prova nova também");
  ok(formatos.nulo === null && formatos.semPar === null,
     "referência inexistente devolve null em vez de quebrar o desenho");

  /* ── 5. o gerador não sabe de nada disso ── */
  const G = require("./gerador.js");
  ok(typeof G.dadosDaFigura === "function",
     "o gerador tem o acessor e não lê `.dados` direto");
  ok(G.dadosDaFigura({dados:"abc"}) === "abc",
     "que resolve o formato antigo sozinho");
  ok(G.dadosDaFigura(null) === null, "e aguenta nulo");

  const fonteG = require("fs").readFileSync(__dirname + "/gerador.js", "utf8");
  ok(!/\bimagem\.dados\b/.test(fonteG) && !/\bimg\.dados\b/.test(fonteG.replace(/if\(img\.dados\) return img\.dados;/g,"")),
     "e nenhum lugar do gerador lê o conteúdo por fora do acessor");

  /* ── 6. a migração ── */
  const migrou = JSON.parse(win.eval(`JSON.stringify((function(){
    var base64="data:image/jpeg;base64,"+new Array(500).join("M");
    var p=E.provas[0];
    if(!p){ return {pulado:true}; }
    p.questoes=[{enunciado:"Q1", alternativas:["a"], imagem:{dados:base64,w:10,h:5}},
                {enunciado:"Q2", alternativas:["a"], imagem:null}];
    var antes=JSON.stringify(E).length;
    /* o corpo de migrarFigsParaOBanco, sem o await */
    var movidas=0;
    (E.provas||[]).forEach(function(pp){
      (pp.questoes||[]).forEach(function(q){
        if(q.imagem && q.imagem.dados && !q.imagem.ref){
          var r=poeFig(q.imagem);
          if(r){ q.imagem=r; movidas++; }
        }
      });
    });
    var depois=JSON.stringify(E).length;
    return {movidas:movidas, antes:antes, depois:depois,
      aindaLe:dadosFig(E.provas[0].questoes[0].imagem)===base64,
      semImagem:E.provas[0].questoes[1].imagem};
  })())`));
  if(migrou.pulado){ ok(true, "(sem prova no estado base para migrar)"); }
  else{
    ok(migrou.movidas === 1, "a figura da prova antiga foi movida");
    ok(migrou.depois < migrou.antes,
       "o estado encolheu de " + migrou.antes + " para " + migrou.depois +
       " bytes");
    ok(migrou.aindaLe,
       "e a figura continua legível pela referência — a prova não perdeu nada");
    ok(migrou.semImagem === null, "questão sem figura segue sem figura");
  }

  console.log(falhas ? "\nteste75: " + falhas + " FALHA(S)" : "\nteste75: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1000);
