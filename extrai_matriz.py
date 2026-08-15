"""extrai_matriz.py — lê as MATRIZES DE REFERÊNCIA do SAEPE (Avaliação
Somativa 2025) e produz o banco oficial de descritores por componente e
etapa: código + descrição da habilidade.

A tabela do PDF tem duas colunas e, quando a descrição ocupa duas linhas,
o CÓDIGO fica centralizado — ou seja, aparece DEPOIS da primeira linha da
descrição. Por isso a leitura é por coordenadas: a coluna da esquerda dá o
código, a da direita dá o texto, e as linhas de texto órfãs que vierem
antes de um código pertencem a ele."""
import re, json, subprocess, xml.etree.ElementTree as ET

NS = "{http://www.w3.org/1999/xhtml}"
PDFS = {
    "LP":  "/mnt/user-data/uploads/Portugue_s_-_Matriz_de_Refere_ncia_.pdf",
    "MAT": "/mnt/user-data/uploads/Natanael_-_Matriz_de_Refere_ncia.pdf",
}
ETAPA = {
    "2º ANO DO ENSINO FUNDAMENTAL": "2EF",
    "5º ANO DO ENSINO FUNDAMENTAL": "5EF",
    "9º ANO DO ENSINO FUNDAMENTAL": "9EF",
    "3º ANO DO ENSINO MÉDIO":       "3EM",
}
limpar = lambda t: re.sub(r"\s+([,.;:])", r"\1", re.sub(r"\s+", " ", t).strip())

def linhas(pdf):
    xml = subprocess.run(["pdftotext", "-bbox-layout", pdf, "-"],
                         capture_output=True, text=True).stdout
    for pag in ET.fromstring(xml).iter(NS + "page"):
        corte = float(pag.get("width")) * 0.20      # fim da coluna do código
        for lin in pag.iter(NS + "line"):
            pal = [(float(w.get("xMin")), (w.text or "")) for w in lin.iter(NS + "word")]
            if not pal: continue
            cod = next((t for x, t in pal if x < corte and re.fullmatch(r"D\d{1,2}", t)), None)
            txt = " ".join(t for x, t in pal if x >= corte or (cod and t != cod))
            yield cod, limpar(txt)

saida = {}
for comp, pdf in PDFS.items():
    etapa, cod, buf, orfas = None, None, [], []
    def fechar():
        global cod, buf
        if etapa and cod and buf:
            saida.setdefault(comp, {}).setdefault(etapa, {})[cod] = limpar(" ".join(buf))
        cod, buf = None, []
    for c, t in linhas(pdf):
        alvo = next((v for k, v in ETAPA.items() if k in t.upper()), None)
        if alvo:
            fechar(); orfas = []; etapa = alvo; continue
        if not t and not c: continue
        if re.match(r"^DESCRITOR\b", t, re.I) or "MATRIZ DE REFER" in t.upper() \
           or "PERNAMBUCO" in t.upper():
            fechar(); orfas = []; continue
        if c:
            fechar()
            cod = "D" + str(int(c[1:]))
            buf = orfas + ([t] if t else [])
            orfas = []
            continue
        if cod: buf.append(t)
        else:   orfas.append(t)
    fechar()

for comp in sorted(saida):
    for et in sorted(saida[comp]):
        d = saida[comp][et]
        n = sorted(int(k[1:]) for k in d)
        falta = [i for i in range(1, max(n) + 1) if i not in n]
        print(f"{comp} {et}: {len(d)} descritores (D1..D{max(n)})" +
              (f" — FALTAM {falta}" if falta else ""))

json.dump(saida, open("/tmp/matriz.json", "w"), ensure_ascii=False, indent=1)
