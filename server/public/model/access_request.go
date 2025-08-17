// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// Subject represents the user or a virtual entity for which the Authorization
// API is called.
type Subject struct {
	// ID is the unique identifier of the Subject.
	// it can be a user ID, bot ID, etc and it is scoped to the Type.
	ID string `json:"id"`
	// Type specifies the type of the Subject, eg. user, bot, etc.
	Type string `json:"type"`
	// Attributes are the key-value pairs assicuated with the subject.
	// An attribute may be single-valued or multi-valued and can be a primitive type
	// (string, boolean, number) or a complex type like a JSON object or array.
	Attributes map[string]any `json:"attributes"`
}

type SubjectSearchOptions struct {
	Term   string `json:"term"`
	TeamID string `json:"team_id"`
	// Query and Args should be generated within the Access Control Service
	// and passed here wrt database driver
	Query         string        `json:"query"`
	Args          []any         `json:"args"`
	Limit         int           `json:"limit"`
	Cursor        SubjectCursor `json:"cursor"`
	AllowInactive bool          `json:"allow_inactive"`
	IgnoreCount   bool          `json:"ignore_count"`
	// ExcludeChannelMembers is used to exclude members from the search results
	// specifically used when syncing channel members
	ExcludeChannelMembers string `json:"exclude_members"`
}

type SubjectCursor struct {
	TargetID string `json:"target_id"`
}

// Resource is the target of an access request.
type Resource struct {
	// ID is the unique identifier of the Resource.
	// It can be a channel ID, post ID, etc and it is scoped to the Type.
	ID string `json:"id"`
	// Type specifies the type of the Resource, eg. channel, post, etc.
	Type string `json:"type"`
}

// AccessRequest represents the input to the Policy Decision Point (PDP).
// It contains the Subject, Resource, Action and optional Context attributes.
type AccessRequest struct {
	Subject  Subject        `json:"subject"`
	Resource Resource       `json:"resource"`
	Action   string         `json:"action"`
	Context  map[string]any `json:"context,omitempty"`
}

// The PDP evaluates the request and returns an AccessDecision.
// The Decision field is a boolean indicating whether the request is allowed or not.
type AccessDecision struct {
	Decision bool           `json:"decision"`
	Context  map[string]any `json:"context,omitempty"`
}

type QueryExpressionParams struct {
	Expression string `json:"expression"`
	Term       string `json:"term"`
	Limit      int    `json:"limit"`
	After      string `json:"after"`
}
