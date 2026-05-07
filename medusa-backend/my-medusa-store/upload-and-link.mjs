// Upload design files to Medusa Cloud and update variant metadata with URLs.
// Usage: node --env-file=.env upload-and-link.mjs

import fs from 'fs';
import path from 'path';

const MEDUSA_URL = 'https://bleached-telephone-rock.medusajs.app';
const MEDUSA_EMAIL = 'wirenfeldtd@gmail.com';
const MEDUSA_PASSWORD = 'secret';

const SP_PRODUCT_ID = 46881;
const SP_COLOR_WHITE = 302483;
const SP_COLOR_BLACK = 302485;
const PRINT_AREA_WIDTH = 315;
const NECK_OFFSET = 55;

const SIZE_MAP = {
  'S': 171088, 'M': 171089, 'L': 171090,
  'XL': 171091, 'XXL': 171092, '3XL': 171093,
};

const PRODUCT_MAP = {
  'din-far': { file: 'dinfar-motive-01.png', colorId: SP_COLOR_WHITE, halsCm: 9.5, widthCm: 12.3 },
  'skattesvindel': { file: '012_10SH_SKATTESVINDEL.png', colorId: SP_COLOR_BLACK, halsCm: 6, widthCm: 16 },
  'legaliser': { file: '008_10SH_ATOM.png', colorId: SP_COLOR_BLACK, halsCm: 8, widthCm: 18 },
  'fentanyl': { file: '007_10SH_FENTANYL.png', colorId: SP_COLOR_BLACK, halsCm: 7.5, widthCm: 20 },
  'warning': { file: '009_10SH_WARNING.png', colorId: SP_COLOR_WHITE, halsCm: 6.5, widthCm: 25 },
  'bajer': { file: '013_10SH_BAJER.png', colorId: SP_COLOR_BLACK, halsCm: 6, widthCm: 7 },
  'bajer-white': { file: '013_10SH_BAJER.png', colorId: SP_COLOR_WHITE, halsCm: 6, widthCm: 7 },
  'bullshit': { file: '005_10SH_BULLSHIT.png', colorId: SP_COLOR_BLACK, halsCm: 7, widthCm: 22 },
  'single': { file: '006_10SH_SINGLE.png', colorId: SP_COLOR_BLACK, halsCm: 6.5, widthCm: 16 },
  'single-white': { file: '006_10SH_SINGLE.png', colorId: SP_COLOR_WHITE, halsCm: 6.5, widthCm: 16 },
  'organer': { file: '011_10SH_ORGANS.png', colorId: SP_COLOR_WHITE, halsCm: 7, widthCm: 15 },
  'jesus': { file: '010_10SH_JESUS.png', colorId: SP_COLOR_WHITE, halsCm: 8, widthCm: 12 },
  'upcoming': { file: '001_10SHI_PRNSTAR.png', colorId: SP_COLOR_BLACK, halsCm: 7, widthCm: 29 },
  'i-love-horses': { file: '003_10SH_WHRES.png', colorId: SP_COLOR_WHITE, halsCm: 7, widthCm: 22 },
  'bad-bitch': { file: '004_1OSH_HUG.png', colorId: SP_COLOR_WHITE, halsCm: 7, widthCm: 29 },
};

async function getToken() {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MEDUSA_EMAIL, password: MEDUSA_PASSWORD }),
  });
  return (await res.json()).token;
}

async function uploadFile(token, filePath, filename) {
  const fileBuffer = fs.readFileSync(filePath);
  const boundary = '----FormBoundary' + Date.now() + Math.random().toString(36).slice(2);

  const parts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="files"; filename="${filename}"\r\n`,
    `Content-Type: image/png\r\n\r\n`,
  ];

  const body = Buffer.concat([
    Buffer.from(parts.join('')),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await fetch(`${MEDUSA_URL}/admin/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed ${res.status}: ${text.substring(0, 200)}`);
  }

  const data = await res.json();
  // Response: { files: [{ id, url }] }
  return data.files[0].url;
}

async function getProducts(token) {
  const res = await fetch(`${MEDUSA_URL}/admin/products?limit=100&fields=id,title,handle,variants.id,variants.title`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()).products;
}

async function updateVariantMetadata(token, productId, variantId, metadata) {
  const res = await fetch(`${MEDUSA_URL}/admin/products/${productId}/variants/${variantId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update failed ${res.status}: ${text.substring(0, 200)}`);
  }
}

async function main() {
  const token = await getToken();
  console.log('Authenticated\n');

  // Step 1: Upload all unique design files to Medusa Cloud
  console.log('=== Uploading design files ===\n');
  const uploadedUrls = {};

  for (const [handle, config] of Object.entries(PRODUCT_MAP)) {
    if (uploadedUrls[config.file]) continue; // Already uploaded

    const filePath = path.resolve('static', config.file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠ ${config.file} — not found, skipping`);
      continue;
    }

    try {
      const url = await uploadFile(token, filePath, config.file);
      uploadedUrls[config.file] = url;
      console.log(`✓ ${config.file} → ${url}`);
    } catch (err) {
      console.log(`✗ ${config.file} — ${err.message}`);
    }
  }

  console.log(`\nUploaded ${Object.keys(uploadedUrls).length} files\n`);

  // Step 2: Fetch products and update variants
  console.log('=== Updating variant metadata ===\n');
  const products = await getProducts(token);

  let updated = 0, skipped = 0, errors = 0;

  for (const product of products) {
    const config = PRODUCT_MAP[product.handle];
    if (!config) {
      console.log(`SKIP ${product.title} (${product.handle}) — no mapping`);
      skipped++;
      continue;
    }

    const designUrl = uploadedUrls[config.file];
    if (!designUrl) {
      console.log(`SKIP ${product.title} — design not uploaded`);
      skipped++;
      continue;
    }

    const topMm = Math.max(0, (config.halsCm * 10) - NECK_OFFSET);
    const marginMm = (PRINT_AREA_WIDTH - config.widthCm * 10) / 2;

    console.log(`\n${product.title} (${product.handle})`);
    console.log(`  Color: ${config.colorId === SP_COLOR_WHITE ? 'White' : 'Black'}, Position: left=${marginMm} right=${marginMm} top=${topMm}`);

    for (const variant of product.variants) {
      const sizeId = SIZE_MAP[variant.title];
      if (!sizeId) {
        console.log(`  ⚠ ${variant.title} — no SP size, skipping`);
        skipped++;
        continue;
      }

      const metadata = {
        shirtplatform_product_id: SP_PRODUCT_ID,
        shirtplatform_assigned_color_id: config.colorId,
        shirtplatform_assigned_size_id: sizeId,
        shirtplatform_motive_url: designUrl,
        shirtplatform_motive_filename: config.file,
        shirtplatform_view_position: 'FRONT',
        shirtplatform_position_left: String(marginMm),
        shirtplatform_position_right: String(marginMm),
        shirtplatform_position_top: String(topMm),
      };

      try {
        await updateVariantMetadata(token, product.id, variant.id, metadata);
        console.log(`  ✓ ${variant.title} → SP size ${sizeId}`);
        updated++;
      } catch (err) {
        console.log(`  ✗ ${variant.title}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Done! Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log(`\nUploaded design URLs:`);
  for (const [file, url] of Object.entries(uploadedUrls)) {
    console.log(`  ${file} → ${url}`);
  }
}

main().catch(console.error);
