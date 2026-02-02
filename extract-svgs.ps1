# extract-svgs.ps1
# Extracts all SVGs actively used in the Mattermost webapp
# Organizes them into readable folders for easy modification

param(
    [string]$OutputDir = ".\extracted-svgs"
)

$ErrorActionPreference = "Stop"

function Write-Status($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "=== Mattermost SVG Extractor ===" -ForegroundColor Magenta
Write-Host "Output directory: $OutputDir"
Write-Host ""

# Clean and create output directories
if (Test-Path $OutputDir) {
    Remove-Item $OutputDir -Recurse -Force
}

$dirs = @(
    "$OutputDir\01-compass-icons-ACTIVE",
    "$OutputDir\02-compass-icons-ALL",
    "$OutputDir\03-widget-icons\status",
    "$OutputDir\03-widget-icons\ui-controls",
    "$OutputDir\03-widget-icons\brand",
    "$OutputDir\03-widget-icons\misc",
    "$OutputDir\04-static-svgs\browser-icons",
    "$OutputDir\04-static-svgs\file-type-icons",
    "$OutputDir\04-static-svgs\misc",
    "$OutputDir\05-admin-console"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}
Write-Success "Created directory structure"

# =============================================================================
# 1. FIND ACTIVELY USED COMPASS ICONS
# =============================================================================
Write-Host ""
Write-Host "[1/5] Finding actively used compass-icons..." -ForegroundColor Yellow

# Find all compass-icon imports in the source code
$srcPath = "webapp\channels\src"
$activeIcons = @{}

Get-ChildItem -Path $srcPath -Include "*.tsx","*.ts" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match "from\s+'@mattermost/compass-icons/components'") {
        # Extract icon names from imports like: import {SendIcon, CloseIcon} from '...'
        if ($content -match "import\s*\{([^}]+)\}\s*from\s+'@mattermost/compass-icons/components'") {
            $icons = $matches[1] -split ',' | ForEach-Object { $_.Trim() -replace 'Icon$','' }
            foreach ($icon in $icons) {
                if ($icon -and $icon -ne "glyphMap" -and $icon -notmatch "^type\s") {
                    $activeIcons[$icon] = $true
                }
            }
        }
    }
    # Also check direct imports like: import SendIcon from '@mattermost/compass-icons/components/send'
    $directImports = [regex]::Matches($content, "from\s+'@mattermost/compass-icons/components/([^']+)'")
    foreach ($match in $directImports) {
        $iconName = $match.Groups[1].Value
        $activeIcons[$iconName] = $true
    }
}

Write-Status "Found $($activeIcons.Count) actively used compass-icons"

# =============================================================================
# 2. EXTRACT COMPASS ICONS FROM JS COMPONENTS
# =============================================================================
Write-Host ""
Write-Host "[2/5] Extracting compass-icons (322 total)..." -ForegroundColor Yellow

$compassDir = "webapp\node_modules\@mattermost\compass-icons\components"
$allCount = 0
$activeCount = 0

if (Test-Path $compassDir) {
    $jsFiles = Get-ChildItem "$compassDir\*.js" -ErrorAction SilentlyContinue

    foreach ($js in $jsFiles) {
        $content = Get-Content $js.FullName -Raw
        $baseName = $js.BaseName

        # Skip index and props files
        if ($baseName -eq "index" -or $baseName -eq "props") { continue }

        # Extract SVG path data from the JS component
        # Pattern: path: { d: "M..." }  or  createElement("path", { d: "M..." })
        $paths = [regex]::Matches($content, 'd:\s*"([^"]+)"')

        if ($paths.Count -gt 0) {
            # Build SVG content
            $pathElements = ""
            foreach ($pathMatch in $paths) {
                $pathD = $pathMatch.Groups[1].Value
                $pathElements += "  <path d=`"$pathD`"/>`n"
            }

            $svgContent = @"
<?xml version="1.0" encoding="UTF-8"?>
<!-- Source: @mattermost/compass-icons/components/$baseName.js -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
$pathElements</svg>
"@

            # Save to ALL folder
            $outPath = "$OutputDir\02-compass-icons-ALL\$baseName.svg"
            $svgContent | Out-File -FilePath $outPath -Encoding UTF8
            $allCount++

            # Check if this icon is actively used
            $iconVariants = @(
                $baseName,
                ($baseName -replace '-',''),
                (($baseName -split '-' | ForEach-Object { (Get-Culture).TextInfo.ToTitleCase($_) }) -join '')
            )

            $isActive = $false
            foreach ($variant in $iconVariants) {
                if ($activeIcons.ContainsKey($variant)) {
                    $isActive = $true
                    break
                }
            }

            if ($isActive) {
                Copy-Item $outPath "$OutputDir\01-compass-icons-ACTIVE\"
                $activeCount++
            }
        }
    }

    Write-Success "Extracted $allCount compass-icons ($activeCount actively used)"
} else {
    Write-Warn "Compass icons not found - run 'npm install' in webapp/"
}

# =============================================================================
# 3. WIDGET ICON COMPONENTS (TSX -> SVG)
# =============================================================================
Write-Host ""
Write-Host "[3/5] Extracting widget icon components..." -ForegroundColor Yellow

$widgetIconsDir = "webapp\channels\src\components\widgets\icons"
$widgetCount = 0

if (Test-Path $widgetIconsDir) {
    $tsxFiles = Get-ChildItem "$widgetIconsDir\*.tsx" -ErrorAction SilentlyContinue

    $statusPatterns = @("status_away", "status_dnd", "status_offline", "status_online")
    $brandPatterns = @("mattermost", "gitlab", "google", "openid", "giphy", "entra")
    $uiPatterns = @("close", "check", "arrow", "menu", "search", "reply", "pin", "flag", "scroll", "unread", "dropdown", "toggle", "back", "next", "previous")

    foreach ($tsx in $tsxFiles) {
        $content = Get-Content $tsx.FullName -Raw
        $baseName = $tsx.BaseName

        if ($baseName -eq "index") { continue }

        if ($content -match '(?s)<svg[^>]*>(.*?)</svg>') {
            $svgMatch = $matches[0]

            $svgClean = $svgMatch `
                -replace 'className=\{[^}]+\}', '' `
                -replace "className='[^']*'", '' `
                -replace 'className="[^"]*"', '' `
                -replace 'style=\{[^}]+\}', '' `
                -replace '\{[^}]*\}', '' `
                -replace 'fillRule', 'fill-rule' `
                -replace 'clipRule', 'clip-rule' `
                -replace 'strokeWidth', 'stroke-width' `
                -replace 'strokeLinecap', 'stroke-linecap' `
                -replace 'strokeLinejoin', 'stroke-linejoin'

            $category = "misc"
            foreach ($p in $statusPatterns) { if ($baseName -like "*$p*") { $category = "status"; break } }
            if ($category -eq "misc") { foreach ($p in $brandPatterns) { if ($baseName -like "*$p*") { $category = "brand"; break } } }
            if ($category -eq "misc") { foreach ($p in $uiPatterns) { if ($baseName -like "*$p*") { $category = "ui-controls"; break } } }

            $svgContent = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<!-- Source: widgets/icons/$baseName.tsx -->`n$svgClean"
            $outPath = "$OutputDir\03-widget-icons\$category\$baseName.svg"
            $svgContent | Out-File -FilePath $outPath -Encoding UTF8
            $widgetCount++
        }
    }
}

Write-Success "Extracted $widgetCount widget icons"

# =============================================================================
# 4. STATIC SVG FILES
# =============================================================================
Write-Host ""
Write-Host "[4/5] Copying static SVG files..." -ForegroundColor Yellow

$staticSvgRoot = "webapp\channels\src\images"
$staticCount = 0

# Browser icons
Get-ChildItem "$staticSvgRoot\browser-icons\*.svg" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$OutputDir\04-static-svgs\browser-icons\"
    $staticCount++
}

# File type icons
Get-ChildItem "$staticSvgRoot\icons\*.svg" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$OutputDir\04-static-svgs\file-type-icons\"
    $staticCount++
}

# Misc SVGs
Get-ChildItem "$staticSvgRoot\*.svg" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$OutputDir\04-static-svgs\misc\"
    $staticCount++
}

# OpenID SVGs
Get-ChildItem "$staticSvgRoot\openid-convert\*.svg" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$OutputDir\04-static-svgs\misc\"
    $staticCount++
}

Write-Success "Copied $staticCount static SVGs"

# =============================================================================
# 5. ADMIN CONSOLE FEATURE IMAGES
# =============================================================================
Write-Host ""
Write-Host "[5/5] Extracting admin console SVGs..." -ForegroundColor Yellow

$adminImagesDir = "webapp\channels\src\components\admin_console\feature_discovery\features\images"
$adminCount = 0

if (Test-Path $adminImagesDir) {
    Get-ChildItem "$adminImagesDir\*_svg.tsx" -ErrorAction SilentlyContinue | ForEach-Object {
        $content = Get-Content $_.FullName -Raw
        $baseName = $_.BaseName -replace '_svg$', ''

        if ($content -match '(?s)<svg[^>]*>(.*?)</svg>') {
            $svgMatch = $matches[0]
            $svgClean = $svgMatch `
                -replace 'className=\{[^}]+\}', '' `
                -replace "className='[^']*'", '' `
                -replace 'className="[^"]*"', '' `
                -replace 'style=\{[^}]+\}', '' `
                -replace 'fillRule', 'fill-rule' `
                -replace 'clipRule', 'clip-rule'

            $svgContent = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<!-- Source: admin_console/feature_discovery/$($_.Name) -->`n$svgClean"
            $outPath = "$OutputDir\05-admin-console\$baseName.svg"
            $svgContent | Out-File -FilePath $outPath -Encoding UTF8
            $adminCount++
        }
    }
}

Write-Success "Extracted $adminCount admin console SVGs"

# =============================================================================
# GENERATE ACTIVE ICONS LIST
# =============================================================================
$activeList = ($activeIcons.Keys | Sort-Object) -join "`n"
$activeList | Out-File -FilePath "$OutputDir\01-compass-icons-ACTIVE\_ICON_LIST.txt" -Encoding UTF8

# =============================================================================
# SUMMARY
# =============================================================================
Write-Host ""
Write-Host "=== Extraction Complete ===" -ForegroundColor Magenta

$total = $activeCount + $allCount + $widgetCount + $staticCount + $adminCount

Write-Host ""
Write-Host "SVGs extracted:" -ForegroundColor Cyan
Write-Host "  01-compass-icons-ACTIVE: $activeCount files (icons used in code)"
Write-Host "  02-compass-icons-ALL:    $allCount files (all available)"
Write-Host "  03-widget-icons:         $widgetCount files"
Write-Host "  04-static-svgs:          $staticCount files"
Write-Host "  05-admin-console:        $adminCount files"
Write-Host "  --------------------------------"
Write-Host "  Total unique:            $($activeCount + $widgetCount + $staticCount + $adminCount) files" -ForegroundColor Green

Write-Host ""
Write-Host "Output: $(Resolve-Path $OutputDir)" -ForegroundColor Cyan

# Create README
$readme = @'
# Mattermost SVG Icons

Extracted from Mattermost webapp for icon customization.

## Directory Structure

### 01-compass-icons-ACTIVE/
Icons from @mattermost/compass-icons that are **actively imported** in the source code.
These are the main UI icons (bold, italic, send, close, archive, etc.)
- _ICON_LIST.txt - List of all active icon names

### 02-compass-icons-ALL/
ALL 320+ compass-icons available (most are not used).
Reference: https://materialdesignicons.com

### 03-widget-icons/
Custom SVG icons defined as React components in widgets/icons/.
- status/ - Online, offline, away, DND indicators
- ui-controls/ - Close, check, arrows, etc.
- brand/ - Mattermost, GitLab, Google logos
- misc/ - Other icons

### 04-static-svgs/
Static SVG files used directly.
- browser-icons/ - Chrome, Firefox, Edge, Safari, Windows
- file-type-icons/ - PDF, Word, Excel, audio, video, code
- misc/ - Logo, overlays, tour tips

### 05-admin-console/
Feature discovery illustrations.

## Key Icons for UI Customization

### Text Formatting (01-compass-icons-ACTIVE/)
- format-bold.svg - Bold button
- format-italic.svg - Italic button
- format-strikethrough-variant.svg - Strikethrough
- format-link-variant.svg - Link button
- code-tags.svg - Inline code
- format-list-bulleted.svg - Bullet list
- format-list-numbered.svg - Numbered list
- format-quote-close.svg - Quote block

### Actions
- send.svg - Send message button
- paperclip.svg - Attach file
- emoticon-happy-outline.svg - Emoji picker
- at.svg - Mentions

### Channel/Navigation
- archive-outline.svg - Archive channel
- pin.svg / pin-outline.svg - Pin message
- bell-outline.svg / bell-off-outline.svg - Notifications
- magnify.svg - Search
- cog-outline.svg - Settings
- close.svg / close-circle.svg - Close buttons
- chevron-down.svg / chevron-up.svg - Dropdowns

### Status (03-widget-icons/status/)
- status_online_icon.svg
- status_offline_icon.svg
- status_away_icon.svg
- status_dnd_icon.svg

## How to Customize

1. **Compass Icons** - These are the main target. Edit SVGs in 01-compass-icons-ACTIVE/
2. **To apply changes**, you need to either:
   - Fork @mattermost/compass-icons and point package.json to your fork
   - Or use CSS to hide/replace icons with custom ones
   - Or modify the source TSX files that import these icons

## Original Source Locations

| Folder | Source |
|--------|--------|
| 01/02-compass-icons | webapp/node_modules/@mattermost/compass-icons/components/ |
| 03-widget-icons | webapp/channels/src/components/widgets/icons/ |
| 04-static-svgs | webapp/channels/src/images/ |
| 05-admin-console | webapp/channels/src/components/admin_console/feature_discovery/features/images/ |
'@

$readme | Out-File -FilePath "$OutputDir\README.md" -Encoding UTF8
Write-Host "Created README.md"
Write-Host ""
Write-Host "Done!" -ForegroundColor Green
