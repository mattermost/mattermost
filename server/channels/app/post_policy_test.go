// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestBlankPostInPlace(t *testing.T) {
	t.Run("clears message, file ids and attachments and sets sentinel", func(t *testing.T) {
		p := &model.Post{
			Id:        "p1",
			UserId:    "u1",
			ChannelId: "c1",
			CreateAt:  10,
			Type:      "",
			Message:   "top secret",
			FileIds:   []string{"f1", "f2"},
			Props: model.StringInterface{
				model.PostPropsAttachments: []any{map[string]any{"text": "secret"}},
				"keep_me":                  "ok",
			},
		}

		blankPostInPlace(p)

		require.Equal(t, "p1", p.Id, "Id must remain")
		require.Equal(t, "u1", p.UserId, "UserId must remain")
		require.Equal(t, "c1", p.ChannelId, "ChannelId must remain")
		require.Equal(t, int64(10), p.CreateAt, "CreateAt must remain")
		require.Empty(t, p.Message, "Message must be blanked")
		require.Nil(t, p.FileIds, "FileIds must be cleared")
		require.Nil(t, p.Props[model.PostPropsAttachments], "attachments prop must be cleared")
		require.Equal(t, true, p.Props[model.PostPropsHiddenByPolicy], "sentinel prop must be set")
		// Unrelated props are not stripped — only the leaky ones we know about.
		require.Equal(t, "ok", p.Props["keep_me"])
	})

	t.Run("initializes Props when nil", func(t *testing.T) {
		p := &model.Post{Id: "p2", Message: "hi"}
		blankPostInPlace(p)
		require.NotNil(t, p.Props)
		require.Equal(t, true, p.Props[model.PostPropsHiddenByPolicy])
	})

	t.Run("nil post is a no-op", func(t *testing.T) {
		require.NotPanics(t, func() { blankPostInPlace(nil) })
	})
}
