# Features Guide

Complete documentation for all Mattermost Extended features and tweaks.

---

## Table of Contents

### Feature Flags (Major Features)
- [End-to-End Encryption](#end-to-end-encryption)
- [Discord-Style Replies](#discord-style-replies)
- [Chat Sounds](#chat-sounds)
- [Custom Channel Icons](#custom-channel-icons)
- [Custom Thread Names](#custom-thread-names)
- [Threads in Sidebar](#threads-in-sidebar)

### Tweaks (Simple Modifications)
- [Hide Deleted Message Placeholders](#hide-deleted-message-placeholders)
- [Sidebar Channel Settings Menu](#sidebar-channel-settings-menu)

### Reference
- [Feature Flags Reference](#feature-flags-reference)
- [Tweaks Reference](#tweaks-reference)

---

## End-to-End Encryption

**Feature Flag:** `Encryption`
**Environment Variable:** `MM_FEATUREFLAGS_ENCRYPTION=true`

### Overview

End-to-end encryption ensures that messages and files are encrypted on the sender's device and can only be decrypted by intended recipients. The server never sees plaintext content.

### How It Works

1. **Key Generation**: Each browser session generates a unique RSA-4096 keypair
2. **Key Registration**: The public key is registered with the server
3. **Message Encryption**: Messages are encrypted with AES-256-GCM, and the AES key is wrapped with each recipient's public key
4. **Decryption**: Recipients unwrap the AES key with their private key and decrypt the message

### Encryption Format

**Messages:**
```
PENC:v1:{base64_json_payload}
```

**Payload Structure:**
```json
{
  "iv": "base64(12-byte IV)",
  "ct": "base64(AES ciphertext)",
  "keys": {
    "sessionId1": "base64(RSA-encrypted AES key)",
    "sessionId2": "base64(RSA-encrypted AES key)"
  },
  "sender": "userId"
}
```

### File Encryption

Files are encrypted client-side before upload:

- Original filename, type, and size are embedded in the encrypted payload
- Server only sees: `encrypted_xxx.penc` with MIME type `application/x-penc`
- Thumbnails are generated client-side and cached locally

### Visual Indicators

- Purple left border on encrypted messages
- Lock icon badge
- "Encrypted" label in message header

### Security Properties

| Property | Description |
|----------|-------------|
| **Client-Side Only** | Encryption/decryption happens entirely in browser |
| **Per-Session Keys** | New session = new keys |
| **Forward Secrecy** | Compromising one session doesn't affect others |
| **No Backdoors** | Server cannot decrypt without private keys |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v4/encryption/status` | GET | Check encryption status |
| `/api/v4/encryption/publickey` | GET | Get current session's public key |
| `/api/v4/encryption/publickey` | POST | Register a public key |
| `/api/v4/encryption/publickeys` | POST | Bulk fetch keys by user IDs |
| `/api/v4/encryption/channel/{id}/keys` | GET | Get all channel member keys |

---

## Discord-Style Replies

**Feature Flag:** `DiscordReplies`
**Environment Variable:** `MM_FEATUREFLAGS_DISCORDREPLIES=true`

### Overview

Discord-style replies bring inline reply previews with visual connector lines to Mattermost. Instead of opening a thread, clicking Reply queues messages for inline responses that appear above your message with curved connector lines linking to the original content.

### How It Works

1. **Reply Queuing**: Click the Reply button to add a post to your pending replies queue (instead of opening a thread)
2. **Send Message**: Type your message and send - the reply quotes are automatically prepended
3. **Visual Preview**: Reply previews render above your post with connector lines
4. **Graceful Degradation**: When disabled, replies appear as functional Markdown blockquotes

### Reply Format

Messages are stored with special Markdown that works even when the feature is disabled:

```markdown
>[@username](https://chat.example.com/team/pl/abc123): Original message preview

Your reply message here
```

### Visual Elements

| Element | Description |
|---------|-------------|
| **Reply Preview** | Shows avatar, username, and truncated message |
| **Connector Lines** | Curved SVG lines link preview to your post |
| **Pending Bar** | Shows queued replies above text editor |
| **Jump to Original** | Click any reply preview to navigate to original message |

### UI Changes

| Element | Normal Behavior | With DiscordReplies |
|---------|----------------|---------------------|
| **Reply Button** | Opens thread in RHS | Adds post to pending queue |
| **Create Thread** | N/A | New button for original thread behavior |
| **Click to Reply** | "Click to open threads" setting | Renamed to "Click to reply" |

### Post Metadata

When a post contains Discord replies, it includes:

```json
{
  "props": {
    "discord_replies": [
      {
        "post_id": "abc123",
        "user_id": "user1",
        "username": "johndoe",
        "nickname": "John",
        "text": "Original message preview...",
        "has_image": false,
        "has_video": false
      }
    ]
  },
  "metadata": {
    "priority": {
      "priority": "discord_reply"
    }
  }
}
```

### Key Files

| Purpose | File |
|---------|------|
| Feature flag | `server/public/model/feature_flags.go` |
| Message interception | `webapp/channels/src/actions/hooks.ts` |
| Reply preview component | `webapp/channels/src/components/post/discord_reply_preview/` |
| State management | `webapp/channels/src/actions/views/discord_replies.ts` |
| Quote stripping | `webapp/channels/src/components/post_view/post_message_view/post_message_view.tsx` |
| Button override | `webapp/channels/src/components/post/post_options.tsx` |

---

## Chat Sounds

**Feature Flag:** `GuildedSounds`
**Environment Variable:** `MM_FEATUREFLAGS_GUILDEDSOUNDS=true`

### Overview

Customizable sound effects for various chat interactions, inspired by Guilded. When enabled, a new "Sounds" tab appears in user settings where users can control volume and toggle individual sounds.

### Available Sounds

| Sound | Trigger | Default |
|-------|---------|---------|
| **Message Sent** | When you send a message | On |
| **Reaction** | When you add a reaction | On |
| **Reaction Received** | When someone reacts to your post | On |
| **Message Received** | When a new message arrives in a channel | Off |
| **Direct Message** | When you receive a DM | On |
| **Mention** | When you are @mentioned | On |

### Settings UI

The Sounds tab appears in **Settings** (between Sidebar and Advanced) when the feature flag is enabled:

```
Sounds Settings
├── Master Volume Slider (0-100%)
└── Sound Toggles:
    ├── Message Sent        [toggle] [▶ Preview]
    ├── Reaction            [toggle] [▶ Preview]
    ├── Reaction Received   [toggle] [▶ Preview]
    ├── Message Received    [toggle] [▶ Preview]
    ├── Direct Message      [toggle] [▶ Preview]
    └── Mention             [toggle] [▶ Preview]
```

### Throttling

Sounds are throttled to prevent audio spam:

| Sound | Throttle Interval |
|-------|-------------------|
| Message Sent | 500ms |
| Reaction | 500ms |
| Reaction Received | 2000ms |
| Message Received | 1000ms |
| Direct Message | 3000ms |
| Mention | 3000ms |

### User Preferences

Sound settings are stored as user preferences:

| Preference | Category | Description |
|------------|----------|-------------|
| `enabled` | `guilded_sounds` | Master toggle |
| `volume` | `guilded_sounds` | Volume level (0-100) |
| `message_sent` | `guilded_sounds` | Message sent sound toggle |
| `reaction_apply` | `guilded_sounds` | Reaction sound toggle |
| `reaction_received` | `guilded_sounds` | Reaction received toggle |
| `message_received` | `guilded_sounds` | Message received toggle |
| `dm_received` | `guilded_sounds` | DM sound toggle |
| `mention_received` | `guilded_sounds` | Mention sound toggle |

### Key Files

| Purpose | File |
|---------|------|
| Feature flag | `server/public/model/feature_flags.go` |
| Sound utility | `webapp/channels/src/utils/guilded_sounds.tsx` |
| Settings component | `webapp/channels/src/components/user_settings/sounds/user_settings_sounds.tsx` |
| Sound triggers | `webapp/channels/src/actions/post_actions.ts`, `new_post.ts`, `websocket_actions.jsx` |
| Sound files | `webapp/channels/src/sounds/guilded_*.mp3` |

---

## Custom Channel Icons

**Feature Flag:** `CustomChannelIcons`
**Environment Variable:** `MM_FEATUREFLAGS_CUSTOMCHANNELICONS=true`

### Overview

Replace the default globe (public) or lock (private) channel icons with custom icons from popular icon libraries or your own SVGs.

### Supported Icon Sources

| Source | Format | Example |
|--------|--------|---------|
| Material Design Icons | `mdi:icon-name` | `mdi:rocket-launch` |
| Lucide Icons | `lucide:icon-name` | `lucide:code` |
| Custom SVG | Base64-encoded SVG | `data:image/svg+xml;base64,...` |

### How to Set a Custom Icon

1. Go to **Channel Settings** (click channel name > Edit Channel)
2. Navigate to the **Info** tab
3. Click the **Channel Icon** selector
4. Search or browse available icons
5. Click to select, then save

### Icon Storage

Icons are stored in `channel.props.custom_icon`:

```json
{
  "props": {
    "custom_icon": "mdi:rocket-launch"
  }
}
```

### Where Icons Appear

- Sidebar channel list
- Channel header
- Channel mention suggestions
- Search results
- Quick switcher

---

## Custom Thread Names

**Feature Flag:** `CustomThreadNames`
**Environment Variable:** `MM_FEATUREFLAGS_CUSTOMTHREADNAMES=true`

### Overview

Give threads meaningful names instead of using the truncated first message. Useful for long-running discussions, meeting notes, or project threads.

### How to Rename a Thread

1. Open the thread in the right-hand sidebar
2. Click the **pencil icon** next to the thread title
3. Enter a new name
4. Press Enter or click outside to save

### Thread Name Storage

Names are stored in `thread.props.custom_name`:

```json
{
  "props": {
    "custom_name": "Q4 Marketing Strategy"
  }
}
```

### Display Behavior

| Location | Display |
|----------|---------|
| Thread Header | Custom name (if set) or first message |
| Global Threads | Custom name with channel context |
| Sidebar (if enabled) | Custom name truncated to fit |

---

## Threads in Sidebar

**Feature Flag:** `ThreadsInSidebar`
**Environment Variable:** `MM_FEATUREFLAGS_THREADSINSIDEBAR=true`

### Overview

Display followed threads directly under their parent channels in the sidebar, eliminating the need to switch to the global Threads view.

### How It Works

1. When you follow a thread, it appears nested under the parent channel
2. Unread indicators show on both the channel and thread
3. Click the thread to open it in the right-hand sidebar
4. Threads are sorted by last activity

### Visual Design

```
#general
  └─ Thread: Bug discussion
  └─ Thread: Feature request
#development
  └─ Thread: API design review
```

---

## Hide Deleted Message Placeholders

**Type:** Tweak (Posts)
**Config Key:** `MattermostExtendedSettings.Posts.HideDeletedMessagePlaceholder`
**Environment Variable:** `MM_MATTERMOSTEXTENDEDSETTINGS_POSTS_HIDEDELETEDMESSAGEPLACEHOLDER=true`

### Overview

When enabled, deleted messages immediately disappear for all users instead of showing "(message deleted)" placeholder text.

### Behavior

| Setting | What Users See |
|---------|---------------|
| **Disabled** (default) | "(message deleted)" placeholder |
| **Enabled** | Message completely removed from view |

### Use Cases

- Cleaner chat history
- Better privacy for accidental messages
- Reduced visual noise

---

## Sidebar Channel Settings Menu

**Type:** Tweak (Channels)
**Config Key:** `MattermostExtendedSettings.Channels.SidebarChannelSettings`
**Environment Variable:** `MM_MATTERMOSTEXTENDEDSETTINGS_CHANNELS_SIDEBARCHANNELSETTINGS=true`

### Overview

Adds a "Channel Settings" menu item to the sidebar channel right-click menu for quick access to channel configuration.

### How It Works

1. Right-click (or click the "..." menu) on any channel in the sidebar
2. The "Channel Settings" option appears above "Leave Channel"
3. Only visible for public and private channels (not DMs/GMs)
4. Only visible to users with permission to access channel settings

### Use Cases

- Quick access to channel settings without opening channel header
- Faster workflow for channel administrators
- Convenient for managing channel properties

---

## Feature Flags Reference

Feature flags are used for **major features** that gate significant functionality.

### All Feature Flags

| Flag | Environment Variable | Default | Description |
|------|---------------------|---------|-------------|
| `Encryption` | `MM_FEATUREFLAGS_ENCRYPTION` | `false` | E2E encryption |
| `DiscordReplies` | `MM_FEATUREFLAGS_DISCORDREPLIES` | `false` | Discord-style inline replies |
| `GuildedSounds` | `MM_FEATUREFLAGS_GUILDEDSOUNDS` | `false` | Customizable chat sounds |
| `CustomChannelIcons` | `MM_FEATUREFLAGS_CUSTOMCHANNELICONS` | `false` | Custom channel icons |
| `CustomThreadNames` | `MM_FEATUREFLAGS_CUSTOMTHREADNAMES` | `false` | Rename threads |
| `ThreadsInSidebar` | `MM_FEATUREFLAGS_THREADSINSIDEBAR` | `false` | Show threads under channels |

### Enabling Feature Flags via System Console

1. Go to **System Console**
2. Navigate to **Mattermost Extended > Features**
3. Toggle the desired features
4. Save changes

### Enabling Feature Flags via Environment Variables

```bash
# Docker / docker-compose
environment:
  - MM_FEATUREFLAGS_ENCRYPTION=true
  - MM_FEATUREFLAGS_CUSTOMCHANNELICONS=true

# Systemd service
Environment="MM_FEATUREFLAGS_ENCRYPTION=true"
```

### Enabling Feature Flags via config.json

```json
{
  "FeatureFlags": {
    "Encryption": true,
    "DiscordReplies": true,
    "GuildedSounds": true,
    "CustomChannelIcons": true,
    "CustomThreadNames": true,
    "ThreadsInSidebar": true
  }
}
```

---

## Tweaks Reference

Tweaks are **simple modifications** that don't require a full feature flag. They're organized by section (Posts, Channels, etc.).

### All Tweaks

| Section | Tweak | Environment Variable | Default | Description |
|---------|-------|---------------------|---------|-------------|
| Posts | `HideDeletedMessagePlaceholder` | `MM_MATTERMOSTEXTENDEDSETTINGS_POSTS_HIDEDELETEDMESSAGEPLACEHOLDER` | `false` | Clean deletions |
| Channels | `SidebarChannelSettings` | `MM_MATTERMOSTEXTENDEDSETTINGS_CHANNELS_SIDEBARCHANNELSETTINGS` | `false` | Channel settings in sidebar menu |

### Enabling Tweaks via System Console

1. Go to **System Console**
2. Navigate to **Mattermost Extended > [Section]** (e.g., Posts, Channels)
3. Toggle the desired tweaks
4. Save changes

### Enabling Tweaks via Environment Variables

```bash
# Docker / docker-compose
environment:
  - MM_MATTERMOSTEXTENDEDSETTINGS_POSTS_HIDEDELETEDMESSAGEPLACEHOLDER=true
  - MM_MATTERMOSTEXTENDEDSETTINGS_CHANNELS_SIDEBARCHANNELSETTINGS=true

# Systemd service
Environment="MM_MATTERMOSTEXTENDEDSETTINGS_POSTS_HIDEDELETEDMESSAGEPLACEHOLDER=true"
```

### Enabling Tweaks via config.json

```json
{
  "MattermostExtendedSettings": {
    "Posts": {
      "HideDeletedMessagePlaceholder": true
    },
    "Channels": {
      "SidebarChannelSettings": true
    }
  }
}
```

---

## Coming Soon

Features currently in development:

- **Read Receipts** - See who has read your messages
- **Error Log Dashboard** - Real-time error monitoring for admins

---

*For technical implementation details, see [Architecture](ARCHITECTURE.md).*
