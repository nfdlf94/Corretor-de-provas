/* teste27.js — as telas novas dentro do app: a tela de Evolução por
   descritor e os dois botões de planilha. Aqui o .xlsx é gerado pelo app
   de verdade (planilha.js carregado no index.html), gravado em disco e
   aberto com openpyxl — o mesmo critério do teste25. */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

function caderno(E, id, titulo, criado, comps, descs, gab){
  const letras = ["A","B","C","D","E"];
  E.provas.push({ id:"p"+id, turma:"t1", disciplina:null, codigo:id.toUpperCase(),
    titulo, periodo:null, nq:comps.length, no:5, gabC:gab.join(""), simulado:id,
    comps, desc:descs, orig:comps.map((c,i)=>i+1), gabItens:gab.slice(), habs:[],
    questoes: comps.map((c,i)=>({enunciado:id+" item "+(i+1),
      alternativas:letras.map(L=>"alt "+L), correta:letras.indexOf(gab[i]), imagem:null})),
    discursivas:[], criada:criado });
  E.simulados.push({ id, turma:"t1", titulo, etapa:"3EM", ano:2026, prova:"p"+id,
    metodo:"pct", alternarBlocos:true, tipos:0,
    qtd:{LP:comps.filter(c=>c==="LP").length, MAT:comps.filter(c=>c==="MAT").length},
    fontes:{}, criado, valorParticipacao:1.25, partAluno:{} });
}
function resultado(E, pid, numero, nome, certos){
  const pr = E.provas.find(p=>p.id===pid), g = pr.gabC;
  const Rc = certos.map((c,i)=> c ? g[i] : (g[i]==="A"?"B":"A"));
  E.res.push({ prova:pid, turma:"t1", numero, nome, R:Rc.slice(), Rc, gab:g,
    acertos:certos.filter(Boolean).length, erros:0, certas:[], erradas:[],
    notaDisc:0, nota:0, origem:"manual", t:Date.now() });
}

function estado(){
  const E = H.estadoBase(3);
  E.turmas[0].alunos[0].nome = "Ana Beatriz de Sá";
  E.turmas[0].alunos[1].nome = 'João "Juca" Nóbrega';
  E.turmas[0].alunos[2].nome = "Carla <Luíza> & cia";
  E.descritores = {
    LP:{ D1:"Localizar informação explícita", D3:"Identificar a tese" },
    MAT:{ D1:"Resolver problema com porcentagem", D7:"Área de figuras planas" } };
  caderno(E,"s1","1º Simulado",1000, ["LP","LP","LP","LP","MAT","MAT"],
    ["D1","D1","D3","D3","D1","D1"], ["A","B","C","D","E","A"]);
  caderno(E,"s2","2º Simulado",2000, ["LP","LP","MAT","MAT","MAT","MAT"],
    ["D1","D1","D1","D1","D7","D7"], ["B","C","D","E","A","B"]);
  resultado(E,"ps1","01","Ana Beatriz de Sá",      [1,0,0,0,1,1]);
  resultado(E,"ps2","01","Ana Beatriz de Sá",      [1,1,1,1,0,0]);
  resultado(E,"ps1","02",'João "Juca" Nóbrega',    [0,0,1,1,1,0]);
  resultado(E,"ps2","02",'João "Juca" Nóbrega',    [0,0,0,0,1,1]);
  resultado(E,"ps1","03","Carla <Luíza> & cia",    [1,1,1,1,1,1]);
  return E;
}

/* captura os downloads: o app usa URL.createObjectURL + a.click() */
const baixados = [];
const { win } = H.abrirApp({
  estado: estado(),
  antes(w){
    w.URL.createObjectURL = blob => { w.__ultimoBlob = blob; return "blob:teste"; };
    w.URL.revokeObjectURL = () => {};
    const criar = w.document.createElement.bind(w.document);
    w.document.createElement = function(tag){
      const el = criar(tag);
      if (String(tag).toLowerCase() === "a")
        el.click = function(){ baixados.push({ nome: el.download, blob: w.__ultimoBlob }); };
      return el;
    };
  }
});
const ev = s => win.eval(s);

async function bytesDo(blob){
  const buf = await blob.arrayBuffer();
  return Buffer.from(buf);
}

function conferirComOpenpyxl(arq){
  const script = `
import json
from openpyxl import load_workbook
wb = load_workbook(${JSON.stringify(arq)})
s = {"abas": wb.sheetnames, "cel": {}, "tipos": {}, "negrito": {}}
for nome in wb.sheetnames:
    ws = wb[nome]
    for linha in ws.iter_rows():
        for c in linha:
            if c.value is None: continue
            k = nome + "!" + c.coordinate
            s["cel"][k] = c.value
            s["tipos"][k] = type(c.value).__name__
            s["negrito"][k] = bool(c.font and c.font.bold)
print(json.dumps(s, ensure_ascii=False))
`;
  return JSON.parse(execFileSync("python3", ["-c", script], { encoding:"utf8" }));
}

setTimeout(async () => {
  console.log("teste27 — telas novas e planilhas geradas pelo app");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script (" +
     (win.__jsdomErros[0]||"") + ")");
  ok(ev('typeof montarXlsx') === "function", "planilha.js foi carregado pelo index.html");
  const avisos = [...win.document.querySelectorAll(".aviso")].map(x=>x.textContent).join(" ");
  ok(!/Faltou carregar/.test(avisos), "conferirPecas não reclama de peça faltando");

  /* ── tela de evolução ── */
  ev('casaTurma="t1"; casaNivel="simulados"; montarCasa();');
  const corpo = () => win.document.getElementById("casaCorpo");
  ok(!!win.document.getElementById("bEvolucao"), "a lista de simulados tem a entrada de Evolução");
  win.document.getElementById("bEvolucao").click();
  ok(ev("casaNivel") === "evolucao", "abriu a tela de evolução");

  const texto = corpo().textContent.replace(/\s+/g, " ");
  ok(/Evolução por descritor/.test(texto), "título da tela");
  ok(/comparação com a última vez/.test(texto), "explica o critério de comparação");
  ok(/Ana Beatriz de Sá/.test(texto), "lista os estudantes");
  ok(/Dificuldade persistente/.test(texto), "seção de dificuldade persistente");
  ok(/João "Juca" Nóbrega/.test(texto), "nome com aspas escapado corretamente na tela");

  /* alternar componente */
  const botoesComp = corpo().querySelectorAll("[data-comp]");
  ok(botoesComp.length === 2, "dois componentes para escolher");
  botoesComp[1].click();
  ok(ev("evolComp") === "MAT", "trocou para Matemática");
  const txtMat = corpo().textContent.replace(/\s+/g," ");
  ok(/Área de figuras planas/.test(txtMat), "mostra descritor só de Matemática");
  ok(!/Identificar a tese/.test(txtMat), "não mistura descritor de Português");
  botoesComp[0].click();

  /* ── planilha da evolução ── */
  win.document.getElementById("evolXlsx").click();
  ok(baixados.length === 1, "o botão baixou um arquivo");
  const bx = baixados[0];
  ok(/^evolucao_.*\.xlsx$/.test(bx.nome || ""), "nome do arquivo: " + bx.nome);

  const arq1 = path.join(os.tmpdir(), "teste27_evolucao.xlsx");
  fs.writeFileSync(arq1, await bytesDo(bx.blob));
  let R1;
  try { R1 = conferirComOpenpyxl(arq1); }
  catch(e){ console.log("  FALHA  openpyxl não abriu a planilha da evolução:\n" + (e.stderr||e.message)); falhas++; }

  if (R1){
    ok(R1.abas.length === 3, "3 abas na planilha da evolução (" + R1.abas.join(" | ") + ")");
    ok(R1.abas[0] === "Evolução por estudante", "1ª aba: evolução por estudante");
    ok(R1.abas[1] === "Resumo por descritor", "2ª aba: resumo por descritor");
    ok(R1.abas[2] === "Simulados considerados", "3ª aba: simulados considerados");
    const A = R1.abas[0];
    ok(R1.negrito[A+"!A1"] === true, "cabeçalho em negrito");
    ok(R1.cel[A+"!A2"] === "01", "número do estudante como texto, com zero à esquerda");
    ok(R1.tipos[A+"!A2"] === "str", "tipo texto no número do estudante");
    /* acha a linha da Ana em LP D1: 50% → 100% */
    const chaveAna = Object.keys(R1.cel).filter(k => k.startsWith(A+"!") &&
      R1.cel[k] === "Localizar informação explícita");
    ok(chaveAna.length >= 1, "a descrição do descritor foi para a planilha");
    const linhaAna = chaveAna.map(k => +k.split("!")[1].replace(/\D/g,""))
      .find(l => R1.cel[A+"!A"+l] === "01");
    ok(!!linhaAna, "linha da Ana localizada");
    if (linhaAna){
      ok(R1.cel[A+"!G"+linhaAna] === 100, "acerto atual 100 (veio " + R1.cel[A+"!G"+linhaAna] + ")");
      ok(["int","float"].includes(R1.tipos[A+"!G"+linhaAna]), "acerto atual é NÚMERO");
      ok(R1.cel[A+"!H"+linhaAna] === 50, "acerto anterior 50");
      ok(R1.cel[A+"!I"+linhaAna] === 50, "diferença +50 p.p.");
      ok(R1.cel[A+"!J"+linhaAna] === "melhorou", "situação: melhorou");
    }
    /* descritor não avaliado num simulado não vira 0 */
    const valores = Object.keys(R1.cel).filter(k => k.startsWith(A+"!E"))
      .map(k => R1.cel[k]);
    ok(valores.includes("D3"), "LP D3 está na planilha");
    const B = R1.abas[1];
    ok(R1.negrito[B+"!A1"] === true, "cabeçalho da 2ª aba em negrito");
  }

  /* ── planilha do simulado ── */
  baixados.length = 0;
  ev('casaSim="s1"; casaNivel="relSaepe"; montarCasa();');
  ok(!!win.document.getElementById("relXlsx"), "a tela de resultados tem o botão de planilha");
  win.document.getElementById("relXlsx").click();
  ok(baixados.length === 1, "planilha do simulado baixada");

  if (baixados.length){
    const arq2 = path.join(os.tmpdir(), "teste27_simulado.xlsx");
    fs.writeFileSync(arq2, await bytesDo(baixados[0].blob));
    let R2;
    try { R2 = conferirComOpenpyxl(arq2); }
    catch(e){ console.log("  FALHA  openpyxl não abriu a planilha do simulado:\n" + (e.stderr||e.message)); falhas++; }
    if (R2){
      ok(R2.abas.length === 3, "3 abas na planilha do simulado (" + R2.abas.join(" | ") + ")");
      ok(R2.abas[0] === "Resultados individuais", "1ª aba: resultados individuais");
      ok(R2.abas[1] === "Descritores", "2ª aba: descritores");
      ok(/^Análise/.test(R2.abas[2]), "3ª aba: análise do recorte");
      const A = R2.abas[0], B = R2.abas[1], C = R2.abas[2];
      ok(R2.cel[A+"!B2"] === "Ana Beatriz de Sá", "nome com acento na planilha");
      ok(R2.cel[A+"!B3"] === 'João "Juca" Nóbrega', "nome com aspas preservado");
      ok(R2.cel[A+"!B4"] === "Carla <Luíza> & cia", "nome com < e & preservado");
      ok(R2.negrito[A+"!A1"] && R2.negrito[B+"!A1"] && R2.negrito[C+"!A1"],
         "cabeçalho em negrito nas três abas");
      const profs = Object.keys(R2.cel).filter(k => k.startsWith(A+"!E") && k !== A+"!E1");
      ok(profs.length > 0 && profs.every(k => ["int","float"].includes(R2.tipos[k])),
         "as proficiências saíram como NÚMERO");
      ok(R2.cel[B+"!C2"] && typeof R2.cel[B+"!C2"] === "string",
         "a aba de descritores traz a descrição por extenso");
      const criticos = Object.keys(R2.cel).filter(k => k.startsWith(C+"!H"));
      ok(criticos.length >= 1, "a análise traz a coluna de descritores críticos");
    }
  }

  console.log(falhas ? "\nteste27: " + falhas + " FALHA(S)" : "\nteste27: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1000);
