// Links existing Medusa Cloud products to Shirtplatform by setting variant metadata.
// Usage: node --env-file=.env link-shirtplatform.mjs
//
// Reads design PNGs from static/, converts to base64, then updates each variant
// with the Shirtplatform metadata needed for auto-fulfillment.
//
// NOTE: XXS and XS sizes don't exist on Shirtplatform product 46881 (only S-3XL).
// Those variants are skipped with a warning.

import fs from 'fs';
import path from 'path';

const MEDUSA_URL = 'https://bleached-telephone-rock.medusajs.app';
const MEDUSA_EMAIL = 'wirenfeldtd@gmail.com';
const MEDUSA_PASSWORD = 'secret';

// Shirtplatform product 46881 — StanleyStella Crafter T unisex Men
const SP_PRODUCT_ID = 46881;
const SP_COLOR_WHITE = 302483;
const SP_COLOR_BLACK = 302485;
const PRINT_AREA_WIDTH = 315; // L size, mm
const NECK_OFFSET = 55; // mm from neck to print area top

// Size mapping: Medusa variant title → Shirtplatform assignedSizeId
const SIZE_MAP = {
  'S': 171088,
  'M': 171089,
  'L': 171090,
  'XL': 171091,
  'XXL': 171092,
  '3XL': 171093,
};

// Product mapping: handle → { file, colorId, halsCm, widthCm }
const PRODUCT_MAP = {
  'din-far': {
    file: 'dinfar-motive-01.png',
    colorId: SP_COLOR_WHITE,
    halsCm: 9.5, // top=40 → 40+55=95mm = 9.5cm from neck
    widthCm: 12.3,
  },
  'skattesvindel': {
    file: '012_10SH_SKATTESVINDEL-opt.png',
    colorId: SP_COLOR_BLACK,
    halsCm: 6,
    widthCm: 16,
  },
  'legaliser': {
    file: '008_10SH_ATOM.png',
    colorId: SP_COLOR_BLACK,
    halsCm: 8,
    widthCm: 18,
  },
  'fentanyl': {
    file: '007_10SH_FENTANYL.png',
    colorId: SP_COLOR_BLACK,
    halsCm: 7.5,
    widthCm: 20,
  },
  'warning': {
    file: '009_10SH_WARNING.png',
    colorId: SP_COLOR_WHITE,
    halsCm: 6.5,
    widthCm: 25,
  },
  'bajer': {
    file: '013_10SH_BAJER.png',
    colorId: SP_COLOR_BLACK,
    halsCm: 6,
    widthCm: 7,
  },
  'bajer-white': {
    file: '013_10SH_BAJER.png',
    colorId: SP_COLOR_WHITE,
    halsCm: 6,
    widthCm: 7,
  },
  'bullshit': {
    file: '005_10SH_BULLSHIT.png',
    colorId: SP_COLOR_BLACK,
    halsCm: 7,
    widthCm: 22,
  },
  'single': {
    file: '006_10SH_SINGLE.png',
    colorId: SP_COLOR_BLACK,
    halsCm: 6.5,
    widthCm: 16,
  },
  'single-white': {
    file: '006_10SH_SINGLE.png',
    colorId: SP_COLOR_WHITE,
    halsCm: 6.5,
    widthCm: 16,
  },
  'organer': {
    file: '011_10SH_ORGANS-opt.png',
    colorId: SP_COLOR_WHITE,
    halsCm: 7,
    widthCm: 15,
  },
  'jesus': {
    file: '010_10SH_JESUS-opt.png',
    colorId: SP_COLOR_WHITE,
    halsCm: 8,
    widthCm: 12,
  },
};

async function getToken() {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MEDUSA_EMAIL, password: MEDUSA_PASSWORD }),
  });
  const data = await res.json();
  return data.token;
}

async function getProducts(token) {
  const res = await fetch(`${MEDUSA_URL}/admin/products?limit=100&fields=id,title,handle,variants.id,variants.title`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.products;
}

async function updateVariantMetadata(token, productId, variantId, metadata) {
  const res = await fetch(`${MEDUSA_URL}/admin/products/${productId}/variants/${variantId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ metadata }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update variant ${variantId}: ${res.status} ${text.substring(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const token = await getToken();
  console.log('Authenticated to Medusa Cloud\n');

  const products = await getProducts(token);
  console.log(`Found ${products.length} products\n`);

  // Pre-load all design files as base64
  const base64Cache = {};
  for (const config of Object.values(PRODUCT_MAP)) {
    if (!base64Cache[config.file]) {
      const filePath = path.resolve('static', config.file);
      if (!fs.existsSync(filePath)) {
        console.log(`⚠ File not found: ${config.file}`);
        continue;
      }
      base64Cache[config.file] = fs.readFileSync(filePath).toString('base64');
      console.log(`Loaded ${config.file} (${(base64Cache[config.file].length / 1024).toFixed(0)}KB base64)`);
    }
  }
  console.log('');

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of products) {
    const config = PRODUCT_MAP[product.handle];
    if (!config) {
      console.log(`SKIP ${product.title} (${product.handle}) — no mapping`);
      skipped++;
      continue;
    }

    const base64 = base64Cache[config.file];
    if (!base64) {
      console.log(`SKIP ${product.title} — design file not loaded`);
      skipped++;
      continue;
    }

    // Calculate position
    const topMm = Math.max(0, (config.halsCm * 10) - NECK_OFFSET);
    const marginMm = (PRINT_AREA_WIDTH - config.widthCm * 10) / 2;

    console.log(`\n${product.title} (${product.handle})`);
    console.log(`  Color: ${config.colorId === SP_COLOR_WHITE ? 'White' : 'Black'}`);
    console.log(`  Position: left=${marginMm}, right=${marginMm}, top=${topMm}`);
    console.log(`  Variants: ${product.variants.length}`);

    for (const variant of product.variants) {
      const sizeId = SIZE_MAP[variant.title];
      if (!sizeId) {
        console.log(`  ⚠ ${variant.title} — no SP size (only S-3XL available), skipping`);
        skipped++;
        continue;
      }

      const metadata = {
        shirtplatform_product_id: SP_PRODUCT_ID,
        shirtplatform_assigned_color_id: config.colorId,
        shirtplatform_assigned_size_id: sizeId,
        shirtplatform_motive_attachment: base64,
        shirtplatform_motive_filename: config.file,
        shirtplatform_view_position: 'FRONT',
        shirtplatform_position_left: String(marginMm),
        shirtplatform_position_right: String(marginMm),
        shirtplatform_position_top: String(topMm),
      };

      try {
        await updateVariantMetadata(token, product.id, variant.id, metadata);
        console.log(`  ✓ ${variant.title} (${variant.id}) → SP size ${sizeId}`);
        updated++;
      } catch (err) {
        console.log(`  ✗ ${variant.title}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Done! Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log(`\nRemaining TODOs:`);
  console.log(`  - Add products: Porn Star, Need a Hug, Whores`);
  console.log(`  - Add designs: I Love Horses, Bad Bitch, Upcoming`);
  console.log(`  - XXS/XS variants have no Shirtplatform size — consider removing or using a different SP product`);
}

main().catch(console.error);
