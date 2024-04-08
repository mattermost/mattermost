// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"

	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func getLicWithSkuShortName(skuShortName string) *model.License {
	return &model.License{
		Features: &model.Features{},
		Customer: &model.Customer{
			Name:  "TestName",
			Email: "test@example.com",
		},
		SkuName:      "SKU NAME",
		SkuShortName: skuShortName,
		StartsAt:     model.GetMillis() - 1000,
		ExpiresAt:    model.GetMillis() + 100000,
	}
}

func TestSendNotifications(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)

	post1, createPostErr := th.App.CreatePostMissingChannel(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "@" + th.BasicUser2.Username,
		Type:      model.PostTypeAddToChannel,
		Props:     map[string]any{model.PostPropsAddedUserId: "junk"},
	}, true, true)
	require.Nil(t, createPostErr)

	t.Run("Basic channel", func(t *testing.T) {
		mentions, err := th.App.SendNotifications(th.Context, post1, th.BasicTeam, th.BasicChannel, th.BasicUser, nil, true)
		require.NoError(t, err)
		require.NotNil(t, mentions)
		require.True(t, slices.Contains(mentions, th.BasicUser2.Id), "mentions", mentions)
	})

	t.Run("license is required for group mention", func(t *testing.T) {
		group := th.CreateGroup()
		group.AllowReference = true
		group, updateErr := th.App.UpdateGroup(group)
		require.Nil(t, updateErr)

		_, upsertErr := th.App.UpsertGroupMember(group.Id, th.BasicUser2.Id)
		require.Nil(t, upsertErr)

		groupMentionPost := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   fmt.Sprintf("hello @%s group", *group.Name),
			CreateAt:  model.GetMillis() - 10000,
		}
		groupMentionPost, createPostErr := th.App.CreatePost(th.Context, groupMentionPost, th.BasicChannel, false, true)
		require.Nil(t, createPostErr)

		mentions, err := th.App.SendNotifications(th.Context, groupMentionPost, th.BasicTeam, th.BasicChannel, th.BasicUser, nil, true)
		require.NoError(t, err)
		require.NotNil(t, mentions)
		require.Len(t, mentions, 0)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		mentions, err = th.App.SendNotifications(th.Context, groupMentionPost, th.BasicTeam, th.BasicChannel, th.BasicUser, nil, true)
		require.NoError(t, err)
		require.NotNil(t, mentions)
		require.Len(t, mentions, 1)
	})

	t.Run("message in DM generate mention", func(t *testing.T) {
		dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)

		post2, appErr := th.App.CreatePostMissingChannel(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: dm.Id,
			Message:   "dm message",
		}, true, true)
		require.Nil(t, appErr)

		mentions, err := th.App.SendNotifications(th.Context, post2, th.BasicTeam, dm, th.BasicUser, nil, true)
		require.NoError(t, err)
		require.NotNil(t, mentions)

		_, appErr = th.App.UpdateActive(th.Context, th.BasicUser2, false)
		require.Nil(t, appErr)
		appErr = th.App.Srv().InvalidateAllCaches()
		require.Nil(t, appErr)

		post3, appErr := th.App.CreatePostMissingChannel(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: dm.Id,
			Message:   "dm message",
		}, true, true)
		require.Nil(t, appErr)

		mentions, err = th.App.SendNotifications(th.Context, post3, th.BasicTeam, dm, th.BasicUser, nil, true)
		require.NoError(t, err)
		require.NotNil(t, mentions)

		th.BasicChannel.DeleteAt = 1
		mentions, err = th.App.SendNotifications(th.Context, post1, th.BasicTeam, th.BasicChannel, th.BasicUser, nil, true)
		require.NoError(t, err)
		require.Empty(t, mentions)
	})

	t.Run("message in GM generate mention", func(t *testing.T) {
		users := []*model.User{}
		for i := 0; i < 2; i++ {
			user := th.CreateUser()
			users = append(users, user)
		}
		channel := th.CreateGroupChannel(th.Context, users[0], users[1])

		post2, appErr := th.App.CreatePostMissingChannel(th.Context, &model.Post{
			UserId:    users[0].Id,
			ChannelId: channel.Id,
			Message:   "gm message",
		}, true, true)
		require.Nil(t, appErr)

		mentions, err := th.App.SendNotifications(th.Context, post2, th.BasicTeam, channel, users[0], nil, true)
		require.NoError(t, err)
		require.NotNil(t, mentions)

		_, appErr = th.App.UpdateActive(th.Context, users[1], false)
		require.Nil(t, appErr)
		appErr = th.App.Srv().InvalidateAllCaches()
		require.Nil(t, appErr)

		post3, appErr := th.App.CreatePostMissingChannel(th.Context, &model.Post{
			UserId:    users[0].Id,
			ChannelId: channel.Id,
			Message:   "gm message",
		}, true, true)
		require.Nil(t, appErr)

		mentions, err = th.App.SendNotifications(th.Context, post3, th.BasicTeam, channel, users[0], nil, true)
		require.NoError(t, err)
		require.NotNil(t, mentions)

		th.BasicChannel.DeleteAt = 1
		mentions, err = th.App.SendNotifications(th.Context, post1, th.BasicTeam, th.BasicChannel, users[0], nil, true)
		require.NoError(t, err)
		require.Empty(t, mentions)
	})

	t.Run("replies to post created by OAuth bot should not notify user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		testUserNotNotified := func(t *testing.T, user *model.User) {
			rootPost := &model.Post{
				UserId:    user.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "a message",
				Props:     model.StringInterface{"from_webhook": "true", "override_username": "a bot"},
			}

			rootPost, appErr := th.App.CreatePostMissingChannel(th.Context, rootPost, false, true)
			require.Nil(t, appErr)

			childPost := &model.Post{
				UserId:    th.BasicUser2.Id,
				ChannelId: th.BasicChannel.Id,
				RootId:    rootPost.Id,
				Message:   "a reply",
			}
			childPost, appErr = th.App.CreatePostMissingChannel(th.Context, childPost, false, true)
			require.Nil(t, appErr)

			postList := model.PostList{
				Order: []string{rootPost.Id, childPost.Id},
				Posts: map[string]*model.Post{rootPost.Id: rootPost, childPost.Id: childPost},
			}
			mentions, err := th.App.SendNotifications(th.Context, childPost, th.BasicTeam, th.BasicChannel, th.BasicUser2, &postList, true)
			require.NoError(t, err)
			require.False(t, slices.Contains(mentions, user.Id))
		}

		var appErr *model.AppError
		th.BasicUser.NotifyProps[model.CommentsNotifyProp] = model.CommentsNotifyAny
		th.BasicUser, appErr = th.App.UpdateUser(th.Context, th.BasicUser, false)
		require.Nil(t, appErr)
		t.Run("user wants notifications on all comments", func(t *testing.T) {
			testUserNotNotified(t, th.BasicUser)
		})

		th.BasicUser.NotifyProps[model.CommentsNotifyProp] = model.CommentsNotifyRoot
		th.BasicUser, appErr = th.App.UpdateUser(th.Context, th.BasicUser, false)
		require.Nil(t, appErr)
		t.Run("user wants notifications on root comment", func(t *testing.T) {
			testUserNotNotified(t, th.BasicUser)
		})
	})
}

func TestSendNotifications_MentionsFollowers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddUserToChannel(th.BasicUser2, th.BasicChannel)

	sender := th.CreateUser()

	th.LinkUserToTeam(sender, th.BasicTeam)
	member := th.AddUserToChannel(sender, th.BasicChannel)

	eventTypesFilter := []model.WebsocketEventType{model.WebsocketEventPosted}

	t.Run("should inform each user if they were mentioned by a post", func(t *testing.T) {
		messages1, closeWS1 := connectFakeWebSocket(t, th, th.BasicUser.Id, "", eventTypesFilter)
		defer closeWS1()

		messages2, closeWS2 := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", eventTypesFilter)
		defer closeWS2()

		// First post mentioning the whole channel
		post := &model.Post{
			UserId:    sender.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "@channel",
		}
		_, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, th.BasicChannel, sender, nil, false)
		require.NoError(t, err)

		received1 := <-messages1
		require.Equal(t, model.WebsocketEventPosted, received1.EventType())
		assertUnmarshalsTo(t, []string{th.BasicUser.Id}, received1.GetData()["mentions"])

		received2 := <-messages2
		require.Equal(t, model.WebsocketEventPosted, received2.EventType())
		assertUnmarshalsTo(t, []string{th.BasicUser2.Id}, received2.GetData()["mentions"])

		// Second post mentioning both users individually
		post = &model.Post{
			UserId:    sender.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   fmt.Sprintf("@%s @%s", th.BasicUser.Username, th.BasicUser2.Username),
		}
		_, err = th.App.SendNotifications(th.Context, post, th.BasicTeam, th.BasicChannel, sender, nil, false)
		require.NoError(t, err)

		received1 = <-messages1
		require.Equal(t, model.WebsocketEventPosted, received1.EventType())
		assertUnmarshalsTo(t, []string{th.BasicUser.Id}, received1.GetData()["mentions"])

		received2 = <-messages2
		require.Equal(t, model.WebsocketEventPosted, received2.EventType())
		assertUnmarshalsTo(t, []string{th.BasicUser2.Id}, received2.GetData()["mentions"])

		// Third post mentioning a single user
		post = &model.Post{
			UserId:    sender.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "@" + th.BasicUser.Username,
		}
		_, err = th.App.SendNotifications(th.Context, post, th.BasicTeam, th.BasicChannel, sender, nil, false)
		require.NoError(t, err)

		received1 = <-messages1
		require.Equal(t, model.WebsocketEventPosted, received1.EventType())
		assertUnmarshalsTo(t, []string{th.BasicUser.Id}, received1.GetData()["mentions"])

		received2 = <-messages2
		require.Equal(t, model.WebsocketEventPosted, received2.EventType())
		assert.Nil(t, received2.GetData()["mentions"])
	})

	t.Run("should inform each user in a group if they were mentioned by a post", func(t *testing.T) {
		// Make the sender a channel_admin because that's needed for group mentions
		originalRoles := member.Roles
		member.Roles = "channel_user channel_admin"
		_, appErr := th.App.UpdateChannelMemberRoles(th.Context, member.ChannelId, member.UserId, member.Roles)
		require.Nil(t, appErr)

		defer func() {
			th.App.UpdateChannelMemberRoles(th.Context, member.ChannelId, member.UserId, originalRoles)
		}()

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuEnterprise))

		// Make a group and add users
		group := th.CreateGroup()
		group.AllowReference = true
		group, updateErr := th.App.UpdateGroup(group)
		require.Nil(t, updateErr)

		_, upsertErr := th.App.UpsertGroupMember(group.Id, th.BasicUser.Id)
		require.Nil(t, upsertErr)
		_, upsertErr = th.App.UpsertGroupMember(group.Id, th.BasicUser2.Id)
		require.Nil(t, upsertErr)

		// Set up the websockets
		messages1, closeWS1 := connectFakeWebSocket(t, th, th.BasicUser.Id, "", eventTypesFilter)
		defer closeWS1()

		messages2, closeWS2 := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", eventTypesFilter)
		defer closeWS2()

		// Confirm permissions for group mentions are correct
		post := &model.Post{
			UserId:    sender.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "@" + *group.Name,
		}
		require.True(t, th.App.allowGroupMentions(th.Context, post))

		// Test sending notifications
		_, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, th.BasicChannel, sender, nil, false)
		require.NoError(t, err)

		received1 := <-messages1
		require.Equal(t, model.WebsocketEventPosted, received1.EventType())
		assertUnmarshalsTo(t, []string{th.BasicUser.Id}, received1.GetData()["mentions"])

		received2 := <-messages2
		require.Equal(t, model.WebsocketEventPosted, received2.EventType())
		assertUnmarshalsTo(t, []string{th.BasicUser2.Id}, received2.GetData()["mentions"])
	})

	t.Run("should inform each user if they are following a thread that was posted in", func(t *testing.T) {
		t.Log("BasicUser ", th.BasicUser.Id)
		t.Log("sender ", sender.Id)
		messages1, closeWS1 := connectFakeWebSocket(t, th, th.BasicUser.Id, "", eventTypesFilter)
		defer closeWS1()

		messages2, closeWS2 := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", eventTypesFilter)
		defer closeWS2()

		// Reply to a post made by BasicUser
		post := &model.Post{
			UserId:    sender.Id,
			ChannelId: th.BasicChannel.Id,
			RootId:    th.BasicPost.Id,
			Message:   "This is a test",
		}

		// Use CreatePost instead of SendNotifications here since we need that to set up some threads state
		_, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, false, false)
		require.Nil(t, appErr)

		received1 := <-messages1
		require.Equal(t, model.WebsocketEventPosted, received1.EventType())
		assertUnmarshalsTo(t, []string{th.BasicUser.Id}, received1.GetData()["followers"])

		received2 := <-messages2
		require.Equal(t, model.WebsocketEventPosted, received2.EventType())
		assert.Nil(t, received2.GetData()["followers"])
	})

	t.Run("should not include broadcast hook information in messages sent to users", func(t *testing.T) {
		messages1, closeWS1 := connectFakeWebSocket(t, th, th.BasicUser.Id, "", eventTypesFilter)
		defer closeWS1()

		messages2, closeWS2 := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", eventTypesFilter)
		defer closeWS2()

		// For a post mentioning only one user, nobody in the channel should receive information about the broadcast hooks
		post := &model.Post{
			UserId:    sender.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   fmt.Sprintf("@%s", th.BasicUser.Username),
		}
		_, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, th.BasicChannel, sender, nil, false)
		require.NoError(t, err)

		received1 := <-messages1
		require.Equal(t, model.WebsocketEventPosted, received1.EventType())
		assert.Nil(t, received1.GetBroadcast().BroadcastHooks)
		assert.Nil(t, received1.GetBroadcast().BroadcastHookArgs)

		received2 := <-messages2
		require.Equal(t, model.WebsocketEventPosted, received2.EventType())
		assert.Nil(t, received2.GetBroadcast().BroadcastHooks)
		assert.Nil(t, received2.GetBroadcast().BroadcastHookArgs)
	})

	t.Run("should sanitize the post if there is an error", func(t *testing.T) {
		messages, closeWS1 := connectFakeWebSocket(t, th, th.BasicUser.Id, "", eventTypesFilter)
		defer closeWS1()

		linkedPostId := "123456789"
		postURL := fmt.Sprintf("%s/%s/pl/%s", th.App.GetSiteURL(), th.BasicTeam.Name, linkedPostId)
		post := &model.Post{
			UserId:    sender.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   postURL,
			Metadata: &model.PostMetadata{
				Embeds: []*model.PostEmbed{
					{
						Type: model.PostEmbedPermalink,
						URL:  postURL,
						Data: &model.Post{},
					},
				},
			},
		}
		post.SetProps(model.StringInterface{model.PostPropsPreviewedPost: linkedPostId})

		_, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, th.BasicChannel, sender, nil, false)
		require.NoError(t, err)

		received := <-messages
		require.Equal(t, model.WebsocketEventPosted, received.EventType())
		receivedPost := &model.Post{}
		err = json.Unmarshal([]byte(received.GetData()["post"].(string)), &receivedPost)
		require.NoError(t, err)
		assert.Equal(t, postURL, receivedPost.Message)
		assert.Nil(t, receivedPost.Metadata.Embeds)
	})
}

func assertUnmarshalsTo(t *testing.T, expected any, actual any) {
	t.Helper()

	val, err := json.Marshal(expected)
	require.NoError(t, err)

	assert.JSONEq(t, string(val), actual.(string))
}

func connectFakeWebSocket(t *testing.T, th *TestHelper, userID string, connectionID string, eventTypes []model.WebsocketEventType) (chan *model.WebSocketEvent, func()) {
	var session *model.Session
	var server *httptest.Server
	var webConn *platform.WebConn

	closeWS := func() {
		if webConn != nil {
			webConn.Close()
		}
		if server != nil {
			server.Close()
		}
		if session != nil {
			appErr := th.App.RevokeSession(th.Context, session)
			require.Nil(t, appErr)
		}
	}

	eventTypesSet := make(map[model.WebsocketEventType]bool)
	for _, eventType := range eventTypes {
		eventTypesSet[eventType] = true
	}

	// Create a session for the user's connection
	var appErr *model.AppError
	session, appErr = th.App.CreateSession(th.Context, &model.Session{
		UserId: userID,
	})
	require.Nil(t, appErr)

	// Create a channel and an HTTP server to handle incoming WS events
	messages := make(chan *model.WebSocketEvent)
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := &websocket.Upgrader{}

		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Log("Received error when upgrading WebSocket connection", err)
			return
		}
		defer c.Close()

		for {
			_, reader, err := c.NextReader()
			if err != nil {
				t.Log("Received error when reading from WebSocket connection", err)
				break
			}

			msg, err := model.WebSocketEventFromJSON(reader)
			if err != nil {
				t.Log("Received error when decoding from WebSocket connection", err)
				break
			}

			if !eventTypesSet[msg.EventType()] {
				continue
			}

			messages <- msg
		}
	}))

	// Connect the WebSocket
	d := websocket.Dialer{}
	ws, _, err := d.Dial("ws://"+server.Listener.Addr().String(), nil)
	require.NoError(t, err)

	// Register the WebSocket with the server as a WebConn
	if connectionID == "" {
		connectionID = model.NewId()
	}
	webConn = th.App.Srv().Platform().NewWebConn(&platform.WebConnConfig{
		WebSocket:    ws,
		Session:      *session,
		TFunc:        i18n.IdentityTfunc(),
		Locale:       "en",
		ConnectionID: connectionID,
	}, th.App, th.App.Channels())
	th.App.Srv().Platform().HubRegister(webConn)

	// Start reading from it
	go webConn.Pump()

	return messages, closeWS
}

func TestConnectFakeWebSocket(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	teamID := th.BasicTeam.Id
	userID := th.BasicUser.Id

	messages, closeWS := connectFakeWebSocket(t, th, userID, "", []model.WebsocketEventType{model.WebsocketEventPosted, model.WebsocketEventPostEdited})
	defer closeWS()

	msg := model.NewWebSocketEvent(model.WebsocketEventPosted, teamID, "", "", nil, "")
	th.App.Publish(msg)

	msg = model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", "", userID, nil, "")
	msg.Add("key1", "value1")
	msg.Add("key2", 2)
	msg.Add("key3", []string{"three", "trois"})
	th.App.Publish(msg)

	received := <-messages
	require.Equal(t, model.WebsocketEventPosted, received.EventType())
	assert.Equal(t, teamID, received.GetBroadcast().TeamId)

	received = <-messages
	require.Equal(t, model.WebsocketEventPostEdited, received.EventType())
	assert.Equal(t, userID, received.GetBroadcast().UserId)
	// These type changes are annoying but unavoidable because event data is untyped
	assert.Equal(t, map[string]any{
		"key1": "value1",
		"key2": float64(2),
		"key3": []any{"three", "trois"},
	}, received.GetData())
}

func TestSendNotificationsWithManyUsers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	users := []*model.User{}
	for i := 0; i < 10; i++ {
		user := th.CreateUser()
		th.LinkUserToTeam(user, th.BasicTeam)
		th.App.AddUserToChannel(th.Context, user, th.BasicChannel, false)
		users = append(users, user)
	}

	_, appErr1 := th.App.CreatePostMissingChannel(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "@channel",
		Type:      model.PostTypeAddToChannel,
		Props:     map[string]any{model.PostPropsAddedUserId: "junk"},
	}, true, true)
	require.Nil(t, appErr1)

	// Each user should have a mention count of exactly 1 in the DB at this point.
	t.Run("1-mention", func(t *testing.T) {
		for i, user := range users {
			t.Run(fmt.Sprintf("user-%d", i+1), func(t *testing.T) {
				channelUnread, appErr2 := th.Server.Store().Channel().GetChannelUnread(th.BasicChannel.Id, user.Id)
				require.NoError(t, appErr2)
				assert.Equal(t, int64(1), channelUnread.MentionCount)
			})
		}
	})

	_, appErr1 = th.App.CreatePostMissingChannel(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "@channel",
		Type:      model.PostTypeAddToChannel,
		Props:     map[string]any{model.PostPropsAddedUserId: "junk"},
	}, true, true)
	require.Nil(t, appErr1)

	// Now each user should have a mention count of exactly 2 in the DB.
	t.Run("2-mentions", func(t *testing.T) {
		for i, user := range users {
			t.Run(fmt.Sprintf("user-%d", i+1), func(t *testing.T) {
				channelUnread, appErr2 := th.Server.Store().Channel().GetChannelUnread(th.BasicChannel.Id, user.Id)
				require.NoError(t, appErr2)
				assert.Equal(t, int64(2), channelUnread.MentionCount)
			})
		}
	})
}

func TestSendOutOfChannelMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel

	user1 := th.BasicUser
	user2 := th.BasicUser2

	t.Run("should send ephemeral post when there is an out of channel mention", func(t *testing.T) {
		post := &model.Post{}
		potentialMentions := []string{user2.Username}

		sent, err := th.App.sendOutOfChannelMentions(th.Context, user1, post, channel, potentialMentions)

		assert.NoError(t, err)
		assert.True(t, sent)
	})

	t.Run("should not send ephemeral post when there are no out of channel mentions", func(t *testing.T) {
		post := &model.Post{}
		potentialMentions := []string{"not a user"}

		sent, err := th.App.sendOutOfChannelMentions(th.Context, user1, post, channel, potentialMentions)

		assert.NoError(t, err)
		assert.False(t, sent)
	})

	t.Run("should send ephemeral post when there is an out of team mention", func(t *testing.T) {
		outOfTeamUser := th.CreateUser()
		post := &model.Post{}
		potentialMentions := []string{outOfTeamUser.Username}

		sent, err := th.App.sendOutOfChannelMentions(th.Context, user1, post, channel, potentialMentions)

		assert.NoError(t, err)
		assert.True(t, sent)
	})
}

func TestFilterOutOfChannelMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel

	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser()
	guest := th.CreateGuest()
	user4 := th.CreateUser()
	guestAndUser4Channel := th.CreateChannel(th.Context, th.BasicTeam)
	defer th.App.PermanentDeleteUser(th.Context, guest)
	th.LinkUserToTeam(user3, th.BasicTeam)
	th.LinkUserToTeam(user4, th.BasicTeam)
	th.LinkUserToTeam(guest, th.BasicTeam)
	th.App.AddUserToChannel(th.Context, guest, channel, false)
	th.App.AddUserToChannel(th.Context, user4, guestAndUser4Channel, false)
	th.App.AddUserToChannel(th.Context, guest, guestAndUser4Channel, false)

	t.Run("should return users not in the channel", func(t *testing.T) {
		post := &model.Post{}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, channel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Len(t, outOfChannelUsers, 2)
		assert.True(t, (outOfChannelUsers[0].Id == user2.Id || outOfChannelUsers[1].Id == user2.Id))
		assert.True(t, (outOfChannelUsers[0].Id == user3.Id || outOfChannelUsers[1].Id == user3.Id))
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should return users not in the team", func(t *testing.T) {
		notThisTeamUser1 := th.CreateUser()
		notThisTeamUser2 := th.CreateUser()
		post := &model.Post{}
		potentialMentions := []string{notThisTeamUser1.Username, notThisTeamUser2.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, channel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 2)
		assert.Nil(t, outOfChannelUsers)
		assert.True(t, (outOfTeamUsers[0].Id == notThisTeamUser1.Id || outOfTeamUsers[1].Id == notThisTeamUser1.Id))
		assert.True(t, (outOfTeamUsers[0].Id == notThisTeamUser2.Id || outOfTeamUsers[1].Id == notThisTeamUser2.Id))
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should return only visible users not in the channel (for guests)", func(t *testing.T) {
		post := &model.Post{}
		potentialMentions := []string{user2.Username, user3.Username, user4.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(th.Context, guest, post, channel, potentialMentions)

		require.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		require.Len(t, outOfChannelUsers, 1)
		assert.Equal(t, user4.Id, outOfChannelUsers[0].Id)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return results for a system message", func(t *testing.T) {
		post := &model.Post{
			Type: model.PostTypeAddRemove,
		}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, channel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return results for a direct message", func(t *testing.T) {
		post := &model.Post{}
		directChannel := &model.Channel{
			Type: model.ChannelTypeDirect,
		}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, directChannel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return results for a group message", func(t *testing.T) {
		post := &model.Post{}
		groupChannel := &model.Channel{
			Type: model.ChannelTypeGroup,
		}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, groupChannel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return inactive users", func(t *testing.T) {
		inactiveUser := th.CreateUser()
		inactiveUser, appErr := th.App.UpdateActive(th.Context, inactiveUser, false)
		require.Nil(t, appErr)

		post := &model.Post{}
		potentialMentions := []string{inactiveUser.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, channel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return bot users", func(t *testing.T) {
		botUser := th.CreateBot()

		post := &model.Post{}
		potentialMentions := []string{botUser.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, channel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return results for non-existent users", func(t *testing.T) {
		post := &model.Post{}
		potentialMentions := []string{"foo", "bar"}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, channel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should separate users not in the channel from users not in the group", func(t *testing.T) {
		nonChannelMember := th.CreateUser()
		th.LinkUserToTeam(nonChannelMember, th.BasicTeam)
		nonGroupMember := th.CreateUser()
		th.LinkUserToTeam(nonGroupMember, th.BasicTeam)

		group := th.CreateGroup()
		_, appErr := th.App.UpsertGroupMember(group.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.UpsertGroupMember(group.Id, nonChannelMember.Id)
		require.Nil(t, appErr)

		constrainedChannel := th.CreateChannel(th.Context, th.BasicTeam)
		constrainedChannel.GroupConstrained = model.NewBool(true)
		constrainedChannel, appErr = th.App.UpdateChannel(th.Context, constrainedChannel)
		require.Nil(t, appErr)

		_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
			GroupId:    group.Id,
			Type:       model.GroupSyncableTypeChannel,
			SyncableId: constrainedChannel.Id,
		})
		require.Nil(t, appErr)

		post := &model.Post{}
		potentialMentions := []string{nonChannelMember.Username, nonGroupMember.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, constrainedChannel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Len(t, outOfChannelUsers, 1)
		assert.Equal(t, nonChannelMember.Id, outOfChannelUsers[0].Id)
		assert.Len(t, outOfGroupUsers, 1)
		assert.Equal(t, nonGroupMember.Id, outOfGroupUsers[0].Id)
	})
}

func TestGetExplicitMentions(t *testing.T) {
	id1 := model.NewId()
	id2 := model.NewId()
	id3 := model.NewId()

	groupID1 := model.NewId()

	for name, tc := range map[string]struct {
		Message     string
		Attachments []*model.SlackAttachment
		Keywords    map[string][]string
		Groups      map[string]*model.Group
		Expected    *MentionResults
	}{
		"Nobody": {
			Message:  "this is a message",
			Keywords: map[string][]string{},
			Expected: &MentionResults{},
		},
		"NonexistentUser": {
			Message: "this is a message for @user",
			Expected: &MentionResults{
				OtherPotentialMentions: []string{"user"},
			},
		},
		"OnePerson": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithPeriodAtEndOfUsername": {
			Message:  "this is a message for @user.name.",
			Keywords: map[string][]string{"@user.name.": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithPeriodAtEndOfUsernameButNotSimilarName": {
			Message:  "this is a message for @user.name.",
			Keywords: map[string][]string{"@user.name.": {id1}, "@user.name": {id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonAtEndOfSentence": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithoutAtMention": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"this": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
				OtherPotentialMentions: []string{"user"},
			},
		},
		"OnePersonWithPeriodAfter": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithPeriodBefore": {
			Message:  "this is a message for .@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithColonAfter": {
			Message:  "this is a message for @user:",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithColonBefore": {
			Message:  "this is a message for :@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithHyphenAfter": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithHyphenBefore": {
			Message:  "this is a message for -@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultiplePeopleWithOneWord": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1, id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
				},
			},
		},
		"OneOfMultiplePeople": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1}, "@mention": {id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultiplePeopleWithMultipleWords": {
			Message:  "this is an @mention for @user",
			Keywords: map[string][]string{"@user": {id1}, "@mention": {id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
				},
			},
		},
		"Channel": {
			Message:  "this is an message for @channel",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				ChannelMentioned: true,
			},
		},

		"ChannelWithColonAtEnd": {
			Message:  "this is a message for @channel:",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				ChannelMentioned: true,
			},
		},
		"CapitalizedChannel": {
			Message:  "this is an message for @cHaNNeL",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				ChannelMentioned: true,
			},
		},
		"All": {
			Message:  "this is an message for @all",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				AllMentioned: true,
			},
		},
		"AllWithColonAtEnd": {
			Message:  "this is a message for @all:",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				AllMentioned: true,
			},
		},
		"CapitalizedAll": {
			Message:  "this is an message for @ALL",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				AllMentioned: true,
			},
		},
		"UserWithPeriod": {
			Message:  "user.period doesn't complicate things at all by including periods in their username",
			Keywords: map[string][]string{"user.period": {id1}, "user": {id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"AtUserWithColonAtEnd": {
			Message:  "this is a message for @user:",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"AtUserWithPeriodAtEndOfSentence": {
			Message:  "this is a message for @user.period.",
			Keywords: map[string][]string{"@user.period": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"UserWithPeriodAtEndOfSentence": {
			Message:  "this is a message for user.period.",
			Keywords: map[string][]string{"user.period": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"UserWithColonAtEnd": {
			Message:  "this is a message for user:",
			Keywords: map[string][]string{"user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"PotentialOutOfChannelUser": {
			Message:  "this is an message for @potential and @user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
				OtherPotentialMentions: []string{"potential"},
			},
		},
		"PotentialOutOfChannelUserWithPeriod": {
			Message: "this is an message for @potential.user",
			Expected: &MentionResults{
				OtherPotentialMentions: []string{"potential.user"},
			},
		},
		"InlineCode": {
			Message:  "`this shouldn't mention @channel at all`",
			Keywords: map[string][]string{},
			Expected: &MentionResults{},
		},
		"FencedCodeBlock": {
			Message:  "```\nthis shouldn't mention @channel at all\n```",
			Keywords: map[string][]string{},
			Expected: &MentionResults{},
		},
		"Emphasis": {
			Message:  "*@aaa @bbb @ccc*",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
					id3: KeywordMention,
				},
			},
		},
		"StrongEmphasis": {
			Message:  "**@aaa @bbb @ccc**",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
					id3: KeywordMention,
				},
			},
		},
		"Strikethrough": {
			Message:  "~~@aaa @bbb @ccc~~",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
					id3: KeywordMention,
				},
			},
		},
		"Heading": {
			Message:  "### @aaa",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"BlockQuote": {
			Message:  "> @aaa",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Emoji": {
			Message:  ":smile:",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &MentionResults{},
		},
		"NotEmoji": {
			Message:  "smile",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"UnclosedEmoji": {
			Message:  ":smile",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"UnopenedEmoji": {
			Message:  "smile:",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"IndentedCodeBlock": {
			Message:  "    this shouldn't mention @channel at all",
			Keywords: map[string][]string{},
			Expected: &MentionResults{},
		},
		"LinkTitle": {
			Message:  `[foo](this "shouldn't mention @channel at all")`,
			Keywords: map[string][]string{},
			Expected: &MentionResults{},
		},
		"MalformedInlineCode": {
			Message:  "`this should mention @channel``",
			Keywords: map[string][]string{},
			Expected: &MentionResults{
				ChannelMentioned: true,
			},
		},
		"MultibyteCharacter": {
			Message:  "My name is 萌",
			Keywords: map[string][]string{"萌": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterAtBeginningOfSentence": {
			Message:  "이메일을 보내다.",
			Keywords: map[string][]string{"이메일": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterInPartOfSentence": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"番茄": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterAtEndOfSentence": {
			Message:  "こんにちは、世界",
			Keywords: map[string][]string{"世界": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterTwiceInSentence": {
			Message:  "石橋さんが石橋を渡る",
			Keywords: map[string][]string{"石橋": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},

		// The following tests cover cases where the message mentions @user.name, so we shouldn't assume that
		// the user might be intending to mention some @user that isn't in the channel.
		"Don't include potential mention that's part of an actual mention (without trailing period)": {
			Message:  "this is an message for @user.name",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (with trailing period)": {
			Message:  "this is an message for @user.name.",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (with multiple trailing periods)": {
			Message:  "this is an message for @user.name...",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (containing and followed by multiple periods)": {
			Message:  "this is an message for @user...name...",
			Keywords: map[string][]string{"@user...name": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"should include the mentions from attachment text and preText": {
			Message: "this is an message for @user1",
			Attachments: []*model.SlackAttachment{
				{
					Text:    "this is a message For @user2",
					Pretext: "this is a message for @here",
				},
			},
			Keywords: map[string][]string{"@user1": {id1}, "@user2": {id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
				},
				HereMentioned: true,
			},
		},
		"Name on keywords is a prefix of a mention": {
			Message:  "@other @test-two",
			Keywords: map[string][]string{"@test": {model.NewId()}},
			Expected: &MentionResults{
				OtherPotentialMentions: []string{"other", "test-two"},
			},
		},
		"Name on mentions is a prefix of other mention": {
			Message:  "@other-one @other @other-two",
			Keywords: nil,
			Expected: &MentionResults{
				OtherPotentialMentions: []string{"other-one", "other", "other-two"},
			},
		},
		"No groups": {
			Message: "@nothing",
			Groups:  map[string]*model.Group{},
			Expected: &MentionResults{
				Mentions:               nil,
				OtherPotentialMentions: []string{"nothing"},
			},
		},
		"No matching groups": {
			Message: "@nothing",
			Groups:  map[string]*model.Group{groupID1: {Id: groupID1, Name: model.NewString("engineering")}},
			Expected: &MentionResults{
				Mentions:               nil,
				GroupMentions:          nil,
				OtherPotentialMentions: []string{"nothing"},
			},
		},
		"matching group with no @": {
			Message: "engineering",
			Groups:  map[string]*model.Group{groupID1: {Id: groupID1, Name: model.NewString("engineering")}},
			Expected: &MentionResults{
				Mentions:               nil,
				GroupMentions:          nil,
				OtherPotentialMentions: nil,
			},
		},
		"matching group with preceding @": {
			Message: "@engineering",
			Groups:  map[string]*model.Group{groupID1: {Id: groupID1, Name: model.NewString("engineering")}},
			Expected: &MentionResults{
				Mentions: nil,
				GroupMentions: map[string]MentionType{
					groupID1: GroupMention,
				},
			},
		},
		"matching upper case group with preceding @": {
			Message: "@Engineering",
			Groups:  map[string]*model.Group{groupID1: {Id: groupID1, Name: model.NewString("engineering")}},
			Expected: &MentionResults{
				Mentions: nil,
				GroupMentions: map[string]MentionType{
					groupID1: GroupMention,
				},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			post := &model.Post{
				Message: tc.Message,
				Props: model.StringInterface{
					"attachments": tc.Attachments,
				},
			}

			m := getExplicitMentions(post, mapsToMentionKeywords(tc.Keywords, tc.Groups))

			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestGetExplicitMentionsAtHere(t *testing.T) {
	t.Run("Boundary cases", func(t *testing.T) {
		// test all the boundary cases that we know can break up terms (and those that we know won't)
		cases := map[string]bool{
			"":          false,
			"here":      false,
			"@here":     true,
			" @here ":   true,
			"\n@here\n": true,
			"!@here!":   true,
			"#@here#":   true,
			"$@here$":   true,
			"%@here%":   true,
			"^@here^":   true,
			"&@here&":   true,
			"*@here*":   true,
			"(@here(":   true,
			")@here)":   true,
			"-@here-":   true,
			"_@here_":   true,
			"=@here=":   true,
			"+@here+":   true,
			"[@here[":   true,
			"{@here{":   true,
			"]@here]":   true,
			"}@here}":   true,
			"\\@here\\": true,
			"|@here|":   true,
			";@here;":   true,
			"@here:":    true,
			":@here:":   false, // This case shouldn't trigger a mention since it follows the format of reactions e.g. :word:
			"'@here'":   true,
			"\"@here\"": true,
			",@here,":   true,
			"<@here<":   true,
			".@here.":   true,
			">@here>":   true,
			"/@here/":   true,
			"?@here?":   true,
			"`@here`":   false, // This case shouldn't mention since it's a code block
			"~@here~":   true,
			"@HERE":     true,
			"@hERe":     true,
		}
		for message, shouldMention := range cases {
			post := &model.Post{Message: message}
			m := getExplicitMentions(post, nil)
			require.False(t, m.HereMentioned && !shouldMention, "shouldn't have mentioned @here with \"%v\"")
			require.False(t, !m.HereMentioned && shouldMention, "should've mentioned @here with \"%v\"")
		}
	})

	t.Run("Mention @here and someone", func(t *testing.T) {
		id := model.NewId()
		m := getExplicitMentions(
			&model.Post{Message: "@here @user @potential"},
			mapsToMentionKeywords(map[string][]string{"@user": {id}}, nil),
		)
		require.True(t, m.HereMentioned, "should've mentioned @here with \"@here @user\"")
		require.Len(t, m.Mentions, 1)
		require.Equal(t, KeywordMention, m.Mentions[id], "should've mentioned @user with \"@here @user\"")
		require.Equal(t, len(m.OtherPotentialMentions), 1, "should've potential mentions for @potential")
		assert.Equal(t, "potential", m.OtherPotentialMentions[0])
	})

	t.Run("Username ending with period", func(t *testing.T) {
		id := model.NewId()
		m := getExplicitMentions(
			&model.Post{Message: "@potential. test"},
			mapsToMentionKeywords(map[string][]string{"@user": {id}}, nil),
		)
		require.Equal(t, len(m.OtherPotentialMentions), 1, "should've potential mentions for @potential")
		assert.Equal(t, "potential", m.OtherPotentialMentions[0])
	})
}

func TestAllowChannelMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id}

	t.Run("should return true for a regular post with few channel members", func(t *testing.T) {
		allowChannelMentions := th.App.allowChannelMentions(th.Context, post, 5)
		assert.True(t, allowChannelMentions)
	})

	t.Run("should return false for a channel header post", func(t *testing.T) {
		headerChangePost := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id, Type: model.PostTypeHeaderChange}
		allowChannelMentions := th.App.allowChannelMentions(th.Context, headerChangePost, 5)
		assert.False(t, allowChannelMentions)
	})

	t.Run("should return false for a channel purpose post", func(t *testing.T) {
		purposeChangePost := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id, Type: model.PostTypePurposeChange}
		allowChannelMentions := th.App.allowChannelMentions(th.Context, purposeChangePost, 5)
		assert.False(t, allowChannelMentions)
	})

	t.Run("should return false for a regular post with many channel members", func(t *testing.T) {
		allowChannelMentions := th.App.allowChannelMentions(th.Context, post, int(*th.App.Config().TeamSettings.MaxNotificationsPerChannel)+1)
		assert.False(t, allowChannelMentions)
	})

	t.Run("should return false for a post where the post user does not have USE_CHANNEL_MENTIONS permission", func(t *testing.T) {
		defer th.AddPermissionToRole(model.PermissionUseChannelMentions.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(model.PermissionUseChannelMentions.Id, model.ChannelAdminRoleId)
		th.RemovePermissionFromRole(model.PermissionUseChannelMentions.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(model.PermissionUseChannelMentions.Id, model.ChannelAdminRoleId)
		allowChannelMentions := th.App.allowChannelMentions(th.Context, post, 5)
		assert.False(t, allowChannelMentions)
	})
}

func TestAllowGroupMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id}

	t.Run("should return false without the correct license sku short name", func(t *testing.T) {
		tests := map[string]struct {
			license *model.License
			want    bool
		}{
			"no license":                        {nil, false},
			"license with wrong SKU short name": {getLicWithSkuShortName("foobar"), false},
			"'professional' license":            {getLicWithSkuShortName(model.LicenseShortSkuProfessional), true},
			"'enterprise' license":              {getLicWithSkuShortName(model.LicenseShortSkuEnterprise), true},
		}

		for name, tc := range tests {
			t.Run(name, func(t *testing.T) {
				th.App.Srv().SetLicense(tc.license)
				got := th.App.allowGroupMentions(th.Context, post)
				assert.Equal(t, tc.want, got)
			})
		}
	})

	// we set the enterprise license for the rest of the tests
	th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuEnterprise))

	t.Run("should return true for a regular post with few channel members", func(t *testing.T) {
		allowGroupMentions := th.App.allowGroupMentions(th.Context, post)
		assert.True(t, allowGroupMentions)
	})

	t.Run("should return false for a channel header post", func(t *testing.T) {
		headerChangePost := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id, Type: model.PostTypeHeaderChange}
		allowGroupMentions := th.App.allowGroupMentions(th.Context, headerChangePost)
		assert.False(t, allowGroupMentions)
	})

	t.Run("should return false for a channel purpose post", func(t *testing.T) {
		purposeChangePost := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id, Type: model.PostTypePurposeChange}
		allowGroupMentions := th.App.allowGroupMentions(th.Context, purposeChangePost)
		assert.False(t, allowGroupMentions)
	})

	t.Run("should return false for a post where the post user does not have USE_GROUP_MENTIONS permission", func(t *testing.T) {
		defer func() {
			th.AddPermissionToRole(model.PermissionUseGroupMentions.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(model.PermissionUseGroupMentions.Id, model.ChannelAdminRoleId)
		}()
		th.RemovePermissionFromRole(model.PermissionUseGroupMentions.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(model.PermissionUseGroupMentions.Id, model.ChannelAdminRoleId)
		allowGroupMentions := th.App.allowGroupMentions(th.Context, post)
		assert.False(t, allowGroupMentions)
	})
}

func TestGetMentionKeywords(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// user with username or custom mentions enabled
	user1 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"mention_keys": "User,@User,MENTION",
		},
	}
	mentionableUser1ID := MentionableUserID(user1.Id)

	channelMemberNotifyPropsMap1Off := map[string]model.StringMap{
		user1.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
		},
	}

	profiles := map[string]*model.User{user1.Id: user1}
	keywords := th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap1Off, nil)
	require.Len(t, keywords, 3, "should've returned three mention keywords")

	ids, ok := keywords["user"]
	require.True(t, ok)
	require.Equal(t, mentionableUser1ID, ids[0], "should've returned mention key of user")
	ids, ok = keywords["@user"]
	require.True(t, ok)
	require.Equal(t, mentionableUser1ID, ids[0], "should've returned mention key of @user")
	ids, ok = keywords["mention"]
	require.True(t, ok)
	require.Equal(t, mentionableUser1ID, ids[0], "should've returned mention key of mention")

	// user with first name mention enabled
	user2 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"first_name": "true",
		},
	}
	mentionableUser2ID := MentionableUserID(user2.Id)

	channelMemberNotifyPropsMap2Off := map[string]model.StringMap{
		user2.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
		},
	}

	profiles = map[string]*model.User{user2.Id: user2}
	keywords = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap2Off, nil)
	require.Len(t, keywords, 2, "should've returned two mention keyword")

	ids, ok = keywords["First"]
	require.True(t, ok)
	require.Equal(t, mentionableUser2ID, ids[0], "should've returned mention key of First")

	// user with @channel/@all mentions enabled
	user3 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"channel": "true",
		},
	}
	mentionableUser3ID := MentionableUserID(user3.Id)

	// Channel-wide mentions are not ignored on channel level
	channelMemberNotifyPropsMap3Off := map[string]model.StringMap{
		user3.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
		},
	}
	profiles = map[string]*model.User{user3.Id: user3}
	keywords = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap3Off, nil)
	require.Len(t, keywords, 3, "should've returned three mention keywords")
	ids, ok = keywords["@channel"]
	require.True(t, ok)
	require.Equal(t, mentionableUser3ID, ids[0], "should've returned mention key of @channel")
	ids, ok = keywords["@all"]
	require.True(t, ok)
	require.Equal(t, mentionableUser3ID, ids[0], "should've returned mention key of @all")

	// Channel member notify props is set to default
	channelMemberNotifyPropsMapDefault := map[string]model.StringMap{
		user3.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsDefault,
		},
	}
	profiles = map[string]*model.User{user3.Id: user3}
	keywords = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMapDefault, nil)
	require.Len(t, keywords, 3, "should've returned three mention keywords")
	ids, ok = keywords["@channel"]
	require.True(t, ok)
	require.Equal(t, mentionableUser3ID, ids[0], "should've returned mention key of @channel")
	ids, ok = keywords["@all"]
	require.True(t, ok)
	require.Equal(t, mentionableUser3ID, ids[0], "should've returned mention key of @all")

	// Channel member notify props is empty
	channelMemberNotifyPropsMapEmpty := map[string]model.StringMap{}
	profiles = map[string]*model.User{user3.Id: user3}
	keywords = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMapEmpty, nil)
	require.Len(t, keywords, 3, "should've returned three mention keywords")
	ids, ok = keywords["@channel"]
	require.True(t, ok)
	require.Equal(t, mentionableUser3ID, ids[0], "should've returned mention key of @channel")
	ids, ok = keywords["@all"]
	require.True(t, ok)
	require.Equal(t, mentionableUser3ID, ids[0], "should've returned mention key of @all")

	// Channel-wide mentions are ignored channel level
	channelMemberNotifyPropsMap3On := map[string]model.StringMap{
		user3.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOn,
		},
	}
	keywords = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap3On, nil)
	require.NotEmpty(t, keywords, "should've not returned any keywords")

	// user with all types of mentions enabled
	user4 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"mention_keys": "User,@User,MENTION",
			"first_name":   "true",
			"channel":      "true",
		},
	}
	mentionableUser4ID := MentionableUserID(user4.Id)

	// Channel-wide mentions are not ignored on channel level
	channelMemberNotifyPropsMap4Off := map[string]model.StringMap{
		user4.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
		},
	}

	profiles = map[string]*model.User{user4.Id: user4}
	keywords = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap4Off, nil)
	require.Len(t, keywords, 6, "should've returned six mention keywords")
	ids, ok = keywords["user"]
	require.True(t, ok)
	require.Equal(t, mentionableUser4ID, ids[0], "should've returned mention key of user")
	ids, ok = keywords["@user"]
	require.True(t, ok)
	require.Equal(t, mentionableUser4ID, ids[0], "should've returned mention key of @user")
	ids, ok = keywords["mention"]
	require.True(t, ok)
	require.Equal(t, mentionableUser4ID, ids[0], "should've returned mention key of mention")
	ids, ok = keywords["First"]
	require.True(t, ok)
	require.Equal(t, mentionableUser4ID, ids[0], "should've returned mention key of First")
	ids, ok = keywords["@channel"]
	require.True(t, ok)
	require.Equal(t, mentionableUser4ID, ids[0], "should've returned mention key of @channel")
	ids, ok = keywords["@all"]
	require.True(t, ok)
	require.Equal(t, mentionableUser4ID, ids[0], "should've returned mention key of @all")

	// Channel-wide mentions are ignored on channel level
	channelMemberNotifyPropsMap4On := map[string]model.StringMap{
		user4.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOn,
		},
	}
	keywords = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap4On, nil)
	require.Len(t, keywords, 4, "should've returned four mention keywords")
	ids, ok = keywords["user"]
	require.True(t, ok)
	require.Equal(t, mentionableUser4ID, ids[0], "should've returned mention key of user")
	ids, ok = keywords["@user"]
	require.True(t, ok)
	require.Equal(t, mentionableUser4ID, ids[0], "should've returned mention key of @user")
	ids, ok = keywords["mention"]
	require.True(t, ok)
	require.Equal(t, mentionableUser4ID, ids[0], "should've returned mention key of mention")
	ids, ok = keywords["First"]
	require.True(t, ok)
	require.Equal(t, mentionableUser4ID, ids[0], "should've returned mention key of First")

	dupCount := func(list []MentionableID) map[MentionableID]int {
		duplicate_frequency := make(map[MentionableID]int)

		for _, item := range list {
			// check if the item/element exist in the duplicate_frequency map

			_, exist := duplicate_frequency[item]

			if exist {
				duplicate_frequency[item] += 1 // increase counter by 1 if already in the map
			} else {
				duplicate_frequency[item] = 1 // else start counting from 1
			}
		}
		return duplicate_frequency
	}

	// multiple users but no more than MaxNotificationsPerChannel
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxNotificationsPerChannel = 4 })
	profiles = map[string]*model.User{
		user1.Id: user1,
		user2.Id: user2,
		user3.Id: user3,
		user4.Id: user4,
	}
	// Channel-wide mentions are not ignored on channel level for all users
	channelMemberNotifyPropsMap5Off := map[string]model.StringMap{
		user1.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
		},
		user2.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
		},
		user3.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
		},
		user4.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
		},
	}
	keywords = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap5Off, nil)
	require.Len(t, keywords, 6, "should've returned six mention keywords")
	ids, ok = keywords["user"]
	require.True(t, ok)
	require.Len(t, ids, 2)
	require.False(t, ids[0] != mentionableUser1ID && ids[1] != mentionableUser1ID, "should've mentioned user1  with user")
	require.False(t, ids[0] != mentionableUser4ID && ids[1] != mentionableUser4ID, "should've mentioned user4  with user")
	idsMap := dupCount(keywords["@user"])
	require.True(t, ok)
	require.Len(t, idsMap, 4)
	require.Equal(t, idsMap[mentionableUser1ID], 2, "should've mentioned user1 with @user")
	require.Equal(t, idsMap[mentionableUser4ID], 2, "should've mentioned user4 with @user")

	ids, ok = keywords["mention"]
	require.True(t, ok)
	require.Len(t, ids, 2)
	require.False(t, ids[0] != mentionableUser1ID && ids[1] != mentionableUser1ID, "should've mentioned user1 with mention")
	require.False(t, ids[0] != mentionableUser4ID && ids[1] != mentionableUser4ID, "should've mentioned user4 with mention")
	ids, ok = keywords["First"]
	require.True(t, ok)
	require.Len(t, ids, 2)
	require.False(t, ids[0] != mentionableUser2ID && ids[1] != mentionableUser2ID, "should've mentioned user2 with First")
	require.False(t, ids[0] != mentionableUser4ID && ids[1] != mentionableUser4ID, "should've mentioned user4 with First")
	ids, ok = keywords["@channel"]
	require.True(t, ok)
	require.Len(t, ids, 2)
	require.False(t, ids[0] != mentionableUser3ID && ids[1] != mentionableUser3ID, "should've mentioned user3 with @channel")
	require.False(t, ids[0] != mentionableUser4ID && ids[1] != mentionableUser4ID, "should've mentioned user4 with @channel")
	ids, ok = keywords["@all"]
	require.True(t, ok)
	require.Len(t, ids, 2)
	require.False(t, ids[0] != mentionableUser3ID && ids[1] != mentionableUser3ID, "should've mentioned user3 with @all")
	require.False(t, ids[0] != mentionableUser4ID && ids[1] != mentionableUser4ID, "should've mentioned user4 with @all")

	// multiple users and more than MaxNotificationsPerChannel
	keywords = th.App.getMentionKeywordsInChannel(profiles, false, channelMemberNotifyPropsMap4Off, nil)
	require.Len(t, keywords, 4, "should've returned four mention keywords")
	_, ok = keywords["@channel"]
	require.False(t, ok, "should not have mentioned any user with @channel")
	_, ok = keywords["@all"]
	require.False(t, ok, "should not have mentioned any user with @all")
	_, ok = keywords["@here"]
	require.False(t, ok, "should not have mentioned any user with @here")
	// no special mentions
	profiles = map[string]*model.User{
		user1.Id: user1,
	}
	keywords = th.App.getMentionKeywordsInChannel(profiles, false, channelMemberNotifyPropsMap4Off, nil)
	require.Len(t, keywords, 3, "should've returned three mention keywords")
	ids, ok = keywords["user"]
	require.True(t, ok)
	require.Len(t, ids, 1)
	require.Equal(t, mentionableUser1ID, ids[0], "should've mentioned user1 with user")
	ids, ok = keywords["@user"]

	require.True(t, ok)
	require.Len(t, ids, 2)
	require.Equal(t, mentionableUser1ID, ids[0], "should've mentioned user1 twice with @user")
	require.Equal(t, mentionableUser1ID, ids[1], "should've mentioned user1 twice with @user")

	ids, ok = keywords["mention"]
	require.True(t, ok)
	require.Len(t, ids, 1)
	require.Equal(t, mentionableUser1ID, ids[0], "should've mentioned user1 with user")

	_, ok = keywords["First"]
	require.False(t, ok, "should not have mentioned user1 with First")
	_, ok = keywords["@channel"]
	require.False(t, ok, "should not have mentioned any user with @channel")
	_, ok = keywords["@all"]
	require.False(t, ok, "should not have mentioned any user with @all")
	_, ok = keywords["@here"]
	require.False(t, ok, "should not have mentioned any user with @here")

	// user with empty mention keys
	userNoMentionKeys := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"mention_keys": ",",
		},
	}

	channelMemberNotifyPropsMapEmptyOff := map[string]model.StringMap{
		userNoMentionKeys.Id: {
			"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
		},
	}

	profiles = map[string]*model.User{userNoMentionKeys.Id: userNoMentionKeys}
	keywords = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMapEmptyOff, nil)
	assert.Equal(t, 1, len(keywords), "should've returned one mention keyword")
	ids, ok = keywords["@user"]
	assert.True(t, ok)
	assert.Equal(t, MentionableUserID(userNoMentionKeys.Id), ids[0], "should've returned mention key of @user")
}

func TestGetMentionKeywords_Groups(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	userID1 := model.NewId()
	userID2 := model.NewId()
	mentionableUserID1 := MentionableUserID(userID1)
	mentionableUserID2 := MentionableUserID(userID2)

	for name, tc := range map[string]struct {
		Profiles                 map[string]*model.User
		DisallowChannelMentions  bool
		ChannelMemberNotifyProps map[string]model.StringMap
		Groups                   map[string]*model.Group
		Expected                 MentionKeywords
	}{
		"user with username or custom mentions enabled": {
			Profiles: map[string]*model.User{
				userID1: {
					Id:        userID1,
					FirstName: "First",
					Username:  "User",
					NotifyProps: map[string]string{
						"mention_keys": "User,@User,MENTION",
					},
				},
			},
			Expected: MentionKeywords{
				"user":    {mentionableUserID1},
				"@user":   {mentionableUserID1, mentionableUserID1}, // lol
				"mention": {mentionableUserID1},
			},
		},
		"user with first name mentioned": {
			Profiles: map[string]*model.User{
				userID1: {
					Id:        userID1,
					FirstName: "First",
					Username:  "User",
					NotifyProps: map[string]string{
						"first_name": "true",
					},
				},
			},
			Expected: MentionKeywords{
				"First": {mentionableUserID1},
				"@user": {mentionableUserID1},
			},
		},
		"user with @channel/@all mentions enabled account-wide": {
			Profiles: map[string]*model.User{
				userID1: {
					Id:        userID1,
					FirstName: "First",
					Username:  "User",
					NotifyProps: map[string]string{
						"channel": "true",
					},
				},
			},
			ChannelMemberNotifyProps: map[string]model.StringMap{
				userID1: {
					"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
				},
			},
			Expected: MentionKeywords{
				"@all":     {mentionableUserID1},
				"@channel": {mentionableUserID1},
				"@user":    {mentionableUserID1},
			},
		},
		"user with @channel/@all mentions enabled account-wide and default notify props": {
			Profiles: map[string]*model.User{
				userID1: {
					Id:        userID1,
					FirstName: "First",
					Username:  "User",
					NotifyProps: map[string]string{
						"channel": "true",
					},
				},
			},
			ChannelMemberNotifyProps: map[string]model.StringMap{
				userID1: {
					"ignore_channel_mentions": model.IgnoreChannelMentionsDefault,
				},
			},
			Expected: MentionKeywords{
				"@all":     {mentionableUserID1},
				"@channel": {mentionableUserID1},
				"@user":    {mentionableUserID1},
			},
		},
		"user with @channel/@all mentions enabled account-wide and empty channel notify props": {
			Profiles: map[string]*model.User{
				userID1: {
					Id:        userID1,
					FirstName: "First",
					Username:  "User",
					NotifyProps: map[string]string{
						"channel": "true",
					},
				},
			},
			Expected: MentionKeywords{
				"@all":     {mentionableUserID1},
				"@channel": {mentionableUserID1},
				"@user":    {mentionableUserID1},
			},
		},
		"user with @channel/@all mentions enabled account-wide but ignored for channel": {
			Profiles: map[string]*model.User{
				userID1: {
					Id:        userID1,
					FirstName: "First",
					Username:  "User",
					NotifyProps: map[string]string{
						"channel": "true",
					},
				},
			},
			ChannelMemberNotifyProps: map[string]model.StringMap{
				userID1: {
					"ignore_channel_mentions": model.IgnoreChannelMentionsOn,
				},
			},
			Expected: MentionKeywords{
				"@user": {mentionableUserID1},
			},
		},
		"user with all types of mentions enabled": {
			Profiles: map[string]*model.User{
				userID1: {
					Id:        userID1,
					FirstName: "First",
					Username:  "User",
					NotifyProps: map[string]string{
						"mention_keys": "User,@User,MENTION",
						"first_name":   "true",
						"channel":      "true",
					},
				},
			},
			ChannelMemberNotifyProps: map[string]model.StringMap{
				userID1: {
					"ignore_channel_mentions": model.IgnoreChannelMentionsOff,
				},
			},
			Expected: MentionKeywords{
				"@all":     {mentionableUserID1},
				"@channel": {mentionableUserID1},
				"@user":    {mentionableUserID1, mentionableUserID1},
				"First":    {mentionableUserID1},
				"mention":  {mentionableUserID1},
				"user":     {mentionableUserID1},
			},
		},
		"user with all types of mentions enabled but channel mentions ignored for channel": {
			Profiles: map[string]*model.User{
				userID1: {
					Id:        userID1,
					FirstName: "First",
					Username:  "User",
					NotifyProps: map[string]string{
						"mention_keys": "User,@User,MENTION",
						"first_name":   "true",
						"channel":      "true",
					},
				},
			},
			ChannelMemberNotifyProps: map[string]model.StringMap{
				userID1: {
					"ignore_channel_mentions": model.IgnoreChannelMentionsOn,
				},
			},
			Expected: MentionKeywords{
				"@user":   {mentionableUserID1, mentionableUserID1},
				"First":   {mentionableUserID1},
				"mention": {mentionableUserID1},
				"user":    {mentionableUserID1},
			},
		},
		"multiple users": {
			Profiles: map[string]*model.User{
				userID1: {
					Id:        userID1,
					FirstName: "First",
					Username:  "User",
					NotifyProps: map[string]string{
						"mention_keys": "User,@User,MENTION",
						"first_name":   "true",
						"channel":      "true",
					},
				},
				userID2: {
					Id:        userID2,
					FirstName: "Second",
					Username:  "UserTwo",
					NotifyProps: map[string]string{
						"mention_keys": "UserTwo,@UserTwo",
						"first_name":   "true",
						"channel":      "true",
					},
				},
			},
			Expected: MentionKeywords{
				"@all":     {mentionableUserID1, mentionableUserID2},
				"@channel": {mentionableUserID1, mentionableUserID2},
				"@user":    {mentionableUserID1, mentionableUserID1},
				"@usertwo": {mentionableUserID2, mentionableUserID2},
				"First":    {mentionableUserID1},
				"mention":  {mentionableUserID1},
				"Second":   {mentionableUserID2},
				"user":     {mentionableUserID1},
				"usertwo":  {mentionableUserID2},
			},
		},
		"user with empty mention keys": {
			Profiles: map[string]*model.User{
				userID1: {
					Id:        userID1,
					FirstName: "First",
					Username:  "User",
					NotifyProps: map[string]string{
						"mention_keys": ",",
					},
				},
			},
			Expected: MentionKeywords{
				"@user": {mentionableUserID1},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			keywords := th.App.getMentionKeywordsInChannel(
				tc.Profiles,
				!tc.DisallowChannelMentions,
				tc.ChannelMemberNotifyProps,
				tc.Groups,
			)

			require.Equal(t, len(tc.Expected), len(keywords))
			for keyword, ids := range tc.Expected {
				assert.ElementsMatch(t, ids, keywords[keyword])
			}
		})
	}
}

func TestGetMentionsEnabledFields(t *testing.T) {
	attachmentWithTextAndPreText := model.SlackAttachment{
		Text:    "@here with mentions",
		Pretext: "@Channel some comment for the channel",
	}

	attachmentWithOutPreText := model.SlackAttachment{
		Text: "some text",
	}
	attachments := []*model.SlackAttachment{
		&attachmentWithTextAndPreText,
		&attachmentWithOutPreText,
	}

	post := &model.Post{
		Message: "This is the message",
		Props: model.StringInterface{
			"attachments": attachments,
		},
	}
	expectedFields := []string{
		"This is the message",
		"@Channel some comment for the channel",
		"@here with mentions",
		"some text"}

	mentionEnabledFields := getMentionsEnabledFields(post)

	assert.EqualValues(t, 4, len(mentionEnabledFields))
	assert.EqualValues(t, expectedFields, mentionEnabledFields)
}

func TestPostNotificationGetChannelName(t *testing.T) {
	sender := &model.User{Id: model.NewId(), Username: "sender", FirstName: "Sender", LastName: "Sender", Nickname: "Sender"}
	recipient := &model.User{Id: model.NewId(), Username: "recipient", FirstName: "Recipient", LastName: "Recipient", Nickname: "Recipient"}
	otherUser := &model.User{Id: model.NewId(), Username: "other", FirstName: "Other", LastName: "Other", Nickname: "Other"}
	profileMap := map[string]*model.User{
		sender.Id:    sender,
		recipient.Id: recipient,
		otherUser.Id: otherUser,
	}

	for name, testCase := range map[string]struct {
		channel     *model.Channel
		nameFormat  string
		recipientId string
		expected    string
	}{
		"regular channel": {
			channel:  &model.Channel{Type: model.ChannelTypeOpen, Name: "channel", DisplayName: "My Channel"},
			expected: "My Channel",
		},
		"direct channel, unspecified": {
			channel:  &model.Channel{Type: model.ChannelTypeDirect},
			expected: "@sender",
		},
		"direct channel, username": {
			channel:    &model.Channel{Type: model.ChannelTypeDirect},
			nameFormat: model.ShowUsername,
			expected:   "@sender",
		},
		"direct channel, full name": {
			channel:    &model.Channel{Type: model.ChannelTypeDirect},
			nameFormat: model.ShowFullName,
			expected:   "Sender Sender",
		},
		"direct channel, nickname": {
			channel:    &model.Channel{Type: model.ChannelTypeDirect},
			nameFormat: model.ShowNicknameFullName,
			expected:   "Sender",
		},
		"group channel, unspecified": {
			channel:  &model.Channel{Type: model.ChannelTypeGroup},
			expected: "other, sender",
		},
		"group channel, username": {
			channel:    &model.Channel{Type: model.ChannelTypeGroup},
			nameFormat: model.ShowUsername,
			expected:   "other, sender",
		},
		"group channel, full name": {
			channel:    &model.Channel{Type: model.ChannelTypeGroup},
			nameFormat: model.ShowFullName,
			expected:   "Other Other, Sender Sender",
		},
		"group channel, nickname": {
			channel:    &model.Channel{Type: model.ChannelTypeGroup},
			nameFormat: model.ShowNicknameFullName,
			expected:   "Other, Sender",
		},
		"group channel, not excluding current user": {
			channel:     &model.Channel{Type: model.ChannelTypeGroup},
			nameFormat:  model.ShowNicknameFullName,
			expected:    "Other, Sender",
			recipientId: "",
		},
	} {
		t.Run(name, func(t *testing.T) {
			notification := &PostNotification{
				Channel:    testCase.channel,
				Sender:     sender,
				ProfileMap: profileMap,
			}

			recipientId := recipient.Id
			if testCase.recipientId != "" {
				recipientId = testCase.recipientId
			}

			assert.Equal(t, testCase.expected, notification.GetChannelName(testCase.nameFormat, recipientId))
		})
	}
}

func TestPostNotificationGetSenderName(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	defaultChannel := &model.Channel{Type: model.ChannelTypeOpen}
	defaultPost := &model.Post{Props: model.StringInterface{}}
	sender := &model.User{Id: model.NewId(), Username: "sender", FirstName: "Sender", LastName: "Sender", Nickname: "Sender"}

	overriddenPost := &model.Post{
		Props: model.StringInterface{
			"override_username": "Overridden",
			"from_webhook":      "true",
		},
	}

	overriddenPost2 := &model.Post{
		Props: model.StringInterface{
			"override_username": nil,
			"from_webhook":      "true",
		},
	}

	overriddenPost3 := &model.Post{
		Props: model.StringInterface{
			"override_username": 10,
			"from_webhook":      "true",
		},
	}

	for name, testCase := range map[string]struct {
		channel        *model.Channel
		post           *model.Post
		nameFormat     string
		allowOverrides bool
		expected       string
	}{
		"name format unspecified": {
			expected: "@" + sender.Username,
		},
		"name format username": {
			nameFormat: model.ShowUsername,
			expected:   "@" + sender.Username,
		},
		"name format full name": {
			nameFormat: model.ShowFullName,
			expected:   sender.FirstName + " " + sender.LastName,
		},
		"name format nickname": {
			nameFormat: model.ShowNicknameFullName,
			expected:   sender.Nickname,
		},
		"system message": {
			post:     &model.Post{Type: model.PostSystemMessagePrefix + "custom"},
			expected: i18n.T("system.message.name"),
		},
		"overridden username": {
			post:           overriddenPost,
			allowOverrides: true,
			expected:       overriddenPost.GetProp("override_username").(string),
		},
		"overridden username, direct channel": {
			channel:        &model.Channel{Type: model.ChannelTypeDirect},
			post:           overriddenPost,
			allowOverrides: true,
			expected:       "@" + sender.Username,
		},
		"overridden username, overrides disabled": {
			post:           overriddenPost,
			allowOverrides: false,
			expected:       "@" + sender.Username,
		},
		"nil override_username": {
			post:           overriddenPost2,
			allowOverrides: true,
			expected:       "@" + sender.Username,
		},
		"integer override_username": {
			post:           overriddenPost3,
			allowOverrides: true,
			expected:       "@" + sender.Username,
		},
	} {
		t.Run(name, func(t *testing.T) {
			channel := defaultChannel
			if testCase.channel != nil {
				channel = testCase.channel
			}

			post := defaultPost
			if testCase.post != nil {
				post = testCase.post
			}

			notification := &PostNotification{
				Channel: channel,
				Post:    post,
				Sender:  sender,
			}

			assert.Equal(t, testCase.expected, notification.GetSenderName(testCase.nameFormat, testCase.allowOverrides))
		})
	}
}

func TestGetNotificationNameFormat(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("show full name on", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowFullName = true
			*cfg.TeamSettings.TeammateNameDisplay = model.ShowFullName
		})

		assert.Equal(t, model.ShowFullName, th.App.GetNotificationNameFormat(th.BasicUser))
	})

	t.Run("show full name off", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowFullName = false
			*cfg.TeamSettings.TeammateNameDisplay = model.ShowFullName
		})

		assert.Equal(t, model.ShowUsername, th.App.GetNotificationNameFormat(th.BasicUser))
	})
}

func TestUserAllowsEmail(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("should return true", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOffline(user.Id, true)

		channelMemberNotificationProps := model.StringMap{
			model.EmailNotifyProp:      model.ChannelNotifyDefault,
			model.MarkUnreadNotifyProp: model.ChannelMarkUnreadAll,
		}

		assert.True(t, th.App.userAllowsEmail(th.Context, user, channelMemberNotificationProps, &model.Post{Type: "some-post-type"}))
	})

	t.Run("should return false in case the status is ONLINE", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOnline(user.Id, true)

		channelMemberNotificationProps := model.StringMap{
			model.EmailNotifyProp:      model.ChannelNotifyDefault,
			model.MarkUnreadNotifyProp: model.ChannelMarkUnreadAll,
		}

		assert.False(t, th.App.userAllowsEmail(th.Context, user, channelMemberNotificationProps, &model.Post{Type: "some-post-type"}))
	})

	t.Run("should return false in case the EMAIL_NOTIFY_PROP is false", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOffline(user.Id, true)

		channelMemberNotificationProps := model.StringMap{
			model.EmailNotifyProp:      "false",
			model.MarkUnreadNotifyProp: model.ChannelMarkUnreadAll,
		}

		assert.False(t, th.App.userAllowsEmail(th.Context, user, channelMemberNotificationProps, &model.Post{Type: "some-post-type"}))
	})

	t.Run("should return false in case the MARK_UNREAD_NOTIFY_PROP is CHANNEL_MARK_UNREAD_MENTION", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOffline(user.Id, true)

		channelMemberNotificationProps := model.StringMap{
			model.EmailNotifyProp:      model.ChannelNotifyDefault,
			model.MarkUnreadNotifyProp: model.ChannelMarkUnreadMention,
		}

		assert.False(t, th.App.userAllowsEmail(th.Context, user, channelMemberNotificationProps, &model.Post{Type: "some-post-type"}))
	})

	t.Run("should return false in case the Post type is POST_AUTO_RESPONDER", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOffline(user.Id, true)

		channelMemberNotificationProps := model.StringMap{
			model.EmailNotifyProp:      model.ChannelNotifyDefault,
			model.MarkUnreadNotifyProp: model.ChannelMarkUnreadAll,
		}

		assert.False(t, th.App.userAllowsEmail(th.Context, user, channelMemberNotificationProps, &model.Post{Type: model.PostTypeAutoResponder}))
	})

	t.Run("should return false in case the status is STATUS_OUT_OF_OFFICE", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOutOfOffice(user.Id)

		channelMemberNotificationProps := model.StringMap{
			model.EmailNotifyProp:      model.ChannelNotifyDefault,
			model.MarkUnreadNotifyProp: model.ChannelMarkUnreadAll,
		}

		assert.False(t, th.App.userAllowsEmail(th.Context, user, channelMemberNotificationProps, &model.Post{Type: model.PostTypeAutoResponder}))
	})

	t.Run("should return false in case the status is STATUS_ONLINE", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusDoNotDisturb(user.Id)

		channelMemberNotificationProps := model.StringMap{
			model.EmailNotifyProp:      model.ChannelNotifyDefault,
			model.MarkUnreadNotifyProp: model.ChannelMarkUnreadAll,
		}

		assert.False(t, th.App.userAllowsEmail(th.Context, user, channelMemberNotificationProps, &model.Post{Type: model.PostTypeAutoResponder}))
	})

	t.Run("should return false in the case user is a bot", func(t *testing.T) {
		user := th.CreateUser()

		th.App.ConvertUserToBot(th.Context, user)

		channelMemberNotifcationProps := model.StringMap{
			model.EmailNotifyProp:      model.ChannelNotifyDefault,
			model.MarkUnreadNotifyProp: model.ChannelMarkUnreadAll,
		}

		assert.False(t, th.App.userAllowsEmail(th.Context, user, channelMemberNotifcationProps, &model.Post{Type: model.PostTypeAutoResponder}))
	})
}

func TestInsertGroupMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := th.BasicTeam
	channel := th.BasicChannel
	group := th.CreateGroup()
	group.DisplayName = "engineering"
	group.Name = model.NewString("engineering")
	group, err := th.App.UpdateGroup(group)
	require.Nil(t, err)

	groupChannelMember := th.CreateUser()
	th.LinkUserToTeam(groupChannelMember, team)
	th.App.AddUserToChannel(th.Context, groupChannelMember, channel, false)
	_, err = th.App.UpsertGroupMember(group.Id, groupChannelMember.Id)
	require.Nil(t, err)

	senderGroupChannelMember := th.CreateUser()
	th.LinkUserToTeam(senderGroupChannelMember, team)
	th.App.AddUserToChannel(th.Context, senderGroupChannelMember, channel, false)
	_, err = th.App.UpsertGroupMember(group.Id, senderGroupChannelMember.Id)
	require.Nil(t, err)

	nonGroupChannelMember := th.CreateUser()
	th.LinkUserToTeam(nonGroupChannelMember, team)
	th.App.AddUserToChannel(th.Context, nonGroupChannelMember, channel, false)

	nonChannelGroupMember := th.CreateUser()
	th.LinkUserToTeam(nonChannelGroupMember, team)
	_, err = th.App.UpsertGroupMember(group.Id, nonChannelGroupMember.Id)
	require.Nil(t, err)

	groupWithNoMembers := th.CreateGroup()
	groupWithNoMembers.DisplayName = "marketing"
	groupWithNoMembers.Name = model.NewString("marketing")
	groupWithNoMembers, err = th.App.UpdateGroup(groupWithNoMembers)
	require.Nil(t, err)

	profileMap := map[string]*model.User{groupChannelMember.Id: groupChannelMember, senderGroupChannelMember.Id: senderGroupChannelMember, nonGroupChannelMember.Id: nonGroupChannelMember}

	t.Run("should add expected mentions for users part of the mentioned group sender in group", func(t *testing.T) {
		mentions := &MentionResults{}
		usersMentioned, err := th.App.insertGroupMentions(senderGroupChannelMember.Id, group, channel, profileMap, mentions)
		require.Nil(t, err)
		require.Equal(t, usersMentioned, true)

		// Ensure group member that is also a channel member is added to the mentions list.
		require.Equal(t, len(mentions.Mentions), 1)
		_, found := mentions.Mentions[groupChannelMember.Id]
		require.Equal(t, found, true)

		// Ensure group member that is not a channel member is added to the other potential mentions list.
		require.Equal(t, len(mentions.OtherPotentialMentions), 1)
		require.Equal(t, mentions.OtherPotentialMentions[0], nonChannelGroupMember.Username)
	})

	t.Run("should add expected mentions for users part of the mentioned group sender not in group", func(t *testing.T) {
		mentions := &MentionResults{}
		usersMentioned, err := th.App.insertGroupMentions(nonGroupChannelMember.Id, group, channel, profileMap, mentions)
		require.Nil(t, err)
		require.Equal(t, usersMentioned, true)

		// Ensure group member that is also a channel member is added to the mentions list.
		require.Equal(t, 2, len(mentions.Mentions))
		_, found := mentions.Mentions[groupChannelMember.Id]
		require.Equal(t, found, true)
		_, found = mentions.Mentions[senderGroupChannelMember.Id]
		require.Equal(t, found, true)

		// Ensure group member that is not a channel member is added to the other potential mentions list.
		require.Equal(t, len(mentions.OtherPotentialMentions), 1)
		require.Equal(t, mentions.OtherPotentialMentions[0], nonChannelGroupMember.Username)
	})

	t.Run("should add no expected or potential mentions if the group has no users ", func(t *testing.T) {
		mentions := &MentionResults{}
		usersMentioned, err := th.App.insertGroupMentions(senderGroupChannelMember.Id, groupWithNoMembers, channel, profileMap, mentions)
		require.Nil(t, err)
		require.Equal(t, usersMentioned, false)

		// Ensure no mentions are added for a group with no users
		require.Equal(t, len(mentions.Mentions), 0)
		require.Equal(t, len(mentions.OtherPotentialMentions), 0)
	})

	t.Run("should keep existing mentions", func(t *testing.T) {
		mentions := &MentionResults{}
		th.App.insertGroupMentions(senderGroupChannelMember.Id, group, channel, profileMap, mentions)
		th.App.insertGroupMentions(senderGroupChannelMember.Id, groupWithNoMembers, channel, profileMap, mentions)

		// Ensure mentions from group are kept after running with groupWithNoMembers
		require.Equal(t, len(mentions.Mentions), 1)
		require.Equal(t, len(mentions.OtherPotentialMentions), 1)
	})

	t.Run("should return true if no members mentioned while in group or direct message channel", func(t *testing.T) {
		mentions := &MentionResults{}
		emptyProfileMap := make(map[string]*model.User)

		groupChannel := &model.Channel{Type: model.ChannelTypeGroup}
		usersMentioned, _ := th.App.insertGroupMentions(senderGroupChannelMember.Id, group, groupChannel, emptyProfileMap, mentions)
		// Ensure group channel with no group members mentioned always returns true
		require.Equal(t, usersMentioned, true)
		require.Equal(t, len(mentions.Mentions), 0)

		directChannel := &model.Channel{Type: model.ChannelTypeDirect}
		usersMentioned, _ = th.App.insertGroupMentions(senderGroupChannelMember.Id, group, directChannel, emptyProfileMap, mentions)
		// Ensure direct channel with no group members mentioned always returns true
		require.Equal(t, usersMentioned, true)
		require.Equal(t, len(mentions.Mentions), 0)
	})

	t.Run("should add mentions for members while in group channel", func(t *testing.T) {
		groupChannel, err := th.App.CreateGroupChannel(th.Context, []string{groupChannelMember.Id, nonGroupChannelMember.Id, th.BasicUser.Id}, groupChannelMember.Id)
		require.Nil(t, err)

		mentions := &MentionResults{}
		th.App.insertGroupMentions(senderGroupChannelMember.Id, group, groupChannel, profileMap, mentions)

		require.Equal(t, len(mentions.Mentions), 1)
		_, found := mentions.Mentions[groupChannelMember.Id]
		require.Equal(t, found, true)
	})
}

func TestGetGroupsAllowedForReferenceInChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var err *model.AppError

	team := th.BasicTeam
	channel := th.BasicChannel
	group1 := th.CreateGroup()

	t.Run("should return empty map when no groups with allow reference", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(channel, team)
		require.NoError(t, nErr)
		require.Len(t, groupsMap, 0)
	})

	group1.AllowReference = true
	group1, err = th.App.UpdateGroup(group1)
	require.Nil(t, err)

	group2 := th.CreateGroup()
	t.Run("should only return groups with allow reference", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(channel, team)
		require.NoError(t, nErr)
		require.Len(t, groupsMap, 1)
		require.Nil(t, groupsMap[group2.Id])
		require.Equal(t, groupsMap[group1.Id], group1)
	})

	group2.AllowReference = true
	group2, err = th.App.UpdateGroup(group2)
	require.Nil(t, err)

	// Create a custom group
	customGroupId := model.NewId()
	customGroup, err := th.App.CreateGroup(&model.Group{
		DisplayName:    customGroupId,
		Name:           model.NewString("name" + customGroupId),
		Source:         model.GroupSourceCustom,
		Description:    "description_" + customGroupId,
		AllowReference: true,
		RemoteId:       nil,
	})
	assert.Nil(t, err)

	u1 := th.BasicUser
	_, err = th.App.UpsertGroupMember(customGroup.Id, u1.Id)
	assert.Nil(t, err)

	customGroup, err = th.App.GetGroup(customGroup.Id, &model.GetGroupOpts{IncludeMemberCount: true}, nil)
	assert.Nil(t, err)

	// Sync first group to constrained channel
	constrainedChannel := th.CreateChannel(th.Context, th.BasicTeam)
	constrainedChannel.GroupConstrained = model.NewBool(true)
	constrainedChannel, err = th.App.UpdateChannel(th.Context, constrainedChannel)
	require.Nil(t, err)
	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    group1.Id,
		Type:       model.GroupSyncableTypeChannel,
		SyncableId: constrainedChannel.Id,
	})
	require.Nil(t, err)

	t.Run("should return only groups synced to channel and custom groups if channel is group constrained", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(constrainedChannel, team)
		require.NoError(t, nErr)
		require.Len(t, groupsMap, 2)
		require.Nil(t, groupsMap[group2.Id])
		require.Equal(t, groupsMap[group1.Id], group1)
		require.Equal(t, groupsMap[customGroup.Id], customGroup)
	})

	// Create a third ldap group not synced with a team or channel
	group3 := th.CreateGroup()
	group3.AllowReference = true
	group3, err = th.App.UpdateGroup(group3)
	require.Nil(t, err)

	// Sync group2 to the team
	team.GroupConstrained = model.NewBool(true)
	team, err = th.App.UpdateTeam(team)
	require.Nil(t, err)
	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    group2.Id,
		Type:       model.GroupSyncableTypeTeam,
		SyncableId: team.Id,
	})
	require.Nil(t, err)

	t.Run("should return union of custom groups, groups synced to team and any channels if team is group constrained", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(channel, team)
		require.NoError(t, nErr)
		require.Len(t, groupsMap, 3)
		require.Nil(t, groupsMap[group3.Id])
		require.Equal(t, groupsMap[group2.Id], group2)
		require.Equal(t, groupsMap[group1.Id], group1)
		require.Equal(t, groupsMap[customGroup.Id], customGroup)
	})

	t.Run("should return only subset of custom groups and groups synced to channel for group constrained channel when team is also group constrained", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(constrainedChannel, team)
		require.NoError(t, nErr)
		require.Len(t, groupsMap, 2)
		require.Nil(t, groupsMap[group3.Id])
		require.Nil(t, groupsMap[group2.Id])
		require.Equal(t, groupsMap[group1.Id], group1)
		require.Equal(t, groupsMap[customGroup.Id], customGroup)
	})

	team.GroupConstrained = model.NewBool(false)
	team, err = th.App.UpdateTeam(team)
	require.Nil(t, err)

	t.Run("should return all groups when team and channel are not group constrained", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(channel, team)
		require.NoError(t, nErr)
		require.Len(t, groupsMap, 4)
		require.Equal(t, groupsMap[group1.Id], group1)
		require.Equal(t, groupsMap[group2.Id], group2)
		require.Equal(t, groupsMap[group3.Id], group3)
		require.Equal(t, groupsMap[customGroup.Id], customGroup)
	})
}

func TestReplyPostNotificationsWithCRT(t *testing.T) {
	t.Run("Reply posts only shows badges for explicit mentions in collapsed threads", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		u1 := th.BasicUser
		u2 := th.BasicUser2
		c1 := th.BasicChannel
		th.AddUserToChannel(u2, c1)

		// Enable "Trigger notifications on messages in
		// reply threads that I start or participate in"
		// for the second user
		oldValue := th.BasicUser2.NotifyProps[model.CommentsNotifyProp]
		newNotifyProps := th.BasicUser2.NotifyProps
		newNotifyProps[model.CommentsNotifyProp] = model.CommentsNotifyAny
		u2, appErr := th.App.PatchUser(th.Context, th.BasicUser2.Id, &model.UserPatch{NotifyProps: newNotifyProps}, false)
		require.Nil(t, appErr)
		require.Equal(t, model.CommentsNotifyAny, u2.NotifyProps[model.CommentsNotifyProp])
		defer func() {
			newNotifyProps := th.BasicUser2.NotifyProps
			newNotifyProps[model.CommentsNotifyProp] = oldValue
			_, nAppErr := th.App.PatchUser(th.Context, th.BasicUser2.Id, &model.UserPatch{NotifyProps: newNotifyProps}, false)
			require.Nil(t, nAppErr)
		}()

		// Enable CRT

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ThreadAutoFollow = true
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
		})

		rootPost := &model.Post{
			ChannelId: c1.Id,
			Message:   "root post by user1",
			UserId:    u1.Id,
		}
		rpost, appErr := th.App.CreatePost(th.Context, rootPost, c1, false, true)
		require.Nil(t, appErr)

		replyPost1 := &model.Post{
			ChannelId: c1.Id,
			Message:   "reply post by user2",
			UserId:    u2.Id,
			RootId:    rpost.Id,
		}
		_, appErr = th.App.CreatePost(th.Context, replyPost1, c1, false, true)
		require.Nil(t, appErr)

		replyPost2 := &model.Post{
			ChannelId: c1.Id,
			Message:   "reply post by user1",
			UserId:    u1.Id,
			RootId:    rpost.Id,
		}
		_, appErr = th.App.CreatePost(th.Context, replyPost2, c1, false, true)
		require.Nil(t, appErr)

		threadMembership, appErr := th.App.GetThreadMembershipForUser(u2.Id, rpost.Id)
		require.Nil(t, appErr)
		thread, appErr := th.App.GetThreadForUser(threadMembership, false)
		require.Nil(t, appErr)
		// Then: with notifications set to "all" we should
		// not see a mention badge
		require.Equal(t, int64(0), thread.UnreadMentions)
		// Then: last post is still marked as unread
		require.Equal(t, int64(1), thread.UnreadReplies)
	})

	t.Run("Replies to post created by webhook should not auto-follow webhook creator", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ThreadAutoFollow = true
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
		})

		user := th.BasicUser

		rootPost := &model.Post{
			UserId:    user.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "a message",
			Props:     model.StringInterface{"from_webhook": "true", "override_username": "a bot"},
		}

		rootPost, appErr := th.App.CreatePostMissingChannel(th.Context, rootPost, false, true)
		require.Nil(t, appErr)

		childPost := &model.Post{
			UserId:    th.BasicUser2.Id,
			ChannelId: th.BasicChannel.Id,
			RootId:    rootPost.Id,
			Message:   "a reply",
		}
		childPost, appErr = th.App.CreatePostMissingChannel(th.Context, childPost, false, true)
		require.Nil(t, appErr)

		postList := model.PostList{
			Order: []string{rootPost.Id, childPost.Id},
			Posts: map[string]*model.Post{rootPost.Id: rootPost, childPost.Id: childPost},
		}
		mentions, err := th.App.SendNotifications(th.Context, childPost, th.BasicTeam, th.BasicChannel, th.BasicUser2, &postList, true)
		require.NoError(t, err)
		assert.False(t, slices.Contains(mentions, user.Id))

		membership, err := th.App.GetThreadMembershipForUser(user.Id, rootPost.Id)
		assert.Error(t, err)
		assert.Nil(t, membership)
	})
}

func TestChannelAutoFollowThreads(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	u1 := th.BasicUser
	u2 := th.BasicUser2
	u3 := th.CreateUser()
	th.LinkUserToTeam(u3, th.BasicTeam)
	c1 := th.BasicChannel
	th.AddUserToChannel(u2, c1)
	th.AddUserToChannel(u3, c1)

	// Set auto-follow for user 2
	member, appErr := th.App.UpdateChannelMemberNotifyProps(th.Context, map[string]string{model.ChannelAutoFollowThreads: model.ChannelAutoFollowThreadsOn}, c1.Id, u2.Id)
	require.Nil(t, appErr)
	require.Equal(t, model.ChannelAutoFollowThreadsOn, member.NotifyProps[model.ChannelAutoFollowThreads])

	rootPost := &model.Post{
		ChannelId: c1.Id,
		Message:   "root post by user3",
		UserId:    u3.Id,
	}
	rpost, appErr := th.App.CreatePost(th.Context, rootPost, c1, false, true)
	require.Nil(t, appErr)

	replyPost1 := &model.Post{
		ChannelId: c1.Id,
		Message:   "reply post by user1",
		UserId:    u1.Id,
		RootId:    rpost.Id,
	}
	_, appErr = th.App.CreatePost(th.Context, replyPost1, c1, false, true)
	require.Nil(t, appErr)

	// user-2 starts auto-following thread
	threadMembership, appErr := th.App.GetThreadMembershipForUser(u2.Id, rpost.Id)
	require.Nil(t, appErr)
	require.NotNil(t, threadMembership)
	assert.True(t, threadMembership.Following)

	// Set "following" to false
	_, err := th.App.Srv().Store().Thread().MaintainMembership(u2.Id, rpost.Id, store.ThreadMembershipOpts{
		Following:       false,
		UpdateFollowing: true,
	})
	require.NoError(t, err)

	replyPost2 := &model.Post{
		ChannelId: c1.Id,
		Message:   "reply post 2 by user1",
		UserId:    u1.Id,
		RootId:    rpost.Id,
	}
	_, appErr = th.App.CreatePost(th.Context, replyPost2, c1, false, true)
	require.Nil(t, appErr)

	// Do NOT start auto-following thread, once "un-followed"
	threadMembership, appErr = th.App.GetThreadMembershipForUser(u2.Id, rpost.Id)
	require.Nil(t, appErr)
	require.NotNil(t, threadMembership)
	assert.False(t, threadMembership.Following)
}

func TestRemoveNotifications(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	u1 := th.BasicUser
	u2 := th.BasicUser2
	c1 := th.BasicChannel
	th.AddUserToChannel(u2, c1)

	// Enable CRT
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	t.Run("base case", func(t *testing.T) {
		rootPost := &model.Post{
			ChannelId: c1.Id,
			Message:   "root post by user1",
			UserId:    u1.Id,
		}
		rootPost, appErr := th.App.CreatePost(th.Context, rootPost, c1, false, true)
		require.Nil(t, appErr)

		replyPost1 := &model.Post{
			ChannelId: c1.Id,
			Message:   "reply post by user2",
			UserId:    u2.Id,
			RootId:    rootPost.Id,
		}
		_, appErr = th.App.CreatePost(th.Context, replyPost1, c1, false, true)
		require.Nil(t, appErr)

		replyPost2 := &model.Post{
			ChannelId: c1.Id,
			Message:   "@" + u2.Username + " mention by user1",
			UserId:    u1.Id,
			RootId:    rootPost.Id,
		}
		replyPost2, appErr = th.App.CreatePost(th.Context, replyPost2, c1, false, true)
		require.Nil(t, appErr)

		_, appErr = th.App.DeletePost(th.Context, replyPost2.Id, u1.Id)
		require.Nil(t, appErr)

		// Because we delete notification async, we need to wait
		// just for a little while before checking the data
		// 2 seconds is a very long time for the task we're performing
		// but its okay considering sometimes the CI machines are slow.
		time.Sleep(2 * time.Second)

		threadMembership, appErr := th.App.GetThreadMembershipForUser(u2.Id, rootPost.Id)
		require.Nil(t, appErr)
		thread, appErr := th.App.GetThreadForUser(threadMembership, false)
		require.Nil(t, appErr)
		require.Equal(t, int64(0), thread.UnreadMentions)
		require.Equal(t, int64(0), thread.UnreadReplies)
	})

	t.Run("when mentioned via a user group", func(t *testing.T) {
		group, appErr := th.App.CreateGroup(&model.Group{
			Name:        model.NewString("test_group"),
			DisplayName: "test_group",
			Source:      model.GroupSourceCustom,
		})
		require.Nil(t, appErr)

		_, appErr = th.App.UpsertGroupMember(group.Id, u1.Id)
		require.Nil(t, appErr)

		_, appErr = th.App.UpsertGroupMember(group.Id, u2.Id)
		require.Nil(t, appErr)

		rootPost := &model.Post{
			ChannelId: c1.Id,
			Message:   "root post by user1",
			UserId:    u1.Id,
		}
		rootPost, appErr = th.App.CreatePost(th.Context, rootPost, c1, false, true)
		require.Nil(t, appErr)

		replyPost1 := &model.Post{
			ChannelId: c1.Id,
			Message:   "reply post by user2",
			UserId:    u2.Id,
			RootId:    rootPost.Id,
		}
		_, appErr = th.App.CreatePost(th.Context, replyPost1, c1, false, true)
		require.Nil(t, appErr)

		replyPost2 := &model.Post{
			ChannelId: c1.Id,
			Message:   "@" + *group.Name + " mention by user1",
			UserId:    u1.Id,
			RootId:    rootPost.Id,
		}
		replyPost2, appErr = th.App.CreatePost(th.Context, replyPost2, c1, false, true)
		require.Nil(t, appErr)

		_, appErr = th.App.DeletePost(th.Context, replyPost2.Id, u1.Id)
		require.Nil(t, appErr)

		time.Sleep(2 * time.Second)

		threadMembership, appErr := th.App.GetThreadMembershipForUser(u2.Id, rootPost.Id)
		require.Nil(t, appErr)
		thread, appErr := th.App.GetThreadForUser(threadMembership, false)
		require.Nil(t, appErr)
		require.Equal(t, int64(0), thread.UnreadMentions)
		require.Equal(t, int64(0), thread.UnreadReplies)
	})
}
