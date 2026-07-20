#!/usr/bin/env bash
# Veon homepage cleanup — run from the repo root AFTER copying the new files in.
#
# Deletes the old /store route and orphaned store-template files, but keeps
# shared modules that other pages depend on:
#   KEEP src/modules/store/components/refinement-list/sort-products
#        (imported by src/lib/data/products.ts)
#   KEEP src/modules/store/templates/paginated-products*
#        (shared by collections/categories templates)
set -euo pipefail

fail=0

refs() {
  # Count references to $1 in src/, excluding files under path $2 (the thing being deleted)
  grep -rn --include='*.ts' --include='*.tsx' -F "$1" src/ 2>/dev/null | grep -v "^$2" || true
}

delete_if_orphaned() {
  local target="$1" needle="$2"
  if [ ! -e "$target" ]; then
    echo "SKIP  $target (not present)"
    return
  fi
  local hits
  hits="$(refs "$needle" "$target")"
  if [ -n "$hits" ]; then
    echo "KEEP  $target — still referenced:"
    echo "$hits" | sed 's/^/        /'
    fail=1
  else
    rm -rf "$target"
    echo "DEL   $target"
  fi
}

echo "== Veon cleanup =="

# 1. The /store page route — replaced by the homepage (+ middleware redirect)
if [ -d "src/app/[countryCode]/(main)/store" ]; then
  rm -rf "src/app/[countryCode]/(main)/store"
  echo "DEL   src/app/[countryCode]/(main)/store/"
else
  echo "SKIP  src/app/[countryCode]/(main)/store/ (not present)"
fi

# 2. StoreTemplate — only the deleted route imported it
delete_if_orphaned "src/modules/store/templates/index.tsx" "@modules/store/templates\""

# 3. InfiniteProducts — orphaned in the current codebase; verify before deleting
delete_if_orphaned "src/modules/store/templates/infinite-products.tsx" "infinite-products"

# 4. ProductRail — orphaned by the featured-products rewrite; verify before deleting
delete_if_orphaned "src/modules/home/components/featured-products/product-rail" "featured-products/product-rail"

echo
echo "Kept on purpose (shared dependencies):"
echo "  - src/modules/store/components/refinement-list/sort-products (used by src/lib/data/products.ts)"
echo "  - src/modules/store/templates/paginated-products (used by collections/categories templates)"
echo
if [ "$fail" -eq 1 ]; then
  echo "Done with warnings — some files were kept because they are still referenced. Review above."
else
  echo "Done. Next: yarn install && yarn dev"
fi
