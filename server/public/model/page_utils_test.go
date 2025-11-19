// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParsePageUrl(t *testing.T) {
	t.Run("valid page URL", func(t *testing.T) {
		teamName, channelId, wikiId, pageId, ok := ParsePageUrl("/myteam/wiki/chan123/wiki456/page789")
		require.True(t, ok)
		require.Equal(t, "myteam", teamName)
		require.Equal(t, "chan123", channelId)
		require.Equal(t, "wiki456", wikiId)
		require.Equal(t, "page789", pageId)
	})

	t.Run("external URL", func(t *testing.T) {
		_, _, _, _, ok := ParsePageUrl("https://example.com")
		require.False(t, ok)
	})

	t.Run("invalid internal URL", func(t *testing.T) {
		_, _, _, _, ok := ParsePageUrl("/myteam/channels/abc123")
		require.False(t, ok)
	})

	t.Run("empty URL", func(t *testing.T) {
		_, _, _, _, ok := ParsePageUrl("")
		require.False(t, ok)
	})

	t.Run("incomplete page URL", func(t *testing.T) {
		_, _, _, _, ok := ParsePageUrl("/myteam/wiki/chan123")
		require.False(t, ok)
	})
}

func TestIsPageUrl(t *testing.T) {
	t.Run("valid page URL", func(t *testing.T) {
		require.True(t, IsPageUrl("/myteam/wiki/chan123/wiki456/page789"))
	})

	t.Run("external URL", func(t *testing.T) {
		require.False(t, IsPageUrl("https://example.com"))
	})

	t.Run("channel URL", func(t *testing.T) {
		require.False(t, IsPageUrl("/myteam/channels/abc123"))
	})
}

func TestBuildPageUrl(t *testing.T) {
	t.Run("builds correct URL", func(t *testing.T) {
		url := BuildPageUrl("myteam", "chan123", "wiki456", "page789")
		require.Equal(t, "/myteam/wiki/chan123/wiki456/page789", url)
	})

	t.Run("roundtrip parsing", func(t *testing.T) {
		originalTeam := "myteam"
		originalChannel := "chan123"
		originalWiki := "wiki456"
		originalPage := "page789"

		url := BuildPageUrl(originalTeam, originalChannel, originalWiki, originalPage)
		teamName, channelId, wikiId, pageId, ok := ParsePageUrl(url)

		require.True(t, ok)
		require.Equal(t, originalTeam, teamName)
		require.Equal(t, originalChannel, channelId)
		require.Equal(t, originalWiki, wikiId)
		require.Equal(t, originalPage, pageId)
	})
}
