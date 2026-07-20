$handoff = "documentation\agent-handoff"

# Copy files with brackets in paths using Get-Item
$files = @(
    'src\app\[countryCode]\(main)\page.tsx',
    'src\app\[countryCode]\(main)\layout.tsx',
    'src\app\[countryCode]\(main)\store\page.tsx'
)

foreach ($file in $files) {
    $dest = Join-Path $handoff $file
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $file -Destination $dest -Force
    Write-Host "Copied: $file"
}
Write-Host "Done."