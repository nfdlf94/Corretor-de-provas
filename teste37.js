/* teste37.js — os dados oficiais do SAEPE.

   `saepe-oficial.js` não é conteúdo digitado: cada linha veio de um PDF
   publicado pela rede. Esta suíte confere que a extração ficou completa e
   coerente, e que o banco de descritores do app passou a nascer da Matriz
   de Referência em vez de uma tela em branco. */
"use strict";
const H = require("./harness");
const S = require("./saepe-oficial.js");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

console.log("teste37 — matriz de referência e níveis de desempenho");

/* ── matriz de referência ── */
const mat3 = S.matrizDe("MAT", "3EM"), lp3 = S.matrizDe("LP", "3EM");
ok(Object.keys(mat3).length === 35, "Matemática 3º EM tem 35 descritores");
ok(Object.keys(lp3).length === 21, "Língua Portuguesa 3º EM tem 21 descritores");
const semBuraco = d => {
  const n = Object.keys(d).map(k => +k.slice(1)).sort((a,b)=>a-b);
  return n.every((v,i) => v === i+1);
};
ok(semBuraco(mat3) && semBuraco(lp3), "a numeração vai de D1 até o fim, sem furos");
ok(mat3.D16 === "Resolver problema que envolva porcentagem.", "MAT D16: " + mat3.D16);
ok(/tese de um texto/.test(lp3.D7), "LP D7 é a tese: " + lp3.D7);
ok(Object.keys(S.matrizDe("MAT","9EF")).length === 37, "9º EF em Matemática: 37 descritores");
ok(Object.keys(S.matrizDe("LP","2EF")).length === 10, "2º EF em Português: 10 descritores");
ok(Object.values(mat3).every(t => t.length > 15 && /\.$/.test(t)),
   "toda descrição está completa e termina em ponto");

/* o mesmo código é coisa diferente em cada componente — a razão de o
   histórico ser por aluno + disciplina + descritor */
ok(mat3.D17 !== lp3.D17, "D17 de Matemática e D17 de Português são habilidades distintas");

/* ── níveis de desempenho ── */
const hMat = S.habilidadesDe("MAT", "3EM"), hLp = S.habilidadesDe("LP", "3EM");
ok(hMat.length > 200, "Matemática 3º EM: " + hMat.length + " habilidades posicionadas");
ok(hLp.length > 150, "Português 3º EM: " + hLp.length + " habilidades posicionadas");
ok(Math.max(...hMat.map(h=>h.nivel)) === 9, "Matemática vai até o nível 9");
ok(Math.max(...hLp.map(h=>h.nivel)) === 10, "Português vai até o nível 10");

/* as faixas são contínuas e crescentes */
const faixas = {};
hMat.forEach(h => faixas[h.nivel] = [h.de, h.ate]);
const niveis = Object.keys(faixas).map(Number).sort((a,b)=>a-b);
ok(faixas[1][0] === null && faixas[1][1] === 250, "nível 1 de Matemática: até 250");
ok(faixas[9][0] === 425 && faixas[9][1] === null, "nível 9 de Matemática: acima de 425");
let continua = true;
for (let i = 1; i < niveis.length; i++)
  if (faixas[niveis[i]][0] !== faixas[niveis[i-1]][1]) continua = false;
ok(continua, "as faixas se encaixam sem buraco nem sobreposição");

/* toda habilidade tem texto de verdade e faixa */
ok(S.SAEPE_NIVEIS.every(h => h.texto.length > 20), "nenhuma habilidade veio truncada");
ok(S.SAEPE_NIVEIS.every(h => h.de != null || h.ate != null), "toda habilidade tem faixa");
/* toda habilidade começa com verbo de comando — é assim que se separa a
   habilidade do texto de orientação ao gestor, que o mesmo PDF traz junto.
   A única que não está no infinitivo é assim no documento: o caderno de
   2024 escreve "Determina a solução…" no 9º EF, nível 6. */
const semVerbo = S.SAEPE_NIVEIS.filter(h =>
  !/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zçãéíóúâêô]+r\b/.test(h.texto));
ok(semVerbo.length === 1 && /^Determina a solução/.test(semVerbo[0].texto),
   "só a habilidade que o próprio caderno escreve sem o infinitivo escapa do padrão" +
   (semVerbo.length !== 1 ? " — vieram " + semVerbo.length : ""));

/* o ponto âncora de cada nível */
ok(S.pontoDoNivel(hMat.find(h=>h.nivel===5)) === 337.5, "nível 5 de Matemática ancora em 337,5");
ok(S.pontoDoNivel(hMat.find(h=>h.nivel===1)) === 237.5, "nível 1, com extremo aberto, ancora em 237,5");
ok(S.pontoDoNivel(hMat.find(h=>h.nivel===9)) === 437.5, "nível 9, idem, em 437,5");

/* o mesmo descritor mora em vários níveis: é por isso que a âncora tem de
   ser a habilidade, não o código */
const localizar = hLp.filter(h => /^Localizar/.test(h.texto));
ok(new Set(localizar.map(h=>h.nivel)).size >= 6,
   "“Localizar…” aparece em " + new Set(localizar.map(h=>h.nivel)).size +
   " níveis diferentes de Português");

/* ── o app usa a matriz oficial ── */
const E = H.estadoBase(6);
E.turmas[0].serie = "3º ano do Ensino Médio";
H.comSimulado(E, { id:"s1", nLP:6, nMAT:6, codigo:"S1", titulo:"1º", ano:2026 });
E.descritores = { LP:{}, MAT:{} };            // banco local vazio
const { win } = H.abrirApp({ estado: E });
const ev = s => win.eval(s);

setTimeout(() => {
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");
  ok(ev('typeof SAEPE_MATRIZ') === "object", "saepe-oficial.js foi carregado pelo index.html");
  const avisos = [...win.document.querySelectorAll(".aviso")].map(x=>x.textContent).join(" ");
  ok(!/Faltou carregar/.test(avisos), "conferirPecas não reclama de peça faltando");

  ev('casaTurma="t1"; casaSim="s1";');
  ok(ev('textoDesc("MAT","D16")') === "Resolver problema que envolva porcentagem.",
     "com o banco local vazio, o texto vem da matriz oficial");
  ok(ev('Object.keys(bancoDesc("MAT")).length') === 35,
     "o banco de Matemática abre com os 35 descritores da matriz");
  ok(/D16/.test(ev('rotuloDesc("MAT","D16")')), "o rótulo traz o código e a descrição");

  /* o que o professor escreve tem precedência */
  ev('E.descritores.MAT={D16:"Porcentagem — do meu jeito"};');
  ok(ev('textoDesc("MAT","D16")') === "Porcentagem — do meu jeito",
     "texto escrito pelo professor tem precedência sobre a matriz");
  ok(ev('textoDesc("MAT","D17")') === "Resolver problema envolvendo equação do 2º grau.",
     "e os demais continuam vindo da matriz");

  console.log(falhas ? "\nteste37: " + falhas + " FALHA(S)" : "\nteste37: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
