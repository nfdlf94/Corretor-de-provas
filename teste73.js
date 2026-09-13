/* teste73.js — o banco poluído e a atualização não destrutiva.

   Duas coisas que o professor identificou, e a primeira ele achou antes
   de mim:

   1. **O banco de descritores foi somando.** `bancoDesc` sobrepõe o banco
      do professor à matriz oficial, então um texto errado gravado ali
      MASCARA a matriz em todo o app — inclusive no relatório. O banco de
      Matemática dele chegou a 44 descritores; a matriz do 3º EM tem 35. O
      excedente veio de importações antigas, com a numeração do arquivo,
      somando sem nunca limpar.

   2. **Ele corrigiu a numeração no arquivo e quer subir de novo** — mas o
      simulado já foi aplicado e corrigido. Reimportar trocaria as questões
      e invalidaria todos os cartões.

   A atualização casa cada questão do caderno com a do arquivo PELO
   ENUNCIADO. É o único par confiável: a ordem do caderno é sorteada e não
   é a do arquivo, mas o texto da questão é o mesmo nos dois. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(8), {nLP:0, nMAT:9}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste73 — banco limpo e atualização não destrutiva");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  win.eval("window.__T=" +
    JSON.stringify(fs.readFileSync(__dirname + "/fixture-sim-mat.txt","utf8")) + ";");

  /* ── 1. o banco mascara a matriz ── */
  const mascara = J(`(function(){
    E.descritores={LP:{},MAT:{}};
    /* o estado do professor: entradas antigas, com a numeração do arquivo */
    E.descritores.MAT.D22="Reconhecer o gráfico de uma função polinomial de 1º grau por meio de seus coeficientes.";
    E.descritores.MAT.D31="Resolver problema de contagem utilizando o princípio multiplicativo.";
    E.descritores.MAT.D99="Um descritor que não existe na matriz.";
    var oficial=matrizDe("MAT","3EM");
    return {
      oficialD22:oficial.D22,
      oQueOAppMostra:textoDesc("MAT","D22"),
      naMatriz:Object.keys(oficial).length,
      noBanco:Object.keys(E.descritores.MAT).length};
  })()`);
  ok(/P\.A\./i.test(mascara.oficialD22),
     "na matriz oficial, D22 é \"" + mascara.oficialD22.slice(0,34) + "…\"");
  ok(/gráfico/i.test(mascara.oQueOAppMostra),
     "mas o app mostra \"" + mascara.oQueOAppMostra.slice(0,34) + "…\" — o " +
     "banco do professor está POR CIMA da matriz");
  ok(mascara.naMatriz === 35,
     "a matriz MAT 3EM tem " + mascara.naMatriz + " descritores");

  /* ── 2. a conferência separa o que sobra do que diverge ── */
  const conf = J(`(function(){
    var oficial=matrizDe("MAT","3EM"), meu=E.descritores.MAT;
    var fora=Object.keys(meu).filter(function(k){return !oficial[k];});
    var div=Object.keys(meu).filter(function(k){return oficial[k] &&
      normDesc(meu[k])!==normDesc(oficial[k]);});
    return {fora:fora, divergentes:div};
  })()`);
  ok(conf.fora.join(",") === "D99",
     "código que não existe na matriz: " + conf.fora.join(", "));
  ok(conf.divergentes.sort().join(",") === "D22,D31",
     "códigos com texto diferente do oficial: " + conf.divergentes.join(", "));

  /* ── 3. limpar devolve a matriz ── */
  const limpo = J(`(function(){
    var oficial=matrizDe("MAT","3EM"), meu=E.descritores.MAT;
    var novo={};
    Object.keys(meu).forEach(function(k){
      if(oficial[k] && normDesc(meu[k])!==normDesc(oficial[k])) return;
      if(!oficial[k]) return;
      novo[k]=meu[k];
    });
    E.descritores.MAT=novo;
    return {sobraram:Object.keys(novo).length,
            d22:textoDesc("MAT","D22"), d99:textoDesc("MAT","D99")};
  })()`);
  ok(limpo.sobraram === 0,
     "as três entranhas sujas saíram (" + limpo.sobraram + " restantes)");
  ok(/P\.A\./i.test(limpo.d22),
     "e o D22 volta a mostrar o texto da MATRIZ: \"" +
     limpo.d22.slice(0,30) + "…\"");
  ok(limpo.d99 === "",
     "o D99 some, porque não existe na matriz");

  /* ── 4. o cenário do professor: simulado já corrigido ── */
  const antes = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    sm.qtd={LP:0,MAT:9}; sm.etapa="3EM"; sm.titulo="1º Simulado SAEPE";
    var lido=lerSimuladoDoc(window.__T,null);
    /* importa com a numeração ERRADA de propósito: é o estado dele */
    E.descritores={LP:{},MAT:{}};
    lido.descritores.forEach(function(d){ if(d.texto) E.descritores.MAT[d.cod]=d.texto; });
    aplicarImportacao(sm,"MAT",selecionarItens(sm,"MAT",lido.itens).itens);
    pr.niv=new Array(pr.nq).fill(null);
    E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    t.alunos.forEach(function(a,i){
      var g=gabaritoDe(t.nome,a.numero); if(!g) return;
      var R=g.split("");
      for(var k=0;k<i;k++) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
    return {desc:pr.desc.slice(), niv:pr.niv.slice(), gab:pr.gabC,
      questoes:pr.questoes.map(function(q){return q.enunciado;}),
      corrigidos:resDa(pr.id).length,
      notas:E.res.filter(function(r){return r.prova===pr.id;})
        .map(function(r){return r.numero+":"+r.acertos;}).sort().join(",")};
  })()`);
  ok(antes.corrigidos === 8, antes.corrigidos + " cartões corrigidos");
  ok(antes.desc.join(",").indexOf("D22") >= 0,
     "o caderno está com a numeração do arquivo: " + antes.desc.join(", "));
  ok(antes.niv.every(x => x == null), "e sem os níveis");

  /* ── 5. a atualização pelo enunciado ── */
  const depois = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var lido=lerSimuladoDoc(window.__T,null);
    var norm=normalizarDescritores(lido,"MAT","3EM");
    /* o casamento por enunciado, como o botão faz */
    var chave=function(t){ return normDesc(String(t||"")).slice(0,90); };
    var porTexto={};
    lido.itens.forEach(function(x){
      var k=chave(x.questao&&x.questao.enunciado);
      if(k && !porTexto[k]) porTexto[k]=x;
    });
    var casados=0, mudouDesc=0, mudouNiv=0, semPar=0;
    itensDe(pr,"MAT").forEach(function(i){
      var alvo=porTexto[chave(pr.questoes[i].enunciado)];
      if(!alvo){ semPar++; return; }
      casados++;
      var cod=codDesc(alvo.desc||"");
      if(cod && codDesc(pr.desc[i]||"")!==cod){ pr.desc[i]=cod; mudouDesc++; }
      if(alvo.niv!=null && pr.niv[i]!==alvo.niv){ pr.niv[i]=alvo.niv; mudouNiv++; }
    });
    return {casados:casados, semPar:semPar, mudouDesc:mudouDesc,
      mudouNiv:mudouNiv, desc:pr.desc, niv:pr.niv, gab:pr.gabC,
      questoes:pr.questoes.map(function(q){return q.enunciado;}),
      corrigidos:resDa(pr.id).length,
      notas:E.res.filter(function(r){return r.prova===pr.id;})
        .map(function(r){return r.numero+":"+r.acertos;}).sort().join(","),
      trocas:norm.trocas.map(function(t){return t.de+"→"+t.para;})};
  })()`);

  ok(depois.casados === 9 && depois.semPar === 0,
     "as nove questões foram casadas pelo enunciado, nenhuma sem par");
  ok(depois.mudouDesc === 7,
     depois.mudouDesc + " descritores atualizados (os mesmos 7 da normalização)");
  ok(depois.mudouNiv === 9, "e os nove níveis preenchidos");
  ok(depois.desc.join(",") === "D23,D17,D32,D17,D24,D32,D24,D23,D25",
     "o caderno passa à numeração do SAEPE: " + depois.desc.join(", "));
  ok(depois.niv.join(",") === "7,6,9,6,7,9,8,8,8",
     "com os níveis do arquivo: [" + depois.niv + "]");

  /* ── 6. o que NÃO podia ser tocado ── */
  ok(depois.gab === antes.gab, "o gabarito canônico não foi tocado");
  ok(String(depois.questoes) === String(antes.questoes),
     "nenhum enunciado foi alterado");
  ok(depois.corrigidos === antes.corrigidos,
     "os " + depois.corrigidos + " cartões continuam lá");
  ok(depois.notas === antes.notas,
     "e com as MESMAS notas — era isso que reimportar destruiria");

  /* ── 7. o casamento sobrevive à ordem trocada ── */
  /* Neste cenário o caderno saiu na mesma ordem do arquivo, então casar
     por posição funcionaria por acidente. Embaralhando o arquivo, só o
     casamento por ENUNCIADO continua de pé — e é o que acontece de
     verdade, porque o caderno é sorteado. */
  const embaralhado = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    var lido=lerSimuladoDoc(window.__T,null);
    normalizarDescritores(lido,"MAT","3EM");
    /* inverte a ordem do arquivo */
    lido.itens.reverse();
    var chave=function(t){ return normDesc(String(t||"")).slice(0,90); };
    var porTexto={}, porPosicao=0, porEnunciado=0;
    lido.itens.forEach(function(x){
      var k=chave(x.questao&&x.questao.enunciado);
      if(k && !porTexto[k]) porTexto[k]=x;
    });
    var idx=itensDe(pr,"MAT");
    idx.forEach(function(i,k){
      /* por posição */
      var pos=lido.itens[k];
      if(pos && codDesc(pos.desc||"")===codDesc(pr.desc[i]||"")) porPosicao++;
      /* por enunciado */
      var alvo=porTexto[chave(pr.questoes[i].enunciado)];
      if(alvo && codDesc(alvo.desc||"")===codDesc(pr.desc[i]||"")) porEnunciado++;
    });
    return {porPosicao:porPosicao, porEnunciado:porEnunciado, total:idx.length};
  })()`);
  ok(embaralhado.porEnunciado === embaralhado.total,
     "com o arquivo em outra ordem, o casamento por ENUNCIADO acerta as " +
     embaralhado.porEnunciado + " questões");
  ok(embaralhado.porPosicao < embaralhado.total,
     "e o casamento por POSIÇÃO erraria (" + embaralhado.porPosicao + " de " +
     embaralhado.total + ") — por isso o par é o texto da questão");

  /* ── 7b. "Completar os níveis" também casa por enunciado ── */
  /* A v70 casava por DESCRITOR, e isso ruiu quando a v78 passou a
     normalizar a numeração na importação: o caderno fica com D23 e o
     arquivo com D22, nenhum código bate, e a tela dizia "9 níveis do
     arquivo não encontraram par no caderno". A operação que existia para
     consertar os dados dependia justamente do dado que estava errado. */
  const niveis = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm);
    pr.niv=new Array(pr.nq).fill(null);
    /* o arquivo ORIGINAL, sem normalizar — é o que o professor sobe */
    var arq=lerSimuladoDoc(window.__T,null);
    /* como era: por descritor */
    var fila={};
    arq.itens.forEach(function(x){ if(x.niv==null) return;
      var k=codDesc(x.desc||""); (fila[k]=fila[k]||[]).push(x.niv); });
    var porDesc=0;
    for(var i=0;i<pr.nq;i++){
      var k=codDesc(pr.desc[i]||"");
      if(k && fila[k] && fila[k].length){ fila[k].shift(); porDesc++; }
    }
    /* como é: por enunciado */
    var chave=function(t){ return normDesc(String(t||"")).slice(0,90); };
    var porTexto={};
    arq.itens.forEach(function(x){
      var k=chave(x.questao&&x.questao.enunciado);
      if(k && !porTexto[k]) porTexto[k]=x; });
    var porEnun=0;
    for(var i=0;i<pr.nq;i++){
      var alvo=porTexto[chave(pr.questoes[i].enunciado)];
      if(alvo && alvo.niv!=null){ pr.niv[i]=alvo.niv; porEnun++; }
    }
    return {caderno:pr.desc.join(","),
      arquivo:arq.itens.map(function(x){return x.desc;}).join(","),
      porDesc:porDesc, porEnun:porEnun, total:pr.nq, niv:pr.niv};
  })()`);
  ok(niveis.caderno !== niveis.arquivo,
     "o caderno está no SAEPE e o arquivo no formato antigo — é o estado " +
     "que a captura mostrava");
  ok(niveis.porDesc < niveis.total,
     "casando por DESCRITOR: só " + niveis.porDesc + " de " + niveis.total +
     " — era daí que saía o \"0 itens receberam o nível\"");
  ok(niveis.porEnun === niveis.total,
     "casando por ENUNCIADO: " + niveis.porEnun + " de " + niveis.total);
  ok(niveis.niv.join(",") === "7,6,9,6,7,9,8,8,8",
     "com os níveis certos: [" + niveis.niv + "]");
  ok(/Mesma máquina do "Atualizar descritores": o par é o ENUNCIADO/.test(
       fs.readFileSync(__dirname + "/index.html","utf8")),
     "e as duas operações passam a usar a mesma máquina");

  /* ── 8. a tela existe ── */
  const fonte = fs.readFileSync(__dirname + "/index.html", "utf8");
  ok(/Atualizar descritores pelo arquivo/.test(fonte),
     "o botão está na tela do simulado");
  ok(/casando cada questão pelo enunciado/.test(fonte),
     "e diz como o casamento é feito");
  ok(/Voltar à matriz oficial/.test(fonte),
     "e o banco oferece a limpeza");

  console.log(falhas ? "\nteste73: " + falhas + " FALHA(S)" : "\nteste73: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1500);
