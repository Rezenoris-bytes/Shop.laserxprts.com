/* eslint-disable no-console */
/**
 * Generates the demo catalogue CSVs.
 *
 * The CSVs are the committed artefact — this script exists so the ~200 rows are
 * systematic rather than hand-typed, and so the deliberate edge cases below
 * cannot be accidentally "tidied away" by a later editor.
 *
 * Run: node prisma/seed/generate-csv.js
 *
 * EVERY row produced here is demo data. Machine brand and model names are real,
 * publicly documented product names (so the compatibility structure is
 * exercised against realistic naming), but every compatibility CLAIM is
 * invented and is flagged is_seed_data=true / is_verified=false.
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, 'csv');
fs.mkdirSync(OUT, { recursive: true });

const csv = (rows) =>
  rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell === null || cell === undefined ? '' : String(cell);
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(','),
    )
    .join('\n') + '\n';

/**
 * Diameters must render with one decimal everywhere: String(1.0) is "1", which
 * would produce SKU code "001" while the compatibility CSV references "010",
 * and would display "D1" instead of "D1.0".
 */
const dp1 = (n) => Number(n).toFixed(1);
const code3 = (n) => dp1(n).replace('.', '').padStart(3, '0');

const write = (name, rows) => {
  fs.writeFileSync(path.join(OUT, name), csv(rows));
  console.log(`  ${name.padEnd(24)} ${rows.length - 1} rows`);
};

// ── 01 machines ─────────────────────────────────────────────────────────────
const machines = [['brand', 'model', 'variant', 'laser_type', 'power_watts']];
const machineTree = {
  Raytools: {
    BM110: [['1.5kW', 'FIBER', 1500], ['3kW', 'FIBER', 3000]],
    BM111: [['2kW', 'FIBER', 2000], ['4kW', 'FIBER', 4000]],
    BT240: [['3kW', 'FIBER', 3000], ['6kW', 'FIBER', 6000]],
    BM114: [['6kW', 'FIBER', 6000], ['12kW', 'FIBER', 12000]],
  },
  Precitec: {
    'ProCutter 2.0': [['4kW', 'FIBER', 4000], ['8kW', 'FIBER', 8000]],
    LightCutter: [['1kW', 'FIBER', 1000], ['2kW', 'FIBER', 2000]],
    HPSSL: [['3kW', 'FIBER', 3000]],
  },
  WSX: {
    NC30: [['3kW', 'FIBER', 3000]],
    NC60: [['6kW', 'FIBER', 6000], ['12kW', 'FIBER', 12000]],
    KC15: [['1.5kW', 'FIBER', 1500]],
  },
  Ospri: {
    LC30: [['3kW', 'FIBER', 3000]],
    LC50: [['5kW', 'FIBER', 5000]],
  },
};
for (const [brand, models] of Object.entries(machineTree)) {
  for (const [model, variants] of Object.entries(models)) {
    for (const [variant, laserType, watts] of variants) {
      machines.push([brand, model, variant, laserType, watts]);
    }
  }
}
write('01-machines.csv', machines);

// ── 02 attributes ───────────────────────────────────────────────────────────
write('02-attributes.csv', [
  ['name', 'slug', 'data_type', 'default_scope', 'unit', 'is_filterable', 'sort_order'],
  ['Head / Series', 'head-series', 'STRING', 'PRODUCT', '', 'true', 10],
  ['Nozzle Type', 'nozzle-type', 'STRING', 'PRODUCT', '', 'true', 20],
  ['Material', 'material', 'STRING', 'PRODUCT', '', 'true', 30],
  ['Coating', 'coating', 'STRING', 'PRODUCT', '', 'true', 40],
  ['Thread', 'thread', 'STRING', 'VARIANT', '', 'true', 50],
  ['Nozzle Height', 'nozzle-height', 'DECIMAL', 'VARIANT', 'mm', 'true', 60],
  ['Orifice Diameter', 'orifice-diameter', 'DECIMAL', 'VARIANT', 'mm', 'true', 70],
  ['Outer Diameter', 'outer-diameter', 'DECIMAL', 'VARIANT', 'mm', 'true', 80],
  ['Thickness', 'thickness', 'DECIMAL', 'VARIANT', 'mm', 'true', 90],
  ['Focal Length', 'focal-length', 'DECIMAL', 'VARIANT', 'mm', 'true', 100],
  ['Wavelength Range', 'wavelength-range', 'STRING', 'PRODUCT', 'nm', 'true', 110],
  ['Max Power', 'max-power', 'INTEGER', 'PRODUCT', 'W', 'true', 120],
  ['Sealing Type', 'sealing-type', 'STRING', 'PRODUCT', '', 'false', 130],
  ['Pack Contents', 'pack-contents', 'STRING', 'VARIANT', '', 'false', 140],
]);

// ── 03 categories ───────────────────────────────────────────────────────────
write('03-categories.csv', [
  ['name', 'slug', 'parent_slug', 'sort_order', 'description'],
  ['Nozzles', 'nozzles', '', 10, 'Cutting nozzles for fiber laser cutting heads, in single and double layer designs.'],
  ['Single Layer Nozzles', 'single-layer-nozzles', 'nozzles', 11, 'Single layer nozzles for thin to medium sheet cutting.'],
  ['Double Layer Nozzles', 'double-layer-nozzles', 'nozzles', 12, 'Double layer nozzles for thicker sections and oxygen cutting.'],
  ['Protective Windows', 'protective-windows', '', 20, 'Protective lenses that shield the focus optics from spatter.'],
  ['Focus Lenses', 'focus-lenses', '', 30, 'Focusing optics for fiber laser cutting heads.'],
  ['Ceramic Rings', 'ceramic-rings', '', 40, 'Ceramic holders and insulating rings for laser cutting heads.'],
  ['Consumable Kits', 'consumable-kits', '', 50, 'Pre-assembled kits of the parts most often replaced together.'],
]);

// ── 04 part brands ──────────────────────────────────────────────────────────
write('04-part-brands.csv', [
  ['name', 'slug', 'website'],
  ['Raytools', 'raytools', ''],
  ['Precitec', 'precitec', ''],
  ['WSX', 'wsx', ''],
  ['Ospri', 'ospri', ''],
  ['LEI Select', 'lei-select', ''],
]);

// ── 05 products / 06 variants ───────────────────────────────────────────────
const products = [
  [
    'product_key', 'name', 'category_slug', 'part_brand_slug', 'product_type',
    'hsn_code', 'gst_rate', 'short_description', 'description',
    'attr:head-series', 'attr:nozzle-type', 'attr:material', 'attr:coating',
    'attr:wavelength-range', 'attr:max-power', 'attr:sealing-type',
  ],
];
const variants = [
  [
    'product_key', 'sku', 'part_number', 'variant_name', 'price', 'price_type',
    'uom', 'pack_size', 'min_order_qty', 'stock_qty', 'reorder_level', 'stock_status',
    'is_default', 'position',
    'attr:thread', 'attr:nozzle-height', 'attr:orifice-diameter',
    'attr:outer-diameter', 'attr:thickness', 'attr:focal-length', 'attr:pack-contents',
  ],
];

const P = (key, row) => products.push([key, ...row]);
const V = (key, row) => variants.push([key, ...row]);

// FAMILY A — thread is part of the GROUPING KEY, so H15 and H20 are separate
// products and diameter is the only selector axis.
for (const thread of ['H15', 'H20']) {
  const key = `RT-BM110-SL-${thread}`;
  P(key, [
    `Raytools Single Layer Nozzle — ${thread}`, 'single-layer-nozzles', 'raytools', 'CONSUMABLE',
    '84669390', '18',
    `Single layer copper cutting nozzle with ${thread} thread for Raytools BM-series heads.`,
    `Precision-machined single layer nozzle for Raytools BM-series cutting heads with the ${thread} thread standard. Chrome-free electrolytic copper gives consistent beam alignment and predictable wear. Suited to nitrogen and compressed air cutting of mild steel, stainless and aluminium in thin to medium gauges.`,
    'BM110', 'Single Layer', 'Electrolytic Copper', 'None', '1064-1080', '6000', 'O-Ring',
  ]);

  // Deliberately spans 0.8 to 10.0 — a text range filter would place "10.0"
  // between "1.0" and "3.0" and return a 10mm nozzle for a 1-3mm search.
  const diameters = [
    [0.8, 790, 42], [1.0, 850, 118], [1.2, 850, 96], [1.5, 890, 14],
    [2.0, 940, 0], [2.5, 990, 31], [3.0, 1040, 27], [10.0, 1780, 0],
  ];
  diameters.forEach(([d, price, qty], index) => {
    const code = code3(d);
    const status = d === 10.0 ? 'MADE_TO_ORDER' : qty === 0 ? 'OUT_OF_STOCK' : qty <= 15 ? 'LOW_STOCK' : 'IN_STOCK';
    V(key, [
      `NZ-RT-SL-${thread}-${code}`, `D${dp1(d)} ${thread}`, `D${dp1(d)}`, price, 'FIXED',
      'PIECE', 1, 1, qty, 15, status, index === 1 ? 'true' : 'false', index * 10,
      // nozzle-height deliberately omitted: the thread designation already
      // encodes it, and emitting both would derive two correlated axes.
      thread, '', d, 28, '', '', '',
    ]);
  });
}

// FAMILY B — thread is NOT in the grouping key, so ONE product covers both
// threads and the selector has two axes. Same schema, same component.
{
  const key = 'RT-BM110-DL';
  P(key, [
    'Raytools Double Layer Nozzle', 'double-layer-nozzles', 'raytools', 'CONSUMABLE',
    '84669390', '18',
    'Double layer copper nozzle for Raytools BM-series heads, in H15 and H20 threads.',
    'Double layer nozzle for oxygen-assisted cutting of thicker mild steel on Raytools BM-series heads. The twin-orifice design stabilises the assist gas column at higher standoff, reducing dross on sections above 6 mm. Available across both thread standards and the full diameter range.',
    'BM110', 'Double Layer', 'Electrolytic Copper', 'None', '1064-1080', '6000', 'O-Ring',
  ]);

  let position = 0;
  for (const thread of ['H15', 'H20']) {
    // Asymmetric on purpose: 3.5 and 4.0 exist only for H20, so the two-axis
    // selector must handle combinations that do not exist.
    const diameters = thread === 'H15'
      ? [1.0, 1.2, 1.5, 2.0, 2.5, 3.0]
      : [1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];

    diameters.forEach((d) => {
      const code = code3(d);
      const price = 1180 + Math.round(d * 60);
      const qty = d >= 3.5 ? 6 : 40 + Math.round(d * 10);
      V(key, [
        `NZ-RT-DL-${thread}-${code}`, `D${dp1(d)} ${thread} DL`, `${thread} / D${dp1(d)}`, price, 'FIXED',
        'PIECE', 1, 1, qty, 12, qty <= 12 ? 'LOW_STOCK' : 'IN_STOCK',
        thread === 'H15' && d === 1.5 ? 'true' : 'false', position,
        thread, '', d, 28, '', '', '',
      ]);
      position += 10;
    });
  }
}

// FAMILY C — an entirely different spec vocabulary. Precitec uses nozzle
// HEIGHT in mm, not the H15/H20 thread convention. Zero code difference.
{
  const key = 'PC-PROCUTTER-SL';
  P(key, [
    'Precitec ProCutter Single Layer Nozzle', 'single-layer-nozzles', 'precitec', 'CONSUMABLE',
    '84669390', '18',
    'Single layer nozzle for Precitec ProCutter heads, in 12/15/18 mm heights.',
    'Single layer cutting nozzle for Precitec ProCutter 2.0 cutting heads. Supplied across three body heights so standoff can be matched to the cutting programme without changing the head configuration. Machined from chrome-free copper for stable capacitive height sensing.',
    'ProCutter 2.0', 'Single Layer', 'Copper (chrome-free)', 'None', '1030-1090', '8000', 'Flat Seal',
  ]);

  let position = 0;
  for (const height of [12, 15, 18]) {
    const diameters = height === 15 ? [1.0, 1.4, 2.0, 2.7] : [1.0, 1.4, 2.0];
    diameters.forEach((d) => {
      const code = `${height}-${dp1(d).replace('.', '')}`;
      V(key, [
        `NZ-PC-SL-${code}`, `M11 H${height} D${dp1(d)}`, `${height}mm / D${dp1(d)}`,
        1320 + height * 12 + Math.round(d * 40), 'FIXED',
        'PIECE', 1, 1, 30 + height, 10, 'IN_STOCK',
        height === 15 && d === 1.4 ? 'true' : 'false', position,
        'M11', height, d, 32, '', '', '',
      ]);
      position += 10;
    });
  }
}

// FAMILY D — pack sizes, units of measure, and an ON_REQUEST price.
{
  const key = 'WSX-NC30-CR-H15';
  P(key, [
    'WSX NC30 Chrome-Plated Nozzle — H15', 'single-layer-nozzles', 'wsx', 'CONSUMABLE',
    '84669390', '18',
    'Chrome-plated nozzle for WSX NC-series heads, singly or in boxes of 10.',
    'Chrome-plated single layer nozzle for WSX NC-series cutting heads. The plating extends service life in high-duty production compared with bare copper, at the cost of a slightly higher unit price. Larger diameters are supplied in boxes of ten.',
    'NC30', 'Chrome-Plated', 'Copper', 'Chrome', '1064-1080', '6000', 'O-Ring',
  ]);

  const rows = [
    [1.0, 1180, 'PIECE', 1, 64, 'FIXED'],
    [1.5, 1180, 'PIECE', 1, 52, 'FIXED'],
    [2.0, 12400, 'PACK', 10, 8, 'FIXED'],
    [2.5, '', 'PIECE', 1, 0, 'ON_REQUEST'],
  ];
  rows.forEach(([d, price, uom, pack, qty, priceType], index) => {
    const code = code3(d);
    V(key, [
      `NZ-WSX-CR-H15-${code}`, `D${dp1(d)} H15`, `D${dp1(d)}${uom === 'PACK' ? ' (box of 10)' : ''}`,
      price, priceType, uom, pack, 1, qty, 6,
      qty === 0 ? 'OUT_OF_STOCK' : qty <= 10 ? 'LOW_STOCK' : 'IN_STOCK',
      index === 0 ? 'true' : 'false', index * 10,
      'H15', 15, d, 28, '', '', uom === 'PACK' ? '10 nozzles per box' : '',
    ]);
  });
}

// FAMILY E — a single-variant product. No selector, identical code path.
{
  const key = 'OS-CT-SPECIALIST';
  P(key, [
    'Ospri Ceramic-Tipped Nozzle — Specialist', 'single-layer-nozzles', 'ospri', 'SPARE_PART',
    '84669390', '18',
    'Ceramic-tipped nozzle for reflective material cutting on Ospri LC-series heads.',
    'Specialist ceramic-tipped nozzle for cutting highly reflective materials such as copper and brass on Ospri LC-series heads. The ceramic tip resists back-reflection damage that shortens the life of a conventional copper nozzle on these materials.',
    'LC30', 'Ceramic-Tipped', 'Copper / Ceramic', 'None', '1064-1080', '5000', 'O-Ring',
  ]);
  V(key, [
    'NZ-OS-CT-STD', 'OS-CT-1.5', 'Standard', 4850, 'FIXED',
    'PIECE', 1, 1, 9, 4, 'LOW_STOCK', 'true', 0,
    'M14', 16, 1.5, 30, '', '', '',
  ]);
}

// ── Other categories: protective windows, lenses, ceramic rings, kits ───────
// These give the storefront enough breadth for pagination and filtering to be
// meaningful, and include the punctuation-heavy part numbers that break naive
// full-text search.
{
  const key = 'RT-PW-D279';
  P(key, [
    'Raytools Protective Window — D27.9', 'protective-windows', 'raytools', 'CONSUMABLE',
    '90019000', '18',
    'Fused silica protective window, 27.9 mm diameter, for Raytools BM-series heads.',
    'Fused silica protective window with an anti-reflective coating on both faces. Protects the focus lens from spatter and fume. Supplied in the thicknesses used across the Raytools BM-series range.',
    'BM110', '', 'Fused Silica', 'AR Coated', '1064-1080', '6000', '',
  ]);
  [
    ['D27.9 T4.1', 4.1, 420, 210],
    ['D27.9 T1.5', 1.5, 380, 160],
    ['D27.9 T2.0', 2.0, 395, 88],
  ].forEach(([partNumber, thickness, price, qty], index) => {
    V(key, [
      `PW-RT-279-${String(thickness).replace('.', '')}`, partNumber, `T${thickness}`, price, 'FIXED',
      'PIECE', 1, 1, qty, 40, 'IN_STOCK', index === 0 ? 'true' : 'false', index * 10,
      '', '', '', 27.9, thickness, '', '',
    ]);
  });
}

{
  const key = 'RT-FL-D30';
  P(key, [
    'Raytools Focus Lens — D30', 'focus-lenses', 'raytools', 'COMPONENT',
    '90021900', '18',
    'Fused silica focusing lens, 30 mm diameter, in 100/125/150 mm focal lengths.',
    'Plano-convex fused silica focusing lens for Raytools BM-series cutting heads. Anti-reflective coated for 1064-1080 nm. Focal length selection determines kerf width and the practical thickness range of the head.',
    'BM110', '', 'Fused Silica', 'AR Coated', '1064-1080', '6000', '',
  ]);
  [[100, 1250, 34], [125, 1320, 21], [150, 1390, 12]].forEach(([focal, price, qty], index) => {
    V(key, [
      `FL-RT-D30-F${focal}`, `D30 F${focal}`, `F${focal}`, price, 'FIXED',
      'PIECE', 1, 1, qty, 10, qty <= 12 ? 'LOW_STOCK' : 'IN_STOCK',
      index === 0 ? 'true' : 'false', index * 10,
      '', '', '', 30, '', focal, '',
    ]);
  });
}

{
  const key = 'RT-CR-M11';
  P(key, [
    'Raytools Ceramic Ring — M11', 'ceramic-rings', 'raytools', 'SPARE_PART',
    '69091200', '18',
    'Insulating ceramic holder for Raytools BM-series cutting heads.',
    'Insulating ceramic ring that carries the nozzle and provides the capacitive height-sensing reference. A cracked or contaminated ring is the most common cause of unstable height tracking.',
    'BM110', '', 'Ceramic', 'None', '', '6000', '',
  ]);
  // Two variants sharing an OEM part number — proves part_number is not unique.
  [
    ['M11 H15', 'CR-RT-M11-STD', 'Standard', 180, 240],
    ['M11 H15', 'CR-RT-M11-HD', 'Heavy Duty', 260, 76],
  ].forEach(([partNumber, sku, name, price, qty], index) => {
    V(key, [
      sku, partNumber, name, price, 'FIXED',
      'PIECE', 1, 1, qty, 30, 'IN_STOCK', index === 0 ? 'true' : 'false', index * 10,
      'M11', 15, '', 32, '', '', '',
    ]);
  });
}

{
  const key = 'LEI-KIT-BM110';
  P(key, [
    'Consumable Kit — Raytools BM110', 'consumable-kits', 'lei-select', 'KIT',
    '84669390', '18',
    'The parts most often replaced together on a Raytools BM110 head.',
    'A single kit covering the consumables replaced together during routine BM110 maintenance: nozzles, protective windows and a ceramic ring. Ordering as a kit avoids the common situation of a machine standing idle because one of the three was missed.',
    'BM110', '', 'Mixed', '', '1064-1080', '6000', '',
  ]);
  [
    ['KIT-BM110-STD', 'KIT-BM110', 'Standard Kit', 2450, 26, '5 nozzles, 3 windows, 1 ceramic ring'],
    ['KIT-BM110-PRO', 'KIT-BM110-P', 'Extended Kit', 4680, 11, '10 nozzles, 6 windows, 2 ceramic rings'],
  ].forEach(([sku, partNumber, name, price, qty, contents], index) => {
    V(key, [
      sku, partNumber, name, price, 'FIXED',
      'SET', 1, 1, qty, 8, qty <= 12 ? 'LOW_STOCK' : 'IN_STOCK',
      index === 0 ? 'true' : 'false', index * 10,
      '', '', '', '', '', '', contents,
    ]);
  });
}

write('05-products.csv', products);
write('06-variants.csv', variants);

// ── 07 compatibility ────────────────────────────────────────────────────────
// variant_sku empty  => fits via EVERY variant of the product (the common case)
// variant_sku set    => fitment is specific to that variant
const compatibility = [
  ['product_key', 'variant_sku', 'machine_brand', 'machine_model', 'machine_variant', 'notes'],
];
const addCompat = (productKey, variantSku, brand, models, note) => {
  for (const model of models) {
    compatibility.push([productKey, variantSku, brand, model, '', note]);
  }
};

addCompat('RT-BM110-SL-H15', '', 'Raytools', ['BM110', 'BM111'], 'H15 thread heads');
addCompat('RT-BM110-SL-H20', '', 'Raytools', ['BT240', 'BM114'], 'H20 thread heads');

// Family B groups both threads into one product, so fitment IS variant-specific
// here. This is precisely the case that requires ProductCompatibility.variantId.
for (const sku of ['NZ-RT-DL-H15-010', 'NZ-RT-DL-H15-015', 'NZ-RT-DL-H15-020']) {
  addCompat('RT-BM110-DL', sku, 'Raytools', ['BM110', 'BM111'], 'H15 thread only');
}
for (const sku of ['NZ-RT-DL-H20-010', 'NZ-RT-DL-H20-020', 'NZ-RT-DL-H20-035', 'NZ-RT-DL-H20-040']) {
  addCompat('RT-BM110-DL', sku, 'Raytools', ['BT240', 'BM114'], 'H20 thread only');
}

addCompat('PC-PROCUTTER-SL', '', 'Precitec', ['ProCutter 2.0', 'HPSSL'], '');
addCompat('WSX-NC30-CR-H15', '', 'WSX', ['NC30', 'NC60', 'KC15'], '');
addCompat('OS-CT-SPECIALIST', '', 'Ospri', ['LC30', 'LC50'], 'Reflective materials');
addCompat('RT-PW-D279', '', 'Raytools', ['BM110', 'BM111', 'BT240'], '');
addCompat('RT-FL-D30', '', 'Raytools', ['BM110', 'BM111'], '');
addCompat('RT-CR-M11', '', 'Raytools', ['BM110', 'BM111'], '');
addCompat('LEI-KIT-BM110', '', 'Raytools', ['BM110'], '');

// A precision case: fitment restricted to one machine VARIANT, not the model.
compatibility.push(['RT-FL-D30', 'FL-RT-D30-F150', 'Raytools', 'BT240', '6kW', 'High power only']);

write('07-compatibility.csv', compatibility);

console.log('\nAll seed CSVs written to prisma/seed/csv/');
