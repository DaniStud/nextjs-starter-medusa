# Veon homepage cleanup - run from the repo root AFTER copying the new files in.
#   powershell -ExecutionPolicy Bypass -File .\cleanup.ps1
#
# Deletes the old /store route and orphaned store-template files, but keeps
# shared modules that other pages depend on:
#   KEEP src/modules/store/components/refinement-list/sort-products
#        (imported by src/lib/data/products.ts)
#   KEEP src/modules/store/templates/paginated-products*
#        (shared by collections/categories templates)

$ErrorActionPreference = "Stop"
$script:HadWarnings = $false

function Get-References {
    param([string]$Needle, [string]$ExcludePath)
    $exclude = (Resolve-Path -LiteralPath $ExcludePath -ErrorAction SilentlyContinue).Path
    Get-ChildItem -Path "src" -Recurse -Include *.ts, *.tsx -File |
        Where-Object { -not $exclude -or -not $_.FullName.StartsWith($exclude) } |
        Select-String -SimpleMatch -Pattern $Needle
}

function Remove-IfOrphaned {
    param([string]$Target, [string]$Needle)
    if (-not (Test-Path -LiteralPath $Target)) {
        Write-Host "SKIP  $Target (not present)"
        return
    }
    $hits = Get-References -Needle $Needle -ExcludePath $Target
    if ($hits) {
        Write-Host "KEEP  $Target - still referenced:" -ForegroundColor Yellow
        $hits | ForEach-Object { Write-Host "        $($_.Path):$($_.LineNumber)" }
        $script:HadWarnings = $true
    }
    else {
        Remove-Item -LiteralPath $Target -Recurse -Force
        Write-Host "DEL   $Target"
    }
}

Write-Host "== Veon cleanup =="

# 1. The /store page route - replaced by the homepage (+ middleware redirect)
$storeRoute = "src/app/[countryCode]/(main)/store"
if (Test-Path -LiteralPath $storeRoute) {
    Remove-Item -LiteralPath $storeRoute -Recurse -Force
    Write-Host "DEL   $storeRoute/"
}
else {
    Write-Host "SKIP  $storeRoute/ (not present)"
}

# 2. StoreTemplate - only the deleted route imported it
Remove-IfOrphaned -Target "src/modules/store/templates/index.tsx" -Needle '@modules/store/templates"'

# 3. InfiniteProducts - orphaned in the current codebase; verify before deleting
Remove-IfOrphaned -Target "src/modules/store/templates/infinite-products.tsx" -Needle "infinite-products"

# 4. ProductRail - orphaned by the featured-products rewrite; verify before deleting
Remove-IfOrphaned -Target "src/modules/home/components/featured-products/product-rail" -Needle "featured-products/product-rail"

Write-Host ""
Write-Host "Kept on purpose (shared dependencies):"
Write-Host "  - src/modules/store/components/refinement-list/sort-products (used by src/lib/data/products.ts)"
Write-Host "  - src/modules/store/templates/paginated-products (used by collections/categories templates)"
Write-Host ""
if ($script:HadWarnings) {
    Write-Host "Done with warnings - some files were kept because they are still referenced. Review above." -ForegroundColor Yellow
}
else {
    Write-Host "Done. Next: yarn install; yarn dev"
}
