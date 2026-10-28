/* teste85.js — a reserva da troca de questão vazava figura crua.

   Quinto aviso de "o armazenamento do navegador encheu", depois de v83
   (poço), v93 (tela de figuras) e v94 (salvar() se defende sozinho). As
   três vezes anteriores o vazamento estava em `E.provas[].questoes[]` —
   e é exatamente ali que `compactarFiguras()` olhava.

   Mas a v95 criou outro lugar: ao importar um arquivo, `sm.reserva[comp]`
   guarda até 60 questões INTEIRAS daquele arquivo (é a fonte de
   `candidatosParaTrocar`, a troca de questão por outra do mesmo
   descritor). Essas questões vêm de `lido.itens`, com `questao.imagem`
   ainda em `{dados,w,h}` — base64 cru — porque NUNCA passavam por
   `poeFig`. E `sm.reserva` mora em `E.simulados`, não em `E.provas`:
   `compactarFiguras()` nunca olhava lá.

   O resultado: um arquivo de Português com texto ilustrado multiplicava
   o vazamento por até 60 (uma por item da reserva) — bem mais rápido que
   o de `E.provas`, que só tem `nq` itens por caderno. E como a reserva é
   escrita ANTES do `salvar()` da importação, a auto-defesa da v94 só
   entraria em ação depois que a cota JÁ tivesse estourado por causa
   dela — e aí precisava compactar a MESMA reserva que a estourou, o que
   `compactarFiguras()` ainda não fazia.

   Duas correções: (1) `compactarFiguras()` agora varre `E.simulados[].
   reserva` também, para limpar o que já ficou gravado assim em sessões
   anteriores; (2) a importação agora passa cada imagem por `poeFig`
   ANTES de montar a reserva, então ela nunca mais entra crua. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const E0 = H.comSimulado(H.estadoBase(4), {});
const { win } = H.abrirApp({ estado: E0 });

setTimeout(() => {
  console.log("teste85 — a reserva da troca de questão também passa pelo poço");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. compactarFiguras() agora alcança E.simulados[].reserva ── */
  const varredura = JSON.parse(win.eval(`JSON.stringify((function(){
    var base64="data:image/jpeg;base64,"+new Array(4000).join("Q");
    var sm=E.simulados[0];
    /* como ficava gravado antes da correção: 60 questões, imagem crua,
       exatamente o que a importação escrevia em sm.reserva.LP */
    var itens=[];
    for(var i=0;i<60;i++)
      itens.push({questao:{enunciado:"Questão "+i, alternativas:["a","b","c","d","e"],
        imagem:{dados:base64, w:520, h:360}}, gab:"A", desc:"D1", niv:3, orig:i+1});
    sm.reserva={LP:itens};
    var antes=JSON.stringify(E).length;
    var movidas=compactarFiguras();
    var depois=JSON.stringify(E).length;
    var pool=sm.reserva.LP;
    return {
      movidas:movidas, antes:antes, depois:depois,
      comDados:pool.filter(function(x){return x.questao.imagem&&x.questao.imagem.dados;}).length,
      comRef:pool.filter(function(x){return x.questao.imagem&&x.questao.imagem.ref;}).length,
      leituraOk:dadosFig(pool[0].questao.imagem)===base64 &&
                dadosFig(pool[59].questao.imagem)===base64
    };
  })())`));
  ok(varredura.movidas === 60,
     "as 60 figuras da reserva foram encontradas e compactadas (" +
     varredura.movidas + ")");
  ok(varredura.comDados === 0 && varredura.comRef === 60,
     "nenhuma ficou com base64 cru — todas com referência (" +
     varredura.comRef + "/60)");
  ok(varredura.depois < varredura.antes / 10,
     "o estado encolheu de " + varredura.antes + " para " + varredura.depois +
     " bytes — mais de 10× menor");
  ok(varredura.leituraOk,
     "e o conteúdo continua legível pela referência, do primeiro ao último item");

  /* ── 2. figuras iguais na reserva caem no mesmo endereço do poço ──
     o mesmo texto de apoio costuma valer para várias questões de um
     bloco (ex.: um gráfico único com cinco perguntas) */
  const dedupReserva = JSON.parse(win.eval(`JSON.stringify((function(){
    var base64="data:image/jpeg;base64,"+new Array(3000).join("Z");
    var sm=E.simulados[1]||(E.simulados[1]={id:"sim2",turma:"t1",reserva:{}});
    var itens=[];
    for(var i=0;i<10;i++)
      itens.push({questao:{enunciado:"Q"+i, imagem:{dados:base64,w:800,h:400}}});
    sm.reserva={MAT:itens};
    compactarFiguras();
    var refs={};
    sm.reserva.MAT.forEach(function(x){ refs[x.questao.imagem.ref]=1; });
    return {distintas:Object.keys(refs).length};
  })())`));
  ok(dedupReserva.distintas === 1,
     "dez itens com a mesma figura de apoio caem num endereço só no poço");

  /* ── 3. a corrida de quota: estourar DURANTE a importação, com a
     reserva recém-criada, precisa se resolver sem avisar o professor ──
     é a cena exata do relato: "Lendo ..._Portugues_3EM.pdf", armazenamento
     cheio — a reserva do arquivo que está sendo importado AGORA, ainda
     crua, é o que estoura a cota antes mesmo do salvar() da importação */
  const corridaReserva = JSON.parse(win.eval(`JSON.stringify((function(){
    var sm=E.simulados[0];
    var base64="data:image/jpeg;base64,"+new Array(200000).join("Z");
    var itens=[];
    for(var i=0;i<30;i++)
      itens.push({questao:{enunciado:"Q"+i, alternativas:["a","b","c","d","e"],
        imagem:{dados:base64, w:520, h:360}}, gab:"A", desc:"D1", niv:null, orig:i+1});
    sm.reserva={LP:itens};         // como ficava gravado ANTES desta correção

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
    var resultadoOk=salvar();
    var avisou=avisouEspaco;
    proto.setItem=real; avisouEspaco=guardaEspaco;

    var lido=JSON.parse(window.localStorage.getItem("dbm_omr_v8"));
    var pool=(lido.simulados.filter(function(s){return s.id===sm.id;})[0]||{}).reserva.LP;
    return {tentativas:tentativas, ok:resultadoOk, avisou:avisou,
      comDados: pool ? pool.filter(function(x){return x.questao.imagem&&x.questao.imagem.dados;}).length : -1};
  })())`));
  ok(corridaReserva.tentativas === 2,
     "estourou e tentou de novo (" + corridaReserva.tentativas + " tentativas)");
  ok(corridaReserva.ok === true,
     "a segunda tentativa teve sucesso — a importação não se perde");
  ok(corridaReserva.avisou === false,
     "e o professor NÃO vê mais o alerta nesta cena — a reserva crua " +
     "era exatamente o que faltava compactar");
  ok(corridaReserva.comDados === 0,
     "a reserva gravada já saiu compacta, sem base64 cru dentro");

  /* ── 4. a importação, na origem, nunca mais escreve imagem crua na
     reserva — a fonte (não só a rede de segurança) ── */
  const fonte = require("fs").readFileSync(__dirname + "/index.html", "utf8");
  ok(/lido\.itens\.forEach\(x=>\{[\s\S]{0,200}?poeFig\(\{dados:q\.imagem\.dados/.test(fonte),
     "a importação compacta a imagem de cada item ANTES de montar sm.reserva");
  const posMutacao = fonte.indexOf("lido.itens.forEach(x=>{\n        const q=x.questao;");
  const posReserva = fonte.indexOf("sm.reserva[comp]=lido.itens.slice(0,60)");
  ok(posMutacao > -1 && posReserva > -1 && posMutacao < posReserva,
     "e isso acontece ANTES da reserva ser montada, não depois");

  console.log(falhas ? "\nteste85: " + falhas + " FALHA(S)" : "\nteste85: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1000);
