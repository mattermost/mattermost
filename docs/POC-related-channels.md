# POC Plan: Related Channels Feature

**Date:** 2026-01-02
**Status:** Planning
**Author:** Claude Code (assisted exploration)

---

## Overview

Build a "Related Channels" feature that tracks channel-channel relationships based on:
1. **Channel bookmarks** that link to other channels
2. **Channel header mentions** (using `~channel-name` syntax)
3. **URLs in channel headers** pointing to other channels

Display related channels as a collapsible section in the Channel Info RHS panel, enabling users to discover and navigate to connected channels.

---

## Current State Analysis

### Channel Bookmarks

**Data Model:** `server/public/model/channel_bookmark.go`

```go
type ChannelBookmark struct {
    Id          string
    ChannelId   string              // Parent channel
    LinkUrl     string              // URL (can point to other channels)
    DisplayName string
    Type        ChannelBookmarkType // 'link' or 'file'
}
```

**Key Points:**
- `LinkUrl` can contain Mattermost channel URLs (e.g., `/team/channels/channel-name`)
- Max 50 bookmarks per channel
- Already has database indexes on `channelid`

**Store:** `server/channels/store/sqlstore/channel_bookmark_store.go`
- `GetBookmarksForChannelSince()` - retrieve bookmarks for a channel

### Channel Header Mentions

**Extraction:** `server/public/model/channel_mentions.go`

```go
// Regex: \B~[a-zA-Z0-9\-_]+
func ChannelMentions(message string) []string
```

**Processing:** `server/channels/app/channel.go` → `FillInChannelsProps()`
- Extracts `~channel-name` mentions from `channel.Header`
- Resolves to actual channels (public only)
- Stores in `channel.Props["channel_mentions"]`

**Frontend:**
- `webapp/channels/src/components/channel_header/channel_header_text.tsx`
- Uses `channelNamesMap` prop for rendering clickable mentions

### Existing UI Patterns

| Pattern | Location | Reusability |
|---------|----------|-------------|
| Browse Channels Modal | `components/browse_channels/` | Search/filter pattern |
| Channel Info RHS | `components/channel_info_rhs/` | Panel structure |
| Sidebar Categories | `components/sidebar/` | Channel grouping |
| Virtualized Lists | `components/threading/global_threads/` | Performance |
| Drag-and-drop | `react-beautiful-dnd` | Reordering |

---

## Data Model

### Explicit Relationship Table

New table: `channel_relationships`

```sql
CREATE TABLE channel_relationships (
    id VARCHAR(26) PRIMARY KEY,
    source_channel_id VARCHAR(26) NOT NULL,
    target_channel_id VARCHAR(26) NOT NULL,
    relationship_type VARCHAR(32) NOT NULL,  -- 'bookmark', 'mention', 'link'
    created_at BIGINT NOT NULL,
    metadata JSONB,  -- Optional: store context (bookmark_id, mention_context, etc.)

    CONSTRAINT fk_source FOREIGN KEY (source_channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    CONSTRAINT fk_target FOREIGN KEY (target_channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    UNIQUE(source_channel_id, target_channel_id, relationship_type)
);

CREATE INDEX idx_channel_rel_source ON channel_relationships(source_channel_id);
CREATE INDEX idx_channel_rel_target ON channel_relationships(target_channel_id);
```

**Go Model:**

```go
type ChannelRelationship struct {
    Id               string                 `json:"id"`
    SourceChannelId  string                 `json:"source_channel_id"`
    TargetChannelId  string                 `json:"target_channel_id"`
    RelationshipType ChannelRelationType    `json:"relationship_type"`
    CreatedAt        int64                  `json:"created_at"`
    Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

type ChannelRelationType string

const (
    ChannelRelationBookmark ChannelRelationType = "bookmark"
    ChannelRelationMention  ChannelRelationType = "mention"
    ChannelRelationLink     ChannelRelationType = "link"
)
```

---

## Backend Implementation

### Phase 1: Relationship Extraction

#### 1.1 Parse Channel URLs from Bookmarks

**File:** `server/channels/app/channel_relationships.go` (new)

```go
// ExtractChannelIdFromUrl parses Mattermost channel URLs
// Supports:
//   - /team-name/channels/channel-name
//   - /team-name/channels/channel-id
//   - Full URLs with domain
func (a *App) ExtractChannelIdFromUrl(url string) (string, error)

// SyncBookmarkRelationships scans bookmarks and creates/updates relationships
func (a *App) SyncBookmarkRelationships(channelId string) error
```

**URL Patterns to Match:**
```
/team/channels/channel-name
/team/channels/channel-id
https://mattermost.example.com/team/channels/channel-name
~channel-name (in header)
```

#### 1.2 Extract Header Link URLs

Extend existing `FillInChannelsProps()` or create new function:

```go
// ExtractChannelLinksFromHeader parses markdown links pointing to channels
func (a *App) ExtractChannelLinksFromHeader(header string) []string
```

**Regex for Markdown Links:**
```go
var channelLinkRegex = regexp.MustCompile(`\[([^\]]+)\]\((/[^/]+/channels/[^)]+)\)`)
```

#### 1.3 Relationship Store

**File:** `server/channels/store/sqlstore/channel_relationship_store.go` (new)

```go
type ChannelRelationshipStore interface {
    Save(relationship *model.ChannelRelationship) (*model.ChannelRelationship, error)
    Delete(id string) error
    GetBySourceChannel(channelId string) ([]*model.ChannelRelationship, error)
    GetByTargetChannel(channelId string) ([]*model.ChannelRelationship, error)
    GetRelatedChannels(channelId string) ([]*model.Channel, error)  // Both directions
    DeleteBySourceAndType(channelId string, relType ChannelRelationType) error
}
```

### Phase 2: API Endpoints

**File:** `server/channels/api4/channel_relationships.go` (new)

```go
// GET /api/v4/channels/{channel_id}/relationships
// Returns all related channels (both directions)
func getChannelRelationships(c *Context, w http.ResponseWriter, r *http.Request)
```

**Response Structure:**

```go
type ChannelRelationshipsResponse struct {
    Relationships []*ChannelRelationship `json:"relationships"`
    Channels      map[string]*Channel    `json:"channels"`  // Referenced channel data
}
```

### Phase 3: Event Hooks

Sync relationships when:

1. **Bookmark created/updated/deleted** → `channel_bookmark.go`
2. **Channel header updated** → `channel.go` in `UpdateChannel()`
3. **Channel deleted** → Cascade delete relationships

```go
// In UpdateChannel, after header changes:
if patch.Header != nil && *patch.Header != channel.Header {
    a.SyncHeaderRelationships(channel.Id, *patch.Header)
}
```

---

## Frontend Implementation

### Phase 1: Data Layer

#### 1.1 Types

**File:** `webapp/platform/types/src/channel_relationships.ts` (new)

```typescript
export type ChannelRelationshipType = 'bookmark' | 'mention' | 'link';

export type ChannelRelationship = {
    id: string;
    source_channel_id: string;
    target_channel_id: string;
    relationship_type: ChannelRelationshipType;
    created_at: number;
    metadata?: Record<string, unknown>;
};
```

#### 1.2 Redux Actions

**File:** `webapp/channels/src/packages/mattermost-redux/src/actions/channel_relationships.ts` (new)

```typescript
export function fetchChannelRelationships(channelId: string): ActionFunc
```

#### 1.3 Redux Reducer

**File:** `webapp/channels/src/packages/mattermost-redux/src/reducers/entities/channel_relationships.ts` (new)

```typescript
type ChannelRelationshipsState = {
    byChannelId: {
        [channelId: string]: {
            relationships: ChannelRelationship[];
            loading: boolean;
            error?: string;
        };
    };
};
```

### Phase 2: UI Components

#### 2.1 Related Channels List

**File:** `webapp/channels/src/components/related_channels/related_channels_list.tsx` (new)

```tsx
type Props = {
    channelId: string;
};

const RelatedChannelsList: React.FC<Props> = ({channelId}) => {
    // Fetch relationships
    // Group by relationship type
    // Render list with channel icons, names, and relationship badges
};
```

**Features:**
- Grouped by relationship type (bookmarks, mentions, links)
- Click to navigate to channel
- Show relationship direction (incoming vs outgoing)

#### 2.2 Channel Info RHS Integration

Add collapsible section in `channel_info_rhs.tsx`:

```tsx
<AboutAreaCollapsibleSection title="Related Channels">
    <RelatedChannelsList channelId={channel.id} />
</AboutAreaCollapsibleSection>
```

This integrates naturally into the existing Channel Info panel without adding new navigation patterns.

---

## Open Questions

### Product Questions

1. **Scope of relationships:**
   - Cross-team channels? (likely yes for shared channels)
   - Private channel visibility? (respect permissions)
   - Archived channels? (show but distinguish)

2. **Relationship strength:**
   - Should we weight relationships? (e.g., multiple bookmarks = stronger)
   - Show relationship count or just existence?

3. **Bi-directional display:**
   - Channel A bookmarks B → show B in A's related, and A in B's related?
   - Or only show outgoing relationships?

4. **Discovery vs Navigation:**
   - Is this for finding new channels or navigating existing connections?
   - Should we include AI/ML suggested channels based on content similarity?

### Technical Questions

1. **Performance:**
   - How deep should graph queries go? (recommend max 2-3 hops)
   - Caching strategy for relationship data?
   - Lazy loading for large graphs?

2. **Real-time updates:**
   - WebSocket events for relationship changes?
   - Optimistic updates in UI?

3. **Migration:**
   - Backfill existing bookmarks/headers on feature enable?
   - Or build relationships incrementally as channels are accessed?

---

## POC Scope

### Phase 1: Backend Infrastructure

- [ ] Create `channel_relationships` table and migration
- [ ] Implement `ChannelRelationshipStore` with basic CRUD
- [ ] Add bookmark URL parsing for channel detection
- [ ] Add header mention extraction (reuse existing)
- [ ] Create `GET /api/v4/channels/{id}/relationships` endpoint
- [ ] Add event hooks for bookmark/header changes

### Phase 2: Frontend Display

- [ ] Add TypeScript types for relationships
- [ ] Create Redux actions/reducers
- [ ] Build `RelatedChannelsList` component
- [ ] Integrate into Channel Info RHS as collapsible section

### Out of Scope for POC

- AI/ML suggestions
- Relationship strength/weighting
- Mobile support
- Cross-team relationships (see Phase 3)

### Future Iterations

- **Graph Visualization:** Channel Explorer with force-directed graph using `react-force-graph-2d`
- **Channel Directory:** Full searchable directory showing all channel relationships
- **Browse Channels Integration:** "Related" tab in Browse Channels modal
- **Dedicated RHS Panel:** Standalone panel for exploring relationships in depth

---

## Phase 3: Cross-Team Relationships

Enable relationships between channels across different teams, useful for organizations with multiple teams that have related projects or shared contexts.

### Use Cases

1. **Shared Projects:** A project channel in Team A links to related channels in Team B
2. **Cross-functional Teams:** Engineering team channel references Design team channel
3. **Shared Channels:** Channels shared across teams naturally have cross-team relationships
4. **Organization-wide Discovery:** Users can discover relevant channels outside their primary team

### Data Model Changes

#### Schema Update

Add `team_id` tracking to relationships for cross-team queries:

```sql
ALTER TABLE channel_relationships
ADD COLUMN source_team_id VARCHAR(26),
ADD COLUMN target_team_id VARCHAR(26);

CREATE INDEX idx_channel_rel_source_team ON channel_relationships(source_team_id);
CREATE INDEX idx_channel_rel_target_team ON channel_relationships(target_team_id);

-- Backfill existing relationships
UPDATE channel_relationships cr
SET source_team_id = c.teamid
FROM channels c
WHERE cr.source_channel_id = c.id;

UPDATE channel_relationships cr
SET target_team_id = c.teamid
FROM channels c
WHERE cr.target_channel_id = c.id;
```

#### Model Update

```go
type ChannelRelationship struct {
    // ... existing fields
    SourceTeamId    string `json:"source_team_id,omitempty"`
    TargetTeamId    string `json:"target_team_id,omitempty"`
}

// IsCrossTeam returns true if the relationship spans different teams
func (r *ChannelRelationship) IsCrossTeam() bool {
    return r.SourceTeamId != "" && r.TargetTeamId != "" && r.SourceTeamId != r.TargetTeamId
}
```

### API Changes

#### New Endpoints

```go
// GET /api/v4/teams/{team_id}/channel-relationships
// Returns all relationships involving channels in this team
func getTeamChannelRelationships(c *Context, w http.ResponseWriter, r *http.Request)

// GET /api/v4/channel-relationships/cross-team
// Returns all cross-team relationships the user can see
func getCrossTeamRelationships(c *Context, w http.ResponseWriter, r *http.Request)
```

#### Query Parameters

```
?include_cross_team=true    // Include cross-team relationships (default: false for POC)
?target_team_id=xxx         // Filter to relationships with specific team
```

### Permission Model

Cross-team relationships require careful permission handling:

```go
// CanViewCrossTeamRelationship checks if user can see a cross-team relationship
func (a *App) CanViewCrossTeamRelationship(rctx request.CTX, userId string, rel *model.ChannelRelationship) bool {
    // User must be member of at least one of the teams
    sourceTeamMember := a.IsUserTeamMember(userId, rel.SourceTeamId)
    targetTeamMember := a.IsUserTeamMember(userId, rel.TargetTeamId)

    if !sourceTeamMember && !targetTeamMember {
        return false
    }

    // User must have read access to both channels
    sourceAccess := a.HasPermissionToChannel(rctx, userId, rel.SourceChannelId, model.PermissionReadChannel)
    targetAccess := a.HasPermissionToChannel(rctx, userId, rel.TargetChannelId, model.PermissionReadChannel)

    return sourceAccess && targetAccess
}
```

### UI Changes

#### Cross-Team Indicator

Show visual indicator for cross-team relationships:

```tsx
const RelatedChannelItem: React.FC<Props> = ({relationship, channel}) => {
    const isCrossTeam = relationship.source_team_id !== relationship.target_team_id;

    return (
        <div className="related-channel-item">
            <ChannelIcon channel={channel} />
            <span className="channel-name">{channel.display_name}</span>
            {isCrossTeam && (
                <Badge variant="info" size="sm">
                    {targetTeam.display_name}
                </Badge>
            )}
        </div>
    );
};
```

#### Team Filter

Add team filtering in the Related Channels list:

```tsx
<FilterDropdown
    options={[
        {value: 'all', label: 'All Teams'},
        {value: 'current', label: 'Current Team Only'},
        ...availableTeams.map(t => ({value: t.id, label: t.display_name}))
    ]}
    value={teamFilter}
    onChange={setTeamFilter}
/>
```

### Store Changes

```go
// GetCrossTeamRelationships returns relationships that span multiple teams
func (s *SqlChannelRelationshipStore) GetCrossTeamRelationships(userId string) ([]*model.ChannelRelationship, error)

// GetRelationshipsByTeam returns all relationships involving a specific team
func (s *SqlChannelRelationshipStore) GetRelationshipsByTeam(teamId string) ([]*model.ChannelRelationship, error)
```

### Configuration

```go
// Feature flag for cross-team relationships
ServiceSettings.EnableCrossTeamChannelRelationships *bool `json:"EnableCrossTeamChannelRelationships"`
```

### Open Questions for Cross-Team

1. **Discovery Scope:** Should users see cross-team relationships for channels they can't join?
2. **Admin Controls:** Should admins be able to disable cross-team relationship creation?
3. **Shared Channels:** How do shared channels (already cross-team) interact with this feature?
4. **Performance:** Cross-team queries span more data - caching strategy needed?

### Implementation Checklist

- [ ] Add team_id columns to channel_relationships table
- [ ] Update model with team fields and IsCrossTeam() helper
- [ ] Add store methods for cross-team queries
- [ ] Add permission checks for cross-team viewing
- [ ] Create cross-team API endpoints
- [ ] Add feature flag
- [ ] Update UI with cross-team indicators
- [ ] Add team filter to Related Channels list
- [ ] Backfill migration for existing relationships
- [ ] Performance testing with cross-team queries

---

## Success Metrics

1. **Adoption:** % of users who view related channels
2. **Navigation:** Click-through rate on related channels
3. **Discovery:** New channels joined via related suggestions
4. **Performance:** API response time < 100ms for relationship queries

---

## Key Files Reference

### Backend (Existing)

| File | Purpose |
|------|---------|
| `server/public/model/channel_bookmark.go` | Bookmark model (read `LinkUrl`) |
| `server/public/model/channel_mentions.go` | Mention extraction regex |
| `server/channels/app/channel.go` | Channel app logic, `FillInChannelsProps()` |
| `server/channels/store/sqlstore/channel_bookmark_store.go` | Bookmark store |

### Backend (New)

| File | Purpose |
|------|---------|
| `server/public/model/channel_relationship.go` | Relationship model |
| `server/channels/app/channel_relationships.go` | Relationship app logic |
| `server/channels/store/sqlstore/channel_relationship_store.go` | Relationship store |
| `server/channels/api4/channel_relationships.go` | API endpoints |

### Frontend (Existing)

| File | Purpose |
|------|---------|
| `webapp/platform/types/src/channel_bookmarks.ts` | Bookmark types |
| `webapp/channels/src/components/channel_info_rhs/` | Channel info panel (integration point) |

### Frontend (New)

| File | Purpose |
|------|---------|
| `webapp/platform/types/src/channel_relationships.ts` | Relationship types |
| `webapp/channels/src/packages/mattermost-redux/src/actions/channel_relationships.ts` | Redux actions |
| `webapp/channels/src/packages/mattermost-redux/src/reducers/entities/channel_relationships.ts` | Redux reducer |
| `webapp/channels/src/components/related_channels/` | UI components |

---

## Next Steps

1. Review this plan with product/design
2. Finalize open questions (permissions, bi-directionality, backfill strategy)
3. Create Jira epic and stories
4. Begin Phase 1: Backend infrastructure
