// Preview generator for Dinfar design on StanleyStella Crafter T
// Usage: node --env-file=.env preview-dinfar.mjs
//
// Generates preview images for White and Black shirts without committing orders.

import fs from 'fs';
import path from 'path';

const API_URL = 'https://api.shirtplatform.com/webservices/rest';
const USERNAME = process.env.SHIRTPLATFORM_USERNAME;
const PASSWORD = process.env.SHIRTPLATFORM_PASSWORD;
const ACCOUNT = '387';
const SHOP = '1597';

// Product 46881 — StanleyStella Crafter T unisex Men
const PRODUCT_ID = 46881;
const COLORS = {
  white: 302483,
  black: 302485,
};
const SIZE_L = 171090; // Size L for preview

// Design positioning (measured on Large shirt):
//   - 9cm from neck to top of design
//   - 12.27cm wide, centered horizontally
//
// The CreatorSE position is relative to the PRINT AREA, not the shirt.
// On a Crafter T, the print area top edge is roughly 5-6cm below the neckline.
// So 9cm from neck ≈ 3-4cm from top of print area.
// We'll start with top: 35mm and iterate based on preview.
// Design image: 1462×530px at 300 DPI = 123.8mm × 44.9mm
// API ignores DPI metadata and renders at ~141 DPI (264mm wide) by default.
// The Position object controls both position AND size.
// Setting left + right constrains the width between those margins.
// Print area for L = 315mm wide → margins = (315 - 123) / 2 = 96mm each side.
const DESIGN_WIDTH_MM = 123;
const POSITION = {
  left: '96',
  right: '96',
  top: '40',
};

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
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function generatePreview(token, colorName, colorId, base64, position) {
  const uniqueId = `dinfar-preview-${colorName}-${Date.now()}`;

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
  console.log(`  Order ${orderId} created`);

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
                filename: 'dinfar-motive-01.png',
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
  console.log(`  OrderedProduct ${opId} added`);

  // 3. Check elements
  const expData = await apiRequest(token, `/accounts/${ACCOUNT}/shops/${SHOP}/orders/${orderId}/orderedProducts/expanded/${opId}`);
  const comps = expData.orderedProduct?.design?.compositions?.composition;
  if (comps) {
    for (const c of (Array.isArray(comps) ? comps : [comps])) {
      if (c.elements && c.elements !== '') {
        const el = c.elements.designElementMotive || c.elements;
        console.log(`  ✓ Element details:`, JSON.stringify(el, null, 2));
      }
    }
  }

  // 4. Download preview image
  const imgRes = await fetch(`${API_URL}/accounts/${ACCOUNT}/shops/${SHOP}/orders/${orderId}/orderedProducts/${opId}/image`, {
    headers: { 'x-auth-token': token, Accept: 'image/png' },
  });
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  const outPath = `C:\\temp\\dinfar-preview-${colorName}.png`;
  fs.writeFileSync(outPath, imgBuffer);
  console.log(`  ✓ Preview saved: ${outPath} (${imgBuffer.length} bytes)`);

  // 5. Cancel order (don't commit — this is just for preview)
  await apiRequest(token, `/accounts/${ACCOUNT}/shops/${SHOP}/orders/${orderId}/cancelOrder`, {
    method: 'DELETE',
  });
  console.log(`  Order ${orderId} cancelled`);

  return outPath;
}

async function main() {
  console.log('Loading design...');
  const designPath = path.resolve('static/dinfar-motive-01.png');
  const base64 = fs.readFileSync(designPath).toString('base64');
  console.log(`Design: ${fs.statSync(designPath).size} bytes → ${base64.length} chars base64`);

  const token = await getToken();
  console.log('Authenticated\n');

  // Also fetch realSizes for the FRONT print area
  try {
    const realSizes = await apiRequest(token, `/accounts/${ACCOUNT}/shops/${SHOP}/products/${PRODUCT_ID}/assignedViews/128258/areas/146424/realSizes`);
    console.log('Print area realSizes:', JSON.stringify(realSizes, null, 2));
  } catch (e) {
    console.log('Could not fetch realSizes:', e.message);
  }
  console.log('');

  for (const [colorName, colorId] of Object.entries(COLORS)) {
    console.log(`Generating ${colorName} preview...`);
    await generatePreview(token, colorName, colorId, base64, POSITION);
    console.log('');
  }

  console.log('Done! Check C:\\temp\\dinfar-preview-white.png and C:\\temp\\dinfar-preview-black.png');
}

main().catch(console.error);
