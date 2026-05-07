// Preview generator for all 12 designs on StanleyStella Crafter T
// Usage: node --env-file=.env preview-all.mjs
//
// Generates White + Black previews for each design, saves to C:\temp\previews\

import fs from 'fs';
import path from 'path';

const API_URL = 'https://api.shirtplatform.com/webservices/rest';
const USERNAME = process.env.SHIRTPLATFORM_USERNAME;
const PASSWORD = process.env.SHIRTPLATFORM_PASSWORD;
const ACCOUNT = '387';
const SHOP = '1597';

const PRODUCT_ID = 46881;
const COLORS = { white: 302483, black: 302485 };
const SIZE_L = 171090;

// Print area for L = 315mm wide. Neck-to-print-area offset ≈ 55mm.
// top = (hals_cm * 10) - 55
// left = right = (315 - width_cm * 10) / 2

const DESIGNS = [
  { name: 'skattesvindel', file: '012_10SH_SKATTESVINDEL.png', halsCm: 6, widthCm: 16 },
  { name: 'atomvaaben',    file: '008_10SH_ATOM.png',          halsCm: 8, widthCm: 18 },
  { name: 'fentanyl',      file: '007_10SH_FENTANYL.png',      halsCm: 7.5, widthCm: 20 },
  { name: 'pornstar',      file: '001_10SHI_PRNSTAR.png',      halsCm: 7, widthCm: 29 },
  { name: 'needahug',      file: '004_1OSH_HUG.png',           halsCm: 7, widthCm: 29 },
  { name: 'warning',       file: '009_10SH_WARNING.png',       halsCm: 6.5, widthCm: 25 },
  { name: 'bajer',         file: '013_10SH_BAJER.png',         halsCm: 6, widthCm: 7 },
  { name: 'bullshit',      file: '005_10SH_BULLSHIT.png',      halsCm: 7, widthCm: 22 },
  { name: 'single',        file: '006_10SH_SINGLE.png',        halsCm: 6.5, widthCm: 16 },
  { name: 'organer',       file: '011_10SH_ORGANS.png',        halsCm: 7, widthCm: 15 },
  { name: 'jesus',         file: '010_10SH_JESUS.png',         halsCm: 8, widthCm: 12 },
  { name: 'whores',        file: '003_10SH_WHRES.png',         halsCm: 7, widthCm: 22 },
];

const PRINT_AREA_WIDTH = 315; // L size
const NECK_OFFSET = 55; // mm from neck to print area top

async function getToken() {
  const cred = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  const res = await fetch(`${API_URL}/auth`, {
    headers: { Authorization: `Basic ${cred}`, Accept: 'application/json' },
  });
  return res.headers.get('x-auth-token');
}

async function apiRequest(token, endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'x-auth-token': token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.substring(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function generatePreview(token, design, colorName, colorId, base64, position) {
  const uniqueId = `preview-${design.name}-${colorName}-${Date.now()}`;

  // 1. Create order
  const orderData = await apiRequest(token, `/accounts/${ACCOUNT}/shops/${SHOP}/orders`, {
    method: 'POST',
    body: JSON.stringify({
      productionOrder: {
        uniqueId,
        financialStatus: 'PAID',
        country: { id: 4742 },
        orderShipping: { title: 'Standard Shipping', carrier: { id: 872 } },
        customer: {
          firstName: 'Preview', lastName: 'Test', email: 'preview@test.com',
          shippingAddress: { street: 'Test', streetNo: '1', city: 'Copenhagen', zip: '2200', countryCode: 'DK' },
          billingAddress: { street: 'Test', streetNo: '1', city: 'Copenhagen', zip: '2200', countryCode: 'DK' },
        },
      },
    }),
  });
  const orderId = orderData.productionOrderExpanded.id;

  // 2. Add product with inline motive
  const designBody = {
    creatorse_design: {
      productId: PRODUCT_ID,
      amount: 1,
      assignedColor: { id: colorId },
      assignedSize: { id: SIZE_L },
      compositions: {
        creatorse_composition: [{
          productArea: {
            assignedView: { view: { position: 'FRONT' } },
          },
          elements: [{
            creatorse_designElementMotive: {
              motive: {
                attachment: base64,
                filename: design.file,
              },
              position,
            },
          }],
        }],
      },
    },
  };

  const addData = await apiRequest(token, `/accounts/${ACCOUNT}/shops/${SHOP}/orders/${orderId}/orderedProducts/usingCreatorSE`, {
    method: 'POST',
    body: JSON.stringify(designBody),
  });
  const opId = addData.orderedProduct.id;

  // 3. Download preview image
  const imgRes = await fetch(`${API_URL}/accounts/${ACCOUNT}/shops/${SHOP}/orders/${orderId}/orderedProducts/${opId}/image`, {
    headers: { 'x-auth-token': token, Accept: 'image/png' },
  });
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  const outPath = path.join('C:\\temp\\previews', `${design.name}-${colorName}.png`);
  fs.writeFileSync(outPath, imgBuffer);

  // 4. Cancel order
  await apiRequest(token, `/accounts/${ACCOUNT}/shops/${SHOP}/orders/${orderId}/cancelOrder`, {
    method: 'DELETE',
  });

  return { outPath, bytes: imgBuffer.length };
}

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync('C:\\temp\\previews')) {
    fs.mkdirSync('C:\\temp\\previews', { recursive: true });
  }

  const token = await getToken();
  console.log('Authenticated\n');

  for (const design of DESIGNS) {
    const designPath = path.resolve('static', design.file);
    if (!fs.existsSync(designPath)) {
      console.log(`⚠ SKIP ${design.name}: file not found: ${design.file}`);
      continue;
    }

    const base64 = fs.readFileSync(designPath).toString('base64');
    const topMm = (design.halsCm * 10) - NECK_OFFSET;
    const marginMm = (PRINT_AREA_WIDTH - design.widthCm * 10) / 2;

    const position = {
      left: String(marginMm),
      right: String(marginMm),
      top: String(Math.max(0, topMm)),
    };

    console.log(`${design.name} — ${design.file} (${(base64.length / 1024).toFixed(0)}KB b64)`);
    console.log(`  Position: left=${position.left}, right=${position.right}, top=${position.top} (hals ${design.halsCm}cm, width ${design.widthCm}cm)`);

    for (const [colorName, colorId] of Object.entries(COLORS)) {
      try {
        const result = await generatePreview(token, design, colorName, colorId, base64, position);
        console.log(`  ✓ ${colorName}: ${result.outPath} (${(result.bytes / 1024).toFixed(0)}KB)`);
      } catch (err) {
        console.log(`  ✗ ${colorName}: ${err.message}`);
      }
    }
    console.log('');
  }

  console.log('Done! Check C:\\temp\\previews\\');
}

main().catch(console.error);
