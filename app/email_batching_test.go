// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestHandleNewNotifications(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	id1 := model.NewId()
	id2 := model.NewId()
	id3 := model.NewId()

	// test queueing of received posts by user
	job := NewEmailBatchingJob(th.App, 128)

	job.handleNewNotifications()

	if len(job.pendingNotifications) != 0 {
		t.Fatal("shouldn't have added any pending notifications")
	}

	job.Add(&model.User{Id: id1}, &model.Post{UserId: id1, Message: "test"}, &model.Team{Name: "team"})
	if len(job.pendingNotifications) != 0 {
		t.Fatal("shouldn't have added any pending notifications")
	}

	job.handleNewNotifications()
	if len(job.pendingNotifications) != 1 {
		t.Fatal("should have received posts for 1 user")
	} else if len(job.pendingNotifications[id1]) != 1 {
		t.Fatal("should have received 1 post for user")
	}

	job.Add(&model.User{Id: id1}, &model.Post{UserId: id1, Message: "test"}, &model.Team{Name: "team"})
	job.handleNewNotifications()
	if len(job.pendingNotifications) != 1 {
		t.Fatal("should have received posts for 1 user")
	} else if len(job.pendingNotifications[id1]) != 2 {
		t.Fatal("should have received 2 posts for user1", job.pendingNotifications[id1])
	}

	job.Add(&model.User{Id: id2}, &model.Post{UserId: id1, Message: "test"}, &model.Team{Name: "team"})
	job.handleNewNotifications()
	if len(job.pendingNotifications) != 2 {
		t.Fatal("should have received posts for 2 users")
	} else if len(job.pendingNotifications[id1]) != 2 {
		t.Fatal("should have received 2 posts for user1")
	} else if len(job.pendingNotifications[id2]) != 1 {
		t.Fatal("should have received 1 post for user2")
	}

	job.Add(&model.User{Id: id2}, &model.Post{UserId: id2, Message: "test"}, &model.Team{Name: "team"})
	job.Add(&model.User{Id: id1}, &model.Post{UserId: id3, Message: "test"}, &model.Team{Name: "team"})
	job.Add(&model.User{Id: id3}, &model.Post{UserId: id3, Message: "test"}, &model.Team{Name: "team"})
	job.Add(&model.User{Id: id2}, &model.Post{UserId: id2, Message: "test"}, &model.Team{Name: "team"})
	job.handleNewNotifications()
	if len(job.pendingNotifications) != 3 {
		t.Fatal("should have received posts for 3 users")
	} else if len(job.pendingNotifications[id1]) != 3 {
		t.Fatal("should have received 3 posts for user1")
	} else if len(job.pendingNotifications[id2]) != 3 {
		t.Fatal("should have received 3 posts for user2")
	} else if len(job.pendingNotifications[id3]) != 1 {
		t.Fatal("should have received 1 post for user3")
	}

	// test ordering of received posts
	job = NewEmailBatchingJob(th.App, 128)

	job.Add(&model.User{Id: id1}, &model.Post{UserId: id1, Message: "test1"}, &model.Team{Name: "team"})
	job.Add(&model.User{Id: id1}, &model.Post{UserId: id1, Message: "test2"}, &model.Team{Name: "team"})
	job.Add(&model.User{Id: id2}, &model.Post{UserId: id1, Message: "test3"}, &model.Team{Name: "team"})
	job.Add(&model.User{Id: id1}, &model.Post{UserId: id1, Message: "test4"}, &model.Team{Name: "team"})
	job.Add(&model.User{Id: id2}, &model.Post{UserId: id1, Message: "test5"}, &model.Team{Name: "team"})
	job.handleNewNotifications()
	if job.pendingNotifications[id1][0].post.Message != "test1" ||
		job.pendingNotifications[id1][1].post.Message != "test2" ||
		job.pendingNotifications[id1][2].post.Message != "test4" {
		t.Fatal("incorrect order of received posts for user1")
	} else if job.pendingNotifications[id2][0].post.Message != "test3" ||
		job.pendingNotifications[id2][1].post.Message != "test5" {
		t.Fatal("incorrect order of received posts for user2")
	}
}

func TestCheckPendingNotifications(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	job := NewEmailBatchingJob(th.App, 128)
	job.pendingNotifications[th.BasicUser.Id] = []*batchedNotification{
		{
			post: &model.Post{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				CreateAt:  10000000,
			},
			teamName: th.BasicTeam.Name,
		},
	}

	channelMember := store.Must(th.App.Srv.Store.Channel().GetMember(th.BasicChannel.Id, th.BasicUser.Id)).(*model.ChannelMember)
	channelMember.LastViewedAt = 9999999
	store.Must(th.App.Srv.Store.Channel().UpdateMember(channelMember))

	store.Must(th.App.Srv.Store.Preference().Save(&model.Preferences{{
		UserId:   th.BasicUser.Id,
		Category: model.PREFERENCE_CATEGORY_NOTIFICATIONS,
		Name:     model.PREFERENCE_NAME_EMAIL_INTERVAL,
		Value:    "60",
	}}))

	// test that notifications aren't sent before interval
	job.checkPendingNotifications(time.Unix(10001, 0), func(string, []*batchedNotification) {})

	if job.pendingNotifications[th.BasicUser.Id] == nil || len(job.pendingNotifications[th.BasicUser.Id]) != 1 {
		t.Fatal("shouldn't have sent queued post")
	}

	// test that notifications are cleared if the user has acted
	channelMember = store.Must(th.App.Srv.Store.Channel().GetMember(th.BasicChannel.Id, th.BasicUser.Id)).(*model.ChannelMember)
	channelMember.LastViewedAt = 10001000
	store.Must(th.App.Srv.Store.Channel().UpdateMember(channelMember))

	job.checkPendingNotifications(time.Unix(10002, 0), func(string, []*batchedNotification) {})

	if job.pendingNotifications[th.BasicUser.Id] != nil && len(job.pendingNotifications[th.BasicUser.Id]) != 0 {
		t.Fatal("should've remove queued post since user acted")
	}

	// test that notifications are sent if enough time passes since the first message
	job.pendingNotifications[th.BasicUser.Id] = []*batchedNotification{
		{
			post: &model.Post{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				CreateAt:  10060000,
				Message:   "post1",
			},
			teamName: th.BasicTeam.Name,
		},
		{
			post: &model.Post{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				CreateAt:  10090000,
				Message:   "post2",
			},
			teamName: th.BasicTeam.Name,
		},
	}

	received := make(chan *model.Post, 2)
	timeout := make(chan bool)

	job.checkPendingNotifications(time.Unix(10130, 0), func(s string, notifications []*batchedNotification) {
		for _, notification := range notifications {
			received <- notification.post
		}
	})

	go func() {
		// start a timeout to make sure that we don't get stuck here on a failed test
		time.Sleep(5 * time.Second)
		timeout <- true
	}()

	if job.pendingNotifications[th.BasicUser.Id] != nil && len(job.pendingNotifications[th.BasicUser.Id]) != 0 {
		t.Fatal("should've remove queued posts when sending messages")
	}

	select {
	case post := <-received:
		if post.Message != "post1" {
			t.Fatal("should've received post1 first")
		}
	case <-timeout:
		t.Fatal("timed out waiting for first post notification")
	}

	select {
	case post := <-received:
		if post.Message != "post2" {
			t.Fatal("should've received post2 second")
		}
	case <-timeout:
		t.Fatal("timed out waiting for second post notification")
	}
}

/**
 * Ensures that email batch interval defaults to 15 minutes for users that haven't explicitly set this preference
 */
func TestCheckPendingNotificationsDefaultInterval(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	job := NewEmailBatchingJob(th.App, 128)

	// bypasses recent user activity check
	channelMember := store.Must(th.App.Srv.Store.Channel().GetMember(th.BasicChannel.Id, th.BasicUser.Id)).(*model.ChannelMember)
	channelMember.LastViewedAt = 9999000
	store.Must(th.App.Srv.Store.Channel().UpdateMember(channelMember))

	job.pendingNotifications[th.BasicUser.Id] = []*batchedNotification{
		{
			post: &model.Post{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				CreateAt:  10000000,
			},
			teamName: th.BasicTeam.Name,
		},
	}

	// notifications should not be sent 1s after post was created, because default batch interval is 15mins
	job.checkPendingNotifications(time.Unix(10001, 0), func(string, []*batchedNotification) {})
	if job.pendingNotifications[th.BasicUser.Id] == nil || len(job.pendingNotifications[th.BasicUser.Id]) != 1 {
		t.Fatal("shouldn't have sent queued post")
	}

	// notifications should be sent 901s after post was created, because default batch interval is 15mins
	job.checkPendingNotifications(time.Unix(10901, 0), func(string, []*batchedNotification) {})
	if job.pendingNotifications[th.BasicUser.Id] != nil || len(job.pendingNotifications[th.BasicUser.Id]) != 0 {
		t.Fatal("should have sent queued post")
	}
}

/**
 * Ensures that email batch interval defaults to 15 minutes if user preference is invalid
 */
func TestCheckPendingNotificationsCantParseInterval(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	job := NewEmailBatchingJob(th.App, 128)

	// bypasses recent user activity check
	channelMember := store.Must(th.App.Srv.Store.Channel().GetMember(th.BasicChannel.Id, th.BasicUser.Id)).(*model.ChannelMember)
	channelMember.LastViewedAt = 9999000
	store.Must(th.App.Srv.Store.Channel().UpdateMember(channelMember))

	// preference value is not an integer, so we'll fall back to the default 15min value
	store.Must(th.App.Srv.Store.Preference().Save(&model.Preferences{{
		UserId:   th.BasicUser.Id,
		Category: model.PREFERENCE_CATEGORY_NOTIFICATIONS,
		Name:     model.PREFERENCE_NAME_EMAIL_INTERVAL,
		Value:    "notAnIntegerValue",
	}}))

	job.pendingNotifications[th.BasicUser.Id] = []*batchedNotification{
		{
			post: &model.Post{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				CreateAt:  10000000,
			},
			teamName: th.BasicTeam.Name,
		},
	}

	// notifications should not be sent 1s after post was created, because default batch interval is 15mins
	job.checkPendingNotifications(time.Unix(10001, 0), func(string, []*batchedNotification) {})
	if job.pendingNotifications[th.BasicUser.Id] == nil || len(job.pendingNotifications[th.BasicUser.Id]) != 1 {
		t.Fatal("shouldn't have sent queued post")
	}

	// notifications should be sent 901s after post was created, because default batch interval is 15mins
	job.checkPendingNotifications(time.Unix(10901, 0), func(string, []*batchedNotification) {})
	if job.pendingNotifications[th.BasicUser.Id] != nil || len(job.pendingNotifications[th.BasicUser.Id]) != 0 {
		t.Fatal("should have sent queued post")
	}
}

/*
 * Ensures that post contents are not included in notification email when email notification content type is set to generic
 */
func TestRenderBatchedPostGeneric(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	var post = &model.Post{}
	post.Message = "This is the message"
	var notification = &batchedNotification{}
	notification.post = post
	var channel = &model.Channel{}
	channel.DisplayName = "Some Test Channel"
	var sender = &model.User{}
	sender.Email = "sender@test.com"

	translateFunc := func(translationID string, args ...interface{}) string {
		// mock translateFunc just returns the translation id - this is good enough for our purposes
		return translationID
	}

	var rendered = th.App.renderBatchedPost(notification, channel, sender, "http://localhost:8065", "", translateFunc, "en", model.EMAIL_NOTIFICATION_CONTENTS_GENERIC)
	if strings.Contains(rendered, post.Message) {
		t.Fatal("Rendered email should not contain post contents when email notification contents type is set to Generic.")
	}
}

/*
 * Ensures that post contents included in notification email when email notification content type is set to full
 */
func TestRenderBatchedPostFull(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	var post = &model.Post{}
	post.Message = "This is the message"
	var notification = &batchedNotification{}
	notification.post = post
	var channel = &model.Channel{}
	channel.DisplayName = "Some Test Channel"
	var sender = &model.User{}
	sender.Email = "sender@test.com"

	translateFunc := func(translationID string, args ...interface{}) string {
		// mock translateFunc just returns the translation id - this is good enough for our purposes
		return translationID
	}

	var rendered = th.App.renderBatchedPost(notification, channel, sender, "http://localhost:8065", "", translateFunc, "en", model.EMAIL_NOTIFICATION_CONTENTS_FULL)
	if !strings.Contains(rendered, post.Message) {
		t.Fatal("Rendered email should contain post contents when email notification contents type is set to Full.")
	}
}
