/* teste25.js — valida o gerador de .xlsx abrindo o arquivo de verdade.
   Gera a planilha com planilha.js, grava em disco e chama o openpyxl
   (via python3) para conferir nome das abas, valor célula a célula,
   número saindo como número — e não como texto — e cabeçalho em negrito.
   Escrever xlsx na mão só se pode dar por pronto assim. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { montarXlsx, celulaRef, nomeAba } = require("./planilha.js");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

console.log("teste25 — gerador de .xlsx validado com openpyxl");

/* ── unidades ─────────────────────────────────────────────────────── */
ok(celulaRef(0,0) === "A1", "A1");
ok(celulaRef(25,0) === "Z1", "Z1");
ok(celulaRef(26,4) === "AA5", "AA5");
ok(nomeAba("Análise por turma/série").indexOf("/") < 0, "nome de aba sem barra");
ok(nomeAba("x".repeat(50)).length === 31, "nome de aba cortado em 31");
const us = [];
nomeAba("Resultados", us); ok(nomeAba("Resultados", us) === "Resultados (2)", "aba repetida ganha sufixo");

/* ── a planilha de verdade ────────────────────────────────────────── */
const abas = [
  { nome: "Resultados individuais",
    larguras: [8, 28, 14, 14, 13, 9],
    linhas: [
      ["nº","Estudante","Proficiência LP","Proficiência MAT","Participação","Nota"],
      ["01","Ana Beatriz de Sá", 268.4, 301.2, 1.25, 8.5],
      ["02","João \"Juca\" Nóbrega & filho", 231.07, null, 0.9, 6.25],
      ["03","Maria Luíza <3", null, 288.5, 0, 0]
    ]},
  { nome: "Descritores",
    linhas: [
      ["Componente","Descritor","Descrição","Acerto (%)","Itens"],
      ["Língua Portuguesa","D3","Identificar a tese de um texto", 41.67, 2],
      ["Matemática","D1","Resolver problema com porcentagem", 75, 3]
    ]},
  { nome: "Análise por turma/série",
    linhas: [
      ["Recorte","Componente","Média","Padrão","Descritores críticos"],
      ["3A","Língua Portuguesa", 254.3, "Básico", "D3, D12"],
      ["3º EM","Matemática", 268.91, "Básico", "D4"]
    ]}
];

const bytes = montarXlsx(abas);
const arq = path.join(require("os").tmpdir(), "teste25_planilha.xlsx");
fs.writeFileSync(arq, Buffer.from(bytes));
ok(bytes.length > 0, "arquivo gerado (" + bytes.length + " bytes)");
ok(Buffer.from(bytes.slice(0,2)).toString() === "PK", "assinatura de zip (PK)");

const script = `
import json, sys
from openpyxl import load_workbook
wb = load_workbook(${JSON.stringify(arq)})
saida = {"abas": wb.sheetnames, "cel": {}, "tipos": {}, "negrito": {}, "larg": {}}
for nome in wb.sheetnames:
    ws = wb[nome]
    for linha in ws.iter_rows():
        for c in linha:
            if c.value is None: continue
            saida["cel"][nome + "!" + c.coordinate] = c.value if not isinstance(c.value, float) else round(c.value, 6)
            saida["tipos"][nome + "!" + c.coordinate] = type(c.value).__name__
            saida["negrito"][nome + "!" + c.coordinate] = bool(c.font and c.font.bold)
    saida["larg"][nome] = {k: v.width for k, v in ws.column_dimensions.items()}
print(json.dumps(saida, ensure_ascii=False))
`;

let R;
try{
  R = JSON.parse(execFileSync("python3", ["-c", script], { encoding: "utf8" }));
}catch(e){
  console.log("  FALHA  openpyxl não conseguiu abrir o arquivo:\n" + (e.stderr || e.message));
  process.exit(1);
}

ok(R.abas.length === 3, "três abas (veio " + R.abas.length + ")");
ok(R.abas[0] === "Resultados individuais", "1ª aba: " + R.abas[0]);
ok(R.abas[1] === "Descritores", "2ª aba: " + R.abas[1]);
ok(R.abas[2] === "Análise por turma-série", "3ª aba sem a barra: " + R.abas[2]);

const A = R.abas[0], B = R.abas[1], C = R.abas[2];
const cel = k => R.cel[k], tipo = k => R.tipos[k], neg = k => R.negrito[k];

/* célula a célula, na aba de resultados */
ok(cel(A+"!A1") === "nº", "A1 = nº");
ok(cel(A+"!F1") === "Nota", "F1 = Nota");
ok(cel(A+"!B2") === "Ana Beatriz de Sá", "acentuação preservada");
ok(cel(A+"!B3") === 'João "Juca" Nóbrega & filho', "aspas e & preservados");
ok(cel(A+"!B4") === "Maria Luíza <3", "sinal de menor preservado");
ok(cel(A+"!A2") === "01", "o número do estudante fica TEXTO, com o zero à esquerda");
ok(tipo(A+"!A2") === "str", "tipo de A2 é texto (veio " + tipo(A+"!A2") + ")");

/* número tem de sair número, não texto */
ok(cel(A+"!C2") === 268.4, "proficiência 268.4");
ok(["int","float"].includes(tipo(A+"!C2")), "C2 é NÚMERO (veio " + tipo(A+"!C2") + ")");
ok(["int","float"].includes(tipo(A+"!E2")), "participação é número (veio " + tipo(A+"!E2") + ")");
ok(cel(A+"!C3") === 231.07, "231.07 sem perder casas");
ok(R.cel[A+"!D3"] === undefined, "célula vazia continua vazia (null não vira 0)");
ok(cel(B+"!D3") === 75 && ["int","float"].includes(tipo(B+"!D3")), "inteiro 75 é número");

/* zero é valor, não vazio */
ok(cel(A+"!E4") === 0, "participação 0 foi gravada (não sumiu)");
ok(cel(A+"!F4") === 0, "nota 0 foi gravada");

/* cabeçalho em negrito, corpo não */
ok(neg(A+"!A1") && neg(A+"!F1"), "cabeçalho da 1ª aba em negrito");
ok(neg(B+"!A1") && neg(C+"!A1"), "cabeçalho das outras abas em negrito");
ok(!neg(A+"!B2") && !neg(B+"!C2"), "corpo NÃO está em negrito");

/* demais abas */
ok(cel(B+"!C2") === "Identificar a tese de um texto", "descrição do descritor");
ok(cel(C+"!E2") === "D3, D12", "descritores críticos da turma");
ok(cel(C+"!A3") === "3º EM", "recorte de série");

/* larguras de coluna */
ok(R.larg[A] && Object.keys(R.larg[A]).length === 6, "as 6 larguras chegaram na 1ª aba");

console.log(falhas ? "\nteste25: " + falhas + " FALHA(S)" : "\nteste25: tudo certo");
process.exit(falhas ? 1 : 0);
