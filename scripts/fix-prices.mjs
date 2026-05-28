/**
 * Fix all niche product prices from 3499 to 34.99
 * Medusa v2 uses whole currency units, not cents.
 */

const MEDUSA_URL = 'http://localhost:9000';
const OLD_PRICE = 3499;
const NEW_PRICE = 34.99;

async function main() {
  // Authenticate
  const authRes = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'supersecret' }),
  });
  const { token } = await authRes.json();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Fetch all products
  let offset = 0;
  let allProducts = [];
  while (true) {
    const r = await fetch(
      `${MEDUSA_URL}/admin/products?limit=50&offset=${offset}&fields=id,handle,variants.id,variants.title,variants.prices.*`,
      { headers }
    );
    const d = await r.json();
    allProducts.push(...d.products);
    if (allProducts.length >= d.count) break;
    offset += 50;
  }

  // Filter products with wrong price
  const toFix = allProducts.filter(
    (p) => p.variants?.some((v) => v.prices?.some((pr) => pr.amount === OLD_PRICE))
  );
  console.log(`Found ${toFix.length} products with price ${OLD_PRICE} to fix`);

  let fixed = 0;
  let failed = 0;

  for (const product of toFix) {
    for (const variant of product.variants) {
      const badPrices = (variant.prices || []).filter((pr) => pr.amount === OLD_PRICE);
      if (badPrices.length === 0) continue;

      const r = await fetch(
        `${MEDUSA_URL}/admin/products/${product.id}/variants/${variant.id}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            prices: badPrices.map((pr) => ({
              amount: NEW_PRICE,
              currency_code: pr.currency_code,
            })),
          }),
        }
      );

      if (r.ok) {
        fixed++;
        // Consume response body to avoid memory issues
        await r.json();
      } else {
        failed++;
        const text = await r.text();
        console.error(`FAIL ${product.handle} ${variant.title}: ${text.substring(0, 100)}`);
      }
    }
    process.stdout.write('.');
  }

  console.log();
  console.log(`Done! Fixed ${fixed} variant prices, ${failed} failures`);
}

main().catch(console.error);
