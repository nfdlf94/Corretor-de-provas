/* planilha.js — gerador de .xlsx próprio, sem biblioteca externa.

   Por que escrever na mão: o app precisa abrir sem internet, e as
   bibliotecas de planilha custam perto de 900 KB — mais do que todo o
   resto do app junto. Um .xlsx é um zip com alguns XML dentro, e daqui
   só se precisa de pouco: várias abas, texto, número e cabeçalho em
   negrito. Nada de fórmula, gráfico ou formatação condicional.

   O que existe aqui:
     - deflate NÃO é usado: os arquivos entram no zip em modo STORE
       (método 0). Fica maior, mas o zip sai correto sem depender de
       CompressionStream, que não existe em todo navegador de celular.
     - as células de texto usam `t="inlineStr"`, o que dispensa a tabela
       de strings compartilhadas (sharedStrings.xml) inteira.
     - o CRC-32 é calculado com tabela, porque o zip exige.

   ATENÇÃO: escrever xlsx na mão só se pode dar por pronto depois de
   abrir o arquivo num leitor de verdade. O `teste25.js` gera a planilha
   e a abre com `openpyxl`, conferindo nome de aba, valor célula a
   célula, número saindo como número (não texto) e cabeçalho em negrito.
   Mexeu aqui, rode o teste 25. */
"use strict";

/* ── CRC-32 ───────────────────────────────────────────────────────── */
const CRC_TAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes){
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TAB[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const utf8 = s => new TextEncoder().encode(s);

/* ── ZIP (STORE) ──────────────────────────────────────────────────── */
function zipar(arquivos){
  const partes = [], central = [];
  let desloc = 0;

  const u16 = n => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

  arquivos.forEach(({nome, dados}) => {
    const nb = utf8(nome), crc = crc32(dados);
    const local = [].concat(
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(dados.length), u32(dados.length), u16(nb.length), u16(0));
    partes.push(new Uint8Array(local), nb, dados);
    central.push([].concat(
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(dados.length), u32(dados.length),
      u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(desloc)));
    central.push(nb);
    desloc += local.length + nb.length + dados.length;
  });

  const dirPartes = [];
  let dirTam = 0;
  for (let i = 0; i < central.length; i += 2){
    const cab = new Uint8Array(central[i]), nb = central[i+1];
    dirPartes.push(cab, nb);
    dirTam += cab.length + nb.length;
  }
  const fim = new Uint8Array([].concat(
    u32(0x06054b50), u16(0), u16(0),
    u16(arquivos.length), u16(arquivos.length), u32(dirTam), u32(desloc), u16(0)));

  const todas = partes.concat(dirPartes, [fim]);
  const total = todas.reduce((n, p) => n + p.length, 0);
  const saida = new Uint8Array(total);
  let o = 0;
  todas.forEach(p => { saida.set(p, o); o += p.length; });
  return saida;
}

/* ── XML ──────────────────────────────────────────────────────────── */
const escXml = s => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
  /* caracteres de controle não são válidos em XML e derrubam o leitor */
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

/* A1, B1, ... Z1, AA1 */
function celulaRef(col, lin){
  let s = "", n = col + 1;
  while (n > 0){ const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = ((n - r) / 26) | 0; }
  return s + (lin + 1);
}

const ehNumero = v => typeof v === "number" && isFinite(v);

/* Nome de aba: o Excel recusa > 31 caracteres e os caracteres : \ / ? * [ ] */
function nomeAba(nome, usados){
  let n = String(nome || "Planilha").replace(/[:\\\/\?\*\[\]]/g, "-").slice(0, 31).trim() || "Planilha";
  if (usados){
    let base = n, i = 2;
    while (usados.includes(n)){ const suf = " (" + i + ")"; n = base.slice(0, 31 - suf.length) + suf; i++; }
    usados.push(n);
  }
  return n;
}

function folhaXml(linhas, larguras){
  let cols = "";
  if (larguras && larguras.length)
    cols = "<cols>" + larguras.map((w, i) =>
      `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("") + "</cols>";

  const corpo = linhas.map((linha, li) => {
    const cels = (linha || []).map((v, ci) => {
      const ref = celulaRef(ci, li);
      if (v == null || v === "") return "";
      const estilo = li === 0 ? ' s="1"' : "";
      if (ehNumero(v)) return `<c r="${ref}"${estilo}><v>${v}</v></c>`;
      return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${escXml(v)}</t></is></c>`;
    }).join("");
    return `<row r="${li+1}">${cels}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${corpo}</sheetData></worksheet>`;
}

/* estilo 1 = negrito; é o único que existe, para o cabeçalho */
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* abas = [{nome, linhas:[[valor,...],...], larguras:[n,...]}] */
function montarXlsx(abas){
  const usados = [];
  const folhas = abas.map((ab, i) => ({
    nome: nomeAba(ab.nome, usados),
    xml: folhaXml(ab.linhas || [], ab.larguras),
    id: i + 1
  }));

  const arquivos = [];
  const por = (nome, txt) => arquivos.push({ nome, dados: utf8(txt) });

  por("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${folhas.map(f=>`<Override PartName="/xl/worksheets/sheet${f.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);

  por("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

  por("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${folhas.map(f=>`<sheet name="${escXml(f.nome)}" sheetId="${f.id}" r:id="rId${f.id}"/>`).join("")}</sheets>
</workbook>`);

  por("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${folhas.map(f=>`<Relationship Id="rId${f.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${f.id}.xml"/>`).join("")}
<Relationship Id="rId${folhas.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  por("xl/styles.xml", ESTILOS);
  folhas.forEach(f => por("xl/worksheets/sheet" + f.id + ".xml", f.xml));

  return zipar(arquivos);
}

/* baixa direto no navegador */
function baixarXlsx(abas, nomeArquivo){
  const bytes = montarXlsx(abas);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = nomeArquivo || "planilha.xlsx"; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
  return bytes.length;
}

if (typeof module !== "undefined") module.exports =
  { montarXlsx, baixarXlsx, zipar, crc32, celulaRef, nomeAba, folhaXml };
