// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Server-side definitions for the post.props.mm_blocks_actions registry that
// underpins the markdown-actions feature.
package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/url"
)

var (
	// ErrMmBlocksActionNotFound is returned when the action id is missing or not an executable mm_blocks action.
	ErrMmBlocksActionNotFound = errors.New("mm_blocks action not found")
)

// MmBlocksActionResolved is the outcome of resolving an mm_blocks action for execution.
type MmBlocksActionResolved struct {
	OpenURLGoto string
	ExternalURL string
	Context     map[string]any
}

const (
	MmBlocksActionTypeExternal = "external"
	MmBlocksActionTypeOpenURL  = "openURL"
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
	spec := &MmBlocksActionSpec{Type: typ}
	switch typ {
	case MmBlocksActionTypeExternal:
		spec.URL, _ = entryMap["url"].(string)
		spec.Context = contextMapFromProp(entryMap["context"])
		spec.Query = stringMapFromPropValue(entryMap["query"])
		return spec
	case MmBlocksActionTypeOpenURL:
		spec.URL, _ = entryMap["url"].(string)
		spec.Query = stringMapFromPropValue(entryMap["query"])
		return spec
	default:
		return nil
	}
}

// ActionSpec returns the server-side spec for one action id from the cookie actions map.
func (m *MmBlocksActionCookie) ActionSpec(actionID string) *MmBlocksActionSpec {
	if m == nil || actionID == "" || m.Actions == nil {
		return nil
	}
	entry, ok := m.Actions[actionID]
	if !ok || entry == nil {
		return nil
	}
	entryMap, ok := coerceToStringAnyMap(entry)
	if !ok {
		return nil
	}
	return mmBlocksEntryMapToSpec(entryMap)
}

// ResolveMmBlocksAction resolves spec for execution: openURL returns OpenURLGoto; external returns ExternalURL and Context.
func ResolveMmBlocksAction(spec *MmBlocksActionSpec, actionID string, clientQuery map[string]string) (*MmBlocksActionResolved, error) {
	if spec == nil {
		return nil, fmt.Errorf("mm_blocks action_id=%s: %w", actionID, ErrMmBlocksActionNotFound)
	}
	switch spec.Type {
	case MmBlocksActionTypeOpenURL:
		if spec.URL == "" {
			return nil, fmt.Errorf("mm_blocks action_id=%s: %w", actionID, ErrMmBlocksActionNotFound)
		}
		gotoURL, err := MergeQueryIntoURL(spec.URL, spec.Query)
		if err != nil {
			return nil, err
		}
		return &MmBlocksActionResolved{OpenURLGoto: gotoURL}, nil

	case MmBlocksActionTypeExternal:
		if spec.URL == "" {
			return nil, fmt.Errorf("mm_blocks action_id=%s: %w", actionID, ErrMmBlocksActionNotFound)
		}
		upstreamURL, err := MergeQueryIntoURL(spec.URL, spec.Query)
		if err != nil {
			return nil, err
		}
		upstreamURL, err = MergeQueryIntoURL(upstreamURL, clientQuery)
		if err != nil {
			return nil, err
		}
		return &MmBlocksActionResolved{ExternalURL: upstreamURL, Context: spec.Context}, nil

	default:
		return nil, fmt.Errorf("mm_blocks action_id=%s: %w", actionID, ErrMmBlocksActionNotFound)
	}
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

// ParseDecryptedActionCookiePayload unmarshals decrypted cookie JSON from the client.
// Exactly one of legacy or mmBlocks is non-nil when err is nil (legacy attachment cookie vs mm_blocks cookie).
func ParseDecryptedActionCookiePayload(decrypted string) (legacy *PostActionCookie, mmBlocks *MmBlocksActionCookie, err error) {
	var probe struct {
		Kind string `json:"kind"`
	}
	if err := json.Unmarshal([]byte(decrypted), &probe); err != nil {
		return nil, nil, err
	}
	if probe.Kind == MmBlocksActionCookieKind {
		var mm MmBlocksActionCookie
		if err := json.Unmarshal([]byte(decrypted), &mm); err != nil {
			return nil, nil, err
		}
		return nil, &mm, nil
	}
	var c PostActionCookie
	if err := json.Unmarshal([]byte(decrypted), &c); err != nil {
		return nil, nil, err
	}
	return &c, nil, nil
}

// AddMmBlocksActionCookies encrypts the full mm_blocks_actions map into one cookie string stored in PostPropsMmBlocksActions.
func AddMmBlocksActionCookies(p *Post, secret []byte) {
	raw := p.GetProp(PostPropsMmBlocksActions)
	if raw == nil {
		return
	}
	actionsTop, ok := coerceToStringAnyMap(raw)
	if !ok || len(actionsTop) == 0 {
		return
	}

	retainProps := map[string]any{}
	removeProps := []string{}
	for _, key := range PostActionRetainPropKeys {
		value, ok := p.GetProps()[key]
		if ok {
			retainProps[key] = value
		} else {
			removeProps = append(removeProps, key)
		}
	}

	actionsForEnc := make(map[string]map[string]any, len(actionsTop))
	for actionID, val := range actionsTop {
		entryMap, ok := coerceToStringAnyMap(val)
		if !ok {
			continue
		}
		actionsForEnc[actionID] = entryMap
	}

	rootPostID := p.Id
	if p.RootId != "" {
		rootPostID = p.RootId
	}
	mmCookie := MmBlocksActionCookie{
		Kind:        MmBlocksActionCookieKind,
		PostId:      p.Id,
		RootPostId:  rootPostID,
		ChannelId:   p.ChannelId,
		RetainProps: retainProps,
		RemoveProps: removeProps,
		Actions:     actionsForEnc,
	}
	b, err := json.Marshal(mmCookie)
	if err != nil {
		return
	}
	enc, err := EncryptPostActionCookie(string(b), secret)
	if err != nil {
		return
	}
	p.AddProp(PostPropsMmBlocksActions, enc)
}

// StripMmBlocksActionSecrets removes server-only fields from props.mm_blocks_actions for wire serialization.
func (o *Post) StripMmBlocksActionSecrets() {
	raw := o.GetProp(PostPropsMmBlocksActions)
	if raw == nil {
		return
	}
	if _, ok := raw.(string); ok {
		// Already replaced with a single opaque encrypted cookie by AddMmBlocksActionCookies.
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
