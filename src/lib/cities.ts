export type City = { name: string; region: string; latitude: number; longitude: number; tz: string };

/** Offline city catalogue: instant search results and a time-zone source for geocoded places. */
export const CITIES: City[] = [
  { name: 'São Paulo', region: 'SP, Brasil', latitude: -23.5505, longitude: -46.6333, tz: 'America/Sao_Paulo' },
  { name: 'Rio de Janeiro', region: 'RJ, Brasil', latitude: -22.9068, longitude: -43.1729, tz: 'America/Sao_Paulo' },
  { name: 'Belo Horizonte', region: 'MG, Brasil', latitude: -19.9167, longitude: -43.9345, tz: 'America/Sao_Paulo' },
  { name: 'Brasília', region: 'DF, Brasil', latitude: -15.7939, longitude: -47.8828, tz: 'America/Sao_Paulo' },
  { name: 'Salvador', region: 'BA, Brasil', latitude: -12.9777, longitude: -38.5016, tz: 'America/Bahia' },
  { name: 'Fortaleza', region: 'CE, Brasil', latitude: -3.7319, longitude: -38.5267, tz: 'America/Fortaleza' },
  { name: 'Recife', region: 'PE, Brasil', latitude: -8.0476, longitude: -34.877, tz: 'America/Recife' },
  { name: 'Natal', region: 'RN, Brasil', latitude: -5.7945, longitude: -35.211, tz: 'America/Fortaleza' },
  { name: 'João Pessoa', region: 'PB, Brasil', latitude: -7.1195, longitude: -34.845, tz: 'America/Fortaleza' },
  { name: 'Maceió', region: 'AL, Brasil', latitude: -9.6658, longitude: -35.735, tz: 'America/Maceio' },
  { name: 'Aracaju', region: 'SE, Brasil', latitude: -10.9472, longitude: -37.0731, tz: 'America/Maceio' },
  { name: 'Teresina', region: 'PI, Brasil', latitude: -5.0919, longitude: -42.8034, tz: 'America/Fortaleza' },
  { name: 'São Luís', region: 'MA, Brasil', latitude: -2.5307, longitude: -44.3068, tz: 'America/Fortaleza' },
  { name: 'Belém', region: 'PA, Brasil', latitude: -1.4558, longitude: -48.4902, tz: 'America/Belem' },
  { name: 'Manaus', region: 'AM, Brasil', latitude: -3.119, longitude: -60.0217, tz: 'America/Manaus' },
  { name: 'Porto Velho', region: 'RO, Brasil', latitude: -8.7612, longitude: -63.9004, tz: 'America/Porto_Velho' },
  { name: 'Rio Branco', region: 'AC, Brasil', latitude: -9.9754, longitude: -67.8249, tz: 'America/Rio_Branco' },
  { name: 'Boa Vista', region: 'RR, Brasil', latitude: 2.8235, longitude: -60.6758, tz: 'America/Boa_Vista' },
  { name: 'Macapá', region: 'AP, Brasil', latitude: 0.0349, longitude: -51.0694, tz: 'America/Belem' },
  { name: 'Palmas', region: 'TO, Brasil', latitude: -10.2491, longitude: -48.3243, tz: 'America/Araguaina' },
  { name: 'Goiânia', region: 'GO, Brasil', latitude: -16.6869, longitude: -49.2648, tz: 'America/Sao_Paulo' },
  { name: 'Cuiabá', region: 'MT, Brasil', latitude: -15.601, longitude: -56.0974, tz: 'America/Cuiaba' },
  { name: 'Campo Grande', region: 'MS, Brasil', latitude: -20.4697, longitude: -54.6201, tz: 'America/Campo_Grande' },
  { name: 'Curitiba', region: 'PR, Brasil', latitude: -25.4284, longitude: -49.2733, tz: 'America/Sao_Paulo' },
  { name: 'Florianópolis', region: 'SC, Brasil', latitude: -27.5954, longitude: -48.548, tz: 'America/Sao_Paulo' },
  { name: 'Porto Alegre', region: 'RS, Brasil', latitude: -30.0346, longitude: -51.2177, tz: 'America/Sao_Paulo' },
  { name: 'Vitória', region: 'ES, Brasil', latitude: -20.3155, longitude: -40.3128, tz: 'America/Sao_Paulo' },
  { name: 'Fernando de Noronha', region: 'PE, Brasil', latitude: -3.8547, longitude: -32.4247, tz: 'America/Noronha' },
  { name: 'Campinas', region: 'SP, Brasil', latitude: -22.9099, longitude: -47.0626, tz: 'America/Sao_Paulo' },
  { name: 'Lisboa', region: 'Portugal', latitude: 38.7223, longitude: -9.1393, tz: 'Europe/Lisbon' },
  { name: 'Porto', region: 'Portugal', latitude: 41.1579, longitude: -8.6291, tz: 'Europe/Lisbon' },
  { name: 'Madri', region: 'Espanha', latitude: 40.4168, longitude: -3.7038, tz: 'Europe/Madrid' },
  { name: 'Barcelona', region: 'Espanha', latitude: 41.3874, longitude: 2.1686, tz: 'Europe/Madrid' },
  { name: 'Paris', region: 'França', latitude: 48.8566, longitude: 2.3522, tz: 'Europe/Paris' },
  { name: 'Londres', region: 'Reino Unido', latitude: 51.5072, longitude: -0.1276, tz: 'Europe/London' },
  { name: 'Roma', region: 'Itália', latitude: 41.9028, longitude: 12.4964, tz: 'Europe/Rome' },
  { name: 'Berlim', region: 'Alemanha', latitude: 52.52, longitude: 13.405, tz: 'Europe/Berlin' },
  { name: 'Amsterdã', region: 'Países Baixos', latitude: 52.3676, longitude: 4.9041, tz: 'Europe/Amsterdam' },
  { name: 'Reykjavík', region: 'Islândia', latitude: 64.1466, longitude: -21.9426, tz: 'Atlantic/Reykjavik' },
  { name: 'Tromsø', region: 'Noruega', latitude: 69.6492, longitude: 18.9553, tz: 'Europe/Oslo' },
  { name: 'Atenas', region: 'Grécia', latitude: 37.9838, longitude: 23.7275, tz: 'Europe/Athens' },
  { name: 'Istambul', region: 'Turquia', latitude: 41.0082, longitude: 28.9784, tz: 'Europe/Istanbul' },
  { name: 'Cairo', region: 'Egito', latitude: 30.0444, longitude: 31.2357, tz: 'Africa/Cairo' },
  { name: 'Marrakech', region: 'Marrocos', latitude: 31.6295, longitude: -7.9811, tz: 'Africa/Casablanca' },
  { name: 'Cidade do Cabo', region: 'África do Sul', latitude: -33.9249, longitude: 18.4241, tz: 'Africa/Johannesburg' },
  { name: 'Luanda', region: 'Angola', latitude: -8.839, longitude: 13.2894, tz: 'Africa/Luanda' },
  { name: 'Maputo', region: 'Moçambique', latitude: -25.9692, longitude: 32.5732, tz: 'Africa/Maputo' },
  { name: 'Dubai', region: 'Emirados Árabes', latitude: 25.2048, longitude: 55.2708, tz: 'Asia/Dubai' },
  { name: 'Nova Délhi', region: 'Índia', latitude: 28.6139, longitude: 77.209, tz: 'Asia/Kolkata' },
  { name: 'Bangkok', region: 'Tailândia', latitude: 13.7563, longitude: 100.5018, tz: 'Asia/Bangkok' },
  { name: 'Singapura', region: 'Singapura', latitude: 1.3521, longitude: 103.8198, tz: 'Asia/Singapore' },
  { name: 'Tóquio', region: 'Japão', latitude: 35.6762, longitude: 139.6503, tz: 'Asia/Tokyo' },
  { name: 'Seul', region: 'Coreia do Sul', latitude: 37.5665, longitude: 126.978, tz: 'Asia/Seoul' },
  { name: 'Pequim', region: 'China', latitude: 39.9042, longitude: 116.4074, tz: 'Asia/Shanghai' },
  { name: 'Sydney', region: 'Austrália', latitude: -33.8688, longitude: 151.2093, tz: 'Australia/Sydney' },
  { name: 'Auckland', region: 'Nova Zelândia', latitude: -36.8485, longitude: 174.7633, tz: 'Pacific/Auckland' },
  { name: 'Honolulu', region: 'Havaí, EUA', latitude: 21.3069, longitude: -157.8583, tz: 'Pacific/Honolulu' },
  { name: 'Los Angeles', region: 'Califórnia, EUA', latitude: 34.0522, longitude: -118.2437, tz: 'America/Los_Angeles' },
  { name: 'São Francisco', region: 'Califórnia, EUA', latitude: 37.7749, longitude: -122.4194, tz: 'America/Los_Angeles' },
  { name: 'Nova York', region: 'NY, EUA', latitude: 40.7128, longitude: -74.006, tz: 'America/New_York' },
  { name: 'Miami', region: 'Flórida, EUA', latitude: 25.7617, longitude: -80.1918, tz: 'America/New_York' },
  { name: 'Chicago', region: 'Illinois, EUA', latitude: 41.8781, longitude: -87.6298, tz: 'America/Chicago' },
  { name: 'Toronto', region: 'Canadá', latitude: 43.6532, longitude: -79.3832, tz: 'America/Toronto' },
  { name: 'Cidade do México', region: 'México', latitude: 19.4326, longitude: -99.1332, tz: 'America/Mexico_City' },
  { name: 'Buenos Aires', region: 'Argentina', latitude: -34.6037, longitude: -58.3816, tz: 'America/Argentina/Buenos_Aires' },
  { name: 'Ushuaia', region: 'Argentina', latitude: -54.8019, longitude: -68.303, tz: 'America/Argentina/Ushuaia' },
  { name: 'Santiago', region: 'Chile', latitude: -33.4489, longitude: -70.6693, tz: 'America/Santiago' },
  { name: 'Atacama', region: 'Chile', latitude: -22.9087, longitude: -68.1997, tz: 'America/Santiago' },
  { name: 'Lima', region: 'Peru', latitude: -12.0464, longitude: -77.0428, tz: 'America/Lima' },
  { name: 'Bogotá', region: 'Colômbia', latitude: 4.711, longitude: -74.0721, tz: 'America/Bogota' },
  { name: 'Montevidéu', region: 'Uruguai', latitude: -34.9011, longitude: -56.1645, tz: 'America/Montevideo' },
];

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function searchCities(query: string): City[] {
  const q = strip(query.trim());
  if (!q) return [];
  return CITIES.filter((c) => strip(`${c.name} ${c.region}`).includes(q)).slice(0, 12);
}

/** Nearest catalogued city's time zone — a good guess for geocoded places. */
export function nearestTimeZone(latitude: number, longitude: number): string {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = (c.latitude - latitude) ** 2 + ((c.longitude - longitude) * Math.cos((latitude * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.tz;
}
