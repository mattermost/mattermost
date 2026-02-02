$componentsDir = "G:\Modding\_Github\mattermost\webapp\node_modules\@mattermost\compass-icons\components"
$outputDir = "G:\Modding\_Github\mattermost\extracted-svgs\compass-icons-ALL"

# Create output directory
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

$jsFiles = Get-ChildItem "$componentsDir\*.js" | Where-Object { $_.Name -ne "index.js" }
$count = 0
$errors = @()

foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw

    # Extract viewBox
    $viewBox = "0 0 24 24"
    if ($content -match 'viewBox:\s*"([^"]+)"') {
        $viewBox = $matches[1]
    }

    # Extract all path d attributes
    $paths = @()
    $pathMatches = [regex]::Matches($content, 'd:\s*"([^"]+)"')
    foreach ($match in $pathMatches) {
        $paths += $match.Groups[1].Value
    }

    if ($paths.Count -eq 0) {
        $errors += $file.Name
        continue
    }

    # Build SVG
    $svgName = $file.BaseName
    $pathElements = ($paths | ForEach-Object { "  <path d=`"$_`"/>" }) -join "`n"

    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="$viewBox" fill="currentColor">
$pathElements
</svg>
"@

    $outputPath = Join-Path $outputDir "$svgName.svg"
    $svg | Out-File -FilePath $outputPath -Encoding utf8 -NoNewline
    $count++
}

Write-Host "Extracted $count icons to $outputDir"
if ($errors.Count -gt 0) {
    Write-Host "Failed to extract: $($errors -join ', ')"
}

# List some examples
Write-Host "`nSample icons:"
Get-ChildItem "$outputDir\*.svg" | Select-Object -First 10 -ExpandProperty Name
