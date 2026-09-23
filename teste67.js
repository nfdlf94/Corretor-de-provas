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

  /* ── 2. as DUAS regras, que a v88 separou ────────────────────────
     A v73 usava uma só, no nível do chute, e ela marcava como "não
     medido" quem acertou 1 de 9. O professor apontou o problema: "não
     medido" diz que o app não conseguiu medir, e isso é falso para quem
     acertou uma questão. Viraram duas:

       • NÃO MEDIDO  → zero acertos. Sem nenhum acerto não há como
         posicionar ninguém na escala.
       • ASTERISCO   → acertou, mas dentro do que o acaso produziria. O
         número aparece, com a ressalva ao lado. */
  const regra = J(`(function(){
    return {
      naoMedido:{zero:semEvidenciaNenhuma(0,9), um:semEvidenciaNenhuma(1,9),
                 tudo:semEvidenciaNenhuma(9,9), semItens:semEvidenciaNenhuma(0,0)},
      chute:{zero:naFaixaDoChute(0,9,5), um:naFaixaDoChute(1,9,5),
             doisDeDez:naFaixaDoChute(2,10,5), tresDeDez:naFaixaDoChute(3,10,5),
             metade:naFaixaDoChute(5,10,5),
             duasDeOito5:naFaixaDoChute(2,8,5), duasDeOito4:naFaixaDoChute(2,8,4)}};
  })()`);
  ok(regra.naoMedido.zero === true, "\"não medido\": 0 de 9, sim");
  ok(regra.naoMedido.um === false,
     "e 1 de 9 NÃO é \"não medido\" — era isso que estava errado");
  ok(regra.naoMedido.tudo === false && regra.naoMedido.semItens === false,
     "quem acertou tudo e componente sem itens, claro, também não");

  ok(regra.chute.um === true,
     "o asterisco, esse sim, pega 1 de 9 — o resultado existe mas não se " +
     "distingue do acaso");
  ok(regra.chute.zero === false,
     "e NÃO pega o zero, que já tem o seu próprio rótulo — as duas marcas " +
     "não se sobrepõem");
  ok(regra.chute.doisDeDez === true, "2 de 10 é exatamente o chute com 5 opções");
  ok(regra.chute.tresDeDez === false && regra.chute.metade === false,
     "3 de 10 e metade já estão acima dele");
  /* 2 de 8 = 25%: chute com QUATRO alternativas, acima do chute com CINCO */
  ok(regra.chute.duasDeOito4 === true && regra.chute.duasDeOito5 === false,
     "2 de 8 é chute com quatro alternativas e NÃO é com cinco — a conta " +
     "acompanha o número de opções");

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
  /* ── 3b. um estudante com 1 acerto NÃO é "não medido" ── */
  const umAcerto = J(`(function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    /* zera todo mundo e deixa um estudante com exatamente 1 acerto */
    E.res=E.res.filter(function(r){ return r.prova!==pr.id; });
    t.alunos.forEach(function(a,i){
      var g=gabaritoDe(t.nome,a.numero); if(!g) return;
      var R=g.split("");
      var errar=(i===0)?pr.nq:(i===1?pr.nq-1:Math.max(0,pr.nq-i-1));
      for(var k=0;k<errar;k++) R[k]=(R[k]==="A"?"B":"A");
      registrar({numero:a.numero,nome:a.nome,R:R,origem:"qr"});
    });
    var A=apurarConjunto([sm],"MAT");
    var zero=A.linhas.filter(function(L){return L.acertos===0;})[0];
    var um=A.linhas.filter(function(L){return L.acertos===1;})[0];
    return {
      zero:zero?{semEvidencia:!!zero.semEvidencia, noChute:!!zero.noChute}:null,
      um:um?{acertos:um.acertos, semEvidencia:!!um.semEvidencia,
             noChute:!!um.noChute, prof:Math.round(um.prof),
             padrao:um.padrao?um.padrao.nome:null}:null};
  })()`);
  ok(umAcerto.zero && umAcerto.zero.semEvidencia === true,
     "quem zerou continua como \"não medido\"");
  ok(umAcerto.um, "há um estudante com exatamente 1 acerto");
  ok(umAcerto.um && umAcerto.um.semEvidencia === false,
     "e ele NÃO é \"não medido\" — é o que o professor apontou");
  ok(umAcerto.um && umAcerto.um.noChute === true,
     "ele leva o asterisco: o resultado não se distingue do acaso");
  ok(umAcerto.um && umAcerto.um.padrao,
     "e recebe proficiência e padrão (" + (umAcerto.um.prof) + " · " +
     (umAcerto.um.padrao) + ") — o número existe, com a ressalva ao lado");

  const fonte = require("fs").readFileSync(__dirname + "/index.html", "utf8");
  ok(/não acertou "\+\s*\n?\s*"NENHUMA questão|não acertou\s+"\+/.test(fonte) ||
     /NENHUMA questão do componente/.test(fonte),
     "e o relatório explica \"não medido\" pelo zero, não pelo chute");
  ok(/O asterisco \(\*\) marca resultados/.test(fonte),
     "com o asterisco explicado à parte");
  ok(/não medido/.test(fonte),
     "a tabela individual do PDF mostra \"não medido\" em vez do número");
  ok(/o acaso produziria/.test(fonte),
     "com a frase que qualquer leitor entende: é o que o acaso produziria");
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
