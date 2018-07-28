// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestGetDirectMessageNotificationEmailSubject(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	expectedPrefix := "[http://localhost:8065] New Direct Message from @sender on"
	user := &model.User{}
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := utils.GetUserTranslations("en")
	subject := getDirectMessageNotificationEmailSubject(user, post, translateFunc, "http://localhost:8065", "sender", true)
	if !strings.HasPrefix(subject, expectedPrefix) {
		t.Fatal("Expected subject line prefix '" + expectedPrefix + "', got " + subject)
	}
}

func TestGetGroupMessageNotificationEmailSubjectFull(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	expectedPrefix := "[http://localhost:8065] New Group Message in sender on"
	user := &model.User{}
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := utils.GetUserTranslations("en")
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	subject := getGroupMessageNotificationEmailSubject(user, post, translateFunc, "http://localhost:8065", "sender", emailNotificationContentsType, true)
	if !strings.HasPrefix(subject, expectedPrefix) {
		t.Fatal("Expected subject line prefix '" + expectedPrefix + "', got " + subject)
	}
}

func TestGetGroupMessageNotificationEmailSubjectGeneric(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	expectedPrefix := "[http://localhost:8065] New Group Message on"
	user := &model.User{}
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := utils.GetUserTranslations("en")
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_GENERIC
	subject := getGroupMessageNotificationEmailSubject(user, post, translateFunc, "http://localhost:8065", "sender", emailNotificationContentsType, true)
	if !strings.HasPrefix(subject, expectedPrefix) {
		t.Fatal("Expected subject line prefix '" + expectedPrefix + "', got " + subject)
	}
}

func TestGetNotificationEmailSubject(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	expectedPrefix := "[http://localhost:8065] Notification in team on"
	user := &model.User{}
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := utils.GetUserTranslations("en")
	subject := getNotificationEmailSubject(user, post, translateFunc, "http://localhost:8065", "team", true)
	if !strings.HasPrefix(subject, expectedPrefix) {
		t.Fatal("Expected subject line prefix '" + expectedPrefix + "', got " + subject)
	}
}

func TestGetNotificationEmailBodyFullNotificationPublicChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_OPEN,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc)
	if !strings.Contains(body, "You have a new notification.") {
		t.Fatal("Expected email text 'You have a new notification. Got " + body)
	}
	if !strings.Contains(body, "Channel: "+channel.DisplayName) {
		t.Fatal("Expected email text 'Channel: " + channel.DisplayName + "'. Got " + body)
	}
	if !strings.Contains(body, "@"+senderName+" - ") {
		t.Fatal("Expected email text '@" + senderName + " - '. Got " + body)
	}
	if !strings.Contains(body, post.Message) {
		t.Fatal("Expected email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyFullNotificationGroupChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_GROUP,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc)
	if !strings.Contains(body, "You have a new Group Message.") {
		t.Fatal("Expected email text 'You have a new Group Message. Got " + body)
	}
	if !strings.Contains(body, "Channel: ChannelName") {
		t.Fatal("Expected email text 'Channel: ChannelName'. Got " + body)
	}
	if !strings.Contains(body, "@"+senderName+" - ") {
		t.Fatal("Expected email text '@" + senderName + " - '. Got " + body)
	}
	if !strings.Contains(body, post.Message) {
		t.Fatal("Expected email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyFullNotificationPrivateChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_PRIVATE,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc)
	if !strings.Contains(body, "You have a new notification.") {
		t.Fatal("Expected email text 'You have a new notification. Got " + body)
	}
	if !strings.Contains(body, "Channel: "+channel.DisplayName) {
		t.Fatal("Expected email text 'Channel: " + channel.DisplayName + "'. Got " + body)
	}
	if !strings.Contains(body, "@"+senderName+" - ") {
		t.Fatal("Expected email text '@" + senderName + " - '. Got " + body)
	}
	if !strings.Contains(body, post.Message) {
		t.Fatal("Expected email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyFullNotificationDirectChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_DIRECT,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc)
	if !strings.Contains(body, "You have a new Direct Message.") {
		t.Fatal("Expected email text 'You have a new Direct Message. Got " + body)
	}
	if !strings.Contains(body, "@"+senderName+" - ") {
		t.Fatal("Expected email text '@" + senderName + " - '. Got " + body)
	}
	if !strings.Contains(body, post.Message) {
		t.Fatal("Expected email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyFullNotificationLocaleTimeWithTimezone(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{
		Timezone: model.DefaultUserTimezone(),
	}
	recipient.Timezone["automaticTimezone"] = "America/New_York"
	post := &model.Post{
		CreateAt: 1524663790000,
		Message:  "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_DIRECT,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, false, translateFunc)
	r, _ := regexp.Compile("E([S|D]+)T")
	zone := r.FindString(body)
	if !strings.Contains(body, "sender - 9:43 AM "+zone+", April 25") {
		t.Fatal("Expected email text 'sender - 9:43 AM " + zone + ", April 25'. Got " + body)
	}
}

func TestGetNotificationEmailBodyFullNotificationLocaleTimeNoTimezone(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{
		Timezone: model.DefaultUserTimezone(),
	}
	post := &model.Post{
		CreateAt: 1524681000000,
		Message:  "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_DIRECT,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	tm := time.Unix(post.CreateAt/1000, 0)
	zone, _ := tm.Zone()

	formattedTime := formattedPostTime{
		Time:     tm,
		Year:     fmt.Sprintf("%d", tm.Year()),
		Month:    translateFunc(tm.Month().String()),
		Day:      fmt.Sprintf("%d", tm.Day()),
		Hour:     fmt.Sprintf("%02d", tm.Hour()),
		Minute:   fmt.Sprintf("%02d", tm.Minute()),
		TimeZone: zone,
	}

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc)
	postTimeLine := fmt.Sprintf("sender - %s:%s %s, %s %s", formattedTime.Hour, formattedTime.Minute, formattedTime.TimeZone, formattedTime.Month, formattedTime.Day)
	if !strings.Contains(body, postTimeLine) {
		t.Fatal("Expected email text '" + postTimeLine + " '. Got " + body)
	}
}

func TestGetNotificationEmailBodyFullNotificationLocaleTime12Hour(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{
		Timezone: model.DefaultUserTimezone(),
	}
	recipient.Timezone["automaticTimezone"] = "America/New_York"
	post := &model.Post{
		CreateAt: 1524681000000, // 1524681000 // 1524681000000
		Message:  "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_DIRECT,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, false, translateFunc)
	if !strings.Contains(body, "sender - 2:30 PM") {
		t.Fatal("Expected email text 'sender - 2:30 PM'. Got " + body)
	}
	if !strings.Contains(body, "April 25") {
		t.Fatal("Expected email text 'April 25'. Got " + body)
	}
}

func TestGetNotificationEmailBodyFullNotificationLocaleTime24Hour(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{
		Timezone: model.DefaultUserTimezone(),
	}
	recipient.Timezone["automaticTimezone"] = "America/New_York"
	post := &model.Post{
		CreateAt: 1524681000000,
		Message:  "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_DIRECT,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc)
	if !strings.Contains(body, "sender - 14:30") {
		t.Fatal("Expected email text 'sender - 14:30'. Got " + body)
	}
	if !strings.Contains(body, "April 25") {
		t.Fatal("Expected email text 'April 25'. Got " + body)
	}
}

// from here
func TestGetNotificationEmailBodyGenericNotificationPublicChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_OPEN,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_GENERIC
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc)
	if !strings.Contains(body, "You have a new notification from @"+senderName) {
		t.Fatal("Expected email text 'You have a new notification from @" + senderName + "'. Got " + body)
	}
	if strings.Contains(body, "Channel: "+channel.DisplayName) {
		t.Fatal("Did not expect email text 'Channel: " + channel.DisplayName + "'. Got " + body)
	}
	if strings.Contains(body, post.Message) {
		t.Fatal("Did not expect email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyGenericNotificationGroupChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_GROUP,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_GENERIC
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc)
	if !strings.Contains(body, "You have a new Group Message from @"+senderName) {
		t.Fatal("Expected email text 'You have a new Group Message from @" + senderName + "'. Got " + body)
	}
	if strings.Contains(body, "CHANNEL: "+channel.DisplayName) {
		t.Fatal("Did not expect email text 'CHANNEL: " + channel.DisplayName + "'. Got " + body)
	}
	if strings.Contains(body, post.Message) {
		t.Fatal("Did not expect email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyGenericNotificationPrivateChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_PRIVATE,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_GENERIC
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc)
	if !strings.Contains(body, "You have a new notification from @"+senderName) {
		t.Fatal("Expected email text 'You have a new notification from @" + senderName + "'. Got " + body)
	}
	if strings.Contains(body, "CHANNEL: "+channel.DisplayName) {
		t.Fatal("Did not expect email text 'CHANNEL: " + channel.DisplayName + "'. Got " + body)
	}
	if strings.Contains(body, post.Message) {
		t.Fatal("Did not expect email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyGenericNotificationDirectChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_DIRECT,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_GENERIC
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc)
	if !strings.Contains(body, "You have a new Direct Message from @"+senderName) {
		t.Fatal("Expected email text 'You have a new Direct Message from @" + senderName + "'. Got " + body)
	}
	if strings.Contains(body, "CHANNEL: "+channel.DisplayName) {
		t.Fatal("Did not expect email text 'CHANNEL: " + channel.DisplayName + "'. Got " + body)
	}
	if strings.Contains(body, post.Message) {
		t.Fatal("Did not expect email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}
