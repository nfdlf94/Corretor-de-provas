# Corretor de provas — contexto do projeto

App web (PWA) hospedado no GitHub Pages que gera provas personalizadas em
PDF e corrige os cartões-resposta pela câmera do celular. Serve a qualquer
professor: o cadastro de escolas, turmas e disciplinas é feito no próprio
app, na primeira abertura.

**Não existe servidor.** Tudo roda no navegador e os dados ficam no
`localStorage` do aparelho. Não há banco de dados, login nem sincronização.

---

## Como funciona, em uma passada

1. Na primeira abertura, o assistente pergunta o nome do professor, as
   escolas, as turmas de cada escola, as disciplinas de cada turma e se
   aquela turma é bimestral ou trimestral.
2. O professor sobe a prova (foto, PDF ou Word) ou digita as questões.
3. O app gera um PDF com uma prova por aluno: questões e alternativas
   embaralhadas por aluno, e um cartão-resposta com QR e 4 marcadores.
4. O professor imprime e aplica.
5. Aponta a câmera para o cartão preenchido. O app localiza os marcadores,
   corrige a perspectiva, lê o QR (aluno + gabarito individual) e as bolhas.
6. Notas, fechamento por período e análise por habilidade.

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | O app inteiro: CSS, visão computacional, estado e telas |
| `layout.js` | Geometria do cartão-resposta (paramétrica) |
| `embaralho.js` | Embaralhamento determinístico por (turma, número) |
| `gerador.js` | Monta as provas em PDF no navegador |
| `fonte.js` | DejaVu reduzida a 296 glifos, em base64 (gerada por `sub.py`) |
| `sw.js` | Service Worker: faz o app abrir sem internet |
| `sub.py` | Gera o `fonte.js`. Rode só se precisar de novos símbolos |

Bibliotecas de terceiros, **não modificadas** (não precisa subir no chat):
`jsqr.js`, `jspdf.umd.min.js`, `qrcode.min.js`, `mammoth.browser.min.js`,
`pdf.min.js`, `pdf.worker.min.js`, e a pasta `standard_fonts/` (16 arquivos).

---

## Invariantes que não podem ser quebradas

**1. `layout.js` e a geometria do cartão.**
O scanner e o gerador precisam concordar em milímetros. Se mudar um, mude o
outro e verifique que as coordenadas normalizadas continuam idênticas.
Para 10 questões × 5 alternativas o cartão precisa continuar com
`box_w = 164`, `box_h = 52` — provas já impressas dependem disso.

**2. O QR carrega o gabarito INDIVIDUAL, não o canônico.**
`DBM4|codigo|gabarito_do_aluno|turma|numero|nome|NQxNO`
Trocar um pelo outro faz a turma inteira sair com nota errada **sem
nenhum erro aparente**. Por isso `desenharCartao()` recebe o canônico e
embaralha internamente — nunca monte o payload à mão.

**3. `embaralho.js` é espelho exato de `embaralho.py`.**
FNV-1a de 32 bits para a semente, LCG para o sorteio, aritmética `>>> 0`.
Mesma dupla (turma, número) → sempre a mesma prova. É o que permite
corrigir sabendo apenas turma e número.

**4. Convenção do embaralhamento de alternativas.**
`oa[p][k]` = índice da alternativa canônica impressa na posição `k`.
Ao gerar: `alternativas[k] = base.alternativas[oa[p][k]]`.
Ao corrigir: `letraCanonica()` desfaz.

**5. Cadastro se encerra, não se apaga.**
Escola, turma e disciplina têm `ativa`. Deixar de lecionar é `ativa:false`
— as provas, notas e fechamentos continuam existindo e visíveis. Excluir
de verdade só é oferecido enquanto não houver nada pendurado no cadastro.
O mesmo já valia para o aluno transferido (`ate` = período de saída).

**6. O calendário é da turma, não do app.**
`turma.periodo = {tipo:"bimestre"|"trimestre", qtd}`. Toda nomenclatura de
período sai de `nomePeriodo()` / `periodosDe()`, que leem a turma. Turma
bimestral nunca pode exibir “trimestre”, e vice-versa. Não existe
semestral. `qtd` normalmente é 4 ou 3, mas aceita 2 (módulo de EJA).

---

## Armadilhas já descobertas (custaram caro)

**Fontes do jsPDF só cobrem Latin-1.** `∩`, `⊂`, `√`, `π`, `³` somem — e
um caractere fora da fonte **apaga o resto da linha em silêncio**. Por isso
existe `fonte.js` e a checagem `caracteresFaltando()` antes de gerar.

**pdf.js em Node ≠ pdf.js no navegador.** No Node ele roda sem worker e as
imagens já estão prontas; no navegador só existem depois que a página é
renderizada. Testar em Node dá falso positivo. Por isso as figuras são
extraídas renderizando a página e recortando, não lendo imagens embutidas —
o que também funciona com gráficos vetoriais.

**PDF sem fontes embutidas renderiza SEM TEXTO** se `standardFontDataUrl`
não apontar para `standard_fonts/`. Tabelas saem com bordas e vazias.

**Cache do Service Worker e o cabeçalho `Vary`.** O GitHub Pages responde
com `Vary: Accept-Encoding`; sem `{ignoreVary:true}` a cópia guardada é
ignorada e o app não abre a frio sem internet. Baixar os arquivos em
paralelo também derruba os maiores — baixe em série. **Toda publicação
precisa de um `VERSAO` novo em `sw.js`**, senão o aparelho continua
servindo o `index.html` velho.

**Filtro de ruído em PDF.** Normalizar números para achar cabeçalho
repetido faz `A) f(x) = 3x + 6` e `A) f(x) = 5x + 4` virarem a mesma linha,
e alternativas somem. Só olhe as 2 primeiras e 2 últimas linhas da página.
Pelo mesmo motivo, linhas que começam com letra de alternativa ou número de
questão nunca podem ser tratadas como tabela.

**Redesenhos atrasados.** `setTimeout` que redesenha uma tela precisa
conferir se o usuário ainda está nela; senão puxa a pessoa de volta e
apaga o que estava em andamento.

**Telas que se redesenham inteiras perdem o foco do teclado.** No
assistente e no editor de turma, sincronize os `<input>` no objeto de
estado a cada `oninput` e só redesenhe quando a quantidade de campos mudar.

**Limiares da visão que foram ajustados e devem ficar:** tamanho mínimo do
marcador `5e-4` (era `8e-4`, não achava o cartão com muita margem branca) e
amostragem **bilinear** na retificação do QR (era vizinho mais próximo, que
serrilha os módulos e impede a decodificação). Com os dois, a leitura passou
de 10 para 14 acertos em 14 cenários de foto adversa.

---

## Modelo de dados (`localStorage`, chave `dbm_omr_v6`)

```
E = {
  v: 6,
  escolas: [{id, nome, curto, ativa}],
  turmas:  [{id, escola, nome, serie, ativa,
             disciplinas:[{id, nome, ativa}],
             disciplina,                       // só espelho do nome da 1ª
             periodo:{tipo:"trimestre"|"bimestre", qtd},
             alunos:[{numero, nome, desde, ate}]}],
  provas:  [{id, turma, disciplina, codigo, titulo, periodo, nq, no, gabC,
             habs[], pontosObj, pontosDisc,
             questoes:[{enunciado, alternativas[], correta, imagem}],
             discursivas:[{enunciado, pontos, linhas}]}],
  ativa: provaId,
  res:    [{prova, turma, numero, nome, R[], Rc[], gab, acertos, erros,
            certas[], erradas[], notaDisc, nota, origem, t}]
}
```
`R` = respostas na ordem impressa. `Rc` = as mesmas na ordem canônica.
`prova.disciplina` é o **id** de uma disciplina daquela turma — é o que
liga a prova à combinação escola + turma + disciplina.
Aluno transferido **nunca é apagado** (`ate` = período de saída), senão o
fechamento dos períodos anteriores se perde.

`migrarV6()` sobe qualquer estado v4/v5 (inclusive de cópia de segurança
importada): cria a lista de disciplinas a partir do campo antigo e liga
cada prova à primeira delas. Nada é descartado no caminho.

Chaves separadas: `dbm_chave_api`, `dbm_professor`, `dbm_ultimo_backup`,
`dbm_setup_v6` (assistente já concluído). A chave de API fica **fora** do
backup exportado, de propósito.

---

## Regras de diagramação da prova

Cabeçalho com escola e período, quadro ALUNO(A)/TURMA/Nº, linha de
disciplina e professor, cartão-resposta no alto, questões em **duas
colunas** equilibradas, rascunho no espaço que sobrar.

Corpo de texto: **10,5 pt, piso de 10 pt**. O app escolhe o tamanho que
resulta no **menor número de páginas**; empate, letra maior. Nunca gasta
uma página só para o rascunho.

Alcance atual: 5–6 questões em 1 página, 7–14 em 2, 15–20 em 3.

---

## Navegação

**Turmas:** escola › turma › disciplina › provas do período › prova.
Os estudantes ficam na turma (valem para todas as disciplinas dela).

**Notas:** escola › turma › disciplina › período › média do período, com
as provas daquele período logo acima e o detalhe por prova um toque à
frente. Os períodos oferecidos são os da turma escolhida.

**Configurações › Escolas, turmas e disciplinas:** acrescentar, renomear,
encerrar e reativar qualquer nível, e trocar o calendário da turma.

---

## O que já funciona

Assistente de configuração inicial, cadastro de escolas/turmas/disciplinas
por turma/calendário por turma, entrada e saída de alunos, criação de prova
por digitação ou por arquivo (Word e PDF lidos localmente, de graça; foto
pela API da Claude), extração de gráficos e tabelas do PDF, geração de
provas e de folhas de cartões, leitura por câmera, correção manual, notas
por escola/turma/disciplina/período, fechamento por período, análise por
habilidade com parecer automático, exportação CSV, cópia de segurança e uso
offline.

## O que não existe

Discursivas com correção automática, várias figuras por questão,
sincronização entre aparelhos, qualquer coisa em servidor.
