// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// EntitiesDisabledError is the AppError id returned by the entity registration
// API when the feature is off. A plugin that sees it keeps its own behavior.
const EntitiesDisabledError = "app.entities.disabled.app_error"

// EntityType is one named kind of entity. Core types use an mm. id. A plugin
// type id is the plugin id, a dot, and a name.
type EntityType struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
}

// EntityMatcher is a RE2 pattern that finds one type in message text.
// ValueGroup selects the capture that becomes the canonical value. Zero is the whole match.
// SpanGroup selects the underlined text. Zero means the value group.
// URL is an optional template. Placeholders are {value} and named or numbered groups,
// and each may appear more than once. The scheme is https, http, or a root-relative path.
// Boundary is a preset: empty and "token" are the original neighbor rule.
// Scope lists "team" or "team/channel" names. Empty means the whole server.
// SkipBots leaves the match off a bot post. The zero value scans bots.
type EntityMatcher struct {
	ID         string   `json:"id"`
	TypeID     string   `json:"type_id"`
	Pattern    string   `json:"pattern"`
	ValueGroup int      `json:"value_group"`
	SpanGroup  int      `json:"span_group,omitempty"`
	URL        string   `json:"url,omitempty"`
	Scope      []string `json:"scope,omitempty"`
	Boundary   string   `json:"boundary,omitempty"`
	SkipBots   bool     `json:"skip_bots,omitempty"`
}

const (
	// EntityCacheNone calls the provider on every open and stores nothing.
	EntityCacheNone = "none"
	// EntityCacheShared stores one card per value for every reader.
	EntityCacheShared = "shared"
	// EntityCacheUser stores a separate card for each reader.
	EntityCacheUser = "user"
)

// EntityProvider is a plugin that can describe values of one or more types.
// HasCard means the server calls the plugin's EntityLookup hook. Cache selects
// whether that card is stored: shared, user, or none. An empty Cache is none.
// CacheTTLSeconds is the lifetime for a stored card. Zero uses the server default.
type EntityProvider struct {
	ID              string   `json:"id"`
	TypeIDs         []string `json:"type_ids"`
	HasCard         bool     `json:"has_card"`
	Cache           string   `json:"cache,omitempty"`
	CacheTTLSeconds int      `json:"cache_ttl_seconds,omitempty"`
}

// EntityLookupRequest is the value a provider is asked to describe. The
// server fills it from a value that matched a registered pattern.
type EntityLookupRequest struct {
	ProviderID string `json:"provider_id"`
	TypeID     string `json:"type_id"`
	Value      string `json:"value"`
	// UserID is set when the card may differ by reader. A shared cache leaves it empty.
	UserID string `json:"user_id,omitempty"`
	// PostID and CreateAt identify the post the value was read from.
	// CreateAt is the reference for a token that omits its month or year.
	PostID   string `json:"post_id,omitempty"`
	CreateAt int64  `json:"create_at,omitempty"`
}

// EntityTerm is an exact token. The title is the expansion shown on hover,
// and the URL is the link, either https or a root-relative path.
type EntityTerm struct {
	Value string `json:"value"`
	Title string `json:"title"`
	URL   string `json:"url"`
}
