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

São **dois perfis**, escolhidos por `nq`: até 20 questões o clássico, de
sempre (duas colunas); acima disso o **compacto**, de três colunas, passo
5,6 mm e raio 1,9 mm. No perfil clássico um caderno de 30 itens ficava com
124 mm de altura — quase metade da folha; no compacto são 63 mm, 24,7% da
página com a zona de silêncio. **Mudar o limite de 20 invalida os cartões
já impressos naquela faixa**, porque o scanner reconstrói a geometria a
partir de `nq`: um cartão de 15 questões impresso no perfil antigo deixa de
ser lido se 15 passar a ser compacto.

**2. O QR carrega o gabarito INDIVIDUAL, não o canônico.**
`DBM4|codigo|gabarito_do_aluno|turma|numero|nome|NQxNO`
Trocar um pelo outro faz a turma inteira sair com nota errada **sem
nenhum erro aparente**. Por isso `desenharCartao()` recebe o canônico e
embaralha internamente — nunca monte o payload à mão.

**3. Ordem impressa = ordem do QR.**
`ordemDaProva()` (gerador) e `ordemDe()` (app) precisam devolver a mesma
coisa. No caderno de simulado as questões saem **agrupadas por componente**
— `embaralharEmBlocos()` sorteia como sempre e depois junta os blocos. Com
`alternarBlocos` (padrão), o bloco que ABRE a prova também é sorteado por
(turma, número): um estudante começa por Língua Portuguesa, o vizinho por
Matemática. Só depende de (turma, número, `comps`, `alternar`), então o
corretor reconstrói igual.

Isso significa que `desenharCartao()` precisa receber `comps` e `alternar`
em **todos** os pontos de chamada — `fluir()` e `gerarFolhasDeCartoes()`.
Faltou em `fluir()` na primeira versão: as questões saíam em blocos e o QR
era montado sem eles, ou seja, cada cartão carregava o gabarito de uma
prova que não existia. Não dá erro, não dá aviso: a turma inteira sai com
nota errada. O teste que pega isso é o `teste12`, que espiona o que
`qrcode.addData()` recebeu de verdade e confere contra a ordem impressa.

Alternar os blocos só serve para **aplicação em dia único**. Trocar essa
chave depois de imprimir invalida os cartões já distribuídos — a tela pede
confirmação.

**4. `embaralho.js` é espelho exato de `embaralho.py`.**
FNV-1a de 32 bits para a semente, LCG para o sorteio, aritmética `>>> 0`.
Mesma dupla (turma, número) → sempre a mesma prova. É o que permite
corrigir sabendo apenas turma e número.

**5. Convenção do embaralhamento de alternativas.**
`oa[p][k]` = índice da alternativa canônica impressa na posição `k`.
Ao gerar: `alternativas[k] = base.alternativas[oa[p][k]]`.
Ao corrigir: `letraCanonica()` desfaz.

**6. Cadastro se encerra, não se apaga.**
Escola, turma e disciplina têm `ativa`. Deixar de lecionar é `ativa:false`
— as provas, notas e fechamentos continuam existindo e visíveis. Excluir
de verdade só é oferecido enquanto não houver nada pendurado no cadastro.
O mesmo já valia para o aluno transferido (`ate` = período de saída).

**7. O caderno do simulado é uma prova comum.**
Um Simulado SAEPE tem UM caderno: um registro de `E.provas` marcado com
`simulado`, em que `comps[i]` diz se o item `i` é de Língua Portuguesa ou
de Matemática. É isso que faz
geração, cartão, QR, leitura e correção continuarem valendo sem cópia de
código. Em troca, **todo filtro de prova precisa excluir cadernos**:
`provasDe()` já faz isso, e é por ali que passam a lista de provas, o
fechamento e a aba Notas. Caderno não tem `periodo` nem `disciplina` — não
entra na média de bimestre nenhum.

**8. O calendário é da turma, não do app.**
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

**Linha em branco não encerra enunciado.** O Word separa parágrafos por
linha vazia, e o leitor tratava isso como fim do enunciado: uma questão que
começava com "Leia o texto." saía impressa **só com essa frase** — o texto
de apoio inteiro sumia em silêncio. Hoje a linha vazia vira quebra de
parágrafo dentro do enunciado e só encerra a continuação de uma
alternativa.

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

## Simulados SAEPE

Estrutura: **Turma › Simulados SAEPE › Criar simulado**. Cada simulado fixa
uma etapa (5º EF, 9º EF ou 3º EM) e cria **um caderno**, com a quantidade
de itens de cada componente escolhida na hora (padrão 13 + 13; o cartão
comporta até 30 no total). Cada item carrega o componente e o descritor.

**Apuração é sempre separada por componente**, como o boletim do SAEPE:
para cada um sai proficiência média, padrão médio, participação, a
distribuição da turma pelos quatro padrões (em % e em número), o acerto
por descritor e a lista de estudantes. Cada uma medida só pelos itens
daquele componente — por isso a classificação é proporcional ao número de
itens do componente, não do caderno. O banco de descritores também é por
componente: `D17` é "relações lógico-discursivas" em Língua Portuguesa e
"equação do 2º grau" em Matemática, e não podem se misturar.

**Item que não separa** é sinalizado pela correlação item-total (`r`),
abaixo de 0,20 — o limiar usado na literatura. Sinalizar pelo `a` do
modelo, como fiz na primeira versão, marcava quase todos os itens: `a` só
passa de 0,6 quando `r` passa de 0,51, que é altíssimo.

Pontos de corte dos padrões (Elementar I, Elementar II, Básico, Desejável),
oficiais, da Revista do Professor SAEPE 2018:

| Etapa | Língua Portuguesa | Matemática |
|---|---|---|
| 5º EF | 125 / 175 / 210 | 150 / 185 / 220 |
| 9º EF | 200 / 235 / 270 | 225 / 245 / 280 |
| 3º EM | 225 / 270 / 305 | 250 / 290 / 325 |

### Os dois métodos de proficiência

**TRI de 3 parâmetros (padrão).** É o modelo do Saeb:

`P(acertar | θ) = c + (1 − c) / (1 + e^(−1,7·a·(θ − b)))`

- `c` = 1/nº de alternativas (0,2), fixo — é a correção do chute.
- `b` (dificuldade) e `a` (discriminação) vêm da conversão clássica de
  Lord, calculada sobre as respostas da turma: `b = z/r` com
  `z = Φ⁻¹(1 − p*)` e `p*` a proporção de acerto já descontado o chute;
  `a = r/√(1 − r²)`, com `r` = correlação do item com o desempenho no
  RESTO da prova. Limites: `a ∈ [0,4 · 2,5]`, `b ∈ [−3 · 3]`.
- `θ` de cada estudante por máximo a posteriori (prior N(0,1)), busca em
  grade de −4 a 4. Grade em vez de Newton porque não diverge com acerto
  total nem com zero.

O que isso muda em relação ao Rasch que havia antes: **o número de acertos
deixa de ser estatística suficiente**. Item que poucos acertaram pesa mais;
item que não separou ninguém quase não conta; e acertar os difíceis errando
os fáceis é um padrão improvável, que a verossimilhança atribui ao chute.
Em uma turma de teste, dois estudantes com 6 de 12 acertos ficaram 91
pontos de escala distantes por causa do padrão de resposta.

**Percentual.** `(acerto − 1/5) / (1 − 1/5)` projetado na faixa da etapa.
Entra sozinho quando há menos de 8 cartões corrigidos ou menos de 5 itens
no componente — com pouca gente a calibração não se sustenta.

### A âncora, que é o limite real

Sem itens âncora com parâmetros da rede, **nenhuma conta acerta o ponto da
escala oficial**. Pior: se `θ` fosse padronizado na própria turma, toda
turma sairia com a mesma média e uma turma fraca pareceria mediana.

Por isso a escala é montada assim: o **nível da turma** vem do acerto
absoluto (o método percentual aplicado à média de acertos), e a TRI
**distribui os estudantes em torno desse centro**, a 50 pontos por
desvio-padrão de θ — a mesma unidade do Saeb. Mexer nisso sem entender o
problema da âncora vai produzir números que parecem oficiais e não são.

### Nota de participação

Uma pontuação de apoio, **proporcional aos acertos no caderno inteiro**:
`valor × acertos / nq`, arredondada a duas casas. O valor máximo fica em
`sm.valorParticipacao` (padrão 1 ponto) e é editável na tela do simulado.

Quem não fez o simulado fica com nota **nula, não zero** — zero é resultado
de quem fez e errou; ausência é ausência, e o professor decide o que fazer
com ela.

Continua **fora da média do período**, como todo o resto do simulado: a
lista e o CSV existem para o professor lançar a pontuação onde quiser. O
CSV traz os acertos quebrados por componente, para quem só quer pontuar a
própria disciplina.

### A quantidade pedida manda

`sm.qtd = {LP, MAT}` é a regra do simulado, definida na criação — **não** a
quantidade que vem no arquivo. `selecionarItens()` resolve os três casos:
arquivo com mais questões sorteia (Fisher-Yates, nunca as primeiras), com a
quantidade exata usa todas sem sortear, e com menos **recusa** e devolve
`erro` com a mensagem pronta. Mudar a quantidade depois chama
`ajustarQuantidade()`, que corta ou abre vagas em branco só naquele
componente.

O item viaja inteiro: enunciado, alternativas, gabarito, descritor e
`orig` — o número que a questão tinha no arquivo, guardado em `pr.orig[]` e
mostrado na tela de conferência. Separar qualquer um desses do resto faz a
correção e a análise por descritor apontarem para a questão errada.

**O sorteio acontece UMA vez**, na importação, e fica gravado em `pr.orig`,
`pr.questoes`, `pr.gabItens` e `pr.desc`. O botão da etapa 6 só navega para
a tela de geração — não seleciona nada. Gerar de novo devolve cadernos
idênticos, porque o embaralhamento é determinístico por (turma, número) ou
por tipo. `sm.geradoEm` guarda a primeira geração para a tela poder dizer
isso: o professor precisa saber que reimprimir a prova de quem faltou não
bagunça a turma.

### Tipos de prova

`sm.tipos`: 0 é um caderno por estudante (mais seguro, uma impressão por
aluno); N distribui os estudantes em N tipos por `tipoDoAluno()`, de modo
que números vizinhos caem em tipos diferentes. Com tipos, a semente do
embaralhamento deixa de ser o número do aluno e passa a ser `"TIPO n"`
(`chaveDeOrdem()`) — em gerador e corretor, senão o cartão descasa da
prova. Todos os tipos usam **as mesmas questões selecionadas**; muda só a
organização.

### Subir o caderno de arquivo

**Turma › Simulados SAEPE › o simulado › Subir arquivo do caderno**, um
arquivo por componente (Word, PDF de texto ou txt). O documento traz, nesta
ordem: as questões numeradas com alternativas A) a E), uma linha
`GABARITO` com a lista `1. C`, e uma linha `DESCRITORES` com

```
D01 — texto da habilidade — Questões: 1, 5
```

As questões são lidas pelo **mesmo** `lerQuestoes()` das provas comuns —
`lerSimuladoDoc()` só fatia o documento nos três blocos e devolve gabarito
e descritores. Os textos dos descritores entram no banco daquele
componente; `codDesc()` normaliza `D01`, `d1` e `D 1` para `D1`, de modo
que o que veio do arquivo e o que foi digitado à mão sejam o mesmo
descritor.

`aplicarImportacao()` substitui os itens de UM componente e preserva os do
outro, remontando o caderno sempre na ordem Língua Portuguesa → Matemática.
Reimportar muda a ordem dos itens e **invalida as correções já feitas** — o
app avisa e pede confirmação.

**Armadilha que já custou caro:** o caderno tem quatro arrays paralelos
(`questoes`, `comps`, `desc`, `gabItens`) que precisam ter SEMPRE o tamanho
de `nq`, com item em branco onde ainda não há questão. Na primeira versão,
`questoes` era esvaziado enquanto faltasse algum item; ao importar o
segundo componente, o primeiro era lido desse array vazio e **as questões
já importadas sumiam em silêncio** — o professor só descobria na hora de
gerar, com "faltam questões" e nada saindo. Por isso todo acesso passa por
`itensDoCaderno()` / `gravarCaderno()`, que mantêm o alinhamento, e o que
decide se dá para gerar é `faltasDoCaderno()`, não o tamanho do array.

Os descritores ficam em `E.descritores[comp]` (código → texto), digitados
uma vez e reaproveitados. O item guarda só o código em `desc[]`, e `habs[]`
é regerado a partir dele — assim a análise por habilidade que já existia
funciona no simulado sem alteração nenhuma.

## Modelo de dados (`localStorage`, chave `dbm_omr_v8`)

```
E = {
  v: 8,
  escolas: [{id, nome, curto, ativa}],
  turmas:  [{id, escola, nome, serie, ativa,
             disciplinas:[{id, nome, ativa}],
             disciplina,                       // só espelho do nome da 1ª
             periodo:{tipo:"trimestre"|"bimestre", qtd},
             alunos:[{numero, nome, desde, ate}]}],
  simulados:[{id, turma, titulo, etapa:"5EF"|"9EF"|"3EM", ano,
             prova:provaId, metodo:"tri"|"pct", alternarBlocos, tipos,
             qtd:{LP,MAT}, fontes:{LP:{nome,encontradas,usadas,sorteadas}},
             valorParticipacao}],
  descritores:{LP:{D1:"texto"}, MAT:{...}},
  provas:  [{id, turma, disciplina, codigo, titulo, periodo, nq, no, gabC,
             simulado, comps[], desc[], orig[], gabItens[],  // só no caderno
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

`migrarV6()` sobe qualquer estado v4 a v7 (inclusive de cópia de segurança
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

**Teto de 4 páginas por estudante** (`MAX_PAGINAS`). Só se 10 pt estourar
esse teto é que a letra desce para 9,5 e 9 pt — apertar a letra é menos
ruim do que uma quinta folha. Se nem assim couber, o app gera mesmo assim e
avisa na tela quantas páginas saíram, pedindo para cortar questões.

Alcance atual: 5–6 questões em 1 página, 7–14 em 2, 15–20 em 3, e o caderno
de 30 itens do simulado em 4.

No caderno de simulado, cada componente abre com uma **faixa de bloco**
(LÍNGUA PORTUGUESA, MATEMÁTICA). A faixa é somada à altura da primeira
questão do bloco, e não é um bloco à parte — assim ela nunca fica órfã no
pé de uma coluna.

---

## Navegação

**Simulados:** a criação é UMA tela, em sete etapas numeradas
(identificação, quantidade, questões, gabarito e descritores, tipos,
gerar, resultados), com gravação automática — o simulado nasce como rascunho ao ser
criado. Não há botão "Salvar": quem grava é cada campo, com um "salvo"
discreto na migalha. As telas separadas de criação e de importação foram
removidas; sobraram a conferência item a item e o relatório. A etapa 7
fica visível **sempre**, mesmo sem nenhuma correção — escondê-la até
existir nota fez o professor perder de vista onde os resultados saem. A aba
Notas, que de propósito não lista simulados, traz um atalho para eles pelo
mesmo motivo.

**Turmas:** escola › turma › disciplina › provas do período › prova.
Os estudantes ficam na turma (valem para todas as disciplinas dela). Na
mesma tela da turma fica a entrada **Simulados SAEPE**, ao lado das
disciplinas.

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
habilidade com parecer automático, simulados SAEPE (caderno único com itens
de Língua Portuguesa e de Matemática, descritores, proficiência por TRI de 3 parâmetros ou
percentual, padrões de desempenho e acerto por descritor, tudo separado por
componente),
exportação CSV, cópia de segurança e uso offline.

## O que não existe

Discursivas com correção automática, várias figuras por questão,
sincronização entre aparelhos, qualquer coisa em servidor.
