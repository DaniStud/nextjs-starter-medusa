// Remove XXS and XS variants from all products on Medusa Cloud
// Usage: node --env-file=.env remove-xxs-xs.mjs

const MEDUSA_URL = 'https://bleached-telephone-rock.medusajs.app';

async function main() {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'wirenfeldtd@gmail.com', password: 'secret' }),
  });
  const { token } = await res.json();

  const prodRes = await fetch(`${MEDUSA_URL}/admin/products?limit=100&fields=id,title,handle,variants.id,variants.title`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { products } = await prodRes.json();

  const toDelete = [];
  for (const p of products) {
    for (const v of (p.variants || [])) {
      if (v.title === 'XXS' || v.title === 'XS') {
        toDelete.push({ productId: p.id, variantId: v.id, product: p.title, size: v.title });
      }
    }
  }

  console.log(`Found ${toDelete.length} XXS/XS variants to delete:`);
  for (const d of toDelete) {
    console.log(`  ${d.product} — ${d.size} (${d.variantId})`);
  }

  let deleted = 0;
  for (const d of toDelete) {
    const delRes = await fetch(`${MEDUSA_URL}/admin/products/${d.productId}/variants/${d.variantId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (delRes.ok) {
      console.log(`  ✓ Deleted ${d.product} ${d.size}`);
      deleted++;
    } else {
      console.log(`  ✗ Failed ${d.product} ${d.size}: ${delRes.status}`);
    }
  }
  console.log(`\nDeleted ${deleted}/${toDelete.length} variants`);
}

main().catch(console.error);
