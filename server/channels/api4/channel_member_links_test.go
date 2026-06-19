// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestLinkWikiToChannelAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.SetupChannelSchemeWithPermissions(t, th.BasicChannel,
		model.PermissionManagePublicChannelProperties, model.PermissionCreatePage,
	)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		Title:  "Link Test Wiki",
		TeamId: th.BasicTeam.Id,
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("success", func(t *testing.T) {
		targetChannel := th.CreatePublicChannel(t)

		url := "/channels/" + targetChannel.Id + "/channel_member_links"
		payload := `{"wiki_id":"` + wiki.Id + `"}`
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, payload)
		require.NoError(t, err)
		CheckCreatedStatus(t, model.BuildResponse(httpResp))

		var link model.ChannelMemberLink
		err = json.NewDecoder(httpResp.Body).Decode(&link)
		require.NoError(t, err)
		require.Equal(t, targetChannel.Id, link.SourceId)
		require.Equal(t, wiki.Id, link.WikiId)
	})

	t.Run("duplicate link returns conflict", func(t *testing.T) {
		targetChannel := th.CreatePublicChannel(t)

		url := "/channels/" + targetChannel.Id + "/channel_member_links"
		payload := `{"wiki_id":"` + wiki.Id + `"}`

		httpResp, err := th.Client.DoAPIPost(context.Background(), url, payload)
		require.NoError(t, err)
		CheckCreatedStatus(t, model.BuildResponse(httpResp))

		httpResp, err = th.Client.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		checkHTTPStatus(t, model.BuildResponse(httpResp), http.StatusConflict)
	})

	t.Run("no bookmark permission", func(t *testing.T) {
		targetChannel := th.CreatePublicChannel(t)
		th.AddUserToChannel(t, th.BasicUser2, targetChannel)

		scheme := th.SetupChannelScheme(t)
		targetChannel.SchemeId = &scheme.Id
		_, appErr := th.App.UpdateChannelScheme(th.Context, targetChannel)
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(t, model.PermissionAddBookmarkPublicChannel.Id, scheme.DefaultChannelUserRole)
		th.RemovePermissionFromRole(t, model.PermissionAddBookmarkPublicChannel.Id, scheme.DefaultChannelAdminRole)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
		require.NoError(t, lErr)

		url := "/channels/" + targetChannel.Id + "/channel_member_links"
		payload := `{"wiki_id":"` + wiki.Id + `"}`
		httpResp, err := client2.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("invalid wiki_id", func(t *testing.T) {
		targetChannel := th.CreatePublicChannel(t)

		url := "/channels/" + targetChannel.Id + "/channel_member_links"
		payload := `{"wiki_id":"not-valid"}`
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("no bookmark permission on private channel", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.AddUserToChannel(t, th.BasicUser2, privateChannel)

		scheme := th.SetupChannelScheme(t)
		privateChannel.SchemeId = &scheme.Id
		_, appErr := th.App.UpdateChannelScheme(th.Context, privateChannel)
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(t, model.PermissionAddBookmarkPrivateChannel.Id, scheme.DefaultChannelUserRole)
		th.RemovePermissionFromRole(t, model.PermissionAddBookmarkPrivateChannel.Id, scheme.DefaultChannelAdminRole)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
		require.NoError(t, lErr)

		url := "/channels/" + privateChannel.Id + "/channel_member_links"
		payload := `{"wiki_id":"` + wiki.Id + `"}`
		httpResp, err := client2.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})
}

func TestGetChannelMemberLinksForChannelAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.SetupChannelSchemeWithPermissions(t, th.BasicChannel,
		model.PermissionManagePublicChannelProperties, model.PermissionCreatePage,
	)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		Title:  "Get Links Wiki",
		TeamId: th.BasicTeam.Id,
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	targetChannel := th.CreatePublicChannel(t)

	_, appErr = th.App.LinkWikiToChannel(th.Context, wiki.Id, targetChannel.Id, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("success", func(t *testing.T) {
		url := "/channels/" + targetChannel.Id + "/channel_member_links"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var links []*model.ChannelMemberLink
		err = json.NewDecoder(httpResp.Body).Decode(&links)
		require.NoError(t, err)
		require.Len(t, links, 1)
		require.Equal(t, targetChannel.Id, links[0].SourceId)
		require.Equal(t, wiki.Id, links[0].WikiId)
	})

	t.Run("no read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)

		_, appErr := th.App.LinkWikiToChannel(th.Context, wiki.Id, privateChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
		require.NoError(t, lErr)

		url := "/channels/" + privateChannel.Id + "/channel_member_links"
		httpResp, err := client2.DoAPIGet(context.Background(), url, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})
}

func TestGetChannelMemberLinksByWikiAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.SetupChannelSchemeWithPermissions(t, th.BasicChannel,
		model.PermissionManagePublicChannelProperties, model.PermissionCreatePage,
	)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		Title:  "Links By Wiki",
		TeamId: th.BasicTeam.Id,
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("returns links for source channels caller can read", func(t *testing.T) {
		readableChannel := th.CreatePublicChannel(t)
		_, appErr := th.App.LinkWikiToChannel(th.Context, wiki.Id, readableChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		url := "/wikis/" + wiki.Id + "/channel_member_links"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var links []*model.ChannelMemberLink
		err = json.NewDecoder(httpResp.Body).Decode(&links)
		require.NoError(t, err)
		require.Len(t, links, 1)
		require.Equal(t, readableChannel.Id, links[0].SourceId)
		require.Equal(t, wiki.Id, links[0].WikiId)
	})

	t.Run("filters out source channels caller cannot read", func(t *testing.T) {
		// Use a fresh wiki so the previous subtest's link doesn't pollute results.
		w := &model.Wiki{Title: "Filter Wiki", TeamId: th.BasicTeam.Id}
		w, appErr := th.App.CreateWiki(th.Context, w, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Public channel BasicUser2 cannot read because they are not a member and the channel
		// is private — so it should be filtered out from BasicUser2's response.
		privateChannel := th.CreatePrivateChannel(t)
		_, appErr = th.App.LinkWikiToChannel(th.Context, w.Id, privateChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
		require.NoError(t, lErr)

		url := "/wikis/" + w.Id + "/channel_member_links"
		httpResp, err := client2.DoAPIGet(context.Background(), url, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var links []*model.ChannelMemberLink
		err = json.NewDecoder(httpResp.Body).Decode(&links)
		require.NoError(t, err)
		require.Empty(t, links, "private channel should be filtered out for non-member")
	})

	t.Run("user without team access cannot read wiki", func(t *testing.T) {
		// User outside the wiki's team — GetWikiForRead should reject before the link query.
		otherTeamUser := th.CreateUser(t)
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), otherTeamUser.Username, otherTeamUser.Password)
		require.NoError(t, lErr)

		url := "/wikis/" + wiki.Id + "/channel_member_links"
		httpResp, err := client2.DoAPIGet(context.Background(), url, "")
		require.Error(t, err)
		// GetWikiForRead returns 403 for users outside the team.
		require.NotEqual(t, http.StatusOK, httpResp.StatusCode)
	})

	t.Run("non-existent wiki returns 404", func(t *testing.T) {
		url := "/wikis/" + model.NewId() + "/channel_member_links"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("wiki with no links returns empty array", func(t *testing.T) {
		emptyWiki := &model.Wiki{Title: "Empty Wiki", TeamId: th.BasicTeam.Id}
		emptyWiki, appErr := th.App.CreateWiki(th.Context, emptyWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		url := "/wikis/" + emptyWiki.Id + "/channel_member_links"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var links []*model.ChannelMemberLink
		err = json.NewDecoder(httpResp.Body).Decode(&links)
		require.NoError(t, err)
		require.Empty(t, links)
	})
}

func TestUnlinkWikiFromChannelAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.SetupChannelSchemeWithPermissions(t, th.BasicChannel,
		model.PermissionManagePublicChannelProperties, model.PermissionCreatePage,
	)

	th.Context.Session().UserId = th.BasicUser.Id

	t.Run("success", func(t *testing.T) {
		wiki := &model.Wiki{
			Title:  "Unlink Success Wiki",
			TeamId: th.BasicTeam.Id,
		}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		targetChannel := th.CreatePublicChannel(t)

		_, appErr = th.App.LinkWikiToChannel(th.Context, wiki.Id, targetChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		url := "/channels/" + targetChannel.Id + "/channel_member_links/" + wiki.Id
		httpResp, err := th.Client.DoAPIDelete(context.Background(), url)
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("no permission", func(t *testing.T) {
		wiki := &model.Wiki{
			Title:  "Unlink Perm Wiki",
			TeamId: th.BasicTeam.Id,
		}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		targetChannel := th.CreatePublicChannel(t)
		th.AddUserToChannel(t, th.BasicUser2, targetChannel)

		_, appErr = th.App.LinkWikiToChannel(th.Context, wiki.Id, targetChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		scheme := th.SetupChannelScheme(t)
		targetChannel.SchemeId = &scheme.Id
		_, schemeErr := th.App.UpdateChannelScheme(th.Context, targetChannel)
		require.Nil(t, schemeErr)

		th.RemovePermissionFromRole(t, model.PermissionDeleteBookmarkPublicChannel.Id, scheme.DefaultChannelUserRole)
		th.RemovePermissionFromRole(t, model.PermissionDeleteBookmarkPublicChannel.Id, scheme.DefaultChannelAdminRole)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
		require.NoError(t, lErr)

		url := "/channels/" + targetChannel.Id + "/channel_member_links/" + wiki.Id
		httpResp, err := client2.DoAPIDelete(context.Background(), url)
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("no permission on private channel", func(t *testing.T) {
		wiki := &model.Wiki{
			Title:  "Unlink Private Perm Wiki",
			TeamId: th.BasicTeam.Id,
		}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		privateChannel := th.CreatePrivateChannel(t)
		th.AddUserToChannel(t, th.BasicUser2, privateChannel)

		_, appErr = th.App.LinkWikiToChannel(th.Context, wiki.Id, privateChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		scheme := th.SetupChannelScheme(t)
		privateChannel.SchemeId = &scheme.Id
		_, schemeErr := th.App.UpdateChannelScheme(th.Context, privateChannel)
		require.Nil(t, schemeErr)

		th.RemovePermissionFromRole(t, model.PermissionDeleteBookmarkPrivateChannel.Id, scheme.DefaultChannelUserRole)
		th.RemovePermissionFromRole(t, model.PermissionDeleteBookmarkPrivateChannel.Id, scheme.DefaultChannelAdminRole)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
		require.NoError(t, lErr)

		url := "/channels/" + privateChannel.Id + "/channel_member_links/" + wiki.Id
		httpResp, err := client2.DoAPIDelete(context.Background(), url)
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("wiki not found", func(t *testing.T) {
		targetChannel := th.CreatePublicChannel(t)

		url := "/channels/" + targetChannel.Id + "/channel_member_links/" + model.NewId()
		httpResp, err := th.Client.DoAPIDelete(context.Background(), url)
		require.Error(t, err)
		CheckNotFoundStatus(t, model.BuildResponse(httpResp))
	})
}
