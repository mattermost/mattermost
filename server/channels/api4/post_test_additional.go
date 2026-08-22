// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestCreatePostErrorPaths tests various error conditions in createPost
func TestCreatePostErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("create post with empty channel id", func(t *testing.T) {
		post := &model.Post{
			Message: "test message",
		}
		_, resp, err := th.Client.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create post with invalid channel id", func(t *testing.T) {
		post := &model.Post{
			ChannelId: "invalid",
			Message:   "test message",
		}
		_, resp, err := th.Client.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create post in channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		post := &model.Post{
			ChannelId: privateChannel.Id,
			Message:   "test message",
		}
		_, resp, err := th.Client.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("create post with empty message and no file ids", func(t *testing.T) {
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "",
		}
		_, resp, err := th.Client.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create post in non-existent channel", func(t *testing.T) {
		post := &model.Post{
			ChannelId: model.NewId(),
			Message:   "test message",
		}
		_, resp, err := th.Client.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test message",
		}
		_, resp, err := th.Client.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestUpdatePostErrorPaths tests error conditions in updatePost
func TestUpdatePostErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("update post with invalid id", func(t *testing.T) {
		post := &model.Post{
			Id:        "invalid",
			ChannelId: th.BasicPost.ChannelId,
			Message:   "updated message",
		}
		_, resp, err := th.Client.UpdatePost(context.Background(), post.Id, post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update non-existent post", func(t *testing.T) {
		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicPost.ChannelId,
			Message:   "updated message",
		}
		post.Id = model.NewId()
		post.Message = "updated message"
		_, resp, err := th.Client.UpdatePost(context.Background(), post.Id, post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update other user's post", func(t *testing.T) {
		otherPost := th.CreatePostWithClient(t, th.SystemAdminClient, th.BasicChannel)
		otherPost.Message = "updated message"
		_, resp, err := th.Client.UpdatePost(context.Background(), otherPost.Id, otherPost)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("update post with empty message and no file ids", func(t *testing.T) {
		post := &model.Post{
			Id:        th.BasicPost.Id,
			ChannelId: th.BasicPost.ChannelId,
			Message:   "",
			FileIds:   []string{},
		}
		_, resp, err := th.Client.UpdatePost(context.Background(), post.Id, post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		post := &model.Post{
			Id:        th.BasicPost.Id,
			ChannelId: th.BasicPost.ChannelId,
			Message:   "updated message",
		}
		_, resp, err := th.Client.UpdatePost(context.Background(), post.Id, post)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestPatchPostErrorPaths tests error conditions in patchPost
func TestPatchPostErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("patch with invalid post id", func(t *testing.T) {
		patch := &model.PostPatch{
			Message: model.NewPointer("patched message"),
		}
		_, resp, err := th.Client.PatchPost(context.Background(), "invalid", patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch non-existent post", func(t *testing.T) {
		patch := &model.PostPatch{
			Message: model.NewPointer("patched message"),
		}
		_, resp, err := th.Client.PatchPost(context.Background(), model.NewId(), patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch other user's post", func(t *testing.T) {
		otherPost := th.CreatePostWithClient(t, th.SystemAdminClient, th.BasicChannel)
		patch := &model.PostPatch{
			Message: model.NewPointer("patched message"),
		}
		_, resp, err := th.Client.PatchPost(context.Background(), otherPost.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		patch := &model.PostPatch{
			Message: model.NewPointer("patched message"),
		}
		_, resp, err := th.Client.PatchPost(context.Background(), th.BasicPost.Id, patch)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestDeletePostErrorPaths tests error conditions in deletePost
func TestDeletePostErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("delete with invalid post id", func(t *testing.T) {
		resp, err := th.Client.DeletePost(context.Background(), "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete non-existent post", func(t *testing.T) {
		resp, err := th.Client.DeletePost(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("delete other user's post without permission", func(t *testing.T) {
		otherPost := th.CreatePostWithClient(t, th.SystemAdminClient, th.BasicChannel)
		resp, err := th.Client.DeletePost(context.Background(), otherPost.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		post := th.CreatePost(t)
		th.Client.Logout(context.Background())
		resp, err := th.Client.DeletePost(context.Background(), post.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetPostErrorPaths tests error handling in getPost
func TestGetPostErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid post id", func(t *testing.T) {
		_, resp, err := th.Client.GetPost(context.Background(), "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent post", func(t *testing.T) {
		_, resp, err := th.Client.GetPost(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get post from channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		privatePost := th.CreatePostWithClient(t, th.SystemAdminClient, privateChannel)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetPost(context.Background(), privatePost.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetPost(context.Background(), th.BasicPost.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetPostsForChannelErrorPaths tests error handling in getPostsForChannel
func TestGetPostsForChannelErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid channel id", func(t *testing.T) {
		_, resp, err := th.Client.GetPostsForChannel(context.Background(), "invalid", 0, 10, "", false, false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get posts from channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetPostsForChannel(context.Background(), privateChannel.Id, 0, 10, "", false, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-existent channel", func(t *testing.T) {
		_, resp, err := th.Client.GetPostsForChannel(context.Background(), model.NewId(), 0, 10, "", false, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 10, "", false, false)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestSearchPostsErrorPaths tests error handling in searchPosts
func TestSearchPostsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("search with invalid team id", func(t *testing.T) {
		search := &model.SearchParameter{
			Terms: model.NewPointer("test"),
		}
		_, resp, err := th.Client.SearchPostsWithParams(context.Background(), "invalid", search)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("search in team user is not member of", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		search := &model.SearchParameter{
			Terms: model.NewPointer("test"),
		}
		_, resp, err := th.Client.SearchPostsWithParams(context.Background(), otherTeam.Id, search)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("search with empty terms", func(t *testing.T) {
		search := &model.SearchParameter{
			Terms: model.NewPointer(""),
		}
		posts, _, err := th.Client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, search)
		require.NoError(t, err)
		// Empty search should return empty result, not error
		require.NotNil(t, posts)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		search := &model.SearchParameter{
			Terms: model.NewPointer("test"),
		}
		_, resp, err := th.Client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, search)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestPinPostErrorPaths tests error conditions in pinPost
func TestPinPostErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("pin with invalid post id", func(t *testing.T) {
		resp, err := th.Client.PinPost(context.Background(), "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("pin non-existent post", func(t *testing.T) {
		resp, err := th.Client.PinPost(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("pin post in channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		privatePost := th.CreatePostWithClient(t, th.SystemAdminClient, privateChannel)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		resp, err := th.Client.PinPost(context.Background(), privatePost.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		resp, err := th.Client.PinPost(context.Background(), th.BasicPost.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestUnpinPostErrorPaths tests error conditions in unpinPost
func TestUnpinPostErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("unpin with invalid post id", func(t *testing.T) {
		resp, err := th.Client.UnpinPost(context.Background(), "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unpin non-existent post", func(t *testing.T) {
		resp, err := th.Client.UnpinPost(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unpin post in channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		privatePost := th.CreatePostWithClient(t, th.SystemAdminClient, privateChannel)
		th.SystemAdminClient.PinPost(context.Background(), privatePost.Id)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		resp, err := th.Client.UnpinPost(context.Background(), privatePost.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		post := th.CreatePost(t)
		th.Client.PinPost(context.Background(), post.Id)
		th.Client.Logout(context.Background())
		resp, err := th.Client.UnpinPost(context.Background(), post.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetPostThreadErrorPaths tests error handling in getPostThread
func TestGetPostThreadErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid post id", func(t *testing.T) {
		_, resp, err := th.Client.GetPostThread(context.Background(), "invalid", "", false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent post", func(t *testing.T) {
		_, resp, err := th.Client.GetPostThread(context.Background(), model.NewId(), "", false)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get thread from channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		privatePost := th.CreatePostWithClient(t, th.SystemAdminClient, privateChannel)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetPostThread(context.Background(), privatePost.Id, "", false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetPostThread(context.Background(), th.BasicPost.Id, "", false)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetFlaggedPostsErrorPaths tests error handling in getFlaggedPosts
func TestGetFlaggedPostsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.GetFlaggedPostsForUser(context.Background(), "invalid", 0, 10)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get flagged posts for other user without permission", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		_, resp, err := th.Client.GetFlaggedPostsForUser(context.Background(), otherUser.Id, 0, 10)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetFlaggedPostsForUser(context.Background(), th.BasicUser.Id, 0, 10)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetFileInfosForPostErrorPaths tests error handling in getFileInfosForPost
func TestGetFileInfosForPostErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid post id", func(t *testing.T) {
		_, resp, err := th.Client.GetFileInfosForPost(context.Background(), "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent post", func(t *testing.T) {
		_, resp, err := th.Client.GetFileInfosForPost(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get file infos for post in channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		privatePost := th.CreatePostWithClient(t, th.SystemAdminClient, privateChannel)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetFileInfosForPost(context.Background(), privatePost.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetFileInfosForPost(context.Background(), th.BasicPost.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestDoPostActionErrorPaths tests error conditions in doPostAction
func TestDoPostActionErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid post id", func(t *testing.T) {
		resp, err := th.Client.DoPostAction(context.Background(), "invalid", "action-id")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("empty action id", func(t *testing.T) {
		resp, err := th.Client.DoPostAction(context.Background(), th.BasicPost.Id, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent post", func(t *testing.T) {
		resp, err := th.Client.DoPostAction(context.Background(), model.NewId(), "action-id")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		resp, err := th.Client.DoPostAction(context.Background(), th.BasicPost.Id, "action-id")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestSetPostUnreadErrorPaths tests error conditions in setPostUnread
func TestSetPostUnreadErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid user id", func(t *testing.T) {
		resp, err := th.Client.SetPostUnread(context.Background(), "invalid", th.BasicPost.Id, false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid post id", func(t *testing.T) {
		resp, err := th.Client.SetPostUnread(context.Background(), th.BasicUser.Id, "invalid", false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("set unread for other user without permission", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		resp, err := th.Client.SetPostUnread(context.Background(), otherUser.Id, th.BasicPost.Id, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-existent post", func(t *testing.T) {
		resp, err := th.Client.SetPostUnread(context.Background(), th.BasicUser.Id, model.NewId(), false)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		resp, err := th.Client.SetPostUnread(context.Background(), th.BasicUser.Id, th.BasicPost.Id, false)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetPostsAroundErrorPaths tests error handling in getPostsAround
func TestGetPostsAroundErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid channel id", func(t *testing.T) {
		_, resp, err := th.Client.GetPostsForChannel(context.Background(), "invalid", 0, 10, "", false, false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid post id", func(t *testing.T) {
		_, resp, err := th.Client.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 10, "", false, false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get posts from channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetPostsForChannel(context.Background(), privateChannel.Id, 0, 10, "", false, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 10, "", false, false)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}
