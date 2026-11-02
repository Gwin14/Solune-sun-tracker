/**
 * Hand-written sky content in Brazilian Portuguese: constellation names, the stars
 * people actually look for, deep-sky highlights and asterisms.
 */

export const CONSTELLATION_NAMES: Record<string, string> = {
  And: 'Andrômeda', Ant: 'Máquina Pneumática', Aps: 'Ave do Paraíso', Aql: 'Águia', Aqr: 'Aquário',
  Ara: 'Altar', Ari: 'Áries', Aur: 'Cocheiro', Boo: 'Boieiro', CMa: 'Cão Maior', CMi: 'Cão Menor',
  CVn: 'Cães de Caça', Cae: 'Cinzel', Cam: 'Girafa', Cap: 'Capricórnio', Car: 'Quilha', Cas: 'Cassiopeia',
  Cen: 'Centauro', Cep: 'Cefeu', Cet: 'Baleia', Cha: 'Camaleão', Cir: 'Compasso', Cnc: 'Câncer',
  Col: 'Pomba', Com: 'Cabeleira de Berenice', CrA: 'Coroa Austral', CrB: 'Coroa Boreal', Crt: 'Taça',
  Cru: 'Cruzeiro do Sul', Crv: 'Corvo', Cyg: 'Cisne', Del: 'Golfinho', Dor: 'Dourado', Dra: 'Dragão',
  Equ: 'Cavalo Menor', Eri: 'Erídano', For: 'Fornalha', Gem: 'Gêmeos', Gru: 'Grou', Her: 'Hércules',
  Hor: 'Relógio', Hya: 'Hidra', Hyi: 'Hidra Macho', Ind: 'Índio', LMi: 'Leão Menor', Lac: 'Lagarto',
  Leo: 'Leão', Lep: 'Lebre', Lib: 'Libra', Lup: 'Lobo', Lyn: 'Lince', Lyr: 'Lira', Men: 'Mesa',
  Mic: 'Microscópio', Mon: 'Unicórnio', Mus: 'Mosca', Nor: 'Esquadro', Oct: 'Oitante', Oph: 'Serpentário',
  Ori: 'Órion', Pav: 'Pavão', Peg: 'Pégaso', Per: 'Perseu', Phe: 'Fênix', Pic: 'Pintor',
  PsA: 'Peixe Austral', Psc: 'Peixes', Pup: 'Popa', Pyx: 'Bússola', Ret: 'Retículo', Scl: 'Escultor',
  Sco: 'Escorpião', Sct: 'Escudo', Ser: 'Serpente', Sex: 'Sextante', Sge: 'Flecha', Sgr: 'Sagitário',
  Tau: 'Touro', Tel: 'Telescópio', TrA: 'Triângulo Austral', Tri: 'Triângulo', Tuc: 'Tucano',
  UMa: 'Ursa Maior', UMi: 'Ursa Menor', Vel: 'Vela', Vir: 'Virgem', Vol: 'Peixe Voador', Vul: 'Raposa',
};

/** Short notes for the constellations people ask about. */
export const CONSTELLATION_NOTES: Record<string, string> = {
  Cru: 'A menor constelação do céu e a mais famosa do hemisfério sul. Prolongue o braço maior da cruz quatro vezes e meia para achar o polo sul celeste.',
  Ori: 'O caçador. O cinturão são as Três Marias; abaixo delas, a olho nu, brilha a Nebulosa de Órion.',
  Sco: 'Uma das poucas constelações que parecem mesmo o que representam. A cauda aponta para o centro da Via Láctea.',
  Sgr: 'O núcleo da nossa galáxia fica nesta direção, logo acima do "bico do bule" formado pelas estrelas mais brilhantes.',
  Cen: 'Abriga Alfa Centauri, o sistema estelar mais próximo do Sol, e Ômega Centauri, o maior aglomerado globular da galáxia.',
  Car: 'A quilha do antigo navio Argo. Tem Canopus, a segunda estrela mais brilhante do céu, e a Nebulosa de Carina.',
  UMa: 'As sete estrelas mais brilhantes formam o Grande Carro, que aponta para a Estrela Polar.',
  Tau: 'O olho vermelho é Aldebarã. No ombro do touro ficam as Plêiades, o Sete-Estrelo.',
  Leo: 'Régulo marca o coração do leão. Em novembro, as Leônidas parecem sair daqui.',
  Gem: 'Castor e Pólux, os gêmeos. Em dezembro, as Geminídeas irradiam desta região.',
  Cyg: 'O cisne voa ao longo da Via Láctea; a cauda é Deneb, uma das estrelas mais luminosas que se conhece.',
  Oct: 'Uma constelação apagada que guarda o polo sul celeste, perto de Sigma do Oitante.',
  UMi: 'A ponta da cauda é a Estrela Polar, que marca o polo norte celeste.',
};

export type StarInfo = {
  name: string;
  /** Distance in light years. */
  ly?: number;
  note?: string;
  /** The state it represents on the Brazilian flag. */
  flag?: string;
};

/** Portuguese names and notes by Hipparcos number. */
export const STAR_INFO: Record<number, StarInfo> = {
  32349: { name: 'Sírius', ly: 8.6, note: 'A estrela mais brilhante do céu noturno, no Cão Maior.', flag: 'Mato Grosso' },
  30438: { name: 'Canopus', ly: 310, note: 'A segunda mais brilhante do céu. Sondas espaciais a usam como referência de navegação.', flag: 'Goiás' },
  69673: { name: 'Arcturus', ly: 37, note: 'Uma gigante laranja, a mais brilhante do céu do norte.' },
  71683: { name: 'Alfa Centauri', ly: 4.37, note: 'O sistema estelar mais próximo do Sol. A olho nu, as duas estrelas parecem uma só.' },
  71681: { name: 'Toliman', ly: 4.37, note: 'A companheira de Alfa Centauri.' },
  91262: { name: 'Vega', ly: 25, note: 'Daqui a uns 12 mil anos ela será a estrela polar do norte.' },
  24608: { name: 'Capela', ly: 43, note: 'Na verdade, quatro estrelas: dois pares de gigantes amarelas.' },
  24436: { name: 'Rigel', ly: 860, note: 'Supergigante azul no pé de Órion, dezenas de milhares de vezes mais luminosa que o Sol.' },
  37279: { name: 'Prócion', ly: 11.5, note: 'A estrela do Cão Menor, uma das mais próximas visíveis a olho nu.', flag: 'Amazonas' },
  7588: { name: 'Achernar', ly: 139, note: 'Gira tão rápido que é achatada nos polos. Marca o fim do rio Erídano.' },
  27989: { name: 'Betelgeuse', ly: 550, note: 'Supergigante vermelha no ombro de Órion. Um dia vai explodir como supernova.' },
  68702: { name: 'Hadar', ly: 390, note: 'Com Alfa Centauri, forma os "Ponteiros" que apontam para o Cruzeiro do Sul.' },
  97649: { name: 'Altair', ly: 16.7, note: 'A estrela da Águia, uma das três do Triângulo de Verão do norte.' },
  60718: { name: 'Acrux', ly: 320, note: 'O pé do Cruzeiro do Sul, chamada no Brasil de Estrela de Magalhães.', flag: 'São Paulo' },
  21421: { name: 'Aldebarã', ly: 65, note: 'O olho vermelho do Touro, ao lado do aglomerado das Híades.' },
  65474: { name: 'Espiga', ly: 250, note: 'A estrela da Virgem. É a única estrela acima da faixa "Ordem e Progresso".', flag: 'Pará' },
  80763: { name: 'Antares', ly: 550, note: 'O coração vermelho do Escorpião. O nome significa "rival de Marte".', flag: 'Piauí' },
  37826: { name: 'Pólux', ly: 34, note: 'A mais brilhante dos Gêmeos, uma gigante laranja com um planeta.' },
  113368: { name: 'Fomalhaut', ly: 25, note: 'A boca do Peixe Austral, cercada por um disco de poeira.' },
  102098: { name: 'Deneb', ly: 2600, note: 'Uma das estrelas mais luminosas conhecidas, na cauda do Cisne.' },
  62434: { name: 'Mimosa', ly: 280, note: 'O braço esquerdo do Cruzeiro do Sul, uma estrela azul.', flag: 'Rio de Janeiro' },
  49669: { name: 'Régulo', ly: 79, note: 'O coração do Leão, quase em cima da eclíptica.' },
  33579: { name: 'Adhara', ly: 430 },
  36850: { name: 'Castor', ly: 51, note: 'Parece uma estrela, mas é um sistema de seis.' },
  61084: { name: 'Gacrux', ly: 88, note: 'O topo do Cruzeiro do Sul, chamada no Brasil de Rubídea pela cor avermelhada.', flag: 'Bahia' },
  59747: { name: 'Pálida', ly: 345, note: 'O braço direito do Cruzeiro do Sul (δ Crucis).', flag: 'Minas Gerais' },
  60260: { name: 'Intrometida', ly: 230, note: 'A quinta estrela do Cruzeiro do Sul (ε Crucis), fora do desenho da cruz.', flag: 'Espírito Santo' },
  85927: { name: 'Shaula', ly: 570, note: 'O ferrão do Escorpião.' },
  25336: { name: 'Bellatrix', ly: 250, note: 'O outro ombro de Órion.' },
  25428: { name: 'Elnath', ly: 130 },
  45238: { name: 'Miaplacidus', ly: 113 },
  26311: { name: 'Alnilam', ly: 2000, note: 'A Maria do meio.' },
  26727: { name: 'Alnitak', ly: 1260, note: 'Uma das Três Marias, ao lado da Nebulosa Cabeça de Cavalo.' },
  25930: { name: 'Mintaka', ly: 1200, note: 'Uma das Três Marias, quase exatamente sobre o equador celeste.' },
  109268: { name: 'Alnair', ly: 101 },
  62956: { name: 'Alioth', ly: 81 },
  90185: { name: 'Kaus Australis', ly: 143 },
  15863: { name: 'Mirfak', ly: 510 },
  54061: { name: 'Dubhe', ly: 123, note: 'Com Merak, aponta para a Estrela Polar.' },
  34444: { name: 'Wezen', ly: 1600 },
  67301: { name: 'Alkaid', ly: 104 },
  41037: { name: 'Avior', ly: 630 },
  86228: { name: 'Sargas', ly: 300 },
  28360: { name: 'Menkalinan', ly: 82 },
  82273: { name: 'Atria', ly: 390 },
  31681: { name: 'Alhena', ly: 109 },
  42913: { name: 'Alsephina', ly: 80 },
  100751: { name: 'Pavão', ly: 180 },
  11767: { name: 'Estrela Polar', ly: 430, note: 'Marca o polo norte celeste: todo o céu do norte gira em volta dela.' },
  104382: { name: 'Sigma do Oitante', ly: 294, note: 'A estrela visível mais perto do polo sul celeste, bem apagada.', flag: 'Distrito Federal' },
  30324: { name: 'Mirzam', ly: 500 },
  46390: { name: 'Alphard', ly: 180, note: '"A solitária": a única estrela brilhante da Hidra.' },
  50583: { name: 'Algieba', ly: 130 },
  9884: { name: 'Hamal', ly: 66 },
  3419: { name: 'Diphda', ly: 96 },
  92855: { name: 'Nunki', ly: 228 },
  68933: { name: 'Menkent', ly: 59 },
  677: { name: 'Alpheratz', ly: 97 },
  72607: { name: 'Kochab', ly: 131 },
  5447: { name: 'Mirach', ly: 197 },
  27366: { name: 'Saiph', ly: 650 },
  86032: { name: 'Rasalhague', ly: 49 },
  14576: { name: 'Algol', ly: 90, note: 'A "estrela do demônio": a cada 2,9 dias ela escurece por algumas horas, eclipsada pela companheira.' },
  57632: { name: 'Denebola', ly: 36 },
  65378: { name: 'Mizar', ly: 83, note: 'Olhe com atenção: ao lado dela fica Alcor, um teste de vista clássico.' },
  53910: { name: 'Merak', ly: 79 },
  58001: { name: 'Phecda', ly: 84 },
  113963: { name: 'Markab', ly: 133 },
  113881: { name: 'Scheat', ly: 196 },
  107315: { name: 'Enif', ly: 690 },
  45556: { name: 'Aspidiske', ly: 690 },
  44816: { name: 'Suhail', ly: 545 },
};

export type DsoKind = 'galaxy' | 'nebula' | 'open' | 'globular' | 'dark' | 'cloud';

export const DSO_KIND_LABEL: Record<DsoKind, string> = {
  galaxy: 'Galáxia',
  nebula: 'Nebulosa',
  open: 'Aglomerado aberto',
  globular: 'Aglomerado globular',
  dark: 'Nebulosa escura',
  cloud: 'Galáxia anã',
};

export type Dso = {
  id: string;
  name: string;
  kind: DsoKind;
  /** J2000 degrees. */
  ra: number;
  dec: number;
  mag: number;
  /** Apparent size in degrees. */
  size: number;
  ly: number;
  note: string;
};

export const DSOS: Dso[] = [
  { id: 'lmc', name: 'Grande Nuvem de Magalhães', kind: 'cloud', ra: 80.89, dec: -69.76, mag: 0.9, size: 9, ly: 160_000, note: 'Uma galáxia satélite da Via Láctea. Num céu escuro parece um pedaço solto da Via Láctea.' },
  { id: 'smc', name: 'Pequena Nuvem de Magalhães', kind: 'cloud', ra: 13.16, dec: -72.8, mag: 2.7, size: 5, ly: 200_000, note: 'A irmã menor da Grande Nuvem, ao lado do aglomerado 47 Tucanae.' },
  { id: 'm42', name: 'Nebulosa de Órion', kind: 'nebula', ra: 83.82, dec: -5.39, mag: 4, size: 1.1, ly: 1_350, note: 'Um berçário de estrelas visível a olho nu, logo abaixo das Três Marias (ou acima, vista do Brasil).' },
  { id: 'm45', name: 'Plêiades', kind: 'open', ra: 56.75, dec: 24.12, mag: 1.6, size: 1.8, ly: 444, note: 'O Sete-Estrelo. Povos indígenas do Brasil usavam o nascer das Plêiades para marcar o início das chuvas e o tempo do plantio.' },
  { id: 'hyades', name: 'Híades', kind: 'open', ra: 66.75, dec: 15.87, mag: 0.5, size: 5.5, ly: 153, note: 'O aglomerado mais próximo da Terra, em forma de V, com Aldebarã na frente.' },
  { id: 'm31', name: 'Galáxia de Andrômeda', kind: 'galaxy', ra: 10.68, dec: 41.27, mag: 3.4, size: 3, ly: 2_500_000, note: 'A grande galáxia vizinha. A luz que você vê saiu de lá antes de existirem seres humanos.' },
  { id: 'omegaCen', name: 'Ômega Centauri', kind: 'globular', ra: 201.7, dec: -47.48, mag: 3.7, size: 0.6, ly: 17_000, note: 'O maior aglomerado globular da Via Láctea, com uns 10 milhões de estrelas. A olho nu parece uma estrela borrada.' },
  { id: '47tuc', name: '47 Tucanae', kind: 'globular', ra: 6.02, dec: -72.08, mag: 4.1, size: 0.5, ly: 13_000, note: 'O segundo aglomerado globular mais brilhante, colado à Pequena Nuvem de Magalhães.' },
  { id: 'carina', name: 'Nebulosa de Carina', kind: 'nebula', ra: 161.27, dec: -59.87, mag: 1, size: 2, ly: 8_500, note: 'Quatro vezes maior que a de Órion. Abriga Eta Carinae, uma estrela instável que pode explodir.' },
  { id: 'jewel', name: 'Caixinha de Joias', kind: 'open', ra: 193.4, dec: -60.33, mag: 4.2, size: 0.17, ly: 6_400, note: 'Um punhado de estrelas coloridas ao lado de Mimosa, no Cruzeiro do Sul.' },
  { id: 'coalsack', name: 'Saco de Carvão', kind: 'dark', ra: 192.5, dec: -62.8, mag: 99, size: 6, ly: 600, note: 'Uma nuvem escura de poeira ao lado do Cruzeiro. Na astronomia tupi-guarani, é a cabeça da constelação da Ema.' },
  { id: 'm7', name: 'Aglomerado de Ptolomeu', kind: 'open', ra: 268.46, dec: -34.79, mag: 3.3, size: 1.3, ly: 980, note: 'Visível a olho nu perto do ferrão do Escorpião, já descrito por Ptolomeu no ano 130.' },
  { id: 'm8', name: 'Nebulosa da Lagoa', kind: 'nebula', ra: 270.92, dec: -24.38, mag: 6, size: 1, ly: 4_100, note: 'Uma mancha clara em Sagitário, na parte mais densa da Via Láctea.' },
  { id: 'm44', name: 'Presépio', kind: 'open', ra: 130.1, dec: 19.67, mag: 3.7, size: 1.6, ly: 577, note: 'Uma nuvem de estrelas em Câncer, bonita com binóculo.' },
  { id: 'm13', name: 'Aglomerado de Hércules', kind: 'globular', ra: 250.42, dec: 36.46, mag: 5.8, size: 0.3, ly: 22_000, note: 'O aglomerado globular mais famoso do norte.' },
];

/** The galactic centre (Sagittarius A*), J2000 degrees. */
export const GALACTIC_CENTER = { ra: 266.405, dec: -28.936 };

export const GALACTIC_CENTER_NOTE =
  'O núcleo da Via Láctea, a 26 mil anos-luz, escondido atrás de nuvens de poeira. É a parte mais brilhante e larga da faixa: o alvo clássico das fotos de céu noturno. No Brasil, fica alto de madrugada entre março e outubro.';

export type Asterism = { id: string; name: string; note: string; members: number[]; lines: [number, number][] };

export const ASTERISMS: Asterism[] = [
  {
    id: 'tresMarias',
    name: 'Três Marias',
    note: 'O cinturão de Órion: três estrelas alinhadas que são fáceis de achar em qualquer noite de verão no Brasil.',
    members: [26727, 26311, 25930],
    lines: [[26727, 26311], [26311, 25930]],
  },
  {
    id: 'falsoCruzeiro',
    name: 'Falso Cruzeiro',
    note: 'Maior e mais apagado que o Cruzeiro do Sul, e sem a quinta estrela. Confunde muita gente: o verdadeiro fica a leste dele.',
    members: [41037, 45556, 42913, 45941],
    lines: [[41037, 45941], [42913, 45556]],
  },
  {
    id: 'ponteiros',
    name: 'Ponteiros',
    note: 'Alfa Centauri e Hadar apontam para o Cruzeiro do Sul. É assim que se distingue o Cruzeiro verdadeiro do falso.',
    members: [71683, 68702],
    lines: [[71683, 68702]],
  },
];

export const PLANET_NOTES: Record<string, string> = {
  Mercury: 'O planeta mais rápido e mais difícil de ver: nunca se afasta muito do Sol, então aparece baixo logo após o pôr ou antes do nascer.',
  Venus: 'O objeto mais brilhante do céu depois do Sol e da Lua: a Estrela d’Alva de manhã ou a Estrela Vésper à tarde.',
  Mars: 'O planeta vermelho. Seu brilho muda muito conforme a distância até a Terra.',
  Jupiter: 'O maior planeta. Com um binóculo firme dá para ver até quatro luas, as galileanas, em fila.',
  Saturn: 'Os anéis aparecem em qualquer telescópio pequeno. A olho nu, um ponto amarelado e firme, que não cintila.',
  Uranus: 'No limite da visão a olho nu, em céu muito escuro. Com binóculo, um pontinho verde-azulado.',
  Neptune: 'Só com binóculo ou telescópio. A luz do Sol leva mais de quatro horas para chegar lá.',
};
