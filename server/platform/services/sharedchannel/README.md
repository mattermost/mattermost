## Shared Channel Service

Package `sharedchannel` implements Mattermost's shared channels functionality, for sharing channel content across Mattermost instances/clusters. Here are the key responsibilities:

### Channel Sharing:

- Allows channels to be shared between different Mattermost instances/clusters
- Handles inviting remote clusters to shared channels
- Manages permissions and read-only status for shared channels

### Content Synchronization:

- Syncs posts, reactions, user profiles, and file attachments between instances
- Handles permalink processing between instances
- Manages user profile images sync
- Maintains sync state and cursors to track what has been synchronized

### Remote Communication:

- Processes incoming sync messages from remote clusters
- Sends updates to remote clusters when local changes occur
- Handles connection state changes with remote clusters
- Manages retry logic for failed sync attempts

### Security:

- Validates permissions for shared channel operations
- Ensures users can only sync content they have access to
- Verifies remote cluster authenticity
- Sanitizes user data during sync

The service acts as a bridge between Mattermost instances, allowing users from different instances to collaborate in shared channels while keeping content synchronized across all participating instances.

This is implemented through a Service struct that handles all the shared channel operations and maintains the synchronization state. It works in conjunction with the RemoteCluster service to handle the actual communication between instances.

---

## API Calls and Flow Between Mattermost Instances

### Overview

Shared channels enable two Mattermost instances to synchronize specific channels. The architecture uses:
- **Remote Cluster Service** - Handles inter-cluster communication
- **Shared Channel Service** - Manages channel synchronization
- **Push-based sync** - Each server pushes changes to remotes
- **Cursor-based tracking** - Timestamps track sync progress

```mermaid
graph TB
    subgraph "Server A"
        A1[User/App Layer]
        A2[Shared Channel Service]
        A3[Remote Cluster Service]
        A4[API Endpoints]
        A5[Database]
        A1 --> A2
        A2 --> A3
        A2 --> A5
        A3 --> A4
    end

    subgraph "Server B"
        B1[User/App Layer]
        B2[Shared Channel Service]
        B3[Remote Cluster Service]
        B4[API Endpoints]
        B5[Database]
        B1 --> B2
        B2 --> B3
        B2 --> B5
        B3 --> B4
    end

    A4 -->|"HTTP/HTTPS<br/>Token Auth"| B4
    B4 -->|"HTTP/HTTPS<br/>Token Auth"| A4

    A3 -.->|"Heartbeat<br/>(60s)"| B4
    B3 -.->|"Heartbeat<br/>(60s)"| A4
```

### Key Data Structures

```mermaid
erDiagram
    RemoteCluster ||--o{ SharedChannel : "connects to"
    RemoteCluster ||--o{ SharedChannelRemote : "has"
    SharedChannel ||--o{ SharedChannelRemote : "shared with"
    Channel ||--|| SharedChannel : "is"
    RemoteCluster ||--o{ User : "has synthetic"

    RemoteCluster {
        string RemoteId PK
        string Name
        string SiteURL
        string Token
        string RemoteToken
        int64 LastPingAt
        int64 LastGlobalUserSyncAt
    }

    SharedChannel {
        string ChannelId PK
        string TeamId
        bool Home
        bool ReadOnly
        string RemoteId FK
        string ShareName
    }

    SharedChannelRemote {
        string Id PK
        string ChannelId FK
        string RemoteId FK
        bool IsInviteAccepted
        bool IsInviteConfirmed
        int64 LastPostCreateAt
        int64 LastPostUpdateAt
    }

    Channel {
        string Id PK
        string TeamId
        string Name
        string Type
    }

    User {
        string Id PK
        string Username
        string Email
        string RemoteId FK
    }
```

**RemoteCluster** (`server/public/model/remote_cluster.go:56`)
- Connection between two Mattermost instances
- Contains authentication tokens (bidirectional)
- Tracks heartbeat status (`LastPingAt`)

**SharedChannel** (`server/public/model/shared_channel.go:32`)
- Represents a shared channel
- `Home=true`: Hosted locally, `Home=false`: Remote channel
- Contains channel metadata snapshot

**SharedChannelRemote** (`server/public/model/shared_channel.go:102`)
- Junction table linking channels to remote clusters
- Tracks sync cursors (`LastPostCreateAt`, `LastPostUpdateAt`)

### Flow Outline

#### 1. Remote Cluster Connection Setup

```mermaid
sequenceDiagram
    participant UA as User A
    participant SA as Server A
    participant UB as User B
    participant SB as Server B

    Note over UA,SB: Phase 1: Generate Invitation
    UA->>SA: POST /api/v4/remotecluster<br/>{name, display_name, password}
    SA->>SA: Generate RemoteId, Token
    SA->>SA: Encrypt invitation (PBKDF2 + AES-GCM)
    SA->>UA: Return encrypted invite code

    Note over UA,SB: Phase 2: Accept Invitation
    UA->>UB: Share invite code + password<br/>(out of band)
    UB->>SB: POST /api/v4/remotecluster/accept_invite<br/>{invite, password}
    SB->>SB: Decrypt invitation
    SB->>SB: Create RemoteCluster record
    SB->>SA: POST /api/v4/remotecluster/confirm_invite<br/>X-MM-RemoteCluster-Token: [token]<br/>{remote_id, site_url, token}
    SA->>SA: Update RemoteCluster with SiteURL
    SA->>SB: 200 OK
    SB->>UB: Connection established

    Note over UA,SB: Phase 3: Continuous Heartbeat
    loop Every 60 seconds
        SA->>SB: POST /api/v4/remotecluster/ping<br/>{sent_at}
        SB->>SA: {sent_at, recv_at}
        SB->>SA: POST /api/v4/remotecluster/ping<br/>{sent_at}
        SA->>SB: {sent_at, recv_at}
    end
```

**Step 1: Create Invitation (Server A)**
- API: `POST /api/v4/remotecluster`
- Generates encrypted invitation with PBKDF2 encryption
- Returns base64-encoded invite code
- Creates pending RemoteCluster record

**Step 2: Accept Invitation (Server B)**
- API: `POST /api/v4/remotecluster/accept_invite`
- Decrypts invitation using password
- Creates local RemoteCluster record
- Sends confirmation to Server A

**Step 3: Confirm Connection (Server A)**
- API: `POST /api/v4/remotecluster/confirm_invite`
- Receives confirmation from Server B
- Updates RemoteCluster with actual SiteURL
- Connection established

**Step 4: Continuous Heartbeat**
- API: `POST /api/v4/remotecluster/ping`
- Every 60 seconds (default)
- Updates `LastPingAt` timestamp
- Remote considered online if pinged within 5 minutes

#### 2. Channel Sharing

```mermaid
sequenceDiagram
    participant UA as User A
    participant SA as Server A
    participant SB as Server B
    participant UB as User B

    Note over UA,SB: Invite Remote to Channel
    UA->>SA: Invite Remote B to Channel
    SA->>SA: Create SharedChannel (Home=true)
    SA->>SA: Create SharedChannelRemote
    SA->>SB: POST /api/v4/remotecluster/msg<br/>Topic: sharedchannel_invite<br/>{channel_id, name, type, ...}
    SB->>SB: Validate invitation
    SB->>SB: Create local channel
    SB->>SB: Create SharedChannel (Home=false)
    SB->>SB: Create SharedChannelRemote<br/>(IsInviteAccepted=true)
    SB->>SA: 200 OK
    SA->>SA: Update SharedChannelRemote<br/>(IsInviteConfirmed=true)
    SA->>UA: Ephemeral: Remote added to channel

    Note over UA,SB: Initial Sync
    SA->>SA: Queue sync task for channel
    SA->>SA: Collect users, posts, reactions
    SA->>SB: POST /api/v4/remotecluster/msg<br/>Topic: sharedchannel_sync<br/>{users, posts, reactions, ...}
    SB->>SB: Process sync message
    SB->>SB: Create synthetic users
    SB->>SB: Create posts
    SB->>SB: Add reactions
    SB->>SA: 200 OK {timestamps}
    SA->>SA: Update sync cursors
```

**Step 1: Share Channel (Server A)**
- Internal: `InviteRemoteToChannel()`
- Creates SharedChannel record (`Home=true`)
- Sends invitation message via topic `sharedchannel_invite`
- Contains channel metadata (name, type, permissions)

**Step 2: Receive Invitation (Server B)**
- API: `POST /api/v4/remotecluster/msg` (topic: `sharedchannel_invite`)
- Creates local channel (regular, DM, or GM)
- Creates SharedChannel record (`Home=false`)
- Creates SharedChannelRemote record
- Returns 200 OK

**Step 3: Initial Sync Triggered**
- Server A receives confirmation
- Posts ephemeral notification to channel
- Triggers initial content synchronization

#### 3. Content Synchronization

```mermaid
sequenceDiagram
    participant UA as User A
    participant SA as Server A
    participant SB as Server B
    participant UB as User B

    Note over UA,SB: User A posts message
    UA->>SA: Create Post
    SA->>SA: Save post to database
    SA->>UA: WebSocket: posted event
    SA->>SA: Queue sync task (2s delay)

    Note over UA,SB: Sync Task Processing
    SA->>SA: Collect data:<br/>- Users (updated profiles)<br/>- Posts (new/edited)<br/>- Reactions<br/>- Attachments
    SA->>SA: Filter & batch (100 posts max)

    alt Has file attachments
        SA->>SB: POST /api/v4/remotecluster/msg<br/>Topic: sharedchannel_upload<br/>{upload_session}
        SB->>SA: 200 OK {session_id}
        SA->>SB: POST /api/v4/remotecluster/upload/{id}<br/>multipart file data
        SB->>SB: Save file to filestore
    end

    SA->>SB: POST /api/v4/remotecluster/msg<br/>Topic: sharedchannel_sync<br/>Headers: X-MM-RemoteCluster-Id, Token<br/>{SyncMsg}

    Note over SB: Process Sync Message
    SB->>SB: Validate auth token
    SB->>SB: Process users (create synthetic)
    SB->>SB: Process posts (transform mentions)
    SB->>SB: Process reactions
    SB->>SB: Process acknowledgements
    SB->>SB: Update user statuses
    SB->>UB: WebSocket: posted event
    SB->>SA: 200 OK {timestamps, syncd_users}
    SA->>SA: Update sync cursors:<br/>LastPostCreateAt, LastPostUpdateAt

    Note over UA,SB: Bidirectional Sync
    UB->>SB: Create Post (reply)
    SB->>SB: Save post
    SB->>UB: WebSocket: posted event
    SB->>SB: Queue sync task
    SB->>SA: POST /api/v4/remotecluster/msg<br/>Topic: sharedchannel_sync
    SA->>SA: Process sync message
    SA->>UA: WebSocket: posted event
    SA->>SB: 200 OK {timestamps}
```

**Sync Architecture:**
- **Event-driven**: Channel changes trigger sync tasks
- **Batched**: Groups changes for efficiency (100 posts/batch)
- **Ordered**: Users → Attachments → Posts → Reactions → Acknowledgements

**Sync Task Creation:**
Triggered by:
- Post created/edited/deleted
- Reaction added/removed
- User profile updated
- Channel metadata changed
- User status changed
- Membership changed

```mermaid
graph LR
    A[Channel Event] -->|NotifyChannelChanged| B[Task Queue]
    B -->|2s min delay| C{Remote Online?}
    C -->|Yes| D[Collect Data]
    C -->|No| E[Skip, retry later]
    D --> F[Batch Data<br/>100 posts max]
    F --> G[Send to Remote]
    G -->|Success| H[Update Cursors]
    G -->|Failure| I{Retry Count < 3?}
    I -->|Yes| B
    I -->|No| J[Log Error & Drop]
    H --> K{More Data?}
    K -->|Yes| B
    K -->|No| L[Done]
```

**Data Collection:**
- Users: 25 per batch (profiles updated since last sync)
- Posts: 100 per batch (new posts first, then edited)
- Reactions: All for synced posts
- Attachments: All for synced posts

**Send Sync Message (Server A → Server B)**
- API: `POST /api/v4/remotecluster/msg` (topic: `sharedchannel_sync`)
- Headers:
  - `X-MM-RemoteCluster-Id`: Remote cluster ID
  - `X-MM-RemoteCluster-Token`: Authentication token
- Body: `RemoteClusterFrame` containing `SyncMsg`

**SyncMsg Structure:**
```json
{
  "channel_id": "channel_123",
  "users": {"user_id": {...}},
  "posts": [{...}],
  "reactions": [{...}],
  "acknowledgements": [{...}],
  "statuses": [{...}],
  "mention_transforms": {"username": "user_id"}
}
```

**Receive Sync Message (Server B)**
- Validates authentication
- Processes users (creates synthetic users with obfuscated emails)
- Processes posts (transforms mentions, handles edits/deletes)
- Processes reactions (adds/removes)
- Processes acknowledgements
- Updates user statuses
- Returns success response with timestamps

#### 4. File Attachment Synchronization

**Upload Flow:**
1. Server A creates upload session
2. Sends upload creation message (topic: `sharedchannel_upload`)
3. Server B creates matching session
4. Server A streams file data: `POST /api/v4/remotecluster/upload/{upload_id}`
5. Server B saves file and creates FileInfo record

#### 5. Profile Image Synchronization

**Upload Flow:**
1. Detect user image update (`LastPictureUpdate` changed)
2. Server A uploads image: `POST /api/v4/remotecluster/{user_id}/image`
3. Server B validates user belongs to remote
4. Saves image and invalidates cache

#### 6. Membership Synchronization

**Feature Flag:** `EnableSharedChannelsMemberSync`

**Incremental Updates:**
- User added/removed from channel
- Sends `MembershipChangeMsg` in SyncMsg
- Receiving server adds/removes user accordingly

**Batch Member Sync:**
- Syncs all channel members in batches of 100
- Triggered on initial share or reconnection
- Only syncs local users (excludes synthetic remote users)

#### 7. Global User Synchronization

**Feature Flag:** `EnableSyncAllUsersForRemoteCluster`

**Purpose:** Sync all local users for better mention support

**Flow:**
1. Triggered on connection establishment or manual request
2. Collects users in batches of 25
3. Sends via topic `sharedchannel_global_user_sync`
4. Empty `channel_id` indicates global sync
5. Updates `LastGlobalUserSyncAt` cursor

### Authentication & Security

```mermaid
sequenceDiagram
    participant SA as Server A
    participant SB as Server B

    Note over SA,SB: Token Setup During Connection
    SA->>SA: Generate Token_A<br/>(for incoming auth)
    SB->>SB: Generate Token_B<br/>(for incoming auth)
    SA->>SB: Invitation contains Token_A
    SB->>SA: Confirmation contains Token_B
    SA->>SA: Store RemoteToken = Token_B
    SB->>SB: Store RemoteToken = Token_A

    Note over SA,SB: Server A sends message to Server B
    SA->>SB: POST /api/v4/remotecluster/msg<br/>X-MM-RemoteCluster-Id: RemoteId_B<br/>X-MM-RemoteCluster-Token: Token_B
    SB->>SB: Validate RemoteId_B exists
    SB->>SB: Validate Token matches stored Token_B
    alt Valid Token
        SB->>SA: 200 OK + Response Data
    else Invalid Token
        SB->>SA: 401 Unauthorized
    end

    Note over SA,SB: Server B sends message to Server A
    SB->>SA: POST /api/v4/remotecluster/msg<br/>X-MM-RemoteCluster-Id: RemoteId_A<br/>X-MM-RemoteCluster-Token: Token_A
    SA->>SA: Validate RemoteId_A exists
    SA->>SA: Validate Token matches stored Token_A
    alt Valid Token
        SA->>SB: 200 OK + Response Data
    else Invalid Token
        SA->>SB: 401 Unauthorized
    end
```

**Token-Based Authentication:**
- Each server has `Token` (for incoming requests)
- Each server stores `RemoteToken` (for outgoing requests)
- All inter-server API calls include both in headers

**Invitation Encryption:**
- PBKDF2 key derivation (600,000 iterations)
- AES-GCM encryption
- Base64-encoded invite codes

**User Privacy:**
- Synthetic users with obfuscated data
- Username munged: `alice:remote-workspace`
- Email replaced with UUID
- Original values in Props (not exposed to clients)

### Key API Endpoints

**Remote Cluster Management:**
- `POST /api/v4/remotecluster` - Create remote (generate invite)
- `POST /api/v4/remotecluster/accept_invite` - Accept invitation
- `POST /api/v4/remotecluster/confirm_invite` - Confirm connection
- `POST /api/v4/remotecluster/ping` - Heartbeat
- `POST /api/v4/remotecluster/msg` - Message delivery (all topics)

**Shared Channel Management:**
- `GET /api/v4/sharedchannels/{team_id}` - List shared channels
- `POST /api/v4/channels/{channel_id}/remotes/{remote_id}/invite` - Share channel
- `POST /api/v4/channels/{channel_id}/remotes/{remote_id}/uninvite` - Unshare

**File Operations:**
- `POST /api/v4/remotecluster/upload/{upload_id}` - Upload file
- `POST /api/v4/remotecluster/{user_id}/image` - Upload profile image

### Error Handling & Monitoring

**Retry Logic:**
- Max 3 retries per sync task
- Exponential backoff with 2-second minimum delay
- Post-level retry for specific failures

**Offline Handling:**
- Queues pending invitations when remote offline
- Resumes sync when connection restored
- Notifies users with ephemeral messages

**Metrics:**
- `shared_channels_sync_counter` - Sync attempts
- `shared_channels_queue_size` - Queue depth
- `remote_cluster_msg_sent` - Successful messages
- `remote_cluster_msg_errors` - Failed messages

### Key Files

**Models:** `server/public/model/remote_cluster.go`, `server/public/model/shared_channel.go`

**API:** `server/channels/api4/remote_cluster.go`, `server/channels/api4/shared_channel.go`

**Services:**
- `server/platform/services/remotecluster/` - Connection management
- `server/platform/services/sharedchannel/` - Sync logic

This architecture enables secure, bidirectional synchronization of channels between independent Mattermost instances while maintaining data privacy and consistency.