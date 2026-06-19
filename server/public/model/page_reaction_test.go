// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func validPageReaction() *PageReaction {
	return &PageReaction{
		PageId:    NewId(),
		UserId:    NewId(),
		EmojiName: "+1",
		CreateAt:  GetMillis(),
	}
}

func TestPageReactionIsValid(t *testing.T) {
	require.Nil(t, validPageReaction().IsValid())

	cases := []struct {
		name   string
		mutate func(*PageReaction)
	}{
		{"empty page id", func(r *PageReaction) { r.PageId = "" }},
		{"invalid page id", func(r *PageReaction) { r.PageId = "not-an-id" }},
		{"empty user id", func(r *PageReaction) { r.UserId = "" }},
		{"empty emoji name", func(r *PageReaction) { r.EmojiName = "" }},
		{"emoji name with a space", func(r *PageReaction) { r.EmojiName = "thumbs up" }},
		{"emoji name too long", func(r *PageReaction) { r.EmojiName = strings.Repeat("a", EmojiNameMaxLength+1) }},
		{"zero create_at", func(r *PageReaction) { r.CreateAt = 0 }},
	}
	for _, c := range cases {
		t.Run(c.name+" is invalid", func(t *testing.T) {
			r := validPageReaction()
			c.mutate(r)
			require.NotNil(t, r.IsValid())
		})
	}

	t.Run("hyphen/underscore/plus emoji names are valid", func(t *testing.T) {
		for _, name := range []string{"smile", "+1", "-1", "a_b", "white-check-mark"} {
			r := validPageReaction()
			r.EmojiName = name
			require.Nil(t, r.IsValid(), name)
		}
	})
}

func TestPageReactionPreSave(t *testing.T) {
	r := &PageReaction{PageId: NewId(), UserId: NewId(), EmojiName: "+1"}
	r.PreSave()
	require.NotZero(t, r.CreateAt)

	explicit := &PageReaction{CreateAt: 12345}
	explicit.PreSave()
	require.Equal(t, int64(12345), explicit.CreateAt, "an explicit CreateAt is preserved")
}
