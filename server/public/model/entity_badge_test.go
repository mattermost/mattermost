// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEntityBadgeIsValid(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		badge *EntityBadge
		ok    bool
	}{
		{name: "nil", badge: nil, ok: true},
		{name: "empty", badge: &EntityBadge{}, ok: false},
		{name: "both", badge: &EntityBadge{Text: "9.8", Icon: "shield-outline"}, ok: false},
		{name: "text", badge: &EntityBadge{Text: "9.8", Color: EntityBadgeColorCritical}, ok: true},
		{name: "icon", badge: &EntityBadge{Icon: "shield-outline"}, ok: true},
		{name: "bad icon", badge: &EntityBadge{Icon: "not-a-glyph"}, ok: false},
		{name: "bad color", badge: &EntityBadge{Text: "H", Color: "#cc0500"}, ok: false},
		{name: "long text", badge: &EntityBadge{Text: "12345"}, ok: false},
		{name: "bad text char", badge: &EntityBadge{Text: "9/8"}, ok: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.ok, tc.badge.IsValid())
		})
	}
}
