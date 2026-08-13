import { GOOGLE_CITY_MAP, TSC_CITIES } from './googleCityMap';

function normalizeCity(name: string): string {
  const lower = name.toLowerCase().trim();
  const found = TSC_CITIES.find(c => c.toLowerCase() === lower);
  return found || name.trim();
}

export function getMappedCity(
  googleCityName: string,
  customMapping: Record<string, string> | null = null
): string {
  if (!googleCityName) return 'Rest';
  const lower = googleCityName.toLowerCase().trim();

  if (customMapping && customMapping[lower]) {
    return normalizeCity(customMapping[lower]);
  }

  if (GOOGLE_CITY_MAP[lower]) {
    return normalizeCity(GOOGLE_CITY_MAP[lower]);
  }

  return 'Rest';
}
