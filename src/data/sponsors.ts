/** Marcas de ejemplo por país de origen del piloto. tier 3 = fuerte (paga más y exige más), 1 = local. Edita libremente. */
export interface Brand { name: string; tier: 1 | 2 | 3; }
export const SPONSORS: Record<string, Brand[]> = {
  'México': [{ name: 'Telcel', tier: 3 }, { name: 'Cemex', tier: 3 }, { name: 'Banorte', tier: 2 }, { name: 'Corona', tier: 2 }, { name: 'Bimbo', tier: 2 }, { name: 'Elektra', tier: 1 }],
  'España': [{ name: 'Santander', tier: 3 }, { name: 'Movistar', tier: 3 }, { name: 'Repsol', tier: 2 }, { name: 'Iberia', tier: 2 }, { name: 'Mapfre', tier: 2 }, { name: 'Mahou', tier: 1 }],
  'Argentina': [{ name: 'YPF', tier: 3 }, { name: 'Mercado Libre', tier: 3 }, { name: 'Banco Galicia', tier: 2 }, { name: 'Telecom Argentina', tier: 2 }, { name: 'Quilmes', tier: 1 }],
  'Brasil': [{ name: 'Petrobras', tier: 3 }, { name: 'Itaú', tier: 3 }, { name: 'Ambev', tier: 2 }, { name: 'Vivo', tier: 2 }, { name: 'Natura', tier: 1 }],
  'Reino Unido': [{ name: 'Barclays', tier: 3 }, { name: 'BP', tier: 3 }, { name: 'Tesco', tier: 2 }, { name: 'Lloyds Bank', tier: 2 }, { name: 'Greene King', tier: 1 }],
  'Francia': [{ name: 'TotalEnergies', tier: 3 }, { name: 'BNP Paribas', tier: 3 }, { name: 'Orange', tier: 2 }, { name: 'Carrefour', tier: 1 }],
  'Italia': [{ name: 'Eni', tier: 3 }, { name: 'Intesa Sanpaolo', tier: 3 }, { name: 'Enel', tier: 2 }, { name: 'Ferrero', tier: 2 }, { name: 'Barilla', tier: 1 }],
  'Alemania': [{ name: 'Allianz', tier: 3 }, { name: 'Deutsche Telekom', tier: 3 }, { name: 'Bosch', tier: 2 }, { name: 'Adidas', tier: 2 }, { name: 'Bitburger', tier: 1 }],
  'Países Bajos': [{ name: 'Shell', tier: 3 }, { name: 'ING', tier: 3 }, { name: 'Heineken', tier: 2 }, { name: 'KLM', tier: 2 }],
  'Japón': [{ name: 'Toyota', tier: 3 }, { name: 'Sony', tier: 3 }, { name: 'Rakuten', tier: 2 }, { name: 'Asics', tier: 1 }],
  'Australia': [{ name: 'Qantas', tier: 3 }, { name: 'Commonwealth Bank', tier: 3 }, { name: 'Woolworths', tier: 2 }],
  'Canadá': [{ name: 'Royal Bank of Canada', tier: 3 }, { name: 'Bell', tier: 2 }, { name: 'Tim Hortons', tier: 1 }],
  'Estados Unidos': [{ name: 'Chevron', tier: 3 }, { name: 'Verizon', tier: 3 }, { name: 'Coca-Cola', tier: 3 }, { name: 'Fanatics', tier: 1 }],
};
export const GLOBAL_BRANDS: Brand[] = [{ name: 'Red Bull', tier: 3 }, { name: 'Monster Energy', tier: 3 }, { name: 'Rolex', tier: 3 }, { name: 'Puma', tier: 2 }, { name: 'Pirelli', tier: 2 }, { name: 'Oakley', tier: 1 }];

/** Marcas que compiten entre sí: no aceptan compartir patrocinio con otra del mismo grupo. */
export const RIVAL_GROUPS: string[][] = [
  ['Telcel', 'Movistar', 'Orange', 'Vivo', 'Telecom Argentina', 'Deutsche Telekom', 'Verizon', 'Bell', 'Lumina Telecom'],
  ['Santander', 'Banorte', 'Banco Galicia', 'Itaú', 'Barclays', 'Lloyds Bank', 'BNP Paribas', 'Intesa Sanpaolo', 'ING', 'Commonwealth Bank', 'Royal Bank of Canada', 'Atlas Bank'],
  ['Repsol', 'YPF', 'Petrobras', 'BP', 'TotalEnergies', 'Eni', 'Shell', 'Chevron', 'Vertex Energy', 'Nova Fuels'],
  ['Corona', 'Mahou', 'Quilmes', 'Ambev', 'Greene King', 'Bitburger', 'Heineken'],
  ['Coca-Cola', 'Red Bull', 'Monster Energy', 'Polar Drinks'],
  ['Iberia', 'KLM', 'Qantas', 'Zenith Air'],
  ['Adidas', 'Puma', 'Asics'],
  ['Rolex', 'Kiro Watches'],
  ['Bimbo', 'Ferrero', 'Barilla'],
  ['Tesco', 'Carrefour', 'Woolworths', 'Elektra'],
  ['Allianz', 'Mapfre'],
];
/** Si `name` choca con alguna de las marcas de `current`, devuelve la marca rival; si no, null. */
export const clash = (name: string, current: string[]): string | null =>
  current.find((o) => o !== name && RIVAL_GROUPS.some((g) => g.includes(name) && g.includes(o))) ?? null;
