"""extrai_niveis.py — lê os documentos oficiais de NÍVEIS DE DESEMPENHO e
produz o banco de habilidades ancoradas: cada habilidade com o intervalo
de pontos do nível em que o SAEPE a posiciona.

Fontes:
  Matemática (5º EF, 9º EF, 3ª EM) — Revista da Escola SAEPE 2024
  Língua Portuguesa (3º EM)        — Níveis de Desempenho LP até o 3º EM
"""
import re, json, subprocess, unicodedata

MAT = "/mnt/user-data/uploads/Caderno.pdf"
LP  = "/mnt/user-data/uploads/PE_SAEPE_-_Padro_es_de_Desempenho_LP_3EM.pdf"

ETAPA = {
    "5º ANO DO ENSINO FUNDAMENTAL": "5EF",
    "9º ANO DO ENSINO FUNDAMENTAL": "9EF",
    "3ª SÉRIE DO ENSINO MÉDIO":     "3EM",
    "3º ANO DO ENSINO MÉDIO":       "3EM",
}

def texto(pdf):
    return subprocess.run(["pdftotext", "-layout", pdf, "-"],
                          capture_output=True, text=True).stdout

def faixa(cab):
    """'DE 250 A 275 PONTOS' -> (250,275) ; 'ATÉ 200' -> (None,200) ;
       'ACIMA DE 400' -> (400,None)"""
    c = cab.upper().replace(",", "")
    m = re.search(r"DE\s+(\d+)\s+A\s+(\d+)", c)
    if m: return int(m.group(1)), int(m.group(2))
    m = re.search(r"AT[ÉE]\s+(\d+)", c)
    if m: return None, int(m.group(1))
    m = re.search(r"ACIMA\s+DE\s+(\d+)", c)
    if m: return int(m.group(1)), None
    return None, None

def limpar(t):
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s+([,.;:])", r"\1", t)
    t = re.sub(r"[\[\]]+$", "", t).strip()
    return t

def coletar(txt, comp, etapa_fixa=None):
    """percorre as linhas guardando etapa, nível e as habilidades (linhas
       que começam com o marcador 'C ')"""
    linhas = txt.split("\n")
    saida, etapa, nivel, faixa_at, buf = [], etapa_fixa, None, (None, None), None

    def fechar():
        nonlocal buf
        if buf and etapa and nivel:
            saida.append({"comp": comp, "etapa": etapa, "nivel": nivel,
                          "de": faixa_at[0], "ate": faixa_at[1],
                          "texto": limpar(buf)})
        buf = None

    for l in linhas:
        s = l.strip()
        for nome, id_ in ETAPA.items():
            if nome in s.upper():
                fechar(); etapa = id_; nivel = None
        m = re.match(r"N[ÍI]VEL\s+(\d+)\s*[–\-—]\s*(.+)$", s, re.I)
        if m:
            fechar()
            nivel = int(m.group(1)); faixa_at = faixa(m.group(2))
            continue
        if re.match(r"^C\s+\S", s):
            fechar()
            buf = s[1:].strip()
            continue
        if buf is not None:
            corte = (not s
                or re.match(r"^(N[ÍI]VEL|\d+$|Matemática|Língua)", s, re.I)
                or "SAEPE" in s.upper() or "ESCALA DE PROFICIÊNCIA" in s.upper()
                or re.match(r"^(I+V?|V?I*)\.\s", s)          # "II. Análise do indicador"
                or "PROFICIÊNCIA MÉDIA" in s.upper())
            if corte:
                fechar()
            else:
                buf += " " + s
    fechar()
    return saida

banco = coletar(texto(MAT), "MAT") + coletar(texto(LP), "LP", "3EM")

# o PDF de Matemática mistura, depois dos níveis, um texto de orientação ao
# gestor; ele não é habilidade e é reconhecível pelo verbo de comando
LIXO = re.compile(r"^(Observe|Verifique|Analise|Compare|Reflita|Considere|Identifique|Discuta|Planeje|Registre|Avalie|Estabeleça|Promova|Acompanhe) ", re.I)
banco = [h for h in banco if not LIXO.match(h["texto"])]

# remove duplicatas exatas (o PDF repete cabeçalhos entre páginas)
vistos, limpo = set(), []
for h in banco:
    k = (h["comp"], h["etapa"], h["nivel"], h["texto"])
    if k in vistos: continue
    vistos.add(k); limpo.append(h)

print("habilidades extraídas:", len(limpo))
for comp in ("LP", "MAT"):
    for et in ("5EF", "9EF", "3EM"):
        sub = [h for h in limpo if h["comp"] == comp and h["etapa"] == et]
        if sub:
            niveis = sorted({h["nivel"] for h in sub})
            print(f"  {comp} {et}: {len(sub):4d} habilidades · níveis {min(niveis)}..{max(niveis)}")

json.dump(limpo, open("/tmp/niveis.json", "w"), ensure_ascii=False, indent=1)
