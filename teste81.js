/* teste81.js — cabeçalho/rodapé que vaza para dentro da questão.

   O professor mostrou o defeito com duas capturas: o PDF gerado, com a
   alternativa B da questão 3 assim —

     "B) uma relação entre o tamanho do celular e o vício. 3º Simulado
      SAEPE · Língua Portuguesa · 3ª série do Ensino Médio Página 7"

   — e a conferência de diagramação do MESMO simulado, que só apontava
   vazamento nas questões 5 e 9 (referência bibliográfica dentro do
   comando), sem dizer nada da questão 3.

   Duas causas, e as duas foram atacadas:

   1. O extrator lê o PDF em ordem visual, sem saber que uma linha é
      rodapé — quando a quebra de página cai no meio de uma questão,
      aquela linha entra no fluxo como se fosse mais texto. A correção
      fica em `removerCabecalhoRodape`, rodando na extração, antes de
      qualquer questão ser interpretada.

   2. A conferência de diagramação (`preFlightCheck`) só olhava o
      COMANDO da questão, nunca as alternativas — e só reconhecia o
      padrão de referência bibliográfica ("Disponível em", "Acesso em"),
      nunca o de cabeçalho/rodapé ("Página N"). Ficou como REDE, para o
      caso de a extração não pegar tudo. */
"use strict";
const H = require("./harness");
const fs = require("fs");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({ estado: H.estadoBase(3) });
const J = expr => JSON.parse(win.eval("JSON.stringify(" + expr + ")"));

setTimeout(() => {
  console.log("teste81 — cabeçalho e rodapé vazados");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  /* ── 1. o rodapé some, quando repete na mesma posição em várias páginas ── */
  const cinco = J(`(function(){
    var paginas=[];
    for(var i=1;i<=5;i++) paginas.push({linhas:[
      "QUESTÃO "+i, "Enunciado da questão "+i+".",
      "A) alternativa a", "B) alternativa b",
      "3º Simulado SAEPE · Língua Portuguesa · 3ª série do Ensino Médio Página "+i]});
    var limpo=removerCabecalhoRodape(paginas);
    return {
      rodapeSumiu:limpo.every(function(p){
        return !/Simulado SAEPE/.test(p.linhas[p.linhas.length-1]||"");}),
      pagina3:limpo[2].linhas};
  })()`);
  ok(cinco.rodapeSumiu,
     "o rodapé some das cinco páginas: " + cinco.pagina3.join(" | "));
  ok(cinco.pagina3.length === 4 && cinco.pagina3[0] === "QUESTÃO 3",
     "e sobra só o conteúdo de verdade, com \"QUESTÃO 3\" no lugar (não " +
     "era rodapé — era ISSO que quase saiu no primeiro rascunho desta " +
     "correção, porque \"QUESTÃO N\" também se repete de página em página)");

  /* ── 2. um marcador estrutural nunca é tratado como rodapé ── */
  ok(win.eval(`PARECE_MARCADOR.test("QUESTÃO 12")`) === true,
     "\"QUESTÃO 12\" é reconhecido como marcador");
  ok(win.eval(`PARECE_MARCADOR.test("B) uma alternativa qualquer")`) === true,
     "e \"B) …\" também — nenhum dos dois vira candidato a header/footer, " +
     "não importa quantas vezes se repita");

  /* ── 3. instrução legítima que se repete NÃO é removida ── */
  const instrucao = J(`(function(){
    var paginas=[];
    for(var i=1;i<=5;i++) paginas.push({linhas:["QUESTÃO "+i,
      "Leia o texto abaixo.", "Um texto qualquer "+i+".", "A) a", "B) b"]});
    var limpo=removerCabecalhoRodape(paginas);
    return limpo.every(function(p){
      return p.linhas.indexOf("Leia o texto abaixo.")>=0;});
  })()`);
  ok(instrucao,
     "\"Leia o texto abaixo.\" continua em toda questão de leitura — " +
     "repetir de propósito não é a mesma coisa que ser rodapé");

  /* ── 4. amostra pequena demais não é mexida ── */
  const poucas = J(`(function(){
    var pag=[{linhas:["a","b","RODAPE X"]},{linhas:["c","d","RODAPE X"]}];
    return JSON.stringify(removerCabecalhoRodape(pag))===JSON.stringify(pag);
  })()`);
  ok(poucas,
     "com só duas páginas, o risco de falso positivo supera o ganho — " +
     "nada é removido");

  /* ── 5. o CENÁRIO EXATO do professor ── */
  const cenario = J(`(function(){
    var paginas=[
      {linhas:["QUESTÃO 01","Enunciado 1.","A) a","B) b","C) c","D) d","E) e",
        "3º Simulado SAEPE · Língua Portuguesa · 3ª série do Ensino Médio Página 1"]},
      {linhas:["QUESTÃO 02","Enunciado 2.","A) a","B) b","C) c","D) d","E) e",
        "3º Simulado SAEPE · Língua Portuguesa · 3ª série do Ensino Médio Página 2"]},
      {linhas:["QUESTÃO 03","No trecho, a expressão destacada enfatiza",
        "A) a inferioridade dos aparelhos celulares.",
        "B) uma relação entre o tamanho do celular e o vício.",
        "3º Simulado SAEPE · Língua Portuguesa · 3ª série do Ensino Médio Página 7"]},
      {linhas:["C) uma crítica ao uso do celular e seus malefícios.",
        "D) a importância dos celulares na vida moderna.",
        "E) a tecnologia presente nos aparelhos celulares.",
        "QUESTÃO 04","Leia o texto abaixo.",
        "3º Simulado SAEPE · Língua Portuguesa · 3ª série do Ensino Médio Página 8"]},
      {linhas:["Texto da questão 4.","A) x","B) y",
        "3º Simulado SAEPE · Língua Portuguesa · 3ª série do Ensino Médio Página 9"]}
    ];
    var limpo=removerCabecalhoRodape(paginas);
    var flat=limpo.map(function(p){return p.linhas.join("\\n");}).join("\\n");
    return {
      rodapeQ3Sumiu:!/Página 7/.test(flat),
      bSeguidoDeC:/uma rela[çc][ãa]o entre o tamanho do celular e o v[íi]cio\\.\\nC\\) uma cr[íi]tica/.test(flat),
      questao04Sobrou:/QUEST[ÃA]O 04/.test(flat),
      nenhumRodapeRestou:!/Simulado SAEPE/.test(flat)};
  })()`);
  ok(cenario.rodapeQ3Sumiu,
     "no cenário exato do professor, o rodapé da página 7 some");
  ok(cenario.bSeguidoDeC,
     "e a alternativa B fica seguida direto pela C, sem nada no meio");
  ok(cenario.questao04Sobrou, "a QUESTÃO 04 continua no lugar");
  ok(cenario.nenhumRodapeRestou, "e nenhum dos cinco rodapés sobra");

  /* ── 6. a rede: preFlightCheck agora olha as ALTERNATIVAS também ── */
  const fonteG = fs.readFileSync(__dirname + "/gerador.js", "utf8");
  ok(/RE_VAZOU_RODAPE/.test(fonteG),
     "existe um padrão específico para cabeçalho/rodapé de página");
  ok(/alts\.forEach\(\(a, k\) => \{/.test(fonteG) &&
     /RE_VAZOU_FONTE\.test\(txt\) \|\| RE_VAZOU_RODAPE\.test\(txt\)/.test(fonteG),
     "e a checagem passou a varrer cada ALTERNATIVA, não só o comando — " +
     "era exatamente ali, na alternativa B, que o vazamento do professor " +
     "estava, e a versão antiga nunca olhava esse lugar");

  console.log(falhas ? "\nteste81: " + falhas + " FALHA(S)" : "\nteste81: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
