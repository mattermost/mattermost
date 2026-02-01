# Architecture

Technical architecture and design decisions for Mattermost Extended.

---

## Table of Contents

- [Overview](#overview)
- [Fork Strategy](#fork-strategy)
- [Server Architecture](#server-architecture)
- [Webapp Architecture](#webapp-architecture)
- [Database Schema](#database-schema)
- [Feature Flag System](#feature-flag-system)
- [Encryption Architecture](#encryption-architecture)

---

## Overview

Mattermost Extended is a fork of Mattermost v11.3.0 with custom features added on top. The fork follows a **cherry-pick strategy** where custom commits are maintained separately from upstream changes.

### Key Principles

1. **Minimal Upstream Modifications** - Add new files rather than modifying existing ones when possible
2. **Feature Flags for Everything** - All custom features can be toggled without redeployment
3. **Client-Side Security** - Encryption happens in the browser, never on the server
4. **Graceful Degradation** - Features work independently; disabling one doesn't break others

---

## Fork Strategy

### Branch Structure

```
master (our main branch)
  ├── Based on v11.3.0 (stable release tag)
  └── Custom commits cherry-picked on top
```

### Syncing with Upstream

When a new Mattermost version is released:

1. Create branch from new release tag
2. Cherry-pick custom commits
3. Resolve conflicts
4. Test and deploy

```bash
git checkout -b upgrade-11.4.0 v11.4.0
git cherry-pick <custom-commits>
git checkout master
git reset --hard upgrade-11.4.0
```

### Why Not Merge?

- Avoids merge commits cluttering history
- Makes it clear which commits are custom
- Easier to rebase onto new versions
- Cleaner `git log` showing only custom changes

---

## Server Architecture

### Directory Structure

```
server/
├── channels/
│   ├── api4/
│   │   ├── api.go              # Route registration (modified)
│   │   └── encryption.go       # NEW: Encryption endpoints
│   ├── app/
│   │   └── ...                 # Application logic
│   └── store/
│       └── sqlstore/
│           └── encryption_session_key_store.go  # NEW: Key storage
├── public/
│   ├── model/
│   │   ├── feature_flags.go    # Modified: Added custom flags
│   │   ├── encryption_key.go   # NEW: Encryption models
│   │   └── thread.go           # Modified: Added Props field
│   └── plugin/
│       └── api.go              # Modified: Plugin API extensions
└── config/
    └── client.go               # Modified: Expose flags to client
```

### New API Endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `/api/v4/encryption/*` | `encryption.go` | Key management |
| Thread name updates | `thread_store.go` | Custom thread names |
| Channel icon updates | `channel_store.go` | Custom channel icons |

### Database Stores

| Store | Table | Purpose |
|-------|-------|---------|
| `EncryptionSessionKeyStore` | `encryptionsessionkeys` | RSA public keys per session |
| `ThreadStore` (extended) | `threads` | Thread props including custom names |
| `ChannelStore` (extended) | `channels` | Channel props including custom icons |

---

## Webapp Architecture

### Directory Structure

```
webapp/
├── channels/src/
│   ├── components/
│   │   ├── admin_console/
│   │   │   └── mattermost_extended_features.tsx  # NEW: Admin UI
│   │   ├── sidebar/
│   │   │   └── sidebar_channel/
│   │   │       ├── sidebar_base_channel_icon.tsx  # NEW: Custom icons
│   │   │       └── sidebar_thread_item/           # NEW: Threads in sidebar
│   │   └── threading/
│   │       └── thread_view/
│   │           └── thread_view.tsx                # Modified: Custom names
│   ├── store/
│   │   └── encryption_middleware.ts               # NEW: Decrypt on receive
│   └── utils/
│       └── encryption/                            # NEW: Crypto utilities
│           ├── index.ts
│           ├── keypair.ts         # RSA key generation
│           ├── hybrid.ts          # RSA + AES encryption
│           ├── session.ts         # Key lifecycle
│           ├── api.ts             # Server API calls
│           ├── message_hooks.ts   # Message encryption
│           ├── file.ts            # File encryption
│           └── file_hooks.ts      # Upload encryption
├── platform/
│   ├── client/src/
│   │   └── client4.ts             # Modified: New API methods
│   └── types/src/
│       ├── config.ts              # Modified: Feature flag types
│       └── threads.ts             # Modified: Thread props types
```

### Redux State Extensions

```typescript
// New state slices
state.views.encryption = {
  keyError: string | null,
  decryptedFileUrls: Record<string, string>,
  fileDecryptionStatus: Record<string, 'idle' | 'decrypting' | 'decrypted' | 'failed'>,
  // ... more
}

// Extended types
interface Thread {
  props?: {
    custom_name?: string;
  }
}

interface Channel {
  props?: {
    custom_icon?: string;
  }
}
```

### Message Interception

Messages are processed at multiple points:

| Entry Point | Hook/Middleware | Purpose |
|-------------|-----------------|---------|
| Sending | `runMessageWillBePostedHooks` | Encrypt outgoing |
| WebSocket | `runMessageWillBeReceivedHooks` | Decrypt incoming |
| Page Load | `encryption_middleware.ts` | Decrypt bulk loads |
| Edit | `runMessageWillBeUpdatedHooks` | Re-encrypt on edit |

---

## Database Schema

### New Tables

#### `encryptionsessionkeys`

```sql
CREATE TABLE encryptionsessionkeys (
    sessionid VARCHAR(26) PRIMARY KEY,
    userid VARCHAR(26) NOT NULL,
    publickey TEXT NOT NULL,
    createat BIGINT NOT NULL
);

CREATE INDEX idx_encryptionsessionkeys_userid ON encryptionsessionkeys(userid);
```

### Modified Tables

#### `threads` - Added `props` column

```sql
ALTER TABLE threads ADD COLUMN props JSONB;
```

#### `channels` - Extended `props` usage

Channel props already exists; we use it for `custom_icon`.

---

## Feature Flag System

### Server-Side Definition

```go
// server/public/model/feature_flags.go
type FeatureFlags struct {
    // ... upstream flags ...

    // Custom flags
    Encryption                     bool
    CustomChannelIcons             bool
    CustomThreadNames              bool
    ThreadsInSidebar               bool
    HideDeletedMessagePlaceholder  bool
}
```

### Client-Side Access

```typescript
// Feature flags are exposed via config
const config = getConfig(state);

if (config.FeatureFlagEncryption === 'true') {
  // Feature enabled
}
```

### Admin Console Integration

The admin console dynamically reads feature flags and generates toggle UI:

```typescript
// webapp/channels/src/components/admin_console/mattermost_extended_features.tsx
// Renders toggles for each custom feature flag
```

---

## Encryption Architecture

### Key Hierarchy

```
Session (browser tab)
    └── RSA-4096 Keypair
            ├── Private Key (sessionStorage, never leaves browser)
            └── Public Key (registered with server)

Message
    └── AES-256-GCM Key (random per message)
            └── Wrapped with each recipient's RSA public key
```

### Encryption Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Sender    │    │    Server    │    │  Recipient  │
└──────┬──────┘    └──────┬───────┘    └──────┬──────┘
       │                  │                   │
       │ Generate AES key │                   │
       │ Encrypt message  │                   │
       │ Wrap AES key     │                   │
       │ for each session │                   │
       │                  │                   │
       │──── PENC:v1:... ─────────────────────│
       │                  │                   │
       │                  │ Store encrypted   │
       │                  │                   │
       │                  │──── PENC:v1:... ──│
       │                  │                   │
       │                  │     Unwrap AES key│
       │                  │     Decrypt msg   │
       │                  │                   │
```

### File Encryption Format (v2)

```
┌─────────────────┬──────────────────────────────────────────┐
│  Header Length  │           Encrypted Content              │
│   (4 bytes)     │                                          │
│  Little-endian  │  AES-256-GCM encrypted:                  │
│                 │  ┌────────────────────────────────────┐  │
│                 │  │ JSON Header:                       │  │
│                 │  │ {"name":"photo.jpg",               │  │
│                 │  │  "type":"image/jpeg",              │  │
│                 │  │  "size":12345}                     │  │
│                 │  ├────────────────────────────────────┤  │
│                 │  │ Original File Content              │  │
│                 │  └────────────────────────────────────┘  │
└─────────────────┴──────────────────────────────────────────┘
```

---

## Design Decisions

### Why Client-Side Encryption?

- **Zero Trust**: Server never sees plaintext
- **No Key Escrow**: Admin cannot decrypt messages
- **Forward Secrecy**: New session = new keys

### Why Per-Session Keys?

- Losing a device doesn't compromise other sessions
- Logout clears keys (stored in sessionStorage)
- Multiple devices work independently

### Why Feature Flags?

- Deploy once, enable features gradually
- Easy rollback without redeployment
- Per-environment configuration
- A/B testing capability

---

*For build and deployment details, see [Build & Deploy](BUILD_DEPLOY.md).*
