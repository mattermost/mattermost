// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestBlankedPostFor(t *testing.T) {
	t.Run("returns clone with message, file ids and attachments cleared and sentinel set", func(t *testing.T) {
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

		blanked := blankedPostFor(p)

		require.NotSame(t, p, blanked, "must return a different pointer (avoid cache poisoning)")
		require.Equal(t, "top secret", p.Message, "original message must NOT be mutated")
		require.Equal(t, model.StringArray{"f1", "f2"}, p.FileIds, "original FileIds must NOT be mutated")
		require.Nil(t, p.Props[model.PostPropsHiddenByPolicy], "original Props must NOT gain the sentinel")
		require.NotNil(t, p.Props[model.PostPropsAttachments], "original attachments must remain")

		require.Equal(t, "p1", blanked.Id, "Id must remain on clone")
		require.Equal(t, "u1", blanked.UserId, "UserId must remain on clone")
		require.Equal(t, "c1", blanked.ChannelId, "ChannelId must remain on clone")
		require.Equal(t, int64(10), blanked.CreateAt, "CreateAt must remain on clone")
		require.Empty(t, blanked.Message, "Message must be blanked on clone")
		require.Nil(t, blanked.FileIds, "FileIds must be cleared on clone")
		require.Nil(t, blanked.Props[model.PostPropsAttachments], "attachments prop must be cleared on clone")
		require.Equal(t, true, blanked.Props[model.PostPropsHiddenByPolicy], "sentinel prop must be set on clone")
		require.Equal(t, "ok", blanked.Props["keep_me"], "unrelated props are not stripped")
	})

	t.Run("initializes Props on clone when source has nil Props", func(t *testing.T) {
		p := &model.Post{Id: "p2", Message: "hi"}
		blanked := blankedPostFor(p)
		require.NotNil(t, blanked.Props)
		require.Equal(t, true, blanked.Props[model.PostPropsHiddenByPolicy])
		require.Nil(t, p.Props, "original must not gain a Props map")
	})

	t.Run("nil post returns nil", func(t *testing.T) {
		require.Nil(t, blankedPostFor(nil))
	})
}
