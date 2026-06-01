// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"net/url"
	"strings"
)

// Query parameter names recognised by the templating layer.
const (
	gateParamPrimary   = "template"
	gateParamAlias     = "tmpl"
	paramText          = "text"
	paramUsername      = "username"
	paramIconURL       = "icon_url"
	paramIconEmoji     = "icon_emoji"
	paramChannel       = "channel"
	paramPriority      = "priority"
)

// IsGateTruthy reports whether the caller has explicitly opted into
// templating via the gate query parameter (`template` or `tmpl`). Accepted
// truthy values are "1", "yes", "true" (case-insensitive). Any other value,
// or the param being absent, returns false.
//
// If both `template` and `tmpl` are supplied, the result is true iff either
// is truthy.
func IsGateTruthy(q url.Values) bool {
	return isTruthy(q.Get(gateParamPrimary)) || isTruthy(q.Get(gateParamAlias))
}

func isTruthy(v string) bool {
	switch strings.ToLower(v) {
	case "1", "yes", "true":
		return true
	}
	return false
}

// ExtractTextTemplate returns the value of the `text=` query param and true
// if it was present. An empty string with `text=` still counts as present.
func ExtractTextTemplate(q url.Values) (string, bool) {
	if _, ok := q[paramText]; !ok {
		return "", false
	}
	return q.Get(paramText), true
}

// ScalarTemplates carries the per-field template strings extracted from the
// query parameters. Each ...Present flag distinguishes "field absent" (leave
// the parsed payload value alone) from "field present with an empty value"
// (overwrite with empty string).
type ScalarTemplates struct {
	Text             string
	TextPresent      bool
	Username         string
	UsernamePresent  bool
	IconURL          string
	IconURLPresent   bool
	IconEmoji        string
	IconEmojiPresent bool
	Channel          string
	ChannelPresent   bool
	Priority         string
	PriorityPresent  bool
}

// Any reports whether at least one scalar template field was present in the
// query. Callers use this to decide whether the overlay step has any work
// to do.
func (s ScalarTemplates) Any() bool {
	return s.TextPresent || s.UsernamePresent || s.IconURLPresent ||
		s.IconEmojiPresent || s.ChannelPresent || s.PriorityPresent
}

// ExtractScalars pulls every templatable scalar field out of the query
// parameters. Returns a ScalarTemplates whose ...Present flags mark which
// fields the caller actually supplied.
func ExtractScalars(q url.Values) ScalarTemplates {
	s := ScalarTemplates{}
	if _, ok := q[paramText]; ok {
		s.Text, s.TextPresent = q.Get(paramText), true
	}
	if _, ok := q[paramUsername]; ok {
		s.Username, s.UsernamePresent = q.Get(paramUsername), true
	}
	if _, ok := q[paramIconURL]; ok {
		s.IconURL, s.IconURLPresent = q.Get(paramIconURL), true
	}
	if _, ok := q[paramIconEmoji]; ok {
		s.IconEmoji, s.IconEmojiPresent = q.Get(paramIconEmoji), true
	}
	if _, ok := q[paramChannel]; ok {
		s.Channel, s.ChannelPresent = q.Get(paramChannel), true
	}
	if _, ok := q[paramPriority]; ok {
		s.Priority, s.PriorityPresent = q.Get(paramPriority), true
	}
	return s
}
