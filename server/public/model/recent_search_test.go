// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRecentSearchPreSaveAndIsValid(t *testing.T) {
	t.Run("valid messages search after PreSave", func(t *testing.T) {
		rs := &RecentSearch{
			UserId:     NewId(),
			Terms:      "  hello from:me  ",
			SearchType: RecentSearchTypeMessages,
			TeamId:     NewId(),
		}
		rs.PreSave()
		require.True(t, IsValidId(rs.Id))
		require.Equal(t, "hello from:me", rs.Terms)
		require.NotZero(t, rs.CreateAt)
		require.NotZero(t, rs.UpdateAt)
		require.Nil(t, rs.IsValid())
	})

	t.Run("valid files search with empty team", func(t *testing.T) {
		rs := &RecentSearch{
			UserId:     NewId(),
			Terms:      "pdf",
			SearchType: RecentSearchTypeFiles,
		}
		rs.PreSave()
		require.Equal(t, "", rs.TeamId)
		require.Nil(t, rs.IsValid())
	})

	t.Run("rejects empty terms after trim", func(t *testing.T) {
		rs := &RecentSearch{
			UserId:     NewId(),
			Terms:      "   ",
			SearchType: RecentSearchTypeMessages,
		}
		rs.PreSave()
		require.NotNil(t, rs.IsValid())
	})

	t.Run("rejects terms over 2048 runes", func(t *testing.T) {
		rs := &RecentSearch{
			UserId:     NewId(),
			Terms:      strings.Repeat("ñ", RecentSearchMaxTermsRunes+1),
			SearchType: RecentSearchTypeMessages,
		}
		rs.PreSave()
		require.NotNil(t, rs.IsValid())

		rs.Terms = strings.Repeat("ñ", RecentSearchMaxTermsRunes)
		require.Nil(t, rs.IsValid())
	})

	t.Run("rejects invalid search type", func(t *testing.T) {
		rs := &RecentSearch{
			UserId:     NewId(),
			Terms:      "hello",
			SearchType: "channels",
		}
		rs.PreSave()
		require.NotNil(t, rs.IsValid())
	})

	t.Run("rejects invalid user id", func(t *testing.T) {
		rs := &RecentSearch{
			UserId:     "not-an-id",
			Terms:      "hello",
			SearchType: RecentSearchTypeMessages,
		}
		rs.PreSave()
		require.NotNil(t, rs.IsValid())
	})

	t.Run("rejects invalid team id when set", func(t *testing.T) {
		rs := &RecentSearch{
			UserId:     NewId(),
			Terms:      "hello",
			SearchType: RecentSearchTypeMessages,
			TeamId:     "bad",
		}
		rs.PreSave()
		require.NotNil(t, rs.IsValid())
	})
}
