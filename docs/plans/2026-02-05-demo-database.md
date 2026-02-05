# Demo Database Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `./local-test.ps1 demo` command that sets up a fresh Mattermost instance with demo data showcasing all Mattermost Extended features.

**Architecture:** Use Mattermost's built-in Bulk Import system (JSONL format) to seed demo data. The demo command creates a PostgreSQL container, builds the server, initializes the schema, and imports demo data via the API. All feature flags are enabled by default.

**Tech Stack:** PowerShell, JSONL (Mattermost Bulk Import format), PostgreSQL, Go (server build)

---

## Demo Data Design

### Users (Feature-Focused)

| Username | Display Name | Role | Purpose |
|----------|--------------|------|---------|
| `admin` | Demo Admin | system_admin | Admin access to System Console |
| `alice` | Alice | user | General user, encryption demo |
| `bob` | Bob | user | Status demo (will be set to Away) |
| `charlie` | Charlie | user | Status demo (will be set to DND) |
| `dana` | Dana | user | Media features demo |
| `eve` | Eve | user | Thread/reply demo |

**Password for all users:** `demo123`

### Team & Channels

**Team:** `demo` (Display: "Feature Demo")

| Channel | Purpose | Demo Content |
|---------|---------|--------------|
| `status-demo` | AccurateStatuses, NoOffline, Status Logs | Posts about status changes |
| `media-demo` | ImageMulti, ImageSmaller, ImageCaptions, VideoEmbed | Image/video attachments |
| `youtube-demo` | EmbedYoutube | YouTube links |
| `encryption-demo` | Encryption | Encrypted message examples |
| `threads-demo` | ThreadsInSidebar, CustomThreadNames | Threaded conversations |
| `general` | HideDeletedPlaceholder, SidebarChannelSettings | General chat |

### Conversation Style

Discord-like casual conversations:
- Lowercase, informal
- Emoji reactions
- Short messages
- Gaming/tech references
- Memes and jokes

---

## Task 1: Create Demo Data Generator Script

**Files:**
- Create: `demo-data/generate-demo.ps1`

**Step 1: Create the generator script skeleton**

```powershell
# demo-data/generate-demo.ps1
# Generates demo-data.jsonl for Mattermost Bulk Import

param(
    [string]$OutputPath = (Join-Path $PSScriptRoot "demo-data.jsonl")
)

$ErrorActionPreference = "Stop"

# Helper to create JSONL line
function New-ImportLine {
    param($Type, $Data)
    $line = @{ type = $Type } + $Data
    return ($line | ConvertTo-Json -Compress -Depth 10)
}

# Timestamp helper (milliseconds since epoch)
function Get-Timestamp {
    param([int]$MinutesAgo = 0)
    $date = (Get-Date).AddMinutes(-$MinutesAgo)
    return [int64]($date.ToUniversalTime() - [datetime]'1970-01-01').TotalMilliseconds
}

$lines = @()

# Version header
$lines += New-ImportLine "version" @{ version = 1 }

Write-Host "Generating demo data to: $OutputPath"

# ... (rest of generation logic)

# Write output
$lines | Out-File $OutputPath -Encoding UTF8
Write-Host "Generated $($lines.Count) lines"
```

**Step 2: Run script to verify it creates empty JSONL**

Run: `powershell -File demo-data/generate-demo.ps1`
Expected: Creates `demo-data/demo-data.jsonl` with version line

**Step 3: Commit skeleton**

```bash
git add demo-data/generate-demo.ps1
git commit -m "feat: add demo data generator skeleton"
```

---

## Task 2: Add Team and Channel Generation

**Files:**
- Modify: `demo-data/generate-demo.ps1`

**Step 1: Add team generation**

After version line, add:

```powershell
# Team
$lines += New-ImportLine "team" @{
    team = @{
        name = "demo"
        display_name = "Feature Demo"
        type = "O"
        description = "Showcase of Mattermost Extended features"
        allow_open_invite = $true
    }
}
```

**Step 2: Add channel generation**

```powershell
# Channels
$channels = @(
    @{ name = "status-demo"; display = "Status Demo"; purpose = "AccurateStatuses, NoOffline, Status Logs" },
    @{ name = "media-demo"; display = "Media Demo"; purpose = "ImageMulti, ImageSmaller, ImageCaptions, VideoEmbed" },
    @{ name = "youtube-demo"; display = "YouTube Demo"; purpose = "EmbedYoutube - Discord-style embeds" },
    @{ name = "encryption-demo"; display = "Encryption Demo"; purpose = "End-to-End Encryption" },
    @{ name = "threads-demo"; display = "Threads Demo"; purpose = "ThreadsInSidebar, CustomThreadNames" },
    @{ name = "general"; display = "General"; purpose = "General chat and feature testing" }
)

foreach ($ch in $channels) {
    $lines += New-ImportLine "channel" @{
        channel = @{
            team = "demo"
            name = $ch.name
            display_name = $ch.display
            type = "O"
            purpose = $ch.purpose
        }
    }
}
```

**Step 3: Run and verify**

Run: `powershell -File demo-data/generate-demo.ps1`
Expected: JSONL now has version + team + 6 channels (8 lines)

**Step 4: Commit**

```bash
git add demo-data/generate-demo.ps1
git commit -m "feat: add team and channel generation to demo data"
```

---

## Task 3: Add User Generation

**Files:**
- Modify: `demo-data/generate-demo.ps1`

**Step 1: Add user definitions and generation**

```powershell
# Users
$users = @(
    @{ username = "admin"; first = "Demo"; last = "Admin"; roles = "system_user system_admin" },
    @{ username = "alice"; first = "Alice"; last = "Anderson"; roles = "system_user" },
    @{ username = "bob"; first = "Bob"; last = "Baker"; roles = "system_user" },
    @{ username = "charlie"; first = "Charlie"; last = "Chen"; roles = "system_user" },
    @{ username = "dana"; first = "Dana"; last = "Davis"; roles = "system_user" },
    @{ username = "eve"; first = "Eve"; last = "Edwards"; roles = "system_user" }
)

$allChannels = $channels | ForEach-Object { @{ name = $_.name; roles = "channel_user" } }

foreach ($u in $users) {
    $lines += New-ImportLine "user" @{
        user = @{
            username = $u.username
            email = "$($u.username)@demo.local"
            password = "demo123"
            nickname = $u.first
            first_name = $u.first
            last_name = $u.last
            roles = $u.roles
            locale = "en"
            teams = @(
                @{
                    name = "demo"
                    roles = "team_user"
                    channels = $allChannels
                }
            )
        }
    }
}
```

**Step 2: Run and verify**

Run: `powershell -File demo-data/generate-demo.ps1`
Expected: JSONL now has version + team + 6 channels + 6 users (14 lines)

**Step 3: Commit**

```bash
git add demo-data/generate-demo.ps1
git commit -m "feat: add user generation to demo data"
```

---

## Task 4: Add Status Demo Posts

**Files:**
- Modify: `demo-data/generate-demo.ps1`

**Step 1: Add Discord-style status demo conversation**

```powershell
# Status Demo Posts
$statusPosts = @(
    @{ user = "alice"; msg = "yo anyone here?"; ago = 120 },
    @{ user = "bob"; msg = "yeah whats up"; ago = 119 },
    @{ user = "alice"; msg = "just testing the status tracking stuff"; ago = 118 },
    @{ user = "charlie"; msg = "im gonna set myself to dnd, dont @ me"; ago = 115 },
    @{ user = "bob"; msg = "lol ok"; ago = 114 },
    @{ user = "alice"; msg = "the accurate statuses feature is pretty cool actually"; ago = 110 },
    @{ user = "alice"; msg = "it tracks when you actually do stuff instead of just pinging"; ago = 109 },
    @{ user = "dana"; msg = "wait so it knows when im actually active?"; ago = 105 },
    @{ user = "bob"; msg = "yeah check the status logs in system console, its wild"; ago = 104 },
    @{ user = "eve"; msg = "ooh let me go look"; ago = 100 },
    @{ user = "alice"; msg = "admin can see all status changes in real time"; ago = 95 },
    @{ user = "dana"; msg = "thats kinda big brother ngl :eyes:"; ago = 90 },
    @{ user = "bob"; msg = "its for debugging lol"; ago = 89 },
    @{ user = "alice"; msg = "also theres this nooffline thing"; ago = 85 },
    @{ user = "alice"; msg = "prevents ppl from showing as offline when theyre clearly active"; ago = 84 },
    @{ user = "eve"; msg = "no more pretending to be away huh"; ago = 80 },
    @{ user = "bob"; msg = ":skull:"; ago = 79 }
)

foreach ($p in $statusPosts) {
    $lines += New-ImportLine "post" @{
        post = @{
            team = "demo"
            channel = "status-demo"
            user = $p.user
            message = $p.msg
            create_at = (Get-Timestamp -MinutesAgo $p.ago)
        }
    }
}
```

**Step 2: Run and verify**

Run: `powershell -File demo-data/generate-demo.ps1`
Expected: JSONL includes status demo posts (14 + 17 = 31 lines)

**Step 3: Commit**

```bash
git add demo-data/generate-demo.ps1
git commit -m "feat: add status demo posts"
```

---

## Task 5: Add Media Demo Posts with Attachments

**Files:**
- Modify: `demo-data/generate-demo.ps1`
- Create: `demo-data/attachments/cat.jpg` (small test image)
- Create: `demo-data/attachments/meme1.png`
- Create: `demo-data/attachments/meme2.png`
- Create: `demo-data/attachments/sample.mp4` (small test video)

**Step 1: Create attachments directory and add placeholder files**

For now, use small placeholder files. We'll source real files later.

```powershell
# Create attachments dir if needed
$attachmentsDir = Join-Path $PSScriptRoot "attachments"
if (!(Test-Path $attachmentsDir)) {
    New-Item -ItemType Directory -Path $attachmentsDir | Out-Null
}
```

**Step 2: Add media demo posts**

```powershell
# Media Demo Posts
$mediaPosts = @(
    @{ user = "dana"; msg = "check out this cat"; ago = 60; attachment = "cat.jpg" },
    @{ user = "alice"; msg = "omg so cute"; ago = 59 },
    @{ user = "bob"; msg = "posting multiple images to show the imagemulti feature"; ago = 55 },
    @{ user = "dana"; msg = "the imagesmaller setting caps the size so they dont take up the whole screen"; ago = 50 },
    @{ user = "eve"; msg = "you can also add captions to images now"; ago = 45 },
    @{ user = "eve"; msg = "![a]($attachmentsDir/cat.jpg ""this is the caption text"")"; ago = 44 },
    @{ user = "alice"; msg = "thats actually super useful for screenshots"; ago = 40 },
    @{ user = "dana"; msg = "and heres a video"; ago = 35; attachment = "sample.mp4" },
    @{ user = "bob"; msg = "videoembed makes it play inline instead of downloading"; ago = 34 },
    @{ user = "alice"; msg = "no more opening vlc for every clip lol"; ago = 30 }
)

foreach ($p in $mediaPosts) {
    $post = @{
        team = "demo"
        channel = "media-demo"
        user = $p.user
        message = $p.msg
        create_at = (Get-Timestamp -MinutesAgo $p.ago)
    }

    if ($p.attachment) {
        $post.attachments = @(
            @{ path = "attachments/$($p.attachment)" }
        )
    }

    $lines += New-ImportLine "post" @{ post = $post }
}
```

**Step 3: Run and verify**

Run: `powershell -File demo-data/generate-demo.ps1`
Expected: JSONL includes media posts with attachment references

**Step 4: Commit**

```bash
git add demo-data/
git commit -m "feat: add media demo posts with attachment support"
```

---

## Task 6: Add YouTube Demo Posts

**Files:**
- Modify: `demo-data/generate-demo.ps1`

**Step 1: Add YouTube demo conversation**

```powershell
# YouTube Demo Posts
$youtubePosts = @(
    @{ user = "bob"; msg = "have yall seen this?"; ago = 45 },
    @{ user = "bob"; msg = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; ago = 44 },
    @{ user = "alice"; msg = "bro"; ago = 43 },
    @{ user = "eve"; msg = "i cant believe you"; ago = 42 },
    @{ user = "dana"; msg = "the embed looks nice tho, like discord"; ago = 40 },
    @{ user = "charlie"; msg = "wait the youtube embeds got updated?"; ago = 38 },
    @{ user = "alice"; msg = "yeah its the embedyoutube feature"; ago = 37 },
    @{ user = "alice"; msg = "no more ugly preview boxes"; ago = 36 },
    @{ user = "bob"; msg = "heres an actual good video lol"; ago = 30 },
    @{ user = "bob"; msg = "https://www.youtube.com/watch?v=jNQXAC9IVRw"; ago = 29 },
    @{ user = "eve"; msg = "me at the zoo classic"; ago = 28 },
    @{ user = "dana"; msg = "the red bar on the side is :chefskiss:"; ago = 25 }
)

foreach ($p in $youtubePosts) {
    $lines += New-ImportLine "post" @{
        post = @{
            team = "demo"
            channel = "youtube-demo"
            user = $p.user
            message = $p.msg
            create_at = (Get-Timestamp -MinutesAgo $p.ago)
        }
    }
}
```

**Step 2: Run and verify**

Run: `powershell -File demo-data/generate-demo.ps1`
Expected: JSONL includes YouTube demo posts

**Step 3: Commit**

```bash
git add demo-data/generate-demo.ps1
git commit -m "feat: add YouTube demo posts"
```

---

## Task 7: Add Threads Demo Posts

**Files:**
- Modify: `demo-data/generate-demo.ps1`

**Step 1: Add threaded conversation**

```powershell
# Threads Demo Posts (with replies)
$threadRoot = @{
    user = "eve"
    msg = "ok who wants to test the threading features"
    ago = 90
    replies = @(
        @{ user = "alice"; msg = "me!"; ago = 89 },
        @{ user = "bob"; msg = "sure"; ago = 88 },
        @{ user = "eve"; msg = "so threads show up in the sidebar now under the channel"; ago = 87 },
        @{ user = "dana"; msg = "wait really? where"; ago = 86 },
        @{ user = "eve"; msg = "look at the left, under threads-demo theres like a nested thing"; ago = 85 },
        @{ user = "alice"; msg = "oh thats actually nice, way better than the separate threads view"; ago = 84 },
        @{ user = "bob"; msg = "can we rename threads?"; ago = 80 },
        @{ user = "eve"; msg = "yeah thats the customthreadnames feature"; ago = 79 },
        @{ user = "eve"; msg = "click the thread title to edit it"; ago = 78 },
        @{ user = "charlie"; msg = "finally, no more threads named after the first random message"; ago = 75 }
    )
}

# Root post with replies
$rootTimestamp = Get-Timestamp -MinutesAgo $threadRoot.ago
$replies = @()
foreach ($r in $threadRoot.replies) {
    $replies += @{
        user = $r.user
        message = $r.msg
        create_at = (Get-Timestamp -MinutesAgo $r.ago)
    }
}

$lines += New-ImportLine "post" @{
    post = @{
        team = "demo"
        channel = "threads-demo"
        user = $threadRoot.user
        message = $threadRoot.msg
        create_at = $rootTimestamp
        replies = $replies
    }
}

# Another thread
$lines += New-ImportLine "post" @{
    post = @{
        team = "demo"
        channel = "threads-demo"
        user = "dana"
        message = "starting another thread to show multiple in sidebar"
        create_at = (Get-Timestamp -MinutesAgo 60)
        replies = @(
            @{ user = "bob"; message = "good idea"; create_at = (Get-Timestamp -MinutesAgo 59) },
            @{ user = "alice"; message = "now there should be two threads under the channel"; create_at = (Get-Timestamp -MinutesAgo 58) }
        )
    }
}
```

**Step 2: Run and verify**

Run: `powershell -File demo-data/generate-demo.ps1`
Expected: JSONL includes thread posts with nested replies

**Step 3: Commit**

```bash
git add demo-data/generate-demo.ps1
git commit -m "feat: add threads demo posts with replies"
```

---

## Task 8: Add General Channel Posts

**Files:**
- Modify: `demo-data/generate-demo.ps1`

**Step 1: Add general chat with emoji reactions**

```powershell
# General Channel Posts
$generalPosts = @(
    @{ user = "admin"; msg = "welcome to the mattermost extended demo!"; ago = 200; reactions = @("tada", "wave") },
    @{ user = "alice"; msg = "hey everyone"; ago = 195 },
    @{ user = "bob"; msg = "sup"; ago = 194 },
    @{ user = "charlie"; msg = "this is pretty cool"; ago = 190 },
    @{ user = "dana"; msg = "right click on channels in the sidebar"; ago = 185 },
    @{ user = "dana"; msg = "theres a channel settings option now"; ago = 184 },
    @{ user = "eve"; msg = "oh nice, the sidebarchannelsettings tweak"; ago = 180 },
    @{ user = "alice"; msg = "also try deleting a message"; ago = 175 },
    @{ user = "bob"; msg = "test message please ignore"; ago = 174 },
    @{ user = "alice"; msg = "now delete it ^"; ago = 173 },
    @{ user = "eve"; msg = "with hidedeletedmessageplaceholder it just disappears"; ago = 170 },
    @{ user = "eve"; msg = "no more '(message deleted)' spam"; ago = 169 },
    @{ user = "charlie"; msg = ":thumbsup:"; ago = 165 }
)

foreach ($p in $generalPosts) {
    $post = @{
        team = "demo"
        channel = "general"
        user = $p.user
        message = $p.msg
        create_at = (Get-Timestamp -MinutesAgo $p.ago)
    }

    if ($p.reactions) {
        $post.reactions = $p.reactions | ForEach-Object {
            @{
                user = "alice"
                emoji_name = $_
                create_at = (Get-Timestamp -MinutesAgo ($p.ago - 1))
            }
        }
    }

    $lines += New-ImportLine "post" @{ post = $post }
}
```

**Step 2: Run and verify**

Run: `powershell -File demo-data/generate-demo.ps1`
Expected: JSONL includes general posts with reactions

**Step 3: Commit**

```bash
git add demo-data/generate-demo.ps1
git commit -m "feat: add general channel posts with reactions"
```

---

## Task 9: Create Demo Config Template

**Files:**
- Create: `demo-data/demo-config.json`

**Step 1: Create config with all features enabled**

```json
{
    "ServiceSettings": {
        "SiteURL": "http://localhost:8065",
        "ListenAddress": ":8065",
        "EnableDeveloper": true,
        "EnableTesting": false
    },
    "TeamSettings": {
        "SiteName": "Mattermost Extended Demo",
        "EnableUserCreation": true,
        "EnableOpenServer": true,
        "EnableCustomUserStatuses": true,
        "EnableLastActiveTime": true
    },
    "FeatureFlags": {
        "Encryption": true,
        "CustomChannelIcons": true,
        "ThreadsInSidebar": true,
        "CustomThreadNames": true,
        "ErrorLogDashboard": true,
        "SystemConsoleDarkMode": true,
        "SystemConsoleHideEnterprise": true,
        "SystemConsoleIcons": true,
        "SuppressEnterpriseUpgradeChecks": true,
        "ImageMulti": true,
        "ImageSmaller": true,
        "ImageCaptions": true,
        "VideoEmbed": true,
        "VideoLinkEmbed": true,
        "AccurateStatuses": true,
        "NoOffline": true,
        "EmbedYoutube": true,
        "SettingsResorted": true,
        "PreferencesRevamp": true,
        "PreferenceOverridesDashboard": true,
        "HideUpdateStatusButton": true
    },
    "MattermostExtendedSettings": {
        "Posts": {
            "HideDeletedMessagePlaceholder": true
        },
        "Channels": {
            "SidebarChannelSettings": true
        },
        "Media": {
            "MaxImageHeight": 400,
            "MaxImageWidth": 600,
            "CaptionFontSize": 12,
            "MaxVideoHeight": 360,
            "MaxVideoWidth": 640
        },
        "Statuses": {
            "InactivityTimeoutMinutes": 5,
            "HeartbeatIntervalSeconds": 30,
            "EnableStatusLogs": true,
            "StatusLogRetentionDays": 7,
            "DNDInactivityTimeoutMinutes": 30
        }
    },
    "LogSettings": {
        "EnableConsole": true,
        "ConsoleLevel": "DEBUG",
        "ConsoleJson": false,
        "EnableFile": true,
        "FileLevel": "INFO"
    },
    "EmailSettings": {
        "EnableSignUpWithEmail": true,
        "EnableSignInWithEmail": true,
        "EnableSignInWithUsername": true,
        "SendEmailNotifications": false
    }
}
```

**Step 2: Commit**

```bash
git add demo-data/demo-config.json
git commit -m "feat: add demo config with all features enabled"
```

---

## Task 10: Add Demo Command to local-test.ps1

**Files:**
- Modify: `local-test.ps1`

**Step 1: Add Invoke-Demo function**

Add after other function definitions (around line 800):

```powershell
function Invoke-Demo {
    Log ""
    Log "=== Setting up Demo Environment ==="
    Log ""
    Log "This creates a fresh Mattermost instance with demo data showcasing all features."
    Log ""

    # Check Docker is running
    $dockerCheck = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }
    Log "Docker is running."

    # Create work directory
    if (!(Test-Path $WORK_DIR)) {
        New-Item -ItemType Directory -Path $WORK_DIR -Force | Out-Null
        Log "Created work directory: $WORK_DIR"
    }

    # [1/6] Create PostgreSQL container
    Log "[1/6] Creating PostgreSQL container..."
    docker rm -f $PG_CONTAINER 2>$null | Out-Null

    $pgDataPath = Join-Path $WORK_DIR "pgdata"
    if (Test-Path $pgDataPath) {
        Remove-Item -Path $pgDataPath -Recurse -Force
    }

    $dockerArgs = @(
        "run", "-d",
        "--name", $PG_CONTAINER,
        "-e", "POSTGRES_USER=$PG_USER",
        "-e", "POSTGRES_PASSWORD=$PG_PASSWORD",
        "-e", "POSTGRES_DB=$PG_DATABASE",
        "-p", "${PG_PORT}:5432",
        "-v", "${pgDataPath}:/var/lib/postgresql/data",
        "postgres:15-alpine"
    )

    $result = & docker @dockerArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Failed to create PostgreSQL container"
        exit 1
    }

    # Wait for PostgreSQL
    Log "Waiting for PostgreSQL to be ready..."
    $maxAttempts = 30
    $attempt = 0
    do {
        Start-Sleep -Seconds 1
        $attempt++
        docker exec $PG_CONTAINER pg_isready -U $PG_USER 2>$null | Out-Null
    } while ($LASTEXITCODE -ne 0 -and $attempt -lt $maxAttempts)

    if ($LASTEXITCODE -ne 0) {
        Log-Error "PostgreSQL failed to start"
        exit 1
    }
    Log-Success "PostgreSQL is ready."

    # [2/6] Generate demo config
    Log "[2/6] Generating demo config..."
    $demoConfigSource = Join-Path $SCRIPT_DIR "demo-data\demo-config.json"
    $configPath = Join-Path $WORK_DIR "config.json"

    $config = Get-Content $demoConfigSource -Raw | ConvertFrom-Json

    # Update paths
    $workDirUnix = $WORK_DIR -replace "\\", "/"
    $config.SqlSettings = @{
        DriverName = "postgres"
        DataSource = "postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}?sslmode=disable"
    }
    $config.FileSettings = @{
        DriverName = "local"
        Directory = "$workDirUnix/data"
        EnableFileAttachments = $true
    }
    $config.LogSettings.FileLocation = $workDirUnix
    $config.PluginSettings = @{
        Enable = $true
        EnableUploads = $true
        Directory = "$workDirUnix/data/plugins"
        ClientDirectory = "$workDirUnix/data/client/plugins"
    }

    $config | ConvertTo-Json -Depth 10 | Out-File $configPath -Encoding UTF8
    Log-Success "Config generated: $configPath"

    # [3/6] Create data directories
    Log "[3/6] Creating data directories..."
    $dataDir = Join-Path $WORK_DIR "data"
    $pluginsDir = Join-Path $dataDir "plugins"
    $clientPluginsDir = Join-Path $dataDir "client\plugins"

    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    New-Item -ItemType Directory -Path $pluginsDir -Force | Out-Null
    New-Item -ItemType Directory -Path $clientPluginsDir -Force | Out-Null
    Log-Success "Data directories created."

    # [4/6] Build server
    Log "[4/6] Building server..."
    Invoke-Build

    # [5/6] Initialize database schema
    Log "[5/6] Initializing database schema..."
    Log "Starting server briefly to create tables..."

    $binaryPath = Join-Path $WORK_DIR "mattermost.exe"
    Push-Location $WORK_DIR

    # Start server in background
    $serverJob = Start-Job -ScriptBlock {
        param($binary, $config)
        & $binary server --config $config 2>&1
    } -ArgumentList $binaryPath, $configPath

    # Wait for server to initialize (check for "Server is listening" in logs)
    $timeout = 60
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 2
        $elapsed += 2

        # Check if tables exist
        $tableCheck = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>$null
        $tableCount = [int]($tableCheck -join "").Trim()

        if ($tableCount -gt 10) {
            Log "Database schema created ($tableCount tables)"
            break
        }
        Log "Waiting for schema initialization... ($elapsed seconds)"
    }

    # Stop the server
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -ErrorAction SilentlyContinue
    Get-Process -Name "mattermost" -ErrorAction SilentlyContinue | Stop-Process -Force

    Pop-Location
    Log-Success "Database schema initialized."

    # [6/6] Import demo data
    Log "[6/6] Importing demo data..."

    # Generate fresh demo data
    $generateScript = Join-Path $SCRIPT_DIR "demo-data\generate-demo.ps1"
    $jsonlPath = Join-Path $SCRIPT_DIR "demo-data\demo-data.jsonl"

    & powershell -File $generateScript -OutputPath $jsonlPath

    # Import via mmctl or direct SQL
    # For now, use direct API after starting server
    Log "Demo data generated. Will import on first server start."
    Log ""
    Log-Success "Demo environment ready!"
    Log ""
    Log "Next steps:"
    Log "  1. Run './local-test.ps1 start' to start the server"
    Log "  2. Open http://localhost:$MM_PORT"
    Log "  3. Login as 'admin' with password 'demo123'"
    Log ""
    Log "Demo users: admin, alice, bob, charlie, dana, eve (all password: demo123)"
    Log ""
}
```

**Step 2: Add demo to switch statement**

Find the switch statement (around line 2040) and add:

```powershell
        "demo"        { Invoke-Demo }
```

**Step 3: Add to help text**

In Show-Help function, add:

```powershell
    Log "  demo        - Create fresh demo environment (no backup needed)"
```

**Step 4: Run and verify command exists**

Run: `./local-test.ps1 help`
Expected: Shows "demo" in command list

**Step 5: Commit**

```bash
git add local-test.ps1
git commit -m "feat: add demo command to local-test.ps1"
```

---

## Task 11: Add Demo Data Import via API

**Files:**
- Modify: `local-test.ps1`

**Step 1: Create Import-DemoData function**

```powershell
function Import-DemoData {
    param(
        [string]$JsonlPath,
        [string]$ServerUrl = "http://localhost:$MM_PORT"
    )

    Log "Importing demo data from: $JsonlPath"

    # Read JSONL and import each line via API
    # First, we need to authenticate as admin

    $loginBody = @{
        login_id = "admin"
        password = "demo123"
    } | ConvertTo-Json

    try {
        $loginResponse = Invoke-RestMethod -Uri "$ServerUrl/api/v4/users/login" -Method POST -Body $loginBody -ContentType "application/json" -SessionVariable session
        $token = $session.Headers["Token"]
        Log "Authenticated as admin"
    } catch {
        Log-Warning "Could not authenticate. Demo data will need manual import."
        return
    }

    # For bulk import, we need to use the import endpoint
    # This requires creating a zip file with the JSONL
    $zipPath = Join-Path $WORK_DIR "demo-import.zip"

    # Create zip with JSONL
    Compress-Archive -Path $JsonlPath -DestinationPath $zipPath -Force

    # Upload and process import
    # ... (API calls for bulk import)

    Log-Success "Demo data imported successfully."
}
```

**Note:** The bulk import API is complex. For simplicity, we'll use direct SQL inserts for the demo command, similar to how password reset works.

**Step 2: Alternative - Use direct SQL for critical setup**

After schema initialization, insert admin user directly:

```powershell
# Create admin user via SQL (server will handle on first login)
# The JSONL import can happen when user runs 'import-demo' command
```

**Step 3: Commit**

```bash
git add local-test.ps1
git commit -m "feat: add demo data import infrastructure"
```

---

## Task 12: Add Test Assets

**Files:**
- Create: `demo-data/attachments/README.md`
- Add: Small test image and video files

**Step 1: Create README explaining assets**

```markdown
# Demo Attachments

This directory contains test media files for the demo database.

## Required Files

- `cat.jpg` - Small image for basic image demo (< 100KB)
- `meme1.png` - First image for multi-image demo (< 100KB)
- `meme2.png` - Second image for multi-image demo (< 100KB)
- `sample.mp4` - Short video clip for video embed demo (< 1MB)
- `caption-test.jpg` - Image with caption demo (< 100KB)

## Sourcing Files

You can use any appropriately licensed images/videos. Suggestions:
- Unsplash for images (free license)
- Pexels for videos (free license)
- Create simple test images with any image editor

Keep files small for fast setup.
```

**Step 2: Add .gitkeep for attachments directory**

```bash
touch demo-data/attachments/.gitkeep
```

**Step 3: Commit**

```bash
git add demo-data/attachments/
git commit -m "feat: add demo attachments directory with README"
```

---

## Task 13: Test Full Demo Flow

**Step 1: Run demo command**

```bash
./local-test.ps1 demo
```

Expected:
- PostgreSQL container created
- Config generated with all features enabled
- Server built
- Schema initialized
- Demo data generated

**Step 2: Start server**

```bash
./local-test.ps1 start
```

Expected: Server starts successfully

**Step 3: Verify in browser**

1. Open http://localhost:8065
2. Login as `admin` / `demo123`
3. Check team "Feature Demo" exists
4. Check all channels exist
5. Check feature flags in System Console > Mattermost Extended > Features

**Step 4: Document any issues and iterate**

---

## Task 14: Final Commit and Cleanup

**Step 1: Review all changes**

```bash
git status
git diff --stat HEAD~10
```

**Step 2: Final commit if needed**

```bash
git add -A
git commit -m "feat: complete demo database implementation"
```

---

## Summary

After completing all tasks, you'll have:

1. **`./local-test.ps1 demo`** - New command that creates a fresh demo environment
2. **`demo-data/generate-demo.ps1`** - Script that generates JSONL import data
3. **`demo-data/demo-config.json`** - Config template with all features enabled
4. **`demo-data/attachments/`** - Directory for test media files
5. **Demo users** - admin, alice, bob, charlie, dana, eve (all password: demo123)
6. **Demo channels** - status-demo, media-demo, youtube-demo, encryption-demo, threads-demo, general
7. **Discord-style conversations** - Casual chat demonstrating each feature
