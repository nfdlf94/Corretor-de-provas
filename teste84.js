/* teste84.js — o comando não pode ficar todo em negrito por cima da
   palavra destacada.

   O professor mandou dois exemplos novos ("ares de sucata", "Também")
   e apontou um problema diferente do da v98/v99: o COMANDO da questão
   sai INTEIRO em negrito, por convenção — e quando ele já cita a
   palavra/expressão destacada entre aspas ("a expressão destacada
   'ares de sucata' indica..."), negritar a frase toda apaga o único
   contraste que ajudaria o estudante a identificar QUAL palavra é.

   Nas palavras dele: "você deveria ter criado um mecanismo para
   realmente deixar a palavra destacada [...] pode colocar o comando
   todo da questão sem estar em negrito e deixar em negrito apenas a
   palavra que está sendo destacada."

   A correção: o comando some do negrito geral SÓ quando a marcação
   identifica a palavra dentro dele — e nesse caso, só ELA fica em
   negrito, com o resto do comando em peso normal. Qualquer comando SEM
   esse padrão continua exatamente como sempre foi: inteiro em negrito. */
"use strict";
const G = require("./gerador.js");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const docFalso = () => ({
  internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},
  setFont(){}, setFontSize(v){this.fs=v;}, setTextColor(){}, setDrawColor(){},
  setLineWidth(){}, setFillColor(){}, setLineDashPattern(){},
  getTextWidth(t){ return String(t).length*1.75; },
  splitTextToSize(t){ return [t]; }, text(){}, addImage(){}, line(){}
});

console.log("teste84 — negrito seletivo dentro do comando");

/* ── 1. "ares de sucata" — o exemplo exato do professor ── */
const enunciadoSucata = [
  "Leia o texto abaixo.", "Um texto sobre tecnologia.",
  "As máquinas de hoje, cheias de recursos, correm o risco de, em poucos anos, assumindo ares de sucata.",
  "Fonte: Revista X, 2020. Fragmento.",
  "No trecho ... assumindo ares de sucata., no final do primeiro parágrafo, " +
    "a expressão destacada \"ares de sucata\" indica que as tecnologias são"
].join("\n");
const marcadoSucata = G.marcarPalavraDestacada(enunciadoSucata);

ok(marcadoSucata.includes(G.M_SUBL_INI+"ares de sucata"+G.M_SUBL_FIM),
   "o texto de apoio continua sublinhado, como na v98/v99");
ok(marcadoSucata.includes(G.M_NEG_INI+"ares de sucata"+G.M_NEG_FIM),
   "e agora, DENTRO do comando, a mesma expressão fica marcada para negrito");
ok(G.semMarcas(marcadoSucata) === enunciadoSucata,
   "tirando as duas marcas, o texto volta a ser exatamente o original");

/* ── 2. "Também" — o segundo exemplo, com "palavra" (uma só) ── */
const enunciadoTambem = [
  "Leia o texto abaixo.", "Um diálogo qualquer.",
  "— Nem de mim.", "— Ora, Alice...",
  "Também não exigo os nomes dos pratos.",
  "TELLES, Lygia Fagundes. Antes do baile verde. 9. ed. Rio de Janeiro: Nova Fronteira, 1986. p. 143-144. Fragmento.",
  "No trecho – Também não exigo os nomes dos pratos., a palavra destacada " +
    "\"Também\" estabelece uma relação de"
].join("\n");
const marcadoTambem = G.marcarPalavraDestacada(enunciadoTambem);
ok(marcadoTambem.includes(G.M_NEG_INI+"Também"+G.M_NEG_FIM),
   "\"Também\" (uma palavra só) também fica marcada para negrito no comando");

/* ── 3. o "gatuno" da v98: a citação no comando é uma FRASE, não uma
   palavra — só a PRIMEIRA palavra dela fica em negrito, não a frase ── */
const enunciadoGatuno = [
  "Leia o texto abaixo.", "Memórias Póstumas de Brás Cubas",
  "\"... Marcela amou-me durante quinze meses.",
  "quero-te para homem sério e não para arruador ou gatuno. E como eu fizesse um gesto:",
  "— Gatuno, sim senhor, não é outra coisa um filho que me faz isto...",
  "ASSIS, Machado de. 1992, p. 44. Fragmento.",
  "No trecho \"Gatuno, sim senhor, não é outra coisa um filho que me faz isto...\", " +
    "a palavra destacada foi empregada para"
].join("\n");
const marcadoGatuno = G.marcarPalavraDestacada(enunciadoGatuno);
ok(marcadoGatuno.includes(G.M_NEG_INI+"Gatuno"+G.M_NEG_FIM),
   "no comando do \"gatuno\", só \"Gatuno\" (a palavra) fica em negrito");
ok(!marcadoGatuno.includes(G.M_NEG_INI+"Gatuno, sim senhor"),
   "e NÃO a frase citada inteira — \"palavra destacada\" pede uma palavra só");

/* ── 4. comando que não bate como linha única: fica sem negrito, mas o
   sublinhado na passagem continua funcionando ── */
const enunciadoQuebrado = [
  "Leia o texto abaixo.", "Um texto.", "Frase com a palavra alvo no meio dela.",
  "Fonte: Z.",
  "No trecho", // o comando, no arquivo, quebrado em duas linhas
  "\"palavra alvo\", a expressão destacada evidencia"
].join("\n");
const marcadoQuebrado = G.marcarPalavraDestacada(enunciadoQuebrado);
const segQuebrado = G.segmentarEnunciado(marcadoQuebrado);
ok(marcadoQuebrado.includes(G.M_SUBL_INI+"palavra alvo"+G.M_SUBL_FIM),
   "com o comando partido em duas linhas do arquivo, a passagem AINDA " +
   "fica sublinhada");
ok(!G.temNegrito(segQuebrado.comando),
   "mas o comando fica sem a marca de negrito — recuo seguro, em vez de " +
   "arriscar cortar a linha errada");

/* ── 5. um comando comum, sem "palavra/expressão destacada", continua
   inteiro em negrito — nada muda para a maioria das questões ── */
const semDestaque = [
  "Leia o texto abaixo.", "Um texto qualquer.", "Fonte: Y.",
  "Qual é o tema central do texto?"
].join("\n");
const doc = docFalso();
const qComum = {enunciado: semDestaque, alternativas:["a","b","c","d","e"], imagem:null};
const medComum = G.medidasQuestao(doc, qComum, 89.5, 10.5, ["A","B","C","D","E"]);
const parteComum = medComum.partes.find(p => p.tipo === "comando");
ok(parteComum.estilo === "bold",
   "questão sem \"palavra destacada\": o comando continua INTEIRO em " +
   "negrito, exatamente como sempre foi");

/* ── 6. com a marcação, o estilo do comando muda para "normal" ── */
const qMarcada = {enunciado: marcadoSucata, alternativas:["a","b","c","d","e"], imagem:null};
const medMarcada = G.medidasQuestao(doc, qMarcada, 89.5, 10.5, ["A","B","C","D","E"]);
const parteMarcada = medMarcada.partes.find(p => p.tipo === "comando");
ok(parteMarcada.estilo === "normal",
   "com a marcação, o ESTILO-BASE do comando passa a \"normal\" — só a " +
   "palavra marcada vai carregar o negrito na hora de desenhar");

/* ── 7. o traço do sublinhado e o peso do negrito não vazam para a
   linha seguinte, que pode não ter marca nenhuma ── */
const doc2 = docFalso();
let estiloFinal = null;
doc2.setFont = function(f, e){ estiloFinal = e; };
G.textoComNiveis(doc2, "— "+G.M_NEG_INI+"ares"+G.M_NEG_FIM+" de sucata", 10, 50, 10.5, "normal");
ok(estiloFinal === "normal",
   "depois de desenhar um pedaço em negrito, o estilo volta ao " +
   "estilo-base (\"" + estiloFinal + "\") — a linha seguinte, desenhada " +
   "por fora desta função, não herda negrito nenhum");

/* ── 8. o sublinhado e o negrito não interferem na checagem de expoente ── */
const chars = G.charsDeNivel(marcadoSucata);
ok(chars.sup === 0 && chars.sub === 0,
   "nem o sublinhado nem o negrito contam como sobrescrito/subscrito — a " +
   "checagem de \"expoente sumiu\" continua vendo só o que é expoente");

console.log(falhas ? "\nteste84: " + falhas + " FALHA(S)" : "\nteste84: tudo certo");
process.exit(falhas ? 1 : 0);
