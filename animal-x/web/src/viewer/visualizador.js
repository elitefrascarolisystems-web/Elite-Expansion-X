import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VISTAS, gerarCao } from './especime-cao.js';
import { criarMaterial } from './materiais.js';

// Pós-processamento (GTAO, bloom, desfoque de fundo) ficou fora desta versão:
// nos testes, o GTAO apagava a silhueta translúcida e o bloom criava halo nos
// ossos. Volta quando puder ser validado numa GPU real.
export const QUALIDADES = {
  leve: { detalhe: 0.55, pixelRatio: 1, sombras: false },
  balanceado: { detalhe: 1, pixelRatio: 1.5, sombras: true },
  alto: { detalhe: 1.6, pixelRatio: 2, sombras: true },
};

const REALCE_SELECAO = new THREE.Color('#22d3c5');
const REALCE_HOVER = new THREE.Color('#7dd3fc');
const CAMADA_PELE = 1;

const facilitar = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// O three.js r186 envia sempre swizzle: 'rgba' (identidade) ao criar vistas
// de textura. Versões do Chrome anteriores à forma final da especificação
// recusam o campo. Remover a identidade não muda o resultado.
let compatibilidadeAplicada = false;
function compatibilidadeWebGPU() {
  if (compatibilidadeAplicada || !globalThis.GPUTexture?.prototype?.createView) return;
  compatibilidadeAplicada = true;
  const original = GPUTexture.prototype.createView;
  GPUTexture.prototype.createView = function createView(descritor) {
    if (descritor && descritor.swizzle === 'rgba') {
      const { swizzle: _identidade, ...resto } = descritor;
      return original.call(this, resto);
    }
    return original.call(this, descritor);
  };
}

async function imagemVazia(blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const tela = new OffscreenCanvas(32, 32);
    const ctx = tela.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, 32, 32);
    const { data } = ctx.getImageData(0, 0, 32, 32);
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0 && (data[i - 1] || data[i - 2] || data[i - 3])) return false;
    return true;
  } catch {
    return false;
  }
}

export class Visualizador {
  constructor(container, { aoSelecionar = () => {}, aoPassar = () => {}, aoMedir = () => {}, aoTrocarBackend = () => {}, rotuloDe = (e) => e } = {}) {
    this.container = container;
    this.aoTrocarBackend = aoTrocarBackend;
    this.aoSelecionar = aoSelecionar;
    this.aoPassar = aoPassar;
    this.aoMedir = aoMedir;
    this.rotuloDe = rotuloDe;
    this.malhas = new Map();
    this.selecionada = null;
    this.hover = null;
    this.realcadas = new Set();
    this.historico = [];
    this.opacidades = {};
    this.modoMedida = false;
    this.pontosMedida = [];
    this.mostrarRotulos = false;
    this.reduzirMovimento = false;
    this.voo = null;
    this.capturas = [];
    this.fps = 0;
    this.quadros = 0;
    this.ultimoFps = performance.now();
    this.cortes = { transversal: null, sagital: null, dorsal: null };
  }

  async iniciar(opcoes = {}) {
    this.opcoes = opcoes;
    if (!opcoes.forcarWebGL) {
      try {
        return await this.iniciarCom(opcoes);
      } catch (erro) {
        // WebGPU presente mas instável: recomeça em WebGL 2.
        console.warn('WebGPU falhou; usando WebGL 2.', erro);
        this.descartar();
        this.motivoWebGL = erro?.message ?? String(erro);
      }
    }
    return this.iniciarCom({ ...opcoes, forcarWebGL: true });
  }

  descartar() {
    this.renderer?.setAnimationLoop(null);
    this.observador?.disconnect();
    this.controles?.dispose();
    this.canvas?.remove();
    this.camadaRotulos?.remove();
    for (const m of this.malhas.values()) {
      m.geometry.dispose();
      m.material.dispose();
    }
    this.malhas.clear();
    this.renderer?.dispose();
    this.renderer = null;
  }

  async iniciarCom({ qualidade = 'balanceado', forcarWebGL = false, tema = 'escuro' } = {}) {
    compatibilidadeWebGPU();
    this.renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: forcarWebGL });
    await this.renderer.init();
    this.backend = this.renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
    this.renderer.onDeviceLost = (info) => this.aoPerderDispositivo(info);
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setSize(this.container.clientWidth || 800, this.container.clientHeight || 600);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'ax-canvas';
    this.canvas.setAttribute('aria-label', 'Visualizador 3D do espécime. Arraste para girar, role para aproximar.');
    this.canvas.tabIndex = 0;
    this.container.append(this.canvas);

    this.camadaRotulos = document.createElement('div');
    this.camadaRotulos.className = 'ax-rotulos';
    this.container.append(this.camadaRotulos);

    this.cena = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.01, 20);
    this.controles = new OrbitControls(this.camera, this.canvas);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.08;
    this.controles.minDistance = 0.08;
    this.controles.maxDistance = 4;
    this.controles.addEventListener('start', () => { this.voo = null; });

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.cena.environmentIntensity = 0.55;

    this.luzChave = new THREE.DirectionalLight('#fff4e6', 2.6);
    this.luzChave.position.set(0.9, 1.6, 1.1);
    this.luzChave.target.position.set(0, 0.3, 0);
    this.luzChave.shadow.camera.left = -0.75;
    this.luzChave.shadow.camera.right = 0.75;
    this.luzChave.shadow.camera.top = 0.75;
    this.luzChave.shadow.camera.bottom = -0.75;
    this.luzChave.shadow.camera.near = 0.2;
    this.luzChave.shadow.camera.far = 4;
    this.luzChave.shadow.bias = -0.0006;
    this.luzChave.shadow.normalBias = 0.01;
    const luzContra = new THREE.DirectionalLight('#9fdcff', 1.4);
    luzContra.position.set(-1.2, 0.9, -1.0);
    const luzPreenchimento = new THREE.HemisphereLight('#dbeafe', '#1e1b18', 0.5);
    this.cena.add(this.luzChave, this.luzChave.target, luzContra, luzPreenchimento);

    this.chao = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.ShadowNodeMaterial({ opacity: 0.32 }));
    this.chao.rotation.x = -Math.PI / 2;
    this.chao.receiveShadow = true;
    const anel = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.635, 128), new THREE.MeshBasicNodeMaterial({ color: '#22d3c5', transparent: true, opacity: 0.35 }));
    anel.rotation.x = -Math.PI / 2;
    anel.position.y = 0.0005;
    const anelInterno = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.424, 128), new THREE.MeshBasicNodeMaterial({ color: '#22d3c5', transparent: true, opacity: 0.18 }));
    anelInterno.rotation.x = -Math.PI / 2;
    anelInterno.position.y = 0.0006;
    this.cena.add(this.chao, anel, anelInterno);

    this.raiz = new THREE.ClippingGroup();
    this.raiz.clippingPlanes = [];
    this.cena.add(this.raiz);

    this.linhaMedida = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicNodeMaterial({ color: '#fbbf24', depthTest: false }));
    this.linhaMedida.renderOrder = 10;
    this.linhaMedida.visible = false;
    this.cena.add(this.linhaMedida);

    this.definirTema(tema);
    this.definirQualidade(qualidade);
    this.ligarEventos();
    this.observador = new ResizeObserver(() => this.redimensionar());
    this.observador.observe(this.container);
    this.redimensionar();
    this.irPara('geral', 0);
    // Primeiro quadro fora do laço: um erro aqui ainda permite trocar de backend.
    await this.renderer.compileAsync(this.cena, this.camera);
    this.renderer.render(this.cena, this.camera);
    this.renderer.setAnimationLoop((t) => this.quadro(t));
    return this;
  }

  // Se a placa de vídeo perder o dispositivo WebGPU (driver reiniciado,
  // ambiente sem GPU), recria tudo em WebGL 2 mantendo a cena.
  async aoPerderDispositivo(info) {
    if (this.backend !== 'WebGPU' || this.recuperando) return;
    this.recuperando = true;
    console.warn('Dispositivo WebGPU perdido; reiniciando em WebGL 2.', info?.message ?? '');
    const estado = this.malhas.size ? this.estadoCena() : null;
    const { qualidade, tema } = { qualidade: this.qualidade, tema: this.tema };
    this.descartar();
    this.motivoWebGL = info?.message || 'Dispositivo WebGPU perdido';
    await this.iniciarCom({ ...this.opcoes, qualidade, tema, forcarWebGL: true });
    if (estado) this.aplicarCena(estado, { animar: false, registrar: false });
    this.recuperando = false;
    this.aoTrocarBackend(this.backend, this.motivoWebGL);
  }

  // Desloca o centro da imagem para a direita (fração da largura), para o
  // objeto não ficar atrás de um cartão de legenda à esquerda.
  definirDeslocamento(fracao) {
    this.deslocamento = fracao;
    this.aplicarDeslocamento();
  }

  aplicarDeslocamento() {
    if (!this.camera) return;
    if (!this.deslocamento || !this.largura) {
      this.camera.clearViewOffset();
      return;
    }
    this.camera.setViewOffset(this.largura, this.altura, -this.largura * this.deslocamento, 0, this.largura, this.altura);
  }

  definirTema(tema) {
    this.tema = tema;
    this.cena.background = new THREE.Color(tema === 'claro' ? '#e9eef3' : '#070b12');
  }

  definirQualidade(qualidade) {
    const q = QUALIDADES[qualidade] ?? QUALIDADES.balanceado;
    this.qualidade = qualidade in QUALIDADES ? qualidade : 'balanceado';
    const estado = this.malhas.size ? this.estadoCena() : null;
    for (const malha of this.malhas.values()) {
      malha.geometry.dispose();
      malha.material.dispose();
      this.raiz.remove(malha);
    }
    this.malhas.clear();
    const inicio = performance.now();
    for (const parte of gerarCao(q.detalhe)) {
      const material = criarMaterial(parte.material, this.qualidade);
      const malha = new THREE.Mesh(parte.geometria, material);
      malha.name = parte.chave;
      malha.userData = { chave: parte.chave, estrutura: parte.estrutura, lado: parte.lado, sistema: parte.sistema };
      malha.castShadow = q.sombras && parte.material !== 'pele';
      malha.receiveShadow = q.sombras && parte.material !== 'pele';
      if (parte.material === 'pele') {
        malha.layers.set(CAMADA_PELE);
        malha.renderOrder = 5;
      }
      parte.geometria.computeBoundingBox();
      malha.userData.centro = parte.geometria.boundingBox.getCenter(new THREE.Vector3());
      this.raiz.add(malha);
      this.malhas.set(parte.chave, malha);
    }
    this.tempoGeracaoMs = Math.round(performance.now() - inicio);
    this.camera.layers.enable(CAMADA_PELE);
    this.renderer.shadowMap.enabled = q.sombras;
    this.luzChave.castShadow = q.sombras;
    this.luzChave.shadow.mapSize.set(this.qualidade === 'alto' ? 2048 : 1024, this.qualidade === 'alto' ? 2048 : 1024);
    this.luzChave.shadow.map?.dispose();
    this.luzChave.shadow.map = null;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    if (estado) this.aplicarCena(estado, { animar: false, registrar: false });
    else this.aplicarOpacidades();
  }

  redimensionar() {
    if (!this.camera || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h || (w === this.largura && h === this.altura)) return;
    this.largura = w;
    this.altura = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.aplicarDeslocamento();
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  quadro(t) {
    if (this.voo) {
      const k = Math.min(1, (t - this.voo.inicio) / this.voo.duracao);
      const e = facilitar(k);
      this.camera.position.lerpVectors(this.voo.dePos, this.voo.paraPos, e);
      this.controles.target.lerpVectors(this.voo.deAlvo, this.voo.paraAlvo, e);
      if (k >= 1) this.voo = null;
    }
    this.controles.update();
    this.renderer.render(this.cena, this.camera);
    if (this.capturas.length) {
      const pendentes = this.capturas.splice(0);
      this.canvas.toBlob((blob) => pendentes.forEach((r) => r(blob)), 'image/png');
    }
    this.atualizarRotulos();
    this.quadros += 1;
    const agora = performance.now();
    if (agora - this.ultimoFps >= 1000) {
      this.fps = Math.round((this.quadros * 1000) / (agora - this.ultimoFps));
      this.quadros = 0;
      this.ultimoFps = agora;
    }
  }

  // Câmera.
  // As vistas foram compostas para telas largas (cerca de 16:10). Em palcos
  // mais estreitos, a câmera recua para o enquadramento caber.
  irPara(vista, duracao = 900, { ajustarAspecto = true } = {}) {
    const v = typeof vista === 'string' ? VISTAS[vista] : vista;
    if (!v) return;
    // O palco pode ter acabado de mudar de tela: relê o tamanho antes de enquadrar.
    this.redimensionar();
    const paraAlvo = new THREE.Vector3(...v.alvo);
    const paraPos = new THREE.Vector3(...v.posicao);
    if (ajustarAspecto && this.camera.aspect < 1.6) {
      const fator = Math.min(2.4, 1.6 / Math.max(this.camera.aspect, 0.4));
      paraPos.sub(paraAlvo).multiplyScalar(fator).add(paraAlvo);
    }
    if (!duracao || this.reduzirMovimento) {
      this.camera.position.copy(paraPos);
      this.controles.target.copy(paraAlvo);
      this.voo = null;
      this.controles.update();
      return;
    }
    this.voo = { inicio: performance.now(), duracao, dePos: this.camera.position.clone(), paraPos, deAlvo: this.controles.target.clone(), paraAlvo };
  }

  focar(estruturas, duracao = 900) {
    this.redimensionar();
    const lista = new Set(Array.isArray(estruturas) ? estruturas : [estruturas]);
    const caixa = new THREE.Box3();
    for (const m of this.malhas.values()) if (lista.has(m.userData.estrutura) && m.visible) caixa.expandByObject(m);
    if (caixa.isEmpty()) return;
    const centro = caixa.getCenter(new THREE.Vector3());
    const raio = Math.max(caixa.getSize(new THREE.Vector3()).length() * 0.5, 0.03);
    // Distância para a esfera caber no menor dos dois campos de visão.
    const vfov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hfov = Math.atan(Math.tan(vfov) * this.camera.aspect);
    const distancia = (raio / Math.sin(Math.min(vfov, hfov))) * 1.1;
    const direcao = this.camera.position.clone().sub(this.controles.target).normalize();
    this.irPara({ posicao: centro.clone().add(direcao.multiplyScalar(distancia)).toArray(), alvo: centro.toArray() }, duracao, { ajustarAspecto: false });
  }

  // Visibilidade, com histórico para desfazer.
  registrar() {
    this.historico.push(this.estadoCena());
    if (this.historico.length > 50) this.historico.shift();
  }

  desfazer() {
    const estado = this.historico.pop();
    if (estado) this.aplicarCena(estado, { animar: false, registrar: false });
    return Boolean(estado);
  }

  malhasDe(alvo) {
    return [...this.malhas.values()].filter((m) => m.userData.chave === alvo || m.userData.estrutura === alvo);
  }

  ocultar(alvo) {
    this.registrar();
    for (const m of this.malhasDe(alvo)) m.visible = false;
    if (this.selecionada && !this.malhas.get(this.selecionada)?.visible) this.selecionar(null);
  }

  isolar(alvos) {
    this.registrar();
    const lista = new Set(Array.isArray(alvos) ? alvos : [alvos]);
    for (const m of this.malhas.values()) m.visible = lista.has(m.userData.chave) || lista.has(m.userData.estrutura) || lista.has(m.userData.sistema);
  }

  mostrarTudo() {
    this.registrar();
    for (const m of this.malhas.values()) m.visible = true;
  }

  definirSistema(sistema, visivel) {
    this.registrar();
    for (const m of this.malhas.values()) if (m.userData.sistema === sistema) m.visible = visivel;
  }

  sistemasVisiveis() {
    const r = {};
    for (const m of this.malhas.values()) r[m.userData.sistema] = (r[m.userData.sistema] ?? false) || m.visible;
    return r;
  }

  definirOpacidade(sistema, valor) {
    this.opacidades[sistema] = valor;
    this.aplicarOpacidades();
  }

  aplicarOpacidades() {
    for (const m of this.malhas.values()) {
      if (m.userData.sistema === 'tegumentar') continue;
      const o = this.opacidades[m.userData.sistema] ?? 1;
      m.material.transparent = o < 0.999;
      m.material.opacity = o;
      m.material.depthWrite = o >= 0.999;
      m.castShadow = o >= 0.999 && QUALIDADES[this.qualidade].sombras;
      m.material.needsUpdate = true;
    }
  }

  // Seleção e realce.
  selecionar(chave, { focar = false } = {}) {
    const anterior = this.selecionada;
    this.selecionada = chave && this.malhas.has(chave) ? chave : null;
    if (!this.selecionada && chave) {
      const primeira = this.malhasDe(chave)[0];
      this.selecionada = primeira?.userData.chave ?? null;
    }
    this.atualizarRealces();
    if (focar && this.selecionada) this.focar(this.malhas.get(this.selecionada).userData.estrutura);
    if (anterior !== this.selecionada) this.aoSelecionar(this.selecionada ? { ...this.malhas.get(this.selecionada).userData } : null);
  }

  realcar(estruturas = []) {
    this.realcadas = new Set(estruturas);
    this.atualizarRealces();
  }

  atualizarRealces() {
    for (const m of this.malhas.values()) {
      if (!m.material.emissive) continue;
      const { chave, estrutura } = m.userData;
      if (chave === this.selecionada) m.material.emissive.copy(REALCE_SELECAO).multiplyScalar(0.45);
      else if (this.realcadas.has(estrutura)) m.material.emissive.copy(REALCE_SELECAO).multiplyScalar(0.3);
      else if (chave === this.hover) m.material.emissive.copy(REALCE_HOVER).multiplyScalar(0.18);
      else m.material.emissive.setRGB(0, 0, 0);
    }
  }

  // Cortes: transversal (eixo X), sagital (eixo Z), dorsal (eixo Y).
  definirCorte(tipo, posicao) {
    const normais = { transversal: [-1, 0, 0], sagital: [0, 0, -1], dorsal: [0, -1, 0] };
    if (posicao === null || posicao === undefined) this.cortes[tipo] = null;
    else this.cortes[tipo] = new THREE.Plane(new THREE.Vector3(...normais[tipo]), posicao);
    this.raiz.clippingPlanes = Object.values(this.cortes).filter(Boolean);
  }

  pontoCortado(ponto) {
    return this.raiz.clippingPlanes.some((p) => p.distanceToPoint(ponto) < 0);
  }

  // Medida aproximada entre dois pontos de superfície.
  definirModoMedida(ativo) {
    this.modoMedida = ativo;
    this.pontosMedida = [];
    this.linhaMedida.visible = false;
  }

  registrarPontoMedida(ponto) {
    this.pontosMedida.push(ponto.clone());
    if (this.pontosMedida.length > 2) this.pontosMedida = [ponto.clone()];
    this.linhaMedida.geometry.setFromPoints(this.pontosMedida.length === 2 ? this.pontosMedida : [ponto, ponto]);
    this.linhaMedida.visible = this.pontosMedida.length === 2;
    if (this.pontosMedida.length === 2) {
      this.aoMedir({ metros: this.pontosMedida[0].distanceTo(this.pontosMedida[1]), pontos: this.pontosMedida.map((p) => p.toArray()) });
    }
  }

  // Interação.
  ligarEventos() {
    const raycaster = new THREE.Raycaster();
    raycaster.layers.enableAll();
    const ponteiro = new THREE.Vector2();
    let inicio = null;
    const intersecao = (evento) => {
      const r = this.canvas.getBoundingClientRect();
      ponteiro.set(((evento.clientX - r.left) / r.width) * 2 - 1, -((evento.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ponteiro, this.camera);
      const visiveis = [...this.malhas.values()].filter((m) => m.visible && m.userData.sistema !== 'tegumentar' && (m.material.opacity ?? 1) > 0.15);
      return raycaster.intersectObjects(visiveis, false).find((i) => !this.pontoCortado(i.point)) ?? null;
    };
    this.canvas.addEventListener('pointerdown', (e) => { inicio = { x: e.clientX, y: e.clientY }; });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!inicio || Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 5) return;
      const hit = intersecao(e);
      if (this.modoMedida) {
        if (hit) this.registrarPontoMedida(hit.point);
        return;
      }
      this.selecionar(hit ? hit.object.userData.chave : null);
    });
    let pendente = false;
    this.canvas.addEventListener('pointermove', (e) => {
      if (pendente || e.buttons) return;
      pendente = true;
      requestAnimationFrame(() => {
        pendente = false;
        const hit = intersecao(e);
        const chave = hit?.object.userData.chave ?? null;
        if (chave !== this.hover) {
          this.hover = chave;
          this.atualizarRealces();
          this.aoPassar(chave ? { ...hit.object.userData, x: e.clientX, y: e.clientY } : null);
        }
        this.canvas.style.cursor = chave ? 'pointer' : 'grab';
      });
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.hover = null;
      this.atualizarRealces();
      this.aoPassar(null);
    });
  }

  // Rótulos em pílula projetados sobre as estruturas.
  definirRotulos(ativo) {
    this.mostrarRotulos = ativo;
  }

  atualizarRotulos() {
    const alvos = new Map();
    if (this.selecionada) alvos.set(this.selecionada, true);
    if (this.mostrarRotulos) {
      for (const m of this.malhas.values()) {
        if (!m.visible || m.userData.sistema === 'tegumentar' || m.userData.lado === 'direito') continue;
        alvos.set(m.userData.chave, false);
      }
    }
    const existentes = new Map([...this.camadaRotulos.children].map((el) => [el.dataset.chave, el]));
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = new THREE.Vector3();
    for (const [chave, destaque] of alvos) {
      const m = this.malhas.get(chave);
      if (!m) continue;
      v.copy(m.userData.centro).project(this.camera);
      let el = existentes.get(chave);
      existentes.delete(chave);
      if (v.z > 1 || this.pontoCortado(m.userData.centro)) {
        el?.remove();
        continue;
      }
      if (!el) {
        el = document.createElement('div');
        el.className = 'ax-rotulo';
        el.dataset.chave = chave;
        el.textContent = this.rotuloDe(m.userData.estrutura, m.userData.lado);
        this.camadaRotulos.append(el);
      }
      el.classList.toggle('ax-rotulo--destaque', destaque);
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -130%)`;
    }
    for (const el of existentes.values()) el.remove();
  }

  // Captura do quadro atual em PNG. Se o navegador devolver o canvas vazio
  // (acontece com WebGPU em alguns ambientes), refaz a imagem lendo os pixels
  // de uma renderização em textura.
  async capturarImagem() {
    const blob = await new Promise((resolve) => this.capturas.push(resolve));
    if (blob && !(await imagemVazia(blob))) return blob;
    const { largura, altura, px } = await this.lerPixels(this.canvas.width, this.canvas.height);
    const tela = new OffscreenCanvas(largura, altura);
    const ctx = tela.getContext('2d');
    const dados = ctx.createImageData(largura, altura);
    // A textura guarda valores lineares: aplica a curva sRGB aproximada.
    for (let y = 0; y < altura; y++) {
      const origem = this.backend === 'WebGPU' ? y : altura - 1 - y;
      for (let x = 0; x < largura; x++) {
        const i = (origem * largura + x) * 4;
        const o = (y * largura + x) * 4;
        for (let c = 0; c < 3; c++) dados.data[o + c] = Math.round(255 * (px[i + c] / 255) ** (1 / 2.2));
        dados.data[o + 3] = 255;
      }
    }
    ctx.putImageData(dados, 0, 0);
    return tela.convertToBlob({ type: 'image/png' });
  }

  async lerPixels(largura = 640, altura = 400) {
    const alvo = new THREE.RenderTarget(largura, altura);
    const aspecto = this.camera.aspect;
    this.camera.aspect = largura / altura;
    this.camera.updateProjectionMatrix();
    this.renderer.setRenderTarget(alvo);
    this.renderer.render(this.cena, this.camera);
    this.renderer.setRenderTarget(null);
    this.camera.aspect = aspecto;
    this.camera.updateProjectionMatrix();
    const px = await this.renderer.readRenderTargetPixelsAsync(alvo, 0, 0, largura, altura);
    alvo.dispose();
    return { largura, altura, px };
  }

  // Estado serializável da cena (biblioteca, tours, desfazer).
  estadoCena() {
    return {
      camera: { posicao: this.camera.position.toArray(), alvo: this.controles.target.toArray() },
      ocultas: [...this.malhas.values()].filter((m) => !m.visible).map((m) => m.userData.chave),
      opacidades: { ...this.opacidades },
      selecionada: this.selecionada,
      cortes: Object.fromEntries(Object.entries(this.cortes).map(([k, p]) => [k, p ? p.constant : null])),
    };
  }

  aplicarCena(estado, { animar = true, registrar = true } = {}) {
    if (registrar) this.registrar();
    const ocultas = new Set(estado.ocultas ?? []);
    for (const m of this.malhas.values()) m.visible = !ocultas.has(m.userData.chave);
    this.opacidades = { ...(estado.opacidades ?? {}) };
    this.aplicarOpacidades();
    for (const tipo of Object.keys(this.cortes)) this.definirCorte(tipo, estado.cortes?.[tipo] ?? null);
    if (estado.camera) this.irPara(estado.camera, animar ? 900 : 0, { ajustarAspecto: false });
    this.selecionar(estado.selecionada ?? null);
  }

  estatisticas() {
    let triangulos = 0;
    let bytes = 0;
    for (const m of this.malhas.values()) {
      const g = m.geometry;
      triangulos += (g.index ? g.index.count : g.attributes.position.count) / 3;
      for (const a of Object.values(g.attributes)) bytes += a.array.byteLength;
      if (g.index) bytes += g.index.array.byteLength;
    }
    const estruturas = new Set([...this.malhas.values()].map((m) => m.userData.estrutura)).size;
    return {
      backend: this.backend,
      qualidade: this.qualidade,
      fps: this.fps,
      malhas: this.malhas.size,
      estruturas,
      triangulos: Math.round(triangulos),
      geometriaMB: +(bytes / 1048576).toFixed(1),
      geracaoMs: this.tempoGeracaoMs,
    };
  }
}
