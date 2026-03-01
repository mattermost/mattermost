// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func setupViewTest(t *testing.T) *TestHelper {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)
	return th
}

func makeTestViewForAPI() *model.View {
	return &model.View{
		Title: "Test Board",
		Type:  model.ViewTypeBoard,
		Props: &model.ViewBoardProps{
			LinkedProperties: []string{model.NewId()},
			Subviews:         []model.Subview{{Title: "Kanban", Type: model.SubviewTypeKanban}},
		},
	}
}

func TestCreateView(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupViewTest(t)

	t.Run("creates a view in a public channel", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, resp, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, created)
		require.Equal(t, view.Title, created.Title)
		require.Equal(t, th.BasicChannel.Id, created.ChannelId)
		require.Equal(t, th.BasicUser.Id, created.CreatorId)
		require.NotEmpty(t, created.Id)
	})

	t.Run("creates a view in a private channel", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, resp, err := th.Client.CreateView(context.Background(), th.BasicPrivateChannel.Id, view)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, created)
		require.Equal(t, th.BasicPrivateChannel.Id, created.ChannelId)
	})

	t.Run("regular user in DM can create view", func(t *testing.T) {
		dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)

		view := makeTestViewForAPI()
		created, resp, err := th.Client.CreateView(context.Background(), dm.Id, view)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, created)
		require.Equal(t, dm.Id, created.ChannelId)
	})

	t.Run("invalid body returns 400", func(t *testing.T) {
		_, resp, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, nil)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("empty title returns 400", func(t *testing.T) {
		view := makeTestViewForAPI()
		view.Title = ""
		_, resp, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("whitespace-only title returns 400", func(t *testing.T) {
		view := makeTestViewForAPI()
		view.Title = "   "
		_, resp, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("oversized title returns 400", func(t *testing.T) {
		view := makeTestViewForAPI()
		view.Title = strings.Repeat("a", model.ViewTitleMaxRunes+1)
		_, resp, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("deleted channel returns 403", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		appErr := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		view := makeTestViewForAPI()
		_, resp, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("permission denied on public channel", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		view := makeTestViewForAPI()
		_, resp, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("permission denied on private channel", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

		view := makeTestViewForAPI()
		_, resp, err := th.Client.CreateView(context.Background(), th.BasicPrivateChannel.Id, view)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("guest in DM/GM is rejected", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
		th.App.Srv().SetLicense(model.NewTestLicense())

		guest, guestClient := th.CreateGuestAndClient(t)

		dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, appErr)

		view := makeTestViewForAPI()
		_, resp, err := guestClient.CreateView(context.Background(), dm.Id, view)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		client := th.CreateClient()
		view := makeTestViewForAPI()
		_, resp, err := client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetViewsForChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupViewTest(t)

	t.Run("lists views for channel", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)

		v1 := makeTestViewForAPI()
		_, _, err := th.Client.CreateView(context.Background(), channel.Id, v1)
		require.NoError(t, err)
		v2 := makeTestViewForAPI()
		v2.Title = "Second View"
		_, _, err = th.Client.CreateView(context.Background(), channel.Id, v2)
		require.NoError(t, err)

		views, resp, err := th.Client.GetViewsForChannel(context.Background(), channel.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, views, 2)
	})

	t.Run("empty channel returns empty list", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		views, resp, err := th.Client.GetViewsForChannel(context.Background(), channel.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Empty(t, views)
	})

	t.Run("permission denied for non-member", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t)

		// BasicUser2 is not a member of this newly created private channel
		user2Client := th.CreateClient()
		th.LoginBasic2WithClient(t, user2Client)

		_, resp, err := user2Client.GetViewsForChannel(context.Background(), channel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetView(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupViewTest(t)

	t.Run("gets a view by ID", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		got, resp, err := th.Client.GetView(context.Background(), th.BasicChannel.Id, created.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, created.Id, got.Id)
		require.Equal(t, created.Title, got.Title)
	})

	t.Run("not found returns 404", func(t *testing.T) {
		_, resp, err := th.Client.GetView(context.Background(), th.BasicChannel.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("wrong channel returns 404", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		otherChannel := th.CreatePublicChannel(t)
		_, resp, err := th.Client.GetView(context.Background(), otherChannel.Id, created.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("permission denied for non-member", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t)
		view := makeTestViewForAPI()
		created, _, err := th.SystemAdminClient.CreateView(context.Background(), channel.Id, view)
		require.NoError(t, err)

		user2Client := th.CreateClient()
		th.LoginBasic2WithClient(t, user2Client)

		_, resp, err := user2Client.GetView(context.Background(), channel.Id, created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestUpdateView(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupViewTest(t)

	t.Run("updates a view", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		newTitle := "Updated Title"
		updated, resp, err := th.Client.UpdateView(context.Background(), th.BasicChannel.Id, created.Id, &model.ViewPatch{Title: &newTitle})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, newTitle, updated.Title)
		require.Equal(t, created.Id, updated.Id)
	})

	t.Run("not found returns 404", func(t *testing.T) {
		newTitle := "Title"
		_, resp, err := th.Client.UpdateView(context.Background(), th.BasicChannel.Id, model.NewId(), &model.ViewPatch{Title: &newTitle})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("wrong channel returns 404", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		otherChannel := th.CreatePublicChannel(t)
		newTitle := "Title"
		_, resp, err := th.Client.UpdateView(context.Background(), otherChannel.Id, created.Id, &model.ViewPatch{Title: &newTitle})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("invalid patch returns 400", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		_, resp, err := th.Client.UpdateView(context.Background(), th.BasicChannel.Id, created.Id, nil)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("deleted channel returns 403", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.NoError(t, err)

		appErr := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		newTitle := "Title"
		_, resp, err := th.Client.UpdateView(context.Background(), channel.Id, created.Id, &model.ViewPatch{Title: &newTitle})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("permission denied on public channel", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		view := makeTestViewForAPI()
		created, _, err := th.SystemAdminClient.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		newTitle := "Title"
		_, resp, err := th.Client.UpdateView(context.Background(), th.BasicChannel.Id, created.Id, &model.ViewPatch{Title: &newTitle})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("permission denied on private channel", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

		view := makeTestViewForAPI()
		created, _, err := th.SystemAdminClient.CreateView(context.Background(), th.BasicPrivateChannel.Id, view)
		require.NoError(t, err)

		newTitle := "Title"
		_, resp, err := th.Client.UpdateView(context.Background(), th.BasicPrivateChannel.Id, created.Id, &model.ViewPatch{Title: &newTitle})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestDeleteView(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupViewTest(t)

	t.Run("deletes a view", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		resp, err := th.Client.DeleteView(context.Background(), th.BasicChannel.Id, created.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// verify it's gone
		_, resp, err = th.Client.GetView(context.Background(), th.BasicChannel.Id, created.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("not found returns 404", func(t *testing.T) {
		resp, err := th.Client.DeleteView(context.Background(), th.BasicChannel.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("wrong channel returns 404", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		otherChannel := th.CreatePublicChannel(t)
		resp, err := th.Client.DeleteView(context.Background(), otherChannel.Id, created.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("deleted channel returns 403", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.NoError(t, err)

		appErr := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		resp, err := th.Client.DeleteView(context.Background(), channel.Id, created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("permission denied on public channel", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		view := makeTestViewForAPI()
		created, _, err := th.SystemAdminClient.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		resp, err := th.Client.DeleteView(context.Background(), th.BasicChannel.Id, created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("permission denied on private channel", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

		view := makeTestViewForAPI()
		created, _, err := th.SystemAdminClient.CreateView(context.Background(), th.BasicPrivateChannel.Id, view)
		require.NoError(t, err)

		resp, err := th.Client.DeleteView(context.Background(), th.BasicPrivateChannel.Id, created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestViewFeatureFlagOff(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = false
	}).InitBasic(t)

	view := makeTestViewForAPI()

	t.Run("create returns 404 when flag is off", func(t *testing.T) {
		_, resp, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("list returns 404 when flag is off", func(t *testing.T) {
		_, resp, err := th.Client.GetViewsForChannel(context.Background(), th.BasicChannel.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get returns 404 when flag is off", func(t *testing.T) {
		_, resp, err := th.Client.GetView(context.Background(), th.BasicChannel.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("update returns 404 when flag is off", func(t *testing.T) {
		newTitle := "Title"
		_, resp, err := th.Client.UpdateView(context.Background(), th.BasicChannel.Id, model.NewId(), &model.ViewPatch{Title: &newTitle})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("delete returns 404 when flag is off", func(t *testing.T) {
		resp, err := th.Client.DeleteView(context.Background(), th.BasicChannel.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestViewInvalidId(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupViewTest(t)

	t.Run("get with invalid view_id returns 400", func(t *testing.T) {
		_, resp, err := th.Client.GetView(context.Background(), th.BasicChannel.Id, "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update with invalid view_id returns 400", func(t *testing.T) {
		newTitle := "Title"
		_, resp, err := th.Client.UpdateView(context.Background(), th.BasicChannel.Id, "invalid", &model.ViewPatch{Title: &newTitle})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete with invalid view_id returns 400", func(t *testing.T) {
		resp, err := th.Client.DeleteView(context.Background(), th.BasicChannel.Id, "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}
