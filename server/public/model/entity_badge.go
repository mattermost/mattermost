// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"unicode"
	"unicode/utf8"
)

const (
	EntityBadgeColorNone     = "none"
	EntityBadgeColorLow      = "low"
	EntityBadgeColorMedium   = "medium"
	EntityBadgeColorHigh     = "high"
	EntityBadgeColorCritical = "critical"

	maxEntityBadgeTextRunes = 4
)

// EntityBadgeIcons is the Compass glyph allowlist a badge may name.
var EntityBadgeIcons = map[string]struct{}{
	"shield-outline":       {},
	"shield-alert-outline": {},
	"alert-outline":        {},
	"lock-outline":         {},
}

// EntityBadge is the optional leading chrome on an entity mention. Text and
// Icon are mutually exclusive: exactly one must be set for a badge to be valid.
type EntityBadge struct {
	Text  string `json:"text,omitempty"`
	Icon  string `json:"icon,omitempty"`
	Color string `json:"color,omitempty"`
}

// EntityBadgeItem names one value a provider may badge.
type EntityBadgeItem struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

// EntityBadgeRequest is the batched badge lookup. Items are deduped by the
// server, at most 100. The result has the same order as Items; a nil entry
// means no badge for that item.
type EntityBadgeRequest struct {
	Items []EntityBadgeItem `json:"items"`
}

// IsValid reports whether the badge is well-formed. A nil badge is valid
// (meaning "no badge"). An empty non-nil badge is not.
func (b *EntityBadge) IsValid() bool {
	if b == nil {
		return true
	}
	hasText := b.Text != ""
	hasIcon := b.Icon != ""
	if hasText == hasIcon {
		return false
	}
	if hasText && !entityBadgeTextOK(b.Text) {
		return false
	}
	if hasIcon {
		if _, ok := EntityBadgeIcons[b.Icon]; !ok {
			return false
		}
	}
	switch b.Color {
	case "", EntityBadgeColorNone, EntityBadgeColorLow, EntityBadgeColorMedium, EntityBadgeColorHigh, EntityBadgeColorCritical:
		return true
	default:
		return false
	}
}

func entityBadgeTextOK(text string) bool {
	n := utf8.RuneCountInString(text)
	if n < 1 || n > maxEntityBadgeTextRunes {
		return false
	}
	for _, r := range text {
		if r != '.' && !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}
