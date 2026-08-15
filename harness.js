/* harness.js — sobe o index.html de verdade dentro do jsdom.
   Usado pelas suítes teste*.js. Não faz parte do app publicado.

   Os <script src> locais são embutidos no HTML antes de subir, porque o
   jsdom não busca arquivos relativos do disco. As bibliotecas que não
   rodam em jsdom (mammoth, pdf.js) viram talos — nenhuma suíte daqui
   depende delas, e sem isso conferirPecas() sujaria a tela. */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const RAIZ = __dirname;
const LOCAIS = ["jsqr.js","embaralho.js","layout.js","jspdf.umd.min.js",
                "qrcode.min.js","fonte.js","gerador.js","planilha.js","saepe-oficial.js"];
const TALOS = {
  "mammoth.browser.min.js": "window.mammoth={};",
  "pdf.min.js": "window.pdfjsLib={GlobalWorkerOptions:{}};"
};

const proteger = s => s.replace(/<\/script>/gi, "<\\/script>");

function montarHTML(){
  let html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  html = html.replace(/<script>if\(typeof jsQR[\s\S]*?<\/script>/, "");
  LOCAIS.forEach(f => {
    const src = fs.readFileSync(path.join(RAIZ, f), "utf8");
    html = html.replace(`<script src="${f}"></script>`, () => "<script>" + proteger(src) + "</script>");
  });
  Object.keys(TALOS).forEach(f => {
    html = html.replace(`<script src="${f}"></script>`, () => "<script>" + TALOS[f] + "</script>");
  });
  return html;
}

function ctx2d(){
  return {
    drawImage(){}, clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){},
    closePath(){}, stroke(){}, fill(){}, arc(){}, setTransform(){},
    setLineDash(){}, fillRect(){}, save(){}, restore(){}, translate(){},
    getImageData: (x,y,w,h) => ({ data:new Uint8ClampedArray(w*h*4), width:w, height:h }),
    putImageData(){}, measureText: () => ({ width: 0 }),
    canvas: null, font:"", fillStyle:"", strokeStyle:"", lineWidth:1
  };
}

function abrirApp(opcoes){
  opcoes = opcoes || {};
  const vc = new VirtualConsole();
  const erros = [];
  vc.on("jsdomError", e => erros.push(e.message));
  if (opcoes.verboso) vc.sendTo(console);

  const dom = new JSDOM(montarHTML(), {
    url: "https://exemplo.test/app/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win){
      win.navigator.mediaDevices = { getUserMedia: () => Promise.reject(new Error("sem camera")) };
      win.alert = m => { (win.__alertas = win.__alertas || []).push(String(m)); };
      win.confirm = () => (opcoes.confirmar === undefined ? true : opcoes.confirmar);
      win.HTMLCanvasElement.prototype.getContext = function(){ const c = ctx2d(); c.canvas = this; return c; };
      win.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
      win.HTMLElement.prototype.scrollIntoView = function(){};
      if (opcoes.estado){
        win.localStorage.setItem("dbm_omr_v8", JSON.stringify(opcoes.estado));
        win.localStorage.setItem("dbm_setup_v6", "1");
      }
      if (opcoes.antes) opcoes.antes(win);
    }
  });
  const win = dom.window;
  win.__jsdomErros = erros;
  return { dom, win, erros };
}

/* ── fábrica de estado: escola + turma + alunos, sem simulado ── */
function estadoBase(nAlunos){
  const alunos = Array.from({length: nAlunos || 12}, (_,i) => ({
    numero: String(i+1).padStart(2,"0"),
    nome: "Estudante " + (i+1), desde: 1, ate: null }));
  return {
    v: 8,
    escolas: [{ id:"e1", nome:"Escola Modelo", curto:"Modelo", ativa:true }],
    turmas: [{ id:"t1", escola:"e1", nome:"3A", serie:"3º ano do Ensino Médio",
      ativa:true, disciplina:"Matemática",
      disciplinas:[{id:"d1",nome:"Matemática",ativa:true}],
      periodo:{tipo:"bimestre",qtd:4}, alunos }],
    simulados: [], saepe:{ totalParticipacao:10, previstos:8 },
    descritores:{ LP:{}, MAT:{} },
    provas: [], ativa: null, res: []
  };
}

/* caderno de simulado pronto: nLP itens de LP + nMAT de Matemática */
function comSimulado(E, opc){
  opc = opc || {};
  const nLP = opc.nLP == null ? 6 : opc.nLP,
        nMAT = opc.nMAT == null ? 6 : opc.nMAT, nq = nLP + nMAT;
  const id = opc.id || "sim1";
  const comps = [].concat(Array(nLP).fill("LP"), Array(nMAT).fill("MAT"));
  const letras = ["A","B","C","D","E"];
  const questoes = Array.from({length:nq}, (_,i) => ({
    enunciado: (opc.prefixo||"Item ") + (i+1) + " do caderno de simulado.",
    alternativas: letras.map(L => "Alternativa " + L + " do item " + (i+1)),
    correta: i % 5, imagem: null }));
  const gabC = questoes.map(q => letras[q.correta]).join("");
  const prova = { id:"p"+id, turma: opc.turma||"t1", disciplina:null,
    codigo:(opc.codigo||"SIM1"), titulo:(opc.titulo||"Simulado SAEPE 1"),
    periodo:null, nq, no:5, gabC,
    simulado:id, comps, desc: comps.map((c,i)=>"D"+((i%4)+1)),
    orig: comps.map((c,i)=>i+1), gabItens: gabC.split(""),
    habs:[], questoes, discursivas:[], criada: Date.now() };
  E.provas.push(prova);
  E.simulados.push({ id, turma: opc.turma||"t1", titulo:(opc.titulo||"Simulado SAEPE 1"),
    etapa:"3EM", ano: opc.ano||2026, prova:prova.id, metodo:"tri",
    alternarBlocos:true, tipos:0, qtd:{LP:nLP,MAT:nMAT}, fontes:{},
    valorParticipacao:1.25, partAluno:{} });
  E.descritores.LP = Object.assign({D1:"Localizar informação explícita",
    D2:"Inferir sentido de palavra", D3:"Identificar a tese de um texto",
    D4:"Reconhecer efeito de sentido"}, E.descritores.LP);
  E.descritores.MAT = Object.assign({D1:"Resolver problema com porcentagem",
    D2:"Resolver problema com função do 1º grau", D3:"Calcular área de figuras planas",
    D4:"Resolver equação do 2º grau"}, E.descritores.MAT);
  return E;
}

module.exports = { abrirApp, montarHTML, estadoBase, comSimulado, RAIZ };
