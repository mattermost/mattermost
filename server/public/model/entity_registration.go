// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// EntitiesDisabledError is the AppError id returned by the entity registration
// API when the feature is off. A plugin that sees it keeps its own behavior.
const EntitiesDisabledError = "app.entities.disabled.app_error"

// EntityType is one named kind of entity. Name is local to the plugin that
// registers it: lowercase letters, digits, "_" and "-", in dot-separated
// segments. Everywhere else the type is known by its id, "owner:name", where
// the owner is the plugin id. Built-in types are owned by "mm", such as "mm:time".
type EntityType struct {
	Name        string       `json:"name"`
	DisplayName string       `json:"display_name"`
	Badge       *EntityBadge `json:"badge,omitempty"`
}

// EntityMatcher is a RE2 pattern that finds one type in message text.
// ValueGroup selects the capture that becomes the canonical value. Zero is the whole match.
// SpanGroup selects the underlined text. Zero means the value group.
// URL is an optional template. Placeholders are {value} and named or numbered groups,
// and each may appear more than once. The scheme is https, http, or a root-relative path.
// Boundary is a preset: empty and "token" are the original neighbor rule.
// Scope lists "team" or "team/channel" names. Empty means the whole server.
// SkipBots leaves the match off a bot post. The zero value scans bots.
// Name is local to the plugin, like EntityType.Name. Type is the name of one of
// the plugin's own types, or the id of a built-in type, such as "mm:time".
type EntityMatcher struct {
	Name       string   `json:"name"`
	Type       string   `json:"type"`
	Pattern    string   `json:"pattern"`
	ValueGroup int      `json:"value_group"`
	SpanGroup  int      `json:"span_group,omitempty"`
	URL        string   `json:"url,omitempty"`
	Scope      []string `json:"scope,omitempty"`
	Boundary   string   `json:"boundary,omitempty"`
	SkipBots   bool     `json:"skip_bots,omitempty"`
	// DynamicBadge asks the owning plugin's EntityBadges hook for a per-value
	// badge when the post is scanned. The answer is stored with the pattern
	// cache and does not call EntityLookup.
	DynamicBadge bool `json:"dynamic_badge,omitempty"`
}

const (
	// EntityCacheNone calls the provider on every open and stores nothing.
	EntityCacheNone = "none"
	// EntityCacheShared stores one card per value for every reader of a post
	// that contains that value. A lookup with no post is not stored, and this
	// mode is not permission to fetch it.
	EntityCacheShared = "shared"
	// EntityCacheUser stores a separate card for each reader.
	EntityCacheUser = "user"
)

// EntityProvider is a plugin that can describe values of one or more types.
// Name is local to the plugin, and each of Types is written as in EntityMatcher.Type.
// HasCard means the server calls the plugin's EntityLookup hook. Cache selects
// whether a card read from a post is stored: shared, user, or none. An empty
// Cache is none. A shared card is one stored value for every reader of that
// post, so it must not depend on the caller. A card that depends on who is
// asking uses user or none. A lookup with no post is not stored, and the
// plugin decides whether that caller may see it. A glossary term is not sent
// on that lookup unless a matcher accepts the whole value.
// Cache is not an access grant.
// CacheTTLSeconds is the lifetime for a stored card. Zero uses the server default.
type EntityProvider struct {
	Name            string   `json:"name"`
	Types           []string `json:"types"`
	HasCard         bool     `json:"has_card"`
	Cache           string   `json:"cache,omitempty"`
	CacheTTLSeconds int      `json:"cache_ttl_seconds,omitempty"`
}

// EntityLookupRequest is the value a provider is asked to describe. With no
// post, Value matched a registered pattern. With a post, it was read from
// that post. Provider and Type are written the way the plugin registered
// them: a bare name for its own, and an id such as "mm:time" for a built-in type.
type EntityLookupRequest struct {
	Provider string `json:"provider"`
	Type     string `json:"type"`
	Value    string `json:"value"`
	// UserID is always the caller. When PostID is set, the server has already
	// required that this caller can read the post. When PostID is empty, the
	// plugin allows or refuses.
	UserID string `json:"user_id,omitempty"`
	// PostID and CreateAt identify the post the value was read from.
	// CreateAt is the reference for a token that omits its month or year.
	// An empty PostID means the server has not checked access to a post.
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
