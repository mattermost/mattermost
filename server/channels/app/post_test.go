// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/imageproxy"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"
)

func makePendingPostId(user *model.User) string {
	return fmt.Sprintf("%s:%s", user.Id, strconv.FormatInt(model.GetMillis(), 10))
}

func TestCreatePostDeduplicate(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("duplicate create post is idempotent", func(t *testing.T) {
		session := &model.Session{
			UserId: th.BasicUser.Id,
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		pendingPostId := makePendingPostId(th.BasicUser)

		post, err := th.App.CreatePostAsUser(th.Context.WithSession(session), &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, session.Id, true)
		require.Nil(t, err)
		require.Equal(t, "message", post.Message)

		duplicatePost, err := th.App.CreatePostAsUser(th.Context.WithSession(session), &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, session.Id, true)
		require.Nil(t, err)
		require.Equal(t, post.Id, duplicatePost.Id, "should have returned previously created post id")
		require.Equal(t, "message", duplicatePost.Message)
	})

	t.Run("post rejected by plugin leaves cache ready for non-deduplicated try", func(t *testing.T) {
		setupPluginAPITest(t, `
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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

		session := &model.Session{
			UserId: th.BasicUser.Id,
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		pendingPostId := makePendingPostId(th.BasicUser)

		post, err := th.App.CreatePostAsUser(th.Context.WithSession(session), &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, session.Id, true)
		require.NotNil(t, err)
		require.Equal(t, "Post rejected by plugin. rejected", err.Id)
		require.Nil(t, post)

		duplicatePost, err := th.App.CreatePostAsUser(th.Context.WithSession(session), &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, session.Id, true)
		require.Nil(t, err)
		require.Equal(t, "message", duplicatePost.Message)
	})

	t.Run("slow posting after cache entry blocks duplicate request", func(t *testing.T) {
		setupPluginAPITest(t, `
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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

		session := &model.Session{
			UserId: th.BasicUser.Id,
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		var post *model.Post
		pendingPostId := makePendingPostId(th.BasicUser)

		wg := sync.WaitGroup{}

		// Launch a goroutine to make the first CreatePost call that will get delayed
		// by the plugin above.
		wg.Add(1)
		go func() {
			defer wg.Done()
			var appErr *model.AppError
			post, appErr = th.App.CreatePostAsUser(th.Context.WithSession(session), &model.Post{
				UserId:        th.BasicUser.Id,
				ChannelId:     th.BasicChannel.Id,
				Message:       "plugin delayed",
				PendingPostId: pendingPostId,
			}, session.Id, true)
			require.Nil(t, appErr)
			require.Equal(t, post.Message, "plugin delayed")
		}()

		// Give the goroutine above a chance to start and get delayed by the plugin.
		time.Sleep(2 * time.Second)

		// Try creating a duplicate post
		duplicatePost, err := th.App.CreatePostAsUser(th.Context.WithSession(session), &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "plugin delayed",
			PendingPostId: pendingPostId,
		}, session.Id, true)
		require.NotNil(t, err)
		require.Equal(t, "api.post.deduplicate_create_post.pending", err.Id)
		require.Nil(t, duplicatePost)

		// Wait for the first CreatePost to finish to ensure assertions are made.
		wg.Wait()
	})

	t.Run("duplicate create post after cache expires is not idempotent", func(t *testing.T) {
		session := &model.Session{
			UserId: th.BasicUser.Id,
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		pendingPostId := makePendingPostId(th.BasicUser)

		post, err := th.App.CreatePostAsUser(th.Context.WithSession(session), &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, session.Id, true)
		require.Nil(t, err)
		require.Equal(t, "message", post.Message)

		time.Sleep(PendingPostIDsCacheTTL)

		duplicatePost, err := th.App.CreatePostAsUser(th.Context.WithSession(session), &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, session.Id, true)
		require.Nil(t, err)
		require.NotEqual(t, post.Id, duplicatePost.Id, "should have created new post id")
		require.Equal(t, "message", duplicatePost.Message)
	})

	t.Run("Permissison to post required to resolve from pending post cache", func(t *testing.T) {
		sessionBasicUser := &model.Session{
			UserId: th.BasicUser.Id,
		}
		sessionBasicUser, err := th.App.CreateSession(th.Context, sessionBasicUser)
		require.Nil(t, err)

		sessionBasicUser2 := &model.Session{
			UserId: th.BasicUser2.Id,
		}
		sessionBasicUser2, err = th.App.CreateSession(th.Context, sessionBasicUser2)
		require.Nil(t, err)

		pendingPostId := makePendingPostId(th.BasicUser)

		privateChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, privateChannel)

		post, err := th.App.CreatePostAsUser(th.Context.WithSession(sessionBasicUser), &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     privateChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, sessionBasicUser.Id, true)
		require.Nil(t, err)
		require.Equal(t, "message", post.Message)

		postAsDifferentUser, err := th.App.CreatePostAsUser(th.Context.WithSession(sessionBasicUser2), &model.Post{
			UserId:        th.BasicUser2.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message2",
			PendingPostId: pendingPostId,
		}, sessionBasicUser2.Id, true)
		require.Nil(t, err)
		require.NotEqual(t, post.Id, postAsDifferentUser.Id, "should have created new post id")
		require.Equal(t, "message2", postAsDifferentUser.Message)

		// Both posts should exist unchanged
		actualPost, err := th.App.GetSinglePost(th.Context, post.Id, false)
		require.Nil(t, err)
		assert.Equal(t, "message", actualPost.Message)
		assert.Equal(t, privateChannel.Id, actualPost.ChannelId)

		actualPostAsDifferentUser, err := th.App.GetSinglePost(th.Context, postAsDifferentUser.Id, false)
		require.Nil(t, err)
		assert.Equal(t, "message2", actualPostAsDifferentUser.Message)
		assert.Equal(t, th.BasicChannel.Id, actualPostAsDifferentUser.ChannelId)
	})
}

func TestAttachFilesToPost(t *testing.T) {
	t.Run("should attach files", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		info1, err := th.App.Srv().Store().FileInfo().Save(th.Context,
			&model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Path:      "path.txt",
			})
		require.NoError(t, err)

		info2, err := th.App.Srv().Store().FileInfo().Save(th.Context,
			&model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Path:      "path.txt",
			})
		require.NoError(t, err)

		post := th.BasicPost
		post.FileIds = []string{info1.Id, info2.Id}

		appErr := th.App.attachFilesToPost(th.Context, post)
		assert.Nil(t, appErr)

		infos, _, appErr := th.App.GetFileInfosForPost(th.Context, post.Id, false, false)
		assert.Nil(t, appErr)
		assert.Len(t, infos, 2)
	})

	t.Run("should update File.PostIds after failing to add files", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		info1, err := th.App.Srv().Store().FileInfo().Save(th.Context,
			&model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Path:      "path.txt",
				PostId:    model.NewId(),
			})
		require.NoError(t, err)

		info2, err := th.App.Srv().Store().FileInfo().Save(th.Context,
			&model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Path:      "path.txt",
			})
		require.NoError(t, err)

		post := th.BasicPost
		post.FileIds = []string{info1.Id, info2.Id}

		appErr := th.App.attachFilesToPost(th.Context, post)
		assert.Nil(t, appErr)

		infos, _, appErr := th.App.GetFileInfosForPost(th.Context, post.Id, false, false)
		assert.Nil(t, appErr)
		assert.Len(t, infos, 1)
		assert.Equal(t, info2.Id, infos[0].Id)

		updated, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
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
	saved, err := th.App.UpdatePost(th.Context, post, &model.UpdatePostOptions{SafeUpdate: true})
	require.Nil(t, err)
	assert.Equal(t, saved.EditAt, post.EditAt, "shouldn't have updated post.EditAt when pinning post")
	post = saved.Clone()

	time.Sleep(time.Millisecond * 100)

	post.Message = model.NewId()
	saved, err = th.App.UpdatePost(th.Context, post, &model.UpdatePostOptions{SafeUpdate: true})
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
	_, err := th.App.UpdatePost(th.Context, post, &model.UpdatePostOptions{SafeUpdate: true})
	require.Nil(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = 1000000000
	})
	post.Message = model.NewId()

	_, err = th.App.UpdatePost(th.Context, post, &model.UpdatePostOptions{SafeUpdate: true})
	require.Nil(t, err, "should allow you to edit the post")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = 1
	})
	post.Message = model.NewId()
	_, err = th.App.UpdatePost(th.Context, post, &model.UpdatePostOptions{SafeUpdate: true})
	require.Nil(t, err, "should allow you to edit an old post because the time check is applied above in the call hierarchy")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = -1
	})
}

func TestUpdatePostInArchivedChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	archivedChannel := th.CreateChannel(th.Context, th.BasicTeam)
	post := th.CreatePost(archivedChannel)
	appErr := th.App.DeleteChannel(th.Context, archivedChannel, "")
	require.Nil(t, appErr)

	_, err := th.App.UpdatePost(th.Context, post, &model.UpdatePostOptions{SafeUpdate: true})
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

func TestUpdatePostPluginHooks(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("Should stop processing at first reject", func(t *testing.T) {
		setupMultiPluginAPITest(t, []string{
			`
				package main

				import (
					"github.com/mattermost/mattermost/server/public/plugin"
					"github.com/mattermost/mattermost/server/public/model"
				)

				type MyPlugin struct {
					plugin.MattermostPlugin
				}

				func (p *MyPlugin) MessageWillBeUpdated(c *plugin.Context, newPost, oldPost *model.Post) (*model.Post, string) {
					return nil, "rejected"
				}

				func main() {
					plugin.ClientMain(&MyPlugin{})
				}
			`,
			`
				package main

				import (
					"github.com/mattermost/mattermost/server/public/plugin"
					"github.com/mattermost/mattermost/server/public/model"
				)

				type MyPlugin struct {
					plugin.MattermostPlugin
				}

				func (p *MyPlugin) MessageWillBeUpdated(c *plugin.Context, newPost, oldPost *model.Post) (*model.Post, string) {
					if (newPost == nil) {
						return nil, "nil post"
					}
					newPost.Message = newPost.Message + "fromplugin"
					return newPost, ""
				}

				func main() {
					plugin.ClientMain(&MyPlugin{})
				}
			`,
		}, []string{
			`{"id": "testrejectfirstpost", "server": {"executable": "backend.exe"}}`,
			`{"id": "testupdatepost", "server": {"executable": "backend.exe"}}`,
		}, []string{
			"testrejectfirstpost", "testupdatepost",
		}, true, th.App, th.Context)

		pendingPostId := makePendingPostId(th.BasicUser)
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, "", true)
		require.Nil(t, err)

		post.Message = "new message"
		updatedPost, err := th.App.UpdatePost(th.Context, post, nil)
		require.Nil(t, updatedPost)
		require.NotNil(t, err)
		require.Equal(t, "Post rejected by plugin. rejected", err.Id)
	})

	t.Run("Should update", func(t *testing.T) {
		setupMultiPluginAPITest(t, []string{
			`
				package main

				import (
					"github.com/mattermost/mattermost/server/public/plugin"
					"github.com/mattermost/mattermost/server/public/model"
				)

				type MyPlugin struct {
					plugin.MattermostPlugin
				}

				func (p *MyPlugin) MessageWillBeUpdated(c *plugin.Context, newPost, oldPost *model.Post) (*model.Post, string) {
					newPost.Message = newPost.Message + " 1"
					return newPost, ""
				}

				func main() {
					plugin.ClientMain(&MyPlugin{})
				}
			`,
			`
				package main

				import (
					"github.com/mattermost/mattermost/server/public/plugin"
					"github.com/mattermost/mattermost/server/public/model"
				)

				type MyPlugin struct {
					plugin.MattermostPlugin
				}

				func (p *MyPlugin) MessageWillBeUpdated(c *plugin.Context, newPost, oldPost *model.Post) (*model.Post, string) {
					newPost.Message = "2 " + newPost.Message
					return newPost, ""
				}

				func main() {
					plugin.ClientMain(&MyPlugin{})
				}
			`,
		}, []string{
			`{"id": "testaddone", "server": {"executable": "backend.exe"}}`,
			`{"id": "testaddtwo", "server": {"executable": "backend.exe"}}`,
		}, []string{
			"testaddone", "testaddtwo",
		}, true, th.App, th.Context)

		pendingPostId := makePendingPostId(th.BasicUser)
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:        th.BasicUser.Id,
			ChannelId:     th.BasicChannel.Id,
			Message:       "message",
			PendingPostId: pendingPostId,
		}, "", true)
		require.Nil(t, err)

		post.Message = "new message"
		updatedPost, err := th.App.UpdatePost(th.Context, post, nil)
		require.Nil(t, err)
		require.NotNil(t, updatedPost)
		require.Equal(t, "2 new message 1", updatedPost.Message)
	})
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
	defer func() {
		appErr := th.App.PermanentDeleteChannel(th.Context, channelToMention)
		require.Nil(t, appErr)
	}()
	channelToMention2, err := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "Mention Test2",
		Name:        "mention-test2",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
	}, false)
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteChannel(th.Context, channelToMention2)
		require.Nil(t, appErr)
	}()

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
	}, post.GetProp(model.PostPropsChannelMentions))

	post.Message = fmt.Sprintf("goodbye, ~%v!", channelToMention2.Name)
	result, err := th.App.UpdatePost(th.Context, post, nil)
	require.Nil(t, err)
	assert.Equal(t, map[string]any{
		"mention-test2": map[string]any{
			"display_name": "Mention Test2",
			"team_name":    th.BasicTeam.Name,
		},
	}, result.GetProp(model.PostPropsChannelMentions))

	result.Message = "no more mentions!"
	result, err = th.App.UpdatePost(th.Context, result, nil)
	require.Nil(t, err)
	assert.Nil(t, result.GetProp(model.PostPropsChannelMentions))
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
				cfg.ImageProxySettings.Enable = model.NewPointer(true)
				cfg.ImageProxySettings.ImageProxyType = model.NewPointer(tc.ProxyType)
				cfg.ImageProxySettings.RemoteImageProxyOptions = model.NewPointer(tc.ProxyOptions)
				cfg.ImageProxySettings.RemoteImageProxyURL = model.NewPointer(tc.ProxyURL)
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

func TestDeletePostWithFileAttachments(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create a post with a file attachment.
	teamID := th.BasicTeam.Id
	channelID := th.BasicChannel.Id
	userID := th.BasicUser.Id
	filename := "test"
	data := []byte("abcd")

	info1, err := th.App.DoUploadFile(th.Context, time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamID, channelID, userID, filename, data, true)
	require.Nil(t, err)
	defer func() {
		err := th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info1.Id)
		require.NoError(t, err)
		appErr := th.App.RemoveFile(info1.Path)
		require.Nil(t, appErr)
	}()

	post := &model.Post{
		Message:       "asd",
		ChannelId:     channelID,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        userID,
		CreateAt:      0,
		FileIds:       []string{info1.Id},
	}

	post, err = th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	assert.Nil(t, err)

	// Delete the post.
	_, err = th.App.DeletePost(th.Context, post.Id, userID)
	assert.Nil(t, err)

	// Wait for the cleanup routine to finish.
	time.Sleep(time.Millisecond * 100)

	// Check that the file can no longer be reached.
	_, err = th.App.GetFileInfo(th.Context, info1.Id)
	assert.NotNil(t, err)
}

func TestDeletePostInArchivedChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	archivedChannel := th.CreateChannel(th.Context, th.BasicTeam)
	post := th.CreatePost(archivedChannel)
	appErr := th.App.DeleteChannel(th.Context, archivedChannel, "")
	require.Nil(t, appErr)

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

		rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
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
			rpost, err := th.App.CreatePost(th.Context, postWithNoMention, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})

			postWithMention := &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "This post has @here mention @all",
				UserId:    th.BasicUser.Id,
			}
			rpost, err = th.App.CreatePost(th.Context, postWithMention, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
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
			rpost, err := th.App.CreatePost(th.Context, postWithNoMention, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})

			postWithMention := &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "This post has @here mention @all",
				UserId:    th.BasicUser.Id,
			}
			rpost, err = th.App.CreatePost(th.Context, postWithMention, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
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

		referencedPost, err := th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		channelForPreview := th.CreateChannel(th.Context, th.BasicTeam)
		previewPost := &model.Post{
			ChannelId: channelForPreview.Id,
			Message:   permalink,
			UserId:    th.BasicUser.Id,
		}

		previewPost, err = th.App.CreatePost(th.Context, previewPost, channelForPreview, model.CreatePostFlags{})
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
		referencedPost, err := th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, model.CreatePostFlags{})
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

		previewPost, err = th.App.CreatePost(th.Context, previewPost, channelForPreview, model.CreatePostFlags{})
		require.Nil(t, err)

		sqlStore := th.GetSqlStore()
		sql := fmt.Sprintf("select count(*) from Posts where Id = '%[1]s' or OriginalId = '%[1]s';", previewPost.Id)
		var val int64
		err2 := sqlStore.GetMaster().Get(&val, sql)
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

		th.Context.Session().UserId = th.BasicUser.Id

		testCases := []struct {
			Description string
			Channel     *model.Channel
			Author      string
			Length      int
		}{
			{
				Description: "removes metadata from post for members who cannot read channel",
				Channel:     directChannel,
				Author:      user1.Id,
				Length:      0,
			},
			{
				Description: "does not remove metadata from post for members who can read channel",
				Channel:     th.BasicChannel,
				Author:      th.BasicUser.Id,
				Length:      1,
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				referencedPost := &model.Post{
					ChannelId: testCase.Channel.Id,
					Message:   "hello world",
					UserId:    testCase.Author,
				}
				referencedPost, err = th.App.CreatePost(th.Context, referencedPost, testCase.Channel, model.CreatePostFlags{})
				require.Nil(t, err)

				permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)
				previewPost := &model.Post{
					ChannelId: th.BasicChannel.Id,
					Message:   permalink,
					UserId:    th.BasicUser.Id,
				}

				previewPost, err = th.App.CreatePost(th.Context, previewPost, th.BasicChannel, model.CreatePostFlags{})
				require.Nil(t, err)

				require.Len(t, previewPost.Metadata.Embeds, testCase.Length)
			})
		}
	})

	t.Run("Should not allow to create posts on shared DMs", func(t *testing.T) {
		th := setupSharedChannels(t).InitBasic()
		defer th.TearDown()

		user1 := th.CreateUser()
		user2 := th.CreateUser()
		dm, appErr := th.App.createDirectChannel(th.Context, user1.Id, user2.Id)
		require.Nil(t, appErr)
		require.NotNil(t, dm)

		// we can't create direct channels with remote users, so we
		// have to force the channel to be shared through the store to
		// simulate preexisting shared DMs
		sc := &model.SharedChannel{
			ChannelId: dm.Id,
			Type:      dm.Type,
			Home:      true,
			ShareName: "shareddm",
			CreatorId: user1.Id,
			RemoteId:  model.NewId(),
		}
		_, scErr := th.Server.Store().SharedChannel().Save(sc)
		require.NoError(t, scErr)

		// and we update the channel to mark it as shared
		dm.Shared = model.NewPointer(true)
		_, err := th.Server.Store().Channel().Update(th.Context, dm)
		require.NoError(t, err)

		newPost := &model.Post{
			ChannelId: dm.Id,
			Message:   "hello world",
			UserId:    user1.Id,
		}
		createdPost, appErr := th.App.CreatePost(th.Context, newPost, dm, model.CreatePostFlags{})
		require.NotNil(t, appErr)
		require.Nil(t, createdPost)
	})

	t.Run("Should not allow to create posts on shared GMs", func(t *testing.T) {
		th := setupSharedChannels(t).InitBasic()
		defer th.TearDown()

		user1 := th.CreateUser()
		user2 := th.CreateUser()
		user3 := th.CreateUser()
		gm, appErr := th.App.createGroupChannel(th.Context, []string{user1.Id, user2.Id, user3.Id})
		require.Nil(t, appErr)
		require.NotNil(t, gm)

		// we can't create group channels with remote users, so we
		// have to force the channel to be shared through the store to
		// simulate preexisting shared GMs
		sc := &model.SharedChannel{
			ChannelId: gm.Id,
			Type:      gm.Type,
			Home:      true,
			ShareName: "sharedgm",
			CreatorId: user1.Id,
			RemoteId:  model.NewId(),
		}
		_, err := th.Server.Store().SharedChannel().Save(sc)
		require.NoError(t, err)

		// and we update the channel to mark it as shared
		gm.Shared = model.NewPointer(true)
		_, err = th.Server.Store().Channel().Update(th.Context, gm)
		require.NoError(t, err)

		newPost := &model.Post{
			ChannelId: gm.Id,
			Message:   "hello world",
			UserId:    user1.Id,
		}
		createdPost, appErr := th.App.CreatePost(th.Context, newPost, gm, model.CreatePostFlags{})
		require.NotNil(t, appErr)
		require.Nil(t, createdPost)
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
		referencedPost, err := th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, model.CreatePostFlags{})
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

		previewPost, err = th.App.CreatePost(th.Context, previewPost, channelForPreview, model.CreatePostFlags{})
		require.Nil(t, err)

		n := 1000
		var wg sync.WaitGroup
		wg.Add(n)
		for i := 0; i < n; i++ {
			go func() {
				defer wg.Done()
				post := previewPost.Clone()
				_, appErr := th.App.UpdatePost(th.Context, post, nil)
				require.Nil(t, appErr)
			}()
		}

		wg.Wait()
	})

	t.Run("should sanitize the force notifications prop if the flag is not set", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.AddUserToChannel(th.BasicUser, th.BasicChannel)

		postToCreate := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}
		postToCreate.AddProp(model.PostPropsForceNotification, model.NewId())
		createdPost, err := th.App.CreatePost(th.Context, postToCreate, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)
		require.Empty(t, createdPost.GetProp(model.PostPropsForceNotification))
	})

	t.Run("should add the force notifications prop if the flag is set", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.AddUserToChannel(th.BasicUser, th.BasicChannel)

		postToCreate := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}
		createdPost, err := th.App.CreatePost(th.Context, postToCreate, th.BasicChannel, model.CreatePostFlags{ForceNotification: true})
		require.Nil(t, err)
		require.NotEmpty(t, createdPost.GetProp(model.PostPropsForceNotification))
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

		rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		assert.NotEqual(t, "![image]("+proxiedImageURL+")", rpost.Message)

		patch := &model.PostPatch{
			Message: model.NewPointer("![image](" + imageURL + ")"),
		}

		rpost, err = th.App.PatchPost(th.Context, rpost.Id, patch, nil)
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

		rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		t.Run("Does not set prop when user has USE_CHANNEL_MENTIONS", func(t *testing.T) {
			patchWithNoMention := &model.PostPatch{Message: model.NewPointer("This patch has no channel mention")}

			rpost, err = th.App.PatchPost(th.Context, rpost.Id, patchWithNoMention, nil)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})

			patchWithMention := &model.PostPatch{Message: model.NewPointer("This patch has a mention now @here")}

			rpost, err = th.App.PatchPost(th.Context, rpost.Id, patchWithMention, nil)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})
		})

		t.Run("Sets prop when user does not have USE_CHANNEL_MENTIONS", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionUseChannelMentions.Id, model.ChannelUserRoleId)
			th.RemovePermissionFromRole(model.PermissionUseChannelMentions.Id, model.ChannelAdminRoleId)

			patchWithNoMention := &model.PostPatch{Message: model.NewPointer("This patch still does not have a mention")}
			rpost, err = th.App.PatchPost(th.Context, rpost.Id, patchWithNoMention, nil)
			require.Nil(t, err)
			assert.Equal(t, rpost.GetProps(), model.StringInterface{})

			patchWithMention := &model.PostPatch{Message: model.NewPointer("This patch has a mention now @here")}

			rpost, err = th.App.PatchPost(th.Context, rpost.Id, patchWithMention, nil)
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
		post.AddProp(model.PostPropsFromWebhook, "true")

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

		channelMemberBefore, err := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		_, appErr = th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, appErr)

		channelMemberAfter, err := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

		require.Equal(t, channelMemberAfter.LastViewedAt, channelMemberBefore.LastViewedAt)
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

		channelMemberBefore, err := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		replyPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test reply",
			UserId:    th.BasicUser.Id,
			RootId:    rootPost.Id,
		}
		_, appErr = th.App.CreatePostAsUser(th.Context, replyPost, "", true)
		require.Nil(t, appErr)

		channelMemberAfter, err := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

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

		channelMemberBefore, err := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		replyPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test reply",
			UserId:    th.BasicUser.Id,
			RootId:    rootPost.Id,
		}
		_, appErr = th.App.CreatePostAsUser(th.Context, replyPost, "", true)
		require.Nil(t, appErr)

		channelMemberAfter, err := th.App.Srv().Store().Channel().GetMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

		require.Equal(t, channelMemberAfter.LastViewedAt, channelMemberBefore.LastViewedAt)
	})
}

func TestPatchPostInArchivedChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	archivedChannel := th.CreateChannel(th.Context, th.BasicTeam)
	post := th.CreatePost(archivedChannel)
	appErr := th.App.DeleteChannel(th.Context, archivedChannel, "")
	require.Nil(t, appErr)

	_, err := th.App.PatchPost(th.Context, post.Id, &model.PostPatch{IsPinned: model.NewPointer(true)}, nil)
	require.NotNil(t, err)
	require.Equal(t, "api.post.patch_post.can_not_update_post_in_deleted.error", err.Id)
}

func TestUpdateEphemeralPost(t *testing.T) {
	t.Run("Post contains preview if the user has permissions", func(t *testing.T) {
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

		referencedPost, err := th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		testPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   permalink,
			UserId:    th.BasicUser.Id,
		}

		testPost = th.App.UpdateEphemeralPost(th.Context, th.BasicUser.Id, testPost)
		require.NotNil(t, testPost.Metadata)
		require.Len(t, testPost.Metadata.Embeds, 1)
		require.Equal(t, model.PostEmbedPermalink, testPost.Metadata.Embeds[0].Type)
	})

	t.Run("Post does not contain preview if the user has no permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		privateChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, privateChannel)
		th.AddUserToChannel(th.BasicUser2, th.BasicChannel)

		referencedPost := &model.Post{
			ChannelId: privateChannel.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		})

		th.Context.Session().UserId = th.BasicUser.Id

		referencedPost, err := th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		testPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   permalink,
			UserId:    th.BasicUser2.Id,
		}

		testPost = th.App.UpdateEphemeralPost(th.Context, th.BasicUser2.Id, testPost)
		require.Nil(t, testPost.Metadata.Embeds)
	})
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

		rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		assert.NotEqual(t, "![image]("+proxiedImageURL+")", rpost.Message)

		post.Id = rpost.Id
		post.Message = "![image](" + imageURL + ")"

		rpost, err = th.App.UpdatePost(th.Context, post, nil)
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

		referencedPost, err := th.App.CreatePost(th.Context, referencedPost, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		channelForTestPost := th.CreateChannel(th.Context, th.BasicTeam)
		testPost := &model.Post{
			ChannelId: channelForTestPost.Id,
			Message:   "hello world",
			UserId:    th.BasicUser.Id,
		}

		testPost, err = th.App.CreatePost(th.Context, testPost, channelForTestPost, model.CreatePostFlags{})
		require.Nil(t, err)
		assert.Equal(t, model.StringInterface{}, testPost.GetProps())

		testPost.Message = permalink
		testPost, err = th.App.UpdatePost(th.Context, testPost, nil)
		require.Nil(t, err)
		assert.Equal(t, model.StringInterface{model.PostPropsPreviewedPost: referencedPost.Id}, testPost.GetProps())
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

		th.Context.Session().UserId = th.BasicUser.Id

		testCases := []struct {
			Description string
			Channel     *model.Channel
			Author      string
			Length      int
		}{
			{
				Description: "removes metadata from post for members who cannot read channel",
				Channel:     directChannel,
				Author:      user1.Id,
				Length:      0,
			},
			{
				Description: "does not remove metadata from post for members who can read channel",
				Channel:     th.BasicChannel,
				Author:      th.BasicUser.Id,
				Length:      1,
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				referencedPost := &model.Post{
					ChannelId: testCase.Channel.Id,
					Message:   "hello world",
					UserId:    testCase.Author,
				}
				_, err = th.App.CreatePost(th.Context, referencedPost, testCase.Channel, model.CreatePostFlags{})
				require.Nil(t, err)

				previewPost := &model.Post{
					ChannelId: th.BasicChannel.Id,
					UserId:    th.BasicUser.Id,
				}
				previewPost, err = th.App.CreatePost(th.Context, previewPost, th.BasicChannel, model.CreatePostFlags{})
				require.Nil(t, err)

				permalink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)
				previewPost.Message = permalink
				previewPost, err = th.App.UpdatePost(th.Context, previewPost, nil)
				require.Nil(t, err)

				require.Len(t, previewPost.Metadata.Embeds, testCase.Length)
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
			}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})

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

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

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

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

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

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

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

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

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

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

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

		results, err := th.App.SearchPostsForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

		assert.Nil(t, err)
		assert.Equal(t, []string{}, results.Order)
		es.AssertExpectations(t)
	})

	t.Run("should return the same results if there is a tilde in the channel name", func(t *testing.T) {
		th, _ := setup(t, false)
		defer th.TearDown()

		page := 0

		searchQueryWithPrefix := fmt.Sprintf("in:~%s %s", th.BasicChannel.Name, searchTerm)

		resultsWithPrefix, err := th.App.SearchPostsForUser(th.Context, searchQueryWithPrefix, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)
		assert.Nil(t, err)
		assert.Greater(t, len(resultsWithPrefix.PostList.Posts), 0, "searching using a tilde in front of a channel should return results")
		searchQueryWithoutPrefix := fmt.Sprintf("in:%s %s", th.BasicChannel.Name, searchTerm)

		resultsWithoutPrefix, err := th.App.SearchPostsForUser(th.Context, searchQueryWithoutPrefix, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)
		assert.Nil(t, err)
		assert.Equal(t, len(resultsWithPrefix.Posts), len(resultsWithoutPrefix.Posts), "searching using a tilde in front of a channel should return the same number of results")
		for k, v := range resultsWithPrefix.Posts {
			assert.Equal(t, v, resultsWithoutPrefix.Posts[k], "post at %s was different", k)
		}
	})

	t.Run("should return the same results if there is an 'at' in the user", func(t *testing.T) {
		th, _ := setup(t, false)
		defer th.TearDown()

		page := 0

		searchQueryWithPrefix := fmt.Sprintf("from:@%s %s", th.BasicUser.Username, searchTerm)

		resultsWithPrefix, err := th.App.SearchPostsForUser(th.Context, searchQueryWithPrefix, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)
		assert.Nil(t, err)
		assert.Greater(t, len(resultsWithPrefix.PostList.Posts), 0, "searching using a 'at' symbol in front of a channel should return results")
		searchQueryWithoutPrefix := fmt.Sprintf("from:@%s %s", th.BasicUser.Username, searchTerm)

		resultsWithoutPrefix, err := th.App.SearchPostsForUser(th.Context, searchQueryWithoutPrefix, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)
		assert.Nil(t, err)
		assert.Equal(t, len(resultsWithPrefix.Posts), len(resultsWithoutPrefix.Posts), "searching using an 'at' symbol in front of a channel should return the same number of results")
		for k, v := range resultsWithPrefix.Posts {
			assert.Equal(t, v, resultsWithoutPrefix.Posts[k], "post at %s was different", k)
		}
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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "apple",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// post1 and post3 should mention the user

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@channel",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// post2 and post3 should mention the user

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@channel",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@channel",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post1.Id,
			Message:   "test2",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		post3, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    post3.Id,
			Message:   "test4",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post3.Id,
			Message:   "test5",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// post2 should mention the user

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post1.Id,
			Message:   "test2",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		post3, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    post3.Id,
			Message:   "test4",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post3.Id,
			Message:   "test5",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// post2 and post5 should mention the user

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
			Type:      model.PostTypeAddToChannel,
			Props: map[string]any{
				model.PostPropsAddedUserId: user2.Id,
			},
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
			Type:      model.PostTypeAddToChannel,
			Props: map[string]any{
				model.PostPropsAddedUserId: user2.Id,
			},
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// should be mentioned by post2 and post3

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 2, count)

		count, _, _, err = th.App.countMentionsFromPost(th.Context, user1, post1)

		assert.Nil(t, err)
		assert.Equal(t, 0, count)
	})

	t.Run("should return the number of posts made by the other user for a group message", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.BasicUser
		user2 := th.BasicUser2
		user3 := th.SystemAdminUser

		channel, err := th.App.createGroupChannel(th.Context, []string{user1.Id, user2.Id, user3.Id})
		require.Nil(t, err)

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user3.Id,
			ChannelId: channel.Id,
			Message:   "test3",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 3, count)

		count, _, _, err = th.App.countMentionsFromPost(th.Context, user1, post1)

		assert.Nil(t, err)
		assert.Equal(t, 1, count)
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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		post2, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test2",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// post1 and post3 should mention the user, but we only count post3

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post2)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// post2 should mention the user

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    post1.Id,
			Message:   "test2",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		post3, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post1.Id,
			Message:   "test4",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// post4 should mention the user

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post3)

		assert.Nil(t, err)
		assert.Equal(t, 1, count)
	})

	t.Run("should not include comments made before the given post when rootPost is inaccessible", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		user2.NotifyProps[model.CommentsNotifyProp] = model.CommentsNotifyAny

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test1",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    post1.Id,
			Message:   "test2",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		time.Sleep(time.Millisecond * 2)

		post3, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "test3",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    post1.Id,
			Message:   "test4",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// Make posts created before post3 inaccessible
		e := th.App.Srv().Store().System().SaveOrUpdate(&model.System{
			Name:  model.SystemLastAccessiblePostTime,
			Value: strconv.FormatInt(post3.CreateAt, 10),
		})
		require.NoError(t, e)

		// post4 should mention the user, but since post2 is inaccessible due to the cloud plan's limit,
		// post4 does not notify the user.

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post3)

		assert.Nil(t, err)
		assert.Zero(t, count)
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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
			Props: map[string]any{
				model.PostPropsFromWebhook: "true",
			},
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// post3 should mention the user

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		for i := 0; i < numPosts-1; i++ {
			_, err = th.App.CreatePost(th.Context, &model.Post{
				UserId:    user1.Id,
				ChannelId: channel.Id,
				Message:   fmt.Sprintf("@%s", user2.Username),
			}, channel, model.CreatePostFlags{SetOnline: true})
			require.Nil(t, err)
		}

		// Every post should mention the user

		count, _, _, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, numPosts, count)
	})

	t.Run("should count urgent mentions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostPriority = true
		})

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		user2.NotifyProps[model.MentionKeysNotifyProp] = "apple"

		post1, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: model.NewPointer(model.PostPriorityUrgent),
				},
			},
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "apple",
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: model.NewPointer(model.PostPriorityUrgent),
				},
			},
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// all posts mention the user but only post1, post3 are urgent

		_, _, count, err := th.App.countMentionsFromPost(th.Context, user2, post1)

		assert.Nil(t, err)
		assert.Equal(t, 2, count)
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
		}, channel, model.CreatePostFlags{SetOnline: true})
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
		}, channel, model.CreatePostFlags{SetOnline: true})
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
		}, channel, model.CreatePostFlags{SetOnline: true})
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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    postRoot.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, model.CreatePostFlags{SetOnline: true})
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
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		_, err = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    post2.Id,
			Message:   fmt.Sprintf("@%s", user1.Username),
		}, channel, model.CreatePostFlags{SetOnline: true})
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

	p1, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: user.Id, ChannelId: channel.Id, Message: "Hi @" + sysadmin.Username}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "Hola"}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	threadMembership, appErr := th.App.GetThreadMembershipForUser(user.Id, p1.Id)
	require.Nil(t, appErr)
	thread, appErr := th.App.GetThreadForUser(threadMembership, false)
	require.Nil(t, appErr)
	require.Len(t, thread.Participants, 1) // length should be 1, the original poster, since sysadmin was just mentioned but didn't post

	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: sysadmin.Id, ChannelId: channel.Id, Message: "sysadmin reply"}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	threadMembership, appErr = th.App.GetThreadMembershipForUser(user.Id, p1.Id)
	require.Nil(t, appErr)
	thread, appErr = th.App.GetThreadForUser(threadMembership, false)
	require.Nil(t, appErr)
	require.Len(t, thread.Participants, 2) // length should be 2, the original poster and sysadmin, since sysadmin participated now

	// another user follows the thread
	appErr = th.App.UpdateThreadFollowForUser(user2.Id, th.BasicTeam.Id, p1.Id, true)
	require.Nil(t, appErr)

	threadMembership, appErr = th.App.GetThreadMembershipForUser(user2.Id, p1.Id)
	require.Nil(t, appErr)
	thread, appErr = th.App.GetThreadForUser(threadMembership, false)
	require.Nil(t, appErr)
	require.Len(t, thread.Participants, 2) // length should be 2, since follow shouldn't update participant list, only user1 and sysadmin are participants
	for _, p := range thread.Participants {
		require.True(t, p.Id == sysadmin.Id || p.Id == user.Id)
	}

	oldID := threadMembership.PostId
	threadMembership.PostId = "notfound"
	_, appErr = th.App.GetThreadForUser(threadMembership, false)
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusNotFound, appErr.StatusCode)

	threadMembership.Following = false
	threadMembership.PostId = oldID
	_, appErr = th.App.GetThreadForUser(threadMembership, false)
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
}

func TestAutofollowBasedOnRootPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
	p1, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: user.Id, ChannelId: channel.Id, Message: "Hi @" + user2.Username}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	m, err := th.App.GetThreadMembershipsForUser(user2.Id, th.BasicTeam.Id)
	require.NoError(t, err)
	require.Len(t, m, 0)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "Hola"}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	m, err = th.App.GetThreadMembershipsForUser(user2.Id, th.BasicTeam.Id)
	require.NoError(t, err)
	require.Len(t, m, 1)
}

func TestViewChannelShouldNotUpdateThreads(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
	p1, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: user.Id, ChannelId: channel.Id, Message: "Hi @" + user2.Username}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "Hola"}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	m, err := th.App.GetThreadMembershipsForUser(user2.Id, th.BasicTeam.Id)
	require.NoError(t, err)

	_, appErr = th.App.ViewChannel(th.Context, &model.ChannelView{
		ChannelId:     channel.Id,
		PrevChannelId: "",
	}, user2.Id, "", true)
	require.Nil(t, appErr)

	m1, err := th.App.GetThreadMembershipsForUser(user2.Id, th.BasicTeam.Id)
	require.NoError(t, err)
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
		defer func() {
			appErr := th.App.DeleteChannel(th.Context, channel, user1.Id)
			require.Nil(t, appErr)
		}()

		postRoot, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "root post",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		_, appErr = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			RootId:    postRoot.Id,
			Message:   fmt.Sprintf("@%s", user2.Username),
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
		thread, err := th.App.Srv().Store().Thread().Get(postRoot.Id)
		require.NoError(t, err)
		require.Len(t, thread.Participants, 1)
		_, appErr = th.App.MarkChannelAsUnreadFromPost(th.Context, postRoot.Id, user1.Id, true)
		require.Nil(t, appErr)
		l, appErr := th.App.GetPostsForChannelAroundLastUnread(th.Context, channel.Id, user1.Id, 10, 10, true, true, false)
		require.Nil(t, appErr)
		require.Len(t, l.Order, 1)
		require.EqualValues(t, 1, l.Posts[postRoot.Id].ReplyCount)
		require.EqualValues(t, []string{user1.Id}, []string{l.Posts[postRoot.Id].Participants[0].Id})
		require.Empty(t, l.Posts[postRoot.Id].Participants[0].Email)
		require.NotZero(t, l.Posts[postRoot.Id].LastReplyAt)
		require.True(t, *l.Posts[postRoot.Id].IsFollowing)

		// try extended fetch
		l, appErr = th.App.GetPostsForChannelAroundLastUnread(th.Context, channel.Id, user1.Id, 10, 10, true, true, true)
		require.Nil(t, appErr)
		require.Len(t, l.Order, 1)
		require.NotEmpty(t, l.Posts[postRoot.Id].Participants[0].Email)
	})

	t.Run("Should not panic on unexpected db error", func(t *testing.T) {
		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(user2, channel)
		defer func() {
			appErr := th.App.DeleteChannel(th.Context, channel, user1.Id)
			require.Nil(t, appErr)
		}()

		postRoot, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "root post",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		// we introduce a race to trigger an unexpected error from the db side.
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := th.Server.Store().Post().PermanentDeleteByUser(th.Context, user1.Id)
			require.NoError(t, err)
		}()

		require.NotPanics(t, func() {
			// We're only testing that this doesn't panic, not checking the error
			// #nosec G104 - purposely not checking error as we're in a NotPanics block
			_, _ = th.App.CreatePost(th.Context, &model.Post{
				UserId:    user1.Id,
				ChannelId: channel.Id,
				RootId:    postRoot.Id,
				Message:   fmt.Sprintf("@%s", user2.Username),
			}, channel, model.CreatePostFlags{SetOnline: true})
		})

		wg.Wait()
	})

	t.Run("should sanitize participant data", func(t *testing.T) {
		id := model.NewId()
		user3, appErr := th.App.CreateUser(th.Context, &model.User{
			Email:         "success+" + id + "@simulator.amazonses.com",
			Username:      "un_" + id,
			Nickname:      "nn_" + id,
			AuthData:      model.NewPointer("bobbytables"),
			AuthService:   "saml",
			EmailVerified: true,
		})
		require.Nil(t, appErr)
		defer func() {
			appErr = th.App.PermanentDeleteUser(th.Context, user3)
			require.Nil(t, appErr)
		}()

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		defer func() {
			appErr = th.App.DeleteChannel(th.Context, channel, user1.Id)
			require.Nil(t, appErr)
		}()

		th.LinkUserToTeam(user3, th.BasicTeam)
		th.AddUserToChannel(user3, channel)

		postRoot, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "root post",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		_, appErr = th.App.CreatePost(th.Context, &model.Post{
			UserId:    user3.Id,
			ChannelId: channel.Id,
			RootId:    postRoot.Id,
			Message:   "reply",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
		thread, err := th.App.Srv().Store().Thread().Get(postRoot.Id)
		require.NoError(t, err)
		require.Len(t, thread.Participants, 1)

		// extended fetch posts page
		l, appErr := th.App.GetPostsPage(model.GetPostsOptions{
			UserId:                   user1.Id,
			ChannelId:                channel.Id,
			PerPage:                  int(10),
			SkipFetchThreads:         false,
			CollapsedThreads:         true,
			CollapsedThreadsExtended: true,
		})
		require.Nil(t, appErr)
		require.Len(t, l.Order, 1)
		require.NotEmpty(t, l.Posts[postRoot.Id].Participants[0].Email)
		require.Empty(t, l.Posts[postRoot.Id].Participants[0].AuthData)

		_, appErr = th.App.MarkChannelAsUnreadFromPost(th.Context, postRoot.Id, user1.Id, true)
		require.Nil(t, appErr)

		// extended fetch posts around
		l, appErr = th.App.GetPostsForChannelAroundLastUnread(th.Context, channel.Id, user1.Id, 10, 10, true, true, true)
		require.Nil(t, appErr)
		require.Len(t, l.Order, 1)
		require.NotEmpty(t, l.Posts[postRoot.Id].Participants[0].Email)
		require.Empty(t, l.Posts[postRoot.Id].Participants[0].AuthData)

		// extended fetch post thread
		opts := model.GetPostsOptions{
			SkipFetchThreads:         false,
			CollapsedThreads:         true,
			CollapsedThreadsExtended: true,
		}

		l, appErr = th.App.GetPostThread(postRoot.Id, opts, user1.Id)
		require.Nil(t, appErr)
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
		defer func() {
			err := mainHelper.SetReplicationLagForTesting(0)
			require.NoError(t, err)
		}()
		mainHelper.ToggleReplicasOn()
		defer mainHelper.ToggleReplicasOff()

		root, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "root post",
		}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		reply, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser2.Id,
			ChannelId: th.BasicChannel.Id,
			RootId:    root.Id,
			Message:   fmt.Sprintf("@%s", th.BasicUser2.Username),
		}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
		require.NotNil(t, reply)
	})
}

func TestSharedChannelSyncForPostActions(t *testing.T) {
	t.Run("creating a post in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := setupSharedChannels(t).InitBasic()
		defer th.TearDown()

		sharedChannelService := NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(sharedChannelService)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		user := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		_, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err, "Creating a post should not error")

		require.Len(t, sharedChannelService.channelNotifications, 1)
		assert.Equal(t, channel.Id, sharedChannelService.channelNotifications[0])
	})

	t.Run("updating a post in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := setupSharedChannels(t).InitBasic()
		defer th.TearDown()

		sharedChannelService := NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(sharedChannelService)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		user := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err, "Creating a post should not error")

		_, err = th.App.UpdatePost(th.Context, post, &model.UpdatePostOptions{SafeUpdate: true})
		require.Nil(t, err, "Updating a post should not error")

		require.Len(t, sharedChannelService.channelNotifications, 2)
		assert.Equal(t, channel.Id, sharedChannelService.channelNotifications[0])
		assert.Equal(t, channel.Id, sharedChannelService.channelNotifications[1])
	})

	t.Run("deleting a post in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := setupSharedChannels(t).InitBasic()
		defer th.TearDown()

		sharedChannelService := NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(sharedChannelService)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		user := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err, "Creating a post should not error")

		_, err = th.App.DeletePost(th.Context, post.Id, user.Id)
		require.Nil(t, err, "Deleting a post should not error")

		// one creation and two deletes
		require.Len(t, sharedChannelService.channelNotifications, 3)
		assert.Equal(t, channel.Id, sharedChannelService.channelNotifications[0])
		assert.Equal(t, channel.Id, sharedChannelService.channelNotifications[1])
		assert.Equal(t, channel.Id, sharedChannelService.channelNotifications[2])
	})
}

func TestAutofollowOnPostingAfterUnfollow(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
	p1, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: user.Id, ChannelId: channel.Id, Message: "Hi @" + user2.Username}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user2.Id, ChannelId: channel.Id, Message: "Hola"}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "reply"}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	// unfollow thread
	m, err := th.App.Srv().Store().Thread().MaintainMembership(user.Id, p1.Id, store.ThreadMembershipOpts{
		Following:       false,
		UpdateFollowing: true,
	})
	require.NoError(t, err)
	require.False(t, m.Following)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "another reply"}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	// User should be following thread after posting in it, even after previously
	// unfollowing it, if ThreadAutoFollow is true
	m, appErr = th.App.GetThreadMembershipForUser(user.Id, p1.Id)
	require.Nil(t, appErr)
	require.True(t, m.Following)
}

func TestGetPostIfAuthorized(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("Private channel", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)
		post, err := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, ChannelId: privateChannel.Id, Message: "Hello"}, privateChannel, model.CreatePostFlags{})
		require.Nil(t, err)
		require.NotNil(t, post)

		session1, err := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, err)
		require.NotNil(t, session1)

		session2, err := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser2.Id, Props: model.StringMap{}})
		require.Nil(t, err)
		require.NotNil(t, session2)

		// User is not authorized to get post
		_, err = th.App.GetPostIfAuthorized(th.Context, post.Id, session2, false)
		require.NotNil(t, err)

		// User is authorized to get post
		_, err = th.App.GetPostIfAuthorized(th.Context, post.Id, session1, false)
		require.Nil(t, err)
	})

	t.Run("Public channel", func(t *testing.T) {
		publicChannel := th.CreateChannel(th.Context, th.BasicTeam)
		post, err := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, ChannelId: publicChannel.Id, Message: "Hello"}, publicChannel, model.CreatePostFlags{})
		require.Nil(t, err)
		require.NotNil(t, post)

		session1, err := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, err)
		require.NotNil(t, session1)

		session2, err := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser2.Id, Props: model.StringMap{}})
		require.Nil(t, err)
		require.NotNil(t, session2)

		// User is authorized to get post
		_, err = th.App.GetPostIfAuthorized(th.Context, post.Id, session2, false)
		require.Nil(t, err)

		// User is authorized to get post
		_, err = th.App.GetPostIfAuthorized(th.Context, post.Id, session1, false)
		require.Nil(t, err)

		th.App.UpdateConfig(func(c *model.Config) {
			b := true
			c.ComplianceSettings.Enable = &b
		})

		// User is not authorized to get post
		_, err = th.App.GetPostIfAuthorized(th.Context, post.Id, session2, false)
		require.NotNil(t, err)

		// User is authorized to get post
		_, err = th.App.GetPostIfAuthorized(th.Context, post.Id, session1, false)
		require.Nil(t, err)
	})
}

func TestShouldNotRefollowOnOthersReply(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
	p1, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: user.Id, ChannelId: channel.Id, Message: "Hi @" + user2.Username}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user2.Id, ChannelId: channel.Id, Message: "Hola"}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	// User2 unfollows thread
	m, err := th.App.Srv().Store().Thread().MaintainMembership(user2.Id, p1.Id, store.ThreadMembershipOpts{
		Following:       false,
		UpdateFollowing: true,
	})
	require.NoError(t, err)
	require.False(t, m.Following)

	// user posts in the thread
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "another reply"}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	// User2 should still not be following the thread because they manually
	// unfollowed the thread
	m, appErr = th.App.GetThreadMembershipForUser(user2.Id, p1.Id)
	require.Nil(t, appErr)
	require.False(t, m.Following)

	// user posts in the thread mentioning user2
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: p1.Id, UserId: user.Id, ChannelId: channel.Id, Message: "reply with mention @" + user2.Username}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	// User2 should now be following the thread because they were explicitly mentioned
	m, appErr = th.App.GetThreadMembershipForUser(user2.Id, p1.Id)
	require.Nil(t, appErr)
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
				History: model.NewPointer(1),
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

	t.Run("Remove the time if cloud limit is NOT applicable", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &eMocks.CloudInterface{}
		th.App.Srv().Cloud = cloud

		// enterprise, limit is NOT applicable
		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(nil, nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockSystemStore := storemocks.SystemStore{}
		mockSystemStore.On("GetByName", mock.Anything).Return(&model.System{Name: model.SystemLastAccessiblePostTime, Value: "10"}, nil)
		mockSystemStore.On("PermanentDeleteByName", mock.Anything).Return(nil, nil)
		mockStore.On("System").Return(&mockSystemStore)

		err := th.App.ComputeLastAccessiblePostTime()
		assert.NoError(t, err)

		mockSystemStore.AssertNotCalled(t, "SaveOrUpdate", mock.Anything)
		mockSystemStore.AssertCalled(t, "PermanentDeleteByName", mock.Anything)
	})
}

func TestGetEditHistoryForPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "new message",
		UserId:    th.BasicUser.Id,
	}

	rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)

	// update the post message
	patch := &model.PostPatch{
		Message: model.NewPointer("new message edited"),
	}
	_, err1 := th.App.PatchPost(th.Context, rpost.Id, patch, nil)
	require.Nil(t, err1)

	// update the post message again
	patch = &model.PostPatch{
		Message: model.NewPointer("new message edited again"),
	}

	_, err2 := th.App.PatchPost(th.Context, rpost.Id, patch, nil)
	require.Nil(t, err2)

	t.Run("should return the edit history", func(t *testing.T) {
		edits, err := th.App.GetEditHistoryForPost(post.Id)
		require.Nil(t, err)

		require.Len(t, edits, 2)
		require.Equal(t, "new message edited", edits[0].Message)
		require.Equal(t, "new message", edits[1].Message)
	})

	t.Run("should return an error if the post is not found", func(t *testing.T) {
		edits, err := th.App.GetEditHistoryForPost("invalid-post-id")
		require.NotNil(t, err)
		require.Empty(t, edits)
	})

	t.Run("edit history should contain file metadata", func(t *testing.T) {
		fileBytes := []byte("file contents")
		fileInfo, err := th.App.UploadFile(th.Context, fileBytes, th.BasicChannel.Id, "file.txt")
		require.Nil(t, err)

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "new message",
			UserId:    th.BasicUser.Id,
			FileIds:   model.StringArray{fileInfo.Id},
		}

		_, err = th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		patch := &model.PostPatch{
			Message: model.NewPointer("new message edited"),
		}
		_, appErr := th.App.PatchPost(th.Context, post.Id, patch, nil)
		require.Nil(t, appErr)

		patch = &model.PostPatch{
			Message: model.NewPointer("new message edited 2"),
		}
		_, appErr = th.App.PatchPost(th.Context, post.Id, patch, nil)
		require.Nil(t, appErr)

		patch = &model.PostPatch{
			Message: model.NewPointer("new message edited 3"),
		}
		_, appErr = th.App.PatchPost(th.Context, post.Id, patch, nil)
		require.Nil(t, appErr)

		edits, err := th.App.GetEditHistoryForPost(post.Id)
		require.Nil(t, err)

		require.Len(t, edits, 3)

		for _, edit := range edits {
			require.Len(t, edit.FileIds, 1)
			require.Equal(t, fileInfo.Id, edit.FileIds[0])
			require.Len(t, edit.Metadata.Files, 1)
			require.Equal(t, fileInfo.Id, edit.Metadata.Files[0].Id)
		}
	})

	t.Run("edit history should contain file metadata even if the file info is deleted", func(t *testing.T) {
		fileBytes := []byte("file contents")
		fileInfo, appErr := th.App.UploadFile(th.Context, fileBytes, th.BasicChannel.Id, "file.txt")
		require.Nil(t, appErr)

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "new message",
			UserId:    th.BasicUser.Id,
			FileIds:   model.StringArray{fileInfo.Id},
		}

		_, appErr = th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		patch := &model.PostPatch{
			Message: model.NewPointer("new message edited"),
		}
		_, appErr = th.App.PatchPost(th.Context, post.Id, patch, nil)
		require.Nil(t, appErr)

		patch = &model.PostPatch{
			Message: model.NewPointer("new message edited 2"),
		}
		_, appErr = th.App.PatchPost(th.Context, post.Id, patch, nil)
		require.Nil(t, appErr)

		patch = &model.PostPatch{
			Message: model.NewPointer("new message edited 3"),
		}
		_, appErr = th.App.PatchPost(th.Context, post.Id, patch, nil)
		require.Nil(t, appErr)

		// now delete the file info, and it should still be include in edit history metadata
		_, err := th.App.Srv().Store().FileInfo().DeleteForPost(th.Context, post.Id)
		require.NoError(t, err)

		edits, appErr := th.App.GetEditHistoryForPost(post.Id)
		require.Nil(t, appErr)

		require.Len(t, edits, 3)

		for _, edit := range edits {
			require.Len(t, edit.FileIds, 1)
			require.Equal(t, fileInfo.Id, edit.FileIds[0])
			require.Len(t, edit.Metadata.Files, 1)
			require.Equal(t, fileInfo.Id, edit.Metadata.Files[0].Id)
			require.Greater(t, edit.Metadata.Files[0].DeleteAt, int64(0))
		}
	})
}

func TestCopyWranglerPostlist(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create a post with a file attachment
	fileBytes := []byte("file contents")
	fileInfo, err := th.App.UploadFile(th.Context, fileBytes, th.BasicChannel.Id, "file.txt")
	require.Nil(t, err)
	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "test message",
		UserId:    th.BasicUser.Id,
		FileIds:   []string{fileInfo.Id},
	}
	rootPost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)

	// Add a reaction to the post
	reaction := &model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    rootPost.Id,
		EmojiName: "smile",
	}
	_, err = th.App.SaveReactionForPost(th.Context, reaction)
	require.Nil(t, err)

	// Copy the post to a new channel
	targetChannel := &model.Channel{
		TeamId: th.BasicTeam.Id,
		Name:   "test-channel",
		Type:   model.ChannelTypeOpen,
	}
	targetChannel, err = th.App.CreateChannel(th.Context, targetChannel, false)
	require.Nil(t, err)
	wpl := &model.WranglerPostList{
		Posts:               []*model.Post{rootPost},
		FileAttachmentCount: 1,
	}
	newRootPost, err := th.App.CopyWranglerPostlist(th.Context, wpl, targetChannel)
	require.Nil(t, err)

	// Check that the new post has the same message and file attachment
	require.Equal(t, rootPost.Message, newRootPost.Message)
	require.Len(t, newRootPost.FileIds, 1)

	// Check that the new post has the same reaction
	reactions, err := th.App.GetReactionsForPost(newRootPost.Id)
	require.Nil(t, err)
	require.Len(t, reactions, 1)
	require.Equal(t, reaction.EmojiName, reactions[0].EmojiName)
}

func TestValidateMoveOrCopy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.WranglerSettings.MoveThreadFromPrivateChannelEnable = model.NewPointer(true)
		cfg.WranglerSettings.MoveThreadFromDirectMessageChannelEnable = model.NewPointer(true)
		cfg.WranglerSettings.MoveThreadFromGroupMessageChannelEnable = model.NewPointer(true)
		cfg.WranglerSettings.MoveThreadToAnotherTeamEnable = model.NewPointer(true)
		cfg.WranglerSettings.MoveThreadMaxCount = model.NewPointer(int64(100))
	})

	t.Run("empty post list", func(t *testing.T) {
		err := th.App.ValidateMoveOrCopy(th.Context, &model.WranglerPostList{}, th.BasicChannel, th.BasicChannel, th.BasicUser)
		require.Error(t, err)
		require.Equal(t, "The wrangler post list contains no posts", err.Error())
	})

	t.Run("moving from private channel with MoveThreadFromPrivateChannelEnable disabled", func(t *testing.T) {
		privateChannel := &model.Channel{
			TeamId: th.BasicTeam.Id,
			Name:   "private-channel",
			Type:   model.ChannelTypePrivate,
		}
		privateChannel, err := th.App.CreateChannel(th.Context, privateChannel, false)
		require.Nil(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.WranglerSettings.MoveThreadFromPrivateChannelEnable = model.NewPointer(false)
		})

		e := th.App.ValidateMoveOrCopy(th.Context, &model.WranglerPostList{Posts: []*model.Post{{ChannelId: privateChannel.Id}}}, privateChannel, th.BasicChannel, th.BasicUser)
		require.Error(t, e)
		require.Equal(t, "Wrangler is currently configured to not allow moving posts from private channels", e.Error())
	})

	t.Run("moving from direct channel with MoveThreadFromDirectMessageChannelEnable disabled", func(t *testing.T) {
		directChannel, err := th.App.createDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, err)
		require.NotNil(t, directChannel)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.WranglerSettings.MoveThreadFromDirectMessageChannelEnable = model.NewPointer(false)
		})

		e := th.App.ValidateMoveOrCopy(th.Context, &model.WranglerPostList{Posts: []*model.Post{{ChannelId: directChannel.Id}}}, directChannel, th.BasicChannel, th.BasicUser)
		require.Error(t, e)
		require.Equal(t, "Wrangler is currently configured to not allow moving posts from direct message channels", e.Error())
	})

	t.Run("moving from group channel with MoveThreadFromGroupMessageChannelEnable disabled", func(t *testing.T) {
		groupChannel := &model.Channel{
			TeamId: th.BasicTeam.Id,
			Name:   "group-channel",
			Type:   model.ChannelTypeGroup,
		}
		groupChannel, err := th.App.CreateChannel(th.Context, groupChannel, false)
		require.Nil(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.WranglerSettings.MoveThreadFromGroupMessageChannelEnable = model.NewPointer(false)
		})

		e := th.App.ValidateMoveOrCopy(th.Context, &model.WranglerPostList{Posts: []*model.Post{{ChannelId: groupChannel.Id}}}, groupChannel, th.BasicChannel, th.BasicUser)
		require.Error(t, e)
		require.Equal(t, "Wrangler is currently configured to not allow moving posts from group message channels", e.Error())
	})

	t.Run("moving to different team with MoveThreadToAnotherTeamEnable disabled", func(t *testing.T) {
		team := &model.Team{
			Name:        "testteam",
			DisplayName: "testteam",
			Type:        model.TeamOpen,
		}

		targetTeam, err := th.App.CreateTeam(th.Context, team)
		require.Nil(t, err)
		require.NotNil(t, targetTeam)

		targetChannel := &model.Channel{
			TeamId: targetTeam.Id,
			Name:   "test-channel",
			Type:   model.ChannelTypeOpen,
		}

		targetChannel, err = th.App.CreateChannel(th.Context, targetChannel, false)
		require.Nil(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.WranglerSettings.MoveThreadToAnotherTeamEnable = model.NewPointer(false)
		})

		e := th.App.ValidateMoveOrCopy(th.Context, &model.WranglerPostList{Posts: []*model.Post{{ChannelId: th.BasicChannel.Id}}}, th.BasicChannel, targetChannel, th.BasicUser)
		require.Error(t, e)
		require.Equal(t, "Wrangler is currently configured to not allow moving messages to different teams", e.Error())
	})

	t.Run("moving to channel user is not a member of", func(t *testing.T) {
		targetChannel := &model.Channel{
			TeamId: th.BasicTeam.Id,
			Name:   "test-channel",
			Type:   model.ChannelTypePrivate,
		}
		targetChannel, err := th.App.CreateChannel(th.Context, targetChannel, false)
		require.Nil(t, err)

		err = th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, th.SystemAdminUser.Id, th.BasicChannel)
		require.Nil(t, err)

		e := th.App.ValidateMoveOrCopy(th.Context, &model.WranglerPostList{Posts: []*model.Post{{ChannelId: th.BasicChannel.Id}}}, th.BasicChannel, targetChannel, th.BasicUser)
		require.Error(t, e)
		require.Equal(t, fmt.Sprintf("channel with ID %s doesn't exist or you are not a member", targetChannel.Id), e.Error())
	})

	t.Run("moving thread longer than MoveThreadMaxCount", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.WranglerSettings.MoveThreadMaxCount = 1
		})

		e := th.App.ValidateMoveOrCopy(th.Context, &model.WranglerPostList{Posts: []*model.Post{{ChannelId: th.BasicChannel.Id}, {ChannelId: th.BasicChannel.Id}}}, th.BasicChannel, th.BasicChannel, th.BasicUser)
		require.Error(t, e)
		require.Equal(t, "the thread is 2 posts long, but this command is configured to only move threads of up to 1 posts", e.Error())
	})
}

func TestPermanentDeletePost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should permanently delete a post and its file attachment", func(t *testing.T) {
		// Create a post with a file attachment.
		teamID := th.BasicTeam.Id
		channelID := th.BasicChannel.Id
		userID := th.BasicUser.Id
		filename := "test"
		data := []byte("abcd")

		info1, err := th.App.DoUploadFile(th.Context, time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamID, channelID, userID, filename, data, true)
		assert.Nil(t, err)

		post := &model.Post{
			Message:       "asd",
			ChannelId:     channelID,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        userID,
			CreateAt:      0,
			FileIds:       []string{info1.Id},
		}

		post, err = th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		assert.Nil(t, err)

		// Delete the post.
		err = th.App.PermanentDeletePost(th.Context, post.Id, userID)
		assert.Nil(t, err)

		// Wait for the cleanup routine to finish.
		time.Sleep(time.Millisecond * 100)

		// Check that the post can no longer be reached.
		_, err = th.App.GetSinglePost(th.Context, post.Id, true)
		assert.NotNil(t, err)

		// Check that the file can no longer be reached.
		_, err = th.App.GetFileInfo(th.Context, info1.Id)
		assert.NotNil(t, err)
	})

	t.Run("should permanently delete a post that is soft deleted", func(t *testing.T) {
		// Create a post with a file attachment.
		teamID := th.BasicTeam.Id
		channelID := th.BasicChannel.Id
		userID := th.BasicUser.Id
		filename := "test"
		data := []byte("abcd")

		info1, appErr := th.App.DoUploadFile(th.Context, time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamID, channelID, userID, filename, data, true)
		require.Nil(t, appErr)

		post := &model.Post{
			Message:       "asd",
			ChannelId:     channelID,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        userID,
			CreateAt:      0,
			FileIds:       []string{info1.Id},
		}

		post, appErr = th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		assert.Nil(t, appErr)

		infos, err := th.App.Srv().Store().FileInfo().GetForPost(post.Id, true, true, false)
		require.NoError(t, err)
		assert.Len(t, infos, 1)

		// Soft delete the post.
		_, appErr = th.App.DeletePost(th.Context, post.Id, userID)
		assert.Nil(t, appErr)

		// Wait for the cleanup routine to finish.
		time.Sleep(time.Millisecond * 100)

		// Delete the post.
		appErr = th.App.PermanentDeletePost(th.Context, post.Id, userID)
		assert.Nil(t, appErr)

		// Check that the post can no longer be reached.
		_, appErr = th.App.GetSinglePost(th.Context, post.Id, true)
		assert.NotNil(t, appErr)

		infos, err = th.App.Srv().Store().FileInfo().GetForPost(post.Id, true, true, false)
		require.NoError(t, err)
		assert.Len(t, infos, 0)
	})
}

func TestSendTestMessage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	t.Run("Should create the post with the correct prop", func(t *testing.T) {
		post, result := th.App.SendTestMessage(th.Context, th.BasicUser.Id)
		assert.Nil(t, result)
		assert.NotEmpty(t, post.GetProp(model.PostPropsForceNotification))
	})
}

func TestPopulateEditHistoryFileMetadata(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should populate file metadata for all posts", func(t *testing.T) {
		fileInfo1, err := th.App.Srv().Store().FileInfo().Save(th.Context,
			&model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Path:      "path.txt",
			})
		require.NoError(t, err)

		fileInfo2, err := th.App.Srv().Store().FileInfo().Save(th.Context,
			&model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Path:      "path.txt",
			})
		require.NoError(t, err)

		post1 := th.CreatePost(th.BasicChannel, func(post *model.Post) {
			post.FileIds = model.StringArray{fileInfo1.Id}
		})

		post2 := th.CreatePost(th.BasicChannel, func(post *model.Post) {
			post.FileIds = model.StringArray{fileInfo2.Id}
		})

		appErr := th.App.populateEditHistoryFileMetadata([]*model.Post{post1, post2})
		require.Nil(t, appErr)

		require.Len(t, post1.Metadata.Files, 1)
		require.Equal(t, fileInfo1.Id, post1.Metadata.Files[0].Id)

		require.Len(t, post2.Metadata.Files, 1)
		require.Equal(t, fileInfo2.Id, post2.Metadata.Files[0].Id)
	})

	t.Run("should populate file metadata even for deleted posts", func(t *testing.T) {
		fileInfo1, err := th.App.Srv().Store().FileInfo().Save(th.Context,
			&model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Path:      "path.txt",
			})
		require.NoError(t, err)

		fileInfo2, err := th.App.Srv().Store().FileInfo().Save(th.Context,
			&model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Path:      "path.txt",
			})
		require.NoError(t, err)

		post1 := th.CreatePost(th.BasicChannel, func(post *model.Post) {
			post.FileIds = model.StringArray{fileInfo1.Id}
		})

		post2 := th.CreatePost(th.BasicChannel, func(post *model.Post) {
			post.FileIds = model.StringArray{fileInfo2.Id}
		})

		_, appErr := th.App.DeletePost(th.Context, post1.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		_, appErr = th.App.DeletePost(th.Context, post2.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		appErr = th.App.populateEditHistoryFileMetadata([]*model.Post{post1, post2})
		require.Nil(t, appErr)

		require.Len(t, post1.Metadata.Files, 1)
		require.Equal(t, fileInfo1.Id, post1.Metadata.Files[0].Id)

		require.Len(t, post2.Metadata.Files, 1)
		require.Equal(t, fileInfo2.Id, post2.Metadata.Files[0].Id)
	})

	t.Run("should populate file metadata even for deleted fileInfos", func(t *testing.T) {
		fileInfo1, err := th.App.Srv().Store().FileInfo().Save(th.Context,
			&model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Path:      "path.txt",
			})
		require.NoError(t, err)

		fileInfo2, err := th.App.Srv().Store().FileInfo().Save(th.Context,
			&model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Path:      "path.txt",
			})
		require.NoError(t, err)

		post1 := th.CreatePost(th.BasicChannel, func(post *model.Post) {
			post.FileIds = model.StringArray{fileInfo1.Id}
		})

		post2 := th.CreatePost(th.BasicChannel, func(post *model.Post) {
			post.FileIds = model.StringArray{fileInfo2.Id}
		})

		_, err = th.App.Srv().Store().FileInfo().DeleteForPost(th.Context, post1.Id)
		require.NoError(t, err)

		_, err = th.App.Srv().Store().FileInfo().DeleteForPost(th.Context, post2.Id)
		require.NoError(t, err)

		appErr := th.App.populateEditHistoryFileMetadata([]*model.Post{post1, post2})
		require.Nil(t, appErr)

		require.Len(t, post1.Metadata.Files, 1)
		require.Equal(t, fileInfo1.Id, post1.Metadata.Files[0].Id)
		require.Greater(t, post1.Metadata.Files[0].DeleteAt, int64(0))

		require.Len(t, post2.Metadata.Files, 1)
		require.Equal(t, fileInfo2.Id, post2.Metadata.Files[0].Id)
		require.Greater(t, post2.Metadata.Files[0].DeleteAt, int64(0))
	})
}
