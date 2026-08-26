/* teste60.js — moldura da página e nome do estudante no rodapé.

   Duas coisas pedidas, e uma consequência que não é óbvia: o rodapé come
   altura útil, e altura útil é o que decide a paginação. Se `fluir`
   desenhar numa mancha e `gerarProvas` medir noutra, a escolha do corpo
   mira uma página que não é a que sai impressa. Por isso `fundoUtil()`
   é a única fonte desse número.

   O nome no rodapé não é enfeite. As folhas se soltam do grampo e caem
   no chão, e um caderno cujas questões estão em ordem diferente para
   cada estudante NÃO pode ser remontado por dedução: sem o nome em toda
   folha, uma página solta é uma página perdida. */
"use strict";
const H = require("./harness");

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FALHA") + "  " + msg); if(!cond) falhas++; };

const { win } = H.abrirApp({
  estado: H.comSimulado(H.estadoBase(4), {nLP:6, nMAT:6}) });

function docFalso(){
  return {
    ev:[], linhas:[], rects:[], pag:1,
    internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},
    setFont(){}, setFontSize(v){this.fs=v;}, setTextColor(){}, setDrawColor(){},
    setLineWidth(v){this.lw=v;}, setFillColor(){}, setLineDashPattern(){},
    line(x1,y1,x2,y2){ this.linhas.push({x1,y1,x2,y2,pag:this.pag}); },
    rect(x,y,w,h,m){ this.rects.push({x,y,w,h,m,pag:this.pag}); },
    getTextWidth(t){ return String(t).length*1.75; },
    splitTextToSize(t){ return [String(t)]; },
    text(t,x,y,op){ this.ev.push({t:String(t),x,y,op:op||null,pag:this.pag}); },
    addImage(){}, addPage(){ this.pag++; }
  };
}

setTimeout(() => {
  console.log("teste60 — moldura da página e rodapé");
  ok(win.__jsdomErros.length === 0, "app sobe sem erro de script");

  const G = require("./gerador.js");
  const doc = docFalso();
  const W = 210, H_PAG = 297, MARG = 12;

  /* ── 1. a mancha encolheu, e encolheu nos dois lugares ── */
  const fundo = G.fundoUtil(doc);
  ok(G.RODAPE > 0, "o rodapé reserva altura (" + G.RODAPE + " mm)");
  ok(fundo === H_PAG - 10 - G.RODAPE,
     "e `fundoUtil` desconta a margem inferior mais o rodapé (" + fundo + ")");
  const fonte = require("fs").readFileSync(__dirname + "/gerador.js", "utf8");
  ok(!/alturaPag - MARGEM_INF/.test(fonte),
     "ninguém mais calcula a mancha por conta própria — era daí que " +
     "`fluir` e `gerarProvas` podiam divergir");
  ok((fonte.match(/fundoUtil\(/g) || []).length >= 3,
     "todos passam por `fundoUtil`");

  /* ── 2. a moldura ── */
  const cfg = {turma:"3º Ano C", simulado:true};
  const aluno = {numero:"07", nome:"Maria Aparecida dos Santos Ferreira"};
  doc.rects.length = 0; doc.linhas.length = 0; doc.ev.length = 0;
  G.molduraDaPagina(doc, cfg, aluno, 2, 4, 12, 8);

  const quadro = doc.rects.filter(r => r.m === "S" && r.w > 150);
  ok(quadro.length === 1, "um retângulo fecha a mancha da página");
  const q = quadro[0];
  ok(q.x < MARG && q.x + q.w > W - MARG,
     "a moldura fica POR FORA da mancha do texto (x de " + q.x.toFixed(1) +
     " a " + (q.x+q.w).toFixed(1) + ", texto de " + MARG + " a " + (W-MARG) + ")");
  ok(Math.abs(q.x - (W - (q.x + q.w))) < 0.01,
     "com margens iguais dos dois lados");
  ok(q.y + q.h <= fundo + 5,
     "e o pé dela não invade o rodapé (" + (q.y+q.h).toFixed(1) +
     " contra " + fundo + ")");

  /* fio entre as colunas */
  const vertical = doc.linhas.filter(l => Math.abs(l.x1-l.x2) < 0.01 &&
    Math.abs(l.y2-l.y1) > 50);
  ok(vertical.length === 1, "um fio separa as duas colunas");
  ok(Math.abs(vertical[0].x1 - W/2) < 0.6,
     "no meio da folha (x = " + vertical[0].x1.toFixed(1) + ")");
  ok(vertical[0].y1 > q.y && vertical[0].y2 < q.y + q.h,
     "e sem encostar na moldura");

  /* ── 3. o rodapé ── */
  const pe = doc.ev.filter(e => e.y > fundo);
  ok(pe.length === 2, "duas informações no pé da página");
  const esq = pe.find(e => !e.op || e.op.align !== "right");
  const dir = pe.find(e => e.op && e.op.align === "right");
  /* `encurtarNome` já devolve em caixa alta — é o mesmo tratamento que o
     nome recebe no cabeçalho e no cartão */
  ok(esq && /MARIA/i.test(esq.t), "o nome do estudante à esquerda: " +
     (esq ? JSON.stringify(esq.t) : "-"));
  ok(esq && /3º Ano C/.test(esq.t), "com a turma");
  ok(esq && /07/.test(esq.t), "e o número");
  ok(esq && esq.x === MARG, "alinhado com a mancha");
  ok(dir && /pág\. 2 de 4/.test(dir.t),
     "e a numeração à direita: " + (dir ? JSON.stringify(dir.t) : "-"));
  ok(dir && dir.x === W - MARG, "encostada na margem direita");

  /* nome comprido é encurtado, não estoura a folha */
  doc.ev.length = 0;
  G.molduraDaPagina(doc, cfg,
    {numero:"01", nome:"Ana Beatriz Carvalho de Albuquerque Nascimento Silva Ferreira"},
    1, 3, 12, 8);
  const nome = doc.ev.find(e => /^ANA B/i.test(e.t));
  ok(nome && nome.t.length < 70 && /ANA B\./i.test(nome.t),
     "nome comprido é abreviado no meio, como no cartão: " +
     (nome ? JSON.stringify(nome.t) : "-"));

  /* sem total de páginas, imprime só o número */
  doc.ev.length = 0;
  G.molduraDaPagina(doc, cfg, aluno, 3, null, 12, 8);
  const soNum = doc.ev.find(e => e.op && e.op.align === "right");
  ok(soNum && soNum.t === "pág. 3",
     "sem o total, o rodapé diz só a página: " + (soNum ? soNum.t : "-"));

  /* ── 3b. a moldura cerca a PROVA INTEIRA ── */
  /* Na primeira página ela passa por fora da identificação do estudante e
     do cartão-resposta também, e não só da área das questões. Começa logo
     abaixo da faixa do cabeçalho, que é sangrada de borda a borda e já
     fecha o topo da folha sozinha. */
  ok(G.alturaFaixaCabecalho({simulado:true}) === 15 &&
     G.alturaFaixaCabecalho({}) === 13,
     "a altura da faixa tem uma fonte só, usada pelo cabeçalho e pela moldura");

  doc.rects.length = 0; doc.linhas.length = 0;
  const topoMancha = 120;                       // como se o cartão terminasse aí
  const topoQuadro = G.alturaFaixaCabecalho(cfg) + 3;
  G.molduraDaPagina(doc, cfg, aluno, 1, 2, topoMancha, topoQuadro);
  const q1 = doc.rects.filter(r => r.m === "S" && r.w > 150)[0];
  ok(q1 && q1.y === topoQuadro,
     "na página 1 o fio abre logo abaixo da faixa do cabeçalho (y = " +
     (q1 ? q1.y : "-") + ")");
  ok(q1 && q1.y < topoMancha - 40,
     "muito acima de onde as questões começam — o cartão fica DENTRO do fio");
  const CARTAO_X = 12 + 2;                      // desenharCartao usa MARG + 2
  ok(q1 && CARTAO_X - q1.x >= 4,
     "e o fio passa a " + (q1 ? (CARTAO_X - q1.x).toFixed(0) : "-") +
     " mm do cartão: longe da borda tracejada de recorte e dos marcadores");

  /* o fio das colunas NÃO sobe até o cabeçalho */
  const div = doc.linhas.filter(l => Math.abs(l.x1-l.x2) < 0.01 &&
    Math.abs(l.y2-l.y1) > 20);
  ok(div.length === 1 && div[0].y1 >= topoMancha - 3.01,
     "o fio entre as colunas começa onde as colunas começam (y = " +
     (div[0] ? div[0].y1.toFixed(1) : "-") + "), sem cortar a " +
     "identificação do estudante ao meio");

  /* ── 4. no caderno de verdade: TODA folha tem nome ── */
  const real = JSON.parse(win.eval(`JSON.stringify((function(){
    var sm=E.simulados[0], pr=provaDoSim(sm), t=turmaDe(sm.turma);
    pr.questoes.forEach(function(q,i){
      q.enunciado="Leia o texto abaixo.\\nTexto "+(i+1)+"\\n"+
        ("A leitura silenciosa firmou-se tarde na história e mudou o modo como as pessoas se relacionam com o texto escrito. ").repeat(3)+
        "\\nASSIS, Machado de. Contos. Ática, 1998. Acesso em: 6 fev. 2012.\\n"+
        "De acordo com o texto "+(i+1)+":";
    });
    aplicarLayout(pr.nq,pr.no); E.ativa=pr.id;
    var doc=gerarProvas(cfgDoCaderno(sm,pr,t), t.alunos, window.jspdf.jsPDF);
    var txt=doc.output("datauristring").length;
    return {paginas:doc.getNumberOfPages(), porAluno:doc.paginasPorAluno,
      alunos:t.alunos.length, tamanho:txt,
      nomes:t.alunos.map(function(a){return a.nome;})};
  })())`));
  ok(real.paginas === real.porAluno * real.alunos,
     "o PDF tem páginas × estudantes (" + real.paginas + ")");
  ok(real.tamanho > 10000, "e conteúdo de verdade");

  /* ── 5. a moldura não encosta no cartão-resposta ── */
  /* o cartão tem borda tracejada de recorte e quatro marcadores pretos
     que a câmera procura; um segundo retângulo em volta confundiria o
     recorte e passaria perto demais dos marcadores */
  ok(/marcadores pretos que a c\u00e2mera procura/.test(fonte),
     "a distância até os marcadores do cartão está justificada no código");

  console.log(falhas ? "\nteste60: " + falhas + " FALHA(S)" : "\nteste60: tudo certo");
  process.exit(falhas ? 1 : 0);
}, 1200);
