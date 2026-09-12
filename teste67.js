/* teste67.js — quem errou tudo não tem proficiência.

   Relato: um estudante que não acertou NADA em Matemática saiu com 257
   pontos de proficiência — acima do corte do Elementar I (250), ou seja,
   classificado em Elementar II.

   A causa é o prior da TRI. Um padrão todo errado não tem estimativa
   finita; o que segura o número é o prior, centrado no meio da escala.
   E o efeito é perverso, medido com os itens do 1º Simulado:

     itens difíceis (350–425)  →  quem errou tudo sai com 281 pontos
     itens fáceis   (200–300)  →  quem errou tudo sai com 196 pontos

   **Quanto mais difícil a prova, maior a nota de quem não acertou
   nada** — porque errar tudo numa prova difícil é o esperado, e o
   modelo conclui que aquilo não informa. Coerente como estatística;
   para o professor, a família e o conselho de classe, indefensável.

   A regra nova: acerto no nível do chute não posiciona ninguém. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(10), {nLP:0, nMAT:10}) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste67 — acerto no nível do chute");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. o efeito perverso, reproduzido ── */
  const perverso = J(`(function(){
    var ref=300;                       // meio da escala MAT 3EM (175–425)
    var zeros=[0,0,0,0,0,0,0,0,0];
    var dificeis=[387,362,425,362,387,425,412,412,412].map(function(p){
      return {a:1.0,b:(p-ref)/50,c:0.2};});
    var faceis=[200,225,250,250,275,275,300,300,300].map(function(p){
      return {a:1.0,b:(p-ref)/50,c:0.2};});
    return {dificil:Math.round(thetaParaPontos(estimarTheta(zeros,dificeis),ref)),
            facil:Math.round(thetaParaPontos(estimarTheta(zeros,faceis),ref))};
  })()`);
  ok(perverso.dificil > perverso.facil,
     "errar tudo numa prova DIFÍCIL dá " + perverso.dificil + " pontos e " +
     "numa prova FÁCIL dá " + perverso.facil + " — quanto mais difícil a " +
     "prova, maior a nota de quem não acertou nada");
  ok(perverso.dificil > 250,
     "e o " + perverso.dificil + " passa do corte do Elementar I, que é " +
     "exatamente o que o professor viu");

  /* ── 2. a regra ── */
  const regra = J(`(function(){
    return {zero:noNivelDoChute(0,9,5), um:noNivelDoChute(1,9,5),
      doisDeDez:noNivelDoChute(2,10,5), tresDeDez:noNivelDoChute(3,10,5),
      metade:noNivelDoChute(5,10,5), tudo:noNivelDoChute(10,10,5),
      semItens:noNivelDoChute(0,0,5),
      duasDeOito5:noNivelDoChute(2,8,5), duasDeOito4:noNivelDoChute(2,8,4)};
  })()`);
  ok(regra.zero === true, "0 de 9 está no nível do chute");
  ok(regra.um === true, "1 de 9 também (1/9 < 1/5)");
  ok(regra.doisDeDez === true, "2 de 10 é exatamente o chute com 5 opções");
  ok(regra.tresDeDez === false, "3 de 10 já está acima do chute");
  ok(regra.metade === false && regra.tudo === false,
     "metade e tudo, claro, não");
  /* 2 de 8 = 25%: chute com QUATRO alternativas, acima do chute com CINCO.
     A conta acompanha o número de opções, não um percentual fixo. */
  ok(regra.duasDeOito4 === true && regra.duasDeOito5 === false,
     "2 de 8 é chute com quatro alternativas e NÃO é com cinco — a conta " +
     "acompanha o número de opções");
  ok(regra.semItens === false, "componente sem itens não é marcado");

  /* ── 3. no fim da linha: o estudante não recebe número inventado ── */
  const analise = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    sm.etapa="3EM";
    pr.niv=[7,6,9,6,7,9,8,8,8,7];      // o caderno difícil do professor
    E.ativa=pr.id; aplicarLayout(pr.nq,pr.no);
    t.alunos.forEach(function(a,i){
      var g=gabaritoDe(t.nome,a.numero); if(!g) return;
      var R=g.split("");
      /* o primeiro erra TUDO; os outros acertam em escada */
      var errar=(i===0)?pr.nq:Math.max(0,pr.nq-i-2);
      for(var k=0;k<errar;k++) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
    var A=apurarConjunto([sm],"MAT");
    var zero=A.linhas.filter(function(L){return L.acertos===0;})[0];
    var bom=A.linhas.slice().sort(function(x,y){return y.acertos-x.acertos;})[0];
    return {metodo:A.metodo, alunos:A.alunos,
      zero:zero?{acertos:zero.acertos, prof:zero.prof,
                 semEvidencia:!!zero.semEvidencia,
                 padrao:zero.padrao?zero.padrao.nome:null}:null,
      bom:{acertos:bom.acertos, prof:Math.round(bom.prof),
           semEvidencia:!!bom.semEvidencia}};
  })()`);
  ok(analise.zero, "há um estudante com zero acertos na turma");
  ok(analise.zero.semEvidencia === true,
     "ele é marcado como sem evidência de proficiência");
  ok(analise.zero.prof <= 175 + 0.01,
     "e a proficiência dele cai para o piso da escala (" +
     Math.round(analise.zero.prof) + "), não para o prior");
  ok(analise.zero.padrao === "Elementar I",
     "o padrão dele é " + analise.zero.padrao + " — o mais baixo, que é o " +
     "que 0 acertos permite afirmar");
  ok(analise.bom.semEvidencia === false,
     "quem acertou " + analise.bom.acertos + " NÃO é marcado, e mantém a " +
     "proficiência estimada (" + analise.bom.prof + ")");

  /* ── 4. o relatório diz \"não medido\", não um número ── */
  const fonte = require("fs").readFileSync(__dirname + "/index.html", "utf8");
  ok(/não medido/.test(fonte),
     "a tabela individual do PDF mostra \"não medido\" em vez do número");
  ok(/acertou no nível do \\u201cchute\\u201d|acertou no nível do "+/.test(fonte) ||
     /no nível do chute/.test(fonte),
     "e explica o que isso significa");
  ok(/qualquer pessoa teria marcando ao acaso/.test(fonte),
     "com a frase que qualquer leitor entende: é o que qualquer pessoa " +
     "teria marcando ao acaso");
  ok(/quanto mais dif.{0,3}cil a prova, maior a nota de quem/i.test(fonte),
     "e o motivo está registrado no código, para ninguém \"consertar\" isso " +
     "de volta");

  /* ── 5. o PDF sai ── */
  const pdf = J(`(function(){
    var sm=E.simulados[0], t=turmaDe(sm.turma);
    var doc=pdfAnalise({nivel:"turma", recorte:t.nome, titulo:sm.titulo,
      etapa:sm.etapa, escola:"EREM", sims:[sm],
      individual:[{turma:t, sims:[sm]}]});
    return {paginas:doc.getNumberOfPages()};
  })()`);
  ok(pdf.paginas >= 3, "o relatório é gerado (" + pdf.paginas + " páginas)");

  console.log(falhas ? "\nteste67: " + falhas + " FALHA(S)" : "\nteste67: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1500);
