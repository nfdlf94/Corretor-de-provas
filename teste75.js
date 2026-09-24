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
  /* as duas funções que PODEM tocar `.dados`: o acessor, que lê, e
     `temFigura`, que só pergunta se existe */
  const semAcessores = fonteG
    .replace(/if\(img\.dados\) return img\.dados;/g, "")
    .replace(/return !!\(img && \(img\.dados \|\| img\.ref\)\);/g, "");
  ok(!/\bimagem\.dados\b/.test(semAcessores) && !/\bimg\.dados\b/.test(semAcessores),
     "e nenhum lugar do gerador lê o conteúdo por fora do acessor");

  /* ── a ORDEM não pode depender do poço ter carregado (v87) ── */
  /* Na v83 a trava das questões com alternativas dentro da figura passou
     a perguntar pelo CONTEÚDO da figura. Ao gerar o PDF o poço está
     cheio; ao corrigir, o app acabou de abrir e ele ainda carrega. A
     questão era travada numa hora e embaralhada na outra — e a divergência
     aparecia em provas NOVAS. */
  const ordemEstavel = JSON.parse(win.eval(`JSON.stringify((function(){
    var r=poeFig({dados:"data:image/jpeg;base64,"+new Array(400).join("Q"),w:900,h:500});
    var qs=[{enunciado:"Q1",alternativas:[],imagem:r},
            {enunciado:"Q2",alternativas:["a","b","c","d","e"],imagem:null}];
    var carregado=JSON.stringify(indicesFixos(qs));
    var guarda=new Map(FIGS); FIGS.clear();
    var carregando=JSON.stringify(indicesFixos(qs));
    guarda.forEach(function(v,k){FIGS.set(k,v);});
    return {carregado:carregado, carregando:carregando};
  })())`));
  ok(ordemEstavel.carregado === ordemEstavel.carregando,
     "as questões travadas são as MESMAS com o poço carregado (" +
     ordemEstavel.carregado + ") e carregando (" + ordemEstavel.carregando +
     ") — é o que faz a prova impressa e a correção concordarem");
  ok(ordemEstavel.carregado === "[0]",
     "e a questão com alternativas na figura é travada nos dois casos");

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

  /* ── 7. a tela "Figuras das questões" também tinha de passar pelo poço (v93) ──
     O professor viu o aviso de armazenamento cheio uma SEGUNDA vez, meses
     depois do arranjo do poço estar funcionando. A importação normal
     (aplicarImportacao) já usava `poeFig` desde a v83 — mas a tela de
     anexar/trocar figura manualmente (`telaFiguras`) nunca foi
     atualizada: ela gravava `{dados: base64, w, h}` DIRETO na questão,
     por dois caminhos — "usar imagem do documento" e "anexar/trocar
     arquivo" — reabrindo exatamente o vazamento que a v83 tinha fechado
     para a importação. */
  const semPoco = JSON.parse(win.eval(`JSON.stringify((function(){
    var base64="data:image/jpeg;base64,"+new Array(3000).join("F");
    var semPoco={dados:base64, w:520, h:360};      // como era escrito antes
    var comPoco=poeFig({dados:base64, w:520, h:360});  // como é escrito agora
    return {
      antes:{temDados:!!semPoco.dados, peso:JSON.stringify(semPoco).length},
      depois:{temDados:!!comPoco.dados, temRef:!!comPoco.ref,
        peso:JSON.stringify(comPoco).length,
        leituraBate:dadosFig(comPoco)===base64}
    };
  })())`));
  ok(semPoco.antes.temDados === true,
     "como a tela escrevia antes: o base64 dentro da questão (" +
     semPoco.antes.peso + " bytes) — era daqui que vinha o segundo aviso");
  ok(semPoco.depois.temDados === false && semPoco.depois.temRef === true,
     "como escreve agora: só a referência, sem o conteúdo");
  ok(semPoco.depois.peso < semPoco.antes.peso / 20,
     "" + semPoco.depois.peso + " bytes contra " + semPoco.antes.peso +
     " — a mesma redução da importação normal, agora também aqui");
  ok(semPoco.depois.leituraBate,
     "e a leitura pela referência devolve o mesmo conteúdo");

  const fonteFig = require("fs").readFileSync(__dirname + "/index.html", "utf8");
  ok(/qs\[i\]\.imagem=poeFig\(\{dados:iaImagens\[k\]/.test(fonteFig),
     "o caminho \"usar imagem do documento\" passa por poeFig");
  ok(/qs\[figAlvo\]\.imagem=poeFig\(img\)/.test(fonteFig),
     "e o caminho \"anexar/trocar arquivo\" também");
  ok(!/img\.imagem\.dados/.test(fonteFig) &&
     /src="\$\{esc\(dadosFig\(q\.imagem\)/.test(fonteFig),
     "e a PRÉ-VISUALIZAÇÃO nessa tela lê pelo acessor, não por `.dados` " +
     "direto — senão quebraria para qualquer figura já movida ao poço, " +
     "que é a maioria depois da migração automática da v83");

  /* ── 8. salvar() se defende sozinho, mesmo sem a migração ter chegado (v94) ──
     Terceira vez que o professor viu o aviso, mesmo depois da v83 (poço)
     e da v93 (fechar a fuga da tela de figuras). A causa não era outra
     fuga — era uma CORRIDA: a migração das provas antigas roda em
     SEGUNDO PLANO na abertura do app, sem bloquear nada. Se o professor
     começa a importar um arquivo novo antes dela terminar — o caso
     comum, abrir o app e já subir um PDF —, a gravação da importação
     concorre com a migração pelo mesmo `localStorage`, e o BACKLOG
     acumulado (meses de figuras anexadas à mão antes de qualquer um
     destes consertos existir) ainda está lá, com `.dados` cru, quando a
     gravação da importação acontece.

     A correção: `salvar()` passou a se defender sozinho. Quando a
     gravação normal estoura a cota, ele compacta TODAS as figuras que
     ainda tiverem conteúdo embutido — não importa de onde vieram — e
     tenta UMA vez a mais, antes de desistir e mostrar o aviso. */
  const corrida = JSON.parse(win.eval(`JSON.stringify((function(){
    var t=E.turmas[0];
    var pr={id:"prCorrida", turma:t.id, disciplina:"d1", codigo:"C",
      titulo:"Backlog", nq:5, no:5, gabC:"AAAAA",
      comps:["MAT","MAT","MAT","MAT","MAT"], discursivas:[]};
    var base64="data:image/jpeg;base64,"+new Array(200000).join("Z");
    /* simula o backlog: 40 questões ainda com o base64 cru, como
       ficariam sem a migração ter tido tempo de rodar */
    pr.questoes=[];
    for(var i=0;i<40;i++)
      pr.questoes.push({enunciado:"Q"+i, alternativas:["a","b","c","d","e"],
        imagem:{dados:base64, w:520, h:360}});
    E.provas.push(pr);

    var proto=Object.getPrototypeOf(window.localStorage);
    var real=proto.setItem;
    var tentativas=0;
    proto.setItem=function(k,v){
      tentativas++;
      if(v.length>500000) throw new Error("QuotaExceededError (simulado)");
      return real.call(this,k,v);
    };
    var guardaEspaco=avisouEspaco;
    avisouEspaco=false;
    var ok=salvar();
    var lido=JSON.parse(window.localStorage.getItem("dbm_omr_v8"));
    var salvo=lido.provas[lido.provas.length-1].questoes;
    var resultado={ok:ok, tentativas:tentativas,
      comRef:salvo.filter(function(q){return q.imagem&&q.imagem.ref;}).length,
      comDados:salvo.filter(function(q){return q.imagem&&q.imagem.dados;}).length,
      avisou:avisouEspaco,
      leituraOk:dadosFig(E.provas[E.provas.length-1].questoes[0].imagem)===base64};
    proto.setItem=real; avisouEspaco=guardaEspaco;
    return resultado;
  })())`));
  ok(corrida.tentativas === 2,
     "a gravação tenta de novo depois de estourar (" + corrida.tentativas +
     " tentativas)");
  ok(corrida.ok === true,
     "e a segunda tentativa TEM SUCESSO — a gravação não se perde");
  ok(corrida.comDados === 0 && corrida.comRef === 40,
     "as 40 figuras do backlog saíram compactadas: " + corrida.comRef +
     " com referência, " + corrida.comDados + " ainda com conteúdo cru");
  ok(corrida.avisou === false,
     "e o professor NÃO vê o alerta — a compactação resolveu antes de " +
     "precisar avisar");
  ok(corrida.leituraOk === true,
     "e o conteúdo continua legível pela referência depois de tudo isso");

  console.log(falhas ? "\nteste75: " + falhas + " FALHA(S)" : "\nteste75: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1000);
