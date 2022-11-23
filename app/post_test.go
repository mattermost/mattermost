// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app/platform"
	eMocks "github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest/mock"
	"github.com/mattermost/mattermost-server/v6/services/imageproxy"
	"github.com/mattermost/mattermost-server/v6/services/searchengine/mocks"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/storetest"
	storemocks "github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v6/testlib"
)

func TestCreatePostDeduplicate(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("duplicate create post is idempotent", func(t *testing.T) {
		pendingPostId := model.NewId()
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, "", true)
		require.Nil(t, err)
		require.Equal(t, "message", post.Message)

		duplicatePost, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, "", true)
		require.Nil(t, err)
		require.Equal(t, post.Id, duplicatePost.Id, "should have returned previously created post id")
		require.Equal(t, "message", duplicatePost.Message)
	})

	t.Run("post rejected by plugin leaves cache ready for non-deduplicated try", func(t *testing.T) {
		setupPluginAPITest(t, `
			package main

			import (
				"github.com/mattermost/mattermost-server/v6/plugin"
				"github.com/mattermost/mattermost-server/v6/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
				allow bool
			}

			func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
				if !p.allow {
					p.allow = true
					return nil, "rejected"
				}

				return nil, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`, `{"id": "testrejectfirstpost", "server": {"executable": "backend.exe"}}`, "testrejectfirstpost", th.App, th.Context)

		pendingPostId := model.NewId()
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, "", true)
		require.NotNil(t, err)
		require.Equal(t, "Post rejected by plugin. rejected", err.Id)
		require.Nil(t, post)

		duplicatePost, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, "", true)
		require.Nil(t, err)
		require.Equal(t, "message", duplicatePost.Message)
	})

	t.Run("slow posting after cache entry blocks duplicate request", func(t *testing.T) {
		setupPluginAPITest(t, `
			package main

			import (
				"github.com/mattermost/mattermost-server/v6/plugin"
				"github.com/mattermost/mattermost-server/v6/model"
				"time"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
				instant bool
			}

			func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
				if !p.instant {
					p.instant = true
					time.Sleep(3 * time.Second)
				}

				return nil, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`, `{"id": "testdelayfirstpost", "server": {"executable": "backend.exe"}}`, "testdelayfirstpost", th.App, th.Context)

		var post *model.Post
		pendingPostId := model.NewId()

		wg := sync.WaitGroup{}

		// Launch a goroutine to make the first CreatePost call that will get delayed
		// by the plugin above.
		wg.Add(1)
		go func() {
			defer wg.Done()
			var appErr *model.AppError
			post, appErr = th.App.CreatePostAsUser(th.Context, &model.Post{
				UserId:        th.BasicUser.Id,
				ChannelId:     th.BasicChannel.Id,
				Message:       "plugin delayed",
				PendingPostId: pendingPostId,
			}, "", true)
			require.Nil(t, appErr)
			require.Equal(t, post.Message, "plugin delayed")
		}()

		// Give the goroutine above a chance to start and get delayed by the plugin.
		time.Sleep(2 * time.Second)

		// Try creating a duplicate post
		duplicatePost, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "plugin delayed",
			PendingPostId: pendingPostId,
		}, "", true)
		require.NotNil(t, err)
		require.Equal(t, "api.post.deduplicate_create_post.pending", err.Id)
		require.Nil(t, duplicatePost)

		// Wait for the first CreatePost to finish to ensure assertions are made.
		wg.Wait()
	})

	t.Run("duplicate create post after cache expires is not idempotent", func(t *testing.T) {
		pendingPostId := model.NewId()
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, "", true)
		require.Nil(t, err)
		require.Equal(t, "message", post.Message)

		time.Sleep(PendingPostIDsCacheTTL)

		duplicatePost, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, "", true)
		require.Nil(t, err)
		require.NotEqual(t, post.Id, duplicatePost.Id, "should have created new post id")
		require.Equal(t, "message", duplicatePost.Message)
	})
}

func TestAttachFilesToPost(t *testing.T) {
	t.Run("should attach files", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		info1, err := th.App.Srv().Store().FileInfo().Save(&model.FileInfo{
			CreatorId: th.BasicUser.Id,
			Path:      "path.txt",
		})
		require.NoError(t, err)

		info2, err := th.App.Srv().Store().FileInfo().Save(&model.FileInfo{
			CreatorId: th.BasicUser.Id,
			Path:      "path.txt",
		})
		require.NoError(t, err)

		post := th.BasicPost
		post.FileIds = []string{info1.Id, info2.Id}

		appErr := th.App.attachFilesToPost(post)
		assert.Nil(t, appErr)

		infos, _, appErr := th.App.GetFileInfosForPost(post.Id, false, false)
		assert.Nil(t, appErr)
		assert.Len(t, infos, 2)
	})

	t.Run("should update File.PostIds after failing to add files", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		info1, err := th.App.Srv().Store().FileInfo().Save(&model.FileInfo{
			CreatorId: th.BasicUser.Id,
			Path:      "path.txt",
			PostId:    model.NewId(),
		})
		require.NoError(t, err)

		info2, err := th.App.Srv().Store().FileInfo().Save(&model.FileInfo{
			CreatorId: th.BasicUser.Id,
			Path:      "path.txt",
		})
		require.NoError(t, err)

		post := th.BasicPost
		post.FileIds = []string{info1.Id, info2.Id}

		appErr := th.App.attachFilesToPost(post)
		assert.Nil(t, appErr)

		infos, _, appErr := th.App.GetFileInfosForPost(post.Id, false, false)
		assert.Nil(t, appErr)
		assert.Len(t, infos, 1)
		assert.Equal(t, info2.Id, infos[0].Id)

		updated, appErr := th.App.GetSinglePost(post.Id, false)
		require.Nil(t, appErr)
		assert.Len(t, updated.FileIds, 1)
		assert.Contains(t, updated.FileIds, info2.Id)
	})
}

func TestUpdatePostEditAt(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := th.BasicPost.Clone()

	post.IsPinned = true
	saved, err := th.App.UpdatePost(th.Context, post, true)
	require.Nil(t, err)
	assert.Equal(t, saved.EditAt, post.EditAt, "shouldn't have updated post.EditAt when pinning post")
	post = saved.Clone()

	time.Sleep(time.Millisecond * 100)

	post.Message = model.NewId()
	saved, err = th.App.UpdatePost(th.Context, post, true)
	require.Nil(t, err)
	assert.NotEqual(t, saved.EditAt, post.EditAt, "should have updated post.EditAt when updating post message")

	time.Sleep(time.Millisecond * 200)
}

func TestUpdatePostTimeLimit(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := th.BasicPost.Clone()

	th.App.Srv().SetLicense(model.NewTestLicense())

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = -1
	})
	_, err := th.App.UpdatePost(th.Context, post, true)
	require.Nil(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = 1000000000
	})
	post.Message = model.NewId()

	_, err = th.App.UpdatePost(th.Context, post, true)
	require.Nil(t, err, "should allow you to edit the post")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = 1
	})
	post.Message = model.NewId()
	_, err = th.App.UpdatePost(th.Context, post, true)
	require.NotNil(t, err, "should fail on update old post")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = -1
	})
}

func TestUpdatePostInArchivedChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	archivedChannel := th.CreateChannel(th.Context, th.BasicTeam)
	post := th.CreatePost(archivedChannel)
	th.App.DeleteChannel(th.Context, archivedChannel, "")

	_, err := th.App.UpdatePost(th.Context, post, true)
	require.NotNil(t, err)
	require.Equal(t, "api.post.update_post.can_not_update_post_in_deleted.error", err.Id)
}

func TestPostReplyToPostWhereRootPosterLeftChannel(t *testing.T) {
	// This test ensures that when replying to a root post made by a user who has since left the channel, the reply
	// post completes successfully. This is a regression test for PLT-6523.
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel
	userInChannel := th.BasicUser2
	userNotInChannel := th.BasicUser
	rootPost := th.BasicPost

	_, err := th.App.AddUserToChannel(th.Context, userInChannel, channel, false)
	require.Nil(t, err)

	err = th.App.RemoveUserFromChannel(th.Context, userNotInChannel.Id, "", channel)
	require.Nil(t, err)
	replyPost := model.Post{
		Message:       "asd",
		ChannelId:     channel.Id,
		RootId:        rootPost.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        userInChannel.Id,
		CreateAt:      0,
	}

	_, err = th.App.CreatePostAsUser(th.Context, &replyPost, "", true)
	require.Nil(t, err)
}

func TestPostAttachPostToChildPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel
	user := th.BasicUser
	rootPost := th.BasicPost

	replyPost1 := model.Post{
		Message:       "reply one",
		ChannelId:     channel.Id,
		RootId:        rootPost.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        user.Id,
		CreateAt:      0,
	}

	res1, err := th.App.CreatePostAsUser(th.Context, &replyPost1, "", true)
	require.Nil(t, err)

	replyPost2 := model.Post{
		Message:       "reply two",
		ChannelId:     channel.Id,
		RootId:        res1.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        user.Id,
		CreateAt:      0,
	}

	_, err = th.App.CreatePostAsUser(th.Context, &replyPost2, "", true)
	assert.Equalf(t, err.StatusCode, http.StatusBadRequest, "Expected BadRequest error, got %v", err)

	replyPost3 := model.Post{
		Message:       "reply three",
		ChannelId:     channel.Id,
		RootId:        rootPost.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        user.Id,
		CreateAt:      0,
	}

	_, err = th.App.CreatePostAsUser(th.Context, &replyPost3, "", true)
	assert.Nil(t, err)
}

func TestPostChannelMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel
	user := th.BasicUser

	channelToMention, err := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "Mention Test",
		Name:        "mention-test",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
	}, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteChannel(th.Context, channelToMention)

	_, err = th.App.AddUserToChannel(th.Context, user, channel, false)
	require.Nil(t, err)

	post := &model.Post{
		Message:       fmt.Sprintf("hello, ~%v!", channelToMention.Name),
		ChannelId:     channel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        user.Id,
		CreateAt:      0,
	}

	post, err = th.App.CreatePostAsUser(th.Context, post, "", true)
	require.Nil(t, err)
	assert.Equal(t, map[string]any{
		"mention-test": map[string]any{
			"display_name": "Mention Test",
			"team_name":    th.BasicTeam.Name,
		},
	}, post.GetProp("channel_mentions"))

	post.Message = fmt.Sprintf("goodbye, ~%v!", channelToMention.Name)
	result, err := th.App.UpdatePost(th.Context, post, false)
	require.Nil(t, err)
	assert.Equal(t, map[string]any{
		"mention-test": map[string]any{
			"display_name": "Mention Test",
			"team_name":    th.BasicTeam.Name,
		},
	}, result.GetProp("channel_mentions"))
}

func TestImageProxy(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*storemocks.Store)
	mockUserStore := storemocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := storemocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := storemocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
	})

	th.App.ch.imageProxy = imageproxy.MakeImageProxy(th.Server.platform, th.Server.HTTPService(), th.Server.Log())

	for name, tc := range map[string]struct {
		ProxyType              string
		ProxyURL               string
		ProxyOptions           string
		ImageURL               string
		ProxiedImageURL        string
		ProxiedRemovedImageURL string
	}{
		"atmos/camo": {
			ProxyType:              model.ImageProxyTypeAtmosCamo,
			ProxyURL:               "https://127.0.0.1",
			ProxyOptions:           "foo",
			ImageURL:               "http://mydomain.com/myimage",
			ProxiedRemovedImageURL: "http://mydomain.com/myimage",
			ProxiedImageURL:        "http://mymattermost.com/api/v4/image?url=http%3A%2F%2Fmydomain.com%2Fmyimage",
		},
		"atmos/camo_SameSite": {
			ProxyType:              model.ImageProxyTypeAtmosCamo,
			ProxyURL:               "https://127.0.0.1",
			ProxyOptions:           "foo",
			ImageURL:               "http://mymattermost.com/myimage",
			ProxiedRemovedImageURL: "http://mymattermost.com/myimage",
			ProxiedImageURL:        "http://mymattermost.com/myimage",
		},
		"atmos/camo_PathOnly": {
			ProxyType:              model.ImageProxyTypeAtmosCamo,
			ProxyURL:               "https://127.0.0.1",
			ProxyOptions:           "foo",
			ImageURL:               "/myimage",
			ProxiedRemovedImageURL: "http://mymattermost.com/myimage",
			ProxiedImageURL:        "http://mymattermost.com/myimage",
		},
		"atmos/camo_EmptyImageURL": {
			ProxyType:              model.ImageProxyTypeAtmosCamo,
			ProxyURL:               "https://127.0.0.1",
			ProxyOptions:           "foo",
			ImageURL:               "",
			ProxiedRemovedImageURL: "",
			ProxiedImageURL:        "",
		},
		"local": {
			ProxyType:              model.ImageProxyTypeLocal,
			ImageURL:               "http://mydomain.com/myimage",
			ProxiedRemovedImageURL: "http://mydomain.com/myimage",
			ProxiedImageURL:        "http://mymattermost.com/api/v4/image?url=http%3A%2F%2Fmydomain.com%2Fmyimage",
		},
		"local_SameSite": {
			ProxyType:              model.ImageProxyTypeLocal,
			ImageURL:               "http://mymattermost.com/myimage",
			ProxiedRemovedImageURL: "http://mymattermost.com/myimage",
			ProxiedImageURL:        "http://mymattermost.com/myimage",
		},
		"local_PathOnly": {
			ProxyType:              model.ImageProxyTypeLocal,
			ImageURL:               "/myimage",
			ProxiedRemovedImageURL: "http://mymattermost.com/myimage",
			ProxiedImageURL:        "http://mymattermost.com/myimage",
		},
		"local_EmptyImageURL": {
			ProxyType:              model.ImageProxyTypeLocal,
			ImageURL:               "",
			ProxiedRemovedImageURL: "",
			ProxiedImageURL:        "",
		},
	} {
		t.Run(name, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.ImageProxySettings.Enable = model.NewBool(true)
				cfg.ImageProxySettings.ImageProxyType = model.NewString(tc.ProxyType)
				cfg.ImageProxySettings.RemoteImageProxyOptions = model.NewString(tc.ProxyOptions)
				cfg.ImageProxySettings.RemoteImageProxyURL = model.NewString(tc.ProxyURL)
			})

			post := &model.Post{
				Id:      model.NewId(),
				Message: "![foo](" + tc.ImageURL + ")",
			}

			list := model.NewPostList()
			list.Posts[post.Id] = post

			assert.Equal(t, "![foo]("+tc.ProxiedImageURL+")", th.App.PostWithProxyAddedToImageURLs(post).Message)

			assert.Equal(t, "![foo]("+tc.ImageURL+")", th.App.PostWithProxyRemovedFromImageURLs(post).Message)
			post.Message = "![foo](" + tc.ProxiedImageURL + ")"
			assert.Equal(t, "![foo]("+tc.ProxiedRemovedImageURL+")", th.App.PostWithProxyRemovedFromImageURLs(post).Message)

			if tc.ImageURL != "" {
				post.Message = "![foo](" + tc.ImageURL + " =500x200)"
				assert.Equal(t, "![foo]("+tc.ProxiedImageURL+" =500x200)", th.App.PostWithProxyAddedToImageURLs(post).Message)
				assert.Equal(t, "![foo]("+tc.ImageURL+" =500x200)", th.App.PostWithProxyRemovedFromImageURLs(post).Message)
				post.Message = "![foo](" + tc.ProxiedImageURL + " =500x200)"
				assert.Equal(t, "![foo]("+tc.ProxiedRemovedImageURL+" =500x200)", th.App.PostWithProxyRemovedFromImageURLs(post).Message)
			}
		})
	}
}

func TestMaxPostSize(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		Description         string
		StoreMaxPostSize    int
		ExpectedMaxPostSize int
	}{
		{
			"Max post size less than model.model.POST_MESSAGE_MAX_RUNES_V1 ",
			0,
			model.PostMessageMaxRunesV1,
		},
		{
			"4000 rune limit",
			4000,
			4000,
		},
		{
			"16383 rune limit",
			16383,
			16383,
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			mockStore.PostStore.On("GetMaxPostSize").Return(testCase.StoreMaxPostSize)

			app := App{
				ch: &Channels{
					srv: &Server{
						platform: &platform.PlatformService{
							Store: mockStore,
						},
					},
				},
			}

			assert.Equal(t, testCase.ExpectedMaxPostSize, app.MaxPostSize())
		})
	}
}

func TestDeletePostWithFileAttachments(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create a post with a file attachment.
	teamID := th.BasicTeam.Id
	channelID := th.BasicChannel.Id
	userID := th.BasicUser.Id
	filename := "test"
	data := []byte("abcd")

	info1, err := th.App.DoUploadFile(th.Context, time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamID, channelID, userID, filename, data)
	require.Nil(t, err)
	defer func() {
		th.App.Srv().Store().FileInfo().PermanentDelete(info1.Id)
		th.App.RemoveFile(info1.Path)
	}()

	post := &model.Post{
		Message:       "asd",
		ChannelId:     channelID,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        userID,
		CreateAt:      0,
		FileIds:       []string{info1.Id},
	}

	post, err = th.App.CreatePost(th.Context, post, th.BasicChannel, false, true)
	assert.Nil(t, err)

	// Delete the post.
	_, err = th.App.DeletePost(th.Context, post.Id, userID)
	assert.Nil(t, err)

	// Wait for the cleanup routine to finish.
	time.Sleep(time.Millisecond * 100)

	// Check that the file can no longer be reached.
	_, err = th.App.GetFileInfo(info1.Id)
	assert.NotNil(t, err)
}

func TestDeletePostInArchivedChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	archivedChannel := th.CreateChannel(th.Context, th.BasicTeam)
	post := th.CreatePost(archivedChannel)
	th.App.DeleteChannel(th.Context, archivedChannel, "")

	_, err := th.App.DeletePost(th.Context, post.Id, "")
	require.NotNil(t, err)
	require.Equal(t, "api.post.delete_post.can_not_delete_post_in_deleted.error", err.Id)
}

func TestCreatePost(t *testing.T) {
	t.Run("call PreparePostForClient before returning", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
			*cfg.ImageProxySettings.Enable = true
			*cfg.ImageProxySettings.ImageProxyType = "atmos/camo"
			*cfg.ImageProxySettings.RemoteImageProxyURL = "https://127.0.0.1"
			*cfg.ImageProxySettings.RemoteImageProxyOptions = "foo"
		})

		th.App.ch.imageProxy = imageproxy.MakeImageProxy(th.Server.platform, th.Server.HTTPService(), th.Server.Log())

		imageURL := "http://mydomain.com/myimage"
		proxiedImageURL := "http://mymattermost.com/api/v4/image?url=http%3A%2F%2Fmydomain.com%2Fmyimage"

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "![image](" + imageURL + ")",
			UserId:    th.BasicUser.Id,
		}

		rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, false, true)
		require.Nil(t, err)
		assert.Equal(t, "![image]("+proxiedImageURL+")", rpost.Message)
	})

	t.Run("Sets prop MENTION_HIGHLIGHT_DISABLED when it should", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.AddUserToChannel(th.BasicUser, th.BasicChannel)

		t.Run("Does not set prop when user has USE_CHANNEL_MENTIONS", func(t *testing.T) {
			postWithNoMention := &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "This post does not have mentions",
				UserId:    th.BasicUser.Id,
			}
			rpost, err := th.App.CreatePost(th.Context, postWithNoMention, th.BasicChannel, false, true)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})

			postWithMention := &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "This post has @here mention @all",
				UserId:    th.BasicUser.Id,
			}
			rpost, err = th.App.CreatePost(th.Context, postWithMention, th.BasicChannel, false, true)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})
		})

		t.Run("Sets prop when post has mentions and user does not have USE_CHANNEL_MENTIONS", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionUseChannelMentions.Id, model.ChannelUserRoleId)
			th.RemovePermissionFromRole(model.PermissionUseChannelMentions.Id, model.ChannelAdminRoleId)

			postWithNoMention := &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "This post does not have mentions",
				UserId:    th.BasicUser.Id,
			}
			rpost, err := th.App.CreatePost(th.Context, postWithNoMention, th.BasicChannel, false, true)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})

			postWithMention := &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "This post has @here mention @all",
				UserId:    th.BasicUser.Id,
			}
			rpost, err = th.App.CreatePost(th.Context, postWithMention, th.BasicChannel, false, true)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProp(model.PostPropsMentionHighlightDisabled), true)

			th.AddPermissionToRole(model.PermissionUseChannelMentions.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(model.PermissionUseChannelMentions.Id, model.ChannelAdminRoleId)
		})
	})

	t.Run("Sets PostPropsPreviewedPost when a permalink is the first link", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.AddUserToChannel(th.BasicUser, th.BasicChannel)

		referencedPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		})

		th.Context.Session().UserId = th.BasicUser.Id

		referencedPost, err := th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, false, false)
		require.Nil(t, err)

		permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		channelForPreview := th.CreateChannel(th.Context, th.BasicTeam)
		previewPost := &model.Post{
			ChannelId: channelForPreview.Id,
			Message:   permalink,
			UserId:    th.BasicUser.Id,
		}

		previewPost, err = th.App.CreatePost(th.Context, previewPost, channelForPreview, false, false)
		require.Nil(t, err)

		assert.Equal(t, previewPost.GetProps(), model.StringInterface{"previewed_post": referencedPost.Id})
	})

	t.Run("creates a single record for a permalink preview post", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		channelForPreview := th.CreateChannel(th.Context, th.BasicTeam)

		referencedPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}
		referencedPost, err := th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, false, false)
		require.Nil(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://foobar.com"
			*cfg.ServiceSettings.EnablePermalinkPreviews = true
		})

		permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		previewPost := &model.Post{
			ChannelId: channelForPreview.Id,
			Message:   permalink,
			UserId:    th.BasicUser.Id,
		}

		previewPost, err = th.App.CreatePost(th.Context, previewPost, channelForPreview, false, false)
		require.Nil(t, err)

		sqlStore := th.GetSqlStore()
		sql := fmt.Sprintf("select count(*) from Posts where Id = '%[1]s' or OriginalId = '%[1]s';", previewPost.Id)
		var val int64
		err2 := sqlStore.GetMasterX().Get(&val, sql)
		require.NoError(t, err2)

		require.EqualValues(t, int64(1), val)
	})

	t.Run("sanitizes post metadata appropriately", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		})

		th.AddUserToChannel(th.BasicUser, th.BasicChannel)

		user1 := th.CreateUser()
		user2 := th.CreateUser()
		directChannel, err := th.App.createDirectChannel(th.Context, user1.Id, user2.Id)
		require.Nil(t, err)

		referencedPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}

		th.Context.Session().UserId = th.BasicUser.Id

		referencedPost, err = th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, false, false)
		require.Nil(t, err)

		permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		testCases := []struct {
			Description string
			Channel     *model.Channel
			Author      string
			Assert      func(t assert.TestingT, object any, msgAndArgs ...any) bool
		}{
			{
				Description: "removes metadata from post for members who cannot read channel",
				Channel:     directChannel,
				Author:      user1.Id,
				Assert:      assert.Nil,
			},
			{
				Description: "does not remove metadata from post for members who can read channel",
				Channel:     th.BasicChannel,
				Author:      th.BasicUser.Id,
				Assert:      assert.NotNil,
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				previewPost := &model.Post{
					ChannelId: testCase.Channel.Id,
					Message:   permalink,
					UserId:    testCase.Author,
				}

				previewPost, err = th.App.CreatePost(th.Context, previewPost, testCase.Channel, false, false)
				require.Nil(t, err)

				testCase.Assert(t, previewPost.Metadata.Embeds[0].Data)
			})
		}
	})

	t.Run("MM-40016 should not panic with `concurrent map read and map write`", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		channelForPreview := th.CreateChannel(th.Context, th.BasicTeam)

		for i := 0; i < 20; i++ {
			user := th.CreateUser()
			th.LinkUserToTeam(user, th.BasicTeam)
			th.AddUserToChannel(user, channelForPreview)
		}

		referencedPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}
		referencedPost, err := th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, false, false)
		require.Nil(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://example.com"
			*cfg.ServiceSettings.EnablePermalinkPreviews = true
		})

		permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		previewPost := &model.Post{
			ChannelId: channelForPreview.Id,
			Message:   permalink,
			UserId:    th.BasicUser.Id,
		}

		previewPost, err = th.App.CreatePost(th.Context, previewPost, channelForPreview, false, false)
		require.Nil(t, err)

		n := 1000
		var wg sync.WaitGroup
		wg.Add(n)
		for i := 0; i < n; i++ {
			go func() {
				defer wg.Done()
				post := previewPost.Clone()
				th.App.UpdatePost(th.Context, post, false)
			}()
		}

		wg.Wait()
	})
}

func TestPatchPost(t *testing.T) {
	t.Run("call PreparePostForClient before returning", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
			*cfg.ImageProxySettings.Enable = true
			*cfg.ImageProxySettings.ImageProxyType = "atmos/camo"
			*cfg.ImageProxySettings.RemoteImageProxyURL = "https://127.0.0.1"
			*cfg.ImageProxySettings.RemoteImageProxyOptions = "foo"
		})

		th.App.ch.imageProxy = imageproxy.MakeImageProxy(th.Server.platform, th.Server.HTTPService(), th.Server.Log())

		imageURL := "http://mydomain.com/myimage"
		proxiedImageURL := "http://mymattermost.com/api/v4/image?url=http%3A%2F%2Fmydomain.com%2Fmyimage"

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "![image](http://mydomain/anotherimage)",
			UserId:    th.BasicUser.Id,
		}

		rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, false, true)
		require.Nil(t, err)
		assert.NotEqual(t, "![image]("+proxiedImageURL+")", rpost.Message)

		patch := &model.PostPatch{
			Message: model.NewString("![image](" + imageURL + ")"),
		}

		rpost, err = th.App.PatchPost(th.Context, rpost.Id, patch)
		require.Nil(t, err)
		assert.Equal(t, "![image]("+proxiedImageURL+")", rpost.Message)
	})

	t.Run("Sets Prop MENTION_HIGHLIGHT_DISABLED when it should", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.AddUserToChannel(th.BasicUser, th.BasicChannel)

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "This post does not have mentions",
			UserId:    th.BasicUser.Id,
		}

		rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, false, true)
		require.Nil(t, err)

		t.Run("Does not set prop when user has USE_CHANNEL_MENTIONS", func(t *testing.T) {
			patchWithNoMention := &model.PostPatch{Message: model.NewString("This patch has no channel mention")}

			rpost, err = th.App.PatchPost(th.Context, rpost.Id, patchWithNoMention)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})

			patchWithMention := &model.PostPatch{Message: model.NewString("This patch has a mention now @here")}

			rpost, err = th.App.PatchPost(th.Context, rpost.Id, patchWithMention)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})
		})

		t.Run("Sets prop when user does not have USE_CHANNEL_MENTIONS", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionUseChannelMentions.Id, model.ChannelUserRoleId)
			th.RemovePermissionFromRole(model.PermissionUseChannelMentions.Id, model.ChannelAdminRoleId)

			patchWithNoMention := &model.PostPatch{Message: model.NewString("This patch still does not have a mention")}
			rpost, err = th.App.PatchPost(th.Context, rpost.Id, patchWithNoMention)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})

			patchWithMention := &model.PostPatch{Message: model.NewString("This patch has a mention now @here")}

			rpost, err = th.App.PatchPost(th.Context, rpost.Id, patchWithMention)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProp(model.PostPropsMentionHighlightDisabled), true)

			th.AddPermissionToRole(model.PermissionUseChannelMentions.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(model.PermissionUseChannelMentions.Id, model.ChannelAdminRoleId)
		})
	})
}

func TestCreatePostAsUser(t *testing.T) {
	t.Run("marks channel as viewed for regular user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test",
			UserId:    th.BasicUser.Id,
		}

		channelMemberBefore, err := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		_, appErr := th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, appErr)

		channelMemberAfter, err := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

		require.Greater(t, channelMemberAfter.LastViewedAt, channelMemberBefore.LastViewedAt)
	})

	t.Run("does not mark channel as viewed for webhook from user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test",
			UserId:    th.BasicUser.Id,
		}
		post.AddProp("from_webhook", "true")

		channelMemberBefore, err := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		_, appErr := th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, appErr)

		channelMemberAfter, err := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

		require.Equal(t, channelMemberAfter.LastViewedAt, channelMemberBefore.LastViewedAt)
	})

	t.Run("does not mark channel as viewed for bot user in channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot := th.CreateBot()

		botUser, appErr := th.App.GetUser(bot.UserId)
		require.Nil(t, appErr)

		th.LinkUserToTeam(botUser, th.BasicTeam)
		th.AddUserToChannel(botUser, th.BasicChannel)

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test",
			UserId:    bot.UserId,
		}

		channelMemberBefore, nErr := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, nErr)

		time.Sleep(1 * time.Millisecond)
		_, appErr = th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, appErr)

		channelMemberAfter, nErr := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, nErr)

		require.Equal(t, channelMemberAfter.LastViewedAt, channelMemberBefore.LastViewedAt)
	})

	t.Run("logs warning for user not in channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		user := th.CreateUser()
		th.LinkUserToTeam(user, th.BasicTeam)

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test",
			UserId:    user.Id,
		}

		_, appErr := th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, appErr)

		require.NoError(t, th.TestLogger.Flush())

		testlib.AssertLog(t, th.LogBuffer, mlog.LvlWarn.Name, "Failed to get membership")
	})

	t.Run("does not log warning for bot user not in channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot := th.CreateBot()

		botUser, appErr := th.App.GetUser(bot.UserId)
		require.Nil(t, appErr)

		th.LinkUserToTeam(botUser, th.BasicTeam)

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test",
			UserId:    bot.UserId,
		}

		_, appErr = th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, appErr)

		require.NoError(t, th.TestLogger.Flush())

		testlib.AssertNoLog(t, th.LogBuffer, mlog.LvlWarn.Name, "Failed to get membership")
	})

	t.Run("marks channel as viewed for reply post when CRT is off", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOff
		})

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test",
			UserId:    th.BasicUser2.Id,
		}
		rootPost, appErr := th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, appErr)

		channelMemberBefore, nErr := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, nErr)

		time.Sleep(1 * time.Millisecond)
		replyPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test reply",
			UserId:    th.BasicUser.Id,
			RootId:    rootPost.Id,
		}
		_, appErr = th.App.CreatePostAsUser(th.Context, replyPost, "", true)
		require.Nil(t, appErr)

		channelMemberAfter, nErr := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, nErr)

		require.NotEqual(t, channelMemberAfter.LastViewedAt, channelMemberBefore.LastViewedAt)
	})

	t.Run("does not mark channel as viewed for reply post when CRT is on", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ThreadAutoFollow = true
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
		})

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test",
			UserId:    th.BasicUser2.Id,
		}
		rootPost, appErr := th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, appErr)

		channelMemberBefore, nErr := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, nErr)

		time.Sleep(1 * time.Millisecond)
		replyPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test reply",
			UserId:    th.BasicUser.Id,
			RootId:    rootPost.Id,
		}
		_, appErr = th.App.CreatePostAsUser(th.Context, replyPost, "", true)
		require.Nil(t, appErr)

		channelMemberAfter, nErr := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, nErr)

		require.Equal(t, channelMemberAfter.LastViewedAt, channelMemberBefore.LastViewedAt)
	})
}

func TestPatchPostInArchivedChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	archivedChannel := th.CreateChannel(th.Context, th.BasicTeam)
	post := th.CreatePost(archivedChannel)
	th.App.DeleteChannel(th.Context, archivedChannel, "")

	_, err := th.App.PatchPost(th.Context, post.Id, &model.PostPatch{IsPinned: model.NewBool(true)})
	require.NotNil(t, err)
	require.Equal(t, "api.post.patch_post.can_not_update_post_in_deleted.error", err.Id)
}

func TestUpdatePost(t *testing.T) {
	t.Run("call PreparePostForClient before returning", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
			*cfg.ImageProxySettings.Enable = true
			*cfg.ImageProxySettings.ImageProxyType = "atmos/camo"
			*cfg.ImageProxySettings.RemoteImageProxyURL = "https://127.0.0.1"
			*cfg.ImageProxySettings.RemoteImageProxyOptions = "foo"
		})

		th.App.ch.imageProxy = imageproxy.MakeImageProxy(th.Server.platform, th.Server.HTTPService(), th.Server.Log())

		imageURL := "http://mydomain.com/myimage"
		proxiedImageURL := "http://mymattermost.com/api/v4/image?url=http%3A%2F%2Fmydomain.com%2Fmyimage"

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "![image](http://mydomain/anotherimage)",
			UserId:    th.BasicUser.Id,
		}

		rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, false, true)
		require.Nil(t, err)
		assert.NotEqual(t, "![image]("+proxiedImageURL+")", rpost.Message)

		post.Id = rpost.Id
		post.Message = "![image](" + imageURL + ")"

		rpost, err = th.App.UpdatePost(th.Context, post, false)
		require.Nil(t, err)
		assert.Equal(t, "![image]("+proxiedImageURL+")", rpost.Message)
	})

	t.Run("Sets PostPropsPreviewedPost when a post is updated to have a permalink as the first link", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.AddUserToChannel(th.BasicUser, th.BasicChannel)

		referencedPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		})

		th.Context.Session().UserId = th.BasicUser.Id

		referencedPost, err := th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, false, false)
		require.Nil(t, err)

		permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		channelForTestPost := th.CreateChannel(th.Context, th.BasicTeam)
		testPost := &model.Post{
			ChannelId: channelForTestPost.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}

		testPost, err = th.App.CreatePost(th.Context, testPost, channelForTestPost, false, false)
		require.Nil(t, err)
		assert.Equal(t, testPost.GetProps(), model.StringInterface{})

		testPost.Message = permalink
		testPost, err = th.App.UpdatePost(th.Context, testPost, false)
		require.Nil(t, err)
		assert.Equal(t, testPost.GetProps(), model.StringInterface{"previewed_post": referencedPost.Id})
	})

	t.Run("sanitizes post metadata appropriately", func(t *testing.T) {

		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		})

		th.AddUserToChannel(th.BasicUser, th.BasicChannel)

		user1 := th.CreateUser()
		user2 := th.CreateUser()
		directChannel, err := th.App.createDirectChannel(th.Context, user1.Id, user2.Id)
		require.Nil(t, err)

		referencedPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}

		th.Context.Session().UserId = th.BasicUser.Id

		referencedPost, err = th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, false, false)
		require.Nil(t, err)

		permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		testCases := []struct {
			Description string
			Channel     *model.Channel
			Author      string
			Assert      func(t assert.TestingT, object any, msgAndArgs ...any) bool
		}{
			{
				Description: "removes metadata from post for members who cannot read channel",
				Channel:     directChannel,
				Author:      user1.Id,
				Assert:      assert.Nil,
			},
			{
				Description: "does not remove metadata from post for members who can read channel",
				Channel:     th.BasicChannel,
				Author:      th.BasicUser.Id,
				Assert:      assert.NotNil,
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				previewPost := &model.Post{
					ChannelId: testCase.Channel.Id,
					UserId:    testCase.Author,
				}

				previewPost, err = th.App.CreatePost(th.Context, previewPost, testCase.Channel, false, false)
				require.Nil(t, err)

				previewPost.Message = permalink
				previewPost, err = th.App.UpdatePost(th.Context, previewPost, false)
				require.Nil(t, err)

				testCase.Assert(t, previewPost.Metadata.Embeds[0].Data)
			})
		}
	})
}

func TestSearchPostsForUser(t *testing.T) {
	perPage := 5
	searchTerm := "searchTerm"

	setup := func(t *testing.T, enableElasticsearch bool) (*TestHelper, []*model.Post) {
		th := Setup(t).InitBasic()

		posts := make([]*model.Post, 7)
		for i := 0; i < cap(posts); i++ {
			post, err := th.App.CreatePost(th.Context, &model.Post{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   searchTerm,
			}, th.BasicChannel, false, true)

			require.Nil(t, err)

			posts[i] = post
		}

		if enableElasticsearch {
			th.App.Srv().SetLicense(model.NewTestLicense("elastic_search"))

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ElasticsearchSettings.EnableIndexing = true
				*cfg.ElasticsearchSettings.EnableSearching = true
			})
		} else {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ElasticsearchSettings.EnableSearching = false
			})
		}

		return th, posts
	}

	t.Run("should return everything as first page of posts from database", func(t *testing.T) {
		th, posts := setup(t, false)
		defer th.TearDown()

		page := 0

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage, model.ModifierMessages, false)

		assert.Nil(t, err)
		assert.Equal(t, []string{
			posts[6].Id,
			posts[5].Id,
			posts[4].Id,
			posts[3].Id,
			posts[2].Id,
			posts[1].Id,
			posts[0].Id,
		}, results.Order)
	})

	t.Run("should not return later pages of posts from database", func(t *testing.T) {
		th, _ := setup(t, false)
		defer th.TearDown()

		page := 1

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage, model.ModifierMessages, false)

		assert.Nil(t, err)
		assert.Equal(t, []string{}, results.Order)
	})

	t.Run("should return first page of posts from ElasticSearch", func(t *testing.T) {
		th, posts := setup(t, true)
		defer th.TearDown()

		page := 0
		resultsPage := []string{
			posts[6].Id,
			posts[5].Id,
			posts[4].Id,
			posts[3].Id,
			posts[2].Id,
		}

		es := &mocks.SearchEngineInterface{}
		es.On("SearchPosts", mock.Anything, mock.Anything, page, perPage).Return(resultsPage, nil, nil)
		es.On("Start").Return(nil).Maybe()
		es.On("IsActive").Return(true)
		es.On("IsSearchEnabled").Return(true)
		th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = es
		defer func() {
			th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = nil
		}()

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage, model.ModifierMessages, false)

		assert.Nil(t, err)
		assert.Equal(t, resultsPage, results.Order)
		es.AssertExpectations(t)
	})

	t.Run("should return later pages of posts from ElasticSearch", func(t *testing.T) {
		th, posts := setup(t, true)
		defer th.TearDown()

		page := 1
		resultsPage := []string{
			posts[1].Id,
			posts[0].Id,
		}

		es := &mocks.SearchEngineInterface{}
		es.On("SearchPosts", mock.Anything, mock.Anything, page, perPage).Return(resultsPage, nil, nil)
		es.On("Start").Return(nil).Maybe()
		es.On("IsActive").Return(true)
		es.On("IsSearchEnabled").Return(true)
		th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = es
		defer func() {
			th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = nil
		}()

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage, model.ModifierMessages, false)

		assert.Nil(t, err)
		assert.Equal(t, resultsPage, results.Order)
		es.AssertExpectations(t)
	})

	t.Run("should fall back to database if ElasticSearch fails on first page", func(t *testing.T) {
		th, posts := setup(t, true)
		defer th.TearDown()

		page := 0

		es := &mocks.SearchEngineInterface{}
		es.On("SearchPosts", mock.Anything, mock.Anything, page, perPage).Return(nil, nil, &model.AppError{})
		es.On("GetName").Return("mock")
		es.On("Start").Return(nil).Maybe()
		es.On("IsActive").Return(true)
		es.On("IsSearchEnabled").Return(true)
		th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = es
		defer func() {
			th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = nil
		}()

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage, model.ModifierMessages, false)

		assert.Nil(t, err)
		assert.Equal(t, []string{
			posts[6].Id,
			posts[5].Id,
			posts[4].Id,
			posts[3].Id,
			posts[2].Id,
			posts[1].Id,
			posts[0].Id,
		}, results.Order)
		es.AssertExpectations(t)
	})

	t.Run("should return nothing if ElasticSearch fails on later pages", func(t *testing.T) {
		th, _ := setup(t, true)
		defer th.TearDown()

		page := 1

		es := &mocks.SearchEngineInterface{}
		es.On("SearchPosts", mock.Anything, mock.Anything, page, perPage).Return(nil, nil, &model.AppError{})
		es.On("GetName").Return("mock")
		es.On("Start").Return(nil).Maybe()
		es.On("IsActive").Return(true)
		es.On("IsSearchEnabled").Return(true)
		th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = es
		defer func() {
			th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = nil
		}()

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage, model.ModifierMessages, false)

		assert.Nil(t, err)
		assert.Equal(t, []string{}, results.Order)
		es.AssertExpectations(t)
	})
}

func TestCountMentionsFromPost(t *testing.T) {
	t.Run("should not count posts without mentions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
		}, channel, false, true)
		require.Nil(t, err)

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 0, count)
	})

	t.Run("should count keyword mentions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		user2.NotifyProps[model.MentionKeysNotifyProp] = "apple"

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "apple",
		}, channel, false, true)
		require.Nil(t, err)

		// post1 and post3 should mention the user

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 2, count)
	})

	t.Run("should count channel-wide mentions when enabled", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		user2.NotifyProps[model.ChannelMentionsNotifyProp] = "true"

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@channel",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all",
		}, channel, false, true)
		require.Nil(t, err)

		// post2 and post3 should mention the user

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 2, count)
	})

	t.Run("should not count channel-wide mentions when disabled for user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		user2.NotifyProps[model.ChannelMentionsNotifyProp] = "false"

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@channel",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all",
		}, channel, false, true)
		require.Nil(t, err)

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 0, count)
	})

	t.Run("should not count channel-wide mentions when disabled for channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		user2.NotifyProps[model.ChannelMentionsNotifyProp] = "true"

		_, err := th.App.UpdateChannelMemberNotifyProps(th.Context, map[string]string{
			model.IgnoreChannelMentionsNotifyProp: model.IgnoreChannelMentionsOn,
		}, channel.Id, user2.Id)
		require.Nil(t, err)

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@channel",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all",
		}, channel, false, true)
		require.Nil(t, err)

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 0, count)
	})

	t.Run("should count comment mentions when using COMMENTS_NOTIFY_ROOT", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		user2.NotifyProps[model.CommentsNotifyProp] = model.CommentsNotifyRoot

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   "test",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post1.Id,
			Message:   "test2",
		}, channel, false, true)
		require.Nil(t, err)
		post3, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    post3.Id,
			Message:   "test4",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post3.Id,
			Message:   "test5",
		}, channel, false, true)
		require.Nil(t, err)

		// post2 should mention the user

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 1, count)
	})

	t.Run("should count comment mentions when using COMMENTS_NOTIFY_ANY", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		user2.NotifyProps[model.CommentsNotifyProp] = model.CommentsNotifyAny

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   "test",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post1.Id,
			Message:   "test2",
		}, channel, false, true)
		require.Nil(t, err)
		post3, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    post3.Id,
			Message:   "test4",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post3.Id,
			Message:   "test5",
		}, channel, false, true)
		require.Nil(t, err)

		// post2 and post5 should mention the user

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 2, count)
	})

	t.Run("should count mentions caused by being added to the channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test",
			Type:      model.PostTypeAddToChannel,
			Props: map[string]any{
				model.PostPropsAddedUserId: model.NewId(),
			},
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
			Type:      model.PostTypeAddToChannel,
			Props: map[string]any{
				model.PostPropsAddedUserId: user2.Id,
			},
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
			Type:      model.PostTypeAddToChannel,
			Props: map[string]any{
				model.PostPropsAddedUserId: user2.Id,
			},
		}, channel, false, true)
		require.Nil(t, err)

		// should be mentioned by post2 and post3

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 2, count)
	})

	t.Run("should return the number of posts made by the other user for a direct channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel, err := th.App.createDirectChannel(th.Context, user1.Id, user2.Id)
		require.Nil(t, err)

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test",
		}, channel, false, true)
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
		}, channel, false, true)
		require.Nil(t, err)

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 2, count)

		count, _, err = th.App.countMentionsFromPost(th.Context, user1, post1)

		assert.Nil(t, err)
		assert.Equal(t, 0, count)
	})

	t.Run("should not count mentions from the before the given post", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		_, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, false, true)
		require.Nil(t, err)
		post2, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, false, true)
		require.Nil(t, err)

		// post1 and post3 should mention the user, but we only count post3

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post2)

		assert.Nil(t, err)
		assert.Equal(t, 1, count)
	})

	t.Run("should not count mentions from the user's own posts", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, false, true)
		require.Nil(t, err)

		// post2 should mention the user

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 1, count)
	})

	t.Run("should include comments made before the given post when counting comment mentions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		user2.NotifyProps[model.CommentsNotifyProp] = model.CommentsNotifyAny

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test1",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    post1.Id,
			Message:   "test2",
		}, channel, false, true)
		require.Nil(t, err)
		post3, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post1.Id,
			Message:   "test4",
		}, channel, false, true)
		require.Nil(t, err)

		// post4 should mention the user

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post3)

		assert.Nil(t, err)
		assert.Equal(t, 1, count)
	})

	t.Run("should count mentions from the user's webhook posts", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test1",
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, false, true)
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
			Props: map[string]any{
				"from_webhook": "true",
			},
		}, channel, false, true)
		require.Nil(t, err)

		// post3 should mention the user

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 1, count)
	})

	t.Run("should count multiple pages of mentions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		numPosts := 215

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, false, true)
		require.Nil(t, err)

		for i := 0; i < numPosts-1; i++ {
			_, err = th.App.CreatePost(th.Context, &model.Post{
				UserId:    user1.Id,
				ChannelId: channel.Id,
				Message:   fmt.Sprintf("@%s", user2.Username),
			}, channel, false, true)
			require.Nil(t, err)
		}

		// Every post should mention the user

		count, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, numPosts, count)
	})
}

func TestFillInPostProps(t *testing.T) {
	t.Run("should not add disable group highlight to post props for user with group mention permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

		user1 := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam)

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test123123 @group1 @group2 blah blah blah",
		}, channel, false, true)
		require.Nil(t, err)

		err = th.App.FillInPostProps(th.Context, post1, channel)

		assert.Nil(t, err)
		assert.Equal(t, post1.Props, model.StringInterface{})
	})

	t.Run("should not add disable group highlight to post props for app without license", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		id := model.NewId()
		guest := &model.User{
			Email:         "success+" + id + "@simulator.amazonses.com",
			Username:      "un_" + id,
			Nickname:      "nn_" + id,
			Password:      "Password1",
			EmailVerified: true,
		}
		guest, err := th.App.CreateGuest(th.Context, guest)
		require.Nil(t, err)
		th.LinkUserToTeam(guest, th.BasicTeam)

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(guest, channel)

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    guest.Id,
			ChannelId: channel.Id,
			Message:   "test123123 @group1 @group2 blah blah blah",
		}, channel, false, true)
		require.Nil(t, err)

		err = th.App.FillInPostProps(th.Context, post1, channel)

		assert.Nil(t, err)
		assert.Equal(t, post1.Props, model.StringInterface{})
	})

	t.Run("should add disable group highlight to post props for guest user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

		id := model.NewId()
		guest := &model.User{
			Email:         "success+" + id + "@simulator.amazonses.com",
			Username:      "un_" + id,
			Nickname:      "nn_" + id,
			Password:      "Password1",
			EmailVerified: true,
		}
		guest, err := th.App.CreateGuest(th.Context, guest)
		require.Nil(t, err)
		th.LinkUserToTeam(guest, th.BasicTeam)

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(guest, channel)

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    guest.Id,
			ChannelId: channel.Id,
			Message:   "test123123 @group1 @group2 blah blah blah",
		}, channel, false, true)
		require.Nil(t, err)

		err = th.App.FillInPostProps(th.Context, post1, channel)

		assert.Nil(t, err)
		assert.Equal(t, post1.Props, model.StringInterface{"disable_group_highlight": true})
	})
}

func TestThreadMembership(t *testing.T) {
	t.Run("should update memberships for conversation participants", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ThreadAutoFollow = true
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
		})

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		postRoot, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "root post",
		}, channel, false, true)
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    postRoot.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, false, true)
		require.Nil(t, err)

		// first user should now be part of the thread since they replied to a post
		memberships, err2 := th.App.GetThreadMembershipsForUser(user1.Id, th.BasicTeam.Id)
		require.NoError(t, err2)
		require.Len(t, memberships, 1)
		// second user should also be part of a thread since they were mentioned
		memberships, err2 = th.App.GetThreadMembershipsForUser(user2.Id, th.BasicTeam.Id)
		require.NoError(t, err2)
		require.Len(t, memberships, 1)

		post2, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   "second post",
		}, channel, false, true)
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    post2.Id,
			Message:   fmt.Sprintf("@%s", user1.Username),
		}, channel, false, true)
		require.Nil(t, err)

		// first user should now be part of two threads
		memberships, err2 = th.App.GetThreadMembershipsForUser(user1.Id, th.BasicTeam.Id)
		require.NoError(t, err2)
		require.Len(t, memberships, 2)
	})
}

func TestFollowThreadSkipsParticipants(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	channel := th.BasicChannel
	user := th.BasicUser
	user2 := th.BasicUser2
	sysadmin := th.SystemAdminUser

	appErr := th.App.JoinChannel(th.Context, channel, user.Id)
	require.Nil(t, appErr)
	appErr = th.App.JoinChannel(th.Context, channel, user2.Id)
	require.Nil(t, appErr)
	_, appErr = th.App.JoinUserToTeam(th.Context, th.BasicTeam, sysadmin, sysadmin.Id)
	require.Nil(t, appErr)
	appErr = th.App.JoinChannel(th.Context, channel, sysadmin.Id)
	require.Nil(t, appErr)

	p1, err := th.App.CreatePost(th.Context, &model.Post{UserId: user.Id, ChannelId: channel.Id, Message: "Hi @" + sysadmin.Username}, channel, false, false)
	require.Nil(t, err)
	_, err = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "Hola"}, channel, false, false)
	require.Nil(t, err)

	threadMembership, err := th.App.GetThreadMembershipForUser(user.Id, p1.Id)
	require.Nil(t, err)
	thread, err := th.App.GetThreadForUser(threadMembership, false)
	require.Nil(t, err)
	require.Len(t, thread.Participants, 1) // length should be 1, the original poster, since sysadmin was just mentioned but didn't post

	_, err = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: sysadmin.Id, ChannelId: channel.Id, Message: "sysadmin reply"}, channel, false, false)
	require.Nil(t, err)

	threadMembership, err = th.App.GetThreadMembershipForUser(user.Id, p1.Id)
	require.Nil(t, err)
	thread, err = th.App.GetThreadForUser(threadMembership, false)
	require.Nil(t, err)
	require.Len(t, thread.Participants, 2) // length should be 2, the original poster and sysadmin, since sysadmin participated now

	// another user follows the thread
	th.App.UpdateThreadFollowForUser(user2.Id, th.BasicTeam.Id, p1.Id, true)

	threadMembership, err = th.App.GetThreadMembershipForUser(user2.Id, p1.Id)
	require.Nil(t, err)
	thread, err = th.App.GetThreadForUser(threadMembership, false)
	require.Nil(t, err)
	require.Len(t, thread.Participants, 2) // length should be 2, since follow shouldn't update participant list, only user1 and sysadmin are participants
	for _, p := range thread.Participants {
		require.True(t, p.Id == sysadmin.Id || p.Id == user.Id)
	}
}

func TestAutofollowBasedOnRootPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	channel := th.BasicChannel
	user := th.BasicUser
	user2 := th.BasicUser2
	appErr := th.App.JoinChannel(th.Context, channel, user.Id)
	require.Nil(t, appErr)
	appErr = th.App.JoinChannel(th.Context, channel, user2.Id)
	require.Nil(t, appErr)
	p1, err := th.App.CreatePost(th.Context, &model.Post{UserId: user.Id, ChannelId: channel.Id, Message: "Hi @" + user2.Username}, channel, false, false)
	require.Nil(t, err)
	m, e := th.App.GetThreadMembershipsForUser(user2.Id, th.BasicTeam.Id)
	require.NoError(t, e)
	require.Len(t, m, 0)
	_, err2 := th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "Hola"}, channel, false, false)
	require.Nil(t, err2)
	m, e = th.App.GetThreadMembershipsForUser(user2.Id, th.BasicTeam.Id)
	require.NoError(t, e)
	require.Len(t, m, 1)
}

func TestViewChannelShouldNotUpdateThreads(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	channel := th.BasicChannel
	user := th.BasicUser
	user2 := th.BasicUser2
	appErr := th.App.JoinChannel(th.Context, channel, user.Id)
	require.Nil(t, appErr)
	appErr = th.App.JoinChannel(th.Context, channel, user2.Id)
	require.Nil(t, appErr)
	p1, err := th.App.CreatePost(th.Context, &model.Post{UserId: user.Id, ChannelId: channel.Id, Message: "Hi @" + user2.Username}, channel, false, false)
	require.Nil(t, err)
	_, err2 := th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "Hola"}, channel, false, false)
	require.Nil(t, err2)
	m, e := th.App.GetThreadMembershipsForUser(user2.Id, th.BasicTeam.Id)
	require.NoError(t, e)

	th.App.ViewChannel(th.Context, &model.ChannelView{
		ChannelId:     channel.Id,
		PrevChannelId: "",
	}, user2.Id, "", true)

	m1, e1 := th.App.GetThreadMembershipsForUser(user2.Id, th.BasicTeam.Id)
	require.NoError(t, e1)
	require.Equal(t, m[0].LastViewed, m1[0].LastViewed) // opening the channel shouldn't update threads
}

func TestCollapsedThreadFetch(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})
	user1 := th.BasicUser
	user2 := th.BasicUser2

	t.Run("should only return root posts, enriched", func(t *testing.T) {
		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)
		defer th.App.DeleteChannel(th.Context, channel, user1.Id)

		postRoot, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "root post",
		}, channel, false, true)
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    postRoot.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, false, true)
		require.Nil(t, err)
		thread, nErr := th.App.Srv().Store().Thread().Get(postRoot.Id)
		require.NoError(t, nErr)
		require.Len(t, thread.Participants, 1)
		th.App.MarkChannelAsUnreadFromPost(th.Context, postRoot.Id, user1.Id, true)
		l, err := th.App.GetPostsForChannelAroundLastUnread(th.Context, channel.Id, user1.Id, 10, 10, true, true, false)
		require.Nil(t, err)
		require.Len(t, l.Order, 1)
		require.EqualValues(t, 1, l.Posts[postRoot.Id].ReplyCount)
		require.EqualValues(t, []string{user1.Id}, []string{l.Posts[postRoot.Id].Participants[0].Id})
		require.Empty(t, l.Posts[postRoot.Id].Participants[0].Email)
		require.NotZero(t, l.Posts[postRoot.Id].LastReplyAt)
		require.True(t, *l.Posts[postRoot.Id].IsFollowing)

		// try extended fetch
		l, err = th.App.GetPostsForChannelAroundLastUnread(th.Context, channel.Id, user1.Id, 10, 10, true, true, true)
		require.Nil(t, err)
		require.Len(t, l.Order, 1)
		require.NotEmpty(t, l.Posts[postRoot.Id].Participants[0].Email)
	})

	t.Run("Should not panic on unexpected db error", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.CollapsedThreads = true
		})

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)
		defer th.App.DeleteChannel(th.Context, channel, user1.Id)

		postRoot, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "root post",
		}, channel, false, true)
		require.Nil(t, err)

		// we introduce a race to trigger an unexpected error from the db side.
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			th.Server.Store().Post().PermanentDeleteByUser(user1.Id)
		}()

		require.NotPanics(t, func() {
			th.App.CreatePost(th.Context, &model.Post{
				UserId:    user1.Id,
				ChannelId: channel.Id,
				RootId:    postRoot.Id,
				Message:   fmt.Sprintf("@%s", user2.Username),
			}, channel, false, true)
		})

		wg.Wait()
	})

	t.Run("should sanitize participant data", func(t *testing.T) {
		id := model.NewId()
		user3, err := th.App.CreateUser(th.Context, &model.User{
			Email:         "success+" + id + "@simulator.amazonses.com",
			Username:      "un_" + id,
			Nickname:      "nn_" + id,
			AuthData:      ptrStr("bobbytables"),
			AuthService:   "saml",
			EmailVerified: true,
		})
		require.Nil(t, err)

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.LinkUserToTeam(user3, th.BasicTeam)
		th.AddUserToChannel(user3, channel)
		defer th.App.DeleteChannel(th.Context, channel, user1.Id)
		defer th.App.PermanentDeleteUser(th.Context, user3)

		postRoot, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "root post",
		}, channel, false, true)
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user3.Id,
			ChannelId: channel.Id,
			RootId:    postRoot.Id,
			Message:   "reply",
		}, channel, false, true)
		require.Nil(t, err)
		thread, nErr := th.App.Srv().Store().Thread().Get(postRoot.Id)
		require.NoError(t, nErr)
		require.Len(t, thread.Participants, 1)

		// extended fetch posts page
		l, err := th.App.GetPostsPage(model.GetPostsOptions{
			UserId:                   user1.Id,
			ChannelId:                channel.Id,
			PerPage:                  int(10),
			SkipFetchThreads:         false,
			CollapsedThreads:         true,
			CollapsedThreadsExtended: true,
		})
		require.Nil(t, err)
		require.Len(t, l.Order, 1)
		require.NotEmpty(t, l.Posts[postRoot.Id].Participants[0].Email)
		require.Empty(t, l.Posts[postRoot.Id].Participants[0].AuthData)

		th.App.MarkChannelAsUnreadFromPost(th.Context, postRoot.Id, user1.Id, true)

		// extended fetch posts around
		l, err = th.App.GetPostsForChannelAroundLastUnread(th.Context, channel.Id, user1.Id, 10, 10, true, true, true)
		require.Nil(t, err)
		require.Len(t, l.Order, 1)
		require.NotEmpty(t, l.Posts[postRoot.Id].Participants[0].Email)
		require.Empty(t, l.Posts[postRoot.Id].Participants[0].AuthData)

		// extended fetch post thread
		opts := model.GetPostsOptions{
			SkipFetchThreads:         false,
			CollapsedThreads:         true,
			CollapsedThreadsExtended: true,
		}

		l, err = th.App.GetPostThread(postRoot.Id, opts, user1.Id)
		require.Nil(t, err)
		require.Len(t, l.Order, 2)
		require.NotEmpty(t, l.Posts[postRoot.Id].Participants[0].Email)
		require.Empty(t, l.Posts[postRoot.Id].Participants[0].AuthData)
	})
}

func TestReplyToPostWithLag(t *testing.T) {
	if !replicaFlag {
		t.Skipf("requires test flag -mysql-replica")
	}

	th := Setup(t).InitBasic()
	defer th.TearDown()

	if *th.App.Config().SqlSettings.DriverName != model.DatabaseDriverMysql {
		t.Skipf("requires %q database driver", model.DatabaseDriverMysql)
	}

	mainHelper.SQLStore.UpdateLicense(model.NewTestLicense("somelicense"))

	t.Run("replication lag time great than reply time", func(t *testing.T) {
		err := mainHelper.SetReplicationLagForTesting(5)
		require.NoError(t, err)
		defer mainHelper.SetReplicationLagForTesting(0)
		mainHelper.ToggleReplicasOn()
		defer mainHelper.ToggleReplicasOff()

		root, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "root post",
		}, th.BasicChannel, false, true)
		require.Nil(t, appErr)

		reply, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser2.Id,
			ChannelId: th.BasicChannel.Id,
			RootId:    root.Id,
			Message:   fmt.Sprintf("@%s", th.BasicUser2.Username),
		}, th.BasicChannel, false, true)
		require.Nil(t, appErr)
		require.NotNil(t, reply)
	})
}

func TestSharedChannelSyncForPostActions(t *testing.T) {
	t.Run("creating a post in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		remoteClusterService := NewMockSharedChannelService(nil)
		th.Server.SetSharedChannelSyncService(remoteClusterService)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		user := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		_, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, false, true)
		require.Nil(t, err, "Creating a post should not error")

		require.Len(t, remoteClusterService.channelNotifications, 1)
		assert.Equal(t, channel.Id, remoteClusterService.channelNotifications[0])
	})

	t.Run("updating a post in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		remoteClusterService := NewMockSharedChannelService(nil)
		th.Server.SetSharedChannelSyncService(remoteClusterService)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		user := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, false, true)
		require.Nil(t, err, "Creating a post should not error")

		_, err = th.App.UpdatePost(th.Context, post, true)
		require.Nil(t, err, "Updating a post should not error")

		require.Len(t, remoteClusterService.channelNotifications, 2)
		assert.Equal(t, channel.Id, remoteClusterService.channelNotifications[0])
		assert.Equal(t, channel.Id, remoteClusterService.channelNotifications[1])
	})

	t.Run("deleting a post in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		remoteClusterService := NewMockSharedChannelService(nil)
		th.Server.SetSharedChannelSyncService(remoteClusterService)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		user := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, false, true)
		require.Nil(t, err, "Creating a post should not error")

		_, err = th.App.DeletePost(th.Context, post.Id, user.Id)
		require.Nil(t, err, "Deleting a post should not error")

		// one creation and two deletes
		require.Len(t, remoteClusterService.channelNotifications, 3)
		assert.Equal(t, channel.Id, remoteClusterService.channelNotifications[0])
		assert.Equal(t, channel.Id, remoteClusterService.channelNotifications[1])
		assert.Equal(t, channel.Id, remoteClusterService.channelNotifications[2])
	})
}

func TestAutofollowOnPostingAfterUnfollow(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	channel := th.BasicChannel
	user := th.BasicUser
	user2 := th.BasicUser2
	appErr := th.App.JoinChannel(th.Context, channel, user.Id)
	require.Nil(t, appErr)
	appErr = th.App.JoinChannel(th.Context, channel, user2.Id)
	require.Nil(t, appErr)
	p1, err := th.App.CreatePost(th.Context, &model.Post{UserId: user.Id, ChannelId: channel.Id, Message: "Hi @" + user2.Username}, channel, false, false)
	require.Nil(t, err)
	_, err = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user2.Id, ChannelId: channel.Id, Message: "Hola"}, channel, false, false)
	require.Nil(t, err)
	_, err = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "reply"}, channel, false, false)
	require.Nil(t, err)

	// unfollow thread
	m, nErr := th.App.Srv().Store().Thread().MaintainMembership(user.Id, p1.Id, store.ThreadMembershipOpts{
		Following:       false,
		UpdateFollowing: true,
	})
	require.NoError(t, nErr)
	require.False(t, m.Following)

	_, err = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "another reply"}, channel, false, false)
	require.Nil(t, err)

	// User should be following thread after posting in it, even after previously
	// unfollowing it, if ThreadAutoFollow is true
	m, err = th.App.GetThreadMembershipForUser(user.Id, p1.Id)
	require.Nil(t, err)
	require.True(t, m.Following)
}

func TestGetPostIfAuthorized(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	privateChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	post, err := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, ChannelId: privateChannel.Id, Message: "Hello"}, privateChannel, false, false)
	require.Nil(t, err)
	require.NotNil(t, post)

	session1, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
	require.Nil(t, err)
	require.NotNil(t, session1)

	session2, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser2.Id, Props: model.StringMap{}})
	require.Nil(t, err)
	require.NotNil(t, session2)

	// User is not authorized to get post
	_, err = th.App.GetPostIfAuthorized(th.Context, post.Id, session2, false)
	require.NotNil(t, err)

	// User is authorized to get post
	_, err = th.App.GetPostIfAuthorized(th.Context, post.Id, session1, false)
	require.Nil(t, err)
}

func TestShouldNotRefollowOnOthersReply(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	channel := th.BasicChannel
	user := th.BasicUser
	user2 := th.BasicUser2
	appErr := th.App.JoinChannel(th.Context, channel, user.Id)
	require.Nil(t, appErr)
	appErr = th.App.JoinChannel(th.Context, channel, user2.Id)
	require.Nil(t, appErr)
	p1, err := th.App.CreatePost(th.Context, &model.Post{UserId: user.Id, ChannelId: channel.Id, Message: "Hi @" + user2.Username}, channel, false, false)
	require.Nil(t, err)
	_, err = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user2.Id, ChannelId: channel.Id, Message: "Hola"}, channel, false, false)
	require.Nil(t, err)

	// User2 unfollows thread
	m, nErr := th.App.Srv().Store().Thread().MaintainMembership(user2.Id, p1.Id, store.ThreadMembershipOpts{
		Following:       false,
		UpdateFollowing: true,
	})
	require.NoError(t, nErr)
	require.False(t, m.Following)

	// user posts in the thread
	_, err = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "another reply"}, channel, false, false)
	require.Nil(t, err)

	// User2 should still not be following the thread because they manually
	// unfollowed the thread
	m, err = th.App.GetThreadMembershipForUser(user2.Id, p1.Id)
	require.Nil(t, err)
	require.False(t, m.Following)

	// user posts in the thread mentioning user2
	_, err = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "reply with mention @" + user2.Username}, channel, false, false)
	require.Nil(t, err)

	// User2 should now be following the thread because they were explicitly mentioned
	m, err = th.App.GetThreadMembershipForUser(user2.Id, p1.Id)
	require.Nil(t, err)
	require.True(t, m.Following)
}

func TestGetLastAccessiblePostTime(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	r, err := th.App.GetLastAccessiblePostTime()
	assert.Nil(t, err)
	assert.Equal(t, int64(0), r)

	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

	mockStore := th.App.Srv().Store().(*storemocks.Store)

	mockSystemStore := storemocks.SystemStore{}
	mockStore.On("System").Return(&mockSystemStore)
	mockSystemStore.On("GetByName", mock.Anything).Return(nil, store.NewErrNotFound("", ""))
	r, err = th.App.GetLastAccessiblePostTime()
	assert.Nil(t, err)
	assert.Equal(t, int64(0), r)

	mockSystemStore = storemocks.SystemStore{}
	mockStore.On("System").Return(&mockSystemStore)
	mockSystemStore.On("GetByName", mock.Anything).Return(nil, errors.New("test"))
	_, err = th.App.GetLastAccessiblePostTime()
	assert.NotNil(t, err)

	mockSystemStore = storemocks.SystemStore{}
	mockStore.On("System").Return(&mockSystemStore)
	mockSystemStore.On("GetByName", mock.Anything).Return(&model.System{Name: model.SystemLastAccessiblePostTime, Value: "10"}, nil)
	r, err = th.App.GetLastAccessiblePostTime()
	assert.Nil(t, err)
	assert.Equal(t, int64(10), r)
}

func TestComputeLastAccessiblePostTime(t *testing.T) {
	t.Run("Updates the time, if cloud limit is applicable", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &eMocks.CloudInterface{}
		th.App.Srv().Cloud = cloud

		// cloud-starter, limit is applicable
		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(&model.ProductLimits{
			Messages: &model.MessagesLimits{
				History: model.NewInt(1),
			},
		}, nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockPostStore := storemocks.PostStore{}
		mockPostStore.On("GetNthRecentPostTime", mock.Anything).Return(int64(1), nil)
		mockSystemStore := storemocks.SystemStore{}
		mockSystemStore.On("SaveOrUpdate", mock.Anything).Return(nil)
		mockStore.On("Post").Return(&mockPostStore)
		mockStore.On("System").Return(&mockSystemStore)

		err := th.App.ComputeLastAccessiblePostTime()
		assert.NoError(t, err)

		mockSystemStore.AssertCalled(t, "SaveOrUpdate", mock.Anything)
	})

	t.Run("Do NOT update the time, if cloud limit is NOT applicable", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &eMocks.CloudInterface{}
		th.App.Srv().Cloud = cloud

		// enterprise, limit is NOT applicable
		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(nil, nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockSystemStore := storemocks.SystemStore{}
		mockSystemStore.On("SaveOrUpdate", mock.Anything).Return(nil)
		mockStore.On("System").Return(&mockSystemStore)

		err := th.App.ComputeLastAccessiblePostTime()
		assert.NoError(t, err)

		mockSystemStore.AssertNotCalled(t, "SaveOrUpdate", mock.Anything)
	})
}

func TestGetTopThreadsForTeamSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// create a public channel, a private channel
	channelPublic := th.CreateChannel(th.Context, th.BasicTeam)
	channelPrivate := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(th.BasicUser, channelPublic)
	th.AddUserToChannel(th.BasicUser, channelPrivate)
	th.AddUserToChannel(th.BasicUser2, channelPublic)

	// create two threads: one in public channel, one in private with only basicUser1

	rootPostPublicChannel, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPublic.Id,
		Message:   "root post",
	}, channelPublic, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser2.Id,
		ChannelId: channelPublic.Id,
		RootId:    rootPostPublicChannel.Id,
		Message:   fmt.Sprintf("@%s", th.BasicUser2.Username),
	}, channelPublic, false, true)
	require.Nil(t, appErr)

	rootPostPrivateChannel, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		Message:   "root post",
	}, channelPrivate, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		RootId:    rootPostPrivateChannel.Id,
		Message:   fmt.Sprintf("@%s", th.BasicUser2.Username),
	}, channelPrivate, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		RootId:    rootPostPrivateChannel.Id,
		Message:   fmt.Sprintf("@%s", th.BasicUser2.Username),
	}, channelPrivate, false, true)

	require.Nil(t, appErr)

	// get top threads for team, as user 1 and user 2
	// user 1 should see both threads, while user 2 should see only thread in public channel.

	topTeamThreadsByUser1, appErr := th.App.GetTopThreadsForTeamSince(th.Context, th.BasicTeam.Id, th.BasicUser.Id, &model.InsightsOpts{StartUnixMilli: 200, PerPage: 100})
	require.Nil(t, appErr)
	require.Len(t, topTeamThreadsByUser1.Items, 2)
	require.Equal(t, topTeamThreadsByUser1.Items[0].Post.Id, rootPostPrivateChannel.Id)
	require.Equal(t, topTeamThreadsByUser1.Items[1].Post.Id, rootPostPublicChannel.Id)

	topTeamThreadsByUser2, appErr := th.App.GetTopThreadsForTeamSince(th.Context, th.BasicTeam.Id, th.BasicUser2.Id, &model.InsightsOpts{StartUnixMilli: 200, PerPage: 100})
	require.Nil(t, appErr)
	require.Len(t, topTeamThreadsByUser2.Items, 1)
	require.Equal(t, topTeamThreadsByUser2.Items[0].Post.Id, rootPostPublicChannel.Id)

	// add user2 to private channel and it can see 2 top threads.
	th.AddUserToChannel(th.BasicUser2, channelPrivate)
	topTeamThreadsByUser2IncludingPrivate, appErr := th.App.GetTopThreadsForTeamSince(th.Context, th.BasicTeam.Id, th.BasicUser2.Id, &model.InsightsOpts{StartUnixMilli: 200, PerPage: 100})
	require.Nil(t, appErr)
	require.Len(t, topTeamThreadsByUser2IncludingPrivate.Items, 2)
}
func TestGetTopThreadsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// create a public channel, a private channel
	channelPublic := th.CreateChannel(th.Context, th.BasicTeam)
	channelPrivate := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(th.BasicUser, channelPublic)
	th.AddUserToChannel(th.BasicUser, channelPrivate)
	th.AddUserToChannel(th.BasicUser2, channelPublic)
	th.AddUserToChannel(th.BasicUser2, channelPrivate)

	// create two threads: one in public channel, one in private
	// post in public channel has both users interacting, post in private only has user1 interacting

	rootPostPublicChannel, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPublic.Id,
		Message:   "root post pub",
	}, channelPublic, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser2.Id,
		ChannelId: channelPublic.Id,
		RootId:    rootPostPublicChannel.Id,
		Message:   "reply post 1",
	}, channelPublic, false, true)
	require.Nil(t, appErr)

	rootPostPrivateChannel, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		Message:   "root post priv",
	}, channelPrivate, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		RootId:    rootPostPrivateChannel.Id,
		Message:   "reply post 1",
	}, channelPrivate, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		RootId:    rootPostPrivateChannel.Id,
		Message:   "reply post 2",
	}, channelPrivate, false, true)

	require.Nil(t, appErr)

	// get top threads for user, as user 1 and user 2
	// user 1 should see both threads, while user 2 should see only thread in public channel
	// (even if user2 is in the private channel it hasn't interacted with the thread there.)

	topUser1Threads, appErr := th.App.GetTopThreadsForUserSince(th.Context, th.BasicTeam.Id, th.BasicUser.Id, &model.InsightsOpts{StartUnixMilli: 200, PerPage: 100})
	require.Nil(t, appErr)
	require.Len(t, topUser1Threads.Items, 2)
	require.Equal(t, topUser1Threads.Items[0].Post.Id, rootPostPrivateChannel.Id)
	require.Equal(t, topUser1Threads.Items[0].ReplyCount, int64(2))
	require.Equal(t, topUser1Threads.Items[1].Post.Id, rootPostPublicChannel.Id)
	require.Contains(t, topUser1Threads.Items[1].Participants, th.BasicUser2.Id)
	require.Equal(t, topUser1Threads.Items[1].ReplyCount, int64(1))

	topUser2Threads, appErr := th.App.GetTopThreadsForUserSince(th.Context, th.BasicTeam.Id, th.BasicUser2.Id, &model.InsightsOpts{StartUnixMilli: 200, PerPage: 100})
	require.Nil(t, appErr)
	require.Len(t, topUser2Threads.Items, 1)
	require.Equal(t, topUser2Threads.Items[0].Post.Id, rootPostPublicChannel.Id)
	require.Equal(t, topUser2Threads.Items[0].ReplyCount, int64(1))

	// deleting the root post results in the thread not making it to top threads list
	_, appErr = th.App.DeletePost(th.Context, rootPostPublicChannel.Id, th.BasicUser.Id)
	require.Nil(t, appErr)

	topUser1ThreadsAfterPost1Delete, appErr := th.App.GetTopThreadsForUserSince(th.Context, th.BasicTeam.Id, th.BasicUser.Id, &model.InsightsOpts{StartUnixMilli: 200, PerPage: 100})
	require.Nil(t, appErr)
	require.Len(t, topUser1ThreadsAfterPost1Delete.Items, 1)

	// reply with user2 in thread2. deleting that reply, shouldn't give any top thread for user2 if the user2 unsubscribes to the thread after deleting the comment
	replyPostUser2InPrivate, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser2.Id,
		ChannelId: channelPrivate.Id,
		RootId:    rootPostPrivateChannel.Id,
		Message:   "reply post 3",
	}, channelPrivate, false, true)
	require.Nil(t, appErr)

	topUser2ThreadsAfterPrivateReply, appErr := th.App.GetTopThreadsForUserSince(th.Context, th.BasicTeam.Id, th.BasicUser2.Id, &model.InsightsOpts{StartUnixMilli: 200, PerPage: 100})
	require.Nil(t, appErr)
	require.Len(t, topUser2ThreadsAfterPrivateReply.Items, 1)

	// deleting reply, and unfollowing thread
	_, appErr = th.App.DeletePost(th.Context, replyPostUser2InPrivate.Id, th.BasicUser2.Id)
	require.Nil(t, appErr)
	// unfollow thread
	_, err := th.App.Srv().Store().Thread().MaintainMembership(th.BasicUser2.Id, rootPostPrivateChannel.Id, store.ThreadMembershipOpts{
		Following:       false,
		UpdateFollowing: true,
	})
	require.NoError(t, err)

	topUser2ThreadsAfterPrivateReplyDelete, appErr := th.App.GetTopThreadsForUserSince(th.Context, th.BasicTeam.Id, th.BasicUser2.Id, &model.InsightsOpts{StartUnixMilli: 200, PerPage: 100})
	require.Nil(t, appErr)
	require.Len(t, topUser2ThreadsAfterPrivateReplyDelete.Items, 0)
}

func TestGetTopDMsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })

	// users
	user := th.CreateUser()
	u1 := th.CreateUser()
	u2 := th.CreateUser()
	u3 := th.CreateUser()
	u4 := th.CreateUser()
	// user direct messages
	chUser1, nErr := th.App.createDirectChannel(th.Context, u1.Id, user.Id)
	fmt.Println(chUser1, nErr)
	require.Nil(t, nErr)
	chUser2, nErr := th.App.createDirectChannel(th.Context, u2.Id, user.Id)
	require.Nil(t, nErr)
	chUser3, nErr := th.App.createDirectChannel(th.Context, u3.Id, user.Id)
	require.Nil(t, nErr)
	// other user direct message
	chUser3User4, nErr := th.App.createDirectChannel(th.Context, u3.Id, u4.Id)
	require.Nil(t, nErr)

	// sample post data
	// for u1
	_, err := th.App.CreatePostAsUser(th.Context, &model.Post{
		ChannelId: chUser1.Id,
		UserId:    u1.Id,
	}, "", false)
	require.Nil(t, err)
	_, err = th.App.CreatePostAsUser(th.Context, &model.Post{
		ChannelId: chUser1.Id,
		UserId:    user.Id,
	}, "", false)
	require.Nil(t, err)
	// for u2: 1 post
	_, err = th.App.CreatePostAsUser(th.Context, &model.Post{
		ChannelId: chUser2.Id,
		UserId:    u2.Id,
	}, "", false)
	require.Nil(t, err)
	// for user-u3: 3 posts
	for i := 0; i < 3; i++ {
		_, err = th.App.CreatePostAsUser(th.Context, &model.Post{
			ChannelId: chUser3.Id,
			UserId:    user.Id,
		}, "", false)
		require.Nil(t, err)
	}
	// for u4-u3: 4 posts
	_, err = th.App.CreatePostAsUser(th.Context, &model.Post{
		ChannelId: chUser3User4.Id,
		UserId:    u3.Id,
	}, "", false)
	require.Nil(t, err)
	_, err = th.App.CreatePostAsUser(th.Context, &model.Post{
		ChannelId: chUser3User4.Id,
		UserId:    u4.Id,
	}, "", false)
	require.Nil(t, err)
	_, err = th.App.CreatePostAsUser(th.Context, &model.Post{
		ChannelId: chUser3User4.Id,
		UserId:    u3.Id,
	}, "", false)
	require.Nil(t, err)

	_, err = th.App.CreatePostAsUser(th.Context, &model.Post{
		ChannelId: chUser3User4.Id,
		UserId:    u4.Id,
	}, "", false)
	require.Nil(t, err)

	t.Run("should return topDMs when userid is specified ", func(t *testing.T) {
		topDMs, err := th.App.GetTopDMsForUserSince(user.Id, &model.InsightsOpts{StartUnixMilli: 100, Page: 0, PerPage: 100})
		require.Nil(t, err)
		// len of topDMs.Items should be 3
		require.Len(t, topDMs.Items, 3)
		// check order, magnitude of items
		// fmt.Println(topDMs.Items[0].MessageCount, topDMs.Items[1].MessageCount, topDMs.Items[2].MessageCount)
		require.Equal(t, topDMs.Items[0].SecondParticipant.Id, u3.Id)
		require.Equal(t, topDMs.Items[0].MessageCount, int64(3))
		require.Equal(t, topDMs.Items[1].SecondParticipant.Id, u1.Id)
		require.Equal(t, topDMs.Items[1].MessageCount, int64(2))
		require.Equal(t, topDMs.Items[2].SecondParticipant.Id, u2.Id)
		require.Equal(t, topDMs.Items[2].MessageCount, int64(1))
		// this also ensures that u3-u4 conversation doesn't show up in others' top DMs.
	})
	t.Run("topDMs should only consider user's DM channels ", func(t *testing.T) {
		// u4 only takes part in one conversation
		topDMs, err := th.App.GetTopDMsForUserSince(u4.Id, &model.InsightsOpts{StartUnixMilli: 100, Page: 0, PerPage: 100})
		require.Nil(t, err)
		// len of topDMs.Items should be 3
		require.Len(t, topDMs.Items, 1)
		// check order, magnitude of items
		require.Equal(t, topDMs.Items[0].SecondParticipant.Id, u3.Id)
		require.Equal(t, topDMs.Items[0].MessageCount, int64(4))
	})
}
