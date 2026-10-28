/* teste89.js — referência COLADA no fim do texto de apoio.

   O professor mostrou duas questões ("O estresse faz bem" e "Turismo")
   em que o arquivo gerado imprimia parte do texto como se fosse a
   referência (cinza, pequena, à direita). Causa: o PDF costura o fim do
   último parágrafo e a fonte na MESMA linha, e como a fonte tem ano e
   "In:", o parágrafo inteiro era tomado por referência.
   Também: com a referência colada, o sublinhado/negrito da expressão
   destacada não era aplicado. */
"use strict";
const G = require("./gerador.js");
let falhas = 0;
const ok = (c, m) => { console.log((c ? "  ok   " : "  FALHA") + "  " + m); if(!c) falhas++; };

console.log("teste89 — referência colada ao texto");

const p1 = "A prestação do carro está vencendo, a crise roeu suas economias, o computador travou de vez e o mala do chefe insiste em pegar no seu pé. O resultado disso é clássico: estresse. Ninguém gosta de ter fumaça saindo pelas orelhas – mas, acredite, essa pressão faz muito bem para você. Pelo menos é o que diz Bruce McEwen, o estresse é fundamental para a nossa sobrevivência.";
const p2 = "Quando sentimos o mundo cair sobre a cabeça, o cérebro nos prepara para reagir ao desastre. Ficamos prontos para tomar decisões com mais rapidez, guardar informações que podem ser decisivas e encarar desafios e perigos. O segredo estaria em levar uma vida saudável e buscar atividades que deem prazer, como diz McEwen – autor do livro O Fim do Estresse como Nós o Conhecemos – na entrevista que concedeu à SUPER.";
const ref1 = "WESTPHAL, Cristina. Super interessante. Abril, 2009. Adaptado: Reforma ortográfica. Fragmento.";
const cmd1 = "O autor desse texto faz uso da linguagem coloquial no trecho:";

/* 1. estresse: fim do texto + referência + comando, tudo na mesma linha */
let s = G.segmentarEnunciado(["Leia o texto abaixo.", "O estresse faz bem", p1, p2 + " " + ref1 + " " + cmd1].join("\n"));
ok(s.corpo.length === 2, "estresse (colado): 2 parágrafos de texto — " + s.corpo.length);
ok(s.corpo[1].endsWith("à SUPER."), "o texto termina em 'à SUPER.' e não leva a referência");
ok(s.fonte === ref1, "a referência é só a referência: " + JSON.stringify(s.fonte));
ok(s.comando === cmd1, "o comando fica separado");

/* 2. a mesma questão com a referência em linha própria (caso comum) */
s = G.segmentarEnunciado(["Leia o texto abaixo.", "O estresse faz bem", p1, p2, ref1, cmd1].join("\n"));
ok(s.corpo.length === 2 && s.fonte === ref1 && s.comando === cmd1, "estresse (separado) continua certo");

/* 3. referência só com 'Disponível em', em linha própria */
const ref3 = "Disponível em: <www.exemplo.com.br/texto>. Acesso em: 3 mar. 2019.";
s = G.segmentarEnunciado(["Leia o texto abaixo.", p1, ref3, "O texto defende que"].join("\n"));
ok(s.corpo.length === 1 && s.fonte === ref3 && s.comando === "O texto defende que", "'Disponível em' separada continua certa");

/* 4. Turismo: colado + sublinhado/negrito da expressão destacada */
const t1 = "A única coisa que perturba harmonia do ambiente são os turistas. Alguns.";
const t2 = "Eles não viajam a fim de ver o mar, ouvir o vento, sentir a areia. Eles só querem mudar de cenário para fazer as coisas que fazem sempre. A todo volume. Para que todos saibam que eles têm som. Nunca desembarcam de si mesmos. Por onde vão, sua presença é uma perturbação para o espírito. Nossa cultura provocou uma transformação perversa nos seres humanos, de forma que eles acreditam que, para estar bem, é preciso estar acoplados a objetos tecnológicos.";
const ref4 = "ALVES, Rubem. Turismo. In: Quarto de Badulaques. São Paulo: Parábola, 2003. p. 158. Fragmento.";
const cmd4 = "No trecho Nunca desembarcam de si mesmos., o autor usou a expressão destacada “desembarcam de si mesmos” para ressaltar que os turistas têm dificuldade de";
const bruto4 = ["Leia o texto abaixo.", "Turismo", t1, t2 + " " + ref4, cmd4].join("\n");
s = G.segmentarEnunciado(bruto4);
ok(s.corpo.length === 2 && s.fonte === ref4 && s.comando === cmd4, "Turismo (colado) separa texto, fonte e comando");

const m = G.marcarPalavraDestacada(bruto4);
ok(m !== bruto4 && G.temMarcas(m), "a expressão destacada foi marcada mesmo com a referência colada");
ok(m.includes("\u0006desembarcam de si mesmos\u0007"), "sublinhada no texto de apoio");
ok(m.includes("“\u000edesembarcam de si mesmos\u000f”"), "em negrito dentro do comando");
const sm = G.segmentarEnunciado(m);
ok(sm.fonte === ref4 && sm.corpo.length === 2 && !G.semMarcas(sm.corpo[1]).includes("ALVES"),
   "depois de marcado, a fonte continua separada do texto");
ok(G.semMarcas(m) === bruto4, "tirando as marcas, o enunciado é idêntico ao original");

/* 5. um parágrafo comprido que só CITA um ano não vira referência */
const longo = "Em 2009 o autor publicou uma pesquisa sobre o estresse no trabalho e concluiu que, em doses moderadas, ele ajuda a memória e a atenção das pessoas durante tarefas difíceis, desde que haja tempo para descansar depois de cada etapa do trabalho realizado.";
s = G.segmentarEnunciado(["Leia o texto abaixo.", "Título", longo, "O texto mostra que"].join("\n"));
ok(s.corpo.length === 1 && !s.fonte, "texto com ano no meio não é tomado por referência");

process.exit(falhas ? 1 : 0);
