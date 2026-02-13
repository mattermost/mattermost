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

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/timezones"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// Helper function to create PostNotification for testing
func buildTestPostNotification(post *model.Post, channel *model.Channel, sender *model.User) *PostNotification {
	return &PostNotification{
		Channel:    channel,
		Post:       post,
		Sender:     sender,
		ProfileMap: make(map[string]*model.User),
	}
}

// Helper function to create test user
func buildTestUser(id, username, displayName string, useMilitaryTime bool) *model.User {
	return &model.User{
		Id:       id,
		Username: username,
		Nickname: displayName,
		Locale:   "en",
	}
}

// Helper function to create test team
func buildTestTeam(id, name, displayName string) *model.Team {
	return &model.Team{
		Id:          id,
		Name:        name,
		DisplayName: displayName,
	}
}

// Helper function to set up preference mocks
func setupPreferenceMocks(th *TestHelper, userId string, useMilitaryTime bool) {
	preferenceStoreMock := mocks.PreferenceStore{}
	if useMilitaryTime {
		preferenceStoreMock.On("Get", userId, model.PreferenceCategoryDisplaySettings, model.PreferenceNameUseMilitaryTime).Return(&model.Preference{Value: "true"}, nil)
	} else {
		preferenceStoreMock.On("Get", userId, model.PreferenceCategoryDisplaySettings, model.PreferenceNameUseMilitaryTime).Return(&model.Preference{Value: "false"}, nil)
	}
	// Mock the name format preference as well
	preferenceStoreMock.On("Get", userId, model.PreferenceCategoryDisplaySettings, model.PreferenceNameNameFormat).Return(&model.Preference{Value: model.ShowUsername}, nil)
	th.App.Srv().Store().(*mocks.Store).On("Preference").Return(&preferenceStoreMock)
}

func TestGetDirectMessageNotificationEmailSubject(t *testing.T) {
	mainHelper.Parallel(t)
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
	mainHelper.Parallel(t)
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
	mainHelper.Parallel(t)
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
	mainHelper.Parallel(t)
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
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "mentioned you in a message", fmt.Sprintf("Expected email text 'mentioned you in a message. Got %s", body))
	require.Contains(t, body, post.Message, fmt.Sprintf("Expected email text '%s'. Got %s", post.Message, body))
	require.Contains(t, body, team.Name, fmt.Sprintf("Expected email text '%s'. Got %s", team.Name, body))
}

func TestGetNotificationEmailBodyFullNotificationGroupChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeGroup,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "sent you a new message", fmt.Sprintf("Expected email text 'sent you a new message. Got %s", body))
	require.Contains(t, body, post.Message, fmt.Sprintf("Expected email text '%s'. Got %s", post.Message, body))
	require.Contains(t, body, team.Name, fmt.Sprintf("Expected email text '%s'. Got %s", team.Name, body))
}

func TestGetNotificationEmailBodyFullNotificationPrivateChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypePrivate,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "mentioned you in a message", fmt.Sprintf("Expected email text 'mentioned you in a message. Got %s", body))
	require.Contains(t, body, post.Message, fmt.Sprintf("Expected email text '%s'. Got %s", post.Message, body))
	require.Contains(t, body, team.Name, fmt.Sprintf("Expected email text '%s'. Got %s", team.Name, body))
}

func TestGetNotificationEmailBodyFullNotificationDirectChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "sent you a new message", fmt.Sprintf("Expected email text 'sent you a new message. Got %s", body))
	require.Contains(t, body, post.Message, fmt.Sprintf("Expected email text '%s'. Got %s", post.Message, body))
	require.Contains(t, body, team.Name, fmt.Sprintf("Expected email text '%s'. Got %s", team.Name, body))
}

func TestGetNotificationEmailBodyFullNotificationLocaleTimeWithTimezone(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := &model.User{
		Id:       "test-recipient-id",
		Username: "recipient",
		Nickname: "Recipient User",
		Locale:   "en",
		Timezone: timezones.DefaultUserTimezone(),
	}
	recipient.Timezone["automaticTimezone"] = "America/New_York"
	post := &model.Post{
		Id:       "test-post-id",
		CreateAt: 1524663790000,
		Message:  "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, false)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	r, _ := regexp.Compile("E([S|D]+)T")
	zone := r.FindString(body)
	require.Contains(t, body, "9:43 AM "+zone, fmt.Sprintf("Expected email text '9:43 AM %s'. Got %s", zone, body))
}

func TestGetNotificationEmailBodyFullNotificationLocaleTimeNoTimezone(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := &model.User{
		Id:       "test-recipient-id",
		Username: "recipient",
		Nickname: "Recipient User",
		Locale:   "en",
		Timezone: timezones.DefaultUserTimezone(),
	}
	post := &model.Post{
		Id:       "test-post-id",
		CreateAt: 1524681000000,
		Message:  "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	tm := time.Unix(post.CreateAt/1000, 0)
	zone, _ := tm.Zone()

	formattedTime := utils.FormattedPostTime{
		Hour:     fmt.Sprintf("%02d", tm.Hour()),
		Minute:   fmt.Sprintf("%02d", tm.Minute()),
		TimeZone: zone,
	}

	tmp, err := template.New("foo").Parse(`{{.}}`)
	require.NoError(t, err)
	var text bytes.Buffer
	err = tmp.Execute(&text, fmt.Sprintf("%s:%s %s", formattedTime.Hour, formattedTime.Minute, formattedTime.TimeZone))
	require.NoError(t, err)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	postTimeLine := text.String()
	require.Contains(t, body, postTimeLine, fmt.Sprintf("Expected email text '%s'. Got %s", postTimeLine, body))
}

func TestGetNotificationEmailBodyFullNotificationLocaleTime12Hour(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := &model.User{
		Id:       "test-recipient-id",
		Username: "recipient",
		Nickname: "Recipient User",
		Locale:   "en",
		Timezone: timezones.DefaultUserTimezone(),
	}
	recipient.Timezone["automaticTimezone"] = "America/New_York"
	post := &model.Post{
		Id:       "test-post-id",
		CreateAt: 1524681000000, // 1524681000 // 1524681000000
		Message:  "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, false)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "2:30 PM", fmt.Sprintf("Expected email text '2:30 PM'. Got %s", body))
}

func TestGetNotificationEmailBodyFullNotificationLocaleTime24Hour(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := &model.User{
		Id:       "test-recipient-id",
		Username: "recipient",
		Nickname: "Recipient User",
		Locale:   "en",
		Timezone: timezones.DefaultUserTimezone(),
	}
	recipient.Timezone["automaticTimezone"] = "America/New_York"
	post := &model.Post{
		Id:       "test-post-id",
		CreateAt: 1524681000000,
		Message:  "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "14:30", fmt.Sprintf("Expected email text '14:30'. Got %s", body))
}

func TestGetNotificationEmailBodyWithUserPreference(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := &model.User{
		Id:       "test-recipient-id",
		Username: "recipient",
		Nickname: "Recipient User",
		Locale:   "en",
		Timezone: timezones.DefaultUserTimezone(),
	}
	recipient.Timezone["automaticTimezone"] = "America/New_York"

	post := &model.Post{
		Id:       "test-post-id",
		CreateAt: 1524681000000,
		Message:  "This is the message",
	}

	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}

	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	// Test 12-hour format
	is24HourFormat := false

	expectedTimeFormat := "2:30 PM"
	if is24HourFormat {
		expectedTimeFormat = "14:30"
	}

	setupPreferenceMocks(th, recipient.Id, is24HourFormat)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, expectedTimeFormat, fmt.Sprintf("Expected email text '%s'. Got %s", expectedTimeFormat, body))
}

func TestGetNotificationEmailBodyFullNotificationWithSlackAttachments(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "test-post-id",
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
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}

	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
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
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "mentioned you in a message", fmt.Sprintf("Expected email text 'mentioned you in a message. Got %s", body))
	require.Contains(t, body, team.Name, fmt.Sprintf("Expected email text '%s'. Got %s", team.Name, body))
}

func TestGetNotificationEmailBodyGenericNotificationGroupChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeGroup,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "sent you a new message", fmt.Sprintf("Expected email text 'sent you a new message. Got %s", body))
	require.Contains(t, body, team.Name, fmt.Sprintf("Expected email text '%s'. Got %s", team.Name, body))
}

func TestGetNotificationEmailBodyGenericNotificationPrivateChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypePrivate,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "mentioned you in a message", fmt.Sprintf("Expected email text 'mentioned you in a message. Got %s", body))
	require.Contains(t, body, team.Name, fmt.Sprintf("Expected email text '%s'. Got %s", team.Name, body))
}

func TestGetNotificationEmailBodyGenericNotificationDirectChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeDirect,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "sent you a new message", fmt.Sprintf("Expected email text 'sent you a new message. Got %s", body))
	require.Contains(t, body, team.Name, fmt.Sprintf("Expected email text '%s'. Got %s", team.Name, body))
}

func TestGetNotificationEmailEscapingChars(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	message := "<b>Bold Test</b>"
	post := &model.Post{
		Id:      "test-post-id",
		Message: message,
	}

	ch := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, ch, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)

	assert.NotContains(t, body, message)
}

func TestGetNotificationEmailBodyPublicChannelMention(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	ch := &model.Channel{
		Id:          "test-channel-id",
		Name:        "channelname",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	id := model.NewId()
	recipient := &model.User{
		Id:            "test-recipient-id",
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
		Locale:        "en",
	}
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message ~" + ch.Name,
	}

	sender := buildTestUser("test-sender-id", "user1", "user1", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")
	teamURL := th.App.GetSiteURL() + "/landing#" + "/testteam"

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Id: "test", Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	channelStoreMock := mocks.ChannelStore{}
	channelStoreMock.On("GetByNames", "test", []string{ch.Name}, true).Return([]*model.Channel{ch}, nil)
	storeMock.On("Channel").Return(&channelStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	th.App.Srv().EmailService.SetStore(storeMock)

	notification := buildTestPostNotification(post, ch, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	channelURL := teamURL + "/channels/" + ch.Name
	mention := "~" + ch.Name
	assert.Contains(t, body, "<a href='"+channelURL+"'>"+mention+"</a>")
}

func TestGetNotificationEmailBodyMultiPublicChannelMention(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

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
	post := &model.Post{
		Message: message,
	}

	teamURL := th.App.GetSiteURL() + "/landing#" + "/testteam"

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Id: "test", Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	channelStoreMock := mocks.ChannelStore{}
	channelStoreMock.On("GetByNames", "test", []string{ch.Name, ch2.Name, ch3.Name}, true).Return([]*model.Channel{ch, ch2, ch3}, nil)
	storeMock.On("Channel").Return(&channelStoreMock)

	th.App.Srv().EmailService.SetStore(storeMock)

	channelURL := teamURL + "/channels/" + ch.Name
	channelURL2 := teamURL + "/channels/" + ch2.Name
	channelURL3 := teamURL + "/channels/" + ch3.Name
	expMessage := fmt.Sprintf("This is the message Channel1: <a href='%s'>%s</a>;"+
		" Channel2: <a href='%s'>%s</a>; Channel3: <a href='%s'>%s</a>",
		channelURL, mention, channelURL2, mention2, channelURL3, mention3)
	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	sender := buildTestUser("test-sender-id", "user1", "user1", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, ch, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	assert.Contains(t, body, expMessage)
}

func TestGetNotificationEmailBodyPrivateChannelMention(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	ch := &model.Channel{
		Id:          "test-channel-id",
		Name:        "channelname",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypePrivate,
	}
	id := model.NewId()
	recipient := &model.User{
		Id:            "test-recipient-id",
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
		Locale:        "en",
	}
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message ~" + ch.Name,
	}

	sender := buildTestUser("test-sender-id", "user1", "user1", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")
	teamURL := "http://localhost:8065/testteam"

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Id: "test", Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	channelStoreMock := mocks.ChannelStore{}
	channelStoreMock.On("GetByNames", "test", []string{ch.Name}, true).Return([]*model.Channel{ch}, nil)
	storeMock.On("Channel").Return(&channelStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	th.App.Srv().EmailService.SetStore(storeMock)

	notification := buildTestPostNotification(post, ch, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	channelURL := teamURL + "/channels/" + ch.Name
	mention := "~" + ch.Name
	assert.NotContains(t, body, "<a href='"+channelURL+"'>"+mention+"</a>")
}

func TestGenerateHyperlinkForChannelsPublic(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

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

	th.App.Srv().EmailService.SetStore(storeMock)
	outMessage, err := th.App.Srv().EmailService.GenerateHyperlinkForChannels(message+mention, teamName, teamURL)
	require.NoError(t, err)
	channelURL := teamURL + "/channels/" + ch.Name
	assert.Equal(t, message+"<a href='"+channelURL+"'>"+mention+"</a>", outMessage)
}

func TestGenerateHyperlinkForChannelsMultiPublic(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

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

	th.App.Srv().EmailService.SetStore(storeMock)
	outMessage, err := th.App.Srv().EmailService.GenerateHyperlinkForChannels(message, teamName, teamURL)
	require.NoError(t, err)
	channelURL := teamURL + "/channels/" + ch.Name
	channelURL2 := teamURL + "/channels/" + ch2.Name
	channelURL3 := teamURL + "/channels/" + ch3.Name
	expMessage := fmt.Sprintf("This is the message Channel1: <a href='%s'>%s</a>;"+
		" Channel2: <a href='%s'>%s</a>; Channel3: <a href='%s'>%s</a>",
		channelURL, mention, channelURL2, mention2, channelURL3, mention3)
	assert.Equal(t, expMessage, outMessage)
}

func TestGenerateHyperlinkForChannelsPrivate(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

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

	th.App.Srv().EmailService.SetStore(storeMock)
	outMessage, err := th.App.Srv().EmailService.GenerateHyperlinkForChannels(message, teamName, teamURL)
	require.NoError(t, err)
	assert.Equal(t, message, outMessage)
}

func TestLandingLink(t *testing.T) {
	mainHelper.Parallel(t)

	// Create a minimal helper that sets the site URL
	mockStore := testlib.GetMockStoreForSetupFunctions()
	th := setupTestHelper(mockStore, mainHelper.GetSQLStore(), mainHelper.GetSQLSettings(), mainHelper.GetSearchEngine(), false, false,
		func(cfg *model.Config) {
			cfg.ServiceSettings.SiteURL = model.NewPointer("http://localhost:8065")
		}, nil, t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "test-post-id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")
	teamURL := "http://localhost:8065/landing#/testteam"

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, teamURL, fmt.Sprintf("Expected email text '%s'. Got %s", teamURL, body))
}

func TestLandingLinkPermalink(t *testing.T) {
	mainHelper.Parallel(t)

	// Create a minimal helper that sets the site URL
	mockStore := testlib.GetMockStoreForSetupFunctions()
	th := setupTestHelper(mockStore, mainHelper.GetSQLStore(), mainHelper.GetSQLSettings(), mainHelper.GetSearchEngine(), false, false,
		func(cfg *model.Config) {
			cfg.ServiceSettings.SiteURL = model.NewPointer("http://localhost:8065")
		}, nil, t)

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	post := &model.Post{
		Id:      "Test_id",
		Message: "This is the message",
	}
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)

	setupPreferenceMocks(th, recipient.Id, true)

	notification := buildTestPostNotification(post, channel, sender)
	emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
	body, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
	require.NoError(t, err)
	require.Contains(t, body, "/pl/"+post.Id, fmt.Sprintf("Expected email text to contain permalink '/pl/%s'. Got %s", post.Id, body))
}

func TestMarkdownConversion(t *testing.T) {
	mainHelper.Parallel(t)
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

	recipient := buildTestUser("test-recipient-id", "recipient", "Recipient User", true)
	storeMock := th.App.Srv().Store().(*mocks.Store)
	teamStoreMock := mocks.TeamStore{}
	teamStoreMock.On("GetByName", "testteam").Return(&model.Team{Name: "testteam"}, nil)
	storeMock.On("Team").Return(&teamStoreMock)
	channel := &model.Channel{
		Id:          "test-channel-id",
		Name:        "testchannel",
		DisplayName: "ChannelName",
		Type:        model.ChannelTypeOpen,
	}
	sender := buildTestUser("test-sender-id", "sender", "sender", true)
	team := buildTestTeam("test-team-id", "testteam", "testteam")

	setupPreferenceMocks(th, recipient.Id, true)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			post := &model.Post{
				Id:      "Test_id",
				Message: tt.args,
			}
			notification := buildTestPostNotification(post, channel, sender)
			emailNotification := th.App.buildEmailNotification(th.Context, notification, recipient, team)
			got, err := th.App.getNotificationEmailBodyFromEmailNotification(th.Context, recipient, emailNotification, post, "user-avatar.png")
			require.NoError(t, err)
			require.Contains(t, got, tt.want)
		})
	}
}
