"use client";
import { useEffect, useRef, useState } from "react";
import type { FeatureCollection, Point, Polygon } from "geojson";
import type { GeoJSONSource, LayerSpecification, Map as MapInstance, MapGeoJSONFeature } from "maplibre-gl";

import { Button } from "@/components/ui/button";
import { countLabel, drawCount, drawPin, pinImageId } from "@/app/map-pins";
import { applyBuildings, buildingLayer } from "@/lib/building-layer";
import { modePalette, rampFor, type MapMode } from "@/lib/map-modes";
import { mapStyle, type TerritoryTheme } from "@/lib/territory-appearance";
import { tenantFetch } from "@/lib/tenant-request";
import type { TerritoryRecord } from "@/lib/territory-types";

/** O que cada modo desenha, já calculado pela tela do mapa (a mesma conta alimenta a legenda). */
export type ModeLayer =
  | { mode: "explorar" }
  | { mode: "calor"; data: FeatureCollection<Point>; max: number }
  | { mode: "cobertura"; hexes: FeatureCollection<Polygon>; neighbors: FeatureCollection<Polygon>; bins: number }
  | { mode: "funil"; data: FeatureCollection<Point> }
  | { mode: "linha-do-tempo"; data: FeatureCollection<Point> }
  | { mode: "cidade-acesa"; data: FeatureCollection<Polygon> };
export type HoverCard = { title: string; lines: string[] };
type Target = { kind: "spot" | "hex"; index: number };

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
// Fontes do mapa: uma por modo. Cada feição tem id numérico, para destacar com feature-state.
const SOURCES = ["elite-points", "elite-heat", "elite-hex", "elite-hex-empty", "elite-funnel", "elite-timeline", "elite-towers"] as const;
/** Camadas de cada modo, e as que respondem ao mouse e ao toque. */
const MODE_LAYERS: Record<MapMode, { layers: string[]; interactive: string[] }> = {
  explorar: { layers: ["elite-bubble", "elite-bubble-count", "elite-point-halo", "elite-point"], interactive: ["elite-bubble", "elite-point"] },
  calor: { layers: ["elite-heat", "elite-heat-dot"], interactive: ["elite-heat-dot"] },
  cobertura: { layers: ["elite-hex-fill", "elite-hex-line", "elite-hex-empty-line"], interactive: ["elite-hex-fill"] },
  funil: { layers: ["elite-funnel"], interactive: ["elite-funnel"] },
  "linha-do-tempo": { layers: ["elite-timeline-glow", "elite-timeline-sale", "elite-timeline"], interactive: ["elite-timeline"] },
  "cidade-acesa": { layers: ["elite-towers"], interactive: ["elite-towers"] },
};
const SOURCE_OF: Record<string, string> = {
  "elite-bubble": "elite-points", "elite-point": "elite-points", "elite-heat-dot": "elite-heat", "elite-hex-fill": "elite-hex",
  "elite-funnel": "elite-funnel", "elite-timeline": "elite-timeline", "elite-towers": "elite-towers",
};
/** Textos dos controles do maplibre em português (leitor de tela e dicas). */
const LOCALE = {
  "Map.Title": "Mapa", "NavigationControl.ZoomIn": "Aproximar", "NavigationControl.ZoomOut": "Afastar", "NavigationControl.ResetBearing": "Voltar o norte para cima",
  "AttributionControl.ToggleAttribution": "Mostrar ou esconder os créditos do mapa", "AttributionControl.MapFeedback": "Informar erro no mapa", "Popup.Close": "Fechar",
};
const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const state = (name: string, on: unknown, off: unknown) => ["case", ["boolean", ["feature-state", name], false], on, off];

/** Cadastros do Explorar como pontos do mapa (o servidor já junta os do mesmo lugar). */
function pointCollection(records: TerritoryRecord[], roleFilter: string): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: records.flatMap((record, index) => {
      const l = record.location;
      if (l?.latitude == null || l.longitude == null || !l.validated) return [];
      return [{
        type: "Feature" as const, id: index, geometry: { type: "Point" as const, coordinates: [l.longitude, l.latitude] },
        properties: { index, total: record.aggregateCount ?? 1, people: record.aggregatePeople ?? Number(record.kind === "person"), icon: pinImageId(record, roleFilter) },
      }];
    }),
  };
}

/** As camadas de todos os modos (escondidas até o modo pedir), nas cores do fundo atual. */
/** Cor de cada faixa da cobertura (com menos faixas, espalhadas pela escala). */
function hexFill(dark: boolean, bins: number) {
  const colors = rampFor(Math.max(1, bins), modePalette(dark).sequential);
  return ["match", ["get", "bin"], ...colors.flatMap((color, i) => [i, color]), colors[0]];
}
function layerSpecs(dark: boolean): { below: LayerSpecification[]; above: LayerSpecification[] } {
  const p = modePalette(dark);
  const ink = dark ? "#ffffff" : "#111111";
  const hidden = { visibility: "none" as const };
  const bubble = ["any", ["has", "point_count"], [">", ["get", "total"], 1]];
  const single = ["all", ["!", ["has", "point_count"]], ["<=", ["get", "total"], 1]];
  const bubbleRadius = ["step", ["get", "total"], 16, 10, 19, 50, 23, 200, 27, 1000, 31];
  return {
    // Calor, hexágonos e torres ficam embaixo dos nomes de ruas e bairros.
    below: [
      { id: "elite-heat", type: "heatmap", source: "elite-heat", maxzoom: 17, layout: hidden, paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 15, 2.2],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 14, 12, 26, 15, 40],
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.12, p.sequential[0] + "8c", 0.35, p.sequential[1], 0.6, p.sequential[2], 0.8, p.sequential[3], 1, p.sequential[4]],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.9, 16, 0.35],
      } },
      { id: "elite-hex-fill", type: "fill", source: "elite-hex", layout: hidden, paint: {
        "fill-color": hexFill(dark, 5),
        "fill-opacity": state("hover", 0.85, 0.62),
      } },
      { id: "elite-hex-line", type: "line", source: "elite-hex", layout: hidden, paint: { "line-color": state("hover", ink, p.surface), "line-width": state("hover", 2.5, 1.5) } },
      { id: "elite-hex-empty-line", type: "line", source: "elite-hex-empty", layout: hidden, paint: { "line-color": p.sequential[2], "line-width": 1.2, "line-dasharray": [2, 2], "line-opacity": 0.8 } },
      { id: "elite-towers", type: "fill-extrusion", source: "elite-towers", layout: hidden, paint: {
        "fill-extrusion-color": state("hover", "#fff6cf", state("selected", "#fff6cf", p.tower)),
        "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.92, "fill-extrusion-vertical-gradient": true,
      } },
    ] as LayerSpecification[],
    above: [
      { id: "elite-heat-dot", type: "circle", source: "elite-heat", minzoom: 12, layout: hidden, paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 7], "circle-color": p.sequential[4],
        "circle-stroke-color": state("selected", ink, state("hover", ink, p.surface)), "circle-stroke-width": state("selected", 3, state("hover", 2.5, 1.5)),
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13.5, 1], "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13.5, 1],
      } },
      { id: "elite-funnel", type: "circle", source: "elite-funnel", layout: { ...hidden, "circle-sort-key": ["-", 0, ["get", "size"]] }, paint: {
        "circle-radius": ["interpolate", ["linear"], ["sqrt", ["max", 1, ["get", "size"]]], 1, 7, 3, 12, 6, 17],
        "circle-color": ["match", ["get", "group"], 0, p.stages[0], 1, p.stages[1], 2, p.stages[2], 3, p.stages[3], p.lost],
        "circle-stroke-color": state("selected", ink, state("hover", ink, p.surface)), "circle-stroke-width": state("selected", 3.5, state("hover", 3, 2)),
      } },
      { id: "elite-timeline-glow", type: "circle", source: "elite-timeline", filter: ["==", ["get", "fresh"], true], layout: hidden, paint: { "circle-radius": 17, "circle-color": p.sequential[4], "circle-opacity": 0.3, "circle-blur": 0.8 } },
      { id: "elite-timeline-sale", type: "circle", source: "elite-timeline", filter: ["==", ["get", "paid"], true], layout: hidden, paint: { "circle-radius": ["case", ["==", ["get", "fresh"], true], 13, 10], "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": p.sale, "circle-stroke-width": 2.5 } },
      { id: "elite-timeline", type: "circle", source: "elite-timeline", layout: hidden, paint: {
        "circle-radius": ["case", ["==", ["get", "fresh"], true], 8, ["==", ["get", "city"], true], 4, 5.5],
        "circle-color": ["case", ["==", ["get", "fresh"], true], p.sequential[4], p.sequential[2]],
        "circle-opacity": ["case", ["==", ["get", "fresh"], true], 1, 0.75],
        "circle-stroke-color": state("selected", ink, state("hover", ink, p.surface)), "circle-stroke-width": state("selected", 3, state("hover", 2.5, 1.5)),
      } },
      { id: "elite-bubble", type: "circle", source: "elite-points", filter: bubble, layout: hidden, paint: {
        "circle-radius": bubbleRadius, "circle-color": "#c9a227",
        "circle-stroke-color": state("selected", "#ffffff", state("hover", "#fff6cf", "#f3e3a3")), "circle-stroke-width": state("selected", 4, state("hover", 4, 2)),
      } },
      { id: "elite-bubble-count", type: "symbol", source: "elite-points", filter: bubble, layout: { ...hidden, "icon-image": ["concat", "num|", ["to-string", ["get", "total"]]], "icon-allow-overlap": true, "icon-ignore-placement": true } },
      { id: "elite-point-halo", type: "circle", source: "elite-points", filter: single, layout: hidden, paint: {
        // Raio zero fora do destaque: nada a desenhar para os milhares de pontos comuns.
        "circle-radius": state("selected", 25, state("hover", 25, 0)), "circle-color": "#d6b94f", "circle-opacity": state("selected", 0.45, 0.25),
        "circle-stroke-color": "#f3e3a3", "circle-stroke-width": state("selected", 2, 0),
      } },
      { id: "elite-point", type: "symbol", source: "elite-points", filter: single, layout: { ...hidden, "icon-image": ["get", "icon"], "icon-allow-overlap": true, "icon-ignore-placement": true } },
    ] as LayerSpecification[],
  };
}

/**
 * Motor do mapa: maplibre com fontes GeoJSON, agrupamento nativo e ícones desenhados como
 * imagens do mapa (fluido com milhares de pontos). Cada modo liga as próprias camadas; a busca
 * por área visível continua no servidor e a lista ao lado é a alternativa acessível a todos os modos.
 */
export function TerritoryCanvas({ records, onSelect, onPick, focus, fitToken = 0, theme = "dark", roleFilter = "", onViewport, layer = { mode: "explorar" }, describe, onSpot, onZoom, selectedSpot = null }: {
  records: TerritoryRecord[]; onSelect: (items: TerritoryRecord[]) => void; onPick?: (lat: number, lng: number) => void;
  focus?: TerritoryRecord | null; fitToken?: number; theme?: TerritoryTheme; roleFilter?: string; onViewport?: (bounds: string) => void;
  /** Modo e dados já calculados (Explorar quando omitido). */
  layer?: ModeLayer;
  /** Cartão de um local ou hexágono ao passar o mouse. */
  describe?: (target: Target) => HoverCard | null;
  /** Clique num local dos modos (abre a ficha ao lado). */
  onSpot?: (spot: number) => void;
  /** Aproximação ao fim de cada movimento (tamanho dos hexágonos e das torres). */
  onZoom?: (zoom: number) => void;
  /** Local destacado nos modos (o da ficha aberta). */
  selectedSpot?: number | null;
}) {
  const host = useRef<HTMLDivElement>(null), map = useRef<MapInstance | null>(null);
  const props = useRef({ records, onSelect, onPick, theme, roleFilter, focus, onViewport, layer, describe, onSpot, onZoom, selectedSpot });
  useEffect(() => { props.current = { records, onSelect, onPick, theme, roleFilter, focus, onViewport, layer, describe, onSpot, onZoom, selectedSpot }; });
  const [mapConfig, setMapConfig] = useState<{ satellite: string | null; hybrid: string | null } | null>(null);
  const [base, setBase] = useState<"streets" | "satellite" | "hybrid">("streets");
  useEffect(() => { const c = new AbortController(); tenantFetch("/api/map-config", { signal: c.signal }).then((r) => (r.ok ? r.json() : null)).then((v) => { if (v) setMapConfig(v); }).catch(() => {}); return () => c.abort(); }, []);
  const buildingMode = useRef(false), styleReady = useRef(false), styleKey = useRef("");
  const [coverage, setCoverage] = useState("");
  const [fallback, setFallback] = useState(false), [perspective, setPerspective] = useState(false);
  const [error, setError] = useState(""), [loaded, setLoaded] = useState(false), [retry, setRetry] = useState(0);
  // Cartão ao passar o mouse, já posicionado dentro do mapa; vale só para o modo em que nasceu.
  const [card, setCard] = useState<(HoverCard & { left: number; top: number; mode: MapMode }) | null>(null);
  const sync = useRef<() => void>(() => {});
  const mode = layer.mode;

  useEffect(() => {
    let cancelled = false; let observer: ResizeObserver | undefined;
    import("maplibre-gl").then((m) => {
      if (cancelled || !host.current) return;
      styleReady.current = false; styleKey.current = mapStyle(props.current.theme);
      const instance = new m.Map({ container: host.current, center: [-44.18, -19.86], zoom: 10, renderWorldCopies: false, attributionControl: false, style: styleKey.current, maxPitch: 65, locale: LOCALE });
      map.current = instance;
      instance.addControl(new m.NavigationControl({ visualizePitch: true }), "top-right");
      instance.addControl(new m.AttributionControl({ compact: false }), "bottom-right");
      instance.addControl(new m.ScaleControl({ unit: "metric" }), "bottom-left");
      const ratio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
      // Pinos e números são desenhados quando o mapa pede (e de novo a cada troca de estilo).
      instance.on("styleimagemissing", (e) => { if (instance.hasImage(e.id)) return; const image = drawPin(e.id, ratio) ?? drawCount(e.id, ratio); if (image) instance.addImage(e.id, image, { pixelRatio: ratio }); });
      let painted: { mode?: MapMode; points?: string; layer?: ModeLayer } = {};
      /** Assinatura dos pontos: mesma assinatura, mesmo desenho (não reagrupa à toa a cada movimento). */
      const signature = (list: TerritoryRecord[], filter: string) => filter + "|" + list.map((r) => `${r.key}:${r.aggregateCount ?? 1}:${r.location?.latitude}:${r.location?.longitude}:${r.status}`).join(",");
      let hovered: { source: string; id: number } | null = null, selected: { source: string; id: number }[] = [];
      const dark = () => props.current.theme === "dark";
      function ensureLayers() {
        if (instance.getLayer("elite-point")) return;
        for (const id of SOURCES) if (!instance.getSource(id)) instance.addSource(id, id === "elite-points"
          ? { type: "geojson", data: EMPTY, cluster: true, clusterRadius: 46, clusterMaxZoom: 15, clusterProperties: { total: ["+", ["get", "total"]], people: ["+", ["get", "people"]] } }
          : { type: "geojson", data: EMPTY });
        const labels = instance.getStyle().layers?.find((l) => l.type === "symbol" && !l.id.startsWith("elite-"))?.id;
        const specs = layerSpecs(dark());
        for (const spec of specs.below) instance.addLayer(spec, labels);
        for (const spec of specs.above) instance.addLayer(spec);
      }
      function setSelection() {
        for (const s of selected) instance.setFeatureState(s, { selected: false });
        selected = [];
        const { focus: f, records: list, layer: current, selectedSpot: spot } = props.current;
        if (current.mode === "explorar") {
          const lat = f?.location?.latitude, lng = f?.location?.longitude;
          if (lat == null || lng == null) return;
          list.forEach((r, i) => { if (r.key === f!.key || (r.location?.latitude === lat && r.location?.longitude === lng)) selected.push({ source: "elite-points", id: i }); });
        } else if (spot != null && current.mode !== "cobertura") selected.push({ source: SOURCE_OF[MODE_LAYERS[current.mode].interactive[0]], id: spot });
        for (const s of selected) instance.setFeatureState(s, { selected: true });
      }
      function paint() {
        // Entre a troca de estilo e o "style.load" o mapa não aceita fontes nem camadas.
        if (!styleReady.current) return;
        ensureLayers();
        const { layer: current, records: list, roleFilter: filter } = props.current;
        for (const [name, spec] of Object.entries(MODE_LAYERS)) for (const id of spec.layers) instance.setLayoutProperty(id, "visibility", name === current.mode ? "visible" : "none");
        const source = (id: string) => {
          // Dados novos numa fonte: os destaques antigos (mouse, seleção) saem junto, para não marcar o ponto errado.
          if (instance.getSource(id)) instance.removeFeatureState({ source: id });
          if (hovered?.source === id) { hovered = null; setCard(null); }
          return instance.getSource(id) as GeoJSONSource | undefined;
        };
        if (current.mode === "explorar") {
          const points = signature(list, filter);
          if (points !== painted.points || painted.mode !== "explorar") { selected = []; source("elite-points")?.setData(pointCollection(list, filter)); }
          painted.points = points;
        }
        // Ao trocar de modo, a tela do mapa recebe a área visível (o Explorar busca os pontos dela) e a aproximação.
        if (current.mode !== painted.mode && painted.mode !== undefined) reportViewport();
        if (current !== painted.layer) {
          if (current.mode !== "explorar") selected = [];
          if (current.mode === "calor") {
            source("elite-heat")?.setData(current.data);
            instance.setPaintProperty("elite-heat", "heatmap-weight", ["interpolate", ["linear"], ["get", "weight"], 0, 0, Math.max(1, current.max), 1]);
            // Com muitos pontos o calor satura; a intensidade cai com a quantidade para o "muito" continuar raro.
            const base = Math.min(1.5, Math.max(0.3, 30 / Math.sqrt(Math.max(1, current.data.features.length))));
            instance.setPaintProperty("elite-heat", "heatmap-intensity", ["interpolate", ["linear"], ["zoom"], 8, base * 0.6, 15, base * 1.8]);
          }
          if (current.mode === "cobertura") {
            source("elite-hex")?.setData(current.hexes); source("elite-hex-empty")?.setData(current.neighbors);
            instance.setPaintProperty("elite-hex-fill", "fill-color", hexFill(dark(), current.bins));
          }
          if (current.mode === "funil") source("elite-funnel")?.setData(current.data);
          if (current.mode === "linha-do-tempo") source("elite-timeline")?.setData(current.data);
          if (current.mode === "cidade-acesa") source("elite-towers")?.setData(current.data);
        }
        // Na Cidade acesa os prédios reais ficam em 3D, num tom neutro, e as torres acendem.
        const city = current.mode === "cidade-acesa";
        applyBuildings(instance, buildingMode.current || city);
        if (instance.getLayer(buildingLayer.id)) instance.setPaintProperty(buildingLayer.id, "fill-extrusion-color", city ? (dark() ? "#34322b" : "#d9d5ca") : "#a99053");
        painted = { ...painted, mode: current.mode, layer: current };
        setSelection();
      }
      sync.current = paint;
      function reportViewport() {
        const b = instance.getBounds();
        props.current.onViewport?.([Math.min(180, Math.max(-180, b.getWest())), Math.max(-85, b.getSouth()), Math.max(-180, Math.min(180, b.getEast())), Math.min(85, b.getNorth())].map((n) => n.toFixed(6)).join(","));
        props.current.onZoom?.(instance.getZoom());
      }
      function target(feature: MapGeoJSONFeature): Target | null {
        if (feature.layer.id === "elite-hex-fill") return { kind: "hex", index: Number(feature.properties.hex) };
        return feature.properties.spot === undefined ? null : { kind: "spot", index: Number(feature.properties.spot) };
      }
      function cardFor(feature: MapGeoJSONFeature): HoverCard | null {
        if (feature.layer.id === "elite-bubble") {
          const total = Number(feature.properties.total), people = Number(feature.properties.people);
          return { title: `${countLabel(total)} registros`, lines: [`${people} ${people === 1 ? "pessoa única" : "pessoas únicas"}`, feature.properties.point_count ? "Clique para abrir o agrupamento" : "Clique para ver a lista deste ponto"] };
        }
        if (feature.layer.id === "elite-point") {
          const record = props.current.records[Number(feature.properties.index)];
          return record ? { title: record.name, lines: [record.roles.filter((r) => r !== "Pessoa").join(" · ") || "Pessoa", record.status].filter(Boolean) } : null;
        }
        const t = target(feature);
        return t ? props.current.describe?.(t) ?? null : null;
      }
      function show(content: HoverCard | null, x: number, y: number) {
        if (!content) { setCard(null); return; }
        const { width, height } = instance.getContainer().getBoundingClientRect();
        setCard({ ...content, left: Math.max(8, Math.min(x + 14, width - 250)), top: Math.max(8, Math.min(y + 14, height - 110)), mode: props.current.layer.mode });
      }
      function hover(feature: MapGeoJSONFeature | null, x = 0, y = 0) {
        const next = feature && feature.id !== undefined ? { source: SOURCE_OF[feature.layer.id] ?? feature.source, id: Number(feature.id) } : null;
        if (hovered && (!next || hovered.source !== next.source || hovered.id !== next.id)) instance.setFeatureState(hovered, { hover: false });
        if (next) instance.setFeatureState(next, { hover: true });
        hovered = next;
        show(feature ? cardFor(feature) : null, x, y);
        instance.getCanvas().style.cursor = feature ? "pointer" : "";
      }
      const hit = (point: { x: number; y: number }) => {
        const layers = MODE_LAYERS[props.current.layer.mode].interactive.filter((id) => instance.getLayer(id));
        return layers.length ? instance.queryRenderedFeatures([point.x, point.y], { layers })[0] ?? null : null;
      };
      let frame = 0;
      instance.on("mousemove", (e) => {
        cancelAnimationFrame(frame);
        // Arrastando o mapa não há cartão: a consulta de feições fica para quando o mouse para de arrastar.
        if (e.originalEvent.buttons || instance.isMoving()) { if (hovered) hover(null); return; }
        frame = requestAnimationFrame(() => hover(hit(e.point), e.point.x, e.point.y));
      });
      instance.on("mouseout", () => { cancelAnimationFrame(frame); hover(null); });
      instance.on("click", async (e) => {
        const { onPick: pick, onSelect: select, records: list } = props.current;
        if (pick) { pick(e.lngLat.lat, e.lngLat.lng); return; }
        const feature = hit(e.point);
        if (!feature) { setCard(null); return; }
        const duration = reduceMotion() ? 0 : 500;
        const [lng, lat] = feature.geometry.type === "Point" ? feature.geometry.coordinates as [number, number] : [e.lngLat.lng, e.lngLat.lat];
        if (feature.layer.id === "elite-bubble" && feature.properties.point_count) {
          // Agrupamento: abre até onde os pontos se separam e mostra os registros dele na lista.
          const source = instance.getSource("elite-points") as GeoJSONSource;
          const clusterId = Number(feature.properties.cluster_id);
          try {
            const [zoom, leaves] = await Promise.all([source.getClusterExpansionZoom(clusterId), source.getClusterLeaves(clusterId, 1000, 0)]);
            select(leaves.flatMap((leaf) => { const r = list[Number(leaf.properties?.index)]; return r ? [r] : []; }));
            instance.easeTo({ center: [lng, lat], zoom: Math.min(zoom, 18), duration });
          } catch { /* o agrupamento mudou durante o clique: o próximo clique resolve */ }
          return;
        }
        if (feature.layer.id === "elite-bubble" || feature.layer.id === "elite-point") {
          const record = list[Number(feature.properties.index)];
          if (!record) return;
          select([record]);
          if ((record.aggregateCount ?? 1) > 1 && instance.getZoom() < 16) instance.easeTo({ center: [lng, lat], zoom: instance.getZoom() + 2, duration });
          return;
        }
        const t = target(feature);
        if (t?.kind === "hex") {
          // Hexágono: aproxima até os locais dele aparecerem separados.
          const ring = (feature.geometry as Polygon).coordinates[0].slice(0, 6);
          const center: [number, number] = [ring.reduce((n, p) => n + p[0], 0) / ring.length, ring.reduce((n, p) => n + p[1], 0) / ring.length];
          instance.easeTo({ center, zoom: Math.min(18, instance.getZoom() + 2), duration });
        } else if (t) {
          props.current.onSpot?.(t.index);
          show(cardFor(feature), e.point.x, e.point.y);
        }
      });
      instance.on("load", () => { setLoaded(true); paint(); reportViewport(); });
      instance.on("style.load", () => { styleReady.current = true; setError(""); painted = {}; hovered = null; selected = []; paint(); });
      instance.on("idle", () => {
        if (!(buildingMode.current || props.current.layer.mode === "cidade-acesa")) return;
        setCoverage(instance.getZoom() < 15 ? "Aproxime o mapa para ver os prédios disponíveis." : instance.getLayer(buildingLayer.id) && instance.queryRenderedFeatures({ layers: [buildingLayer.id] }).length ? "Volumes do provedor; alturas podem ser estimadas. Não é imagem fotográfica." : "Sem prédios 3D disponíveis nesta área ou neste nível de aproximação.");
      });
      instance.on("moveend", reportViewport);
      instance.on("error", () => setError("O mapa não carregou completamente. Os cadastros continuam disponíveis na lista."));
      observer = new ResizeObserver(() => instance.resize()); observer.observe(host.current);
    }).catch(() => setError("Não foi possível abrir o mapa neste dispositivo. Use a lista de registros."));
    return () => { cancelled = true; observer?.disconnect(); map.current?.remove(); map.current = null; sync.current = () => {}; };
  }, [retry]);

  useEffect(() => { if (loaded) sync.current(); }, [records, loaded, roleFilter, focus, layer, selectedSpot, perspective]);
  useEffect(() => {
    const url = (base !== "streets" && mapConfig?.[base]) || mapStyle(theme), key = fallback ? "fallback" : url;
    // Só troca o estilo quando ele muda de verdade (a chave do satélite chegando não recarrega as ruas).
    if (!map.current || key === styleKey.current) return;
    styleKey.current = key; styleReady.current = false;
    map.current.setStyle(fallback
      ? { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm-fallback", type: "raster", source: "osm" }] }
      : url, { diff: false });
  }, [theme, fallback, base, mapConfig]);
  const focusLat = focus?.location?.latitude, focusLng = focus?.location?.longitude, focusPrecision = focus?.location?.precision;
  useEffect(() => {
    if (focusLat != null && focusLng != null) map.current?.easeTo({ center: [focusLng, focusLat], zoom: Math.max(map.current.getZoom(), focusPrecision === "Cidade" ? 11 : 14), duration: reduceMotion() ? 0 : 500 });
  }, [focus?.key, focusLat, focusLng, focusPrecision]);
  useEffect(() => {
    // Enquadrar: só quando a pessoa pede, para não atrapalhar quem está explorando.
    if (!loaded || !map.current) return;
    const current = props.current.layer;
    const coords: number[][] = current.mode === "explorar"
      ? props.current.records.flatMap((r) => (r.location?.latitude != null && r.location.longitude != null ? [[r.location.longitude, r.location.latitude]] : []))
      : current.mode === "cobertura" ? current.hexes.features.flatMap((f) => f.geometry.coordinates[0])
        : current.mode === "cidade-acesa" ? current.data.features.flatMap((f) => f.geometry.coordinates[0])
          : current.data.features.map((f) => f.geometry.coordinates);
    if (!coords.length) return;
    const lng = coords.map((p) => p[0]), lat = coords.map((p) => p[1]);
    map.current.fitBounds([[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]], { padding: 65, maxZoom: 14, duration: reduceMotion() ? 0 : 600 });
  }, [fitToken, loaded]);
  useEffect(() => {
    // A Cidade acesa inclina e gira o mapa; os outros modos voltam para cima, a não ser com os prédios em 3D ligados.
    buildingMode.current = perspective;
    if (!loaded || !map.current) return;
    const tilt = mode === "cidade-acesa" ? { pitch: 58, bearing: -20 } : perspective ? { pitch: 50 } : { pitch: 0, bearing: 0 };
    map.current.easeTo({ ...tilt, duration: reduceMotion() ? 0 : 700 });
  }, [perspective, loaded, mode]);

  const hoverCard = card?.mode === mode ? card : null;
  return <div className="territory-canvas-wrap">
    <div className="territory-perspective">
      {(mapConfig?.satellite || mapConfig?.hybrid) && <label className="territory-map-tool">Mapa-base<select value={base} onChange={(e) => { setFallback(false); setBase(e.target.value as typeof base); }}><option value="streets">Ruas</option>{mapConfig?.satellite && <option value="satellite">Satélite</option>}{mapConfig?.hybrid && <option value="hybrid">Híbrido</option>}</select></label>}
      {mode === "explorar" && <Button variant="outline" size="sm" className="territory-map-tool" disabled={!loaded} aria-pressed={perspective} title="Volumes de prédios conforme a cobertura do provedor. Alturas podem ser estimadas." onClick={() => setPerspective((v) => !v)}>{perspective ? "Voltar para 2D" : "Prédios em 3D"}</Button>}
      {(perspective && mode === "explorar") || mode === "cidade-acesa" ? <p className="territory-map-tool max-w-60 text-xs">{coverage || "Carregando prédios disponíveis…"}</p> : null}
    </div>
    {fallback && <p className="territory-fallback-notice">Cartografia alternativa clara · aparência dos painéis preservada</p>}
    <div ref={host} className="territory-canvas" aria-label="Mapa geográfico navegável. Use a lista de registros para percorrer os mesmos dados pelo teclado." />
    {hoverCard && <div className="territory-hover-card" style={{ left: hoverCard.left, top: hoverCard.top }} aria-hidden="true"><p className="font-semibold">{hoverCard.title}</p>{hoverCard.lines.map((line) => <p key={line} className="text-xs text-subtle">{line}</p>)}</div>}
    {!loaded && !error && <p className="territory-map-message" role="status">Carregando cartografia…</p>}
    {error && <div className="territory-map-message" role="alert">{error}<Button variant="outline" onClick={() => { setError(""); setLoaded(false); setFallback(false); setRetry((v) => v + 1); }}>Carregar mapa novamente</Button><Button variant="outline" onClick={() => { setError(""); setFallback((v) => !v); }}>{fallback ? "Voltar ao estilo escolhido" : "Usar ruas padrão"}</Button></div>}
  </div>;
}
