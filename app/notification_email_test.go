// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"html/template"
	"regexp"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/timezones"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
)

func TestGetDirectMessageNotificationEmailSubject(t *testing.T) {
	expectedPrefix := "[http://localhost:8065] New Direct Message from @sender on"
	user := &model.User{}
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := i18n.GetUserTranslations("en")
	subject := getDirectMessageNotificationEmailSubject(user, post, translateFunc, "http://localhost:8065", "@sender", true)
	require.Regexp(t, regexp.MustCompile("^"+regexp.QuoteMeta(expectedPrefix)), subject, fmt.Sprintf("Expected subject line prefix '%s', got %s", expectedPrefix, subject))
}

func TestGetGroupMessageNotificationEmailSubjectFull(t *testing.T) {
	expectedPrefix := "[http://localhost:8065] New Group Message in sender on"
	user := &model.User{}
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := i18n.GetUserTranslations("en")
	emailNotificationContentsType := model.EmailNotificationContentsFull
	subject := getGroupMessageNotificationEmailSubject(user, post, translateFunc, "http://localhost:8065", "sender", emailNotificationContentsType, true)
	require.Regexp(t, regexp.MustCompile("^"+regexp.QuoteMeta(expectedPrefix)), subject, fmt.Sprintf("Expected subject line prefix '%s', got %s", expectedPrefix, subject))
}

func TestGetGroupMessageNotificationEmailSubjectGeneric(t *testing.T) {
	expectedPrefix := "[http://localhost:8065] New Group Message on"
	user := &model.User{}
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := i18n.GetUserTranslations("en")
	emailNotificationContentsType := model.EmailNotificationContentsGeneric
	subject := getGroupMessageNotificationEmailSubject(user, post, translateFunc, "http://localhost:8065", "sender", emailNotificationContentsType, true)
	require.Regexp(t, regexp.MustCompile("^"+regexp.QuoteMeta(expectedPrefix)), subject, fmt.Sprintf("Expected subject line prefix '%s', got %s", expectedPrefix, subject))
}

func TestGetNotificationEmailSubject(t *testing.T) {
	expectedPrefix := "[http://localhost:8065] Notification in team on"
	user := &model.User{}
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := i18n.GetUserTranslations("en")
	subject := getNotificationEmailSubject(user, post, translateFunc, "http://localhost:8065", "team", true)
	require.Regexp(t, regexp.MustCompile("^"+regexp.QuoteMeta(expectedPrefix)), subject, fmt.Sprintf("Expected subject line prefix '%s', got %s", expectedPrefix, subject))
}

func TestGetNotificationEmailBodyFullNotificationPublicChannel(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "mentioned you in a message", fmt.Sprintf("Expected email text 'mentioned you in a message. Got %s", body))
	require.Contains(t, body, post.Message, fmt.Sprintf("Expected email text '%s'. Got %s", post.Message, body))
	require.Contains(t, body, teamURL, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestGetNotificationEmailBodyFullNotificationGroupChannel(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeGroup,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "sent you a new message", fmt.Sprintf("Expected email text 'sent you a new message. Got "+body))
	require.Contains(t, body, post.Message, fmt.Sprintf("Expected email text '%s'. Got %s", post.Message, body))
	require.Contains(t, body, teamURL, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestGetNotificationEmailBodyFullNotificationPrivateChannel(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypePrivate,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "mentioned you in a message", fmt.Sprintf("Expected email text 'mentioned you in a message. Got "+body))
	require.Contains(t, body, post.Message, fmt.Sprintf("Expected email text '%s'. Got %s", post.Message, body))
	require.Contains(t, body, teamURL, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestGetNotificationEmailBodyFullNotificationDirectChannel(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "sent you a new message", fmt.Sprintf("Expected email text 'sent you a new message. Got "+body))
	require.Contains(t, body, post.Message, fmt.Sprintf("Expected email text '%s'. Got %s", post.Message, body))
	require.Contains(t, body, teamURL, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestGetNotificationEmailBodyFullNotificationLocaleTimeWithTimezone(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{
		Timezone: timezones.DefaultUserTimezone(),
	}
	recipient.Timezone["automaticTimezone"] = "America/New_York"
	post := &model.Post{
		CreateAt: 1524663790000,
		Message:  "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, false, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	r, _ := regexp.Compile("E([S|D]+)T")
	zone := r.FindString(body)
	require.Contains(t, body, "9:43 AM "+zone, fmt.Sprintf("Expected email text '9:43 AM %s'. Got %s", zone, body))
}

func TestGetNotificationEmailBodyFullNotificationLocaleTimeNoTimezone(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{
		Timezone: timezones.DefaultUserTimezone(),
	}
	post := &model.Post{
		CreateAt: 1524681000000,
		Message:  "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	tm := time.Unix(post.CreateAt/1000, 0)
	zone, _ := tm.Zone()

	formattedTime := formattedPostTime{
		Hour:     fmt.Sprintf("%02d", tm.Hour()),
		Minute:   fmt.Sprintf("%02d", tm.Minute()),
		TimeZone: zone,
	}

	tmp, err := template.New("foo").Parse(`{{.}}`)
	require.NoError(t, err)
	var text bytes.Buffer
	err = tmp.Execute(&text, fmt.Sprintf("%s:%s %s", formattedTime.Hour, formattedTime.Minute, formattedTime.TimeZone))
	require.NoError(t, err)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	postTimeLine := text.String()
	require.Contains(t, body, postTimeLine, fmt.Sprintf("Expected email text '%s'. Got %s", postTimeLine, body))
}

func TestGetNotificationEmailBodyFullNotificationLocaleTime12Hour(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{
		Timezone: timezones.DefaultUserTimezone(),
	}
	recipient.Timezone["automaticTimezone"] = "America/New_York"
	post := &model.Post{
		CreateAt: 1524681000000, // 1524681000 // 1524681000000
		Message:  "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, false, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "2:30 PM", fmt.Sprintf("Expected email text '2:30 PM'. Got %s", body))
}

func TestGetNotificationEmailBodyFullNotificationLocaleTime24Hour(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{
		Timezone: timezones.DefaultUserTimezone(),
	}
	recipient.Timezone["automaticTimezone"] = "America/New_York"
	post := &model.Post{
		CreateAt: 1524681000000,
		Message:  "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "14:30", fmt.Sprintf("Expected email text '14:30'. Got %s", body))
}

func TestGetNotificationEmailBodyFullNotificationWithSlackAttachments(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}

	messageAttachments := []*model.SlackAttachment{
		{
			Color:      "#FF0000",
			Pretext:    "message attachment 1 pretext",
			AuthorName: "author name",
			AuthorLink: "https://example.com/slack_attachment_1/author_link",
			AuthorIcon: "https://example.com/slack_attachment_1/author_icon",
			Title:      "message attachment 1 title",
			TitleLink:  "https://example.com/slack_attachment_1/title_link",
			Text:       "message attachment 1 text",
			ImageURL:   "https://example.com/slack_attachment_1/image",
			ThumbURL:   "https://example.com/slack_attachment_1/thumb",
			Fields: []*model.SlackAttachmentField{
				{
					Short: true,
					Title: "message attachment 1 field 1 title",
					Value: "message attachment 1 field 1 value",
				},
				{
					Short: false,
					Title: "message attachment 1 field 2 title",
					Value: "message attachment 1 field 2 value",
				},
				{
					Short: true,
					Title: "message attachment 1 field 3 title",
					Value: "message attachment 1 field 3 value",
				},
				{
					Short: true,
					Title: "message attachment 1 field 4 title",
					Value: "message attachment 1 field 4 value",
				},
			},
		},
		{
			Color:      "#FF0000",
			Pretext:    "message attachment 2 pretext",
			AuthorName: "author name 2",
			Text:       "message attachment 2 text",
		},
	}

	model.ParseSlackAttachment(post, messageAttachments)

	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}

	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "#FF0000")
	require.Contains(t, body, "message attachment 1 pretext")
	require.Contains(t, body, "author name")
	require.Contains(t, body, "https://example.com/slack_attachment_1/author_link")
	require.Contains(t, body, "https://example.com/slack_attachment_1/author_icon")
	require.Contains(t, body, "message attachment 1 title")
	require.Contains(t, body, "https://example.com/slack_attachment_1/title_link")
	require.Contains(t, body, "message attachment 1 text")
	require.Contains(t, body, "https://example.com/slack_attachment_1/image")
	require.Contains(t, body, "https://example.com/slack_attachment_1/thumb")
	require.Contains(t, body, "message attachment 1 field 1 title")
	require.Contains(t, body, "message attachment 1 field 1 value")
	require.Contains(t, body, "message attachment 1 field 2 title")
	require.Contains(t, body, "message attachment 1 field 2 value")
	require.Contains(t, body, "message attachment 1 field 3 title")
	require.Contains(t, body, "message attachment 1 field 3 value")
	require.Contains(t, body, "message attachment 1 field 4 title")
	require.Contains(t, body, "message attachment 1 field 4 value")
	require.Contains(t, body, "https://example.com/slack_attachment_1/thumb")
	require.Contains(t, body, "message attachment 2 pretext")
	require.Contains(t, body, "author name 2")
	require.Contains(t, body, "message attachment 2 text")
}

// from here
func TestGetNotificationEmailBodyGenericNotificationPublicChannel(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsGeneric
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "mentioned you in a message", fmt.Sprintf("Expected email text 'mentioned you in a message. Got %s", body))
	require.Contains(t, body, teamURL, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestGetNotificationEmailBodyGenericNotificationGroupChannel(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeGroup,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsGeneric
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "sent you a new message", fmt.Sprintf("Expected email text 'sent you a new message. Got "+body))
	require.Contains(t, body, teamURL, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestGetNotificationEmailBodyGenericNotificationPrivateChannel(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypePrivate,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsGeneric
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "mentioned you in a message", fmt.Sprintf("Expected email text 'mentioned you in a message. Got %s", body))
	require.Contains(t, body, teamURL, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestGetNotificationEmailBodyGenericNotificationDirectChannel(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsGeneric
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "sent you a new message", fmt.Sprintf("Expected email text 'sent you a new message. Got "+body))
	require.Contains(t, body, teamURL, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestGetNotificationEmailEscapingChars(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	ch := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	channelName := "ChannelName"
	recipient := &model.User{}
	message := "<b>Bold Test</b>"
	post := &model.Post{
		Message: message,
	}

	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, ch,
		channelName, senderName, teamName, teamURL,
		emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)

	assert.NotContains(t, body, message)
}

func TestGetNotificationEmailBodyPublicChannelMention(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	ch := &model.Channel{
		Name:        "channelname",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	id := model.NewId()
	recipient := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}
	post := &model.Post{
		Message: "This is the message ~" + ch.Name,
	}

	senderName := "user1"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Id: "test", Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	channelStoreMock := mocks.ChannelStore{}
	channelStoreMock.On("GetByNames", "test", []string{ch.Name}, true).Return([]*model.Channel{ch}, nil)
	storeMock.On("Channel").Return(&channelStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, ch,
		ch.Name, senderName, teamName, teamURL,
		emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	channelURL := teamURL + "/channels/" + ch.Name
	mention := "~" + ch.Name
	assert.Contains(t, body, "<a href='"+channelURL+"'>"+mention+"</a>")
}

func TestGetNotificationEmailBodyMultiPublicChannelMention(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	ch := &model.Channel{
		Id:          model.NewId(),
		Name:        "channelnameone",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	mention := "~" + ch.Name

	ch2 := &model.Channel{
		Id:          model.NewId(),
		Name:        "channelnametwo",
		DisplayName: "ChannelName2",
		Type:        model.ChannelTypeOpen,
	}
	mention2 := "~" + ch2.Name

	ch3 := &model.Channel{
		Id:          model.NewId(),
		Name:        "channelnamethree",
		DisplayName: "ChannelName3",
		Type:        model.ChannelTypeOpen,
	}
	mention3 := "~" + ch3.Name

	message := fmt.Sprintf("This is the message Channel1: %s; Channel2: %s;"+
		" Channel3: %s", mention, mention2, mention3)
	id := model.NewId()
	recipient := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}
	post := &model.Post{
		Message: message,
	}

	senderName := "user1"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Id: "test", Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	channelStoreMock := mocks.ChannelStore{}
	channelStoreMock.On("GetByNames", "test", []string{ch.Name, ch2.Name, ch3.Name}, true).Return([]*model.Channel{ch, ch2, ch3}, nil)
	storeMock.On("Channel").Return(&channelStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, ch,
		ch.Name, senderName, teamName, teamURL,
		emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	channelURL := teamURL + "/channels/" + ch.Name
	channelURL2 := teamURL + "/channels/" + ch2.Name
	channelURL3 := teamURL + "/channels/" + ch3.Name
	expMessage := fmt.Sprintf("This is the message Channel1: <a href='%s'>%s</a>;"+
		" Channel2: <a href='%s'>%s</a>; Channel3: <a href='%s'>%s</a>",
		channelURL, mention, channelURL2, mention2, channelURL3, mention3)
	assert.Contains(t, body, expMessage)
}

func TestGetNotificationEmailBodyPrivateChannelMention(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	ch := &model.Channel{
		Name:        "channelname",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypePrivate,
	}
	id := model.NewId()
	recipient := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}
	post := &model.Post{
		Message: "This is the message ~" + ch.Name,
	}

	senderName := "user1"
	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Id: "test", Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	channelStoreMock := mocks.ChannelStore{}
	channelStoreMock.On("GetByNames", "test", []string{ch.Name}, true).Return([]*model.Channel{ch}, nil)
	storeMock.On("Channel").Return(&channelStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, ch,
		ch.Name, senderName, teamName, teamURL,
		emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	channelURL := teamURL + "/channels/" + ch.Name
	mention := "~" + ch.Name
	assert.NotContains(t, body, "<a href='"+channelURL+"'>"+mention+"</a>")
}

func TestGenerateHyperlinkForChannelsPublic(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	ch := &model.Channel{
		Name:        "channelname",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	message := "This is the message "
	mention := "~" + ch.Name

	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Id: "test", Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	channelStoreMock := mocks.ChannelStore{}
	channelStoreMock.On("GetByNames", "test", []string{ch.Name}, true).Return([]*model.Channel{ch}, nil)
	storeMock.On("Channel").Return(&channelStoreMock)

	outMessage, err := th.App.generateHyperlinkForChannels(th.Context, message+mention, teamName, teamURL)
	require.Nil(t, err)
	channelURL := teamURL + "/channels/" + ch.Name
	assert.Equal(t, message+"<a href='"+channelURL+"'>"+mention+"</a>", outMessage)
}

func TestGenerateHyperlinkForChannelsMultiPublic(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	// TODO: Fix the case where the first channel name contains the other channel names (for example here channelnameone)"
	ch := &model.Channel{
		Id:          model.NewId(),
		Name:        "channelnameone",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	mention := "~" + ch.Name

	ch2 := &model.Channel{
		Id:          model.NewId(),
		Name:        "channelnametwo",
		DisplayName: "ChannelName2",
		Type:        model.ChannelTypeOpen,
	}
	mention2 := "~" + ch2.Name

	ch3 := &model.Channel{
		Id:          model.NewId(),
		Name:        "channelnamethree",
		DisplayName: "ChannelName3",
		Type:        model.ChannelTypeOpen,
	}
	mention3 := "~" + ch3.Name

	message := fmt.Sprintf("This is the message Channel1: %s; Channel2: %s;"+
		" Channel3: %s", mention, mention2, mention3)

	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Id: "test", Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	channelStoreMock := mocks.ChannelStore{}
	channelStoreMock.On("GetByNames", "test", []string{ch.Name, ch2.Name, ch3.Name}, true).Return([]*model.Channel{ch, ch2, ch3}, nil)
	storeMock.On("Channel").Return(&channelStoreMock)

	outMessage, err := th.App.generateHyperlinkForChannels(th.Context, message, teamName, teamURL)
	require.Nil(t, err)
	channelURL := teamURL + "/channels/" + ch.Name
	channelURL2 := teamURL + "/channels/" + ch2.Name
	channelURL3 := teamURL + "/channels/" + ch3.Name
	expMessage := fmt.Sprintf("This is the message Channel1: <a href='%s'>%s</a>;"+
		" Channel2: <a href='%s'>%s</a>; Channel3: <a href='%s'>%s</a>",
		channelURL, mention, channelURL2, mention2, channelURL3, mention3)
	assert.Equal(t, expMessage, outMessage)
}

func TestGenerateHyperlinkForChannelsPrivate(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	ch := &model.Channel{
		Name:        "channelname",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypePrivate,
	}
	message := "This is the message ~" + ch.Name

	teamName := "testteam"
	teamURL := "http://localhost:8065/testteam"

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Id: "test", Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	channelStoreMock := mocks.ChannelStore{}
	channelStoreMock.On("GetByNames", "test", []string{ch.Name}, true).Return([]*model.Channel{ch}, nil)
	storeMock.On("Channel").Return(&channelStoreMock)

	outMessage, err := th.App.generateHyperlinkForChannels(th.Context, message, teamName, teamURL)
	require.Nil(t, err)
	assert.Equal(t, message, outMessage)
}

func TestLandingLink(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/landing#/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, teamURL, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestLandingLinkPermalink(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Id:      "Test_id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	channelName := "ChannelName"
	senderName := "sender"
	teamName := "testteam"
	teamURL := "http://localhost:8065/landing#/testteam"
	emailNotificationContentsType := model.EmailNotificationContentsFull
	translateFunc := i18n.GetUserTranslations("en")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	body, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, channelName, senderName, teamName, teamURL, emailNotificationContentsType, true, translateFunc, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, teamURL+"/pl/"+post.Id, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestMarkdownConversion(t *testing.T) {
	tests := []struct {
		name string
		args string
		want string
	}{
		{
			name: "markdown: escape string test",
			args: "<b>not bold</b>",
			want: "&lt;b&gt;not bold&lt;/b&gt;",
		},
		{
			name: "markdown: strong",
			args: "This is **Mattermost**",
			want: "This is <strong>Mattermost</strong>",
		},
		{
			name: "markdown: blockquote",
			args: "Below is blockquote\n" +
				"> This is Mattermost blockquote\n" +
				"> on multiple lines!",
			want: "<blockquote>\n" +
				"<p>This is Mattermost blockquote\n" +
				"on multiple lines!</p>\n" +
				"</blockquote>",
		},
		{
			name: "markdown: emphasis",
			args: "This is *Mattermost*",
			want: "This is <em>Mattermost</em>",
		},
		{
			name: "markdown: links",
			args: "This is [Mattermost](https://mattermost.com)",
			want: "This is <a href=\"https://mattermost.com\">Mattermost</a>",
		},
		{
			name: "markdown: strikethrough",
			args: "This is ~~Mattermost~~",
			want: "This is <del>Mattermost</del>",
		},
		{
			name: "markdown: table",
			args: "| Tables        | Are           | Cool  |\n" +
				"| ------------- |:-------------:| -----:|\n" +
				"| col 3 is      | right-aligned | $1600 |\n" +
				"| col 2 is      | centered      |   $12 |\n" +
				"| zebra stripes | are neat      |    $1 |\n",
			want: "<table>\n" +
				"<thead>\n" +
				"<tr>\n" +
				"<th>Tables</th>\n" +
				"<th style=\"text-align:center\">Are</th>\n" +
				"<th style=\"text-align:right\">Cool</th>\n" +
				"</tr>\n" +
				"</thead>\n" +
				"<tbody>\n" +
				"<tr>\n" +
				"<td>col 3 is</td>\n" +
				"<td style=\"text-align:center\">right-aligned</td>\n" +
				"<td style=\"text-align:right\">$1600</td>\n" +
				"</tr>\n" +
				"<tr>\n" +
				"<td>col 2 is</td>\n" +
				"<td style=\"text-align:center\">centered</td>\n" +
				"<td style=\"text-align:right\">$12</td>\n" +
				"</tr>\n" +
				"<tr>\n" +
				"<td>zebra stripes</td>\n" +
				"<td style=\"text-align:center\">are neat</td>\n" +
				"<td style=\"text-align:right\">$1</td>\n" +
				"</tr>\n" +
				"</tbody>\n" +
				"</table>",
		},
		{
			name: "markdown: multiline with header and links",
			args: "###### H6 header\n[link 1](https://mattermost.com) - [link 2](https://mattermost.com)",
			want: "<h6>H6 header</h6>\n" +
				"<p><a href=\"https://mattermost.com\">link 1</a> - <a href=\"https://mattermost.com\">link 2</a></p>",
		},
	}

	th := SetupWithStoreMock(t)
	defer th.TearDown()

	recipient := &model.User{}
	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			post := &model.Post{
				Id:      "Test_id",
				Message: tt.args,
			}
			got, err := th.App.getNotificationEmailBody(th.Context, recipient, post, channel, "ChannelName", "sender", "testteam", "http://localhost:8065/landing#/testteam", model.EmailNotificationContentsFull, true, i18n.GetUserTranslations("en"), "user-avatar.png")
			require.NoError(t, err)
			require.Contains(t, got, tt.want)
		})
	}
}
