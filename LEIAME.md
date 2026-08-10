# Como publicar

Esta pasta é o site inteiro. Não falta nada: as bibliotecas de terceiros já
estão aqui, então o app abre e funciona **sem internet** depois da primeira
visita.

## 1. Criar o repositório

1. No GitHub, **New repository** → nome à sua escolha → **Public** → *Create*.
2. Envie **todo o conteúdo desta pasta** para a raiz do repositório
   (o `index.html` precisa ficar na raiz, não dentro de outra pasta).
   Pelo site do GitHub: *Add file › Upload files* e arraste tudo, **incluindo
   a pasta `standard_fonts`**.
3. **Settings › Pages** → *Source*: `Deploy from a branch` → branch `main`,
   pasta `/ (root)` → *Save*.
4. Em um ou dois minutos o endereço aparece ali:
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`

## 2. Instalar no celular

Abra esse endereço no Chrome (Android) ou Safari (iPhone) **com internet** e
escolha *Adicionar à tela de início*. Deixe a página aberta uns segundos na
primeira vez: é quando o app se guarda no aparelho. Depois disso ele abre no
avião.

Para conferir: **Configurações › Verificar uso offline**.

## 3. A cada nova versão

Sempre que trocar o `index.html` (ou qualquer arquivo), **mude o número em
`sw.js`**:

```js
const VERSAO = "v4";   // → "v5", "v6", ...
```

Sem isso o celular continua servindo a versão velha guardada no cache. Com
isso, na próxima abertura aparece o aviso “Atualização disponível”.

---

## O que é cada arquivo

| Arquivo | Papel |
|---|---|
| `index.html` | O app inteiro: telas, estado, visão computacional |
| `layout.js` | Geometria do cartão-resposta |
| `embaralho.js` | Embaralhamento determinístico por (turma, número) |
| `gerador.js` | Monta as provas em PDF |
| `fonte.js` | DejaVu reduzida a 296 glifos (acentos e símbolos de matemática) |
| `sw.js` | Service Worker: faz o app abrir sem internet |
| `manifest.webmanifest`, `icone-*.png` | Instalação na tela de início |
| `sub.py` | Só para desenvolvimento: regera o `fonte.js` |
| `CONTEXTO.md` | Documentação do projeto |

Bibliotecas de terceiros, **não modificadas** — não precisa mexer:
`jsqr.js` (1.4.0), `jspdf.umd.min.js` (2.5.2), `qrcode.min.js`
(qrcode-generator 1.4.4), `mammoth.browser.min.js` (1.8.0),
`pdf.min.js` + `pdf.worker.min.js` (pdf.js 3.11.174, build *legacy*) e a
pasta `standard_fonts/` (do mesmo pdf.js).

> A pasta `standard_fonts/` não é opcional: sem ela, um PDF que não embute
> as próprias fontes é lido **sem texto nenhum**, e as tabelas saem vazias.

## Primeira abertura

O app abre no assistente: nome do professor → escolas → turmas de cada
escola → disciplinas de cada turma → bimestral ou trimestral daquela turma.
Dá para corrigir tudo depois em **Configurações › Escolas, turmas e
disciplinas** — encerrar um cadastro nunca apaga provas ou notas.

## Se você já usava a versão anterior

Não faça nada de especial: ao abrir a página nova, os dados que estão no
aparelho sobem sozinhos para o modelo novo (cada turma ganha a lista de
disciplinas e cada prova fica ligada à primeira delas). Ainda assim, antes
de trocar de versão vale abrir **Configurações › Baixar cópia** e guardar o
arquivo — é a única cópia que existe fora do celular.
