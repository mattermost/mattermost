# manage-tests.ps1 - Auto-discovery test management helper
# Usage:
#   ./manage-tests.ps1 scan   - Find uncovered tests (Go files without marker, webapp tests outside centralized folder)
#   ./manage-tests.ps1 mark <file> - Add the marker comment to a Go test file

param(
    [Parameter(Position=0)]
    [string]$Command,

    [Parameter(Position=1)]
    [string]$File
)

$RepoRoot = $PSScriptRoot
$Marker = "// mattermost-extended-test"

# Known directories where our custom Go tests live
$GoTestDirs = @(
    "server/public/model",
    "server/channels/app/platform",
    "server/channels/store/sqlstore",
    "server/channels/api4"
)

$WebappTestDir = "webapp/channels/src/tests/mattermost_extended"

# Custom-only component directories (no upstream test files in these)
# Directories that also contain upstream tests (youtube_video, team_sidebar, etc.)
# are excluded since our custom tests have been moved to tests/mattermost_extended/
$CustomComponentDirs = @(
    "components/video_player",
    "components/video_link_embed",
    "components/channel_settings_modal/icon_libraries",
    "components/admin_console/status_log_dashboard",
    "components/admin_console/error_log_dashboard",
    "components/admin_console/preference_overrides",
    "components/guilded_team_sidebar",
    "components/persistent_rhs",
    "components/dm_list_page",
    "components/enhanced_dm_row"
)

function Scan-GoTests {
    Write-Host "`n=== Go Test Files ===" -ForegroundColor Cyan
    Write-Host ""

    $covered = @()

    foreach ($dir in $GoTestDirs) {
        $fullDir = Join-Path $RepoRoot $dir
        if (-not (Test-Path $fullDir)) { continue }

        $testFiles = Get-ChildItem -Path $fullDir -Filter "*_test.go" -Recurse -ErrorAction SilentlyContinue

        foreach ($tf in $testFiles) {
            $firstLine = Get-Content $tf.FullName -TotalCount 1 -ErrorAction SilentlyContinue
            $relPath = $tf.FullName.Replace($RepoRoot, "").TrimStart("\", "/")

            if ($firstLine -eq $Marker) {
                $covered += $relPath
            }
        }
    }

    Write-Host "Marked custom test files ($($covered.Count)):" -ForegroundColor Green
    foreach ($f in $covered) {
        Write-Host "  + $f"
    }

    if ($covered.Count -eq 0) {
        Write-Host ""
        Write-Host "WARNING: No marked Go test files found!" -ForegroundColor Yellow
        Write-Host "  Use './manage-tests.ps1 mark <file>' to mark custom test files" -ForegroundColor DarkGray
    }

    return 0
}

function Scan-WebappTests {
    Write-Host "`n=== Webapp Test Files ===" -ForegroundColor Cyan
    Write-Host ""

    $centralDir = Join-Path $RepoRoot $WebappTestDir
    $webappSrc = Join-Path $RepoRoot "webapp/channels/src"

    # Count tests in centralized folder
    $centralTests = @()
    if (Test-Path $centralDir) {
        $centralTests = Get-ChildItem -Path $centralDir -Filter "*.test.*" -Recurse -ErrorAction SilentlyContinue
    }

    Write-Host "Tests in centralized folder ($WebappTestDir):" -ForegroundColor Green
    foreach ($t in $centralTests) {
        $relPath = $t.FullName.Replace($RepoRoot, "").TrimStart("\", "/")
        Write-Host "  + $relPath"
    }
    Write-Host "  Total: $($centralTests.Count) files"

    # Find stray test files in custom component directories
    # Skip: snapshot files, known upstream tests (components/*/components/*)
    $strayTests = @()
    $searchDirs = $CustomComponentDirs + @("utils/encryption", "utils/__tests__")

    foreach ($compDir in $searchDirs) {
        $fullDir = Join-Path $webappSrc $compDir
        if (-not (Test-Path $fullDir)) { continue }

        $tests = Get-ChildItem -Path $fullDir -Filter "*.test.*" -Recurse -ErrorAction SilentlyContinue
        foreach ($t in $tests) {
            # Skip snapshot files and subdirectory component tests (upstream pattern)
            if ($t.FullName -match "__snapshots__") { continue }
            if ($t.Directory.Name -eq "components") { continue }

            $relPath = $t.FullName.Replace($RepoRoot, "").TrimStart("\", "/")
            $strayTests += $relPath
        }
    }

    if ($strayTests.Count -gt 0) {
        Write-Host ""
        Write-Host "STRAY TESTS (not in centralized folder):" -ForegroundColor Yellow
        foreach ($f in $strayTests) {
            Write-Host "  - $f" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "  These should be moved to $WebappTestDir/" -ForegroundColor DarkGray
    } else {
        Write-Host ""
        Write-Host "All webapp test files are centralized!" -ForegroundColor Green
    }

    return $strayTests.Count
}

function Add-Marker {
    param([string]$FilePath)

    $fullPath = if ([System.IO.Path]::IsPathRooted($FilePath)) {
        $FilePath
    } else {
        Join-Path $RepoRoot $FilePath
    }

    if (-not (Test-Path $fullPath)) {
        Write-Host "ERROR: File not found: $fullPath" -ForegroundColor Red
        return
    }

    if (-not $fullPath.EndsWith("_test.go")) {
        Write-Host "ERROR: Not a Go test file: $fullPath" -ForegroundColor Red
        return
    }

    $firstLine = Get-Content $fullPath -TotalCount 1
    if ($firstLine -eq $Marker) {
        Write-Host "Already has marker: $FilePath" -ForegroundColor Yellow
        return
    }

    $content = Get-Content $fullPath -Raw
    $newContent = "$Marker`n$content"
    Set-Content -Path $fullPath -Value $newContent -NoNewline

    Write-Host "Added marker to: $FilePath" -ForegroundColor Green
}

# Main
switch ($Command) {
    "scan" {
        Write-Host "Scanning for uncovered tests..." -ForegroundColor White
        $goUncovered = Scan-GoTests
        $webUncovered = Scan-WebappTests

        Write-Host ""
        Write-Host "=== Summary ===" -ForegroundColor Cyan
        if ($goUncovered -eq 0 -and $webUncovered -eq 0) {
            Write-Host "All tests are covered by auto-discovery!" -ForegroundColor Green
        } else {
            Write-Host "Uncovered: $goUncovered Go files, $webUncovered webapp files" -ForegroundColor Yellow
        }
    }

    "mark" {
        if (-not $File) {
            Write-Host "Usage: ./manage-tests.ps1 mark <file>" -ForegroundColor Red
            exit 1
        }
        Add-Marker $File
    }

    default {
        Write-Host "Usage:" -ForegroundColor White
        Write-Host "  ./manage-tests.ps1 scan           - Find uncovered tests"
        Write-Host "  ./manage-tests.ps1 mark <file>    - Add marker to a Go test file"
        Write-Host ""
        Write-Host "Auto-discovery system:" -ForegroundColor Cyan
        Write-Host "  Go tests:    Add '// mattermost-extended-test' as first line"
        Write-Host "  Webapp tests: Place in webapp/channels/src/tests/mattermost_extended/"
    }
}
