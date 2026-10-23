import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { iconLabel, territoryIcons } from "@/app/territory-icons";

/**
 * Pinos do mapa desenhados como imagens do próprio mapa (e não um elemento HTML por pino):
 * o nome da imagem diz tudo o que ela mostra, e ela só é desenhada quando o mapa pede.
 * Os ícones vêm do mesmo conjunto da plataforma (lucide), traçados no canvas sem depender
 * de fonte nem de internet.
 */
export const STATUS_CODES: Record<string, string> = { Ativo: "AT", Ativa: "AT", Pausado: "PA", Inativo: "IN", "Em treinamento": "TR", Convidado: "CO", Cliente: "PG" };

type Palette = { fill: string; stroke: string; ink: string; shape: "circle" | "square" };
// As mesmas cores dos pinos de antes: pessoas e cidades em círculo escuro; locais em quadrado colorido.
const PALETTES: Record<string, Palette> = {
  person: { fill: "#111111", stroke: "#ffffff", ink: "#edd374", shape: "circle" },
  city: { fill: "#111111", stroke: "#ffffff", ink: "#edd374", shape: "circle" },
  partner: { fill: "#235d48", stroke: "#ffffff", ink: "#ffffff", shape: "square" },
  event: { fill: "#354884", stroke: "#ffffff", ink: "#ffffff", shape: "square" },
  action: { fill: "#354884", stroke: "#ffffff", ink: "#ffffff", shape: "square" },
  Empresa: { fill: "#1d3f63", stroke: "#ffffff", ink: "#ffffff", shape: "square" },
  "Escritório": { fill: "#c9a227", stroke: "#111111", ink: "#111111", shape: "square" },
  "Network / comunidade": { fill: "#5b3a8c", stroke: "#ffffff", ink: "#ffffff", shape: "square" },
  "Instituição de ensino": { fill: "#1f6f6a", stroke: "#ffffff", ink: "#ffffff", shape: "square" },
  "Ponto de encontro": { fill: "#8a4b14", stroke: "#ffffff", ink: "#ffffff", shape: "square" },
};

/** Nome da imagem de um pino: "pin|paleta|ícone|situação|+". */
export function pinImageId(record: { kind: string; roles: string[]; status: string }, roleFilter = ""): string {
  const palette = record.kind === "business" ? (PALETTES[record.roles[0]] ? record.roles[0] : "Empresa") : PALETTES[record.kind] ? record.kind : "person";
  return ["pin", palette, iconLabel(record.roles, record.kind, roleFilter), STATUS_CODES[record.status] ?? "", record.roles.length > 2 ? "+" : ""].join("|");
}

export type IconShape = { tag: string; attrs: Record<string, string> };
const shapes = new Map<string, IconShape[]>();
/** Traços do ícone (caminhos, círculos, retângulos…) no quadro 24×24 do lucide. */
export function iconShapes(label: string): IconShape[] {
  const cached = shapes.get(label);
  if (cached) return cached;
  const icon = territoryIcons[label as keyof typeof territoryIcons] ?? territoryIcons.Pessoa;
  const markup = renderToStaticMarkup(createElement(icon, { size: 24 }));
  const parsed: IconShape[] = [];
  for (const [, tag, body] of markup.matchAll(/<(path|circle|rect|line|polyline|polygon|ellipse)\s([^>]*?)\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const [, name, value] of body.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) attrs[name] = value;
    parsed.push({ tag, attrs });
  }
  shapes.set(label, parsed);
  return parsed;
}

function traceIcon(ctx: CanvasRenderingContext2D, label: string) {
  const n = (value: string | undefined) => Number(value ?? 0);
  for (const { tag, attrs } of iconShapes(label)) {
    if (tag === "path") { ctx.stroke(new Path2D(attrs.d)); continue; }
    ctx.beginPath();
    if (tag === "circle") ctx.arc(n(attrs.cx), n(attrs.cy), n(attrs.r), 0, Math.PI * 2);
    else if (tag === "ellipse") ctx.ellipse(n(attrs.cx), n(attrs.cy), n(attrs.rx), n(attrs.ry), 0, 0, Math.PI * 2);
    else if (tag === "rect") ctx.roundRect(n(attrs.x), n(attrs.y), n(attrs.width), n(attrs.height), n(attrs.rx));
    else if (tag === "line") { ctx.moveTo(n(attrs.x1), n(attrs.y1)); ctx.lineTo(n(attrs.x2), n(attrs.y2)); }
    else {
      const points = (attrs.points ?? "").trim().split(/[\s,]+/).map(Number);
      for (let i = 0; i + 1 < points.length; i += 2) {
        if (i) ctx.lineTo(points[i], points[i + 1]); else ctx.moveTo(points[i], points[i + 1]);
      }
      if (tag === "polygon") ctx.closePath();
    }
    ctx.stroke();
  }
}

function canvas(width: number, height: number, ratio: number) {
  const element = document.createElement("canvas");
  element.width = Math.ceil(width * ratio);
  element.height = Math.ceil(height * ratio);
  // A imagem é lida logo em seguida (getImageData): canvas na memória comum evita a cópia de volta da placa de vídeo.
  const ctx = element.getContext("2d", { willReadFrequently: true })!;
  ctx.scale(ratio, ratio);
  return { ctx, image: () => ctx.getImageData(0, 0, element.width, element.height) };
}

/** Tamanho do pino desenhado (com folga para a situação embaixo e o "+" em cima). */
export const PIN_BOX = 52;
/** Desenha o pino pedido pelo mapa; devolve null se o nome não for de pino. */
export function drawPin(id: string, ratio = 2): ImageData | null {
  const [kind, paletteName, label, status, multi] = id.split("|");
  if (kind !== "pin") return null;
  const palette = PALETTES[paletteName] ?? PALETTES.person;
  const { ctx, image } = canvas(PIN_BOX, PIN_BOX, ratio);
  const center = PIN_BOX / 2, half = 18;
  ctx.save();
  ctx.shadowColor = "rgb(0 0 0 / 0.45)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.beginPath();
  if (palette.shape === "circle") ctx.arc(center, center, half, 0, Math.PI * 2);
  else ctx.roundRect(center - half, center - half, half * 2, half * 2, 9);
  ctx.fillStyle = palette.fill; ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = palette.stroke; ctx.stroke();
  // Ícone de 19 px no centro, com o traço do lucide.
  ctx.save();
  const scale = 19 / 24;
  ctx.translate(center - 12 * scale, center - 12 * scale); ctx.scale(scale, scale);
  ctx.strokeStyle = palette.ink; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  traceIcon(ctx, label);
  ctx.restore();
  if (status) {
    ctx.font = "700 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const width = ctx.measureText(status).width + 7;
    ctx.beginPath(); ctx.roundRect(center - width / 2, center + half - 6, width, 13, 4);
    ctx.fillStyle = "#111111"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "#eeeeee"; ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.fillText(status, center, center + half + 0.5);
  }
  if (multi) {
    ctx.beginPath(); ctx.arc(center + half - 1, center - half + 1, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#d6b94f"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "#111111"; ctx.stroke();
    ctx.fillStyle = "#111111"; ctx.font = "700 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("+", center + half - 1, center - half + 1.5);
  }
  return image();
}

/** "12", "1,2 mil": o número que vai dentro do agrupamento. */
export function countLabel(value: number): string {
  if (value < 1000) return String(value);
  return `${(Math.floor(value / 100) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
}
/** Desenha o número de um agrupamento ("num|1234"), em tinta escura sobre o círculo dourado. */
export function drawCount(id: string, ratio = 2): ImageData | null {
  const [kind, raw] = id.split("|");
  if (kind !== "num" || !/^\d+$/.test(raw ?? "")) return null;
  const text = countLabel(Number(raw));
  const font = `600 ${text.length > 4 ? 11 : 13}px "Space Grotesk", Inter, system-ui, sans-serif`;
  const probe = canvas(1, 1, 1).ctx;
  probe.font = font;
  const width = Math.ceil(probe.measureText(text).width) + 6;
  const { ctx, image } = canvas(width, 18, ratio);
  ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#0d0c0a";
  ctx.fillText(text, width / 2, 9.5);
  return image();
}
