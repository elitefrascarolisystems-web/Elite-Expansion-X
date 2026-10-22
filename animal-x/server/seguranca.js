import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

// Parâmetros do scrypt: N=2^15, r=8, p=1 (cerca de 32 MB por cálculo).
const N = 32768;
const R = 8;
const P = 1;
const TAMANHO = 64;
const MAXMEM = 96 * 1024 * 1024;

export async function gerarHash(senha) {
  const sal = randomBytes(16);
  const hash = await scrypt(senha.normalize('NFKC'), sal, TAMANHO, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function conferirSenha(senha, armazenado) {
  const partes = String(armazenado).split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, salB64, hashB64] = partes;
  const esperado = Buffer.from(hashB64, 'base64');
  const obtido = await scrypt(senha.normalize('NFKC'), Buffer.from(salB64, 'base64'), esperado.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
  });
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
}

// Hash fictício usado quando o e-mail não existe: o login faz o mesmo
// trabalho nos dois casos e não revela quem tem conta.
let hashFicticio;
export async function hashParaComparacao() {
  hashFicticio ??= await gerarHash(randomBytes(24).toString('base64'));
  return hashFicticio;
}

export function novoToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function iguaisSeguro(a, b) {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

// Limite de requisições por chave em janela fixa. A memória antiga é limpa
// periodicamente e também quando o mapa passa do tamanho máximo.
export class LimiteRequisicoes {
  constructor({ janelaMs, maximo, maxChaves = 50_000, relogio = Date.now, limpezaMs = 60_000 }) {
    this.janelaMs = janelaMs;
    this.maximo = maximo;
    this.maxChaves = maxChaves;
    this.relogio = relogio;
    this.mapa = new Map();
    if (limpezaMs > 0) {
      this.timer = setInterval(() => this.limpar(), limpezaMs);
      this.timer.unref?.();
    }
  }

  registrar(chave) {
    const agora = this.relogio();
    let item = this.mapa.get(chave);
    if (!item || item.fim <= agora) {
      if (!item && this.mapa.size >= this.maxChaves) this.limpar();
      if (!item && this.mapa.size >= this.maxChaves) {
        // Ainda cheio depois de limpar: descarta a entrada mais antiga.
        this.mapa.delete(this.mapa.keys().next().value);
      }
      item = { contagem: 0, fim: agora + this.janelaMs };
      this.mapa.set(chave, item);
    }
    item.contagem += 1;
    const permitido = item.contagem <= this.maximo;
    return { permitido, aguardarSegundos: permitido ? 0 : Math.ceil((item.fim - agora) / 1000) };
  }

  limpar() {
    const agora = this.relogio();
    for (const [chave, item] of this.mapa) if (item.fim <= agora) this.mapa.delete(chave);
  }

  zerar(chave) {
    this.mapa.delete(chave);
  }

  parar() {
    clearInterval(this.timer);
  }
}

export const CABECALHOS_SEGURANCA = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};
