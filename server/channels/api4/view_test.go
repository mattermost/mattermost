// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
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
		Title: "Test Kanban",
		Type:  model.ViewTypeKanban,
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

	t.Run("deleted channel returns 404", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		appErr := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		view := makeTestViewForAPI()
		_, resp, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("permission denied without create_post", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionCreatePost.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionCreatePost.Id, model.ChannelUserRoleId)

		view := makeTestViewForAPI()
		_, resp, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
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

	t.Run("exceeding max views per channel returns 400", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)

		for i := range model.MaxViewsPerChannel {
			view := makeTestViewForAPI()
			_, _, err := th.Client.CreateView(context.Background(), channel.Id, view)
			require.NoError(t, err, "failed to create view %d", i)
		}

		// The next one should fail
		view := makeTestViewForAPI()
		_, resp, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
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

		_, resp, err := user2Client.GetViewsForChannel(context.Background(), channel.Id, model.ViewQueryOpts{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("pagination", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)

		// Create 3 views
		for i := range 3 {
			v := makeTestViewForAPI()
			v.Title = "Paginated View"
			v.SortOrder = i
			_, _, err := th.Client.CreateView(context.Background(), channel.Id, v)
			require.NoError(t, err)
		}

		// Page 0: request per_page=2
		page1, resp, err := th.Client.GetViewsForChannel(context.Background(), channel.Id, model.ViewQueryOpts{PerPage: 2})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, page1, 2)

		// Page 1: next page
		page2, resp, err := th.Client.GetViewsForChannel(context.Background(), channel.Id, model.ViewQueryOpts{PerPage: 2, Page: 1})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, page2, 1)

		// Ensure no overlap between pages
		page1IDs := map[string]bool{page1[0].Id: true, page1[1].Id: true}
		require.False(t, page1IDs[page2[0].Id])
	})

	t.Run("excludes deleted views by default", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)

		created, _, err := th.Client.CreateView(context.Background(), channel.Id, makeTestViewForAPI())
		require.NoError(t, err)
		_, _, err = th.Client.CreateView(context.Background(), channel.Id, makeTestViewForAPI())
		require.NoError(t, err)

		resp, err := th.Client.DeleteView(context.Background(), channel.Id, created.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		views, resp, err := th.Client.GetViewsForChannel(context.Background(), channel.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, views, 1)
	})

	t.Run("deleted channel returns 404", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		_, _, err := th.Client.CreateView(context.Background(), channel.Id, makeTestViewForAPI())
		require.NoError(t, err)

		appErr := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		_, resp, err := th.Client.GetViewsForChannel(context.Background(), channel.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("include_total_count returns views with count", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)

		for i := range 3 {
			v := makeTestViewForAPI()
			v.Title = "Count View"
			v.SortOrder = i
			_, _, err := th.Client.CreateView(context.Background(), channel.Id, v)
			require.NoError(t, err)
		}

		views, totalCount, resp, err := th.Client.GetViewsForChannelWithCount(context.Background(), channel.Id, model.ViewQueryOpts{PerPage: 2})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, views, 2)
		require.Equal(t, int64(3), totalCount)
	})

	t.Run("out-of-bounds page returns empty list", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		_, _, err := th.Client.CreateView(context.Background(), channel.Id, makeTestViewForAPI())
		require.NoError(t, err)

		views, resp, err := th.Client.GetViewsForChannel(context.Background(), channel.Id, model.ViewQueryOpts{PerPage: 1, Page: 999})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Empty(t, views)
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

	t.Run("deleted view returns 404", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		resp, err := th.Client.DeleteView(context.Background(), th.BasicChannel.Id, created.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		_, resp, err = th.Client.GetView(context.Background(), th.BasicChannel.Id, created.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("deleted channel returns 404", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.NoError(t, err)

		appErr := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		_, resp, err := th.Client.GetView(context.Background(), channel.Id, created.Id)
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

	t.Run("deleted channel returns 404", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.NoError(t, err)

		appErr := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		newTitle := "Title"
		_, resp, err := th.Client.UpdateView(context.Background(), channel.Id, created.Id, &model.ViewPatch{Title: &newTitle})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("permission denied without create_post", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionCreatePost.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionCreatePost.Id, model.ChannelUserRoleId)

		view := makeTestViewForAPI()
		created, _, err := th.SystemAdminClient.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		newTitle := "Title"
		_, resp, err := th.Client.UpdateView(context.Background(), th.BasicChannel.Id, created.Id, &model.ViewPatch{Title: &newTitle})
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

	t.Run("deleted channel returns 404", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.NoError(t, err)

		appErr := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		resp, err := th.Client.DeleteView(context.Background(), channel.Id, created.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("permission denied without create_post", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionCreatePost.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionCreatePost.Id, model.ChannelUserRoleId)

		view := makeTestViewForAPI()
		created, _, err := th.SystemAdminClient.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		resp, err := th.Client.DeleteView(context.Background(), th.BasicChannel.Id, created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestUpdateViewSortOrder(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupViewTest(t)

	t.Run("reorders views in a channel", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		var created []*model.View
		for i := range 3 {
			v := makeTestViewForAPI()
			v.Title = "Sort View"
			v.SortOrder = i
			c, _, err := th.Client.CreateView(context.Background(), channel.Id, v)
			require.NoError(t, err)
			created = append(created, c)
		}

		views, resp, err := th.Client.UpdateViewSortOrder(context.Background(), channel.Id, created[2].Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, views, 3)
		require.Equal(t, created[2].Id, views[0].Id)
		require.Equal(t, created[0].Id, views[1].Id)
		require.Equal(t, created[1].Id, views[2].Id)
	})

	t.Run("negative sort order returns 400", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		v := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, v)
		require.NoError(t, err)

		_, resp, err := th.Client.UpdateViewSortOrder(context.Background(), channel.Id, created.Id, -1)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("out of bounds returns 400", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		v := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, v)
		require.NoError(t, err)

		_, resp, err := th.Client.UpdateViewSortOrder(context.Background(), channel.Id, created.Id, 99)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent view returns 404", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		v := makeTestViewForAPI()
		_, _, err := th.Client.CreateView(context.Background(), channel.Id, v)
		require.NoError(t, err)

		_, resp, err := th.Client.UpdateViewSortOrder(context.Background(), channel.Id, model.NewId(), 0)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("deleted channel returns 404", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		v := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, v)
		require.NoError(t, err)

		appErr := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		_, resp, err := th.Client.UpdateViewSortOrder(context.Background(), channel.Id, created.Id, 0)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("permission denied without create_post", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionCreatePost.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionCreatePost.Id, model.ChannelUserRoleId)

		channel := th.CreatePublicChannel(t)
		v := makeTestViewForAPI()
		created, _, err := th.SystemAdminClient.CreateView(context.Background(), channel.Id, v)
		require.NoError(t, err)

		_, resp, err := th.Client.UpdateViewSortOrder(context.Background(), channel.Id, created.Id, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("wrong channel returns 404", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		v := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, v)
		require.NoError(t, err)

		otherChannel := th.CreatePublicChannel(t)
		// Create a view in otherChannel so the store has views to search through
		_, _, err = th.Client.CreateView(context.Background(), otherChannel.Id, makeTestViewForAPI())
		require.NoError(t, err)

		_, resp, err := th.Client.UpdateViewSortOrder(context.Background(), otherChannel.Id, created.Id, 0)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		client := th.CreateClient()
		_, resp, err := client.UpdateViewSortOrder(context.Background(), th.BasicChannel.Id, model.NewId(), 0)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetPostsForView(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupViewTest(t)

	t.Run("returns all post types", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.NoError(t, err)

		normalPost, _, err := th.Client.CreatePost(context.Background(), &model.Post{ChannelId: channel.Id, Message: "normal post"})
		require.NoError(t, err)

		cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "card post",
			Type:      model.PostTypeCard,
		}, channel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		postList, resp, err := th.Client.GetPostsForView(context.Background(), channel.Id, created.Id, 0, 60)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Contains(t, postList.Order, normalPost.Id)
		require.Contains(t, postList.Order, cardPost.Id)
	})

	t.Run("wrong channel for view returns 404", func(t *testing.T) {
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, view)
		require.NoError(t, err)

		otherChannel := th.CreatePublicChannel(t)
		_, resp, err := th.Client.GetPostsForView(context.Background(), otherChannel.Id, created.Id, 0, 60)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("non-existent view returns 404", func(t *testing.T) {
		_, resp, err := th.Client.GetPostsForView(context.Background(), th.BasicChannel.Id, model.NewId(), 0, 60)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("no channel read permission returns 403", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t)
		view := makeTestViewForAPI()
		created, _, err := th.SystemAdminClient.CreateView(context.Background(), channel.Id, view)
		require.NoError(t, err)

		user2Client := th.CreateClient()
		th.LoginBasic2WithClient(t, user2Client)

		_, resp, err := user2Client.GetPostsForView(context.Background(), channel.Id, created.Id, 0, 60)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		client := th.CreateClient()
		_, resp, err := client.GetPostsForView(context.Background(), th.BasicChannel.Id, model.NewId(), 0, 60)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("deleted channel returns 404", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.NoError(t, err)

		appErr := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		_, resp, err := th.Client.GetPostsForView(context.Background(), channel.Id, created.Id, 0, 60)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("pagination works", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		view := makeTestViewForAPI()
		created, _, err := th.Client.CreateView(context.Background(), channel.Id, view)
		require.NoError(t, err)

		// Channel already has a system join post, so we create 5 more for 6 total
		for i := range 5 {
			_, _, err = th.Client.CreatePost(context.Background(), &model.Post{
				ChannelId: channel.Id,
				Message:   fmt.Sprintf("post %d", i),
			})
			require.NoError(t, err)
		}

		page1, resp, err := th.Client.GetPostsForView(context.Background(), channel.Id, created.Id, 0, 3)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, page1.Order, 3)

		page2, resp, err := th.Client.GetPostsForView(context.Background(), channel.Id, created.Id, 1, 3)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, page2.Order, 3)

		// No overlap between pages
		for _, id := range page2.Order {
			require.NotContains(t, page1.Order, id)
		}
	})
}

func TestGetPostsForViewFeatureFlagOff(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = false
	}).InitBasic(t)

	_, resp, err := th.Client.GetPostsForView(context.Background(), th.BasicChannel.Id, model.NewId(), 0, 60)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
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
		_, resp, err := th.Client.GetViewsForChannel(context.Background(), th.BasicChannel.Id, model.ViewQueryOpts{})
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

	t.Run("sort order returns 404 when flag is off", func(t *testing.T) {
		_, resp, err := th.Client.UpdateViewSortOrder(context.Background(), th.BasicChannel.Id, model.NewId(), 0)
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

	t.Run("sort order with invalid view_id returns 400", func(t *testing.T) {
		_, resp, err := th.Client.UpdateViewSortOrder(context.Background(), th.BasicChannel.Id, "invalid", 0)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}
