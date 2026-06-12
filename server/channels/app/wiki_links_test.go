// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func setupWikiLinksTest(t *testing.T) *TestHelper {
	return Setup(t).InitBasic(t)
}

func TestLinkWikiToChannel(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("success: links wiki to a separate public channel", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Test Wiki",
			Description: "Test description",
		}
		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		targetChannel := th.CreateChannel(t, th.BasicTeam)

		link, err := th.App.LinkWikiToChannel(th.Context, createdWiki.Id, targetChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, link)
		require.Equal(t, targetChannel.Id, link.SourceId)
		require.Equal(t, createdWiki.ChannelId, link.DestinationId)
		require.Equal(t, th.BasicUser.Id, link.CreatorId)
		require.NotZero(t, link.CreateAt)
	})

	t.Run("wiki not found", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		targetChannel := th.CreateChannel(t, th.BasicTeam)

		_, err := th.App.LinkWikiToChannel(th.Context, model.NewId(), targetChannel.Id, th.BasicUser.Id)
		require.NotNil(t, err)
	})

	t.Run("channel not found", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Test Wiki",
			Description: "Test description",
		}
		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		_, err = th.App.LinkWikiToChannel(th.Context, createdWiki.Id, model.NewId(), th.BasicUser.Id)
		require.NotNil(t, err)
	})

	t.Run("DM channel returns StatusBadRequest", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Test Wiki",
			Description: "Test description",
		}
		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		dmChannel := th.CreateDmChannel(t, th.BasicUser2)

		_, err = th.App.LinkWikiToChannel(th.Context, createdWiki.Id, dmChannel.Id, th.BasicUser.Id)
		require.NotNil(t, err)
		require.Equal(t, http.StatusBadRequest, err.StatusCode)
		require.Equal(t, "app.wiki_link.invalid_source_channel_type", err.Id)
	})

	t.Run("wiki channel type returns StatusBadRequest", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		wiki1 := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Wiki 1",
			Description: "First wiki",
		}
		createdWiki1, err := th.App.CreateWiki(th.Context, wiki1, th.BasicUser.Id)
		require.Nil(t, err)

		wiki2 := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Wiki 2",
			Description: "Second wiki",
		}
		createdWiki2, err := th.App.CreateWiki(th.Context, wiki2, th.BasicUser.Id)
		require.Nil(t, err)

		_, err = th.App.LinkWikiToChannel(th.Context, createdWiki1.Id, createdWiki2.ChannelId, th.BasicUser.Id)
		require.NotNil(t, err)
		require.Equal(t, http.StatusBadRequest, err.StatusCode)
		require.Equal(t, "app.wiki_link.invalid_source_channel_type", err.Id)
	})

	t.Run("cross-team returns StatusBadRequest", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Test Wiki",
			Description: "Test description",
		}
		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		differentTeam := th.CreateTeam(t)
		differentChannel := th.CreateChannel(t, differentTeam)

		_, err = th.App.LinkWikiToChannel(th.Context, createdWiki.Id, differentChannel.Id, th.BasicUser.Id)
		require.NotNil(t, err)
		require.Equal(t, http.StatusBadRequest, err.StatusCode)
		require.Equal(t, "app.wiki_link.cross_team_not_allowed", err.Id)
	})
}

func TestUnlinkWikiFromChannel(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("success: link then unlink", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Test Wiki",
			Description: "Test description",
		}
		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		targetChannel := th.CreateChannel(t, th.BasicTeam)

		link, err := th.App.LinkWikiToChannel(th.Context, createdWiki.Id, targetChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, link)

		unlinkErr := th.App.UnlinkWikiFromChannel(th.Context, targetChannel.Id, createdWiki.ChannelId)
		require.Nil(t, unlinkErr)
	})

	t.Run("link not found returns StatusNotFound", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Test Wiki",
			Description: "Test description",
		}
		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		targetChannel := th.CreateChannel(t, th.BasicTeam)

		unlinkErr := th.App.UnlinkWikiFromChannel(th.Context, targetChannel.Id, createdWiki.ChannelId)
		require.NotNil(t, unlinkErr)
		require.Equal(t, http.StatusNotFound, unlinkErr.StatusCode)
		require.Equal(t, "app.wiki_link.not_found", unlinkErr.Id)
	})
}

func TestGetWikiLinksForChannel(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("returns links for channel with 2 wikis linked", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		wiki1 := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Wiki 1",
			Description: "First wiki",
		}
		createdWiki1, err := th.App.CreateWiki(th.Context, wiki1, th.BasicUser.Id)
		require.Nil(t, err)

		wiki2 := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Wiki 2",
			Description: "Second wiki",
		}
		createdWiki2, err := th.App.CreateWiki(th.Context, wiki2, th.BasicUser.Id)
		require.Nil(t, err)

		targetChannel := th.CreateChannel(t, th.BasicTeam)

		_, err = th.App.LinkWikiToChannel(th.Context, createdWiki1.Id, targetChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)

		_, err = th.App.LinkWikiToChannel(th.Context, createdWiki2.Id, targetChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)

		links, appErr := th.App.GetWikiLinksForChannel(th.Context, targetChannel.Id)
		require.Nil(t, appErr)
		require.Len(t, links, 2)

		destinationIds := make(map[string]bool)
		for _, link := range links {
			destinationIds[link.DestinationId] = true
			require.Equal(t, targetChannel.Id, link.SourceId)
		}
		require.True(t, destinationIds[createdWiki1.ChannelId])
		require.True(t, destinationIds[createdWiki2.ChannelId])
	})

	t.Run("returns empty slice when no links exist", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		channel := th.CreateChannel(t, th.BasicTeam)

		links, appErr := th.App.GetWikiLinksForChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.Empty(t, links)
	})
}

func TestGetWikisLinkedToChannel(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("returns wiki objects for channel with 2 wikis linked", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		wiki1 := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Wiki 1",
			Description: "First wiki",
		}
		createdWiki1, err := th.App.CreateWiki(th.Context, wiki1, th.BasicUser.Id)
		require.Nil(t, err)

		wiki2 := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Wiki 2",
			Description: "Second wiki",
		}
		createdWiki2, err := th.App.CreateWiki(th.Context, wiki2, th.BasicUser.Id)
		require.Nil(t, err)

		targetChannel := th.CreateChannel(t, th.BasicTeam)

		_, err = th.App.LinkWikiToChannel(th.Context, createdWiki1.Id, targetChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)

		_, err = th.App.LinkWikiToChannel(th.Context, createdWiki2.Id, targetChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)

		wikis, appErr := th.App.GetWikisLinkedToChannel(th.Context, targetChannel.Id)
		require.Nil(t, appErr)
		require.Len(t, wikis, 2)

		wikiIds := make(map[string]bool)
		for _, w := range wikis {
			wikiIds[w.Id] = true
		}
		require.True(t, wikiIds[createdWiki1.Id])
		require.True(t, wikiIds[createdWiki2.Id])
	})

	t.Run("returns empty slice when no wikis linked", func(t *testing.T) {
		th := setupWikiLinksTest(t)
		th.SetupPagePermissions()

		channel := th.CreateChannel(t, th.BasicTeam)

		wikis, appErr := th.App.GetWikisLinkedToChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.Empty(t, wikis)
	})
}
