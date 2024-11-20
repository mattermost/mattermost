// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"reflect"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestCreatePost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "#hashtag a" + model.NewId() + "a", Props: model.StringInterface{model.PropsAddChannelMember: "no good"}, DeleteAt: 101}

	rpost, resp, err2 := client.CreatePost(context.Background(), post)
	require.NoError(t, err2)
	CheckCreatedStatus(t, resp)

	require.Equal(t, post.Message, rpost.Message, "message didn't match")
	require.Equal(t, "#hashtag", rpost.Hashtags, "hashtag didn't match")
	require.Empty(t, rpost.FileIds)
	require.Equal(t, 0, int(rpost.EditAt), "newly created post shouldn't have EditAt set")
	require.Nil(t, rpost.GetProp(model.PropsAddChannelMember), "newly created post shouldn't have Props['add_channel_member'] set")
	require.Equal(t, 0, int(rpost.DeleteAt), "newly created post shouldn't have DeleteAt set")

	post.RootId = rpost.Id
	_, _, err2 = client.CreatePost(context.Background(), post)
	require.NoError(t, err2)

	post.RootId = "junk"
	_, resp, err2 = client.CreatePost(context.Background(), post)
	require.Error(t, err2)
	CheckBadRequestStatus(t, resp)

	post2 := &model.Post{ChannelId: th.BasicChannel2.Id, Message: "zz" + model.NewId() + "a", CreateAt: 123}
	rpost2, _, _ := client.CreatePost(context.Background(), post2)
	require.NotEqual(t, post2.CreateAt, rpost2.CreateAt, "create at should not match")

	t.Run("with file uploaded by same user", func(t *testing.T) {
		fileResp, _, err := client.UploadFile(context.Background(), []byte("data"), th.BasicChannel.Id, "test")
		require.NoError(t, err)
		fileId := fileResp.FileInfos[0].Id

		postWithFiles, _, err := client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "with files",
			FileIds:   model.StringArray{fileId},
		})
		require.NoError(t, err)
		assert.Equal(t, model.StringArray{fileId}, postWithFiles.FileIds)

		actualPostWithFiles, _, err := client.GetPost(context.Background(), postWithFiles.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StringArray{fileId}, actualPostWithFiles.FileIds)
	})

	t.Run("with file uploaded by different user", func(t *testing.T) {
		fileResp, _, err := th.SystemAdminClient.UploadFile(context.Background(), []byte("data"), th.BasicChannel.Id, "test")
		require.NoError(t, err)
		fileId := fileResp.FileInfos[0].Id

		postWithFiles, _, err := client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "with files",
			FileIds:   model.StringArray{fileId},
		})
		require.NoError(t, err)
		assert.Empty(t, postWithFiles.FileIds)

		actualPostWithFiles, _, err := client.GetPost(context.Background(), postWithFiles.Id, "")
		require.NoError(t, err)
		assert.Empty(t, actualPostWithFiles.FileIds)
	})

	t.Run("with file uploaded by nouser", func(t *testing.T) {
		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("data"), th.BasicChannel.Id, "test")
		require.Nil(t, appErr)
		fileId := fileInfo.Id

		postWithFiles, _, err := client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "with files",
			FileIds:   model.StringArray{fileId},
		})
		require.NoError(t, err)
		assert.Equal(t, model.StringArray{fileId}, postWithFiles.FileIds)

		actualPostWithFiles, _, err := client.GetPost(context.Background(), postWithFiles.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StringArray{fileId}, actualPostWithFiles.FileIds)
	})

	t.Run("Create posts without the USE_CHANNEL_MENTIONS Permission - returns ephemeral message with mentions and no ephemeral message without mentions", func(t *testing.T) {
		WebSocketClient, err := th.CreateWebSocketClient()
		WebSocketClient.Listen()
		require.NoError(t, err)

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.RemovePermissionFromRole(model.PermissionUseChannelMentions.Id, model.ChannelUserRoleId)

		post.RootId = rpost.Id
		post.Message = "a post with no channel mentions"
		_, _, err = client.CreatePost(context.Background(), post)
		require.NoError(t, err)

		// Message with no channel mentions should result in no ephemeral message
		timeout := time.After(5 * time.Second)
		waiting := true
		for waiting {
			select {
			case event := <-WebSocketClient.EventChannel:
				require.NotEqual(t, model.WebsocketEventEphemeralMessage, event.EventType(), "should not have ephemeral message event")
			case <-timeout:
				waiting = false
			}
		}

		post.RootId = rpost.Id
		post.Message = "a post with @channel"
		_, _, err = client.CreatePost(context.Background(), post)
		require.NoError(t, err)

		post.RootId = rpost.Id
		post.Message = "a post with @all"
		_, _, err = client.CreatePost(context.Background(), post)
		require.NoError(t, err)

		post.RootId = rpost.Id
		post.Message = "a post with @here"
		_, _, err = client.CreatePost(context.Background(), post)
		require.NoError(t, err)

		timeout = time.After(5 * time.Second)
		eventsToGo := 3 // 3 Posts created with @ mentions should result in 3 websocket events
		for eventsToGo > 0 {
			select {
			case event := <-WebSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventEphemeralMessage {
					require.Equal(t, model.WebsocketEventEphemeralMessage, event.EventType())
					eventsToGo = eventsToGo - 1
				}
			case <-timeout:
				require.Fail(t, "Should have received ephemeral message event and not timedout")
				eventsToGo = 0
			}
		}
	})

	t.Run("err with integrations-reserved props", func(t *testing.T) {
		originalHardenedModeSetting := *th.App.Config().ServiceSettings.ExperimentalEnableHardenedMode
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableHardenedMode = true
		})

		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableHardenedMode = originalHardenedModeSetting
		})

		_, postResp, postErr := client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "with props",
			Props:     model.StringInterface{model.PostPropsFromWebhook: "true"},
		})

		require.Error(t, postErr)
		CheckBadRequestStatus(t, postResp)
	})

	post.RootId = ""
	post.Type = model.PostTypeSystemGeneric
	_, resp, err := client.CreatePost(context.Background(), post)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	post.Type = ""
	post.RootId = rpost2.Id
	_, resp, err = client.CreatePost(context.Background(), post)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	post.RootId = ""
	post.ChannelId = "junk"
	_, resp, err = client.CreatePost(context.Background(), post)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	post.ChannelId = model.NewId()
	_, resp, err = client.CreatePost(context.Background(), post)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	r, err := client.DoAPIPost(context.Background(), "/posts", "garbage")
	require.Error(t, err)
	require.Equal(t, http.StatusBadRequest, r.StatusCode)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.CreatePost(context.Background(), post)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	post.ChannelId = th.BasicChannel.Id
	post.CreateAt = 123
	rpost, _, err = th.SystemAdminClient.CreatePost(context.Background(), post)
	require.NoError(t, err)
	require.Equal(t, post.CreateAt, rpost.CreateAt, "create at should match")

	t.Run("Should not be able to define the RemoteId of a post from the API", func(t *testing.T) {
		newPost := &model.Post{
			RemoteId:  model.NewPointer(model.NewId()),
			ChannelId: th.BasicChannel.Id,
			Message:   "post content " + model.NewId(),
			DeleteAt:  0,
		}

		respPost, resp, err := th.SystemAdminClient.CreatePost(context.Background(), newPost)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Zero(t, *respPost.RemoteId)

		createdPost, appErr := th.App.GetSinglePost(th.Context, respPost.Id, false)
		require.Nil(t, appErr)
		require.Zero(t, *createdPost.RemoteId)
	})
}

func TestCreatePostForPriority(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotifications = true
	})

	t.Run("should return forbidden when post-priority is disabled", func(t *testing.T) {
		originalPrioritySetting := *th.App.Config().ServiceSettings.PostPriority
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostPriority = false
		})

		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostPriority = originalPrioritySetting
		})

		post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "test", Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority: model.NewPointer("urgent"),
			},
		}}

		_, resp, err := client.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("should return badRequest when priority is set for reply post", func(t *testing.T) {
		rootPost := &model.Post{ChannelId: th.BasicChannel.Id, Message: "root"}

		post, resp, err := client.CreatePost(context.Background(), rootPost)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		replyPost := &model.Post{RootId: post.Id, ChannelId: th.BasicChannel.Id, Message: "reply", Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority: model.NewPointer("urgent"),
			},
		}}
		_, resp, err = client.CreatePost(context.Background(), replyPost)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("should return statusNotImplemented when min. pro. license not available", func(t *testing.T) {
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
		defer th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		//  for Acknowledment
		p1 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "test", Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:     model.NewPointer("urgent"),
				RequestedAck: model.NewPointer(true),
			},
		}}
		_, resp, err := client.CreatePost(context.Background(), p1)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		//  for Persistent Notification
		p2 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "test", Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("urgent"),
				PersistentNotifications: model.NewPointer(true),
			},
		}}
		_, resp, err = client.CreatePost(context.Background(), p2)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("should return forbidden when persistent notification not enabled", func(t *testing.T) {
		originalSetting := *th.App.Config().ServiceSettings.AllowPersistentNotifications
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowPersistentNotifications = false
		})

		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowPersistentNotifications = originalSetting
		})

		p1 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "test", Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("urgent"),
				PersistentNotifications: model.NewPointer(true),
			},
		}}
		_, resp, err := client.CreatePost(context.Background(), p1)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("should return badRequest when post is not urgent for persistent notification", func(t *testing.T) {
		p1 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "test", Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("important"),
				PersistentNotifications: model.NewPointer(true),
			},
		}}
		_, resp, err := client.CreatePost(context.Background(), p1)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("should return forbidden when persistent notification is disabled for guest users", func(t *testing.T) {
		originalSetting := *th.App.Config().ServiceSettings.AllowPersistentNotificationsForGuests
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = false
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = originalSetting
		})

		appErr := th.App.DemoteUserToGuest(th.Context, th.BasicUser)
		require.Nil(t, appErr)
		defer func() {
			appErr = th.App.PromoteGuestToUser(th.Context, th.BasicUser, th.SystemAdminUser.Id)
			require.Nil(t, appErr)
		}()

		p1 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "test", Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("urgent"),
				PersistentNotifications: model.NewPointer(true),
			},
		}}
		_, resp, err := client.CreatePost(context.Background(), p1)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("should create priority post", func(t *testing.T) {
		p1 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "test", Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority: model.NewPointer("important"),
			},
		}}
		_, resp, err := client.CreatePost(context.Background(), p1)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	t.Run("should create acknowledge post", func(t *testing.T) {
		p1 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "test", Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:     model.NewPointer(""),
				RequestedAck: model.NewPointer(true),
			},
		}}
		_, resp, err := client.CreatePost(context.Background(), p1)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	t.Run("should create persistent notification post", func(t *testing.T) {
		p1 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "test @" + th.BasicUser2.Username, Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("urgent"),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}}
		_, resp, err := client.CreatePost(context.Background(), p1)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})
}

func TestCreatePostWithOAuthClient(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	originalOAuthSetting := *th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableOAuthServiceProvider = true
	})

	defer th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableOAuthServiceProvider = originalOAuthSetting
	})

	oAuthApp, appErr := th.App.CreateOAuthApp(&model.OAuthApp{
		CreatorId:    th.SystemAdminUser.Id,
		Name:         "name",
		CallbackUrls: []string{"http://test.com"},
		Homepage:     "http://test.com",
	})
	require.Nil(t, appErr, "should create an OAuthApp")

	session, appErr := th.App.CreateSession(th.Context, &model.Session{
		UserId:  th.BasicUser.Id,
		Token:   "token",
		IsOAuth: true,
		Props:   model.StringMap{model.SessionPropOAuthAppID: oAuthApp.Id},
	})
	require.Nil(t, appErr, "should create a session")

	post, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicPost.ChannelId,
		Message:   "test message",
	})
	require.NoError(t, err)
	assert.NotContains(t, post.GetProps(), model.PostPropsFromOAuthApp, fmt.Sprintf("contains %s prop when not using OAuth client", model.PostPropsOverrideUsername))

	client := th.CreateClient()
	client.SetOAuthToken(session.Token)
	post, _, err = client.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicPost.ChannelId,
		Message:   "test message",
	})

	require.NoError(t, err)
	assert.Contains(t, post.GetProps(), model.PostPropsFromOAuthApp, fmt.Sprintf("missing %s prop when using OAuth client", model.PostPropsOverrideUsername))

	t.Run("allow username and icon overrides", func(t *testing.T) {
		originalHardenedModeSetting := *th.App.Config().ServiceSettings.ExperimentalEnableHardenedMode
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableHardenedMode = true
		})

		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableHardenedMode = originalHardenedModeSetting
		})

		post, _, err = client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test message",
			Props:     model.StringInterface{model.PostPropsOverrideUsername: "newUsernameValue", model.PostPropsOverrideIconURL: "iconUrlOverrideValue"},
		})

		require.NoError(t, err)
		assert.Contains(t, post.GetProps(), model.PostPropsOverrideUsername, fmt.Sprintf("missing %s prop when using OAuth client", model.PostPropsOverrideUsername))
		assert.Contains(t, post.GetProps(), model.PostPropsOverrideIconURL, fmt.Sprintf("missing %s prop when using OAuth client", model.PostPropsOverrideIconURL))
	})
}

func TestCreatePostEphemeral(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.SystemAdminClient

	ephemeralPost := &model.PostEphemeral{
		UserID: th.BasicUser2.Id,
		Post:   &model.Post{ChannelId: th.BasicChannel.Id, Message: "a" + model.NewId() + "a", Props: model.StringInterface{model.PropsAddChannelMember: "no good"}},
	}

	rpost, resp, err := client.CreatePostEphemeral(context.Background(), ephemeralPost)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.Equal(t, ephemeralPost.Post.Message, rpost.Message, "message didn't match")
	require.Equal(t, 0, int(rpost.EditAt), "newly created ephemeral post shouldn't have EditAt set")

	r, err := client.DoAPIPost(context.Background(), "/posts/ephemeral", "garbage")
	require.Error(t, err)
	require.Equal(t, http.StatusBadRequest, r.StatusCode)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.CreatePostEphemeral(context.Background(), ephemeralPost)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	client = th.Client
	_, resp, err = client.CreatePostEphemeral(context.Background(), ephemeralPost)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func testCreatePostWithOutgoingHook(
	t *testing.T,
	hookContentType, expectedContentType, message, triggerWord string,
	fileIds []string,
	triggerWhen int,
	commentPostType bool,
) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	user := th.SystemAdminUser
	team := th.BasicTeam
	channel := th.BasicChannel

	enableOutgoingWebhooks := *th.App.Config().ServiceSettings.EnableOutgoingWebhooks
	allowedUntrustedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = enableOutgoingWebhooks })
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = allowedUntrustedInternalConnections
		})
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	var hook *model.OutgoingWebhook
	var post *model.Post

	// Create a test server that is the target of the outgoing webhook. It will
	// validate the webhook body fields and write to the success channel on
	// success/failure.
	success := make(chan bool)
	wait := make(chan bool, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-wait

		requestContentType := r.Header.Get("Content-Type")
		if requestContentType != expectedContentType {
			t.Logf("Content-Type is %s, should be %s", requestContentType, expectedContentType)
			success <- false
			return
		}

		expectedPayload := &model.OutgoingWebhookPayload{
			Token:       hook.Token,
			TeamId:      hook.TeamId,
			TeamDomain:  team.Name,
			ChannelId:   post.ChannelId,
			ChannelName: channel.Name,
			Timestamp:   post.CreateAt,
			UserId:      post.UserId,
			UserName:    user.Username,
			PostId:      post.Id,
			Text:        post.Message,
			TriggerWord: triggerWord,
			FileIds:     strings.Join(post.FileIds, ","),
		}

		// depending on the Content-Type, we expect to find a JSON or form encoded payload
		if requestContentType == "application/json" {
			decoder := json.NewDecoder(r.Body)
			o := &model.OutgoingWebhookPayload{}
			err := decoder.Decode(&o)
			if err != nil {
				th.TestLogger.Warn("Error decoding body", mlog.Err(err))
			}

			if !reflect.DeepEqual(expectedPayload, o) {
				t.Logf("JSON payload is %+v, should be %+v", o, expectedPayload)
				success <- false
				return
			}
		} else {
			err := r.ParseForm()
			if err != nil {
				t.Logf("Error parsing form: %q", err)
				success <- false
				return
			}

			expectedFormValues, _ := url.ParseQuery(expectedPayload.ToFormValues())

			if !reflect.DeepEqual(expectedFormValues, r.Form) {
				t.Logf("Form values are: %q\n, should be: %q\n", r.Form, expectedFormValues)
				success <- false
				return
			}
		}

		respPostType := "" //if is empty or post will do a normal post.
		if commentPostType {
			respPostType = model.OutgoingHookResponseTypeComment
		}

		outGoingHookResponse := &model.OutgoingWebhookResponse{
			Text:         model.NewPointer("some test text"),
			Username:     "TestCommandServer",
			IconURL:      "https://mattermost.com/wp-content/uploads/2022/02/icon.png",
			Type:         "custom_as",
			ResponseType: respPostType,
		}

		hookJSON, jsonErr := json.Marshal(outGoingHookResponse)
		require.NoError(t, jsonErr)
		_, err := w.Write(hookJSON)
		require.NoError(t, err)
		success <- true
	}))
	defer ts.Close()

	// create an outgoing webhook, passing it the test server URL
	var triggerWords []string
	if triggerWord != "" {
		triggerWords = []string{triggerWord}
	}

	hook = &model.OutgoingWebhook{
		ChannelId:    channel.Id,
		TeamId:       team.Id,
		ContentType:  hookContentType,
		TriggerWords: triggerWords,
		TriggerWhen:  triggerWhen,
		CallbackURLs: []string{ts.URL},
	}

	hook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), hook)
	require.NoError(t, err)

	// create a post to trigger the webhook
	post = &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		FileIds:   fileIds,
	}

	post, _, err = th.SystemAdminClient.CreatePost(context.Background(), post)
	require.NoError(t, err)

	wait <- true

	// We wait for the test server to write to the success channel and we make
	// the test fail if that doesn't happen before the timeout.
	select {
	case ok := <-success:
		require.True(t, ok, "Test server did send an invalid webhook.")
	case <-time.After(2 * time.Second):
		require.FailNow(t, "Timeout, test server did not send the webhook.")
	}

	if commentPostType {
		time.Sleep(time.Millisecond * 100)
		postList, _, err := th.SystemAdminClient.GetPostThread(context.Background(), post.Id, "", false)
		require.NoError(t, err)
		require.Equal(t, post.Id, postList.Order[0], "wrong order")

		_, ok := postList.Posts[post.Id]
		require.True(t, ok, "should have had post")
		require.Len(t, postList.Posts, 2, "should have 2 posts")
	}
}

func TestCreatePostWithOutgoingHook_form_urlencoded(t *testing.T) {
	t.Run("Case 1", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "triggerword", []string{"file_id_1"}, app.TriggerwordsExactMatch, false)
	})
	t.Run("Case 2", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1"}, app.TriggerwordsStartsWith, false)
	})
	t.Run("Case 3", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "", "", []string{"file_id_1"}, app.TriggerwordsExactMatch, false)
	})
	t.Run("Case 4", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "", "", []string{"file_id_1"}, app.TriggerwordsStartsWith, false)
	})
	t.Run("Case 5", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "triggerword", []string{"file_id_1"}, app.TriggerwordsExactMatch, true)
	})
	t.Run("Case 6", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1"}, app.TriggerwordsStartsWith, true)
	})
}

func TestCreatePostWithOutgoingHook_json(t *testing.T) {
	t.Run("Case 1", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerword lorem ipsum", "triggerword", []string{"file_id_1, file_id_2"}, app.TriggerwordsExactMatch, false)
	})
	t.Run("Case 2", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1, file_id_2"}, app.TriggerwordsStartsWith, false)
	})
	t.Run("Case 3", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerword lorem ipsum", "", []string{"file_id_1"}, app.TriggerwordsExactMatch, false)
	})
	t.Run("Case 4", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerwordaaazzz lorem ipsum", "", []string{"file_id_1"}, app.TriggerwordsStartsWith, false)
	})
	t.Run("Case 5", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerword lorem ipsum", "triggerword", []string{"file_id_1, file_id_2"}, app.TriggerwordsExactMatch, true)
	})
	t.Run("Case 6", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerwordaaazzz lorem ipsum", "", []string{"file_id_1"}, app.TriggerwordsStartsWith, true)
	})
}

// hooks created before we added the ContentType field should be considered as
// application/x-www-form-urlencoded
func TestCreatePostWithOutgoingHook_no_content_type(t *testing.T) {
	t.Run("Case 1", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "triggerword", []string{"file_id_1"}, app.TriggerwordsExactMatch, false)
	})
	t.Run("Case 2", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1"}, app.TriggerwordsStartsWith, false)
	})
	t.Run("Case 3", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "", []string{"file_id_1, file_id_2"}, app.TriggerwordsExactMatch, false)
	})
	t.Run("Case 4", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "", []string{"file_id_1, file_id_2"}, app.TriggerwordsStartsWith, false)
	})
	t.Run("Case 5", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "triggerword", []string{"file_id_1"}, app.TriggerwordsExactMatch, true)
	})
	t.Run("Case 6", func(t *testing.T) {
		testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "", []string{"file_id_1, file_id_2"}, app.TriggerwordsExactMatch, true)
	})
}

func TestMoveThread(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_MOVETHREADSENABLED", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_MOVETHREADSENABLED")
	th := SetupEnterprise(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	client := th.Client

	ctx := context.Background()

	basicUser1 := th.BasicUser
	basicUser2 := th.BasicUser2
	basicUser3 := th.CreateUser()

	// Helper function to create a new public channel to move the post to
	createPublicChannel := func(teamId, name, displayName string) *model.Channel {
		channel, resp, err := client.CreateChannel(ctx, &model.Channel{
			TeamId:      teamId,
			Name:        name,
			DisplayName: displayName,
			Type:        model.ChannelTypeOpen,
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, channel)

		return channel
	}

	// Create a new private channel to move the post to
	privateChannel, resp, err := client.CreateChannel(ctx, &model.Channel{
		TeamId:      th.BasicTeam.Id,
		Name:        "test-private-channel",
		DisplayName: "Test Private Channel",
		Type:        model.ChannelTypePrivate,
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, privateChannel)

	// Create a new direct message channel to move the post to
	dmChannel, resp, err := client.CreateDirectChannel(ctx, basicUser1.Id, basicUser2.Id)
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, dmChannel)

	// Create a new group message channel to move the post to
	gmChannel, resp, err := client.CreateGroupChannel(ctx, []string{basicUser1.Id, basicUser2.Id, basicUser3.Id})
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, gmChannel)
	t.Run("Move to public channel", func(t *testing.T) {
		// Create a public channel
		publicChannel := createPublicChannel(th.BasicTeam.Id, "test-public-channel", "Test Public Channel")

		// Create a new post to move
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test post",
		}
		newPost, resp, err := client.CreatePost(ctx, post)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, newPost)

		// Move the post to the public channel
		moveThreadParams := &model.MoveThreadParams{
			ChannelId: publicChannel.Id,
		}
		resp, err = client.MoveThread(ctx, newPost.Id, moveThreadParams)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Check that the post was moved to the public channel
		posts, resp, err := client.GetPostsForChannel(ctx, publicChannel.Id, 0, 100, "", true, false)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, posts)
		// There should be 2 posts, the system join message for the user who moved it joining the channel, and the post we moved
		require.Equal(t, 2, len(posts.Posts))
		require.Equal(t, newPost.Message, posts.Posts[posts.Order[0]].Message)
	})

	t.Run("Move to private channel", func(t *testing.T) {
		// Create a new post to move
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test post",
		}
		newPost, resp, err := client.CreatePost(ctx, post)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, newPost)

		// Move the post to the private channel
		moveThreadParams := &model.MoveThreadParams{
			ChannelId: privateChannel.Id,
		}
		resp, err = client.MoveThread(ctx, newPost.Id, moveThreadParams)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Check that the post was moved to the private channel
		posts, resp, err := client.GetPostsForChannel(ctx, privateChannel.Id, 0, 100, "", true, false)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, posts)
		// There should be 2 posts, the system join message for the user who moved it joining the channel, and the post we moved
		require.Equal(t, 2, len(posts.Posts))
		require.Equal(t, newPost.Message, posts.Posts[posts.Order[0]].Message)
	})

	t.Run("Move to direct message channel", func(t *testing.T) {
		// Create a new post to move
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test post",
		}
		newPost, resp, err := client.CreatePost(ctx, post)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, newPost)

		// Move the post to the direct message channel
		moveThreadParams := &model.MoveThreadParams{
			ChannelId: dmChannel.Id,
		}
		resp, err = client.MoveThread(ctx, newPost.Id, moveThreadParams)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Check that the post was moved to the direct message channel
		posts, resp, err := client.GetPostsForChannel(ctx, dmChannel.Id, 0, 100, "", true, false)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, posts)
		// There should be 1 post, the post we moved
		require.Equal(t, 1, len(posts.Posts))
		require.Equal(t, newPost.Message, posts.Posts[posts.Order[0]].Message)
	})

	t.Run("Move to group message channel", func(t *testing.T) {
		// Create a new post to move
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test post",
		}
		newPost, resp, err := client.CreatePost(ctx, post)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, newPost)

		// Move the post to the group message channel
		moveThreadParams := &model.MoveThreadParams{
			ChannelId: gmChannel.Id,
		}
		resp, err = client.MoveThread(ctx, newPost.Id, moveThreadParams)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Check that the post was moved to the group message channel
		posts, resp, err := client.GetPostsForChannel(ctx, gmChannel.Id, 0, 100, "", true, false)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, posts)
		// There should be 1 post, the post we moved
		require.Equal(t, 1, len(posts.Posts))
		require.Equal(t, newPost.Message, posts.Posts[posts.Order[0]].Message)
	})

	t.Run("Move thread with more than one post", func(t *testing.T) {
		// Create a new public channel to move the post to
		pChannel, resp, err := client.CreateChannel(ctx, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "test-public-channel2",
			DisplayName: "Test Public Channel",
			Type:        model.ChannelTypeOpen,
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, pChannel)
		// Create a new post to use as the root post
		rootPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "root post",
		}
		rootPost, resp, err = client.CreatePost(ctx, rootPost)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, rootPost)

		// Create a new post to move
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test post",
			RootId:    rootPost.Id,
		}
		newPost, resp, err := client.CreatePost(ctx, post)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, newPost)

		// Create another post in the thread
		post = &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test post 2",
			RootId:    rootPost.Id,
		}
		newPost2, resp, err := client.CreatePost(ctx, post)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, newPost2)

		// Move the thread to the public channel
		moveThreadParams := &model.MoveThreadParams{
			ChannelId: pChannel.Id,
		}
		resp, err = client.MoveThread(ctx, rootPost.Id, moveThreadParams)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Check that the thread was moved to the public channel
		posts, resp, err := client.GetPostsForChannel(ctx, pChannel.Id, 0, 100, "", false, false)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, posts)
		require.Equal(t, "This thread was moved from another channel", posts.Posts[posts.Order[0]].Message)
		require.Equal(t, newPost2.Message, posts.Posts[posts.Order[1]].Message)
		require.Equal(t, newPost.Message, posts.Posts[posts.Order[2]].Message)
		require.Equal(t, rootPost.Message, posts.Posts[posts.Order[3]].Message)
	})

	t.Run("Move thread when permitted role is channel admin", func(t *testing.T) {
		// Create public channel
		publicChannel := createPublicChannel(th.BasicTeam.Id, "test-public-channel-admin", "Test Public Channel Admin")

		// Set permitted role as channel admin
		enabled := true
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.WranglerSettings = model.WranglerSettings{MoveThreadToAnotherTeamEnable: &enabled,
				PermittedWranglerRoles: []string{model.PermissionsChannelAdmin}}
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.WranglerSettings = model.WranglerSettings{}
		})

		// Login as channel admin and add to channel
		th.LoginTeamAdmin()
		th.AddUserToChannel(th.TeamAdminUser, publicChannel)
		defer th.LoginBasic()

		// Create a new post to move
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "test post",
		}
		newPost, resp, err := client.CreatePost(ctx, post)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, newPost)

		// Move the post to the public channel
		moveThreadParams := &model.MoveThreadParams{
			ChannelId: publicChannel.Id,
		}
		resp, err = client.MoveThread(ctx, newPost.Id, moveThreadParams)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Check that the post was moved to the public channel
		posts, resp, err := client.GetPostsForChannel(ctx, publicChannel.Id, 0, 100, "", true, false)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, posts)
		// There should be 2 posts, the system join message for the user who moved it joining the channel, and the post we moved
		require.Equal(t, 2, len(posts.Posts))
		require.Equal(t, newPost.Message, posts.Posts[posts.Order[0]].Message)
	})
}

func TestCreatePostPublic(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "#hashtag a" + model.NewId() + "a"}

	user := model.User{Email: th.GenerateTestEmail(), Nickname: "Joram Wilander", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemUserRoleId}

	ruser, _, err := client.CreateUser(context.Background(), &user)
	require.NoError(t, err)

	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	_, resp, err := client.CreatePost(context.Background(), post)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, appErr := th.App.UpdateUserRoles(th.Context, ruser.Id, model.SystemUserRoleId+" "+model.SystemPostAllPublicRoleId, false)
	require.Nil(t, appErr)
	appErr = th.App.Srv().InvalidateAllCaches()
	require.Nil(t, appErr)

	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	_, _, err = client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	post.ChannelId = th.BasicPrivateChannel.Id
	_, resp, err = client.CreatePost(context.Background(), post)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, appErr = th.App.UpdateUserRoles(th.Context, ruser.Id, model.SystemUserRoleId, false)
	require.Nil(t, appErr)
	_, appErr = th.App.JoinUserToTeam(th.Context, th.BasicTeam, ruser, "")
	require.Nil(t, appErr)
	_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, ruser.Id, model.TeamUserRoleId+" "+model.TeamPostAllPublicRoleId)
	require.Nil(t, appErr)
	appErr = th.App.Srv().InvalidateAllCaches()
	require.Nil(t, appErr)

	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	post.ChannelId = th.BasicPrivateChannel.Id
	_, resp, err = client.CreatePost(context.Background(), post)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	post.ChannelId = th.BasicChannel.Id
	_, _, err = client.CreatePost(context.Background(), post)
	require.NoError(t, err)
}

func TestCreatePostAll(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "#hashtag a" + model.NewId() + "a"}

	user := model.User{Email: th.GenerateTestEmail(), Nickname: "Joram Wilander", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemUserRoleId}

	directChannel, _ := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)

	ruser, _, err := client.CreateUser(context.Background(), &user)
	require.NoError(t, err)

	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	_, resp, err := client.CreatePost(context.Background(), post)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, appErr := th.App.UpdateUserRoles(th.Context, ruser.Id, model.SystemUserRoleId+" "+model.SystemPostAllRoleId, false)
	require.Nil(t, appErr)
	appErr = th.App.Srv().InvalidateAllCaches()
	require.Nil(t, appErr)

	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	_, _, err = client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	post.ChannelId = th.BasicPrivateChannel.Id
	_, _, err = client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	post.ChannelId = directChannel.Id
	_, _, err = client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	_, appErr = th.App.UpdateUserRoles(th.Context, ruser.Id, model.SystemUserRoleId, false)
	require.Nil(t, appErr)
	_, appErr = th.App.JoinUserToTeam(th.Context, th.BasicTeam, ruser, "")
	require.Nil(t, appErr)
	_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, ruser.Id, model.TeamUserRoleId+" "+model.TeamPostAllRoleId)
	require.Nil(t, appErr)
	appErr = th.App.Srv().InvalidateAllCaches()
	require.Nil(t, appErr)

	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	post.ChannelId = th.BasicPrivateChannel.Id
	_, _, err = client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	post.ChannelId = th.BasicChannel.Id
	_, _, err = client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	post.ChannelId = directChannel.Id
	_, resp, err = client.CreatePost(context.Background(), post)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestCreatePostSendOutOfChannelMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	WebSocketClient, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	WebSocketClient.Listen()

	inChannelUser := th.CreateUser()
	th.LinkUserToTeam(inChannelUser, th.BasicTeam)
	_, appErr := th.App.AddUserToChannel(th.Context, inChannelUser, th.BasicChannel, false)
	require.Nil(t, appErr)

	post1 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "@" + inChannelUser.Username}
	_, resp, err := client.CreatePost(context.Background(), post1)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	timeout := time.After(5 * time.Second)
	waiting := true
	for waiting {
		select {
		case event := <-WebSocketClient.EventChannel:
			require.NotEqual(t, model.WebsocketEventEphemeralMessage, event.EventType(), "should not have ephemeral message event")
		case <-timeout:
			waiting = false
		}
	}

	outOfChannelUser := th.CreateUser()
	th.LinkUserToTeam(outOfChannelUser, th.BasicTeam)

	post2 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "@" + outOfChannelUser.Username}
	_, resp, err = client.CreatePost(context.Background(), post2)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	timeout = time.After(5 * time.Second)
	waiting = true
	for waiting {
		select {
		case event := <-WebSocketClient.EventChannel:
			if event.EventType() != model.WebsocketEventEphemeralMessage {
				// Ignore any other events
				continue
			}

			var wpost model.Post
			err := json.Unmarshal([]byte(event.GetData()["post"].(string)), &wpost)
			require.NoError(t, err)

			acm, ok := wpost.GetProp(model.PropsAddChannelMember).(map[string]any)
			require.True(t, ok, "should have received ephemeral post with 'add_channel_member' in props")
			require.True(t, acm["post_id"] != nil, "should not be nil")
			require.True(t, acm["user_ids"] != nil, "should not be nil")
			require.True(t, acm["usernames"] != nil, "should not be nil")
			waiting = false
		case <-timeout:
			require.FailNow(t, "timed out waiting for ephemeral message event")
		}
	}
}

func TestCreatePostCheckOnlineStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	api, err := Init(th.Server)
	require.NoError(t, err)
	session, _ := th.App.GetSession(th.Client.AuthToken)

	cli := th.CreateClient()
	_, _, err = cli.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
	require.NoError(t, err)

	wsClient, err := th.CreateWebSocketClientWithClient(cli)
	require.NoError(t, err)
	defer wsClient.Close()

	wsClient.Listen()

	waitForEvent := func(isSetOnline bool) {
		timeout := time.After(5 * time.Second)
		for {
			select {
			case ev := <-wsClient.EventChannel:
				if ev.EventType() == model.WebsocketEventPosted {
					assert.True(t, ev.GetData()["set_online"].(bool) == isSetOnline)
					return
				}
			case <-timeout:
				// We just skip the test instead of failing because waiting for more than 5 seconds
				// to get a response does not make sense, and it will unnecessarily slow down
				// the tests further in an already congested CI environment.
				t.Skip("timed out waiting for event")
			}
		}
	}

	handler := api.APIHandler(createPost)
	resp := httptest.NewRecorder()
	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "some message",
	}

	postJSON, jsonErr := json.Marshal(post)
	require.NoError(t, jsonErr)
	req := httptest.NewRequest("POST", "/api/v4/posts?set_online=false", bytes.NewReader(postJSON))
	req.Header.Set(model.HeaderAuth, "Bearer "+session.Token)

	handler.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusCreated, resp.Code)
	waitForEvent(false)

	_, appErr := th.App.GetStatus(th.BasicUser.Id)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.status.get.missing.app_error", appErr.Id)

	postJSON, jsonErr = json.Marshal(post)
	require.NoError(t, jsonErr)
	req = httptest.NewRequest("POST", "/api/v4/posts", bytes.NewReader(postJSON))
	req.Header.Set(model.HeaderAuth, "Bearer "+session.Token)

	handler.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusCreated, resp.Code)
	waitForEvent(true)

	st, appErr := th.App.GetStatus(th.BasicUser.Id)
	require.Nil(t, appErr)
	assert.Equal(t, "online", st.Status)
}

func TestUpdatePost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	channel := th.BasicChannel

	th.App.Srv().SetLicense(model.NewTestLicense())

	fileIds := make([]string, 3)
	data, err2 := testutils.ReadTestFile("test.png")
	require.NoError(t, err2)
	for i := 0; i < len(fileIds); i++ {
		fileResp, _, err := client.UploadFile(context.Background(), data, channel.Id, "test.png")
		require.NoError(t, err)
		fileIds[i] = fileResp.FileInfos[0].Id
	}

	rpost, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "zz" + model.NewId() + "a",
		FileIds:   fileIds,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	assert.Equal(t, rpost.Message, rpost.Message, "full name didn't match")
	assert.EqualValues(t, 0, rpost.EditAt, "Newly created post shouldn't have EditAt set")
	assert.Equal(t, model.StringArray(fileIds), rpost.FileIds, "FileIds should have been set")

	t.Run("same message, fewer files", func(t *testing.T) {
		msg := "zz" + model.NewId() + " update post"
		rpost.Message = msg
		rpost.UserId = ""

		rupost, _, err := client.UpdatePost(context.Background(), rpost.Id, &model.Post{
			Id:      rpost.Id,
			Message: rpost.Message,
			FileIds: fileIds[0:2], // one fewer file id
		})
		require.NoError(t, err)

		assert.Equal(t, rupost.Message, msg, "failed to updates")
		assert.NotEqual(t, 0, rupost.EditAt, "EditAt not updated for post")
		assert.Equal(t, model.StringArray(fileIds), rupost.FileIds, "FileIds should have not have been updated")

		actual, _, err := client.GetPost(context.Background(), rpost.Id, "")
		require.NoError(t, err)

		assert.Equal(t, actual.Message, msg, "failed to updates")
		assert.NotEqual(t, 0, actual.EditAt, "EditAt not updated for post")
		assert.Equal(t, model.StringArray(fileIds), actual.FileIds, "FileIds should have not have been updated")
	})

	t.Run("new message, invalid props", func(t *testing.T) {
		msg1 := "#hashtag a" + model.NewId() + " update post again"
		rpost.Message = msg1
		rpost.AddProp(model.PropsAddChannelMember, "no good")
		rrupost, _, err := client.UpdatePost(context.Background(), rpost.Id, rpost)
		require.NoError(t, err)

		assert.Equal(t, msg1, rrupost.Message, "failed to update message")
		assert.Equal(t, "#hashtag", rrupost.Hashtags, "failed to update hashtags")
		assert.Nil(t, rrupost.GetProp(model.PropsAddChannelMember), "failed to sanitize Props['add_channel_member'], should be nil")

		actual, _, err := client.GetPost(context.Background(), rpost.Id, "")
		require.NoError(t, err)

		assert.Equal(t, msg1, actual.Message, "failed to update message")
		assert.Equal(t, "#hashtag", actual.Hashtags, "failed to update hashtags")
		assert.Nil(t, actual.GetProp(model.PropsAddChannelMember), "failed to sanitize Props['add_channel_member'], should be nil")
	})

	t.Run("join/leave post", func(t *testing.T) {
		var rpost2 *model.Post
		rpost2, appErr = th.App.CreatePost(th.Context, &model.Post{
			ChannelId: channel.Id,
			Message:   "zz" + model.NewId() + "a",
			Type:      model.PostTypeJoinLeave,
			UserId:    th.BasicUser.Id,
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		up2 := &model.Post{
			Id:        rpost2.Id,
			ChannelId: channel.Id,
			Message:   "zz" + model.NewId() + " update post 2",
		}
		_, resp, err := client.UpdatePost(context.Background(), rpost2.Id, up2)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	rpost3, appErr := th.App.CreatePost(th.Context, &model.Post{
		ChannelId: channel.Id,
		Message:   "zz" + model.NewId() + "a",
		UserId:    th.BasicUser.Id,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	t.Run("new message, add files", func(t *testing.T) {
		up3 := &model.Post{
			Id:        rpost3.Id,
			ChannelId: channel.Id,
			Message:   "zz" + model.NewId() + " update post 3",
			FileIds:   fileIds[0:2],
		}
		rrupost3, _, err := client.UpdatePost(context.Background(), rpost3.Id, up3)
		require.NoError(t, err)
		assert.Empty(t, rrupost3.FileIds)

		actual, _, err := client.GetPost(context.Background(), rpost.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StringArray(fileIds), actual.FileIds)
	})

	t.Run("add slack attachments", func(t *testing.T) {
		up4 := &model.Post{
			Id:        rpost3.Id,
			ChannelId: channel.Id,
			Message:   "zz" + model.NewId() + " update post 3",
		}
		up4.AddProp("attachments", []model.SlackAttachment{
			{
				Text: "Hello World",
			},
		})
		rrupost3, _, err := client.UpdatePost(context.Background(), rpost3.Id, up4)
		require.NoError(t, err)
		assert.NotEqual(t, rpost3.EditAt, rrupost3.EditAt)
		assert.NotEqual(t, rpost3.Attachments(), rrupost3.Attachments())
	})

	t.Run("change message, but post too old", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostEditTimeLimit = 1
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostEditTimeLimit = -1
		})

		rpost4, appErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: channel.Id,
			Message:   "zz" + model.NewId() + "a",
			UserId:    th.BasicUser.Id,
			CreateAt:  model.GetMillis() - 2000,
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		up4 := &model.Post{
			Id:        rpost4.Id,
			ChannelId: channel.Id,
			Message:   "zz" + model.NewId() + " update post 4",
		}
		_, resp, err := client.UpdatePost(context.Background(), rpost4.Id, up4)
		require.Error(t, err, "should fail on update old post")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("err with integrations-reserved props", func(t *testing.T) {
		originalHardenedModeSetting := *th.App.Config().ServiceSettings.ExperimentalEnableHardenedMode
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableHardenedMode = true
		})

		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableHardenedMode = originalHardenedModeSetting
		})

		_, resp, err := client.UpdatePost(context.Background(), rpost.Id, &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "with props",
			Props:     model.StringInterface{model.PostPropsFromWebhook: "true"},
		})

		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("logged out", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, resp, err := client.UpdatePost(context.Background(), rpost.Id, rpost)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("different user", func(t *testing.T) {
		th.LoginBasic2()
		_, resp, err := client.UpdatePost(context.Background(), rpost.Id, rpost)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, err = client.Logout(context.Background())
		require.NoError(t, err)
	})

	t.Run("different user, but team admin", func(t *testing.T) {
		th.LoginTeamAdmin()
		_, resp, err := client.UpdatePost(context.Background(), rpost.Id, rpost)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, err = client.Logout(context.Background())
		require.NoError(t, err)
	})

	t.Run("different user, but system admin", func(t *testing.T) {
		_, _, err := th.SystemAdminClient.UpdatePost(context.Background(), rpost.Id, rpost)
		require.NoError(t, err)
	})
}

func TestUpdateOthersPostInDirectMessageChannel(t *testing.T) {
	// This test checks that a sysadmin with the "EDIT_OTHERS_POSTS" permission can edit someone else's post in a
	// channel without a team (DM/GM). This indirectly checks for the proper cascading all the way to system-wide roles
	// on the user object of permissions based on a post in a channel with no team ID.
	th := Setup(t).InitBasic()
	defer th.TearDown()

	dmChannel := th.CreateDmChannel(th.SystemAdminUser)

	post := &model.Post{
		Message:       "asd",
		ChannelId:     dmChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		CreateAt:      0,
	}

	post, _, err := th.Client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	post.Message = "changed"
	_, _, err = th.SystemAdminClient.UpdatePost(context.Background(), post.Id, post)
	require.NoError(t, err)
}

func TestPatchPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	channel := th.BasicChannel

	th.App.Srv().SetLicense(model.NewTestLicense())

	fileIDs := make([]string, 3)
	data, err2 := testutils.ReadTestFile("test.png")
	require.NoError(t, err2)
	for i := 0; i < len(fileIDs); i++ {
		fileResp, _, err := client.UploadFile(context.Background(), data, channel.Id, "test.png")
		require.NoError(t, err)
		fileIDs[i] = fileResp.FileInfos[0].Id
	}
	sort.Strings(fileIDs)

	post := &model.Post{
		ChannelId:    channel.Id,
		IsPinned:     true,
		Message:      "#hashtag a message",
		Props:        model.StringInterface{"channel_header": "old_header"},
		FileIds:      fileIDs[0:2],
		HasReactions: true,
	}
	post, _, err := client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	var rpost *model.Post
	t.Run("new message, props, files, HasReactions bit", func(t *testing.T) {
		patch := &model.PostPatch{}

		patch.IsPinned = model.NewPointer(false)
		patch.Message = model.NewPointer("#otherhashtag other message")
		patch.Props = &model.StringInterface{"channel_header": "new_header"}
		patchFileIds := model.StringArray(fileIDs) // one extra file
		patch.FileIds = &patchFileIds
		patch.HasReactions = model.NewPointer(false)

		rpost, _, err = client.PatchPost(context.Background(), post.Id, patch)
		require.NoError(t, err)

		assert.False(t, rpost.IsPinned, "IsPinned did not update properly")
		assert.Equal(t, "#otherhashtag other message", rpost.Message, "Message did not update properly")
		assert.Equal(t, *patch.Props, rpost.GetProps(), "Props did not update properly")
		assert.Equal(t, "#otherhashtag", rpost.Hashtags, "Message did not update properly")
		assert.Equal(t, model.StringArray(fileIDs[0:2]), rpost.FileIds, "FileIds should not update")
		assert.False(t, rpost.HasReactions, "HasReactions did not update properly")
	})

	t.Run("add slack attachments", func(t *testing.T) {
		patch2 := &model.PostPatch{}
		attachments := []model.SlackAttachment{
			{
				Text: "Hello World",
			},
		}
		patch2.Props = &model.StringInterface{"attachments": attachments}

		var rpost2 *model.Post
		rpost2, _, err = client.PatchPost(context.Background(), post.Id, patch2)
		require.NoError(t, err)
		assert.NotEmpty(t, rpost2.GetProp("attachments"))
		assert.NotEqual(t, rpost.EditAt, rpost2.EditAt)
	})

	t.Run("invalid requests", func(t *testing.T) {
		var origEnableDeveloper bool
		th.App.UpdateConfig(func(cfg *model.Config) {
			origEnableDeveloper = *cfg.ServiceSettings.EnableDeveloper
			*cfg.ServiceSettings.EnableDeveloper = true
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableDeveloper = origEnableDeveloper
		})

		var r *http.Response
		r, err = client.DoAPIPut(context.Background(), "/posts/"+post.Id+"/patch", "garbage")
		require.EqualError(t, err, "Invalid or missing post in request body., invalid character 'g' looking for beginning of value")
		require.Equal(t, http.StatusBadRequest, r.StatusCode, "wrong status code")

		var resp *model.Response
		patch := &model.PostPatch{}
		_, resp, err = client.PatchPost(context.Background(), "junk", patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unknown post", func(t *testing.T) {
		var resp *model.Response
		patch := &model.PostPatch{}
		_, resp, err = client.PatchPost(context.Background(), GenerateTestID(), patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("logged out", func(t *testing.T) {
		_, err = client.Logout(context.Background())
		require.NoError(t, err)
		patch := &model.PostPatch{}
		_, resp, err := client.PatchPost(context.Background(), post.Id, patch)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("different user", func(t *testing.T) {
		th.LoginBasic2()
		patch := &model.PostPatch{}
		_, resp, err := client.PatchPost(context.Background(), post.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("different user, but team admin", func(t *testing.T) {
		th.LoginTeamAdmin()
		patch := &model.PostPatch{}
		_, resp, err := client.PatchPost(context.Background(), post.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("different user, but system admin", func(t *testing.T) {
		patch := &model.PostPatch{}
		_, _, err := th.SystemAdminClient.PatchPost(context.Background(), post.Id, patch)
		require.NoError(t, err)
	})

	t.Run("edit others posts permission can function independently of edit own post", func(t *testing.T) {
		th.LoginBasic2()
		patch := &model.PostPatch{}
		_, resp, err := client.PatchPost(context.Background(), post.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Add permission to edit others'
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.RemovePermissionFromRole(model.PermissionEditPost.Id, model.ChannelUserRoleId)
		th.AddPermissionToRole(model.PermissionEditOthersPosts.Id, model.ChannelUserRoleId)

		_, _, err = client.PatchPost(context.Background(), post.Id, patch)
		require.NoError(t, err)
	})

	t.Run("time limit expired", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostEditTimeLimit = 1
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostEditTimeLimit = -1
		})

		post2 := &model.Post{
			ChannelId: channel.Id,
			Message:   "#hashtag a message",
			CreateAt:  model.GetMillis() - 2000,
		}
		post2, _, err := th.SystemAdminClient.CreatePost(context.Background(), post2)
		require.NoError(t, err)

		patch2 := &model.PostPatch{
			Message: model.NewPointer("new message"),
		}
		_, resp, err := th.SystemAdminClient.PatchPost(context.Background(), post2.Id, patch2)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Equal(t, "api.post.update_post.permissions_time_limit.app_error", err.(*model.AppError).Id, "should be time limit error")
	})

	t.Run("err with integrations-reserved props", func(t *testing.T) {
		originalHardenedModeSetting := *th.App.Config().ServiceSettings.ExperimentalEnableHardenedMode
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableHardenedMode = true
		})

		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableHardenedMode = originalHardenedModeSetting
		})

		post := &model.Post{
			ChannelId: channel.Id,
			Message:   "#hashtag a message",
			CreateAt:  model.GetMillis() - 2000,
		}
		post, _, createErr := th.SystemAdminClient.CreatePost(context.Background(), post)
		require.NoError(t, createErr)

		patch := &model.PostPatch{}
		patch.Props = &model.StringInterface{model.PostPropsFromWebhook: "true"}
		_, patchResp, patchErr := client.PatchPost(context.Background(), post.Id, patch)

		require.Error(t, patchErr)
		CheckBadRequestStatus(t, patchResp)
	})
}

func TestPinPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post := th.BasicPost
	_, err := client.PinPost(context.Background(), post.Id)
	require.NoError(t, err)

	rpost, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
	require.Nil(t, appErr)
	require.True(t, rpost.IsPinned, "failed to pin post")

	resp, err := client.PinPost(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.PinPost(context.Background(), GenerateTestID())
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	resp, err = client.PinPost(context.Background(), post.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, err = th.SystemAdminClient.PinPost(context.Background(), post.Id)
	require.NoError(t, err)
}

func TestUnpinPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	pinnedPost := th.CreatePinnedPost()
	_, err := client.UnpinPost(context.Background(), pinnedPost.Id)
	require.NoError(t, err)

	rpost, appErr := th.App.GetSinglePost(th.Context, pinnedPost.Id, false)
	require.Nil(t, appErr)
	require.False(t, rpost.IsPinned)

	resp, err := client.UnpinPost(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.UnpinPost(context.Background(), GenerateTestID())
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	resp, err = client.UnpinPost(context.Background(), pinnedPost.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, err = th.SystemAdminClient.UnpinPost(context.Background(), pinnedPost.Id)
	require.NoError(t, err)
}

func TestGetPostsForChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post1 := th.CreatePost()
	post2 := th.CreatePost()
	post3 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a", RootId: post1.Id}
	post3, _, _ = client.CreatePost(context.Background(), post3)

	time.Sleep(300 * time.Millisecond)
	since := model.GetMillis()
	time.Sleep(300 * time.Millisecond)

	post4 := th.CreatePost()

	th.TestForAllClients(t, func(t *testing.T, c *model.Client4) {
		posts, resp, err := c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 60, "", false, false)
		require.NoError(t, err)
		require.Equal(t, post4.Id, posts.Order[0], "wrong order")
		require.Equal(t, post3.Id, posts.Order[1], "wrong order")
		require.Equal(t, post2.Id, posts.Order[2], "wrong order")
		require.Equal(t, post1.Id, posts.Order[3], "wrong order")

		require.Nil(t, posts.HasNext, "HasNext should not be returned")

		posts, resp, _ = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 3, resp.Etag, false, false)
		CheckEtag(t, posts, resp)

		posts, _, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 3, "", false, false)
		require.NoError(t, err)
		require.Len(t, posts.Order, 3, "wrong number returned")

		_, ok := posts.Posts[post3.Id]
		require.True(t, ok, "missing comment")
		_, ok = posts.Posts[post1.Id]
		require.True(t, ok, "missing root post")

		posts, _, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 1, 1, "", false, false)
		require.NoError(t, err)
		require.Equal(t, post3.Id, posts.Order[0], "wrong order")

		posts, _, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 10000, 10000, "", false, false)
		require.NoError(t, err)
		require.Empty(t, posts.Order, "should be no posts")
	})

	post5 := th.CreatePost()

	th.TestForAllClients(t, func(t *testing.T, c *model.Client4) {
		posts, _, err := c.GetPostsSince(context.Background(), th.BasicChannel.Id, since, false)
		require.NoError(t, err)
		require.Len(t, posts.Posts, 2, "should return 2 posts")

		// "since" query to return empty NextPostId and PrevPostId
		require.Equal(t, "", posts.NextPostId, "should return an empty NextPostId")
		require.Equal(t, "", posts.PrevPostId, "should return an empty PrevPostId")

		found := make([]bool, 2)
		for _, p := range posts.Posts {
			require.LessOrEqual(t, since, p.CreateAt, "bad create at for post returned")

			if p.Id == post4.Id {
				found[0] = true
			} else if p.Id == post5.Id {
				found[1] = true
			}
		}
		for _, f := range found {
			require.True(t, f, "missing post")
		}

		_, resp, err := c.GetPostsForChannel(context.Background(), "", 0, 60, "", false, false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = c.GetPostsForChannel(context.Background(), "junk", 0, 60, "", false, false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	_, resp, err := client.GetPostsForChannel(context.Background(), model.NewId(), 0, 60, "", false, false)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetPostsForChannel(context.Background(), model.NewId(), 0, 60, "", false, false)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// more tests for next_post_id, prev_post_id, and order
	// There are 12 posts composed of first 2 system messages and 10 created posts
	_, _, err = client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
	require.NoError(t, err)
	th.CreatePost() // post6
	post7 := th.CreatePost()
	post8 := th.CreatePost()
	th.CreatePost() // post9
	post10 := th.CreatePost()

	var posts *model.PostList
	th.TestForAllClients(t, func(t *testing.T, c *model.Client4) {
		// get the system post IDs posted before the created posts above
		posts, _, err = c.GetPostsBefore(context.Background(), th.BasicChannel.Id, post1.Id, 0, 2, "", false, false)
		require.NoError(t, err)
		systemPostId1 := posts.Order[1]

		// similar to '/posts'
		posts, _, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 60, "", false, false)
		require.NoError(t, err)
		require.Len(t, posts.Order, 12, "expected 12 posts")
		require.Equal(t, post10.Id, posts.Order[0], "posts not in order")
		require.Equal(t, systemPostId1, posts.Order[11], "posts not in order")
		require.Equal(t, "", posts.NextPostId, "should return an empty NextPostId")
		require.Equal(t, "", posts.PrevPostId, "should return an empty PrevPostId")

		// similar to '/posts?per_page=3'
		posts, _, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 3, "", false, false)
		require.NoError(t, err)
		require.Len(t, posts.Order, 3, "expected 3 posts")
		require.Equal(t, post10.Id, posts.Order[0], "posts not in order")
		require.Equal(t, post8.Id, posts.Order[2], "should return 3 posts and match order")
		require.Equal(t, "", posts.NextPostId, "should return an empty NextPostId")
		require.Equal(t, post7.Id, posts.PrevPostId, "should return post7.Id as PrevPostId")

		// similar to '/posts?per_page=3&page=1'
		posts, _, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 1, 3, "", false, false)
		require.NoError(t, err)
		require.Len(t, posts.Order, 3, "expected 3 posts")
		require.Equal(t, post7.Id, posts.Order[0], "posts not in order")
		require.Equal(t, post5.Id, posts.Order[2], "posts not in order")
		require.Equal(t, post8.Id, posts.NextPostId, "should return post8.Id as NextPostId")
		require.Equal(t, post4.Id, posts.PrevPostId, "should return post4.Id as PrevPostId")

		// similar to '/posts?per_page=3&page=2'
		posts, _, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 2, 3, "", false, false)
		require.NoError(t, err)
		require.Len(t, posts.Order, 3, "expected 3 posts")
		require.Equal(t, post4.Id, posts.Order[0], "posts not in order")
		require.Equal(t, post2.Id, posts.Order[2], "should return 3 posts and match order")
		require.Equal(t, post5.Id, posts.NextPostId, "should return post5.Id as NextPostId")
		require.Equal(t, post1.Id, posts.PrevPostId, "should return post1.Id as PrevPostId")

		// similar to '/posts?per_page=3&page=3'
		posts, _, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 3, 3, "", false, false)
		require.NoError(t, err)
		require.Len(t, posts.Order, 3, "expected 3 posts")
		require.Equal(t, post1.Id, posts.Order[0], "posts not in order")
		require.Equal(t, systemPostId1, posts.Order[2], "should return 3 posts and match order")
		require.Equal(t, post2.Id, posts.NextPostId, "should return post2.Id as NextPostId")
		require.Equal(t, "", posts.PrevPostId, "should return an empty PrevPostId")

		// similar to '/posts?per_page=3&page=4'
		posts, _, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 4, 3, "", false, false)
		require.NoError(t, err)
		require.Empty(t, posts.Order, "should return 0 post")
		require.Equal(t, "", posts.NextPostId, "should return an empty NextPostId")
		require.Equal(t, "", posts.PrevPostId, "should return an empty PrevPostId")
	})

	th.TestForAllClients(t, func(t *testing.T, c *model.Client4) {
		channel := th.CreatePublicChannel()
		th.CreatePostWithClient(th.SystemAdminClient, channel)
		_, err = th.SystemAdminClient.DeleteChannel(context.Background(), channel.Id)
		require.NoError(t, err)

		experimentalViewArchivedChannels := *th.App.Config().TeamSettings.ExperimentalViewArchivedChannels
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalViewArchivedChannels = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.ExperimentalViewArchivedChannels = experimentalViewArchivedChannels
		})

		// the endpoint should work fine when viewing archived channels is enabled
		_, _, err = c.GetPostsForChannel(context.Background(), channel.Id, 0, 10, "", false, false)
		require.NoError(t, err)

		// the endpoint should return forbidden if viewing archived channels is disabled
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalViewArchivedChannels = false })
		_, resp, err = c.GetPostsForChannel(context.Background(), channel.Id, 0, 10, "", false, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	}, "Should forbid to retrieve posts if the channel is archived and users are not allowed to view archived messages")

	_, err = client.DeletePost(context.Background(), post10.Id)
	require.NoError(t, err)
	_, err = client.DeletePost(context.Background(), post8.Id)
	require.NoError(t, err)

	// include deleted posts for non-admin users.
	_, resp, err = client.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 100, "", false, true)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		// include deleted posts for admin users.
		posts, resp, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 100, "", false, true)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, posts.Order, 12, "expected 12 posts")

		// not include deleted posts for admin users.
		posts, resp, err = c.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 100, "", false, false)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, posts.Order, 10, "expected 10 posts")
	})
}

func TestGetFlaggedPostsForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	user := th.BasicUser
	team1 := th.BasicTeam
	channel1 := th.BasicChannel
	post1 := th.CreatePost()
	channel2 := th.CreatePublicChannel()
	post2 := th.CreatePostWithClient(client, channel2)

	preference := model.Preference{
		UserId:   user.Id,
		Category: model.PreferenceCategoryFlaggedPost,
		Name:     post1.Id,
		Value:    "true",
	}
	_, err := client.UpdatePreferences(context.Background(), user.Id, model.Preferences{preference})
	require.NoError(t, err)
	preference.Name = post2.Id
	_, err = client.UpdatePreferences(context.Background(), user.Id, model.Preferences{preference})
	require.NoError(t, err)

	opl := model.NewPostList()
	opl.AddPost(post1)
	opl.AddOrder(post1.Id)

	rpl, _, err := client.GetFlaggedPostsForUserInChannel(context.Background(), user.Id, channel1.Id, 0, 10)
	require.NoError(t, err)

	require.Len(t, rpl.Posts, 1, "should have returned 1 post")
	require.Equal(t, opl.Posts, rpl.Posts, "posts should have matched")

	rpl, _, err = client.GetFlaggedPostsForUserInChannel(context.Background(), user.Id, channel1.Id, 0, 1)
	require.NoError(t, err)
	require.Len(t, rpl.Posts, 1, "should have returned 1 post")

	rpl, _, err = client.GetFlaggedPostsForUserInChannel(context.Background(), user.Id, channel1.Id, 1, 1)
	require.NoError(t, err)
	require.Empty(t, rpl.Posts)

	rpl, _, err = client.GetFlaggedPostsForUserInChannel(context.Background(), user.Id, GenerateTestID(), 0, 10)
	require.NoError(t, err)
	require.Empty(t, rpl.Posts)

	rpl, _, err = client.GetFlaggedPostsForUserInChannel(context.Background(), user.Id, "junk", 0, 10)
	require.Error(t, err)
	require.Nil(t, rpl)

	opl.AddPost(post2)
	opl.AddOrder(post2.Id)

	rpl, _, err = client.GetFlaggedPostsForUserInTeam(context.Background(), user.Id, team1.Id, 0, 10)
	require.NoError(t, err)
	require.Len(t, rpl.Posts, 2, "should have returned 2 posts")
	require.Equal(t, opl.Posts, rpl.Posts, "posts should have matched")

	rpl, _, err = client.GetFlaggedPostsForUserInTeam(context.Background(), user.Id, team1.Id, 0, 1)
	require.NoError(t, err)
	require.Len(t, rpl.Posts, 1, "should have returned 1 post")

	rpl, _, err = client.GetFlaggedPostsForUserInTeam(context.Background(), user.Id, team1.Id, 1, 1)
	require.NoError(t, err)
	require.Len(t, rpl.Posts, 1, "should have returned 1 post")

	rpl, _, err = client.GetFlaggedPostsForUserInTeam(context.Background(), user.Id, team1.Id, 1000, 10)
	require.NoError(t, err)
	require.Empty(t, rpl.Posts)

	rpl, _, err = client.GetFlaggedPostsForUserInTeam(context.Background(), user.Id, GenerateTestID(), 0, 10)
	require.NoError(t, err)
	require.Empty(t, rpl.Posts)

	rpl, _, err = client.GetFlaggedPostsForUserInTeam(context.Background(), user.Id, "junk", 0, 10)
	require.Error(t, err)
	require.Nil(t, rpl)

	channel3 := th.CreatePrivateChannel()
	post4 := th.CreatePostWithClient(client, channel3)

	preference.Name = post4.Id
	_, err = client.UpdatePreferences(context.Background(), user.Id, model.Preferences{preference})
	require.NoError(t, err)

	opl.AddPost(post4)
	opl.AddOrder(post4.Id)

	rpl, _, err = client.GetFlaggedPostsForUser(context.Background(), user.Id, 0, 10)
	require.NoError(t, err)
	require.Len(t, rpl.Posts, 3, "should have returned 3 posts")
	require.Equal(t, opl.Posts, rpl.Posts, "posts should have matched")

	rpl, _, err = client.GetFlaggedPostsForUser(context.Background(), user.Id, 0, 2)
	require.NoError(t, err)
	require.Len(t, rpl.Posts, 2, "should have returned 2 posts")

	rpl, _, err = client.GetFlaggedPostsForUser(context.Background(), user.Id, 2, 2)
	require.NoError(t, err)
	require.Len(t, rpl.Posts, 1, "should have returned 1 post")

	rpl, _, err = client.GetFlaggedPostsForUser(context.Background(), user.Id, 1000, 10)
	require.NoError(t, err)
	require.Empty(t, rpl.Posts)

	channel4 := th.CreateChannelWithClient(th.SystemAdminClient, model.ChannelTypePrivate)
	post5 := th.CreatePostWithClient(th.SystemAdminClient, channel4)

	preference.Name = post5.Id
	resp, err := client.UpdatePreferences(context.Background(), user.Id, model.Preferences{preference})
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	rpl, _, err = client.GetFlaggedPostsForUser(context.Background(), user.Id, 0, 10)
	require.NoError(t, err)
	require.Len(t, rpl.Posts, 3, "should have returned 3 posts")
	require.Equal(t, opl.Posts, rpl.Posts, "posts should have matched")

	th.AddUserToChannel(user, channel4)
	_, err = client.UpdatePreferences(context.Background(), user.Id, model.Preferences{preference})
	require.NoError(t, err)

	rpl, _, err = client.GetFlaggedPostsForUser(context.Background(), user.Id, 0, 10)
	require.NoError(t, err)

	opl.AddPost(post5)
	opl.AddOrder(post5.Id)
	require.Len(t, rpl.Posts, 4, "should have returned 4 posts")
	require.Equal(t, opl.Posts, rpl.Posts, "posts should have matched")

	appErr := th.App.RemoveUserFromChannel(th.Context, user.Id, "", channel4)
	assert.Nil(t, appErr, "unable to remove user from channel")

	rpl, _, err = client.GetFlaggedPostsForUser(context.Background(), user.Id, 0, 10)
	require.NoError(t, err)

	opl2 := model.NewPostList()
	opl2.AddPost(post1)
	opl2.AddOrder(post1.Id)
	opl2.AddPost(post2)
	opl2.AddOrder(post2.Id)
	opl2.AddPost(post4)
	opl2.AddOrder(post4.Id)

	require.Len(t, rpl.Posts, 3, "should have returned 3 posts")
	require.Equal(t, opl2.Posts, rpl.Posts, "posts should have matched")

	_, resp, err = client.GetFlaggedPostsForUser(context.Background(), "junk", 0, 10)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetFlaggedPostsForUser(context.Background(), GenerateTestID(), 0, 10)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err = client.GetFlaggedPostsForUserInChannel(context.Background(), user.Id, channel1.Id, 0, 10)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, resp, err = client.GetFlaggedPostsForUserInTeam(context.Background(), user.Id, team1.Id, 0, 10)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, resp, err = client.GetFlaggedPostsForUser(context.Background(), user.Id, 0, 10)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetFlaggedPostsForUserInChannel(context.Background(), user.Id, channel1.Id, 0, 10)
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetFlaggedPostsForUserInTeam(context.Background(), user.Id, team1.Id, 0, 10)
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetFlaggedPostsForUser(context.Background(), user.Id, 0, 10)
	require.NoError(t, err)

	mockStore := mocks.Store{}
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetFlaggedPosts", mock.AnythingOfType("string"), mock.AnythingOfType("int"), mock.AnythingOfType("int")).Return(nil, errors.New("some-error"))
	mockPostStore.On("ClearCaches").Return()
	mockStore.On("Team").Return(th.App.Srv().Store().Team())
	mockStore.On("Channel").Return(th.App.Srv().Store().Channel())
	mockStore.On("User").Return(th.App.Srv().Store().User())
	mockStore.On("Scheme").Return(th.App.Srv().Store().Scheme())
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("FileInfo").Return(th.App.Srv().Store().FileInfo())
	mockStore.On("Webhook").Return(th.App.Srv().Store().Webhook())
	mockStore.On("System").Return(th.App.Srv().Store().System())
	mockStore.On("License").Return(th.App.Srv().Store().License())
	mockStore.On("Role").Return(th.App.Srv().Store().Role())
	mockStore.On("Close").Return(nil)

	// Playbooks DB job requires a plugin mock
	pluginStore := mocks.PluginStore{}
	pluginStore.On("List", mock.Anything, mock.Anything, mock.Anything).Return([]string{}, nil)
	mockStore.On("Plugin").Return(&pluginStore)

	th.App.Srv().SetStore(&mockStore)

	_, resp, err = th.SystemAdminClient.GetFlaggedPostsForUser(context.Background(), user.Id, 0, 10)
	require.Error(t, err)
	CheckInternalErrorStatus(t, resp)
}

func TestGetPostsBefore(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post1 := th.CreatePost()
	post2 := th.CreatePost()
	post3 := th.CreatePost()
	post4 := th.CreatePost()
	post5 := th.CreatePost()

	posts, _, err := client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post3.Id, 0, 100, "", false, false)
	require.NoError(t, err)

	found := make([]bool, 2)
	for _, p := range posts.Posts {
		if p.Id == post1.Id {
			found[0] = true
		} else if p.Id == post2.Id {
			found[1] = true
		}

		require.NotEqual(t, post4.Id, p.Id, "returned posts after")
		require.NotEqual(t, post5.Id, p.Id, "returned posts after")
	}

	for _, f := range found {
		require.True(t, f, "missing post")
	}

	require.Equal(t, post3.Id, posts.NextPostId, "should match NextPostId")
	require.Equal(t, "", posts.PrevPostId, "should match empty PrevPostId")

	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post4.Id, 1, 1, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Posts, 1, "too many posts returned")
	require.Equal(t, post2.Id, posts.Order[0], "should match returned post")
	require.Equal(t, post3.Id, posts.NextPostId, "should match NextPostId")
	require.Equal(t, post1.Id, posts.PrevPostId, "should match PrevPostId")

	_, resp, err := client.GetPostsBefore(context.Background(), th.BasicChannel.Id, "junk", 1, 1, "", false, false)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post5.Id, 0, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Posts, 3, "should match length of posts returned")
	require.Equal(t, post4.Id, posts.Order[0], "should match returned post")
	require.Equal(t, post2.Id, posts.Order[2], "should match returned post")
	require.Equal(t, post5.Id, posts.NextPostId, "should match NextPostId")
	require.Equal(t, post1.Id, posts.PrevPostId, "should match PrevPostId")

	// get the system post IDs posted before the created posts above
	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post1.Id, 0, 2, "", false, false)
	require.NoError(t, err)
	systemPostId2 := posts.Order[0]
	systemPostId1 := posts.Order[1]

	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post5.Id, 1, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Posts, 3, "should match length of posts returned")
	require.Equal(t, post1.Id, posts.Order[0], "should match returned post")
	require.Equal(t, systemPostId2, posts.Order[1], "should match returned post")
	require.Equal(t, systemPostId1, posts.Order[2], "should match returned post")
	require.Equal(t, post2.Id, posts.NextPostId, "should match NextPostId")
	require.Equal(t, "", posts.PrevPostId, "should return empty PrevPostId")

	// more tests for next_post_id, prev_post_id, and order
	// There are 12 posts composed of first 2 system messages and 10 created posts
	post6 := th.CreatePost()
	th.CreatePost() // post7
	post8 := th.CreatePost()
	post9 := th.CreatePost()
	post10 := th.CreatePost() // post10

	// similar to '/posts?before=post9'
	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post9.Id, 0, 60, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 10, "expected 10 posts")
	require.Equal(t, post8.Id, posts.Order[0], "posts not in order")
	require.Equal(t, systemPostId1, posts.Order[9], "posts not in order")
	require.Equal(t, post9.Id, posts.NextPostId, "should return post9.Id as NextPostId")
	require.Equal(t, "", posts.PrevPostId, "should return an empty PrevPostId")

	// similar to '/posts?before=post9&per_page=3'
	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post9.Id, 0, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 3, "expected 3 posts")
	require.Equal(t, post8.Id, posts.Order[0], "posts not in order")
	require.Equal(t, post6.Id, posts.Order[2], "should return 3 posts and match order")
	require.Equal(t, post9.Id, posts.NextPostId, "should return post9.Id as NextPostId")
	require.Equal(t, post5.Id, posts.PrevPostId, "should return post5.Id as PrevPostId")

	// similar to '/posts?before=post9&per_page=3&page=1'
	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post9.Id, 1, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 3, "expected 3 posts")
	require.Equal(t, post5.Id, posts.Order[0], "posts not in order")
	require.Equal(t, post3.Id, posts.Order[2], "posts not in order")
	require.Equal(t, post6.Id, posts.NextPostId, "should return post6.Id as NextPostId")
	require.Equal(t, post2.Id, posts.PrevPostId, "should return post2.Id as PrevPostId")

	// similar to '/posts?before=post9&per_page=3&page=2'
	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post9.Id, 2, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 3, "expected 3 posts")
	require.Equal(t, post2.Id, posts.Order[0], "posts not in order")
	require.Equal(t, systemPostId2, posts.Order[2], "posts not in order")
	require.Equal(t, post3.Id, posts.NextPostId, "should return post3.Id as NextPostId")
	require.Equal(t, systemPostId1, posts.PrevPostId, "should return systemPostId1 as PrevPostId")

	// similar to '/posts?before=post1&per_page=3'
	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post1.Id, 0, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 2, "expected 2 posts")
	require.Equal(t, systemPostId2, posts.Order[0], "posts not in order")
	require.Equal(t, systemPostId1, posts.Order[1], "posts not in order")
	require.Equal(t, post1.Id, posts.NextPostId, "should return post1.Id as NextPostId")
	require.Equal(t, "", posts.PrevPostId, "should return an empty PrevPostId")

	// similar to '/posts?before=systemPostId1'
	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, systemPostId1, 0, 60, "", false, false)
	require.NoError(t, err)
	require.Empty(t, posts.Order, "should return 0 post")
	require.Equal(t, systemPostId1, posts.NextPostId, "should return systemPostId1 as NextPostId")
	require.Equal(t, "", posts.PrevPostId, "should return an empty PrevPostId")

	// similar to '/posts?before=systemPostId1&per_page=60&page=1'
	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, systemPostId1, 1, 60, "", false, false)
	require.NoError(t, err)
	require.Empty(t, posts.Order, "should return 0 posts")
	require.Equal(t, "", posts.NextPostId, "should return an empty NextPostId")
	require.Equal(t, "", posts.PrevPostId, "should return an empty PrevPostId")

	// similar to '/posts?before=non-existent-post'
	nonExistentPostId := model.NewId()
	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, nonExistentPostId, 0, 60, "", false, false)
	require.NoError(t, err)
	require.Empty(t, posts.Order, "should return 0 post")
	require.Equal(t, nonExistentPostId, posts.NextPostId, "should return nonExistentPostId as NextPostId")
	require.Equal(t, "", posts.PrevPostId, "should return an empty PrevPostId")

	_, err = client.DeletePost(context.Background(), post9.Id)
	require.NoError(t, err)
	_, err = client.DeletePost(context.Background(), post8.Id)
	require.NoError(t, err)

	// include deleted posts for non-admin users.
	_, resp, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post9.Id, 0, 60, "", false, true)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		// include deleted posts for admin users.
		posts, resp, err = c.GetPostsBefore(context.Background(), th.BasicChannel.Id, post10.Id, 0, 60, "", false, true)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, posts.Order, 11, "expected 11 posts")

		// not include deleted posts for admin users.
		posts, resp, err = c.GetPostsBefore(context.Background(), th.BasicChannel.Id, post10.Id, 0, 60, "", false, false)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, posts.Order, 9, "expected 9 posts")
	})
}

func TestGetPostsAfter(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post1 := th.CreatePost()
	post2 := th.CreatePost()
	post3 := th.CreatePost()
	post4 := th.CreatePost()
	post5 := th.CreatePost()

	posts, _, err := client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post3.Id, 0, 100, "", false, false)
	require.NoError(t, err)

	found := make([]bool, 2)
	for _, p := range posts.Posts {
		if p.Id == post4.Id {
			found[0] = true
		} else if p.Id == post5.Id {
			found[1] = true
		}
		require.NotEqual(t, post1.Id, p.Id, "returned posts before")
		require.NotEqual(t, post2.Id, p.Id, "returned posts before")
	}

	for _, f := range found {
		require.True(t, f, "missing post")
	}
	require.Equal(t, "", posts.NextPostId, "should match empty NextPostId")
	require.Equal(t, post3.Id, posts.PrevPostId, "should match PrevPostId")

	posts, _, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post2.Id, 1, 1, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Posts, 1, "too many posts returned")
	require.Equal(t, post4.Id, posts.Order[0], "should match returned post")
	require.Equal(t, post5.Id, posts.NextPostId, "should match NextPostId")
	require.Equal(t, post3.Id, posts.PrevPostId, "should match PrevPostId")

	_, resp, err := client.GetPostsAfter(context.Background(), th.BasicChannel.Id, "junk", 1, 1, "", false, false)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	posts, _, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post1.Id, 0, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Posts, 3, "should match length of posts returned")
	require.Equal(t, post4.Id, posts.Order[0], "should match returned post")
	require.Equal(t, post2.Id, posts.Order[2], "should match returned post")
	require.Equal(t, post5.Id, posts.NextPostId, "should match NextPostId")
	require.Equal(t, post1.Id, posts.PrevPostId, "should match PrevPostId")

	posts, _, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post1.Id, 1, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Posts, 1, "should match length of posts returned")
	require.Equal(t, post5.Id, posts.Order[0], "should match returned post")
	require.Equal(t, "", posts.NextPostId, "should match NextPostId")
	require.Equal(t, post4.Id, posts.PrevPostId, "should match PrevPostId")

	// more tests for next_post_id, prev_post_id, and order
	// There are 12 posts composed of first 2 system messages and 10 created posts
	post6 := th.CreatePost()
	th.CreatePost() // post7
	post8 := th.CreatePost()
	post9 := th.CreatePost()
	post10 := th.CreatePost()

	// similar to '/posts?after=post2'
	posts, _, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post2.Id, 0, 60, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 8, "expected 8 posts")
	require.Equal(t, post10.Id, posts.Order[0], "should match order")
	require.Equal(t, post3.Id, posts.Order[7], "should match order")
	require.Equal(t, "", posts.NextPostId, "should return an empty NextPostId")
	require.Equal(t, post2.Id, posts.PrevPostId, "should return post2.Id as PrevPostId")

	// similar to '/posts?after=post2&per_page=3'
	posts, _, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post2.Id, 0, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 3, "expected 3 posts")
	require.Equal(t, post5.Id, posts.Order[0], "should match order")
	require.Equal(t, post3.Id, posts.Order[2], "should return 3 posts and match order")
	require.Equal(t, post6.Id, posts.NextPostId, "should return post6.Id as NextPostId")
	require.Equal(t, post2.Id, posts.PrevPostId, "should return post2.Id as PrevPostId")

	// similar to '/posts?after=post2&per_page=3&page=1'
	posts, _, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post2.Id, 1, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 3, "expected 3 posts")
	require.Equal(t, post8.Id, posts.Order[0], "should match order")
	require.Equal(t, post6.Id, posts.Order[2], "should match order")
	require.Equal(t, post9.Id, posts.NextPostId, "should return post9.Id as NextPostId")
	require.Equal(t, post5.Id, posts.PrevPostId, "should return post5.Id as PrevPostId")

	// similar to '/posts?after=post2&per_page=3&page=2'
	posts, _, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post2.Id, 2, 3, "", false, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 2, "expected 2 posts")
	require.Equal(t, post10.Id, posts.Order[0], "should match order")
	require.Equal(t, post9.Id, posts.Order[1], "should match order")
	require.Equal(t, "", posts.NextPostId, "should return an empty NextPostId")
	require.Equal(t, post8.Id, posts.PrevPostId, "should return post8.Id as PrevPostId")

	// similar to '/posts?after=post10'
	posts, _, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post10.Id, 0, 60, "", false, false)
	require.NoError(t, err)
	require.Empty(t, posts.Order, "should return 0 post")
	require.Equal(t, "", posts.NextPostId, "should return an empty NextPostId")
	require.Equal(t, post10.Id, posts.PrevPostId, "should return post10.Id as PrevPostId")

	// similar to '/posts?after=post10&page=1'
	posts, _, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post10.Id, 1, 60, "", false, false)
	require.NoError(t, err)
	require.Empty(t, posts.Order, "should return 0 post")
	require.Equal(t, "", posts.NextPostId, "should return an empty NextPostId")
	require.Equal(t, "", posts.PrevPostId, "should return an empty PrevPostId")

	// similar to '/posts?after=non-existent-post'
	nonExistentPostId := model.NewId()
	posts, _, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, nonExistentPostId, 0, 60, "", false, false)
	require.NoError(t, err)
	require.Empty(t, posts.Order, "should return 0 post")
	require.Equal(t, "", posts.NextPostId, "should return an empty NextPostId")
	require.Equal(t, nonExistentPostId, posts.PrevPostId, "should return nonExistentPostId as PrevPostId")

	_, err = client.DeletePost(context.Background(), post10.Id)
	require.NoError(t, err)
	_, err = client.DeletePost(context.Background(), post9.Id)
	require.NoError(t, err)

	// include deleted posts for non-admin users.
	_, resp, err = client.GetPostsAfter(context.Background(), th.BasicChannel.Id, post1.Id, 0, 60, "", false, true)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		// include deleted posts for admin users.
		posts, resp, err = c.GetPostsAfter(context.Background(), th.BasicChannel.Id, post1.Id, 0, 60, "", false, true)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, posts.Order, 9, "expected 9 posts")

		// not include deleted posts for admin users.
		posts, resp, err = c.GetPostsAfter(context.Background(), th.BasicChannel.Id, post1.Id, 0, 60, "", false, false)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, posts.Order, 7, "expected 7 posts")
	})
}

func TestGetPostsForChannelAroundLastUnread(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	userId := th.BasicUser.Id
	channelId := th.BasicChannel.Id

	// 12 posts = 2 systems posts + 10 created posts below
	post1 := th.CreatePost()
	post2 := th.CreatePost()
	post3 := th.CreatePost()
	post4 := th.CreatePost()
	post5 := th.CreatePost()
	replyPost := &model.Post{ChannelId: channelId, Message: model.NewId(), RootId: post4.Id}
	post6, _, err := client.CreatePost(context.Background(), replyPost)
	require.NoError(t, err)
	post7, _, err := client.CreatePost(context.Background(), replyPost)
	require.NoError(t, err)
	post8, _, err := client.CreatePost(context.Background(), replyPost)
	require.NoError(t, err)
	post9, _, err := client.CreatePost(context.Background(), replyPost)
	require.NoError(t, err)
	post10, _, err := client.CreatePost(context.Background(), replyPost)
	require.NoError(t, err)

	postIdNames := map[string]string{
		post1.Id:  "post1",
		post2.Id:  "post2",
		post3.Id:  "post3",
		post4.Id:  "post4",
		post5.Id:  "post5",
		post6.Id:  "post6 (reply to post4)",
		post7.Id:  "post7 (reply to post4)",
		post8.Id:  "post8 (reply to post4)",
		post9.Id:  "post9 (reply to post4)",
		post10.Id: "post10 (reply to post4)",
	}

	namePost := func(postId string) string {
		name, ok := postIdNames[postId]
		if ok {
			return name
		}

		return fmt.Sprintf("unknown (%s)", postId)
	}

	namePosts := func(postIds []string) []string {
		namedPostIds := make([]string, 0, len(postIds))
		for _, postId := range postIds {
			namedPostIds = append(namedPostIds, namePost(postId))
		}

		return namedPostIds
	}

	namePostsMap := func(posts map[string]*model.Post) []string {
		namedPostIds := make([]string, 0, len(posts))
		for postId := range posts {
			namedPostIds = append(namedPostIds, namePost(postId))
		}
		sort.Strings(namedPostIds)

		return namedPostIds
	}

	assertPostList := func(t *testing.T, expected, actual *model.PostList) {
		t.Helper()

		require.Equal(t, namePosts(expected.Order), namePosts(actual.Order), "unexpected post order")
		require.Equal(t, namePostsMap(expected.Posts), namePostsMap(actual.Posts), "unexpected posts")
		require.Equal(t, namePost(expected.NextPostId), namePost(actual.NextPostId), "unexpected next post id")
		require.Equal(t, namePost(expected.PrevPostId), namePost(actual.PrevPostId), "unexpected prev post id")
	}

	// Setting limit_after to zero should fail with a 400 BadRequest.
	posts, resp, err := client.GetPostsAroundLastUnread(context.Background(), userId, channelId, 20, 0, false)
	require.Error(t, err)
	CheckErrorID(t, err, "api.context.invalid_url_param.app_error")
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Nil(t, posts)

	// All returned posts are all read by the user, since it's created by the user itself.
	posts, _, err = client.GetPostsAroundLastUnread(context.Background(), userId, channelId, 20, 20, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 12, "Should return 12 posts only since there's no unread post")

	// Set channel member's last viewed to 0.
	// All returned posts are latest posts as if all previous posts were already read by the user.
	channelMember, err := th.App.Srv().Store().Channel().GetMember(context.Background(), channelId, userId)
	require.NoError(t, err)
	channelMember.LastViewedAt = 0
	_, err = th.App.Srv().Store().Channel().UpdateMember(th.Context, channelMember)
	require.NoError(t, err)
	th.App.Srv().Store().Post().InvalidateLastPostTimeCache(channelId)

	posts, _, err = client.GetPostsAroundLastUnread(context.Background(), userId, channelId, 20, 20, false)
	require.NoError(t, err)

	require.Len(t, posts.Order, 12, "Should return 12 posts only since there's no unread post")

	// get the first system post generated before the created posts above
	posts, _, err = client.GetPostsBefore(context.Background(), th.BasicChannel.Id, post1.Id, 0, 2, "", false, false)
	require.NoError(t, err)
	systemPost0 := posts.Posts[posts.Order[0]]
	postIdNames[systemPost0.Id] = "system post 0"
	systemPost1 := posts.Posts[posts.Order[1]]
	postIdNames[systemPost1.Id] = "system post 1"

	// Set channel member's last viewed before post1.
	channelMember, err = th.App.Srv().Store().Channel().GetMember(context.Background(), channelId, userId)
	require.NoError(t, err)
	channelMember.LastViewedAt = post1.CreateAt - 1
	_, err = th.App.Srv().Store().Channel().UpdateMember(th.Context, channelMember)
	require.NoError(t, err)
	th.App.Srv().Store().Post().InvalidateLastPostTimeCache(channelId)

	posts, _, err = client.GetPostsAroundLastUnread(context.Background(), userId, channelId, 3, 3, false)
	require.NoError(t, err)

	assertPostList(t, &model.PostList{
		Order: []string{post3.Id, post2.Id, post1.Id, systemPost0.Id, systemPost1.Id},
		Posts: map[string]*model.Post{
			systemPost0.Id: systemPost0,
			systemPost1.Id: systemPost1,
			post1.Id:       post1,
			post2.Id:       post2,
			post3.Id:       post3,
		},
		NextPostId: post4.Id,
		PrevPostId: "",
	}, posts)

	// Set channel member's last viewed before post6.
	channelMember, err = th.App.Srv().Store().Channel().GetMember(context.Background(), channelId, userId)
	require.NoError(t, err)
	channelMember.LastViewedAt = post6.CreateAt - 1
	_, err = th.App.Srv().Store().Channel().UpdateMember(th.Context, channelMember)
	require.NoError(t, err)
	th.App.Srv().Store().Post().InvalidateLastPostTimeCache(channelId)

	posts, _, err = client.GetPostsAroundLastUnread(context.Background(), userId, channelId, 3, 3, false)
	require.NoError(t, err)

	assertPostList(t, &model.PostList{
		Order: []string{post8.Id, post7.Id, post6.Id, post5.Id, post4.Id, post3.Id},
		Posts: map[string]*model.Post{
			post3.Id:  post3,
			post4.Id:  post4,
			post5.Id:  post5,
			post6.Id:  post6,
			post7.Id:  post7,
			post8.Id:  post8,
			post9.Id:  post9,
			post10.Id: post10,
		},
		NextPostId: post9.Id,
		PrevPostId: post2.Id,
	}, posts)

	// Set channel member's last viewed before post10.
	channelMember, err = th.App.Srv().Store().Channel().GetMember(context.Background(), channelId, userId)
	require.NoError(t, err)
	channelMember.LastViewedAt = post10.CreateAt - 1
	_, err = th.App.Srv().Store().Channel().UpdateMember(th.Context, channelMember)
	require.NoError(t, err)
	th.App.Srv().Store().Post().InvalidateLastPostTimeCache(channelId)

	posts, _, err = client.GetPostsAroundLastUnread(context.Background(), userId, channelId, 3, 3, false)
	require.NoError(t, err)

	assertPostList(t, &model.PostList{
		Order: []string{post10.Id, post9.Id, post8.Id, post7.Id},
		Posts: map[string]*model.Post{
			post4.Id:  post4,
			post6.Id:  post6,
			post7.Id:  post7,
			post8.Id:  post8,
			post9.Id:  post9,
			post10.Id: post10,
		},
		NextPostId: "",
		PrevPostId: post6.Id,
	}, posts)

	// Set channel member's last viewed equal to post10.
	channelMember, err = th.App.Srv().Store().Channel().GetMember(context.Background(), channelId, userId)
	require.NoError(t, err)
	channelMember.LastViewedAt = post10.CreateAt
	_, err = th.App.Srv().Store().Channel().UpdateMember(th.Context, channelMember)
	require.NoError(t, err)
	th.App.Srv().Store().Post().InvalidateLastPostTimeCache(channelId)

	posts, _, err = client.GetPostsAroundLastUnread(context.Background(), userId, channelId, 3, 3, false)
	require.NoError(t, err)

	assertPostList(t, &model.PostList{
		Order: []string{post10.Id, post9.Id, post8.Id},
		Posts: map[string]*model.Post{
			post4.Id:  post4,
			post6.Id:  post6,
			post7.Id:  post7,
			post8.Id:  post8,
			post9.Id:  post9,
			post10.Id: post10,
		},
		NextPostId: "",
		PrevPostId: post7.Id,
	}, posts)

	// Set channel member's last viewed to just before a new reply to a previous thread, not
	// otherwise in the requested window.
	post11 := th.CreatePost()
	post12, _, err := client.CreatePost(context.Background(), &model.Post{
		ChannelId: channelId,
		Message:   model.NewId(),
		RootId:    post4.Id,
	})
	require.NoError(t, err)
	post13 := th.CreatePost()

	postIdNames[post11.Id] = "post11"
	postIdNames[post12.Id] = "post12 (reply to post4)"
	postIdNames[post13.Id] = "post13"

	channelMember, err = th.App.Srv().Store().Channel().GetMember(context.Background(), channelId, userId)
	require.NoError(t, err)
	channelMember.LastViewedAt = post12.CreateAt - 1
	_, err = th.App.Srv().Store().Channel().UpdateMember(th.Context, channelMember)
	require.NoError(t, err)
	th.App.Srv().Store().Post().InvalidateLastPostTimeCache(channelId)

	posts, _, err = client.GetPostsAroundLastUnread(context.Background(), userId, channelId, 1, 2, false)
	require.NoError(t, err)

	assertPostList(t, &model.PostList{
		Order: []string{post13.Id, post12.Id, post11.Id},
		Posts: map[string]*model.Post{
			post4.Id:  post4,
			post6.Id:  post6,
			post7.Id:  post7,
			post8.Id:  post8,
			post9.Id:  post9,
			post10.Id: post10,
			post11.Id: post11,
			post12.Id: post12,
			post13.Id: post13,
		},
		NextPostId: "",
		PrevPostId: post10.Id,
	}, posts)
}

func TestGetPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	// TODO: migrate this entirely to the subtest's client
	// once the other methods are migrated too.
	client := th.Client

	var privatePost *model.Post
	th.TestForAllClients(t, func(t *testing.T, c *model.Client4) {
		t.Helper()

		post, resp, err := c.GetPost(context.Background(), th.BasicPost.Id, "")
		require.NoError(t, err)

		require.Equal(t, th.BasicPost.Id, post.Id, "post ids don't match")

		post, resp, err = c.GetPost(context.Background(), th.BasicPost.Id, resp.Etag)
		require.NoError(t, err)
		CheckEtag(t, post, resp)

		_, resp, err = c.GetPost(context.Background(), "", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		_, resp, err = c.GetPost(context.Background(), "junk", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = c.GetPost(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		_, err = client.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)
		t.Cleanup(func() {
			// Add the user back to the channel
			_, _, err = client.AddChannelMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
			require.NoError(t, err)
		})

		// Channel is public, should be able to read post
		_, _, err = c.GetPost(context.Background(), th.BasicPost.Id, "")
		require.NoError(t, err)

		privatePost = th.CreatePostWithClient(client, th.BasicPrivateChannel)

		_, _, err = c.GetPost(context.Background(), privatePost.Id, "")
		require.NoError(t, err)
	})

	_, err := client.RemoveUserFromChannel(context.Background(), th.BasicPrivateChannel.Id, th.BasicUser.Id)
	require.NoError(t, err)

	// Channel is private, should not be able to read post
	_, resp, err := client.GetPost(context.Background(), privatePost.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// But local client should.
	_, _, err = th.LocalClient.GetPost(context.Background(), privatePost.Id, "")
	require.NoError(t, err)

	// Delete post
	_, err = th.SystemAdminClient.DeletePost(context.Background(), th.BasicPost.Id)
	require.NoError(t, err)

	// Normal client should get 404 when trying to access deleted post normally
	_, resp, err = client.GetPost(context.Background(), th.BasicPost.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// Normal client should get unauthorized when trying to access deleted post
	_, resp, err = client.GetPostIncludeDeleted(context.Background(), th.BasicPost.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// System client should get 404 when trying to access deleted post normally
	_, resp, err = th.SystemAdminClient.GetPost(context.Background(), th.BasicPost.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// System client should be able to access deleted post with include_deleted param
	post, _, err := th.SystemAdminClient.GetPostIncludeDeleted(context.Background(), th.BasicPost.Id, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicPost.Id, post.Id)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	// Normal client should get unauthorized, but local client should get 404.
	_, resp, err = client.GetPost(context.Background(), model.NewId(), "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, resp, err = th.LocalClient.GetPost(context.Background(), model.NewId(), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestDeletePost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	t.Run("Post not found", func(t *testing.T) {
		resp, err := client.DeletePost(context.Background(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("Post doesn't exist", func(t *testing.T) {
		resp, err := client.DeletePost(context.Background(), "junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("No permissions to delete a post", func(t *testing.T) {
		resp, err := client.DeletePost(context.Background(), th.BasicPost.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Try to delete a post across different user roles", func(t *testing.T) {
		_, _, err := client.Login(context.Background(), th.TeamAdminUser.Email, th.TeamAdminUser.Password)
		require.NoError(t, err)
		_, cErr := client.DeletePost(context.Background(), th.BasicPost.Id)
		require.NoError(t, cErr)

		post := th.CreatePost()
		post2 := th.CreatePost()
		user := th.CreateUser()

		_, err = client.Logout(context.Background())
		require.NoError(t, err)
		_, _, err = client.Login(context.Background(), user.Email, user.Password)
		require.NoError(t, err)

		resp, err := client.DeletePost(context.Background(), post.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, err = client.Logout(context.Background())
		require.NoError(t, err)
		resp, err = client.DeletePost(context.Background(), model.NewId())
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)

		_, err = th.SystemAdminClient.DeletePost(context.Background(), post.Id)
		require.NoError(t, err)

		_, err = th.LocalClient.DeletePost(context.Background(), post2.Id)
		require.NoError(t, err)
	})
}

func TestPermanentDeletePost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	enableAPIPostDeletion := *th.App.Config().ServiceSettings.EnableAPIPostDeletion
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableAPIPostDeletion = &enableAPIPostDeletion })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIPostDeletion = false })

	t.Run("Post not found", func(t *testing.T) {
		resp, err := client.PermanentDeletePost(context.Background(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("Post doesn't exist", func(t *testing.T) {
		resp, err := client.PermanentDeletePost(context.Background(), "junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Permanent deletion not available through API if EnableAPIPostDeletion is not set", func(t *testing.T) {
		resp, err := th.SystemAdminClient.PermanentDeletePost(context.Background(), th.BasicPost.Id)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("Permanent deletion available through local mode even if EnableAPIPostDeletion is not set", func(t *testing.T) {
		post := th.CreatePost()
		_, err := th.LocalClient.PermanentDeletePost(context.Background(), post.Id)
		require.NoError(t, err)
	})

	t.Run("No permissions to permanently delete a post", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIPostDeletion = true })
		resp, err := client.PermanentDeletePost(context.Background(), th.BasicPost.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Try to permanently delete a post across different user roles", func(t *testing.T) {
		_, _, err := client.Login(context.Background(), th.TeamAdminUser.Email, th.TeamAdminUser.Password)
		require.NoError(t, err)
		resp, err := client.PermanentDeletePost(context.Background(), th.BasicPost.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		post := th.CreatePost()
		post2 := th.CreatePost()
		user := th.CreateUser()

		_, err = client.Logout(context.Background())
		require.NoError(t, err)
		_, _, err = client.Login(context.Background(), user.Email, user.Password)
		require.NoError(t, err)

		resp, err = client.PermanentDeletePost(context.Background(), post.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, err = client.Logout(context.Background())
		require.NoError(t, err)
		resp, err = client.PermanentDeletePost(context.Background(), post.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)

		_, err = th.SystemAdminClient.PermanentDeletePost(context.Background(), post.Id)
		require.NoError(t, err)

		_, err = th.LocalClient.PermanentDeletePost(context.Background(), post2.Id)
		require.NoError(t, err)
	})
}

func TestWebHubMembership(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	u1 := th.CreateUser()
	th.LinkUserToTeam(u1, th.BasicTeam)
	th.AddUserToChannel(u1, th.BasicChannel)

	ch2 := th.CreatePrivateChannel()
	u2 := th.CreateUser()
	th.LinkUserToTeam(u2, th.BasicTeam)
	th.AddUserToChannel(u2, ch2)

	quitChan := make(chan struct{})
	var wg sync.WaitGroup

	wg.Add(3)
	for _, obj := range []struct {
		testName string
		user     *model.User
	}{
		{
			testName: "basicUser",
			user:     th.BasicUser,
		},
		{
			testName: "u1",
			user:     u1,
		},
		{
			testName: "u2",
			user:     u2,
		},
	} {
		cli := th.CreateClient()
		_, _, err := cli.Login(context.Background(), obj.user.Username, obj.user.Password)
		require.NoError(t, err)

		wsClient, err := th.CreateWebSocketClientWithClient(cli)
		require.NoError(t, err)
		defer wsClient.Close()

		wsClient.Listen()

		go func(testName string) {
			defer wg.Done()
			var cnt int
			for {
				select {
				case event := <-wsClient.EventChannel:
					if event.EventType() == model.WebsocketEventPosted {
						var post model.Post
						err := json.Unmarshal([]byte(event.GetData()["post"].(string)), &post)
						require.NoError(t, err)

						cnt++
						// Cases:
						// Post to basicChannel should go to u1 and basicUser.
						// Add u1 to ch2.
						// Post to ch2 should go to u1, u2 and basicUser.
						// Remove u1 from ch2.
						// Post to ch2 should go to u2 and basicUser.
						switch testName {
						case "basicUser":
							if cnt == 1 {
								assert.Equal(t, th.BasicChannel.Id, post.ChannelId)
							} else if cnt == 2 {
								assert.Equal(t, ch2.Id, post.ChannelId)
							} else if cnt == 3 {
								// After removing, there will be a "removed from channel post"
								assert.Equal(t, ch2.Id, post.ChannelId)
							} else if cnt == 4 {
								assert.Equal(t, ch2.Id, post.ChannelId)
							} else {
								assert.Fail(t, "more than 4 messages arrived for basicUser")
							}
						case "u1":
							// First msg should be from basicChannel
							if cnt == 1 {
								assert.Equal(t, th.BasicChannel.Id, post.ChannelId)
							} else if cnt == 2 {
								// second should be from ch2
								assert.Equal(t, ch2.Id, post.ChannelId)
							} else {
								assert.Fail(t, "more than 2 messages arrived for u1")
							}
						case "u2":
							if cnt == 1 {
								assert.Equal(t, ch2.Id, post.ChannelId)
							} else if cnt == 2 {
								// After removing, there will be a "removed from channel post"
								assert.Equal(t, ch2.Id, post.ChannelId)
							} else if cnt == 3 {
								assert.Equal(t, ch2.Id, post.ChannelId)
							} else {
								assert.Fail(t, "more than 3 messages arrived for u2")
							}
						}
					}
				case <-quitChan:
					return
				}
			}
		}(obj.testName)
	}

	// Will send to basic channel
	th.CreatePost()
	// Add u1 to ch2
	th.AddUserToChannel(u1, ch2)
	// Send post to ch2
	th.CreatePostWithClient(th.Client, ch2)
	// Remove u1 from ch2
	th.RemoveUserFromChannel(u1, ch2)
	// Send post to ch2
	th.CreatePostWithClient(th.Client, ch2)

	// It is possible to create a signalling mechanism from the goroutines
	// after all events are received, but we also want to verify that no additional
	// events are being sent.
	time.Sleep(2 * time.Second)
	close(quitChan)
	wg.Wait()
}

func TestWebHubCloseConnOnDBFail(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61780")
	th := Setup(t).InitBasic()
	defer func() {
		th.TearDown()
		// Asserting that the error message is present in the log
		testlib.AssertLog(t, th.LogBuffer, mlog.LvlError.Name, "Error while registering to hub")
		_, err := th.Server.Store().GetInternalMasterDB().Exec(`ALTER TABLE dummy RENAME to ChannelMembers`)
		require.NoError(t, err)
	}()

	cli := th.CreateClient()
	_, _, err := cli.Login(context.Background(), th.BasicUser.Username, th.BasicUser.Password)
	require.NoError(t, err)

	_, err = th.Server.Store().GetInternalMasterDB().Exec(`ALTER TABLE ChannelMembers RENAME to dummy`)
	require.NoError(t, err)

	wsClient, err := th.CreateWebSocketClientWithClient(cli)
	require.NoError(t, err)
	defer wsClient.Close()

	require.NoError(t, th.TestLogger.Flush())
}

func TestDeletePostEvent(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	WebSocketClient, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	WebSocketClient.Listen()
	defer WebSocketClient.Close()

	_, err = th.SystemAdminClient.DeletePost(context.Background(), th.BasicPost.Id)
	require.NoError(t, err)

	var received bool

	for {
		var exit bool
		select {
		case event := <-WebSocketClient.EventChannel:
			if event.EventType() == model.WebsocketEventPostDeleted {
				var post model.Post
				err := json.Unmarshal([]byte(event.GetData()["post"].(string)), &post)
				require.NoError(t, err)
				received = true
			}
		case <-time.After(5 * time.Second):
			exit = true
		}
		if exit {
			break
		}
	}

	require.True(t, received)
}

func TestDeletePostMessage(t *testing.T) {
	th := Setup(t).InitBasic()
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
	_, appErr := th.App.AddUserToChannel(th.Context, th.SystemAdminUser, th.BasicChannel, false)
	require.Nil(t, appErr)

	defer th.TearDown()

	testCases := []struct {
		description string
		client      *model.Client4
		delete_by   any
	}{
		{"Do not send delete_by to regular user", th.Client, nil},
		{"Send delete_by to system admin user", th.SystemAdminClient, th.SystemAdminUser.Id},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			wsClient, err := th.CreateWebSocketClientWithClient(tc.client)
			require.NoError(t, err)
			defer wsClient.Close()

			wsClient.Listen()

			post := th.CreatePost()

			_, err = th.SystemAdminClient.DeletePost(context.Background(), post.Id)
			require.NoError(t, err)

			timeout := time.After(5 * time.Second)

			for {
				select {
				case ev := <-wsClient.EventChannel:
					if ev.EventType() == model.WebsocketEventPostDeleted {
						assert.Equal(t, tc.delete_by, ev.GetData()["delete_by"])
						return
					}
				case <-timeout:
					// We just skip the test instead of failing because waiting for more than 5 seconds
					// to get a response does not make sense, and it will unnecessarily slow down
					// the tests further in an already congested CI environment.
					t.Skip("timed out waiting for event")
				}
			}
		})
	}
}

func TestGetPostThread(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a", RootId: th.BasicPost.Id}
	post, _, _ = client.CreatePost(context.Background(), post)

	list, resp, err := client.GetPostThread(context.Background(), th.BasicPost.Id, "", false)
	require.NoError(t, err)

	var list2 *model.PostList
	list2, resp, _ = client.GetPostThread(context.Background(), th.BasicPost.Id, resp.Etag, false)
	CheckEtag(t, list2, resp)
	require.Equal(t, th.BasicPost.Id, list.Order[0], "wrong order")

	_, ok := list.Posts[th.BasicPost.Id]
	require.True(t, ok, "should have had post")

	_, ok = list.Posts[post.Id]
	require.True(t, ok, "should have had post")

	_, resp, err = client.GetPostThread(context.Background(), "junk", "", false)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetPostThread(context.Background(), model.NewId(), "", false)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
	require.NoError(t, err)

	// Channel is public, should be able to read post
	_, _, err = client.GetPostThread(context.Background(), th.BasicPost.Id, "", false)
	require.NoError(t, err)

	privatePost := th.CreatePostWithClient(client, th.BasicPrivateChannel)

	_, _, err = client.GetPostThread(context.Background(), privatePost.Id, "", false)
	require.NoError(t, err)

	_, err = client.RemoveUserFromChannel(context.Background(), th.BasicPrivateChannel.Id, th.BasicUser.Id)
	require.NoError(t, err)

	// Channel is private, should not be able to read post
	_, resp, err = client.GetPostThread(context.Background(), privatePost.Id, "", false)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Sending some bad params
	_, resp, err = client.GetPostThreadWithOpts(context.Background(), th.BasicPost.Id, "", model.GetPostsOptions{
		CollapsedThreads: true,
		FromPost:         "something",
		PerPage:          10,
	})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetPostThreadWithOpts(context.Background(), th.BasicPost.Id, "", model.GetPostsOptions{
		CollapsedThreads: true,
		Direction:        "sideways",
	})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetPostThread(context.Background(), model.NewId(), "", false)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetPostThread(context.Background(), th.BasicPost.Id, "", false)
	require.NoError(t, err)
}

func TestSearchPosts(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	experimentalViewArchivedChannels := *th.App.Config().TeamSettings.ExperimentalViewArchivedChannels
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.TeamSettings.ExperimentalViewArchivedChannels = &experimentalViewArchivedChannels
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.ExperimentalViewArchivedChannels = true
	})

	th.LoginBasic()
	client := th.Client

	message := "search for post1"
	_ = th.CreateMessagePost(message)

	message = "search for post2"
	post2 := th.CreateMessagePost(message)

	message = "#hashtag search for post3"
	post3 := th.CreateMessagePost(message)

	message = "hashtag for post4"
	_ = th.CreateMessagePost(message)

	archivedChannel := th.CreatePublicChannel()
	_ = th.CreateMessagePostWithClient(th.Client, archivedChannel, "#hashtag for post3")
	_, err := th.Client.DeleteChannel(context.Background(), archivedChannel.Id)
	require.NoError(t, err)

	otherTeam := th.CreateTeam()
	channelInOtherTeam := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, otherTeam.Id)
	_ = th.AddUserToChannel(th.BasicUser, channelInOtherTeam)
	_ = th.CreateMessagePostWithClient(th.Client, channelInOtherTeam, "search for post 5")

	terms := "search"
	isOrSearch := false
	timezoneOffset := 5
	searchParams := model.SearchParameter{
		Terms:          &terms,
		IsOrSearch:     &isOrSearch,
		TimeZoneOffset: &timezoneOffset,
	}
	allTeamsPosts, _, err := client.SearchPostsWithParams(context.Background(), "", &searchParams)
	require.NoError(t, err)
	require.Len(t, allTeamsPosts.Order, 4, "wrong search along multiple teams")

	terms = "search"
	isOrSearch = false
	timezoneOffset = 5
	searchParams = model.SearchParameter{
		Terms:          &terms,
		IsOrSearch:     &isOrSearch,
		TimeZoneOffset: &timezoneOffset,
	}
	posts, _, err := client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &searchParams)
	require.NoError(t, err)
	require.Len(t, posts.Order, 3, "wrong search")

	terms = "search"
	page := 0
	perPage := 2
	searchParams = model.SearchParameter{
		Terms:          &terms,
		IsOrSearch:     &isOrSearch,
		TimeZoneOffset: &timezoneOffset,
		Page:           &page,
		PerPage:        &perPage,
	}
	posts2, _, err := client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &searchParams)
	require.NoError(t, err)
	// We don't support paging for DB search yet, modify this when we do.
	require.Len(t, posts2.Order, 3, "Wrong number of posts")
	assert.Equal(t, posts.Order[0], posts2.Order[0])
	assert.Equal(t, posts.Order[1], posts2.Order[1])

	page = 1
	searchParams = model.SearchParameter{
		Terms:          &terms,
		IsOrSearch:     &isOrSearch,
		TimeZoneOffset: &timezoneOffset,
		Page:           &page,
		PerPage:        &perPage,
	}
	posts2, _, err = client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &searchParams)
	require.NoError(t, err)
	// We don't support paging for DB search yet, modify this when we do.
	require.Empty(t, posts2.Order, "Wrong number of posts")

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "search", false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 3, "wrong search")

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "post2", false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 1, "wrong number of posts")
	require.Equal(t, post2.Id, posts.Order[0], "wrong search")

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "#hashtag", false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 1, "wrong number of posts")
	require.Equal(t, post3.Id, posts.Order[0], "wrong search")

	terms = "#hashtag"
	includeDeletedChannels := true
	searchParams = model.SearchParameter{
		Terms:                  &terms,
		IsOrSearch:             &isOrSearch,
		TimeZoneOffset:         &timezoneOffset,
		IncludeDeletedChannels: &includeDeletedChannels,
	}
	posts, _, err = client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &searchParams)
	require.NoError(t, err)
	require.Len(t, posts.Order, 2, "wrong search")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.ExperimentalViewArchivedChannels = false
	})

	posts, _, err = client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &searchParams)
	require.NoError(t, err)
	require.Len(t, posts.Order, 1, "wrong search")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "*", false)
	require.Empty(t, posts.Order, "searching for just * shouldn't return any results")

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "post1 post2", true)
	require.NoError(t, err)
	require.Len(t, posts.Order, 2, "wrong search results")

	_, resp, err := client.SearchPosts(context.Background(), "junk", "#sgtitlereview", false)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.SearchPosts(context.Background(), model.NewId(), "#sgtitlereview", false)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "", false)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "#sgtitlereview", false)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestSearchHashtagPosts(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.LoginBasic()
	client := th.Client

	message := "#sgtitlereview with space"
	assert.NotNil(t, th.CreateMessagePost(message))

	message = "#sgtitlereview\n with return"
	assert.NotNil(t, th.CreateMessagePost(message))

	message = "no hashtag"
	assert.NotNil(t, th.CreateMessagePost(message))

	posts, _, err := client.SearchPosts(context.Background(), th.BasicTeam.Id, "#sgtitlereview", false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 2, "wrong search results")

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err := client.SearchPosts(context.Background(), th.BasicTeam.Id, "#sgtitlereview", false)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestSearchPostsInChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.LoginBasic()
	client := th.Client

	channel := th.CreatePublicChannel()

	message := "sgtitlereview with space"
	_ = th.CreateMessagePost(message)

	message = "sgtitlereview\n with return"
	_ = th.CreateMessagePostWithClient(client, th.BasicChannel2, message)

	message = "other message with no return"
	_ = th.CreateMessagePostWithClient(client, th.BasicChannel2, message)

	message = "other message with no return"
	_ = th.CreateMessagePostWithClient(client, channel, message)

	posts, _, _ := client.SearchPosts(context.Background(), th.BasicTeam.Id, "channel:", false)
	require.Empty(t, posts.Order, "wrong number of posts for search 'channel:'")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "in:", false)
	require.Empty(t, posts.Order, "wrong number of posts for search 'in:'")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "channel:"+th.BasicChannel.Name, false)
	require.Lenf(t, posts.Order, 2, "wrong number of posts returned for search 'channel:%v'", th.BasicChannel.Name)

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "in:"+th.BasicChannel2.Name, false)
	require.Lenf(t, posts.Order, 2, "wrong number of posts returned for search 'in:%v'", th.BasicChannel2.Name)

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "channel:"+th.BasicChannel2.Name, false)
	require.Lenf(t, posts.Order, 2, "wrong number of posts for search 'channel:%v'", th.BasicChannel2.Name)

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "ChAnNeL:"+th.BasicChannel2.Name, false)
	require.Lenf(t, posts.Order, 2, "wrong number of posts for search 'ChAnNeL:%v'", th.BasicChannel2.Name)

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "sgtitlereview", false)
	require.Lenf(t, posts.Order, 2, "wrong number of posts for search 'sgtitlereview'")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "sgtitlereview channel:"+th.BasicChannel.Name, false)
	require.Lenf(t, posts.Order, 1, "wrong number of posts for search 'sgtitlereview channel:%v'", th.BasicChannel.Name)

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "sgtitlereview in: "+th.BasicChannel2.Name, false)
	require.Lenf(t, posts.Order, 1, "wrong number of posts for search 'sgtitlereview in: %v'", th.BasicChannel2.Name)

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "sgtitlereview channel: "+th.BasicChannel2.Name, false)
	require.Lenf(t, posts.Order, 1, "wrong number of posts for search 'sgtitlereview channel: %v'", th.BasicChannel2.Name)

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "channel: "+th.BasicChannel2.Name+" channel: "+channel.Name, false)
	require.Lenf(t, posts.Order, 3, "wrong number of posts for 'channel: %v channel: %v'", th.BasicChannel2.Name, channel.Name)
}

func TestSearchPostsFromUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.LoginTeamAdmin()
	user := th.CreateUser()
	th.LinkUserToTeam(user, th.BasicTeam)
	_, appErr := th.App.AddUserToChannel(th.Context, user, th.BasicChannel, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, user, th.BasicChannel2, false)
	require.Nil(t, appErr)

	message := "sgtitlereview with space"
	_ = th.CreateMessagePost(message)

	_, err := client.Logout(context.Background())
	require.NoError(t, err)
	th.LoginBasic2()

	message = "sgtitlereview\n with return"
	_ = th.CreateMessagePostWithClient(client, th.BasicChannel2, message)

	posts, _, err := client.SearchPosts(context.Background(), th.BasicTeam.Id, "from: "+th.TeamAdminUser.Username, false)
	require.NoError(t, err)
	require.Lenf(t, posts.Order, 2, "wrong number of posts for search 'from: %v'", th.TeamAdminUser.Username)

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "from: "+th.BasicUser2.Username, false)
	require.NoError(t, err)
	require.Lenf(t, posts.Order, 1, "wrong number of posts for search 'from: %v", th.BasicUser2.Username)

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "from: "+th.BasicUser2.Username+" sgtitlereview", false)
	require.NoError(t, err)
	require.Lenf(t, posts.Order, 1, "wrong number of posts for search 'from: %v'", th.BasicUser2.Username)

	message = "hullo"
	_ = th.CreateMessagePost(message)

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "from: "+th.BasicUser2.Username+" in:"+th.BasicChannel.Name, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 1, "wrong number of posts for search 'from: %v in:", th.BasicUser2.Username, th.BasicChannel.Name)

	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	// wait for the join/leave messages to be created for user3 since they're done asynchronously
	time.Sleep(100 * time.Millisecond)

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "from: "+th.BasicUser2.Username, false)
	require.NoError(t, err)
	require.Lenf(t, posts.Order, 2, "wrong number of posts for search 'from: %v'", th.BasicUser2.Username)

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "from: "+th.BasicUser2.Username+" from: "+user.Username, false)
	require.NoError(t, err)
	require.Lenf(t, posts.Order, 2, "wrong number of posts for search 'from: %v from: %v'", th.BasicUser2.Username, user.Username)

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "from: "+th.BasicUser2.Username+" from: "+user.Username+" in:"+th.BasicChannel2.Name, false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 1, "wrong number of posts")

	message = "coconut"
	_ = th.CreateMessagePostWithClient(client, th.BasicChannel2, message)

	posts, _, err = client.SearchPosts(context.Background(), th.BasicTeam.Id, "from: "+th.BasicUser2.Username+" from: "+user.Username+" in:"+th.BasicChannel2.Name+" coconut", false)
	require.NoError(t, err)
	require.Len(t, posts.Order, 1, "wrong number of posts")
}

func TestSearchPostsWithDateFlags(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.LoginBasic()
	client := th.Client

	message := "sgtitlereview\n with return"
	createDate := time.Date(2018, 8, 1, 5, 0, 0, 0, time.UTC)
	_ = th.CreateMessagePostNoClient(th.BasicChannel, message, utils.MillisFromTime(createDate))

	message = "other message with no return"
	createDate = time.Date(2018, 8, 2, 5, 0, 0, 0, time.UTC)
	_ = th.CreateMessagePostNoClient(th.BasicChannel, message, utils.MillisFromTime(createDate))

	message = "other message with no return"
	createDate = time.Date(2018, 8, 3, 5, 0, 0, 0, time.UTC)
	_ = th.CreateMessagePostNoClient(th.BasicChannel, message, utils.MillisFromTime(createDate))

	posts, _, _ := client.SearchPosts(context.Background(), th.BasicTeam.Id, "return", false)
	require.Len(t, posts.Order, 3, "wrong number of posts")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "on:", false)
	require.Empty(t, posts.Order, "wrong number of posts")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "after:", false)
	require.Empty(t, posts.Order, "wrong number of posts")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "before:", false)
	require.Empty(t, posts.Order, "wrong number of posts")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "on:2018-08-01", false)
	require.Len(t, posts.Order, 1, "wrong number of posts")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "after:2018-08-01", false)
	resultCount := 0
	for _, post := range posts.Posts {
		if post.UserId == th.BasicUser.Id {
			resultCount = resultCount + 1
		}
	}
	require.Equal(t, 2, resultCount, "wrong number of posts")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "before:2018-08-02", false)
	require.Len(t, posts.Order, 1, "wrong number of posts")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "before:2018-08-03 after:2018-08-02", false)
	require.Empty(t, posts.Order, "wrong number of posts")

	posts, _, _ = client.SearchPosts(context.Background(), th.BasicTeam.Id, "before:2018-08-03 after:2018-08-01", false)
	require.Len(t, posts.Order, 1, "wrong number of posts")
}

func TestGetFileInfosForPost(t *testing.T) {
	t.Skip("MM-46902")
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	fileIds := make([]string, 3)
	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)
	for i := 0; i < 3; i++ {
		fileResp, _, _ := client.UploadFile(context.Background(), data, th.BasicChannel.Id, "test.png")
		fileIds[i] = fileResp.FileInfos[0].Id
	}

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a", FileIds: fileIds}
	post, _, _ = client.CreatePost(context.Background(), post)

	infos, resp, err := client.GetFileInfosForPost(context.Background(), post.Id, "")
	require.NoError(t, err)

	require.Len(t, infos, 3, "missing file infos")

	found := false
	for _, info := range infos {
		if info.Id == fileIds[0] {
			found = true
		}
	}

	require.True(t, found, "missing file info")

	infos, resp, _ = client.GetFileInfosForPost(context.Background(), post.Id, resp.Etag)
	CheckEtag(t, infos, resp)

	infos, _, err = client.GetFileInfosForPost(context.Background(), th.BasicPost.Id, "")
	require.NoError(t, err)

	require.Empty(t, infos, "should have no file infos")

	_, resp, err = client.GetFileInfosForPost(context.Background(), "junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetFileInfosForPost(context.Background(), model.NewId(), "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Delete post
	_, err = th.SystemAdminClient.DeletePost(context.Background(), post.Id)
	require.NoError(t, err)

	// Normal client should get 404 when trying to access deleted post normally
	_, resp, err = client.GetFileInfosForPost(context.Background(), post.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// Normal client should get unauthorized when trying to access deleted post
	_, resp, err = client.GetFileInfosForPostIncludeDeleted(context.Background(), post.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// System client should get 404 when trying to access deleted post normally
	_, resp, err = th.SystemAdminClient.GetFileInfosForPost(context.Background(), post.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// System client should be able to access deleted post with include_deleted param
	infos, _, err = th.SystemAdminClient.GetFileInfosForPostIncludeDeleted(context.Background(), post.Id, "")
	require.NoError(t, err)

	require.Len(t, infos, 3, "missing file infos")

	found = false
	for _, info := range infos {
		if info.Id == fileIds[0] {
			found = true
		}
	}

	require.True(t, found, "missing file info")

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetFileInfosForPost(context.Background(), model.NewId(), "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetFileInfosForPost(context.Background(), th.BasicPost.Id, "")
	require.NoError(t, err)
}

func TestSetChannelUnread(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	u1 := th.BasicUser
	u2 := th.BasicUser2
	s2, _ := th.App.GetSession(th.Client.AuthToken)
	_, _, err := th.Client.Login(context.Background(), u1.Email, u1.Password)
	require.NoError(t, err)
	c1 := th.BasicChannel
	c1toc2 := &model.ChannelView{ChannelId: th.BasicChannel2.Id, PrevChannelId: c1.Id}
	now := utils.MillisFromTime(time.Now())
	th.CreateMessagePostNoClient(c1, "AAA", now)
	p2 := th.CreateMessagePostNoClient(c1, "BBB", now+10)
	th.CreateMessagePostNoClient(c1, "CCC", now+20)

	pp1 := th.CreateMessagePostNoClient(th.BasicPrivateChannel, "Sssh!", now)
	pp2 := th.CreateMessagePostNoClient(th.BasicPrivateChannel, "You Sssh!", now+10)
	require.NotNil(t, pp1)
	require.NotNil(t, pp2)

	// Ensure that post have been read
	unread, appErr := th.App.GetChannelUnread(th.Context, c1.Id, u1.Id)
	require.Nil(t, appErr)
	require.Equal(t, int64(4), unread.MsgCount)
	unread, appErr = th.App.GetChannelUnread(th.Context, c1.Id, u2.Id)
	require.Nil(t, appErr)
	require.Equal(t, int64(4), unread.MsgCount)
	_, appErr = th.App.ViewChannel(th.Context, c1toc2, u2.Id, s2.Id, false)
	require.Nil(t, appErr)
	unread, appErr = th.App.GetChannelUnread(th.Context, c1.Id, u2.Id)
	require.Nil(t, appErr)
	require.Equal(t, int64(0), unread.MsgCount)

	t.Run("Unread last one", func(t *testing.T) {
		var r *model.Response
		r, err = th.Client.SetPostUnread(context.Background(), u1.Id, p2.Id, true)
		require.NoError(t, err)
		CheckOKStatus(t, r)
		unread, appErr := th.App.GetChannelUnread(th.Context, c1.Id, u1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, int64(2), unread.MsgCount)
	})

	t.Run("Unread on a direct channel", func(t *testing.T) {
		dc := th.CreateDmChannel(u2)
		th.CreateMessagePostNoClient(dc, "test1", now)
		p := th.CreateMessagePostNoClient(dc, "test2", now+10)
		require.NotNil(t, p)
		th.CreateMessagePostNoClient(dc, "test3", now+20)
		p1 := th.CreateMessagePostNoClient(dc, "test4", now+30)
		require.NotNil(t, p1)

		// Ensure that post have been read
		unread, err := th.App.GetChannelUnread(th.Context, dc.Id, u1.Id)
		require.Nil(t, err)
		require.Equal(t, int64(4), unread.MsgCount)
		cv := &model.ChannelView{ChannelId: dc.Id}
		_, appErr := th.App.ViewChannel(th.Context, cv, u1.Id, s2.Id, false)
		require.Nil(t, appErr)
		unread, err = th.App.GetChannelUnread(th.Context, dc.Id, u1.Id)
		require.Nil(t, err)
		require.Equal(t, int64(0), unread.MsgCount)

		r, _ := th.Client.SetPostUnread(context.Background(), u1.Id, p.Id, false)
		assert.Equal(t, 200, r.StatusCode)
		unread, err = th.App.GetChannelUnread(th.Context, dc.Id, u1.Id)
		require.Nil(t, err)
		require.Equal(t, int64(3), unread.MsgCount)

		// Ensure that post have been read
		_, appErr = th.App.ViewChannel(th.Context, cv, u1.Id, s2.Id, false)
		require.Nil(t, appErr)
		unread, err = th.App.GetChannelUnread(th.Context, dc.Id, u1.Id)
		require.Nil(t, err)
		require.Equal(t, int64(0), unread.MsgCount)

		r, _ = th.Client.SetPostUnread(context.Background(), u1.Id, p1.Id, false)
		assert.Equal(t, 200, r.StatusCode)
		unread, err = th.App.GetChannelUnread(th.Context, dc.Id, u1.Id)
		require.Nil(t, err)
		require.Equal(t, int64(1), unread.MsgCount)
	})

	t.Run("Unread on a direct channel in a thread", func(t *testing.T) {
		dc := th.CreateDmChannel(th.CreateUser())
		rootPost, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: u1.Id, CreateAt: now, ChannelId: dc.Id, Message: "root"}, dc, model.CreatePostFlags{})
		require.Nil(t, appErr)
		_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: u1.Id, CreateAt: now + 10, ChannelId: dc.Id, Message: "reply 1"}, dc, model.CreatePostFlags{})
		require.Nil(t, appErr)
		reply2, appErr := th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: u1.Id, CreateAt: now + 20, ChannelId: dc.Id, Message: "reply 2"}, dc, model.CreatePostFlags{})
		require.Nil(t, appErr)
		_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: u1.Id, CreateAt: now + 30, ChannelId: dc.Id, Message: "reply 3"}, dc, model.CreatePostFlags{})
		require.Nil(t, appErr)

		// Ensure that post have been read
		unread, err := th.App.GetChannelUnread(th.Context, dc.Id, u1.Id)
		require.Nil(t, err)
		require.Equal(t, int64(4), unread.MsgCount)
		require.Equal(t, int64(1), unread.MsgCountRoot)
		cv := &model.ChannelView{ChannelId: dc.Id}
		_, appErr = th.App.ViewChannel(th.Context, cv, u1.Id, s2.Id, false)
		require.Nil(t, appErr)
		unread, err = th.App.GetChannelUnread(th.Context, dc.Id, u1.Id)
		require.Nil(t, err)
		require.Equal(t, int64(0), unread.MsgCount)
		require.Equal(t, int64(0), unread.MsgCountRoot)

		r, _ := th.Client.SetPostUnread(context.Background(), u1.Id, rootPost.Id, false)
		assert.Equal(t, 200, r.StatusCode)
		unread, err = th.App.GetChannelUnread(th.Context, dc.Id, u1.Id)
		require.Nil(t, err)
		require.Equal(t, int64(4), unread.MsgCount)
		require.Equal(t, int64(1), unread.MsgCountRoot)

		// Ensure that post have been read
		_, appErr = th.App.ViewChannel(th.Context, cv, u1.Id, s2.Id, false)
		require.Nil(t, appErr)
		unread, err = th.App.GetChannelUnread(th.Context, dc.Id, u1.Id)
		require.Nil(t, err)
		require.Equal(t, int64(0), unread.MsgCount)
		require.Equal(t, int64(0), unread.MsgCountRoot)

		r, _ = th.Client.SetPostUnread(context.Background(), u1.Id, reply2.Id, false)
		assert.Equal(t, 200, r.StatusCode)
		unread, err = th.App.GetChannelUnread(th.Context, dc.Id, u1.Id)
		require.Nil(t, err)
		require.Equal(t, int64(2), unread.MsgCount)
		require.Equal(t, int64(0), unread.MsgCountRoot)
	})

	t.Run("Unread on a private channel", func(t *testing.T) {
		r, _ := th.Client.SetPostUnread(context.Background(), u1.Id, pp2.Id, true)
		assert.Equal(t, 200, r.StatusCode)
		unread, appErr := th.App.GetChannelUnread(th.Context, th.BasicPrivateChannel.Id, u1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, int64(1), unread.MsgCount)
		r, _ = th.Client.SetPostUnread(context.Background(), u1.Id, pp1.Id, true)
		assert.Equal(t, 200, r.StatusCode)
		unread, appErr = th.App.GetChannelUnread(th.Context, th.BasicPrivateChannel.Id, u1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, int64(2), unread.MsgCount)
	})

	t.Run("Can't unread an imaginary post", func(t *testing.T) {
		r, _ := th.Client.SetPostUnread(context.Background(), u1.Id, "invalid4ofngungryquinj976y", true)
		assert.Equal(t, http.StatusForbidden, r.StatusCode)
	})

	// let's create another user to test permissions
	u3 := th.CreateUser()
	c3 := th.CreateClient()
	_, _, err = c3.Login(context.Background(), u3.Email, u3.Password)
	require.NoError(t, err)

	t.Run("Can't unread channels you don't belong to", func(t *testing.T) {
		r, _ := c3.SetPostUnread(context.Background(), u3.Id, pp1.Id, true)
		assert.Equal(t, http.StatusForbidden, r.StatusCode)
	})

	t.Run("Can't unread users you don't have permission to edit", func(t *testing.T) {
		r, _ := c3.SetPostUnread(context.Background(), u1.Id, pp1.Id, true)
		assert.Equal(t, http.StatusForbidden, r.StatusCode)
	})

	t.Run("Can't unread if user is not logged in", func(t *testing.T) {
		_, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		response, err := th.Client.SetPostUnread(context.Background(), u1.Id, p2.Id, true)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, response)
	})
}

func TestSetPostUnreadWithoutCollapsedThreads(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	// user2: first root mention @user1
	//   - user1: hello
	//   - user2: mention @u1
	//   - user1: another reply
	//   - user2: another mention @u1
	// user1: a root post
	// user2: Another root mention @u1
	user1Mention := " @" + th.BasicUser.Username
	rootPost1, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "first root mention" + user1Mention}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "hello"}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	replyPost1, appErr := th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "mention" + user1Mention}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "another reply"}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "another mention" + user1Mention}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "a root post"}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "another root mention" + user1Mention}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	t.Run("Mark reply post as unread", func(t *testing.T) {
		userWSClient, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		defer userWSClient.Close()
		userWSClient.Listen()

		_, err = th.Client.SetPostUnread(context.Background(), th.BasicUser.Id, replyPost1.Id, false)
		require.NoError(t, err)
		channelUnread, appErr := th.App.GetChannelUnread(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		require.Equal(t, int64(3), channelUnread.MentionCount)
		//  MentionCountRoot should be zero so that supported clients don't show a mention badge for the channel
		require.Equal(t, int64(0), channelUnread.MentionCountRoot)

		require.Equal(t, int64(5), channelUnread.MsgCount)
		//  MentionCountRoot should be zero so that supported clients don't show the channel as unread
		require.Equal(t, channelUnread.MsgCountRoot, int64(0))

		// test websocket event for marking post as unread
		var caught bool
		var exit bool
		var data map[string]any
		for {
			select {
			case ev := <-userWSClient.EventChannel:
				if ev.EventType() == model.WebsocketEventPostUnread {
					caught = true
					data = ev.GetData()
				}
			case <-time.After(5 * time.Second):
				exit = true
			}
			if exit {
				break
			}
		}
		require.Truef(t, caught, "User should have received %s event", model.WebsocketEventPostUnread)
		msgCount, ok := data["msg_count"]
		require.True(t, ok)
		require.EqualValues(t, 3, msgCount)
		mentionCount, ok := data["mention_count"]
		require.True(t, ok)
		require.EqualValues(t, 3, mentionCount)

		threadMembership, appErr := th.App.GetThreadMembershipForUser(th.BasicUser.Id, rootPost1.Id)
		require.Nil(t, appErr)
		thread, appErr := th.App.GetThreadForUser(threadMembership, false)
		require.Nil(t, appErr)
		require.Equal(t, int64(2), thread.UnreadMentions)
		require.Equal(t, int64(3), thread.UnreadReplies)
	})

	t.Run("Mark root post as unread", func(t *testing.T) {
		_, err := th.Client.SetPostUnread(context.Background(), th.BasicUser.Id, rootPost1.Id, false)
		require.NoError(t, err)
		channelUnread, appErr := th.App.GetChannelUnread(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		require.Equal(t, int64(4), channelUnread.MentionCount)
		require.Equal(t, int64(2), channelUnread.MentionCountRoot)

		require.Equal(t, int64(7), channelUnread.MsgCount)
		require.Equal(t, int64(3), channelUnread.MsgCountRoot)
	})
}
func TestGetPostsByIds(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post1 := th.CreatePost()
	post2 := th.CreatePost()

	posts, response, err := client.GetPostsByIds(context.Background(), []string{post1.Id, post2.Id})
	require.NoError(t, err)
	CheckOKStatus(t, response)
	require.Len(t, posts, 2, "wrong number returned")
	require.Equal(t, posts[0].Id, post2.Id)
	require.Equal(t, posts[1].Id, post1.Id)

	_, response, err = client.GetPostsByIds(context.Background(), []string{})
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = client.GetPostsByIds(context.Background(), []string{"abc123"})
	require.Error(t, err)
	CheckNotFoundStatus(t, response)
}

func TestGetEditHistoryForPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "new message",
		UserId:    th.BasicUser.Id,
	}

	rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)

	time.Sleep(1 * time.Millisecond)

	t.Run("unedited post", func(t *testing.T) {
		history, resp, err := client.GetEditHistoryForPost(context.Background(), rpost.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Len(t, history, 0)
	})

	// update the post message
	patch := &model.PostPatch{
		Message: model.NewPointer("new message edited"),
	}

	// Patch the post
	_, response1, err1 := client.PatchPost(context.Background(), rpost.Id, patch)
	require.NoError(t, err1)
	CheckOKStatus(t, response1)

	// update the post message again
	patch = &model.PostPatch{
		Message: model.NewPointer("new message edited again"),
	}

	_, response2, err2 := client.PatchPost(context.Background(), rpost.Id, patch)
	require.NoError(t, err2)
	CheckOKStatus(t, response2)

	t.Run("update history correctly", func(t *testing.T) {
		history, response3, err3 := client.GetEditHistoryForPost(context.Background(), rpost.Id)
		require.NoError(t, err3)
		CheckOKStatus(t, response3)

		require.Len(t, history, 2)
		require.Equal(t, "new message edited", history[0].Message)
		require.Equal(t, "new message", history[1].Message)
	})

	t.Run("logged out", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, resp, err := client.GetEditHistoryForPost(context.Background(), rpost.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("different user", func(t *testing.T) {
		th.LoginBasic2()
		_, resp, err := client.GetEditHistoryForPost(context.Background(), rpost.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestCreatePostNotificationsWithCRT(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	rpost := th.CreatePost()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	testCases := []struct {
		name        string
		post        *model.Post
		notifyProps model.StringMap
		mentions    bool
		followers   bool
	}{
		{
			name: "When default is NONE, comments is NEVER, desktop threads is ALL, and has no mentions",
			post: &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "reply",
				UserId:    th.BasicUser2.Id,
				RootId:    rpost.Id,
			},
			notifyProps: model.StringMap{
				model.DesktopNotifyProp:        model.UserNotifyNone,
				model.CommentsNotifyProp:       model.CommentsNotifyNever,
				model.DesktopThreadsNotifyProp: model.UserNotifyAll,
			},
			mentions:  false,
			followers: false,
		},
		{
			name: "When default is NONE, comments is NEVER, desktop threads is ALL, and has mentions",
			post: &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "mention @" + th.BasicUser.Username,
				UserId:    th.BasicUser2.Id,
				RootId:    rpost.Id,
			},
			notifyProps: model.StringMap{
				model.DesktopNotifyProp:        model.UserNotifyNone,
				model.CommentsNotifyProp:       model.CommentsNotifyNever,
				model.DesktopThreadsNotifyProp: model.UserNotifyAll,
			},
			mentions:  true,
			followers: false,
		},
		{
			name: "When default is MENTION, comments is NEVER, desktop threads is ALL, and has no mentions",
			post: &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "reply",
				UserId:    th.BasicUser2.Id,
				RootId:    rpost.Id,
			},
			notifyProps: model.StringMap{
				model.DesktopNotifyProp:        model.UserNotifyMention,
				model.CommentsNotifyProp:       model.CommentsNotifyNever,
				model.DesktopThreadsNotifyProp: model.UserNotifyAll,
			},
			mentions:  false,
			followers: true,
		},
		{
			name: "When default is MENTION, comments is ANY, desktop threads is MENTION, and has no mentions",
			post: &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "reply",
				UserId:    th.BasicUser2.Id,
				RootId:    rpost.Id,
			},
			notifyProps: model.StringMap{
				model.DesktopNotifyProp:        model.UserNotifyMention,
				model.CommentsNotifyProp:       model.CommentsNotifyAny,
				model.DesktopThreadsNotifyProp: model.UserNotifyMention,
			},
			mentions:  false,
			followers: false,
		},
		{
			name: "When default is MENTION, comments is NEVER, desktop threads is MENTION, and has mentions",
			post: &model.Post{
				ChannelId: th.BasicChannel.Id,
				Message:   "reply @" + th.BasicUser.Username,
				UserId:    th.BasicUser2.Id,
				RootId:    rpost.Id,
			},
			notifyProps: model.StringMap{
				model.DesktopNotifyProp:        model.UserNotifyMention,
				model.CommentsNotifyProp:       model.CommentsNotifyNever,
				model.DesktopThreadsNotifyProp: model.UserNotifyMention,
			},
			mentions:  true,
			followers: true,
		},
	}

	// reset the cache so that channel member notify props includes all users
	th.App.Srv().Store().Channel().ClearCaches()

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			userWSClient, err := th.CreateWebSocketClient()
			require.NoError(t, err)
			defer userWSClient.Close()
			userWSClient.Listen()

			patch := &model.UserPatch{}
			patch.NotifyProps = model.CopyStringMap(th.BasicUser.NotifyProps)
			for k, v := range tc.notifyProps {
				patch.NotifyProps[k] = v
			}

			// update user's notify props
			_, _, err = th.Client.PatchUser(context.Background(), th.BasicUser.Id, patch)
			require.NoError(t, err)

			// post a reply on the thread
			_, appErr := th.App.CreatePostAsUser(th.Context, tc.post, th.Context.Session().Id, false)
			require.Nil(t, appErr)

			var caught bool
			func() {
				for {
					select {
					case ev := <-userWSClient.EventChannel:
						if ev.EventType() == model.WebsocketEventPosted {
							caught = true
							data := ev.GetData()

							users, ok := data["mentions"]
							require.Equal(t, tc.mentions, ok)
							if ok {
								require.EqualValues(t, "[\""+th.BasicUser.Id+"\"]", users)
							}

							users, ok = data["followers"]
							require.Equal(t, tc.followers, ok)

							if ok {
								require.EqualValues(t, "[\""+th.BasicUser.Id+"\"]", users)
							}
						}
					case <-time.After(5 * time.Second):
						return
					}
				}
			}()

			require.Truef(t, caught, "User should have received %s event", model.WebsocketEventPosted)
		})
	}
}

func TestGetPostStripActionIntegrations(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "with slack attachment action",
	}
	post.AddProp("attachments", []*model.SlackAttachment{
		{
			Text: "Slack Attachment Text",
			Fields: []*model.SlackAttachmentField{
				{
					Title: "Test Field",
					Value: "test value",
					Short: true,
				},
			},
			Actions: []*model.PostAction{
				{
					Type: "button",
					Name: "test-name",
					Integration: &model.PostActionIntegration{
						URL: "https://test.test/action",
						Context: map[string]any{
							"test-ctx": "some-value",
						},
					},
				},
			},
		},
	})

	rpost, resp, err2 := client.CreatePost(context.Background(), post)
	require.NoError(t, err2)
	CheckCreatedStatus(t, resp)

	actualPost, _, err := client.GetPost(context.Background(), rpost.Id, "")
	require.NoError(t, err)
	attachments, _ := actualPost.Props["attachments"].([]any)
	require.Equal(t, 1, len(attachments))
	att, _ := attachments[0].(map[string]any)
	require.NotNil(t, att)
	actions, _ := att["actions"].([]any)
	require.Equal(t, 1, len(actions))
	action, _ := actions[0].(map[string]any)
	require.NotNil(t, action)
	// integration must be omitted
	require.Nil(t, action["integration"])
}

func TestPostReminder(t *testing.T) {
	t.Skip("MM-60329")

	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	userWSClient, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	defer userWSClient.Close()
	userWSClient.Listen()

	targetTime := time.Now().UTC().Unix()
	resp, err := client.SetPostReminder(context.Background(), &model.PostReminder{
		TargetTime: targetTime,
		PostId:     th.BasicPost.Id,
		UserId:     th.BasicUser.Id,
	})
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	post, _, err := client.GetPost(context.Background(), th.BasicPost.Id, "")
	require.NoError(t, err)

	user, _, err := client.GetUser(context.Background(), post.UserId, "")
	require.NoError(t, err)

	var caught bool
	func() {
		for {
			select {
			case ev := <-userWSClient.EventChannel:
				if ev.EventType() == model.WebsocketEventEphemeralMessage {
					caught = true
					data := ev.GetData()

					post, ok := data["post"].(string)
					require.True(t, ok)

					var parsedPost model.Post
					err := json.Unmarshal([]byte(post), &parsedPost)
					require.NoError(t, err)

					assert.Equal(t, model.PostTypeEphemeral, parsedPost.Type)
					assert.Equal(t, th.BasicUser.Id, parsedPost.UserId)
					assert.Equal(t, th.BasicPost.Id, parsedPost.RootId)

					require.Equal(t, float64(targetTime), parsedPost.GetProp("target_time").(float64))
					require.Equal(t, th.BasicPost.Id, parsedPost.GetProp("post_id").(string))
					require.Equal(t, user.Username, parsedPost.GetProp("username").(string))
					require.Equal(t, th.BasicTeam.Name, parsedPost.GetProp("team_name").(string))
					return
				}
			case <-time.After(5 * time.Second):
				return
			}
		}
	}()

	require.Truef(t, caught, "User should have received %s event", model.WebsocketEventEphemeralMessage)
}

func TestPostGetInfo(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
	th.RemovePermissionFromRole(model.PermissionManagePrivateChannelMembers.Id, model.SystemUserRoleId)
	th.RemovePermissionFromRole(model.PermissionManagePrivateChannelMembers.Id, model.ChannelUserRoleId)
	th.RemovePermissionFromRole(model.PermissionManagePrivateChannelMembers.Id, model.TeamUserRoleId)

	client := th.Client
	sysadminClient := th.SystemAdminClient
	_, _, err := sysadminClient.AddTeamMember(context.Background(), th.BasicTeam.Id, th.SystemAdminUser.Id)
	require.NoError(t, err)

	openChannel, _, err := client.CreateChannel(context.Background(), &model.Channel{TeamId: th.BasicTeam.Id, Type: model.ChannelTypeOpen, Name: "open-channel", DisplayName: "Open Channel"})
	require.NoError(t, err)
	_, _, err = sysadminClient.AddChannelMember(context.Background(), openChannel.Id, th.SystemAdminUser.Id)
	require.NoError(t, err)
	openPost, _, err := client.CreatePost(context.Background(), &model.Post{ChannelId: openChannel.Id})
	require.NoError(t, err)

	privateChannel, _, err := sysadminClient.CreateChannel(context.Background(), &model.Channel{TeamId: th.BasicTeam.Id, Type: model.ChannelTypePrivate, Name: "private-channel", DisplayName: "Private Channel"})
	require.NoError(t, err)
	privatePost, _, err := sysadminClient.CreatePost(context.Background(), &model.Post{ChannelId: privateChannel.Id})
	require.NoError(t, err)

	privateChannelBasicUser, _, err := client.CreateChannel(context.Background(), &model.Channel{TeamId: th.BasicTeam.Id, Type: model.ChannelTypePrivate, Name: "private-channel-basic-user", DisplayName: "Private Channel - Basic User"})
	require.NoError(t, err)
	privatePostBasicUser, _, err := client.CreatePost(context.Background(), &model.Post{ChannelId: privateChannelBasicUser.Id})
	require.NoError(t, err)

	user3 := th.CreateUser()
	gmChannel, _, err := client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, user3.Id})
	require.NoError(t, err)
	gmPost, _, err := client.CreatePost(context.Background(), &model.Post{ChannelId: gmChannel.Id})
	require.NoError(t, err)

	dmChannel, _, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
	require.NoError(t, err)
	dmPost, _, err := client.CreatePost(context.Background(), &model.Post{ChannelId: dmChannel.Id})
	require.NoError(t, err)

	openTeam, _, err := sysadminClient.CreateTeam(context.Background(), &model.Team{Type: model.TeamOpen, Name: "open-team", DisplayName: "Open Team", AllowOpenInvite: true})
	require.NoError(t, err)
	openTeamOpenChannel, _, err := sysadminClient.CreateChannel(context.Background(), &model.Channel{TeamId: openTeam.Id, Type: model.ChannelTypeOpen, Name: "open-team-open-channel", DisplayName: "Open Team - Open Channel"})
	require.NoError(t, err)
	openTeamOpenPost, _, err := sysadminClient.CreatePost(context.Background(), &model.Post{ChannelId: openTeamOpenChannel.Id})
	require.NoError(t, err)

	// Alt team is a team without the sysadmin in it.
	altOpenTeam, _, err := client.CreateTeam(context.Background(), &model.Team{Type: model.TeamOpen, Name: "alt-open-team", DisplayName: "Alt Open Team", AllowOpenInvite: true})
	require.NoError(t, err)
	altOpenTeamOpenChannel, _, err := client.CreateChannel(context.Background(), &model.Channel{TeamId: altOpenTeam.Id, Type: model.ChannelTypeOpen, Name: "alt-open-team-open-channel", DisplayName: "Open Team - Open Channel"})
	require.NoError(t, err)
	altOpenTeamOpenPost, _, err := client.CreatePost(context.Background(), &model.Post{ChannelId: altOpenTeamOpenChannel.Id})
	require.NoError(t, err)

	inviteTeam, _, err := sysadminClient.CreateTeam(context.Background(), &model.Team{Type: model.TeamInvite, Name: "invite-team", DisplayName: "Invite Team"})
	require.NoError(t, err)
	inviteTeamOpenChannel, _, err := sysadminClient.CreateChannel(context.Background(), &model.Channel{TeamId: inviteTeam.Id, Type: model.ChannelTypeOpen, Name: "invite-team-open-channel", DisplayName: "Invite Team - Open Channel"})
	require.NoError(t, err)
	inviteTeamOpenPost, _, err := sysadminClient.CreatePost(context.Background(), &model.Post{ChannelId: inviteTeamOpenChannel.Id})
	require.NoError(t, err)

	testCases := []struct {
		name             string
		team             *model.Team
		hasJoinedTeam    bool
		channel          *model.Channel
		hasJoinedChannel bool
		post             *model.Post
		client           *model.Client4
		hasAccess        bool
	}{
		// Open channel - Current Team
		{
			name:             "Open post - Current team - Basic user",
			team:             th.BasicTeam,
			hasJoinedTeam:    true,
			channel:          openChannel,
			hasJoinedChannel: true,
			post:             openPost,
			client:           client,
			hasAccess:        true,
		},
		{
			name:             "Open post - Current team - Sysadmin user",
			team:             th.BasicTeam,
			hasJoinedTeam:    true,
			channel:          openChannel,
			hasJoinedChannel: true,
			post:             openPost,
			client:           sysadminClient,
			hasAccess:        true,
		},

		// Private channel - Current Team
		{
			name:      "Private post by sysadmin - Current team - Basic user",
			team:      th.BasicTeam,
			channel:   privateChannel,
			post:      privatePost,
			client:    client,
			hasAccess: false,
		},
		{
			name:             "Private post by sysadmin - Current team - Sysadmin user",
			team:             th.BasicTeam,
			hasJoinedTeam:    true,
			channel:          privateChannel,
			hasJoinedChannel: true,
			post:             privatePost,
			client:           sysadminClient,
			hasAccess:        true,
		},
		{
			name:             "Private post by basic user - Current team - Basic user",
			team:             th.BasicTeam,
			hasJoinedTeam:    true,
			channel:          privateChannelBasicUser,
			hasJoinedChannel: true,
			post:             privatePostBasicUser,
			client:           client,
			hasAccess:        true,
		},
		{
			name:             "Private post by basic user - Current team - Sysadmin user",
			team:             th.BasicTeam,
			hasJoinedTeam:    true,
			channel:          privateChannelBasicUser,
			hasJoinedChannel: false,
			post:             privatePostBasicUser,
			client:           sysadminClient,
			hasAccess:        true,
		},

		// GM channel
		{
			name:             "GM post - Current team - Basic user",
			team:             nil,
			channel:          gmChannel,
			hasJoinedChannel: true,
			post:             gmPost,
			client:           client,
			hasAccess:        true,
		},
		{
			name:      "GM post - Current team - Sysadmin user",
			team:      nil,
			channel:   gmChannel,
			post:      gmPost,
			client:    sysadminClient,
			hasAccess: false,
		},

		// DM channel
		{
			name:             "DM post - Current team - Basic user",
			team:             nil,
			channel:          dmChannel,
			hasJoinedChannel: true,
			post:             dmPost,
			client:           client,
			hasAccess:        true,
		},
		{
			name:      "DM post - Current team - Sysadmin user",
			team:      nil,
			channel:   dmChannel,
			post:      dmPost,
			client:    sysadminClient,
			hasAccess: false,
		},

		// Open channel - Open Team
		{
			name:             "Open post - Open team - Basic user",
			team:             openTeam,
			hasJoinedTeam:    false,
			channel:          openTeamOpenChannel,
			hasJoinedChannel: false,
			post:             openTeamOpenPost,
			client:           client,
			hasAccess:        true,
		},
		{
			name:             "Open post - Open team - Sysadmin user",
			team:             openTeam,
			hasJoinedTeam:    true,
			channel:          openTeamOpenChannel,
			hasJoinedChannel: true,
			post:             openTeamOpenPost,
			client:           sysadminClient,
			hasAccess:        true,
		},

		// Open channel - Alt Open Team
		{
			name:             "Open post - Alt open team - Basic user",
			team:             altOpenTeam,
			hasJoinedTeam:    true,
			channel:          altOpenTeamOpenChannel,
			hasJoinedChannel: true,
			post:             altOpenTeamOpenPost,
			client:           client,
			hasAccess:        true,
		},
		{
			name:             "Open post - Alt open team - Sysadmin user",
			team:             altOpenTeam,
			hasJoinedTeam:    false,
			channel:          altOpenTeamOpenChannel,
			hasJoinedChannel: false,
			post:             altOpenTeamOpenPost,
			client:           sysadminClient,
			hasAccess:        true,
		},

		// Open channel - Invite Team
		{
			name:      "Open post - Invite team - Basic user",
			team:      inviteTeam,
			channel:   inviteTeamOpenChannel,
			post:      inviteTeamOpenPost,
			client:    client,
			hasAccess: false,
		},
		{
			name:             "Open post - Invite team - Sysadmin user",
			team:             inviteTeam,
			hasJoinedTeam:    true,
			channel:          inviteTeamOpenChannel,
			hasJoinedChannel: true,
			post:             inviteTeamOpenPost,
			client:           sysadminClient,
			hasAccess:        true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			info, resp, err := tc.client.GetPostInfo(context.Background(), tc.post.Id)
			if !tc.hasAccess {
				require.Error(t, err)
				CheckNotFoundStatus(t, resp)
				return
			}

			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, tc.channel.Id, info.ChannelId)
			require.Equal(t, tc.channel.Type, info.ChannelType)
			require.Equal(t, tc.channel.DisplayName, info.ChannelDisplayName)
			require.Equal(t, tc.hasJoinedChannel, info.HasJoinedChannel)
			if tc.team != nil {
				teamType := "I"
				if tc.team.AllowOpenInvite {
					teamType = "O"
				}
				require.Equal(t, tc.team.Id, info.TeamId)
				require.Equal(t, teamType, info.TeamType)
				require.Equal(t, tc.team.DisplayName, info.TeamDisplayName)
				require.Equal(t, tc.hasJoinedTeam, info.HasJoinedTeam)
			}
		})
	}
}

func TestAcknowledgePost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
	client := th.Client

	post := th.BasicPost
	ack, _, err := client.AcknowledgePost(context.Background(), post.Id, th.BasicUser.Id)
	require.NoError(t, err)

	acks, appErr := th.App.GetAcknowledgementsForPost(post.Id)
	require.Nil(t, appErr)
	require.Len(t, acks, 1)
	require.Equal(t, acks[0], ack)

	_, resp, err := client.AcknowledgePost(context.Background(), "junk", th.BasicUser.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.AcknowledgePost(context.Background(), GenerateTestID(), th.BasicUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.AcknowledgePost(context.Background(), post.Id, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.AcknowledgePost(context.Background(), post.Id, th.BasicUser2.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.AcknowledgePost(context.Background(), post.Id, th.BasicUser.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.AcknowledgePost(context.Background(), post.Id, th.SystemAdminUser.Id)
	require.NoError(t, err)
}

func TestUnacknowledgePost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
	client := th.Client

	post := th.BasicPost
	ack, _, err := client.AcknowledgePost(context.Background(), post.Id, th.BasicUser.Id)
	require.NoError(t, err)

	acks, appErr := th.App.GetAcknowledgementsForPost(post.Id)
	require.Nil(t, appErr)
	require.Len(t, acks, 1)
	require.Equal(t, acks[0], ack)

	resp, err := client.UnacknowledgePost(context.Background(), "junk", th.BasicUser.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.UnacknowledgePost(context.Background(), GenerateTestID(), th.BasicUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	resp, err = client.UnacknowledgePost(context.Background(), post.Id, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.UnacknowledgePost(context.Background(), post.Id, th.BasicUser2.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.UnacknowledgePost(context.Background(), post.Id, th.BasicUser.Id)
	require.NoError(t, err)

	acks, appErr = th.App.GetAcknowledgementsForPost(post.Id)
	require.Nil(t, appErr)
	require.Len(t, acks, 0)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	resp, err = client.UnacknowledgePost(context.Background(), post.Id, th.BasicUser.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}
