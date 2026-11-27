// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"strings"
)

const (
	MmFieldToneDefault  = "default"
	MmFieldToneGood     = "good"
	MmFieldToneWarning  = "warning"
	MmFieldToneDanger   = "danger"
	MmFieldToneCritical = "critical"
)

// MmField is one labelled fact in an mm_blocks `fields` block.
type MmField struct {
	Label  string `json:"label"`
	Value  string `json:"value"`
	Short  bool   `json:"short,omitempty"`
	URL    string `json:"url,omitempty"`
	TypeID string `json:"type_id,omitempty"`
	Tone   string `json:"tone,omitempty"`
}

// MarshalMmFieldsBlock returns a single `fields` block as JSON, or nil when empty.
func MarshalMmFieldsBlock(fields []MmField) (json.RawMessage, error) {
	cleaned := make([]MmField, 0, len(fields))
	for _, f := range fields {
		if f.Label == "" && f.Value == "" {
			continue
		}
		if f.Tone != "" && !mmFieldToneOK(f.Tone) {
			f.Tone = ""
		}
		f.URL = entityCardURL(f.URL)
		cleaned = append(cleaned, f)
	}
	if len(cleaned) == 0 {
		return nil, nil
	}
	return json.Marshal(map[string]any{
		"type":   "fields",
		"fields": cleaned,
	})
}

// MarshalMmBlocks joins top-level mm_blocks into a JSON array.
func MarshalMmBlocks(blocks ...json.RawMessage) (json.RawMessage, error) {
	out := make([]json.RawMessage, 0, len(blocks))
	for _, b := range blocks {
		if len(b) == 0 || string(b) == "null" {
			continue
		}
		out = append(out, b)
	}
	if len(out) == 0 {
		return nil, nil
	}
	return json.Marshal(out)
}

// MarshalMmTextBlock returns a text block.
func MarshalMmTextBlock(text string, subtle bool) (json.RawMessage, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, nil
	}
	block := map[string]any{"type": "text", "text": text}
	if subtle {
		block["is_subtle"] = true
	}
	return json.Marshal(block)
}

// MarshalMmCollapsibleBlock returns a collapsible with text header and content blocks.
func MarshalMmCollapsibleBlock(header string, content []json.RawMessage, collapsed bool) (json.RawMessage, error) {
	header = strings.TrimSpace(header)
	if header == "" {
		return nil, nil
	}
	parts := make([]json.RawMessage, 0, len(content))
	for _, c := range content {
		if len(c) == 0 || string(c) == "null" {
			continue
		}
		parts = append(parts, c)
	}
	if len(parts) == 0 {
		return nil, nil
	}
	headerBlock, err := MarshalMmTextBlock(header, false)
	if err != nil || headerBlock == nil {
		return nil, err
	}
	var contentAny []any
	for _, p := range parts {
		var v any
		if err := json.Unmarshal(p, &v); err != nil {
			continue
		}
		contentAny = append(contentAny, v)
	}
	if len(contentAny) == 0 {
		return nil, nil
	}
	block := map[string]any{
		"type":    "collapsible",
		"header":  []any{mustUnmarshal(headerBlock)},
		"content": contentAny,
	}
	if collapsed {
		block["collapsed"] = true
	}
	return json.Marshal(block)
}

func mustUnmarshal(raw json.RawMessage) any {
	var v any
	_ = json.Unmarshal(raw, &v)
	return v
}

func mmFieldToneOK(tone string) bool {
	switch tone {
	case MmFieldToneDefault, MmFieldToneGood, MmFieldToneWarning, MmFieldToneDanger, MmFieldToneCritical:
		return true
	default:
		return false
	}
}

// MmFieldToneFromQualitative maps CVSS-style qualitative words onto field tones.
func MmFieldToneFromQualitative(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "none":
		return MmFieldToneDefault
	case "low":
		return MmFieldToneGood
	case "medium", "partial":
		return MmFieldToneWarning
	case "high", "complete", "changed":
		return MmFieldToneDanger
	case "critical":
		return MmFieldToneCritical
	default:
		return ""
	}
}
