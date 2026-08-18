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

**A barra de fração `⁄` (U+2044) não é `/`.** Ela vem nos PDFs da rede em
`1⁄87` e não estava na fonte embutida: o caractere sumia e a alternativa
saía impressa como `187`, um número diferente e plausível — o pior tipo de
erro. Está no subconjunto desde então, junto com `⅓ ⅔ ⅕ ⅜` e afins. Ao
mexer em `sub.py`, gere o `fonte.js` de novo e confira com
`caracteresFaltando()`.

**Fração empilhada no PDF vira alternativa vazia.** Num PDF, `A) 1⁄20` sai
em três linhas de base: `"A) "`, `"1"`, `"⁄20"`. A regex de alternativa
exigia texto depois da letra, então `A)` não casava, a questão ficava
**sem alternativa nenhuma** e — pela regra que só aceita questão nova
depois de alternativas — engolia a questão seguinte. Um simulado de 15
questões chegava com 13, em silêncio. Hoje a alternativa pode vir vazia, a
continuação cola sem espaço quando há `⁄`, e **numeração em sequência
abre questão nova** mesmo que a anterior tenha ficado sem alternativas.

**Descritor pode ocupar várias linhas.** O formato real da rede é
`D15 — texto.` numa linha e `Questões: 3 e 11.` na seguinte, com o texto
às vezes quebrando no meio. O leitor acumula linhas até achar o próximo
código, e aceita `,`, `;` e `e` como separadores. Antes exigia tudo numa
linha só: o arquivo entrava com **zero descritores**, sem aviso. Por isso a
tela de importação agora informa quantos descritores vieram e alerta
quando falta gabarito, descritor ou alternativa.

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

**A janela do QR depende do layout ATIVO.** `lerQR()` calcula onde o QR
está a partir de `LAY`, e `LAY` vem da prova ativa. Se o cartão na frente
da câmera tem outro tamanho — um simulado de 16 itens com uma prova de 10
ativa —, os marcadores ainda são encontrados (o teste de proporção é
tolerante), mas a janela do QR cai no lugar errado e o QR **nunca** é
lido: o app ficava preso em "aproxime um pouco para o QR entrar em foco",
para sempre. O giro de formatos existia, mas só disparava quando o cartão
não era encontrado. Hoje ele dispara também quando o cartão foi achado e o
QR falha (a cada 8 tentativas).

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
`valor × acertos / nq`, arredondada a duas casas.

O ano distribui um total (`E.saepe.totalParticipacao`, padrão 10) entre os
simulados **previstos** (`E.saepe.previstos`, padrão 8), então cada um nasce
valendo 10 ÷ 8 = 1,25. Previsto ≠ criado: dá para planejar oito e ter dois
prontos. Mudar a previsão **não** reescreve os valores sozinha —
`distribuirParticipacao()` só roda quando o professor pede, porque mexer no
valor de um simulado já corrigido muda nota lançada; a tela avisa antes.
Cada simulado também aceita um valor próprio (`sm.valorParticipacao`), e a
tela do plano mostra `distribuído / total`.

O professor pode **lançar à mão** a participação de um estudante
(`sm.partAluno[numero]`), sempre limitada ao teto daquele simulado.
Apagar o campo devolve o valor calculado pelos acertos. A lista e o CSV
mostram os dois números e de onde veio a nota usada.

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

### Análise por turma e por série

A aba **Análise** tem três entradas: Avaliações (a de sempre, intocada),
Simulados por turma e Simulados por série. Nas duas de simulado, **Língua
Portuguesa e Matemática aparecem juntas na mesma tela** — não há passo
intermediário perguntando a disciplina.

`apurarConjunto(sims, comp)` faz **uma calibração única** com todas as
respostas do recorte: a turma, ou todas as turmas da série. Não é média de
proficiências individuais nem média das turmas. A série é montada por
`chaveSerie()` (normaliza "3º ano do ensino médio" → `3 EM`), e os
simulados "iguais" entre turmas são agrupados por título + ano.

**Cadernos diferentes entre turmas.** Cada turma pode ter sorteado itens
diferentes do banco. O item é identificado pelo enunciado (`chaveItem()`),
então itens comuns viram a mesma coluna e itens exclusivos viram colunas
próprias, com `null` para quem não os respondeu. `calibrar()` e
`estimarTheta()` aceitam esse `null`: cada item é calibrado só com quem o
respondeu, cada θ sai só dos itens que a pessoa fez. **Item não respondido
não é erro** — sem isso, quem pegou um caderno menor seria punido. Sem
nenhum `null`, o resultado é idêntico ao de antes.

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
             valorParticipacao, partAluno:{numero:valor}}],
  saepe:  {totalParticipacao, previstos},
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

### Páginas: medir a TURMA, não um aluno

A altura de cada questão não depende da ordem, mas o **encaixe nas duas
colunas depende** — e cada estudante recebe outra ordem. Escolher o corpo
olhando `alunos[0]` fazia o colega do lado receber cinco páginas na mesma
prova de quatro. Hoje `alturasCanonicas()` mede cada questão uma vez por
corpo e `paginasNoPior()` simula o empacotamento de **todas as ordens que
serão impressas** (com tipos de prova são só N ordens), ficando com o pior
caso. `medirCaderno()`, no app, também passa a turma inteira.

No simulado, todos os cadernos ainda saem com o **mesmo** número de folhas:
quem fecharia em três ganha uma folha de rascunho. Booklet desigual atrapalha
grampear, conferir e distribuir. `doc.paginasDeCada` guarda o resultado real.

### Anatomia da questão

`segmentarEnunciado()` separa **instrução** ("Leia o texto abaixo."),
**título**, **texto de apoio**, **referência** e **comando**, e cada um sai
com seu próprio tipo: referência em corpo menor, cinza, alinhada à direita;
comando em negrito; **título centralizado**, **corpo justificado** e
**entrada de parágrafo** na primeira linha (`quebrarComRecuo()` refaz a
quebra, porque deslocar uma linha já quebrada a jogaria além da margem).
A última linha de cada parágrafo nunca é justificada — senão as palavras
se esparramam. Impressos todos iguais, o endereço do site parecia frase do
texto e o comando desaparecia no meio do parágrafo.

Para isso o enunciado precisa vir em parágrafos, e o PDF não traz nenhuma
marca de parágrafo — só quebras de largura. `montarParagrafos()` usa **duas
condições juntas**:

1. *Cabia mais?* Se a primeira palavra da linha seguinte ainda caberia
   nesta linha, quem quebrou foi o autor. Comparar comprimentos ("linha
   curta = parágrafo") erra nas linhas quase cheias, e contar caracteres
   erra porque a fonte é proporcional — daí `larguraTexto()`, que pesa
   cada caractere. A régua é o percentil 93 do documento inteiro, não da
   questão: uma questão curta pode não ter nenhuma linha cheia.
2. *O texto concorda?* Parágrafo não termina em vírgula nem continua com
   letra minúscula. Só com a largura, uma linha que acabava em "…ela é
   inevitável," e seguia com "e nada que…" virava parágrafo no meio da
   frase.

**Os parágrafos do apoio nunca são juntados para ganhar espaço.** Juntá-los
rendia quase quatro linhas por questão — duas questões a mais no caderno —
mas o estudante perdia de vista onde cada parágrafo começa. Espaço se
procura na letra e, em último caso, na quantidade de questões.

Quando a referência vem colada ao fim do apoio (`...terceiro andar. ASSIS,
Machado de. Memórias...`), `inicioDaReferencia()` acha onde ela começa. Sem
isso o texto inteiro sairia impresso como se fosse a fonte.

**No simulado o teto é obrigatório**, e a ordem é: (1) modo denso —
`DENSO` reduz entrelinha e o ar entre rótulo, enunciado e alternativas, e
o rascunho não é desenhado; (2) escada de corpo `CORPOS_SAEPE`
(10,5 → 10,2 → 10 → 9,8 → 9,5 → 9,2 → 9), parando na MAIOR que couber;
(3) só então `melhorAjuste()` tira questões, **uma de cada componente por
vez**, até achar a maior quantidade que cabe. Os três passos são medidos
com geração real em modo `dry`, não estimados. Cortar questão nunca desfaz
relação: o item carrega enunciado, gabarito, descritor e `orig` juntos, e
`aplicarAjuste()` regrava o caderno inteiro por `gravarCaderno()`.

`medirCaderno()` devolve `null` quando não consegue medir, e nesse caso a
geração segue **sem** ajuste — travar a impressão por causa de uma conta
que falhou seria pior do que imprimir uma página a mais.

Alcance atual: 5–6 questões em 1 página, 7–14 em 2, 15–20 em 3, e o caderno
de 30 itens do simulado em 4.

No caderno de simulado, cada componente abre com uma **faixa de bloco**
(LÍNGUA PORTUGUESA, MATEMÁTICA). Desde a v43 ela é a primeira **unidade**
da questão que abre o componente, marcada como colada — assim ela nunca
fica órfã no pé de uma coluna.

A partir da v43 a questão **não é mais um bloco indivisível**: ela pode
começar numa coluna e terminar na outra. Ver a seção da v43 para as
regras de cola e para a razão de `alturasCanonicas`, `empacotar`,
`paginasNoPior` e `fluir` terem de medir as mesmas unidades.

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
exportação CSV, exportação para Excel (.xlsx), evolução por descritor ao
longo dos simulados, cópia de segurança e uso offline.

## O que não existe

Discursivas com correção automática, várias figuras por questão,
sincronização entre aparelhos, qualquer coisa em servidor.


---

## v24 — correção dos simulados, Excel e evolução por descritor

### A armadilha que custou caro aqui: a aba Notas roubava a prova ativa

Sintomas relatados: a câmera achava o cartão do simulado e **não capturava
resposta nenhuma**, e a **correção manual só funcionava para as avaliações
normais**. Pareciam dois bugs; era um só, com dois efeitos.

`provasDe()` não era a culpada. Ela exclui cadernos das listas de provas
normais, como deve, mas nem `pintarSeletor` nem `montarManual` a usam — com
o caderno ativo, a aba Manual sempre funcionou.

A causa estava no passo 6 de `pintarResultados()`:

```js
const p=provaDe(N.prova);
if(E.ativa!==p.id) ativar(p.id);
```

O caderno **nunca entra em `notaNav`** (invariante 7: não tem período nem
disciplina). E `ativar()` chama `pintarResultados()`. Então, toda vez que se
ativava um caderno, esta linha reativava, em silêncio, a última prova comum
aberta na aba Notas. O professor escolhia o simulado e o app voltava para a
prova de 10 questões — sem mensagem nenhuma.

Daí os dois sintomas: a aba Manual desenhava a grade da prova errada, e a
câmera ficava com o layout errado. Como o QR é lido numa janela calculada a
partir do layout ATIVO, ele nunca era decodificado, e a faixa ficava presa
em *"Cartão localizado / Aproxime um pouco para o QR entrar em foco"* — os
marcadores, esses, eram encontrados.

**A guarda:** `if(E.ativa!==p.id && !ehCaderno(provaAtiva())) ativar(p.id);`
A aba Notas continua seguindo as provas normais; só não rouba mais um
caderno escolhido em outra aba. Quem mexer em `pintarResultados`, cuidado
com esta linha.

### As abas Ler e Manual ganharam seletor de prova

Antes, as duas trabalhavam só com `E.ativa`, e o único caminho para ativar
um caderno era o botão *Gerar* da etapa 6. Quem já tinha impresso o simulado
e voltava depois para corrigir não tinha por onde escolhê-lo. Agora
`pintarSeletores()` pinta o mesmo seletor das outras abas em `#lerSel` e
`#manSel`, e ele **inclui os cadernos**. A etapa 7 do simulado também ganhou
"Corrigir cartões deste simulado", que ativa o caderno e abre a câmera.

### A câmera tenta os outros formatos no mesmo quadro

`lerQRDeQualquerFormato()` tenta o layout ativo e, se falhar, mais dois
formatos conhecidos por quadro (`FORMATOS_POR_QUADRO`), mantendo o que
decodificar. Antes o giro era de um formato a cada 8 quadros, e
`tentarOutroLayout()` tinha dois becos sem saída: girava para o formato já
ativo (perdendo mais 8 quadros) e exigia **dois** formatos conhecidos — com
um só, nunca girava. `candidatosDeLayout()` resolve os dois.

### planilha.js — gerador de .xlsx próprio

Um `.xlsx` é um zip com alguns XML dentro, e daqui só se precisa de pouco.
Trazer uma biblioteca de ~900 KB para um app que abre sem internet não se
justificava. Decisões:

- **zip em modo STORE** (sem deflate): o arquivo fica maior, mas não depende
  de `CompressionStream`, que não existe em todo navegador de celular.
- **`t="inlineStr"`** nas células de texto: dispensa o `sharedStrings.xml`.
- **um único estilo**, o negrito do cabeçalho.
- número vai como número (`<v>`), texto como texto. O número do estudante é
  texto de propósito: `01` não pode virar `1`.

**Escrever xlsx na mão só se pode dar por pronto depois de abrir o arquivo
num leitor de verdade.** `teste25.js` gera e abre com `openpyxl`, conferindo
aba por aba, célula por célula, tipo de cada valor e o negrito do cabeçalho;
`teste27.js` faz o mesmo com as planilhas geradas pelo app. Mexeu em
`planilha.js`, rode as duas.

### Evolução por descritor

`historicoPorDescritor(sims)` monta o histórico com chave lógica
**aluno + disciplina + descritor**. O mesmo código em componentes diferentes
são descritores diferentes (`D17` é "relações lógico-discursivas" em Língua
Portuguesa e outra coisa em Matemática) e nunca são comparados entre si.

Regras que o `teste26.js` protege:

- a comparação é com a **última vez em que aquele descritor foi avaliado**,
  não com o simulado anterior — se o descritor faltou no 2º simulado, o 3º
  compara com o 1º;
- descritor ausente é **não avaliado**, nunca 0%: tratar ausência como zero
  inventaria uma queda que não existe;
- classificação com tolerância de ±5 p.p., configurável (`TOL_LONGITUDINAL`);
- dificuldade persistente = abaixo de 50% (`PISO_DIFICULDADE`) em avaliações
  sucessivas;
- as medidas são ordenadas pelo tempo do simulado, não pela ordem em que as
  correções foram gravadas.

A tela fica em Turmas › turma › Simulados SAEPE › **Evolução por descritor**.

### Sobre as suítes desta versão

As suítes `teste1`–`teste22` e a versão anterior de `planilha.js` **não
vieram no pacote** que originou esta versão. O `harness.js` (sobe o
`index.html` de verdade em jsdom, embutindo os scripts locais), o
`cartao-sintetico.js` e as suítes `teste23`–`teste28` foram escritos do
zero aqui. Se os arquivos antigos reaparecerem, vale rodar os dois
conjuntos juntos.

`cartao-sintetico.js` desenha o cartão em pixels a partir da **mesma**
geometria que o gerador imprime (`montarLayout`) e do **mesmo** payload
(`montarPayload` + `gabaritoIndividual`), em vez de rasterizar o PDF: se o
scanner errar ali, erra no papel. Rodar tudo: `bash rodar-testes.sh`.


---

## v25 — duas colisões de geometria no cartão

Pergunta que levou a isto: *"o leitor considera a possibilidade de os
simulados terem quantidades de questões diversas?"*. Considera — e a
varredura de **todos** os 52 formatos aceitos (5 a 30 itens × 4 e 5
alternativas) achou dois tamanhos que **nunca** poderiam ser lidos, no
papel nem na tela. Os dois eram a mesma classe de erro: algo preto
encostando no marcador de canto. O marcador precisa ser um quadrado
sólido e isolado; quando outra coisa preta toca nele, o borrão deixa de
passar nos testes de isotropia e solidez, o marcador é descartado, e sem
os quatro marcadores o cartão simplesmente não é encontrado — a faixa
fica em *"Procurando o cartão"* com o cartão bem enquadrado na tela.

**1. A bolha da última alternativa × o marcador inferior-direito.**
No perfil compacto, quando a coluna da direita chega à última linha — ou
seja, sempre que `nq` é múltiplo de 3: **21, 24, 27 e 30** — a bolha da
última alternativa ficava a 0,15 mm do marcador. Preenchida pelo
estudante, encostava. A margem inferior passou a contar com `FID/2 +
RAIO`, em vez dos 4 mm fixos, e só nesses tamanhos.

**2. O bloco do QR × o marcador inferior-esquerdo.**
O QR começa a 4 mm da borda e o marcador ocupa `FID/2` para cada lado:
os dois sempre se sobrepõem horizontalmente, e o que os separava era só
a folga vertical. Nos cartões mais baixos — **7 e 8 questões**, onde é o
QR que define a altura — essa folga era menor que o próprio marcador. A
folga abaixo do QR passou a contar com `FID/2`.

**Geometria alterada em 12 dos 52 formatos:** 7, 8, 21, 24, 27 e 30
itens, com 4 e com 5 alternativas. Todos os outros ficaram idênticos —
inclusive **10x5** (a prova comum de sempre) e **26x5** (o simulado de
13 + 13, o mais usado). Cartões já impressos nesses tamanhos continuam
valendo. Os 12 que mudaram eram justamente os que não funcionavam, então
não havia cartão bom para invalidar.

`assinaturaLayout` é só `nqxno`: **não carrega a versão do layout**. Não
há como o scanner distinguir um cartão antigo de um novo do mesmo
tamanho. Foi por isso que a correção foi cirúrgica em vez de uma folga
uniforme: mexer na altura de 10x5 ou 26x5 invalidaria, em silêncio, tudo
que já foi impresso. Quem precisar mudar geometria de um formato que
funciona vai ter de pôr a versão na assinatura antes.

`layout.py` **não veio no pacote** e não foi atualizado. Ele é o espelho
de `layout.js` e precisa receber as mesmas duas mudanças, senão o PDF
gerado por lá sai com geometria diferente da que o scanner reconstrói.

O `teste29.js` cobre a varredura completa dos 52 formatos e a troca de
cartões de tamanhos diferentes na mesma sessão — 15, 26 e 30 itens mais a
prova comum de 10, em qualquer ordem, sem o professor tocar em nada.


---

## v26 — o QR ilegível: era o "º" de "3º Ano A"

Sintoma trazido pelas fotos do aparelho: o cartão do simulado era
encontrado (os quatro marcadores acesos, moldura fechada em volta do
cartão), as bolhas eram lidas, e a faixa ia de *"Cartão localizado /
Aproxime um pouco para o QR entrar em foco"* para *"QR ilegível"*. A
correção manual, essa, funcionava.

**O decodificador de QR do app (jsQR) devolve STRING VAZIA — sem erro
nenhum — quando o conteúdo tem qualquer byte fora do ASCII.** Não é ler
errado, é ler nada. O payload trazia o nome da turma e do estudante:

| payload | resultado |
|---|---|
| `...|3A|07|JOAO S|...` | lido certo |
| `...|3º Ano A|07|JOAO S|...` | **volta vazio** |
| `...|3A|07|GONÇALO|...` | **volta vazio** |
| `...|3A|07|SÁ P|...` | **volta vazio** |

Numa escola brasileira isso é a regra, não a exceção: `3º Ano A`,
`3ª série`, GONÇALO, JOÃO, SÁ. E como `analisar()` conta payload vazio
como leitura falha, o app percorria todos os formatos de cartão, não
achava nada e culpava o foco.

**A correção:** tudo que entra no payload passa por `soAscii()`
(`gerador.js`) — acentos viram as letras sem acento, `º`/`ª` viram
`o`/`a`, o resto é descartado. Nada disso muda a identificação: quem casa
o cartão com a prova é o **código**, e o embaralhamento usa o nome REAL
da turma, guardado no aparelho. Em `aplicarQR`, a busca da turma pelo
nome passou a comparar sem acento.

**Não mexa nisto sem rodar o `teste30.js`.** Ele varre turmas e nomes com
acento, ç, º e ª.

### Duas melhorias que vieram junto, do mesmo diagnóstico

Antes de achar a causa real, medimos a densidade do QR — e ela também
estava no limite. Ficaram as duas melhorias:

- **O nome vai abreviado no QR** (`nomeCurtoQR`: primeiro nome + inicial
  do último, 14 caracteres). O payload do caderno das fotos caiu de 81
  para 62 bytes, e o QR de 37 para 33 módulos: 0,81 → 0,91 mm por módulo.
  Quem identifica o estudante é turma + número; o nome no QR serve só
  para cadastrar quem ainda não está na lista. Na tela e nas notas
  aparece o nome COMPLETO, buscado na turma pelo número.
- **Correção de erro "L"** no lugar de "M": o cartão é lido de perto, em
  papel, e os 15% de redundância só encolhiam os módulos.
- A câmera passou a pedir **1920x1440** (era 1280x960), e a dica da faixa
  deixou de mandar "aproximar" — com o cartão deitado numa tela em pé,
  isso é impossível. Agora sugere girar o celular e, se ainda assim não
  ler, usar o botão **Usar foto**, que entrega a resolução cheia.

Quem for mexer no payload: ele é ASCII, e o formato dos campos
(`DBM4|codigo|gabarito|turma|numero|nome|assinatura`) continua o mesmo —
cartões já impressos com payload ASCII seguem valendo.


---

## v27 — a TRI conjunta e os itens âncora

Pergunta do professor: *"a TRI está funcionando na análise por turma e
por série? A proficiência da turma e da série parece média aritmética
simples."* Ele estava certo no que via, e o motivo é pior do que média.

**O que já era assim de propósito:** o NÍVEL do recorte vem do acerto
absoluto (`centro = profPorPercentual(média de acerto)`) e a TRI só
distribui os estudantes em volta dele, a 50 pontos por desvio-padrão.
Logo `A.media` é sempre igual ao `centro` — parece média de percentual
porque, no nível do recorte, é isso mesmo. Sem itens âncora do Saeb,
nenhuma conta acerta o ponto exato da escala oficial.

**O que estava errado:** a comparação ENTRE turmas. Uma calibração
conjunta só põe estudantes de cadernos diferentes na mesma escala se
houver itens em comum — os **itens âncora**. Com cada turma recebendo o
seu próprio sorteio, não há nenhum. O modelo então não distingue "turma
melhor" de "caderno mais fácil": assume que os grupos são iguais e
**achata** a diferença. Medido, com o mesmo desempenho real nos dois
casos (79,2%, 62,5% e 46,9% de acerto):

| cenário | método | âncoras | proficiência das turmas |
|---|---|---|---|
| sorteio por turma | TRI conjunta | 0 | 302 / 294 / 290 — **12 pontos** |
| mesmo caderno | TRI conjunta | 8 | 326 / 297 / 264 — **62 pontos** |

A diferença real entre as turmas encolhia para um quinto do tamanho.

**A correção:** `apurarConjunto` conta os itens presentes em mais de um
caderno. Se o recorte tem mais de um caderno e menos de `ANCORA_MIN`
âncoras, a TRI conjunta **fica de fora** e a apuração usa o percentual de
acerto, que ao menos não finge comparar o incomparável — e que, sendo
honesto, preserva a diferença real (91 pontos no mesmo teste). A tela
explica o motivo em vez de mostrar um número que parece uma escala e não
é. O `teste31.js` compara os dois cenários lado a lado.

Dentro de UMA turma nada muda: um caderno só, sem problema de âncora.

**A conclusão que isso reforça:** aplicar o MESMO caderno em toda a série
não é só organização — é a condição para a proficiência de série existir.
Enquanto cada turma sortear o seu, o máximo honesto é comparar percentual
de acerto e acerto por descritor.


---

## v28 — "as mesmas respostas deram notas diferentes"

Relato: o professor marcou as MESMAS respostas em cartões de estudantes
diferentes e as notas saíram diferentes; e, usando um gabarito pronto,
metade das questões de Língua Portuguesa foi contada como errada.

**A primeira parte é o app funcionando.** Cada estudante recebe um
caderno embaralhado: a questão 1 do nº 01 não é a questão 1 do nº 02, e
as alternativas também trocam de lugar. É o que impede a cola. Logo, o
mesmo conjunto de marcações em cartões diferentes TEM de dar notas
diferentes — medido no `teste32.js`: 4, 3, 1, 3, 1, 2, 2, 1, 1, 1, 6 e 3
acertos de 16, para marcações idênticas.

**Não existe "o gabarito" do simulado.** Existe o gabarito CANÔNICO — a
ordem do documento de origem, que não é a ordem de nenhum caderno
impresso — e um gabarito por estudante. Marcar o canônico num cartão
qualquer acerta por acaso. A ficha da prova mostrava `gabarito ABCDE...`
sem dizer isso, o que convidava ao erro; agora diz "gabarito canônico" e
explica, logo abaixo, que ele não vale para nenhum cartão.

**O `teste32.js` tranca a invariante que importa:** as TRÊS fontes têm de
concordar, estudante por estudante — a ordem impressa no caderno
(`ordemDaProva`, gerador), o gabarito gravado no QR do cartão
(`gabaritoIndividual`, gerador) e o gabarito recalculado na correção
(`gabaritoDe`, index). Confere com blocos alternados, com blocos fixos e
com tipos de prova. Se qualquer uma divergir, a turma inteira sai com
nota errada e ninguém percebe.

**O que ficou por explicar.** Marcar o canônico num cartão alheio dá em
média ~1 de 8 em LP nos testes, não 4 de 8. Metade certo é ALTO demais
para acaso (5 alternativas ⇒ 20% no chute) e baixo demais para
alinhamento correto. Ou seja: o relato de "metade em Português" não é
explicado nem pelo embaralhamento nem por acaso, e continua em aberto —
precisa dos dados do aparelho (cópia de segurança + o PDF do caderno de
um estudante + o que foi marcado) para ser localizado. Suspeitas a
investigar primeiro, em ordem: (1) o gabarito importado do arquivo estar
desalinhado com as questões dentro do BLOCO de LP, o que atingiria só um
componente — que é exatamente o sintoma; (2) `ajustarQuantidade` /
`gravarCaderno` reordenarem a lista depois de o gabarito já ter sido
gravado; (3) o arquivo de origem trazer o gabarito numa ordem diferente
da dos enunciados.

**Ferramenta nova:** na ficha do caderno, *Gabarito de cada estudante* —
planilha com o canônico numa linha e o gabarito individual de cada
estudante nas seguintes, mais uma aba mostrando qual componente cai em
cada posição do cartão de cada um. É com ela que se confere o papel
contra o app sem depender da câmera.


---

## v29 — o mesmo caderno para a série inteira

### Identidade do item: `qid`

Até aqui, o único jeito de reconhecer "a mesma questão" em cadernos
diferentes era comparar o TEXTO do enunciado (`chaveItem`). Um espaço a
mais, um acento corrigido, e a mesma questão virava duas colunas na
matriz da TRI — justamente onde os itens âncora precisam se encontrar.

Agora cada item carrega um `qid` estável, guardado em `pr.qids`. Nos
cadernos antigos ele é derivado do próprio enunciado (`qidDoTexto`,
normalizado sem acento e sem espaço duplo), de forma que a identificação
que existia continua valendo, só que imune a essas variações.
`chaveItem` virou uma linha: `qidDoItem(pr,i)`.

### Um caderno, várias turmas

Cada turma continua com o SEU registro de simulado — é o que as telas, as
notas e a participação usam. O que mudou é que os registros de uma mesma
**matriz** (`sm.matriz`) carregam cadernos idênticos: mesmas questões,
mesma ordem canônica, mesmo gabarito e mesmos `qid`. `gravarCaderno`
chama `propagarNaSerie`, que copia para os irmãos — mexer nos itens de
uma turma muda o caderno de todas, de propósito.

O embaralhamento continua por estudante (semente turma + número), então
nada muda quanto à cola: dois estudantes da mesma turma continuam com
ordens diferentes, e turmas diferentes também.

Ao criar um simulado numa série com mais de uma turma, o app pergunta se
ele vale para a série inteira. A tela do simulado diz em qual dos dois
casos ele está.

**Resultado medido** (`teste33.js`), três turmas com 87%, 60% e 43% de
acerto: a TRI conjunta ganha 6 itens âncora, volta a ser usada e separa
as turmas em **71 pontos** — 335, 292 e 264. Com sorteio por turma isso
não era possível (ver v27).

### A conversão do que já existia

`converterSimulados()` roda uma vez ao abrir. Ela **dá `qid`** aos
cadernos antigos e marca os simulados como `legado`, com `matriz: null`.

**Ela não funde simulados de turmas diferentes, e isso é deliberado:**
cada turma sorteou o seu caderno, e sem itens em comum não existe
informação que ligue as escalas. Fundir seria inventar comparação. Os
simulados legados continuam comparáveis por percentual de acerto e por
descritor, como sempre foram.

**Nenhuma nota se move**: a conversão não toca em `E.res`, e o
`teste33.js` compara o `E.res` inteiro antes e depois, byte a byte.

### Para resgatar as turmas já avaliadas

Se um dia for preciso comparar as turmas já avaliadas na mesma escala, o
caminho é aplicar um bloco curto de **itens âncora** comum a todas elas
num simulado seguinte. Isso liga as escalas retroativamente. Não está
implementado.


---

## v30 — "a TRI não está funcionando"

Relato: quem acerta toda a Matemática ganha 400 de cara; esse valor não
muda quando os outros cartões vão sendo corrigidos; e quem tem o mesmo
número de acertos tem a mesma proficiência — o que não é TRI.

**A TRI funciona. O que o professor estava vendo era o percentual.**
`apurarComp` só calibra com pelo menos `TRI_MIN_ALUNOS` (8) cartões
corrigidos NAQUELE componente; abaixo disso usa `profPorPercentual`. E o
percentual tem exatamente os três comportamentos descritos: acerto total
vai ao teto da faixa (400 no 3º EM), empate em acertos é empate em
proficiência, e o número de cada um não depende dos demais.

Com 12 cartões, medido no `teste34.js`, a TRI se comporta como deve:

| nº | acertos | proficiência | itens acertados |
|---|---|---|---|
| 01 | 4 | 278 | os 4 mais fáceis |
| 05 | 4 | 212 | os 4 mais difíceis |
| 07 | 4 | 252 | dois fáceis, dois difíceis |
| 10 | **3** | **259** | os 3 mais fáceis |

Oito estudantes com 4 acertos saem com 4 proficiências diferentes; e o nº
10, com 3 acertos coerentes, passa na frente do nº 05, com 4 num padrão
improvável — o 3PL atribui o acerto isolado em item difícil ao chute.

**O que mudou:** o resultado passa a sair marcado como PROVISÓRIO quando
a TRI foi pedida e ainda não pôde rodar (`A.provisorio`,
`A.faltamParaTri`), com um aviso que explica os três comportamentos e
quantos cartões faltam. O número não muda; o que muda é o professor saber
o que está olhando.

**Ponto de atenção para quem for mexer:** com uma turma só, a
discriminação (`a`) de quase todos os itens cai no piso de 0,4, porque a
correlação item-total é ruidosa com poucos respondentes. A TRI separa,
mas separa pouco. Isso melhora sozinho com o caderno único da série
(v29), que multiplica o número de respondentes por item.

### layout.py

Não existe — o professor confirmou. O cabeçalho do `layout.js` dizia ser
"espelho exato de layout.py" e foi corrigido: `layout.js` é a única fonte
da geometria, consumida pelo gerador e pelo leitor. O aviso sobre
`assinaturaLayout` não carregar a versão foi movido para lá, que é onde
alguém vai olhar antes de mudar milímetro.


---

## v31 — conferência do gabarito antes de aplicar

A tela de itens mostrava só a LETRA do gabarito. **Uma letra não se
confere contra nada:** para saber se "C" está certo é preciso ver qual é
a alternativa C daquela questão. Foi por aí que passou um gabarito com
erros — e o erro só apareceu depois de o simulado ter sido aplicado a uma
turma inteira, no meio de um relato de "o app leu errado".

`telaConferir` mostra cada item com o enunciado e as cinco alternativas,
a marcada em destaque; tocar em outra troca o gabarito na hora (passa por
`gravarCaderno`, então propaga para as outras turmas da série).

`alertasDoCaderno(pr)` sinaliza o que costuma vir errado do arquivo. Nada
é trava — são avisos para olhar:

- item sem letra no gabarito, ou com letra fora das alternativas;
- item sem enunciado;
- questão com número de alternativas diferente do cartão;
- alternativa em branco ou alternativas repetidas;
- **enunciado repetido** no caderno, dizendo de qual item;
- **concentração de letras** — mais da metade dos itens na mesma letra é
  quase sempre erro de importação, não gabarito de verdade.

A ficha do simulado traz a entrada com a contagem de avisos, e a tela
mostra a distribuição das respostas por letra.

O `teste35.js` planta um problema de cada tipo e confere que todos são
apontados, que a tela mostra enunciado e alternativas (não só a letra), e
que o toque corrige um item sem mexer nos outros.


---

## v32 — a escala ia até 425, e o app parava em 400

Conferido contra a **Revista da Escola SAEPE 2024 (Matemática)**, que o
professor enviou.

**Os pontos de corte estavam certos.** O caderno de 2024 traz, para o 3º
ano EM em Matemática: até 250 · 251 a 290 · 291 a 325 · 326 ou mais —
exatamente o que já estava em `ETAPAS`. Os do 5º e do 9º ano também
batem. Essa parte não mudou desde 2018.

**O teto da projeção estava errado.** A escala de proficiência do caderno
descreve, para cada etapa, níveis com habilidades:

| etapa | níveis | último nível | teto antigo | teto novo |
|---|---|---|---|---|
| 5º EF | 1 a 9 | acima de 325 | 300 | **325** |
| 9º EF | 1 a 8 | acima de 375 | 350 | **375** |
| 3º EM | 1 a 9 | acima de 425 | 400 | **425** |

O 3º EM parava no nível 7. Os níveis 8 (400 a 425) e 9 (acima de 425)
existem, têm habilidades descritas, e nenhum estudante conseguia chegar
lá — o 400 era um muro artificial, não um limite da rede. O caderno mostra
turmas reais com 31% e 23% no padrão Desejável, então o topo da escala não
é decorativo.

**A faixa virou editável por simulado.** `faixaDe` sempre leu `sm.faixa`
antes do padrão da etapa, mas nenhuma tela expunha isso. Agora a
identificação do simulado tem piso e teto, com botão de voltar ao padrão;
teto menor ou igual ao piso é recusado. Quando a rede publicar números
novos, dá para ajustar sem tocar no código.

**A tela passou a dizer que é projeção.** Sem os itens âncora da rede
inteira, um simulado de turma não pode ser calibrado na escala oficial do
SAEPE. O que o app faz é usar a mesma régua, com os mesmos cortes, para o
resultado ser lido junto com os padrões de desempenho. Isso estava só
aqui no CONTEXTO; agora está na tela de resultados.

**Pendente:** os cortes de Língua Portuguesa (225 · 270 · 305) ainda vêm
da edição de 2018 — o caderno de 2024 enviado é o de Matemática. O teto
da faixa é por etapa, então LP já herdou o 425 do 3º EM; falta conferir os
três pontos de corte quando aparecer a revista de LP.


---

## v33 — a escala de Português termina antes da de Matemática

Conferido no caderno de **Níveis de Desempenho de Língua Portuguesa até o
3º ano do Ensino Médio**, enviado pelo professor.

**Os cortes de LP estavam certos.** Elementar I até 225 · Elementar II
226 a 270 · Básico 271 a 305 · Desejável 306 ou mais — exatamente o que
estava aqui desde 2018. Nada a mudar.

**Mas as duas escalas não terminam no mesmo ponto:**

| 3º EM | níveis | último nível |
|---|---|---|
| Matemática | 1 a 9 | acima de **425** |
| Língua Portuguesa | 1 a 10 | acima de **400** |

Português tem DEZ níveis e termina em 400; Matemática tem nove e vai a
425. A v32 tinha subido o teto do 3º EM para 425 valendo para os dois —
o que dava a Português 25 pontos que a escala dele não descreve.

**A faixa passou a ser por componente.** `ETAPAS[].faixas` é
`{LP:[...], MAT:[...]}`, `faixaDe(sm,comp)` e `profPorPercentual(...,comp)`
recebem o componente, e a ficha do simulado mostra piso e teto de cada um.
`faixaDe` aceita as duas formas: o objeto de agora e o par `[piso,teto]`
das versões antigas, que valia para os dois componentes — simulado
gravado antes continua abrindo.

O piso ficou onde estava (175 no 3º EM). Ele é convenção — é onde cai
quem acerta só o que se acerta no chute —, e mexer nele desloca todo
mundo sem que nenhum documento peça.

Com isso, os três números do 3º EM estão conferidos contra documento:
cortes de Matemática (caderno 2024), cortes de Português e tetos das duas
escalas (caderno de níveis de LP). Restam sem conferência os cortes e
tetos de 5º e 9º ano em Língua Portuguesa, que seguem de 2018.


---

## v34 — os dados oficiais entram no app

Pergunta que originou isto: *"você associou cada descritor às habilidades
descritas em cada nível, como nos documentos oficiais?"*. **Não estavam.**
O descritor servia só para agrupar percentual de acerto; a dificuldade de
cada item saía das respostas da própria turma. Por isso a proficiência
ainda é, no fundo, projeção do percentual.

Esta versão é o **primeiro passo**: trazer os dados oficiais para dentro
do app. A ancoragem da TRI vem depois, em cima deles.

### `saepe-oficial.js`

Nada aqui foi digitado. Tudo veio de PDF publicado pela rede, com os
scripts de extração guardados no projeto (`extrai_niveis.py`,
`extrai_matriz.py`) — dá para reexecutar quando sair edição nova.

- **`SAEPE_MATRIZ`** — Matriz de Referência, Avaliação Somativa 2025.
  167 descritores: LP 2º EF (10), 5º EF (15), 9º EF (21), 3º EM (21);
  MAT 5º EF (28), 9º EF (37), 3º EM (35). Numeração sem furos.
- **`SAEPE_NIVEIS`** — 717 habilidades posicionadas na escala, cada uma
  com a faixa de pontos do seu nível: MAT 5º EF (130, níveis 1–9), MAT
  9º EF (207, 1–8), MAT 3º EM (220, 1–9), LP 3º EM (160, 1–10).

A extração tem uma armadilha: o PDF de Matemática mistura, entre os
níveis, texto de orientação ao gestor ("Observe a Proficiência Média…").
O filtro separa pelo verbo de comando — habilidade começa no infinitivo.
O `teste37.js` tranca isso, com a única exceção documentada: o caderno de
2024 escreve "Determina a solução…" no 9º EF, nível 6.

### O banco de descritores deixou de ser tela em branco

`bancoDesc(comp, etapa)` devolve a matriz oficial da etapa mesclada com o
que o professor escreveu — **o texto local tem precedência**. Ninguém
precisa digitar 35 descritores; e quem já digitou não perde nada.

### Por que a âncora tem de ser a HABILIDADE, não o descritor

"Localizar…" aparece em **9 níveis diferentes** de Língua Portuguesa, do
1 ao 10, mudando de gênero e de exigência — 200 pontos de distância com o
mesmo código. Um descritor não corresponde a um nível. Quem for
implementar a ancoragem: associe o ITEM à habilidade específica, e use
`pontoDoNivel(h)` (o meio da faixa; meio passo além nos extremos abertos)
como dificuldade âncora.

### Próximo passo, ainda não feito

1. Tela de associação item → habilidade, com sugestão por semelhança de
   texto e confirmação do professor.
2. Usar `pontoDoNivel` como `b` âncora em `calibrar`, no lugar do `b`
   estimado só com a turma — ou como prior, misturando os dois conforme o
   número de respondentes.

Isso resolveria de uma vez a proficiência "projetada" e a falta de itens
âncora entre turmas (ver v27 e v29).


---

## v35 — a TRI ancorada na escala oficial

Segundo passo do que a v34 preparou. Agora o item pode carregar a
habilidade oficial (`pr.hab[i]`, id de `SAEPE_NIVEIS`), e a faixa de
pontos do nível dela vira a **dificuldade do item**, vinda de fora da
turma.

### O que muda na conta

`calibrar(matriz, no, ancoras)` aceita um `b` por item em θ. Quando
existe, ele substitui o `b` estimado com as respostas da turma; `a` e `c`
continuam saindo da turma, porque os documentos não os trazem.

A conversão é a mesma nos dois sentidos:
`θ = (pontos − referência) / 50`, com a referência no meio da faixa da
etapa e do componente. Assim θ=0 cai no meio da escala e um
desvio-padrão vale 50 pontos, como no Saeb.

Com pelo menos `ANCORA_MIN_ITENS` (3) itens ancorados no componente, o
método passa a ser **`tri-ancorada`** e o nível do grupo deixa de vir do
percentual de acerto: θ já está na escala oficial, é só converter.

**Medido no `teste38.js`**, três cenários com desempenho bruto IDÊNTICO —
todos acertam 4 de 8:

| cenário | método | proficiência média |
|---|---|---|
| sem associação | tri | 269 (todos no mesmo ponto) |
| caderno de habilidades de nível 1–2 | tri-ancorada | **261** |
| caderno de habilidades de nível 8–9 | tri-ancorada | **320** |

Acertar metade de um caderno difícil passou a valer 59 pontos a mais que
metade de um fácil. Sem âncora, os dois davam o mesmo número — que é o
defeito que o professor vinha sentindo desde a v30.

### A tela

Ficha do simulado › **Habilidades da escala**. Lista os itens, mostra
quantos estão associados por componente e se a ancoragem já está ativa.
Ao abrir um item, sugere habilidades por semelhança de texto entre o
enunciado (mais o descritor e as alternativas) e as habilidades da etapa;
há também preenchimento automático dos que faltam e busca livre.

**A sugestão automática acerta o assunto, não o grau de exigência** — e o
grau é justamente o que define o nível. Ela é ponto de partida, não
resposta: a tela diz isso, e quem mexer no código não deve transformá-la
em automatismo silencioso.

### Cuidado ao interpretar

Continua não sendo calibração oficial: `a` e `c` são assumidos, a faixa
do nível é um intervalo de 25 pontos representado pelo seu ponto médio, e
a associação item→habilidade é julgamento humano. Errar a associação
desloca a dificuldade e, com ela, a proficiência da turma.


---

## v36 — o formato novo do arquivo, e excluir alcança a série

### Por que o app só lia as questões

O material que o professor passou a usar traz os três blocos com os
títulos **espaçados letra a letra**: `G A B A R I T O`,
`D E S C R I T O R E S`, `R E L A Ç Ã O D E N Í V E L D E
P R O F I C I Ê N C I A`. O leitor procurava `^gabarito$` e não achava
nada — daí só as questões entrarem. E o gabarito vem em três colunas na
mesma linha (`1 — C   6 — B   11 — A`), enquanto o leitor pegava um par
por linha.

Agora os títulos são comparados sem espaço e sem acento, e a linha do
gabarito é varrida inteira. Quem mexer no leitor: teste com os dois PDFs
de referência, é o que o `teste39.js` faz.

### A tabela de níveis é a parte valiosa

O bloco novo liga cada questão ao nível da Escala de Proficiência:

    1  Nível 6 (300 a 325)  Localizar a informação principal…  Desejável

Isso dá ao item uma **dificuldade oficial vinda junto com a questão** —
sem depender de a associação item→habilidade ser feita à mão (v35) nem de
sugestão por semelhança de texto. Um caderno importado neste formato
entra com os 30 itens ancorados e a TRI já sai `tri-ancorada`.

`ancoraDoItem` passou a ter duas origens, nesta ordem: o **nível
declarado no arquivo** (`pr.niv[i]`) e, na falta dele, a habilidade
associada à mão (`pr.hab[i]`). A faixa entre parênteses é conferida
contra o catálogo oficial — valendo, o catálogo manda.

Detalhe de extração: a coluna "Padrão" da tabela vaza para dentro do
texto da habilidade no `pdftotext`; o leitor remove Elementar I/II,
Básico e Desejável do fim.

### Excluir um simulado de série tira das três turmas

Um simulado de série é UM caderno aplicado em várias turmas. Apagar em
uma e deixar nas outras deixaria a série pela metade. O botão agora diz o
alcance ("Excluir simulado das 3 turmas"), a confirmação lista as turmas
e o total de cartões corrigidos que vão junto, e a exclusão remove os
irmãos da matriz, os cadernos e os resultados.

A edição já propagava desde a v29 (`propagarNaSerie`, chamado por
`gravarCaderno`): mexer nos itens ou no gabarito de uma turma altera as
outras automaticamente. As duas coisas que o professor pediu, portanto,
estão cobertas — a exclusão em cascata e a alteração em cascata.


---

## v37 — o padrão de acerto não maquia a nota

Pergunta do professor depois da ancoragem: se acertar item difícil passou
a valer mais, quem acerta SÓ as dificílimas e erra tudo o que é fácil não
ficaria com nota alta?

**Não fica, e o motivo está no 3PL.** Item difícil carrega o acerto ao
acaso no parâmetro `c` (1/nº de alternativas). Acertar um punhado deles
errando os fáceis é um padrão improvável para quem domina o conteúdo, e o
modelo o atribui ao chute — não ao domínio.

Medido no `teste40.js`, com o caderno REAL de Matemática do professor
(15 itens, níveis 3 a 8 declarados no arquivo), 20 estudantes em cinco
perfis:

| perfil | acertos | proficiência |
|---|---|---|
| acertou **só as 5 mais difíceis** | 5 | **265** |
| acertou só as 5 mais fáceis | 5 | 303 |
| acertou 5 espalhadas pela escala | 5 | 282 |
| acertou 12 das 15 | 12 | 395 |
| acertou 1 | 1 | 248 |

Quem acertou só as difíceis ficou **abaixo** dos outros dois perfis com o
mesmo número de acertos, e 130 pontos abaixo de quem fez a prova quase
toda. A ancoragem faz item difícil valer mais, mas não cria atalho.

Continua tudo por estudante e item a item: doze estudantes com 5 acertos
saíram com três proficiências distintas, e dois que acertaram exatamente
os mesmos itens saíram exatamente iguais — como manda a TRI.


---

## v38 — expoentes quebrados e o simulado fantasma

### O expoente ia para outra linha, e levava a frase junto

Nas fotos da prova gerada:

    A expressão h(t) = 20t − 5t
    2 descreve a trajetória de uma bola de golfe…
    N(x) = 500
     · 2
    0,5x .

No PDF, `5t²` não é um pedaço de texto só: é `5t` na linha de base e `2`
logo acima, em corpo menor. O agrupamento em linhas usava só a distância
vertical (`|u.y − y| ≤ 3`), e o expoente — deslocado 2 a 4 pontos —
podia cair fora, virando **linha nova**. O resto da frase ia junto,
porque vinha depois dele.

`agruparLinhas` agora reconhece o pedaço **em corpo menor e deslocado da
linha de base** antes de decidir se é linha nova: para cima é expoente,
para baixo é índice. Vira algarismo sobrescrito quando existe (`t²`,
`x³`, `aⁿ`, `H₂O`) e `^( )` quando não existe (`2^(0,5x)`,
`2^(t − 1)`). Deslocamento quase zero continua sendo texto miúdo na
mesma linha, não índice.

A ordem importa: a checagem de expoente vem ANTES da junção por
proximidade, porque o deslocamento típico cabe dentro da tolerância de
mesma linha. Foi por isso que o `H₂O` só passou depois de reordenar.

### O simulado que aparecia na lista e não abria

Um registro de simulado cujo caderno já não existe (`sm.prova` apontando
para prova apagada) aparecia na lista com o rótulo "em branco" e, ao ser
tocado, `telaSimulado` rebatia para a lista — nada abria, e o fantasma
continuava lá. Acontecia com exclusões antigas e com turmas irmãs
apagadas antes de a exclusão passar a alcançar a série (v36).

Três camadas: `simuladosDa` filtra por `simuladoVivo`,
`converterSimulados` limpa os registros órfãos ao abrir o app, e
`telaSimulado` apaga o registro em vez de rebater. O `teste41.js` cobre
os três caminhos.


---

## v39 — os gráficos e a tabela que faltavam

O recorte de figuras já funcionava (foi resolvido nas provas comuns),
mas nunca tinha sido medido contra um arquivo de simulado. Rodando a
detecção com a geometria REAL do arquivo do professor, dois furos:

**1. Figura no alto da página não era achada.** A varredura compara
pares de linhas para achar vãos grandes — logo, o gráfico que ABRE uma
página, sem texto acima, passava direto. Era o caso do gráfico da questão
11, que começa a página 4 do simulado de Matemática: sumia da prova.

A correção precisa de uma referência, senão a margem de cima viraria
"figura" em toda página. `conteudoDePdf` faz uma primeira passada por
todas as páginas e guarda a altura em que elas COSTUMAM começar (mediana
dos topos); `bandasDeLinhas(linhas, topo)` só cria a faixa se esta página
começar bem mais abaixo que as outras.

**2. Tabela partida ao meio.** O cabeçalho em duas linhas ("Número dito
por" / "Carlos") não passa no teste de linha tabular e rachava a tabela
da questão 10 em dois recortes, cada um com metade. Faixas de tabela
quase encostadas (menos de 28pt entre elas) agora viram uma só.

Resultado no arquivo do professor: **5 gráficos e 2 tabelas**, contra 4 e
3 (uma delas pela metade) antes. E nenhum falso positivo: o simulado de
Português, que é só texto, continua sem gerar recorte, e as páginas de
gabarito e descritores também não.

`bandasDeLinhas` foi separada de `conteudoDePdf` justamente para poder
ser medida sem o pdf.js: o `teste42.js` converte o bbox do `pdftotext`
para o formato de linha que o pdf.js entrega e roda a mesma função. É o
jeito de testar recorte de imagem sem depender de renderização.


---

## v40 — a figura era recortada e jogada fora na linha seguinte

O professor cobrou os gráficos de novo, e a causa era muito mais simples
do que a geometria da v39.

A importação do SIMULADO chamava `textoDePdf`, cuja última linha é:

```js
.replace(new RegExp(MARCA_FIG+"\\d+","g"),"")   // apaga as marcas
```

Ou seja: `conteudoDePdf` detectava o gráfico, recortava a imagem e
devolvia tudo certo — e `textoDePdf` apagava as marcas antes de entregar
o texto. Sem a marca, `lerQuestoes` nunca põe `figIdx` na questão, e
`casarFiguras` não tem o que casar. **Nenhuma figura chegava ao caderno
de simulado, em nenhuma versão.** A importação de prova comum não passa
por aí — usa `conteudoDePdf` direto —, e é por isso que lá as figuras
sempre funcionaram e aqui nunca.

`textoEFigurasDePdf` devolve o texto COM as marcas mais os recortes;
`lerSimuladoDoc(txt, figuras)` chama `casarFiguras`. Medido no arquivo do
professor: as questões **2, 3, 7, 9, 10, 11 e 14** recebem a figura — as
que citam gráfico ou quadro — e nenhuma das puramente textuais recebe.

Quem for mexer: `textoDePdf` continua existindo e continua apagando as
marcas, porque outros pontos dependem de texto limpo. A importação de
simulado não pode voltar a usá-lo.


---

## v41 — expoentes de verdade e a cascata antes do corte

### 1. Expoente com tipografia, não com "^( )"

A v38 tinha resolvido a frase quebrada, não a tipografia: sobrava
`2^(0,5x)` impresso. Agora o texto guarda MARCAS invisíveis em volta do
trecho sobrescrito (`\u0002…\u0003`) ou subscrito (`\u0004…\u0005`), e
cada camada faz a sua parte:

- **leitura** (`emNivel`): usa Unicode quando cabe (`t²`, `x³`, `aⁿ`,
  `H₂O`) e marca quando não cabe (`0,5x`, `t − 1`);
- **telas** (`esc`): marcas viram `<sup>` e `<sub>`;
- **papel** (`gerador.js`): `textoComNiveis` desenha o trecho em corpo
  0,68 e levantado da linha de base.

A medida da linha usa `semMarcas`, e `remarcar` devolve as marcas às
linhas depois da quebra — andando pelas duas versões do texto em
paralelo. Detalhe que custou um teste: no fim de uma linha só ficam as
marcas de FECHAMENTO; a de abertura pertence à linha seguinte. Linha com
expoente não é justificada, porque o justificado do jsPDF distribui
espaços na string inteira e não conhece os pedaços.

`esc` agora resolve as marcas: quem imprimir texto em HTML sem passar por
ela vai ver quadradinhos.

### 2. A cascata que o professor tinha pedido

Ordem correta, agora implementada em `melhorAjuste`:

1. **escada de fonte** — já existia, roda dentro do gerador (10,5 → 9 pt);
2. **trocar questão** — `trocasPossiveis` procura, no ARQUIVO que o
   professor enviou, outra questão do MESMO descritor com texto pelo
   menos 15% menor, que ainda não esteja no caderno. Troca a mais
   comprida primeiro, remede, até seis trocas;
3. **cortar questões** — só depois de esgotadas as trocas.

Para isso, a importação passou a guardar `sm.reserva[comp]` com as
questões do arquivo (até 60 por componente). **Se o arquivo trouxer
exatamente a quantidade pedida, não há reserva e não há troca** — é o
caso dos arquivos atuais, com 15 questões para 15 pedidas. Para a troca
servir de alguma coisa, o arquivo precisa vir com folga.

O aviso de tela diz o que foi feito: quantas trocas, em quais questões, e
que nenhuma habilidade saiu do caderno.

### 3. Espaço em branco — diagnosticado, NÃO resolvido

Na foto, a página 1 sai com a questão 1 na coluna esquerda e a direita
inteira vazia. A causa está em `fluir`: as duas colunas de uma página
começam na mesma altura, e na primeira página elas começam ABAIXO do
cartão-resposta, que come cerca de 90 mm. Se o bloco da questão seguinte
for mais alto que a coluna encurtada, ele não cabe em nenhuma das duas —
e, como a ordem das questões não pode ser alterada (o gabarito individual
depende dela), nada mais entra: a página fecha com a coluna direita
vazia.

A correção certa é deixar uma questão comprida **começar numa coluna e
continuar na outra**, que é o que uma prova oficial faz. Isso exige
quebrar o bloco em pedaços com altura própria — hoje `blocosDaProva`
devolve blocos indivisíveis, com um único `desenhar()`. É trabalho de
verdade no motor de layout e não foi feito. Não tente resolver mexendo em
`melhorCorte`: ele só escolhe onde dividir uma sequência de blocos
inteiros entre as duas colunas.

> **RESOLVIDO na v43.** `blocosDaProva` passou a devolver unidades com
> altura própria e marca de cola, e `melhorCorte` recusa cortar dentro de
> um grupo colado. Ver a seção da v43, no fim deste arquivo.


---

## v42 — a figura vem antes do comando

Duas correções de posicionamento, vistas nas fotos da prova gerada.

### O comando estava antes do gráfico

No material oficial a sequência é **texto → gráfico ou tabela → comando →
alternativas**. O app desenhava todas as partes do enunciado (incluindo o
comando) e só então a figura: "Qual é a lei de formação dessa função?"
aparecia ACIMA do gráfico que ela manda observar.

`medidasQuestao` agora guarda `posFig` — a posição da figura entre as
partes, imediatamente antes do `comando` — e `desenharQuestaoCol`
desenha a imagem ao chegar nessa posição. Questão sem comando continua
com a figura no fim do enunciado. A altura total não muda, então o
encaixe nas colunas continua igual.

### Cabeçalho de tabela em duas linhas

"Número dito por" / "Carlos" é um cabeçalho partido em duas linhas. O
recorte puxava **uma** linha acima do bloco tabular; a outra sobrava
solta no enunciado e saía impressa por cima da imagem da tabela. Agora
puxa até duas, enquanto continuarem com cara de cabeçalho (poucas
palavras, curta, sem pontuação final).

O `teste45.js` usa um jsPDF de mentira que registra a ORDEM dos desenhos
— é assim que dá para afirmar que a imagem sai antes do comando sem
precisar renderizar PDF de verdade.

---

## v43 — a coluna direita deixou de ficar vazia

Esta versão é só do **motor de diagramação**. Nenhuma questão, gabarito,
descritor ou quantidade de itens mudou; o QR Code, o cartão-resposta e a
correção não foram tocados.

### 1. A questão virou uma lista de unidades

Era o item 3 da v41, diagnosticado e não resolvido: as duas colunas de uma
página começam na mesma altura, e na primeira elas começam ABAIXO do
cartão-resposta, que come uns 90 mm. Uma questão mais alta que a coluna
encurtada não cabia em nenhuma das duas, e como a ordem não pode mudar (o
gabarito individual depende dela), a página fechava com a coluna direita
em branco.

`blocosDaProva` não devolve mais blocos indivisíveis com um único
`desenhar()`. Cada questão passa por `unidadesQuestao()` e sai como uma
sequência de unidades com altura própria e uma marca `cola`, que diz
"esta não pode ser separada da seguinte":

| Unidade | Cola | Por quê |
|---|---|---|
| faixa de bloco (LÍNGUA PORTUGUESA) | sim | nunca órfã no pé da coluna |
| rótulo QUESTÃO NN | sim | idem |
| instrução, título | sim | idem |
| figura / gráfico / tabela | sim | anda junto do comando que manda observá-la |
| linha de parágrafo | só nas 2 primeiras e 2 últimas | viúvas e órfãs |
| fonte bibliográfica | sim | nunca fica isolada |
| comando | sim | nunca se separa das alternativas |
| alternativa 1 e penúltima | sim | nenhuma alternativa sozinha na coluna seguinte |
| última alternativa | não | fim da questão, corte livre |

`melhorCorte` recebe o vetor de colas e **recusa cortar dentro de um grupo
colado**. Quando nem o grupo inteiro cabe na coluna, `grupoColado()`
devolve o tamanho do grupo e ele transborda junto, em vez de a cola ser
partida no meio — que é o que o antigo `leva = 1` fazia.

**A regra que não pode ser quebrada:** `alturasCanonicas`, `empacotar`,
`paginasNoPior` e `fluir` medem as MESMAS unidades. Se a contagem de
páginas medir a questão inteira e o desenho empacotar unidades, a escolha
do corpo passa a mirar um layout que não é o que sai impresso — e o
estudante recebe uma página a mais sem ninguém entender por quê.

Efeito medido, com 10 questões de texto longo por componente: a v42
precisava descer para 10,2 pt para fechar em 4 páginas; a v43 fecha nas
mesmas 4 páginas **em 10,5 pt**.

De quebra, uma dívida de meio milímetro por figura: `medidasQuestao` media
`fig.h + 2,5` e `desenharFig` gastava `fig.h + 3`. Com blocos
indivisíveis isso se diluía; com unidades, não pode.

### 2. "2012. A informação principal desse texto é:"

A regex `Acesso em:[^.]*\.` parava no ponto de **"6 fev."**. O resto da
referência — "2012." — sobrava e era colado no começo do comando, e o
endereço do site aparecia impresso como se fosse frase do texto.

`FIM_FONTE` ganhou uma regra gulosa que vai até o ANO
(`Acesso em:[^\n]{0,60}?\b(19|20)\d{2}\s*\.`), com a antiga mantida como
rede de segurança para datas sem ano. Entraram também `Adaptado.` /
`Adaptado de…`, `Disponível em: <url>` e um último recurso para o
parágrafo que é a referência inteira sem nenhuma dessas fórmulas
("Fonte: Revista Veja, 2012."), reconhecido por `pareceReferencia`.

O estilo SOURCE_REFERENCE tem **piso de 8 pt** (`Math.max(8, fs − 2,2)`):
na escada do simulado o corpo chega a 9 pt, e `fs − 2,2` daria 6,8 —
ilegível numa folha xerocada. O ar depois da fonte subiu de 2,0 para
2,6 mm.

### 3. Cada elemento com o seu alinhamento

`classificarCorpo()` divide o texto de apoio em três tipos:

- **corpo** — prosa: justificada, com entrada de parágrafo;
- **verso** — três ou mais linhas curtas SEGUIDAS. Não é reconhecido
  linha a linha: uma frase curta solta no meio da prosa continua sendo
  prosa. Verso não é justificado, não leva recuo e tem entrelinha
  apertada dentro da estrofe;
- **formula** — expressão isolada e curta com símbolo matemático
  (`N(t) = 200 · 2ᵗ`): centralizada, sem recuo.

Gráficos e figuras passaram a ser centralizados na área útil da coluna.

Para centralizar ou alinhar à direita uma linha que traz expoente foi
preciso escrever `larguraComNiveis()`: o `align` do jsPDF não conhece os
pedaços de sobrescrito e jogaria o expoente para fora da coluna.

### 4. Cabeçalho do Simulado SAEPE

Faixa de 15 mm (contra 13 da prova comum): escola em 7 pt em cima,
**SIMULADO SAEPE** em 13 pt bold logo abaixo, com filete laranja sob a
palavra. `PROFESSOR:` sai do cabeçalho e a linha administrativa vira
`COMPONENTES: … DATA: …`.

O título vai em **branco sobre o navy**, não em laranja: laranja sobre
navy vira dois cinzas parecidos na impressão em preto e branco, que é
como a prova é aplicada. O laranja ficou no filete, que é enfeite e não
carrega informação. A prova comum não mudou em nada.

`cabecalho()` em modo `dry` continua devolvendo exatamente a mesma altura
do desenho — é dela que sai `topoPrimeira`, e uma diferença de um
milímetro aqui desalinha a paginação inteira.

### 5. PRE_FLIGHT_CHECK

`preFlightCheck(cfg, molde, corpo)` roda com o corpo já escolhido, antes
de desenhar, e devolve uma lista de avisos em português (lista vazia =
passou). Confere:

- **conteúdo** — nº de questões contra o gabarito, alternativas por
  questão, enunciado ou alternativa em branco, tamanho da lista de
  componentes;
- **matemática** — conta os CARACTERES sobrescritos e subscritos do
  original e os compara com os que sobreviveram à quebra de linha. Conta
  caracteres e não pedaços porque uma quebra no meio de um expoente
  divide o pedaço em dois sem perder nada. Sumindo algum, o aviso diz
  ERRO DE RENDERIZAÇÃO;
- **diagramação** — referência que vazou para dentro do comando, linha
  mais larga que a coluna, figura mais larga que a coluna, imagem no
  arquivo que não foi medida;
- **cabeçalho SAEPE** — instituição e componentes presentes.

O resultado aparece na tela ao gerar e na previsão do caderno. Ele
**avisa, não corrige**: mexer no conteúdo é justamente o que o motor de
diagramação não pode fazer.

### 6. Suítes novas

- `teste46` — cabeçalho SAEPE (professor ausente, título maior e em
  negrito, dry = desenho) e a separação da fonte bibliográfica, incluindo
  o caso do "2012.";
- `teste47` — as unidades: a soma das alturas fecha com `m.h +
  AR_QUESTAO()`, as colas seguram o que não pode ser separado, e uma
  questão mais alta que a coluna encurtada passa a ocupar as DUAS colunas;
- `teste48` — classificação de verso e fórmula, alinhamentos de cada
  elemento, figura centralizada, expoente que sobrevive à quebra, e os
  avisos do pre-flight.

O `teste48` usa um `splitTextToSize` de mentira **fiel à largura**: com a
quebra por chute dos outros arquivos falsos, a conferência de margem daria
falso positivo.

### O que continua em aberto

- `teste39`, `teste40`, `teste42` e `teste43` leem os PDFs reais do 1º
  Simulado em `/mnt/user-data/uploads/`. Sem esses arquivos elas não
  rodam — não é regressão, é insumo faltando.
- Troca de questão por texto menor (v41) continua dependendo de o arquivo
  do simulado trazer mais questões do que se pede.
- Cortes de 5º e 9º ano em Língua Portuguesa seguem da edição de 2018,
  sem conferência contra documento atual.

---

## v44 — o expoente que ia parar no fim da frase

### 1. `agruparLinhas` juntava na ordem de chegada, não na ordem de leitura

Nas fotos da prova gerada, a matemática saía assim:

    P(t) = P · 1,01 , em que P = 10 000 … o tempo em₀  ₀ anos.
    N(t) = 2 · 3 , em que N é o número de bactérias…

Os dois "₀" de P₀ tinham sido atirados para o fim da frase e o "ᵗ" de
1,01ᵗ e de 3ᵗ havia sumido do lugar em que significa alguma coisa.

A causa **não estava na diagramação**: estava na LEITURA do PDF. O pdf.js
não entrega o expoente no meio da sequência — ele emite primeiro o corpo
da linha e depois os pedaços deslocados da linha de base.
`agruparLinhas` fazia `u.txt += sobrescrito(txt)`, isto é, concatenava na
ordem de CHEGADA. Quando essa ordem coincidia com a de leitura, funcionava
(foi por isso que a v41 passou nos testes); quando não coincidia, o
expoente ia para o fim da linha.

Dentro de uma linha, **x crescente É a ordem de leitura**. Agora cada
linha acumula `pecas: [{x, txt}]` e `juntarPedacos()` ordena por x antes
de juntar. O `sort` do JS é estável, então pedaços com o mesmo x mantêm a
ordem de chegada e o texto sem expoente nenhum sai idêntico ao de antes.

De quebra isso melhora as tabelas achatadas numa linha só: as colunas
passam a sair em ordem de x.

**Esta correção é na leitura do arquivo.** O caderno guarda o que foi
lido na importação — os simulados já importados precisam ser importados
de novo.

Por que o PRE_FLIGHT_CHECK não pegou: ele compara o enunciado GUARDADO
com o que foi renderizado, e o enunciado guardado já vinha errado da
importação. Ele mede fidelidade de renderização, não de leitura — e a
renderização estava correta.

### 2. A estrofe centralizada como bloco

Pedido do professor, e é o padrão das provas de concurso: o poema é
deslocado para o meio da coluna. `centralizarVersos()` calcula o
deslocamento pelo verso MAIS LARGO do bloco e aplica o mesmo `dxBloco` a
todos os versos da estrofe.

Os versos continuam **alinhados à esquerda entre si**. Centralizar cada
verso isoladamente transformaria a estrofe num losango e destruiria
justamente a estrutura visual de que o poema depende — que é a razão de
`verso` existir como tipo desde a v43. O título do poema continua
centralizado como título, e a prosa não ganha deslocamento nenhum.

### 3. Suíte nova

`teste49` cobre as duas coisas: os pedaços fora de ordem (o caso do
`N(t) = 2 · 3ᵗ` e o do `P₀ · 1,01ᵗ … Adote 1,01²⁰ = 1,22.`, com os itens
na ordem em que o pdf.js os entrega), a sobrevivência do expoente até o
papel — desenhado em corpo menor, levantado da linha de base e à direita
do 3 que ele eleva — e a estrofe centralizada com folga igual dos dois
lados.

---

## v45 — o mesmo caderno em todas as turmas da série

O relato: a turma A fechava com 20 questões e a turma B, lendo
exatamente o mesmo arquivo, caía para 18.

### Onde estava

**Não estava na propagação de matriz**, que já copiava os itens
corretamente, nem na leitura. Estava na MEDIÇÃO.

A ordem das questões é semeada por **turma + número**
(`ordemDaProva` → `semente`). Cada turma embaralha de um jeito e o
encaixe nas colunas muda com a ordem. Só que:

- `paginasNoPior` percorria `chavesDaTurma(cfg, alunos)` — os alunos da
  turma da vez;
- `melhorAjuste` media com `turmaDe(sm.turma)` — a turma da vez.

Resultado: quem clicasse em gerar na turma B decidia o corpo da letra e o
corte de questões olhando **apenas para os alunos da B**. Cada turma
chegava a uma resposta própria para uma pergunta que é da série.

### A correção

`cfg.serie` passou a trazer TODAS as turmas que recebem o caderno (a do
simulado e as irmãs de matriz, via `turmasDoCaderno`), e `paresDeOrdem`
monta os pares `(turma, chave)` do conjunto inteiro. `paginasNoPior`
procura o pior caso entre todos eles.

Os pares são deduplicados, mas **o mesmo número em turmas diferentes NÃO
é o mesmo par**: a semente inclui o nome da turma, então o número 01 da
3A e o 01 da 3B embaralham diferente e ambos precisam ser medidos. Vale
também com tipos de prova: as chaves viram TIPO1..N, mas continuam sendo
por turma.

Sem `cfg.serie` — prova comum, ou simulado de turma única — o
comportamento é exatamente o de antes.

`aplicarAjuste` teve a ordem invertida: `sm.qtd` é atualizado ANTES de
`gravarCaderno`, porque é `gravarCaderno` que dispara `propagarNaSerie` e
a propagação copia o `qtd` do simulado de origem. Na ordem antiga as
turmas irmãs herdavam a quantidade ANTIGA e ficavam com o caderno cortado
e o contador dizendo outra coisa.

### Custo

`paginasNoPior` agora mede o pior caso de todas as turmas, não de uma.
Com 3 turmas de ~20 estudantes são ~60 empacotamentos por degrau de
fonte, contra ~20. A escada para no primeiro degrau que cabe, então na
prática o custo sobe pouco — e é o preço de a decisão ser correta.

### O que a v43 já tinha atenuado

Com blocos indivisíveis (até a v42) a paginação era muito sensível à
ordem, e a divergência entre turmas aparecia com facilidade. As unidades
da v43 reduziram bastante essa sensibilidade — mas reduzir não é
eliminar. O `teste50` fixa um conjunto de questões de alturas bem
variadas em que, medindo cada turma por si, a 3A escolhe 9,5 pt e a 3B e
a 3C escolhem 9,2 pt. É a asserção que dá sentido às outras: se as
turmas não divergissem sem `cfg.serie`, o teste estaria passando por
acidente.

### Suíte nova

`teste50` — três turmas (9, 31 e 24 estudantes) na mesma matriz:
`cfg.serie` lista as três partindo de qualquer uma; as três escolhem o
mesmo corpo, as mesmas páginas e o mesmo número de questões; a
divergência existe quando se mede cada turma por si; `paresDeOrdem`
dedupe, tipos de prova e o caso sem série; e o corte, quando acontece,
chega às três provas com o mesmo gabarito canônico e o mesmo `qtd`.

---

## v46 — mesma quantidade de questões por descritor

Regra do professor: com 10 questões e 5 descritores, 2 de cada. Com 9,
quatro descritores ficam com 2 e um com 1 — a sobra se **distribui**, não
se concentra.

### O que havia antes

Escolher n itens de uma lista era `slice(0, n)`. Como o arquivo traz as
questões **agrupadas por descritor**, cortar o fim apagava um descritor
inteiro: um caderno de 20 questões em 5 descritores virava 16 em 4, e a
habilidade sumia da prova e da análise por descritor junto com ela.

Isso acontecia em TRÊS lugares diferentes, cada um com o seu `slice`:

1. `selecionarItens` — quando o arquivo traz mais questões do que se
   pediu (ali era sorteio puro, que não olhava descritor nenhum);
2. `ajustarQuantidade` — quando o professor baixa a quantidade pedida;
3. `melhorAjuste` → `monta(corte)` — quando o caderno não cabe em quatro
   páginas nem na menor letra.

Os três passaram a chamar `escolherEquilibrado`.

### Como funciona

Sai sempre a questão excedente do descritor **mais numeroso**, uma de
cada vez, e dentro dele a última. O resultado é o mais equilibrado que a
lista permite, e a ordem original de quem fica é preservada.

Duas separações importam:

- **Item em branco é lugar reservado, não questão.** Sai antes de
  qualquer questão de verdade. Sem essa separação ele entrava no
  equilíbrio como se fosse um descritor, e o caderno perdia uma questão
  boa para preservar um espaço vazio.
- **Na importação, o sorteio vem primeiro e o equilíbrio depois.** O
  sorteio decide QUEM sai dentro de cada descritor — para não pegar
  sempre as mesmas questões do arquivo; o equilíbrio decide QUANTOS saem
  de cada um.

Verificado por varredura: para qualquer quantidade de 1 a 20 pedida sobre
20 questões em 5 descritores, a diferença entre o descritor mais e o
menos representado nunca passa de uma questão.

### Quando o arquivo não permite equilibrar

Se um descritor tem poucas questões no arquivo (D23 com 1, D22 com 8), o
equilíbrio faz o melhor possível — os escassos entram com tudo o que têm,
os abundantes cedem — mas a diferença permanece, e ela veio da FONTE. Dois
avisos novos dizem isso ao professor:

- na importação, a linha "Por descritor: D22 (2), D23 (2), …" e um alerta
  quando a diferença passa de uma questão;
- no `PRE_FLIGHT_CHECK`, o mesmo alerta por componente, mais um aviso
  quando há questão sem descritor — que fica de fora da análise por
  habilidade.

Para isso `cfgDoCaderno` passou a levar `desc` ao gerador.

### Suíte nova

`teste51` — o caso do professor (20 → 10 dá 2 de cada; 20 → 9 dá
2,2,2,2,1), a varredura de 1 a 20, o arquivo torto, a preservação da
ordem, as bordas (pedir mais do que existe, pedir zero, lista vazia,
itens em branco), os três pontos de corte usando a mesma regra e os
avisos do pre-flight.

---

## v47 — questões com as alternativas dentro da figura

O caso: "Assinale a alternativa cujo gráfico representa essa função", com
os cinco gráficos numa imagem só. Comparando o original com o caderno
gerado apareceram três coisas — e a terceira não era de diagramação.

### 1. A figura saía antes do comando

A regra da v43 ("primeiro o que se lê, depois o que se vê, e só então a
pergunta") vale para o gráfico de **apoio**. Quando a figura carrega as
alternativas ela é a RESPOSTA, e desenhá-la antes fazia o aluno ver as
cinco opções antes de saber o que procurar nelas.

`alternativasNaFigura()` detecta o caso — imagem presente e TODAS as
alternativas sem texto — e `posFig` passa a apontar para depois do
comando. Uma alternativa preenchida que seja, e a questão volta a ser
tratada como gráfico de apoio.

### 2. Cinco linhas "A)" vazias

Embaixo da figura saíam A), B), C), D), E) sem nada ao lado, porque as
alternativas não têm texto. Ruído e meia coluna desperdiçada. Nessas
questões `m.alts` fica vazio e nenhuma letra é impressa — as letras já
estão dentro da imagem.

Cuidado que isso trouxe: o ar entre uma questão e a seguinte
(`AR_QUESTAO`) vinha pendurado na ÚLTIMA alternativa. Sem alternativas
ele sumia e a soma das unidades deixava de bater com `m.h`. Passou para o
rabicho do enunciado quando `m.alts` está vazio.

### 3. O defeito silencioso: a correção saía errada

O app embaralha as alternativas por estudante e monta o gabarito
individual a partir desse embaralhamento. **A imagem é a mesma para todos
e não gira junto.** O gabarito apontava para a bolha errada e a questão
saía mal corrigida sem nenhum aviso.

`ordemDaProva` ganhou um parâmetro `fixas`: os índices canônicos cujas
alternativas não podem ser permutadas. A trava é aplicada ALI, depois de
`embaralharEmBlocos` reordenar `oq` — porque `oa[p]` é a permutação da
POSIÇÃO p e o item canônico que caiu nela é `oq[p]`. Fazer isso dentro de
`embaralho.js` exigiria mexer no que é espelho de `embaralho.py`; do jeito
que ficou, o espelho continua valendo palavra por palavra.

Os quatro pontos que precisam enxergar a MESMA trava:

- `blocosDaProva` (o que é impresso);
- `desenharCartao` → `gabaritoIndividual` (o gabarito no QR);
- `ordemDe`, no `index.html` (a correção);
- e `paginasNoPior`, que não precisa: `fixas` mexe só em `oa`, e a
  paginação depende de `oq`.

Medido no `teste52`: sem a trava, 7 de 8 posições travadas saíam com a
letra errada.

### Pre-flight

Deixou de acusar "alternativa em branco" nessas questões — não é erro, é
o formato — e passou a explicar: as opções estão na figura, a ordem fica
travada na original, e a figura foi desenhada depois do comando.
Alternativa em branco de verdade (algumas preenchidas, outras não)
continua sendo acusada.

### O que NÃO foi resolvido

**A figura fica pequena.** Uma imagem de cinco gráficos lado a lado tem
uns 300 mm de largura no original e a coluna do caderno tem 89 mm. O
`medirFigura` reduz para caber, e os gráficos saem em cerca de um terço do
tamanho. O `FIG_MAX_H` não é o limite aqui — a largura da coluna é.

A correção de verdade seria uma figura que atravessa as DUAS colunas, e
isso não cabe no modelo atual de fluxo: a ordem de leitura é coluna
esquerda inteira e depois a direita, e uma faixa de largura total no meio
da coluna esquerda seria lida fora de ordem. É trabalho de arquitetura no
`fluir`, não um ajuste — ficou anotado e não foi feito.

### Suíte nova

`teste52` — a detecção (e os casos que NÃO são: sem imagem, com uma
alternativa preenchida), a figura depois do comando, o gráfico de apoio
que não mudou, a ausência das letras vazias, as alturas fechando, a trava
do embaralhamento, o gabarito individual igual ao canônico nas travadas,
a divergência que existia sem a trava, e os avisos do pre-flight.

---

## v48 — o fim da PÁGINA também respeita a cola

Nas fotos da avaliação apareceram duas coisas que a v43 deveria ter
impedido:

- "Assinale a alternativa cujo gráfico representa essa função." no pé de
  uma página, com os cinco gráficos no alto da seguinte;
- a questão 10 com a alternativa **A) numa página e B) a E) na outra**.

### A cola era conferida em um lugar só

`melhorCorte` recusa cortar dentro de um grupo colado — mas ele decide
apenas a divisão entre as **duas colunas**. Quantas unidades entram na
página (`leva`) era escolhido pelo laço guloso sem olhar para `colas`. O
fim da página partia o grupo no meio.

`distribuirPagina` passou a exigir que `leva` caia num corte legal:
`i + leva >= fim` ou `!colas[i + leva − 1]`. `empacotar` e `fluir` usam a
mesma função — se as duas contas divergirem, a escolha do corpo mira um
layout que não sai impresso.

### O que foi medido, e o que não deu certo

Primeira tentativa: trocar o equilíbrio por "encher a coluna esquerda até
o limite e só então a direita", na expectativa de juntar as sobras e
fazer o grupo grande caber. Varredura em 230 provas com gráfico:
**nunca economizou uma página e gastou uma a mais em 6 casos.** Encher é
localmente ganancioso e globalmente pior — uma esquerda cheia demais
deixa a direita sem espaço para o grupo colado seguinte. Foi revertido; o
laço que cresce `n` enquanto existir divisão viável já é o máximo de
conteúdo possível na página.

O que a mesma varredura mostrou do defeito real: **153 das 230 provas
partiam pelo menos um grupo colado no fim de uma página** (165 quebras no
total). Depois da correção, zero.

O preço é honesto e está medido: 6 dos 230 casos ganham uma página,
porque o comando e o gráfico de 50 mm que ele manda observar descem
juntos em vez de se separarem. Uma questão inteira vale mais que meia
folha.

### A dica de corpo

Como manter o grupo inteiro às vezes custa folha, a prova comum passou a
informar quando uma letra menor resolveria: "Saiu com 3 páginas. Em 9,5 pt
caberia em 2 — o app não desce sozinho de 10 pt para não comprometer a
leitura."

O piso de 10 pt é decisão do projeto (`CORPOS`) e **não foi furado
aqui**. O app continua sem descer sozinho; só conta ao professor que a
saída existe. Quem decide é ele.

### O que continua em aberto

A figura de cinco gráficos ainda sai em cerca de um terço do tamanho
original, porque a coluna tem 89 mm (v47, "o que NÃO foi resolvido").
Enquanto ela for um bloco de ~50 mm indivisível, vai continuar abrindo
buracos no pé das colunas. A saída de verdade é a figura que atravessa as
duas colunas — trabalho de arquitetura no `fluir`.

### Suíte nova

`teste53` — o caso mínimo, uma varredura de 400 provas pseudoaleatórias
(1103 páginas) em que nenhum grupo colado é partido nem entre colunas nem
entre páginas e nenhuma paginação trava, a questão gráfica em dez
posições diferentes sem o comando se separar da figura, e a conferência
de que `empacotar` e o fluxo do desenho contam as mesmas páginas.

---

## v49 — todo estudante recebe o mesmo número de folhas

As questões saem em ordem diferente para cada estudante (é o que impede a
cola) e o encaixe nas colunas muda junto. Um recebia duas páginas e o
vizinho três — ruim para grampear, para conferir na entrega, e o
estudante percebe que a folha do colega é outra.

### 1. O nivelamento valia só para o simulado

```js
const alvoPag = cfg.simulado ? escolha.pgs : 0;   // até a v48
```

A avaliação comum saía desigual, e foi ela que apareceu com duas e três
páginas na mesma turma. Agora vale para as duas.

E o alvo deixou de ser confiado à previsão: `fluir` roda EM SECO para
todos os estudantes antes de desenhar, e o alvo é o maior entre esse
resultado e `escolha.pgs`. `paginasNoPior` é uma estimativa muito boa,
mas a garantia tem de ser exata.

`escolha.pgs` continua entrando no máximo de propósito: ele já carrega o
pior caso da SÉRIE inteira (v45), então a turma A e a turma B saem com a
mesma tiragem — não só os colegas de sala.

O alvo é sempre o PIOR caso. Ninguém perde questão para caber em menos
folha; quem sobra recebe uma folha de rascunho, que numa prova longa é
útil.

### 2. A medição olhava a ordem errada das alternativas

Defeito encontrado no caminho, e é a razão de a previsão nem sempre bater
com o impresso: `alturasCanonicas` media as alternativas na ordem
CANÔNICA, mas cada estudante as recebe embaralhadas. A soma das alturas
não muda com a ordem — mas a ordem decide **onde a cola cai** (primeira e
penúltima alternativas andam presas, e o ar entre questões fica pendurado
na última posição), e com isso muda a paginação.

`unidadesNaOrdem(q, perm, …)` remonta cada questão na ordem que aquele
estudante recebeu: o enunciado vem pronto de `alturasCanonicas`, e as
alternativas são reconstruídas de `altsBase` (as alturas CRUAS, sem o ar
final) na ordem de `oa[p]`. `paginasNoPior` passa a usá-la — e agora
mede exatamente o que `blocosDaProva` vai desenhar.

### O que foi medido

Turma de 24, avaliação de 10 questões com alturas bem diferentes e duas
questões cujas alternativas são gráficos (bloco de ~50 mm indivisível):

- sem nivelar: **2 a 3 páginas** na mesma turma;
- nivelado: **3 para todos**, com `tiragemPareja = true`;
- PDF com exatamente páginas × estudantes.

Numa varredura de 8 tamanhos de prova, 4 sairiam desiguais; todos os 8
saem parelhos.

`doc.paginasSemNivelar` guarda quantas cada um teria recebido, e a tela
conta: "A ordem das questões faria a turma receber de 2 a 3 páginas.
Todos saíram com 3 — a folha que sobra vira rascunho."

### Suíte nova

`teste54` — o caso que reproduz a desigualdade, o nivelamento na
avaliação e no simulado, a varredura de oito tamanhos, a garantia de que
o alvo é o pior caso e nunca menor, o total do PDF, a confirmação de que
o corpo da letra não muda por causa disso, e `unidadesNaOrdem` (soma
preservada, ordem trocada, cola posicional).

---

## v50 — nivelar por BAIXO, não por cima

A v49 garantiu que todo estudante recebe o mesmo número de folhas, mas
pelo caminho errado: levava todo mundo para o pior caso e dava uma folha
de rascunho em branco a quem já cabia. Corrigia o sintoma e era
artificial.

O raciocínio que faltava: **se a prova de um estudante coube em duas
páginas, a diferença para o colega que precisou de três é de
EMPACOTAMENTO, não de conteúdo.** O texto é idêntico; muda só a ordem.
Acrescentar folha a quem já cabia não corrige nada — só esconde.

### O que passou a acontecer

`paginasDaTurma` devolve o pior E o melhor caso. Quando os dois diferem,
o app desce a escada da letra procurando o degrau em que o PIOR caso cai
até onde o MELHOR já estava:

```
para cada degrau abaixo do atual:
    se pior(degrau) <= melhor(atual): adota e para
```

Para no primeiro que resolve, então a letra continua a maior possível
para aquele número de páginas. Só desce se economizar folha de verdade —
nunca por estética, nunca por pouco.

Isso **fura o piso de 10 pt** da prova comum (`CORPOS`), e furar é a
decisão certa aqui: uma folha a menos por estudante, na turma inteira,
vale mais que meio ponto de corpo. A escada da prova comum passou a ser
`CORPOS.concat(CORPOS_APERTO)` = 10,5 / 10 / 9,5 / 9. A tela conta o que
foi feito: "Letra reduzida de 10,5 para 9,5 pt: assim a turma inteira
cabe em 2 páginas em vez de 3, sem folha de rascunho sobrando."

A folha de rascunho continua existindo, como **último recurso**, para
quando nem o menor degrau iguala a turma. Aí a tela diz isso com todas as
letras.

### O que foi medido

Turma de 24, avaliação de 10 questões com alturas bem diferentes e duas
questões cujas alternativas são gráficos, em oito tamanhos de prova:

| | v49 | v50 |
|---|---|---|
| tiragem pareja | 8 de 8 | 8 de 8 |
| no menor nº de páginas | — | 8 de 8 |
| folhas de rascunho artificiais | 4 casos | **0** |

Nos quatro casos que a v49 fechava em 3 páginas com rascunho, a v50
fecha em 2 descendo de 10,5 para 9,5 pt.

### Cuidado ao mexer aqui

`doc.corpoPreferido` guarda o corpo que a escada teria escolhido só pelo
teto de páginas, e `doc.baixouCorpo` registra a troca. São os dois
números que a tela usa para explicar; não são decorativos.

O laço de descida é limitado pelo tamanho da escada e só roda enquanto
`pior > melhor` — sem isso, uma prova em que os dois nunca se igualam
faria o corpo despencar até o último degrau à toa.
