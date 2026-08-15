/* teste24.js — corrigir um caderno de simulado PELA CÂMERA.
   O cartão é desenhado com a geometria oficial (montarLayout) e o QR com
   o payload oficial (montarPayload + gabaritoIndividual), os mesmos que o
   gerador imprime. Cenário real: quem está ativo é outra prova, de outro
   tamanho — é assim que o professor chega na aba Ler depois de corrigir
   uma prova comum. */
"use strict";
const H = require("./harness");
const { desenhar } = require("./cartao-sintetico");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

function montarEstado(){
  const E = H.estadoBase(12);
  E.provas.push({ id:"pNormal", turma:"t1", disciplina:"d1", codigo:"MAT01",
    titulo:"Prova de Matemática", periodo:1, nq:10, no:5,
    gabC:"ABCDEABCDE", habs:[], questoes:[], discursivas:[], criada: Date.now()-1000 });
  H.comSimulado(E, { nLP:13, nMAT:13 });
  E.ativa = "pNormal";
  return E;
}

const estado = montarEstado();
const caderno = estado.provas.find(p => p.id === "psim1");
const { win } = H.abrirApp({ estado });
const ev = s => win.eval(s);

setTimeout(() => {
  console.log("teste24 — correção de simulado pela câmera");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");
  ok(ev("NQ") === 10, "o layout ativo é o da prova NORMAL (10 itens)");

  /* o cartão que está na frente da câmera: o do simulado, nº 03 */
  const turma = "3A", numero = "03", nome = "Estudante 3";
  /* usa as funções do PRÓPRIO app carregado, como o gerador faz */
  const gabInd = win.gabaritoIndividual(caderno.gabC, turma, numero, 5,
                                        caderno.comps, true);
  const payload = win.montarPayload(caderno.codigo, gabInd, turma, numero, nome, 5);
  ok(gabInd.length === 26, "gabarito individual do cartão tem 26 letras");
  ok(/^DBM4\|SIM1\|[A-E]{26}\|3A\|03\|/.test(payload), "payload do QR no formato DBM4");

  /* o estudante acerta 22 e erra as 4 últimas */
  const marcadas = gabInd.split("").map((L,i) =>
    i < 22 ? L : (L === "A" ? "B" : "A"));

  const T = desenhar({ nq:26, no:5, payload, marcadas });
  const img = T.imageData();

  /* injeta a imagem no app e roda o mesmo analisar() da câmera */
  win.__img = img;
  const achou = ev("(function(){ try{ return analisar(window.__img,false); }"+
                   "catch(e){ return 'erro:'+e.message; } })()");
  console.log("     analisar() devolveu:", achou);
  console.log("     faixa:", win.document.getElementById("ftit").textContent,
              "/", win.document.getElementById("fsub").textContent);

  ok(ev("!!ultimoQuad"), "os quatro marcadores foram encontrados");
  ok(ev("E.ativa") === "psim1", "o QR ativou o CADERNO DE SIMULADO");
  ok(ev("NQ") === 26, "o layout girou para 26 itens");
  ok(ev("!!alunoQR"), "o estudante foi identificado pelo QR");
  ok(ev("alunoQR && alunoQR.numero") === "03", "identificou o nº 03");

  /* estabiliza: três quadros iguais travam a leitura */
  ev("(function(){ for(var i=0;i<4;i++) analisar(window.__img,false); })()");
  ok(ev("!!atual"), "a leitura travou e abriu o painel de conferência");

  const R = JSON.parse(ev("JSON.stringify(atual? atual.R : null)"));
  ok(Array.isArray(R) && R.length === 26, "leu 26 respostas (veio " + (R?R.length:"nada") + ")");
  const emBranco = R ? R.filter(x => !x).length : 26;
  ok(emBranco === 0, "nenhuma questão saiu em branco (veio " + emBranco + " em branco)");
  const iguais = R ? R.filter((x,i) => x === marcadas[i]).length : 0;
  ok(iguais === 26, "as 26 marcações do papel foram lidas certas (veio " + iguais + ")");

  /* salvar e conferir a nota */
  ev('registrar({numero:alunoQR.numero,nome:alunoQR.nome,gab:alunoQR.gab,R:atual.R,origem:"auto",notaDisc:0})');
  const res = JSON.parse(ev('JSON.stringify(E.res.filter(r=>r.prova==="psim1"))'));
  ok(res.length === 1, "o registro do simulado foi gravado");
  ok(res[0] && res[0].acertos === 22, "22 acertos de 26 (veio " + (res[0]||{}).acertos + ")");

  console.log(falhas ? "\nteste24: " + falhas + " FALHA(S)" : "\nteste24: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 900);
