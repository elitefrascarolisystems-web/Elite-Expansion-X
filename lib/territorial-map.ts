export type CityLocationInput = {
  id: number;
  name: string;
  state: string;
};

export type CityReference = {
  latitude: number;
  longitude: number;
  municipalityCode: string;
  sourceLabel: string;
  sourceUrl: string;
};

export type TerritorialPoint = CityLocationInput & CityReference & {
  x: number;
  y: number;
};

const IBGE_SOURCE = "IBGE — Malhas Geográficas e sede municipal";
const IBGE_SOURCE_URL = "https://servicodados.ibge.gov.br/api/docs/";

const CITY_REFERENCES: Record<string, CityReference> = {
  "belo horizonte|mg": {
    latitude: -19.9167,
    longitude: -43.9345,
    municipalityCode: "3106200",
    sourceLabel: IBGE_SOURCE,
    sourceUrl: IBGE_SOURCE_URL,
  },
  "betim|mg": {
    latitude: -19.9678,
    longitude: -44.1983,
    municipalityCode: "3106705",
    sourceLabel: IBGE_SOURCE,
    sourceUrl: IBGE_SOURCE_URL,
  },
  "contagem|mg": {
    latitude: -19.9317,
    longitude: -44.0536,
    municipalityCode: "3118601",
    sourceLabel: IBGE_SOURCE,
    sourceUrl: IBGE_SOURCE_URL,
  },
  "esmeraldas|mg": {
    latitude: -19.7628,
    longitude: -44.3131,
    municipalityCode: "3124104",
    sourceLabel: IBGE_SOURCE,
    sourceUrl: IBGE_SOURCE_URL,
  },
};

export function normalizeLocationName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function cityReference(name: string, state: string) {
  return CITY_REFERENCES[`${normalizeLocationName(name)}|${state.trim().toLowerCase()}`] ?? null;
}

export function buildTerritorialPoints(cities: CityLocationInput[]) {
  const located = cities.flatMap((city) => {
    const reference = cityReference(city.name, city.state);
    return reference ? [{ ...city, ...reference }] : [];
  });

  if (!located.length) return [] as TerritorialPoint[];

  const latitudes = located.map((city) => city.latitude);
  const longitudes = located.map((city) => city.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = Math.max(maxLatitude - minLatitude, 0.08);
  const longitudeRange = Math.max(maxLongitude - minLongitude, 0.08);

  return located.map((city) => ({
    ...city,
    x: 12 + ((city.longitude - minLongitude) / longitudeRange) * 76,
    y: 12 + ((maxLatitude - city.latitude) / latitudeRange) * 76,
  }));
}

