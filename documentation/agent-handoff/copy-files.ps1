$handoffDir = "documentation/agent-handoff"
$files = @(
    # Context (read-only)
    "documentation/DOCUMENTATION.md",
    "documentation/export_veonn_framer_website/index.html",
    "tailwind.config.js",
    "src/styles/globals.css",
    "src/lib/config.ts",
    "src/lib/data/collections.ts",
    "src/lib/data/products.ts",
    "src/lib/data/regions.ts",
    "src/lib/constants.tsx",
    "src/types/global.ts",
    "src/middleware.ts",
    # Files to MODIFY
    "src/app/[countryCode]/(main)/page.tsx",
    "src/app/[countryCode]/(main)/layout.tsx",
    "src/modules/layout/templates/nav/index.tsx",
    "src/modules/home/components/hero/index.tsx",
    "src/modules/home/components/featured-products/index.tsx",
    "src/modules/home/components/new-in-grid/index.tsx",
    "src/modules/home/components/newsletter/index.tsx",
    "src/modules/common/components/scroll-reveal/index.tsx",
    "src/modules/products/components/product-preview/index.tsx",
    "src/modules/layout/templates/footer/index.tsx",
    "package.json",
    # Store files to DELETE (for reference)
    "src/app/[countryCode]/(main)/store/page.tsx",
    "src/modules/store/templates/index.tsx",
    "src/modules/store/templates/infinite-products.tsx"
)

foreach ($file in $files) {
    $dest = Join-Path $handoffDir $file
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    if (Test-Path $file) {
        Copy-Item $file $dest -Force
        Write-Host "Copied: $file"
    } else {
        Write-Host "MISSING: $file"
    }
}
Write-Host "Done copying files."