// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	emailmocks "github.com/mattermost/mattermost/server/v8/channels/app/email/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
)

type deferredNotificationsTest struct {
	th   *TestHelper
	bot  *model.User
	push *testPushNotificationHandler
}

// setupDeferredNotificationsTest returns a helper whose BasicUser and BasicUser2 are members of
// BasicChannel with a push-capable mobile session each, and a bot that can post there.
func setupDeferredNotificationsTest(t *testing.T) *deferredNotificationsTest {
	th := Setup(t).InitBasic(t)
	th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

	bot := th.CreateBot(t)
	botUser, appErr := th.App.GetUser(th.Context, bot.UserId)
	require.Nil(t, appErr)
	th.LinkUserToTeam(t, botUser, th.BasicTeam)
	_, appErr = th.App.AddUserToChannel(th.Context, botUser, th.BasicChannel, false)
	require.Nil(t, appErr)

	handler := &testPushNotificationHandler{t: t, behavior: "simple"}
	pushServer := httptest.NewServer(http.HandlerFunc(handler.handleReq))
	t.Cleanup(pushServer.Close)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.SendPushNotifications = true
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
		*cfg.EmailSettings.PushNotificationContents = model.FullNotification
	})

	for _, user := range []*model.User{th.BasicUser, th.BasicUser2} {
		_, appErr = th.App.CreateSession(th.Context, &model.Session{
			UserId:    user.Id,
			DeviceId:  model.PushNotifyAndroidReactNative + ":" + user.Id,
			ExpiresAt: model.GetMillis() + 100000,
		})
		require.Nil(t, appErr)
	}

	return &deferredNotificationsTest{th: th, bot: botUser, push: handler}
}

// messagePushes returns the message pushes sent to the user's device for the post.
func (dt *deferredNotificationsTest) messagePushes(postID, userID string) []*model.PushNotification {
	var pushes []*model.PushNotification
	for _, push := range dt.push.notifications() {
		if push.Type == model.PushTypeMessage && push.PostId == postID && push.DeviceId == userID {
			pushes = append(pushes, push)
		}
	}
	return pushes
}

func (dt *deferredNotificationsTest) requirePushes(t *testing.T, postID, userID string, count int) []*model.PushNotification {
	t.Helper()
	require.Eventually(t, func() bool {
		return len(dt.messagePushes(postID, userID)) >= count
	}, 5*time.Second, 10*time.Millisecond, "expected %d push notification(s)", count)
	dt.requireNoMorePushes(t, postID, userID, count)
	return dt.messagePushes(postID, userID)
}

func (dt *deferredNotificationsTest) requireNoMorePushes(t *testing.T, postID, userID string, count int) {
	t.Helper()
	assert.Never(t, func() bool {
		return len(dt.messagePushes(postID, userID)) > count
	}, 500*time.Millisecond, 10*time.Millisecond, "expected no more than %d push notification(s)", count)
}

func (dt *deferredNotificationsTest) createDeferredPost(t *testing.T, channel *model.Channel, rootID, message string) *model.Post {
	t.Helper()
	post, _, appErr := dt.th.App.CreatePost(dt.th.Context, &model.Post{
		UserId:    dt.bot.Id,
		ChannelId: channel.Id,
		RootId:    rootID,
		Message:   message,
	}, channel, model.CreatePostFlags{DeferNotification: true})
	require.Nil(t, appErr)
	require.True(t, post.HasDeferredNotification())
	require.True(t, post.HasSilentNotification())
	return post
}

// finalizePost edits the post the way a plugin does once its content is complete.
func (dt *deferredNotificationsTest) finalizePost(t *testing.T, post *model.Post, message string) *model.Post {
	t.Helper()
	post = post.Clone()
	post.Message = message
	updated, _, appErr := dt.th.App.UpdatePost(dt.th.Context, post, &model.UpdatePostOptions{})
	require.Nil(t, appErr)
	require.True(t, updated.HasDeferredNotification(), "editing must not release the post")
	return updated
}

func (dt *deferredNotificationsTest) getPost(t *testing.T, postID string) *model.Post {
	t.Helper()
	post, err := dt.th.App.Srv().Store().Post().GetSingle(dt.th.Context, postID, false)
	require.NoError(t, err)
	return post
}

func (dt *deferredNotificationsTest) channelUnread(t *testing.T, channelID, userID string) *model.ChannelUnread {
	t.Helper()
	unread, appErr := dt.th.App.GetChannelUnread(dt.th.Context, channelID, userID)
	require.Nil(t, appErr)
	return unread
}

func (dt *deferredNotificationsTest) totalMsgCount(t *testing.T, channelID string) int64 {
	t.Helper()
	channel, err := dt.th.App.Srv().Store().Channel().Get(channelID, false)
	require.NoError(t, err)
	return channel.TotalMsgCount
}

type sentEmail struct {
	to   string
	body string
}

// captureEmails turns on email notifications and records the notification emails sent,
// rendered by the real email service.
func (dt *deferredNotificationsTest) captureEmails(t *testing.T) func() []sentEmail {
	t.Helper()
	dt.th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.SendEmailNotifications = true
		*cfg.EmailSettings.EnableEmailBatching = false
		*cfg.EmailSettings.EmailNotificationContentsType = model.EmailNotificationContentsFull
	})

	var mut sync.Mutex
	var sent []sentEmail
	realEmailService := dt.th.App.Srv().EmailService
	emailServiceMock := &emailmocks.ServiceInterface{}
	emailServiceMock.On("GetMessageForNotification", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(func(post *model.Post, teamName, siteURL string, translateFunc i18n.TranslateFunc) string {
			return realEmailService.GetMessageForNotification(post, teamName, siteURL, translateFunc)
		})
	emailServiceMock.On("NewEmailTemplateData", mock.Anything).
		Return(func(locale string) templates.Data {
			return realEmailService.NewEmailTemplateData(locale)
		})
	emailServiceMock.On("SendMailWithEmbeddedFiles", mock.Anything, mock.Anything, mock.Anything,
		mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			mut.Lock()
			defer mut.Unlock()
			sent = append(sent, sentEmail{to: args.String(0), body: args.String(2)})
		}).Return(nil)
	emailServiceMock.On("InitEmailBatching").Return()
	emailServiceMock.On("Stop").Return()
	dt.th.App.Srv().EmailService = emailServiceMock

	return func() []sentEmail {
		mut.Lock()
		defer mut.Unlock()
		return append([]sentEmail(nil), sent...)
	}
}

func waitForPostEvent(t *testing.T, events chan *model.WebSocketEvent, eventType model.WebsocketEventType, postID string) (*model.WebSocketEvent, *model.Post) {
	t.Helper()
	timeout := time.After(5 * time.Second)
	for {
		select {
		case event := <-events:
			if event.EventType() != eventType {
				continue
			}
			post := &model.Post{}
			require.NoError(t, json.Unmarshal([]byte(event.GetData()["post"].(string)), post))
			if post.Id == postID {
				return event, post
			}
		case <-timeout:
			require.FailNow(t, "timed out waiting for websocket event", "event %s for post %s", eventType, postID)
		}
	}
}

func waitForThreadUpdatedEvent(t *testing.T, events chan *model.WebSocketEvent, threadID string) *model.ThreadResponse {
	t.Helper()
	timeout := time.After(5 * time.Second)
	for {
		select {
		case event := <-events:
			if event.EventType() != model.WebsocketEventThreadUpdated {
				continue
			}
			thread := &model.ThreadResponse{}
			require.NoError(t, json.Unmarshal([]byte(event.GetData()["thread"].(string)), thread))
			if thread.PostId == threadID {
				return thread
			}
		case <-timeout:
			require.FailNow(t, "timed out waiting for thread_updated event", "thread %s", threadID)
		}
	}
}

func requireNoPostEvent(t *testing.T, events chan *model.WebSocketEvent, eventType model.WebsocketEventType, postID string) {
	t.Helper()
	timeout := time.After(500 * time.Millisecond)
	for {
		select {
		case event := <-events:
			if event.EventType() != eventType {
				continue
			}
			post := &model.Post{}
			require.NoError(t, json.Unmarshal([]byte(event.GetData()["post"].(string)), post))
			require.NotEqual(t, postID, post.Id, "unexpected %s event for the post", eventType)
		case <-timeout:
			return
		}
	}
}

func TestCreatePostDeferNotification(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("integration authors can defer", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		bot := th.CreateBot(t)
		botUser, appErr := th.App.GetUser(th.Context, bot.UserId)
		require.Nil(t, appErr)
		th.LinkUserToTeam(t, botUser, th.BasicTeam)
		_, appErr = th.App.AddUserToChannel(th.Context, botUser, th.BasicChannel, false)
		require.Nil(t, appErr)

		for _, tc := range []struct {
			name   string
			userID string
			flags  model.CreatePostFlags
		}{
			{name: "bot", userID: botUser.Id, flags: model.CreatePostFlags{DeferNotification: true}},
			{name: "plugin", userID: th.BasicUser.Id, flags: model.CreatePostFlags{DeferNotification: true, FromPlugin: true}},
			{name: "incoming webhook", userID: th.BasicUser.Id, flags: model.CreatePostFlags{DeferNotification: true, FromIncomingWebhook: true}},
		} {
			t.Run(tc.name, func(t *testing.T) {
				post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
					UserId:    tc.userID,
					ChannelId: th.BasicChannel.Id,
					Message:   "placeholder",
				}, th.BasicChannel, tc.flags)
				require.Nil(t, appErr)
				assert.True(t, post.HasDeferredNotification())
				assert.True(t, post.HasSilentNotification())

				stored, err := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
				require.NoError(t, err)
				assert.True(t, stored.HasDeferredNotification())
				assert.True(t, stored.HasSilentNotification())
			})
		}
	})

	t.Run("rejected requests", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostPriority = true
			*cfg.ServiceSettings.AllowPersistentNotifications = true
		})

		bot := th.CreateBot(t)
		botUser, appErr := th.App.GetUser(th.Context, bot.UserId)
		require.Nil(t, appErr)
		th.LinkUserToTeam(t, botUser, th.BasicTeam)
		_, appErr = th.App.AddUserToChannel(th.Context, botUser, th.BasicChannel, false)
		require.Nil(t, appErr)

		persistent := &model.PostMetadata{Priority: &model.PostPriority{
			Priority:                model.NewPointer(model.PostPriorityUrgent),
			PersistentNotifications: model.NewPointer(true),
		}}

		for _, tc := range []struct {
			name       string
			userID     string
			postType   string
			metadata   *model.PostMetadata
			flags      model.CreatePostFlags
			wantID     string
			wantStatus int
		}{
			{
				name:       "human author",
				userID:     th.BasicUser.Id,
				flags:      model.CreatePostFlags{DeferNotification: true},
				wantID:     "api.post.create_post.deferred_notification.app_error",
				wantStatus: http.StatusForbidden,
			},
			{
				name:       "also silent",
				userID:     botUser.Id,
				flags:      model.CreatePostFlags{DeferNotification: true, SilentNotification: true},
				wantID:     "api.post.create_post.deferred_notification_conflict.app_error",
				wantStatus: http.StatusBadRequest,
			},
			{
				name:       "also forced",
				userID:     botUser.Id,
				flags:      model.CreatePostFlags{DeferNotification: true, ForceNotification: true},
				wantID:     "api.post.create_post.deferred_notification_conflict.app_error",
				wantStatus: http.StatusBadRequest,
			},
			{
				name:       "persistent notifications",
				userID:     botUser.Id,
				metadata:   persistent,
				flags:      model.CreatePostFlags{DeferNotification: true},
				wantID:     "api.post.create_post.deferred_persistent_notification.app_error",
				wantStatus: http.StatusBadRequest,
			},
			{
				name:       "burn on read",
				userID:     botUser.Id,
				postType:   model.PostTypeBurnOnRead,
				flags:      model.CreatePostFlags{DeferNotification: true},
				wantID:     "api.post.create_post.deferred_burn_on_read.app_error",
				wantStatus: http.StatusBadRequest,
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
					UserId:    tc.userID,
					ChannelId: th.BasicChannel.Id,
					Type:      tc.postType,
					Message:   "placeholder @" + th.BasicUser2.Username,
					Metadata:  tc.metadata,
				}, th.BasicChannel, tc.flags)
				require.NotNil(t, appErr)
				assert.Equal(t, tc.wantID, appErr.Id)
				assert.Equal(t, tc.wantStatus, appErr.StatusCode)
			})
		}
	})

	t.Run("a deferred post notifies nobody when created", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		_, appErr := th.App.MarkChannelsAsViewed(th.Context, []string{th.BasicChannel.Id}, th.BasicUser2.Id, "", false, false)
		require.Nil(t, appErr)
		unreadBefore := dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser2.Id)
		totalBefore := dt.totalMsgCount(t, th.BasicChannel.Id)

		events, closeWS := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", []model.WebsocketEventType{model.WebsocketEventPosted})
		defer closeWS()

		post := dt.createDeferredPost(t, th.BasicChannel, "", "placeholder @"+th.BasicUser2.Username)

		event, eventPost := waitForPostEvent(t, events, model.WebsocketEventPosted, post.Id)
		assert.True(t, eventPost.HasDeferredNotification())
		assert.True(t, eventPost.HasSilentNotification())
		assert.Nil(t, event.GetData()["mentions"])

		dt.requireNoMorePushes(t, post.Id, th.BasicUser2.Id, 0)
		assert.Equal(t, totalBefore, dt.totalMsgCount(t, th.BasicChannel.Id))
		unreadAfter := dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser2.Id)
		assert.Equal(t, unreadBefore.MsgCount, unreadAfter.MsgCount)
		assert.Equal(t, unreadBefore.MentionCount, unreadAfter.MentionCount)
	})

	t.Run("a post in a shared channel notifies when created", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		channel := th.BasicChannel.DeepCopy()
		channel.Shared = model.NewPointer(true)
		channel, err := th.App.Srv().Store().Channel().Update(th.Context, channel)
		require.NoError(t, err)
		totalBefore := dt.totalMsgCount(t, channel.Id)

		post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    dt.bot.Id,
			ChannelId: channel.Id,
			Message:   "hello @" + th.BasicUser2.Username,
		}, channel, model.CreatePostFlags{DeferNotification: true})
		require.Nil(t, appErr)
		assert.False(t, post.HasDeferredNotification())
		assert.False(t, post.HasSilentNotification())
		stored := dt.getPost(t, post.Id)
		assert.False(t, stored.HasDeferredNotification())
		assert.False(t, stored.HasSilentNotification())

		dt.requirePushes(t, post.Id, th.BasicUser2.Id, 1)
		assert.Equal(t, totalBefore+1, dt.totalMsgCount(t, channel.Id))

		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))
		dt.requireNoMorePushes(t, post.Id, th.BasicUser2.Id, 1)
		assert.Equal(t, totalBefore+1, dt.totalMsgCount(t, channel.Id))
	})

	t.Run("edits cannot add or remove the marker", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		deferred := dt.createDeferredPost(t, th.BasicChannel, "", "placeholder")
		edit := deferred.Clone()
		edit.Message = "edited"
		edit.DelProp(model.PostPropsDeferredNotification)
		edit.DelProp(model.PostPropsSilentNotification)
		updated, _, appErr := th.App.UpdatePost(th.Context, edit, &model.UpdatePostOptions{})
		require.Nil(t, appErr)
		assert.Equal(t, "edited", updated.Message)
		assert.True(t, updated.HasDeferredNotification())
		assert.True(t, updated.HasSilentNotification())

		normal, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    dt.bot.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "normal",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		edit = normal.Clone()
		edit.AddProp(model.PostPropsDeferredNotification, true)
		updated, _, appErr = th.App.UpdatePost(th.Context, edit, &model.UpdatePostOptions{})
		require.Nil(t, appErr)
		assert.False(t, updated.HasDeferredNotification())
		assert.False(t, dt.getPost(t, normal.Id).HasDeferredNotification())
	})
}

func TestDeliverPostNotifications(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("releases a channel post against its final content, once", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		_, appErr := th.App.MarkChannelsAsViewed(th.Context, []string{th.BasicChannel.Id}, th.BasicUser2.Id, "", false, false)
		require.Nil(t, appErr)
		unreadBefore := dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser2.Id)
		totalBefore := dt.totalMsgCount(t, th.BasicChannel.Id)

		post := dt.createDeferredPost(t, th.BasicChannel, "", "thinking...")
		finalMessage := "the answer, @" + th.BasicUser2.Username
		dt.finalizePost(t, post, finalMessage)
		dt.requireNoMorePushes(t, post.Id, th.BasicUser2.Id, 0)

		events, closeWS := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", []model.WebsocketEventType{model.WebsocketEventPosted})
		defer closeWS()

		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))

		event, eventPost := waitForPostEvent(t, events, model.WebsocketEventPosted, post.Id)
		assert.Equal(t, th.BasicChannel.Id, event.GetBroadcast().ChannelId)
		assert.Equal(t, finalMessage, eventPost.Message)
		assert.False(t, eventPost.HasDeferredNotification())
		assert.False(t, eventPost.HasSilentNotification())
		assertUnmarshalsTo(t, []string{th.BasicUser2.Id}, event.GetData()["mentions"])
		assert.NotContains(t, event.GetData(), "notification_only", "a released post is a new message for the channel")

		pushes := dt.requirePushes(t, post.Id, th.BasicUser2.Id, 1)
		assert.Equal(t, "@"+dt.bot.Username+": the answer, @"+th.BasicUser2.Username, pushes[0].Message)

		stored := dt.getPost(t, post.Id)
		assert.False(t, stored.HasDeferredNotification())
		assert.False(t, stored.HasSilentNotification())
		assert.Equal(t, finalMessage, stored.Message)

		assert.Equal(t, totalBefore+1, dt.totalMsgCount(t, th.BasicChannel.Id))
		unreadAfter := dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser2.Id)
		assert.Equal(t, unreadBefore.MsgCount+1, unreadAfter.MsgCount)
		assert.Equal(t, unreadBefore.MentionCount+1, unreadAfter.MentionCount)

		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))
		requireNoPostEvent(t, events, model.WebsocketEventPosted, post.Id)
		dt.requireNoMorePushes(t, post.Id, th.BasicUser2.Id, 1)
		assert.Equal(t, totalBefore+1, dt.totalMsgCount(t, th.BasicChannel.Id))
		assert.Equal(t, unreadAfter.MentionCount, dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser2.Id).MentionCount)
	})

	t.Run("concurrent deliveries notify once", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		post := dt.createDeferredPost(t, th.BasicChannel, "", "hello @"+th.BasicUser2.Username)
		totalBefore := dt.totalMsgCount(t, th.BasicChannel.Id)

		var wg sync.WaitGroup
		errs := make([]*model.AppError, 5)
		for i := range errs {
			wg.Go(func() {
				errs[i] = th.App.DeliverPostNotifications(th.Context, post.Id, nil)
			})
		}
		wg.Wait()
		for _, appErr := range errs {
			require.Nil(t, appErr)
		}

		dt.requirePushes(t, post.Id, th.BasicUser2.Id, 1)
		assert.Equal(t, totalBefore+1, dt.totalMsgCount(t, th.BasicChannel.Id))
		assert.Equal(t, int64(1), dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser2.Id).MentionCount)
	})

	t.Run("users who viewed the post while it was deferred see it as unread", func(t *testing.T) {
		mainHelper.Parallel(t)

		for _, tc := range []struct {
			name string
			// create returns the deferred post, finalized.
			create func(t *testing.T, dt *deferredNotificationsTest) *model.Post
			// view marks the post's channel or thread viewed for the user.
			view func(t *testing.T, dt *deferredNotificationsTest, post *model.Post, userID string)
			// lastViewed returns the user's last viewed time for the post's channel or thread.
			lastViewed func(t *testing.T, dt *deferredNotificationsTest, post *model.Post, userID string) int64
			// requireUnread checks the post shows as unread for the viewer.
			requireUnread func(t *testing.T, dt *deferredNotificationsTest, post *model.Post, userID string)
		}{
			{
				name: "channel post",
				create: func(t *testing.T, dt *deferredNotificationsTest) *model.Post {
					post := dt.createDeferredPost(t, dt.th.BasicChannel, "", "thinking...")
					return dt.finalizePost(t, post, "final answer")
				},
				view: func(t *testing.T, dt *deferredNotificationsTest, post *model.Post, userID string) {
					_, appErr := dt.th.App.MarkChannelsAsViewed(dt.th.Context, []string{post.ChannelId}, userID, "", false, false)
					require.Nil(t, appErr)
				},
				lastViewed: func(t *testing.T, dt *deferredNotificationsTest, post *model.Post, userID string) int64 {
					member, appErr := dt.th.App.GetChannelMember(dt.th.Context, post.ChannelId, userID)
					require.Nil(t, appErr)
					return member.LastViewedAt
				},
				requireUnread: func(t *testing.T, dt *deferredNotificationsTest, post *model.Post, userID string) {
					assert.Equal(t, int64(1), dt.channelUnread(t, post.ChannelId, userID).MsgCount)
				},
			},
			{
				name: "reply with collapsed threads",
				create: func(t *testing.T, dt *deferredNotificationsTest) *model.Post {
					dt.th.App.UpdateConfig(func(cfg *model.Config) {
						*cfg.ServiceSettings.ThreadAutoFollow = true
						*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsAlwaysOn
					})
					_, _, appErr := dt.th.App.CreatePost(dt.th.Context, &model.Post{
						UserId:    dt.bot.Id,
						ChannelId: dt.th.BasicChannel.Id,
						RootId:    dt.th.BasicPost.Id,
						Message:   "first reply",
					}, dt.th.BasicChannel, model.CreatePostFlags{})
					require.Nil(t, appErr)
					reply := dt.createDeferredPost(t, dt.th.BasicChannel, dt.th.BasicPost.Id, "thinking...")
					return dt.finalizePost(t, reply, "final threaded answer")
				},
				view: func(t *testing.T, dt *deferredNotificationsTest, post *model.Post, userID string) {
					_, appErr := dt.th.App.UpdateThreadReadForUser(dt.th.Context, "", userID, dt.th.BasicTeam.Id, post.RootId, model.GetMillis())
					require.Nil(t, appErr)
				},
				lastViewed: func(t *testing.T, dt *deferredNotificationsTest, post *model.Post, userID string) int64 {
					membership, appErr := dt.th.App.GetThreadMembershipForUser(userID, post.RootId)
					require.Nil(t, appErr)
					return membership.LastViewed
				},
				requireUnread: func(t *testing.T, dt *deferredNotificationsTest, post *model.Post, userID string) {
					membership, appErr := dt.th.App.GetThreadMembershipForUser(userID, post.RootId)
					require.Nil(t, appErr)
					thread, appErr := dt.th.App.GetThreadForUser(dt.th.Context, membership, false)
					require.Nil(t, appErr)
					assert.Equal(t, int64(1), thread.UnreadReplies)
					threads, appErr := dt.th.App.GetThreadsForUser(dt.th.Context, userID, dt.th.BasicTeam.Id, model.GetUserThreadsOpts{})
					require.Nil(t, appErr)
					assert.Equal(t, int64(1), threads.TotalUnreadThreads)
				},
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				mainHelper.Parallel(t)
				dt := setupDeferredNotificationsTest(t)
				th := dt.th

				post := tc.create(t, dt)
				// Views must land in a later millisecond than the post's creation to cover it.
				time.Sleep(5 * time.Millisecond)
				for _, userID := range []string{th.BasicUser.Id, dt.bot.Id} {
					tc.view(t, dt, post, userID)
					require.GreaterOrEqual(t, tc.lastViewed(t, dt, post, userID), post.CreateAt)
				}
				authorViewedAt := tc.lastViewed(t, dt, post, dt.bot.Id)

				require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))

				tc.requireUnread(t, dt, post, th.BasicUser.Id)
				assert.Equal(t, post.CreateAt-1, tc.lastViewed(t, dt, post, th.BasicUser.Id), "the new messages line must start at the post")
				assert.GreaterOrEqual(t, tc.lastViewed(t, dt, post, dt.bot.Id), authorViewedAt, "the author's view must not be moved back")
			})
		}
	})

	t.Run("an edit racing the release does not make the post deferred again", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		// The release lands between UpdatePost reading the post and writing the edit.
		pluginID := "testdeliverpostnotificationsduringedit"
		setupPluginAPITest(t, `
		package main

		import (
			"strings"

			"github.com/mattermost/mattermost/server/public/model"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type TestPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *TestPlugin) MessageWillBeUpdated(c *plugin.Context, newPost, oldPost *model.Post) (*model.Post, string) {
			if strings.HasPrefix(newPost.Message, "racing edit") {
				if appErr := p.API.DeliverPostNotifications(newPost.Id, nil); appErr != nil {
					return nil, appErr.Error()
				}
			}
			return newPost, ""
		}

		func main() {
			plugin.ClientMain(&TestPlugin{})
		}
		`, `{"id": "testdeliverpostnotificationsduringedit", "server": {"executable": "backend.exe"}}`, pluginID, th.App, th.Context)

		totalBefore := dt.totalMsgCount(t, th.BasicChannel.Id)
		post := dt.createDeferredPost(t, th.BasicChannel, "", "thinking @"+th.BasicUser2.Username)

		edit := post.Clone()
		edit.Message = "racing edit @" + th.BasicUser2.Username
		updated, _, appErr := th.App.UpdatePost(th.Context, edit, &model.UpdatePostOptions{})
		require.Nil(t, appErr)
		assert.Equal(t, edit.Message, updated.Message)
		assert.False(t, updated.HasDeferredNotification())
		assert.False(t, updated.HasSilentNotification())

		stored := dt.getPost(t, post.Id)
		assert.Equal(t, edit.Message, stored.Message)
		assert.False(t, stored.HasDeferredNotification())
		assert.False(t, stored.HasSilentNotification())
		dt.requirePushes(t, post.Id, th.BasicUser2.Id, 1)
		assert.Equal(t, totalBefore+1, dt.totalMsgCount(t, th.BasicChannel.Id))
		mentionsAfterRelease := dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser2.Id).MentionCount
		assert.Equal(t, int64(1), mentionsAfterRelease)

		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))
		dt.requireNoMorePushes(t, post.Id, th.BasicUser2.Id, 1)
		assert.Equal(t, totalBefore+1, dt.totalMsgCount(t, th.BasicChannel.Id))
		assert.Equal(t, mentionsAfterRelease, dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser2.Id).MentionCount)
	})

	t.Run("archived channel", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		post := dt.createDeferredPost(t, th.BasicChannel, "", "hello @"+th.BasicUser2.Username)
		require.Nil(t, th.App.DeleteChannel(th.Context, th.BasicChannel, th.SystemAdminUser.Id))
		totalBefore := dt.totalMsgCount(t, th.BasicChannel.Id)

		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))
		dt.requireNoMorePushes(t, post.Id, th.BasicUser2.Id, 0)
		assert.Equal(t, totalBefore, dt.totalMsgCount(t, th.BasicChannel.Id))
		assert.True(t, dt.getPost(t, post.Id).HasDeferredNotification(), "the post stays deferred while its channel is archived")

		channel, appErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.RestoreChannel(th.Context, channel, th.SystemAdminUser.Id)
		require.Nil(t, appErr)
		totalBefore = dt.totalMsgCount(t, th.BasicChannel.Id)
		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))
		dt.requirePushes(t, post.Id, th.BasicUser2.Id, 1)
		assert.Equal(t, totalBefore+1, dt.totalMsgCount(t, th.BasicChannel.Id))
		assert.False(t, dt.getPost(t, post.Id).HasDeferredNotification())
	})

	t.Run("follows the recipient's notification settings like a regular post", func(t *testing.T) {
		mainHelper.Parallel(t)

		for _, tc := range []struct {
			name       string
			setup      func(t *testing.T, dt *deferredNotificationsTest)
			mention    bool
			wantPushes int
		}{
			{
				name:       "mentioned",
				setup:      func(t *testing.T, dt *deferredNotificationsTest) {},
				mention:    true,
				wantPushes: 1,
			},
			{
				name:  "not mentioned",
				setup: func(t *testing.T, dt *deferredNotificationsTest) {},
			},
			{
				name: "muted channel",
				setup: func(t *testing.T, dt *deferredNotificationsTest) {
					_, appErr := dt.th.App.UpdateChannelMemberNotifyProps(dt.th.Context, map[string]string{model.MarkUnreadNotifyProp: model.ChannelMarkUnreadMention}, dt.th.BasicChannel.Id, dt.th.BasicUser2.Id)
					require.Nil(t, appErr)
				},
				mention: true,
			},
			{
				name: "do not disturb",
				setup: func(t *testing.T, dt *deferredNotificationsTest) {
					dt.th.App.SetStatusDoNotDisturb(dt.th.BasicUser2.Id)
				},
				mention: true,
			},
			{
				name:    "out of office",
				setup:   func(t *testing.T, dt *deferredNotificationsTest) { dt.th.App.SetStatusOutOfOffice(dt.th.BasicUser2.Id) },
				mention: true,
			},
			{
				name: "push for all messages",
				setup: func(t *testing.T, dt *deferredNotificationsTest) {
					user, appErr := dt.th.App.GetUser(dt.th.Context, dt.th.BasicUser2.Id)
					require.Nil(t, appErr)
					user.NotifyProps[model.PushNotifyProp] = model.UserNotifyAll
					_, appErr = dt.th.App.UpdateUser(dt.th.Context, user, false)
					require.Nil(t, appErr)
				},
				wantPushes: 1,
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				mainHelper.Parallel(t)
				dt := setupDeferredNotificationsTest(t)
				th := dt.th
				tc.setup(t, dt)

				message := "final answer"
				if tc.mention {
					message += " for @" + th.BasicUser2.Username
				}

				regular, _, appErr := th.App.CreatePost(th.Context, &model.Post{
					UserId:    dt.bot.Id,
					ChannelId: th.BasicChannel.Id,
					Message:   message,
				}, th.BasicChannel, model.CreatePostFlags{})
				require.Nil(t, appErr)

				post := dt.createDeferredPost(t, th.BasicChannel, "", "thinking...")
				dt.finalizePost(t, post, message)
				require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))

				for _, postID := range []string{regular.Id, post.Id} {
					if tc.wantPushes > 0 {
						pushes := dt.requirePushes(t, postID, th.BasicUser2.Id, tc.wantPushes)
						assert.Contains(t, pushes[0].Message, message)
					} else {
						dt.requireNoMorePushes(t, postID, th.BasicUser2.Id, 0)
					}
				}
			})
		}
	})

	t.Run("emails mentioned users the final content", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th
		sentEmails := dt.captureEmails(t)

		post := dt.createDeferredPost(t, th.BasicChannel, "", "thinking... @"+th.BasicUser2.Username)
		dt.finalizePost(t, post, "the final answer for @"+th.BasicUser2.Username)
		assert.Never(t, func() bool { return len(sentEmails()) > 0 }, 500*time.Millisecond, 10*time.Millisecond, "a deferred post must not email anyone before it is released")

		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))

		require.Eventually(t, func() bool { return len(sentEmails()) > 0 }, 5*time.Second, 10*time.Millisecond)
		assert.Never(t, func() bool { return len(sentEmails()) > 1 }, 500*time.Millisecond, 10*time.Millisecond)
		email := sentEmails()[0]
		assert.Equal(t, th.BasicUser2.Email, email.to)
		assert.Contains(t, email.body, "the final answer for")
		assert.NotContains(t, email.body, "thinking...")
	})

	t.Run("direct message", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		dm, appErr := th.App.createDirectChannel(th.Context, dt.bot.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.MarkChannelsAsViewed(th.Context, []string{dm.Id}, th.BasicUser2.Id, "", false, false)
		require.Nil(t, appErr)

		post := dt.createDeferredPost(t, dm, "", "thinking...")
		dt.finalizePost(t, post, "final dm answer")
		dt.requireNoMorePushes(t, post.Id, th.BasicUser2.Id, 0)
		require.Zero(t, dt.channelUnread(t, dm.Id, th.BasicUser2.Id).MsgCount)

		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))

		pushes := dt.requirePushes(t, post.Id, th.BasicUser2.Id, 1)
		assert.Equal(t, "final dm answer", pushes[0].Message)
		unread := dt.channelUnread(t, dm.Id, th.BasicUser2.Id)
		assert.Equal(t, int64(1), unread.MsgCount)
		assert.Equal(t, int64(1), unread.MentionCount)
	})

	t.Run("thread reply with collapsed threads", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ThreadAutoFollow = true
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsAlwaysOn
		})

		root := th.BasicPost
		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    dt.bot.Id,
			ChannelId: th.BasicChannel.Id,
			RootId:    root.Id,
			Message:   "first reply",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		reply := dt.createDeferredPost(t, th.BasicChannel, root.Id, "thinking...")
		dt.finalizePost(t, reply, "final threaded answer")

		_, appErr = th.App.UpdateThreadReadForUser(th.Context, "", th.BasicUser.Id, th.BasicTeam.Id, root.Id, model.GetMillis())
		require.Nil(t, appErr)
		threads, appErr := th.App.GetThreadsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		require.Zero(t, threads.TotalUnreadThreads)
		dt.requireNoMorePushes(t, reply.Id, th.BasicUser.Id, 0)

		events, closeWS := connectFakeWebSocket(t, th, th.BasicUser.Id, "", []model.WebsocketEventType{model.WebsocketEventPosted, model.WebsocketEventThreadUpdated})
		defer closeWS()

		// The release must land in a later millisecond than the read for LastReplyAt to pass it.
		time.Sleep(5 * time.Millisecond)
		require.Nil(t, th.App.DeliverPostNotifications(th.Context, reply.Id, nil))

		event, eventPost := waitForPostEvent(t, events, model.WebsocketEventPosted, reply.Id)
		assert.False(t, eventPost.HasDeferredNotification())
		assertUnmarshalsTo(t, []string{th.BasicUser.Id}, event.GetData()["followers"])
		thread := waitForThreadUpdatedEvent(t, events, root.Id)
		assert.Greater(t, thread.LastReplyAt, int64(0))

		pushes := dt.requirePushes(t, reply.Id, th.BasicUser.Id, 1)
		assert.Contains(t, pushes[0].Message, "final threaded answer")

		threads, appErr = th.App.GetThreadsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		assert.Equal(t, int64(1), threads.TotalUnreadThreads)
	})

	t.Run("posts that are not deferred are left alone", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		createPost := func(flags model.CreatePostFlags) func(t *testing.T) *model.Post {
			return func(t *testing.T) *model.Post {
				post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
					UserId:    dt.bot.Id,
					ChannelId: th.BasicChannel.Id,
					Message:   "hello @" + th.BasicUser2.Username,
				}, th.BasicChannel, flags)
				require.Nil(t, appErr)
				return post
			}
		}

		for _, tc := range []struct {
			name         string
			create       func(t *testing.T) *model.Post
			createPushes int
			wantSilent   bool
		}{
			{name: "regular post", create: createPost(model.CreatePostFlags{}), createPushes: 1},
			{name: "silent post", create: createPost(model.CreatePostFlags{SilentNotification: true}), wantSilent: true},
			{
				// Was counted as a message when saved, for example by a remote cluster.
				name: "post with the deferred marker but not silent",
				create: func(t *testing.T) *model.Post {
					post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
						UserId:    dt.bot.Id,
						ChannelId: th.BasicChannel.Id,
						Message:   "hello @" + th.BasicUser2.Username,
						Props:     model.StringInterface{model.PostPropsDeferredNotification: true},
					})
					require.NoError(t, err)
					return post
				},
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				post := tc.create(t)
				if tc.createPushes > 0 {
					dt.requirePushes(t, post.Id, th.BasicUser2.Id, tc.createPushes)
				} else {
					dt.requireNoMorePushes(t, post.Id, th.BasicUser2.Id, 0)
				}
				totalBefore := dt.totalMsgCount(t, th.BasicChannel.Id)
				updateAtBefore := dt.getPost(t, post.Id).UpdateAt

				require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))

				dt.requireNoMorePushes(t, post.Id, th.BasicUser2.Id, tc.createPushes)
				assert.Equal(t, totalBefore, dt.totalMsgCount(t, th.BasicChannel.Id))
				stored := dt.getPost(t, post.Id)
				assert.Equal(t, tc.wantSilent, stored.HasSilentNotification())
				assert.Equal(t, updateAtBefore, stored.UpdateAt)
			})
		}
	})

	t.Run("errors", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		deleted := dt.createDeferredPost(t, th.BasicChannel, "", "deleted")
		_, appErr := th.App.DeletePost(th.Context, deleted.Id, dt.bot.Id)
		require.Nil(t, appErr)
		deferred := dt.createDeferredPost(t, th.BasicChannel, "", "deferred")
		tooManyUserIDs := make([]string, model.DeliverPostNotificationsMaxUserIDs+1)
		for i := range tooManyUserIDs {
			tooManyUserIDs[i] = model.NewId()
		}

		for _, tc := range []struct {
			name       string
			postID     string
			options    *model.DeliverPostNotificationsOptions
			wantStatus int
		}{
			{name: "invalid post id", postID: "invalid", wantStatus: http.StatusBadRequest},
			{name: "missing post", postID: model.NewId(), wantStatus: http.StatusNotFound},
			{name: "deleted post", postID: deleted.Id, wantStatus: http.StatusNotFound},
			{name: "deleted post, scoped", postID: deleted.Id, options: &model.DeliverPostNotificationsOptions{UserIDs: []string{th.BasicUser2.Id}}, wantStatus: http.StatusNotFound},
			{name: "invalid user id", postID: deferred.Id, options: &model.DeliverPostNotificationsOptions{UserIDs: []string{th.BasicUser2.Id, "invalid"}}, wantStatus: http.StatusBadRequest},
			{name: "options without user ids", postID: deferred.Id, options: &model.DeliverPostNotificationsOptions{}, wantStatus: http.StatusBadRequest},
			{name: "too many user ids", postID: deferred.Id, options: &model.DeliverPostNotificationsOptions{UserIDs: tooManyUserIDs}, wantStatus: http.StatusBadRequest},
		} {
			t.Run(tc.name, func(t *testing.T) {
				appErr := th.App.DeliverPostNotifications(th.Context, tc.postID, tc.options)
				require.NotNil(t, appErr)
				assert.Equal(t, tc.wantStatus, appErr.StatusCode)
			})
		}

		assert.True(t, dt.getPost(t, deferred.Id).HasDeferredNotification(), "a rejected request must not release the post")
		dt.requireNoMorePushes(t, deferred.Id, th.BasicUser2.Id, 0)
	})
}

func TestDeliverPostNotificationsToUsers(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("notifies only the listed users and keeps the post deferred", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		post := dt.createDeferredPost(t, th.BasicChannel, "", "thinking...")
		dt.finalizePost(t, post, "your request is ready")
		totalBefore := dt.totalMsgCount(t, th.BasicChannel.Id)
		unreadBefore := dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser2.Id)
		otherUnreadBefore := dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser.Id)

		eventTypes := []model.WebsocketEventType{model.WebsocketEventPosted}
		recipientEvents, closeRecipient := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", eventTypes)
		defer closeRecipient()
		otherEvents, closeOther := connectFakeWebSocket(t, th, th.BasicUser.Id, "", eventTypes)
		defer closeOther()

		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, &model.DeliverPostNotificationsOptions{
			UserIDs: []string{th.BasicUser2.Id, th.BasicUser2.Id},
		}))

		event, eventPost := waitForPostEvent(t, recipientEvents, model.WebsocketEventPosted, post.Id)
		assert.Equal(t, th.BasicUser2.Id, event.GetBroadcast().UserId)
		assert.Empty(t, event.GetBroadcast().ChannelId)
		assert.Equal(t, "your request is ready", eventPost.Message)
		assert.False(t, eventPost.HasDeferredNotification())
		assert.False(t, eventPost.HasSilentNotification())
		assertUnmarshalsTo(t, []string{th.BasicUser2.Id}, event.GetData()["mentions"])
		assert.Equal(t, th.BasicTeam.Id, event.GetData()["team_id"])
		assert.Equal(t, true, event.GetData()["notification_only"], "clients must not count the post as a new message")
		requireNoPostEvent(t, otherEvents, model.WebsocketEventPosted, post.Id)

		pushes := dt.requirePushes(t, post.Id, th.BasicUser2.Id, 1)
		assert.Equal(t, "@"+dt.bot.Username+": your request is ready", pushes[0].Message)
		dt.requireNoMorePushes(t, post.Id, th.BasicUser.Id, 0)

		unreadAfter := dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser2.Id)
		assert.Equal(t, unreadBefore.MentionCount+1, unreadAfter.MentionCount)
		assert.Equal(t, unreadBefore.MsgCount, unreadAfter.MsgCount)
		assert.Equal(t, otherUnreadBefore.MentionCount, dt.channelUnread(t, th.BasicChannel.Id, th.BasicUser.Id).MentionCount)

		assert.Equal(t, totalBefore, dt.totalMsgCount(t, th.BasicChannel.Id))
		stored := dt.getPost(t, post.Id)
		assert.True(t, stored.HasDeferredNotification())
		assert.True(t, stored.HasSilentNotification())

		// Scoped deliveries can repeat, and the post can still be released afterwards.
		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, &model.DeliverPostNotificationsOptions{UserIDs: []string{th.BasicUser2.Id}}))
		dt.requirePushes(t, post.Id, th.BasicUser2.Id, 2)
		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))
		assert.False(t, dt.getPost(t, post.Id).HasDeferredNotification())
		assert.Equal(t, totalBefore+1, dt.totalMsgCount(t, th.BasicChannel.Id))
	})

	t.Run("a release after a scoped delivery notifies the users again", func(t *testing.T) {
		mainHelper.Parallel(t)

		for _, tc := range []struct {
			name    string
			channel func(t *testing.T, dt *deferredNotificationsTest) *model.Channel
		}{
			{
				name:    "channel mention",
				channel: func(t *testing.T, dt *deferredNotificationsTest) *model.Channel { return dt.th.BasicChannel },
			},
			{
				name: "direct message",
				channel: func(t *testing.T, dt *deferredNotificationsTest) *model.Channel {
					dm, appErr := dt.th.App.createDirectChannel(dt.th.Context, dt.bot.Id, dt.th.BasicUser2.Id)
					require.Nil(t, appErr)
					return dm
				},
			},
			{
				name: "group message",
				channel: func(t *testing.T, dt *deferredNotificationsTest) *model.Channel {
					gm, appErr := dt.th.App.createGroupChannel(dt.th.Context, []string{dt.bot.Id, dt.th.BasicUser.Id, dt.th.BasicUser2.Id}, dt.bot.Id)
					require.Nil(t, appErr)
					return gm
				},
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				mainHelper.Parallel(t)
				dt := setupDeferredNotificationsTest(t)
				th := dt.th
				channel := tc.channel(t, dt)
				_, appErr := th.App.MarkChannelsAsViewed(th.Context, []string{channel.Id}, th.BasicUser2.Id, "", false, false)
				require.Nil(t, appErr)
				totalBefore := dt.totalMsgCount(t, channel.Id)

				post := dt.createDeferredPost(t, channel, "", "thinking...")
				dt.finalizePost(t, post, "answer for @"+th.BasicUser2.Username)

				require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, &model.DeliverPostNotificationsOptions{UserIDs: []string{th.BasicUser2.Id}}))
				dt.requirePushes(t, post.Id, th.BasicUser2.Id, 1)
				unread := dt.channelUnread(t, channel.Id, th.BasicUser2.Id)
				assert.Zero(t, unread.MsgCount)
				assert.Equal(t, int64(1), unread.MentionCount)
				assert.Equal(t, totalBefore, dt.totalMsgCount(t, channel.Id))

				require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, nil))
				dt.requirePushes(t, post.Id, th.BasicUser2.Id, 2)
				unread = dt.channelUnread(t, channel.Id, th.BasicUser2.Id)
				assert.Equal(t, int64(1), unread.MsgCount)
				assert.Equal(t, int64(2), unread.MentionCount)
				assert.Equal(t, totalBefore+1, dt.totalMsgCount(t, channel.Id))
			})
		}
	})

	t.Run("skips users who cannot be notified", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		nonMember := th.CreateUser(t)
		th.LinkUserToTeam(t, nonMember, th.BasicTeam)
		deactivated := th.CreateUser(t)
		th.LinkUserToTeam(t, deactivated, th.BasicTeam)
		th.AddUserToChannel(t, deactivated, th.BasicChannel)
		_, appErr := th.App.UpdateActive(th.Context, deactivated, false)
		require.Nil(t, appErr)
		for _, user := range []*model.User{nonMember, deactivated} {
			_, appErr = th.App.CreateSession(th.Context, &model.Session{
				UserId:    user.Id,
				DeviceId:  model.PushNotifyAndroidReactNative + ":" + user.Id,
				ExpiresAt: model.GetMillis() + 100000,
			})
			require.Nil(t, appErr)
		}

		post := dt.createDeferredPost(t, th.BasicChannel, "", "hello")

		for _, tc := range []struct {
			name   string
			userID string
		}{
			{name: "not a channel member", userID: nonMember.Id},
			{name: "deactivated", userID: deactivated.Id},
			{name: "the author", userID: dt.bot.Id},
			{name: "unknown user", userID: model.NewId()},
		} {
			t.Run(tc.name, func(t *testing.T) {
				require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, &model.DeliverPostNotificationsOptions{UserIDs: []string{tc.userID}}))
				dt.requireNoMorePushes(t, post.Id, tc.userID, 0)
			})
		}

		_, err := th.App.Srv().Store().Channel().GetMember(th.Context, th.BasicChannel.Id, nonMember.Id)
		require.Error(t, err, "a scoped delivery must not add the user to the channel")
		assert.True(t, dt.getPost(t, post.Id).HasDeferredNotification())

		// A skipped user does not stop the others from being notified.
		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, &model.DeliverPostNotificationsOptions{UserIDs: []string{nonMember.Id, th.BasicUser2.Id}}))
		dt.requirePushes(t, post.Id, th.BasicUser2.Id, 1)
		dt.requireNoMorePushes(t, post.Id, nonMember.Id, 0)
	})

	t.Run("archived channel", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th

		post := dt.createDeferredPost(t, th.BasicChannel, "", "hello")
		require.Nil(t, th.App.DeleteChannel(th.Context, th.BasicChannel, th.SystemAdminUser.Id))

		require.Nil(t, th.App.DeliverPostNotifications(th.Context, post.Id, &model.DeliverPostNotificationsOptions{UserIDs: []string{th.BasicUser2.Id}}))
		dt.requireNoMorePushes(t, post.Id, th.BasicUser2.Id, 0)
	})

	t.Run("thread reply with collapsed threads", func(t *testing.T) {
		mainHelper.Parallel(t)
		dt := setupDeferredNotificationsTest(t)
		th := dt.th
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ThreadAutoFollow = true
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsAlwaysOn
		})

		root := th.BasicPost
		reply := dt.createDeferredPost(t, th.BasicChannel, root.Id, "thinking...")
		dt.finalizePost(t, reply, "threaded answer for you")

		events, closeWS := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", []model.WebsocketEventType{model.WebsocketEventPosted, model.WebsocketEventThreadUpdated})
		defer closeWS()

		require.Nil(t, th.App.DeliverPostNotifications(th.Context, reply.Id, &model.DeliverPostNotificationsOptions{UserIDs: []string{th.BasicUser2.Id}}))

		event, eventPost := waitForPostEvent(t, events, model.WebsocketEventPosted, reply.Id)
		assert.Equal(t, th.BasicUser2.Id, event.GetBroadcast().UserId)
		assert.False(t, eventPost.HasDeferredNotification())
		assertUnmarshalsTo(t, []string{th.BasicUser2.Id}, event.GetData()["mentions"])
		assertUnmarshalsTo(t, []string{th.BasicUser2.Id}, event.GetData()["followers"])
		thread := waitForThreadUpdatedEvent(t, events, root.Id)
		assert.Equal(t, int64(1), thread.UnreadMentions)

		pushes := dt.requirePushes(t, reply.Id, th.BasicUser2.Id, 1)
		assert.Contains(t, pushes[0].Message, "threaded answer for you")
		dt.requireNoMorePushes(t, reply.Id, th.BasicUser.Id, 0)

		membership, appErr := th.App.GetThreadMembershipForUser(th.BasicUser2.Id, root.Id)
		require.Nil(t, appErr)
		assert.True(t, membership.Following)
		assert.Equal(t, int64(1), membership.UnreadMentions)
		assert.True(t, dt.getPost(t, reply.Id).HasDeferredNotification())
	})
}
