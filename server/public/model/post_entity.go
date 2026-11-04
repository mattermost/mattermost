// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PostEntity is one detected occurrence in a post message. Start and End are
// UTF-16 code unit offsets into Post.Message, which is how the web and mobile
// clients index strings. ID is "<start>:<end>".
type PostEntity struct {
	ID          string   `json:"id"`
	Start       int      `json:"start"`
	End         int      `json:"end"`
	TypeIDs     []string `json:"type_ids"`
	MatcherID   string   `json:"matcher_id"`
	Value       string   `json:"value"`
	URL         string   `json:"url,omitempty"`
	DisplayName string   `json:"display_name,omitempty"`
	Title       string   `json:"title,omitempty"`
	// HasCard is true when a provider can open a side panel for this span.
	// It is filled when the post is read, from the registrations active then.
	HasCard bool `json:"has_card,omitempty"`
}

// EntityPatternCache is the pattern detection for one message hash.
// Terms are applied when the post is read and are not stored here.
type EntityPatternCache struct {
	Generation string
	Protected  [][2]int
	Patterns   []*PostEntity
}
