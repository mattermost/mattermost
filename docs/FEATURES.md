# Features Guide

Complete documentation for all Mattermost Extended features.

---

## Table of Contents

- [End-to-End Encryption](#end-to-end-encryption)
- [Custom Channel Icons](#custom-channel-icons)
- [Custom Thread Names](#custom-thread-names)
- [Threads in Sidebar](#threads-in-sidebar)
- [Hide Deleted Message Placeholders](#hide-deleted-message-placeholders)
- [Feature Flags Reference](#feature-flags-reference)

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

**Feature Flag:** `HideDeletedMessagePlaceholder`
**Environment Variable:** `MM_FEATUREFLAGS_HIDEDELETEDMESSAGEPLACEHOLDER=true`

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

## Feature Flags Reference

### All Feature Flags

| Flag | Environment Variable | Default | Description |
|------|---------------------|---------|-------------|
| `Encryption` | `MM_FEATUREFLAGS_ENCRYPTION` | `false` | E2E encryption |
| `CustomChannelIcons` | `MM_FEATUREFLAGS_CUSTOMCHANNELICONS` | `false` | Custom channel icons |
| `CustomThreadNames` | `MM_FEATUREFLAGS_CUSTOMTHREADNAMES` | `false` | Rename threads |
| `ThreadsInSidebar` | `MM_FEATUREFLAGS_THREADSINSIDEBAR` | `false` | Show threads under channels |
| `HideDeletedMessagePlaceholder` | `MM_FEATUREFLAGS_HIDEDELETEDMESSAGEPLACEHOLDER` | `false` | Clean deletions |

### Enabling via System Console

1. Go to **System Console**
2. Navigate to **Mattermost Extended > Features**
3. Toggle the desired features
4. Save changes

### Enabling via Environment Variables

```bash
# Docker / docker-compose
environment:
  - MM_FEATUREFLAGS_ENCRYPTION=true
  - MM_FEATUREFLAGS_CUSTOMCHANNELICONS=true

# Systemd service
Environment="MM_FEATUREFLAGS_ENCRYPTION=true"
```

### Enabling via config.json

```json
{
  "FeatureFlags": {
    "Encryption": true,
    "CustomChannelIcons": true,
    "CustomThreadNames": true,
    "ThreadsInSidebar": true,
    "HideDeletedMessagePlaceholder": true
  }
}
```

---

## Coming Soon

Features currently in development:

- **Discord-Style Replies** - Inline reply previews with connector lines
- **Read Receipts** - See who has read your messages

---

*For technical implementation details, see [Architecture](ARCHITECTURE.md).*
