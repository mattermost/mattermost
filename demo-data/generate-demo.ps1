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

Write-Host "Generating demo data..."

# Version header
$lines += New-ImportLine "version" @{ version = 1 }

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

# Channels
$channels = @(
    @{ name = "general"; display = "General"; purpose = "General chat and feature testing" },
    @{ name = "status-demo"; display = "Status Demo"; purpose = "AccurateStatuses, NoOffline, Status Logs" },
    @{ name = "media-demo"; display = "Media Demo"; purpose = "ImageMulti, ImageSmaller, ImageCaptions, VideoEmbed" },
    @{ name = "youtube-demo"; display = "YouTube Demo"; purpose = "EmbedYoutube - Discord-style embeds" },
    @{ name = "threads-demo"; display = "Threads Demo"; purpose = "ThreadsInSidebar, CustomThreadNames" },
    @{ name = "encryption-demo"; display = "Encryption Demo"; purpose = "End-to-End Encryption" }
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

# ============================================================================
# DEMO CONVERSATIONS (Discord-style casual chat)
# ============================================================================

# General - Welcome & Sidebar Features
$generalPosts = @(
    @{ user = 'admin'; msg = 'welcome everyone to the new server :tada:'; ago = 200 },
    @{ user = 'alice'; msg = 'ayo'; ago = 199 },
    @{ user = 'bob'; msg = 'finally we''re here'; ago = 198 },
    @{ user = 'charlie'; msg = 'this place looks clean'; ago = 197 },
    @{ user = 'dana'; msg = 'glad to be out of the old one lol'; ago = 196 },
    @{ user = 'eve'; msg = 'the old one was so cluttered, this is much better'; ago = 195 },
    @{ user = 'alice'; msg = 'wait where''s the deleted message placeholder? did it actually vanish?'; ago = 194 },
    @{ user = 'admin'; msg = 'yeah enabled HideDeletedPlaceholder. way less ghosting in the chat'; ago = 193 },
    @{ user = 'bob'; msg = 'big W'; ago = 192 },
    @{ user = 'charlie'; msg = 'also noticed the sidebar settings are different now'; ago = 191 },
    @{ user = 'dana'; msg = 'sidebar looks way better with the custom settings, actually readable now'; ago = 190 },
    @{ user = 'eve'; msg = 'true true'; ago = 189 },
    @{ user = 'admin'; msg = 'feel free to test around in the other channels, everything is live'; ago = 188 },
    @{ user = 'alice'; msg = 'bet :fire:'; ago = 187 }
)

foreach ($p in $generalPosts) {
    $lines += New-ImportLine "post" @{
        post = @{
            team = "demo"
            channel = "general"
            user = $p.user
            message = $p.msg
            create_at = (Get-Timestamp -MinutesAgo $p.ago)
        }
    }
}

# Status Demo - Accuracy & Presence
$statusPosts = @(
    @{ user = 'alice'; msg = 'yo charlie why you always online lol'; ago = 180 },
    @{ user = 'charlie'; msg = 'accurate statuses baby. no more "away" while i''m literally typing'; ago = 179 },
    @{ user = 'bob'; msg = 'wait is NoOffline on?'; ago = 178 },
    @{ user = 'alice'; msg = 'yeah admin enabled it'; ago = 177 },
    @{ user = 'bob'; msg = 'sick so we can see who''s actually around even if they try to hide :eyes:'; ago = 176 },
    @{ user = 'dana'; msg = 'status logs are showing everything too'; ago = 175 },
    @{ user = 'eve'; msg = 'wait what logs?'; ago = 174 },
    @{ user = 'dana'; msg = 'the transition logs in the console, helps with debugging the heartbeat'; ago = 173 },
    @{ user = 'charlie'; msg = 'no more fake away status while i''m gaming in the background'; ago = 172 },
    @{ user = 'alice'; msg = 'finally. the old heartbeat was so laggy'; ago = 171 },
    @{ user = 'bob'; msg = 'literally. it would show me away while i was in the middle of a call'; ago = 170 },
    @{ user = 'charlie'; msg = 'same lol'; ago = 169 },
    @{ user = 'admin'; msg = 'testing the new transition manager, seems solid so far'; ago = 168 },
    @{ user = 'alice'; msg = 'huge improvement honestly'; ago = 167 },
    @{ user = 'bob'; msg = 'massive'; ago = 166 }
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

# Media Demo - Images & Video
$mediaPosts = @(
    @{ user = 'alice'; msg = 'check these out, the multi-upload is working'; ago = 155 },
    @{ user = 'bob'; msg = 'wait multiple images in one post? that''s actually huge'; ago = 153 },
    @{ user = 'charlie'; msg = 'they look smaller too, not taking up the whole screen'; ago = 152 },
    @{ user = 'dana'; msg = 'yeah ImageSmaller is a life saver for my vertical monitor'; ago = 151 },
    @{ user = 'eve'; msg = 'the captions look good too'; ago = 150 },
    @{ user = 'alice'; msg = '![test image](cat.jpg "cyberpunk vibes")'; ago = 149 },
    @{ user = 'bob'; msg = 'clean af'; ago = 148 },
    @{ user = 'charlie'; msg = 'does video embedding work yet?'; ago = 147 },
    @{ user = 'dana'; msg = 'let''s see'; ago = 146 },
    @{ user = 'bob'; msg = 'yup it embeds perfectly'; ago = 144 },
    @{ user = 'alice'; msg = 'it''s finally a real chat app lol :fire:'; ago = 143 }
)

foreach ($p in $mediaPosts) {
    $lines += New-ImportLine "post" @{
        post = @{
            team = "demo"
            channel = "media-demo"
            user = $p.user
            message = $p.msg
            create_at = (Get-Timestamp -MinutesAgo $p.ago)
        }
    }
}

# YouTube Demo - Better Embeds
$youtubePosts = @(
    @{ user = 'alice'; msg = 'guys look at this lol'; ago = 135 },
    @{ user = 'alice'; msg = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; ago = 134 },
    @{ user = 'bob'; msg = 'i knew it. i saw the thumbnail and still clicked :skull:'; ago = 133 },
    @{ user = 'charlie'; msg = 'the embed is actually fast now'; ago = 132 },
    @{ user = 'dana'; msg = 'check this out https://www.youtube.com/watch?v=9bZkp7q19f0'; ago = 131 },
    @{ user = 'eve'; msg = 'psy? what year is it lol'; ago = 130 },
    @{ user = 'dana'; msg = 'classic never dies'; ago = 129 },
    @{ user = 'bob'; msg = 'the youtube embed looks way better than the generic one'; ago = 128 },
    @{ user = 'alice'; msg = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; ago = 127 },
    @{ user = 'charlie'; msg = 'first youtube video ever, a classic'; ago = 126 },
    @{ user = 'eve'; msg = 'facts'; ago = 125 }
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

# Threads Demo - Sidebar & Custom Names (with replies)
$thread1Root = @{
    user = 'alice'
    msg = 'starting a thread for the new project planning'
    ago = 120
    replies = @(
        @{ user = 'bob'; msg = 'i''m in'; ago = 119 },
        @{ user = 'charlie'; msg = 'what''s the plan?'; ago = 118 },
        @{ user = 'alice'; msg = 'check the sidebar, it should show up there now'; ago = 117 },
        @{ user = 'dana'; msg = 'oh yeah ThreadsInSidebar is clutch, i can see all of them'; ago = 116 },
        @{ user = 'eve'; msg = 'can we rename these?'; ago = 115 },
        @{ user = 'alice'; msg = 'yeah i just renamed it to "Project X Planning"'; ago = 114 },
        @{ user = 'bob'; msg = 'sick, custom names make it so much easier to find stuff'; ago = 113 },
        @{ user = 'charlie'; msg = 'actually organized for once :thumbsup:'; ago = 112 }
    )
}

$thread2Root = @{
    user = 'bob'
    msg = 'anyone want to play val later?'
    ago = 110
    replies = @(
        @{ user = 'dana'; msg = 'me'; ago = 109 },
        @{ user = 'eve'; msg = 'i''m down'; ago = 108 },
        @{ user = 'charlie'; msg = 'count me in'; ago = 107 },
        @{ user = 'alice'; msg = 'i''ll be on in an hour'; ago = 106 },
        @{ user = 'bob'; msg = 'renamed thread to "Val 5-stack" so people can find it'; ago = 105 },
        @{ user = 'dana'; msg = 'perfect'; ago = 104 }
    )
}

foreach ($thread in @($thread1Root, $thread2Root)) {
    $replies = @()
    foreach ($r in $thread.replies) {
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
            user = $thread.user
            message = $thread.msg
            create_at = (Get-Timestamp -MinutesAgo $thread.ago)
            replies = $replies
        }
    }
}

# Encryption Demo - E2E Security
$encryptionPosts = @(
    @{ user = 'admin'; msg = 'encryption is now live in this channel'; ago = 95 },
    @{ user = 'alice'; msg = 'wait so admin can''t even read our messages?'; ago = 94 },
    @{ user = 'bob'; msg = 'nope, that''s the point of e2e :lock:'; ago = 93 },
    @{ user = 'charlie'; msg = 'how do we know it''s working?'; ago = 92 },
    @{ user = 'dana'; msg = 'check the recipient list in the editor, it shows who has the keys'; ago = 91 },
    @{ user = 'eve'; msg = 'oh i see it, shows exactly who can decrypt'; ago = 90 },
    @{ user = 'alice'; msg = 'this is actually huge for privacy'; ago = 89 },
    @{ user = 'bob'; msg = 'finally i can talk about [REDACTED] lol'; ago = 88 },
    @{ user = 'charlie'; msg = 'the encryption mode UI looks really clean too'; ago = 87 },
    @{ user = 'dana'; msg = 'glad we finally got this implemented'; ago = 86 },
    @{ user = 'admin'; msg = 'stay safe out there'; ago = 85 }
)

foreach ($p in $encryptionPosts) {
    $lines += New-ImportLine "post" @{
        post = @{
            team = "demo"
            channel = "encryption-demo"
            user = $p.user
            message = $p.msg
            create_at = (Get-Timestamp -MinutesAgo $p.ago)
        }
    }
}

# Write output
$lines | Out-File $OutputPath -Encoding UTF8
Write-Host "Generated $($lines.Count) lines to: $OutputPath"
