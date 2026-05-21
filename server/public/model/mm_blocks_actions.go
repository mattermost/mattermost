// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Server-side definitions for the post.props.mm_blocks_actions registry that
// underpins the markdown-actions feature. Mirrors the canonical model
// landing in the broader mm_blocks framework PR; cookie transport
// (MmBlocksActionCookie, AddMmBlocksActionCookies, ParseDecryptedActionCookiePayload)
// is intentionally omitted here and will be filled in by that PR. Until then,
// mm_blocks_actions is resolved on click via DB lookup
// (GetMmBlocksActionSpec) and stripped from ephemeral broadcasts so dead
// buttons don't render.

package model

import (
	"encoding/json"
	"fmt"
	"maps"
	"net/url"
)

const (
	MmBlocksActionTypeExternal = "external"
)

// MmBlocksActionSpec is the server-side definition for one entry in props.mm_blocks_actions.
type MmBlocksActionSpec struct {
	Type    string
	URL     string
	Query   map[string]string
	Context map[string]any
}

// GetMmBlocksActionSpec returns the action definition for actionID from props.mm_blocks_actions, if present.
func (o *Post) GetMmBlocksActionSpec(actionID string) *MmBlocksActionSpec {
	raw := o.GetProp(PostPropsMmBlocksActions)
	if raw == nil || actionID == "" {
		return nil
	}
	actionsTop, ok := coerceToStringAnyMap(raw)
	if !ok {
		return nil
	}
	entry, ok := actionsTop[actionID]
	if !ok || entry == nil {
		return nil
	}
	entryMap, ok := coerceToStringAnyMap(entry)
	if !ok {
		return nil
	}
	return mmBlocksEntryMapToSpec(entryMap)
}

// mmBlocksEntryMapToSpec maps one props.mm_blocks_actions[actionID] object to MmBlocksActionSpec.
func mmBlocksEntryMapToSpec(entryMap map[string]any) *MmBlocksActionSpec {
	typ, _ := entryMap["type"].(string)
	if typ == "" {
		return nil
	}
	if typ != MmBlocksActionTypeExternal {
		return nil
	}
	spec := &MmBlocksActionSpec{Type: typ}
	spec.URL, _ = entryMap["url"].(string)
	spec.Context = contextMapFromProp(entryMap["context"])
	spec.Query = stringMapFromPropValue(entryMap["query"])
	return spec
}

// MmBlocksContextMap parses a context JSON string or treats a non-JSON string as a single context value.
func MmBlocksContextMap(contextString string) map[string]any {
	if contextString == "" {
		return nil
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(contextString), &m); err == nil && m != nil {
		return m
	}
	return map[string]any{"context": contextString}
}

// MergeQueryIntoURL merges q into rawURL's query string; existing keys are overwritten by q.
func MergeQueryIntoURL(rawURL string, q map[string]string) (string, error) {
	if len(q) == 0 {
		return rawURL, nil
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("parse url: %w", err)
	}
	values := u.Query()
	for k, v := range q {
		values.Set(k, v)
	}
	u.RawQuery = values.Encode()
	return u.String(), nil
}

// StripMmBlocksActionSecrets removes server-only fields from
// props.mm_blocks_actions for wire serialization. The current
// implementation deletes the prop wholesale; the cookie-transport PR will
// extend this to preserve encrypted-string cookie payloads in place.
func (o *Post) StripMmBlocksActionSecrets() {
	if o.GetProp(PostPropsMmBlocksActions) == nil {
		return
	}
	o.DelProp(PostPropsMmBlocksActions)
}

// contextMapFromProp normalizes props.mm_blocks_actions[*].context to map[string]any (JSON object or string).
func contextMapFromProp(v any) map[string]any {
	if v == nil {
		return nil
	}
	if s, ok := v.(string); ok {
		return MmBlocksContextMap(s)
	}
	if m, ok := coerceToStringAnyMap(v); ok {
		// Clone so callers cannot mutate the live post.Props map. A
		// nested mutation through the returned map would otherwise race
		// with concurrent post.Props readers.
		return maps.Clone(m)
	}
	return nil
}

func stringMapFromPropValue(v any) map[string]string {
	m, ok := coerceToStringAnyMap(v)
	if !ok || len(m) == 0 {
		return nil
	}
	out := make(map[string]string, len(m))
	for k, val := range m {
		if s, ok := val.(string); ok {
			out[k] = s
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func coerceToStringAnyMap(v any) (map[string]any, bool) {
	if v == nil {
		return nil, false
	}
	m, ok := v.(map[string]any)
	if ok {
		return m, true
	}
	return nil, false
}
