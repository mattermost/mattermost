// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package importexport

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	importExportMocks "github.com/mattermost/mattermost-server/v5/services/importexport/mocks"
	storeMocks "github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
)

func TestReactionsOfPost(t *testing.T) {
	postID := model.NewId()
	userID := model.NewId()

	appMock := &importExportMocks.ExporterAppIface{}
	storeMock := &storeMocks.Store{}
	exporter := NewExporter(appMock, storeMock)

	reactionStore := &storeMocks.ReactionStore{}
	reactionObject := model.Reaction{
		UserId:    userID,
		PostId:    postID,
		EmojiName: "emoji",
		CreateAt:  model.GetMillis(),
	}
	reactionStore.On("GetForPost", postID, true).Return([]*model.Reaction{&reactionObject}, nil)
	storeMock.On("Reaction").Return(reactionStore)
	userStore := &storeMocks.UserStore{}
	userStore.On("Get", userID).Return(&model.User{Id: userID}, nil)
	storeMock.On("User").Return(userStore)

	reactionsOfPost, err := exporter.BuildPostReactions(postID)
	require.Nil(t, err)

	assert.Equal(t, "emoji", *(*reactionsOfPost)[0].EmojiName)
}

func TestExportUserNotifyProps(t *testing.T) {
	appMock := &importExportMocks.ExporterAppIface{}
	storeMock := &storeMocks.Store{}
	exporter := NewExporter(appMock, storeMock)

	userNotifyProps := model.StringMap{
		model.DESKTOP_NOTIFY_PROP:          model.USER_NOTIFY_ALL,
		model.DESKTOP_SOUND_NOTIFY_PROP:    "true",
		model.EMAIL_NOTIFY_PROP:            "true",
		model.PUSH_NOTIFY_PROP:             model.USER_NOTIFY_ALL,
		model.PUSH_STATUS_NOTIFY_PROP:      model.STATUS_ONLINE,
		model.CHANNEL_MENTIONS_NOTIFY_PROP: "true",
		model.COMMENTS_NOTIFY_PROP:         model.COMMENTS_NOTIFY_ROOT,
		model.MENTION_KEYS_NOTIFY_PROP:     "valid,misc",
	}

	exportNotifyProps := exporter.buildUserNotifyProps(userNotifyProps)

	require.Equal(t, userNotifyProps[model.DESKTOP_NOTIFY_PROP], *exportNotifyProps.Desktop)
	require.Equal(t, userNotifyProps[model.DESKTOP_SOUND_NOTIFY_PROP], *exportNotifyProps.DesktopSound)
	require.Equal(t, userNotifyProps[model.EMAIL_NOTIFY_PROP], *exportNotifyProps.Email)
	require.Equal(t, userNotifyProps[model.PUSH_NOTIFY_PROP], *exportNotifyProps.Mobile)
	require.Equal(t, userNotifyProps[model.PUSH_STATUS_NOTIFY_PROP], *exportNotifyProps.MobilePushStatus)
	require.Equal(t, userNotifyProps[model.CHANNEL_MENTIONS_NOTIFY_PROP], *exportNotifyProps.ChannelTrigger)
	require.Equal(t, userNotifyProps[model.COMMENTS_NOTIFY_PROP], *exportNotifyProps.CommentsTrigger)
	require.Equal(t, userNotifyProps[model.MENTION_KEYS_NOTIFY_PROP], *exportNotifyProps.MentionKeys)
}

func TestExportUserChannels(t *testing.T) {
	appMock := &importExportMocks.ExporterAppIface{}
	storeMock := &storeMocks.Store{}
	exporter := NewExporter(appMock, storeMock)

	userID := model.NewId()
	teamID := model.NewId()
	channelID := model.NewId()
	channelName := "test"

	channelStore := &storeMocks.ChannelStore{}
	channelStore.On("GetChannelMembersForExport", userID, teamID).Return([]*model.ChannelMemberForExport{
		&model.ChannelMemberForExport{ChannelMember: model.ChannelMember{UserId: userID, ChannelId: channelID, NotifyProps: map[string]string{"desktop": "all", "push": "none", "mark_unread": "all"}}, ChannelName: channelName},
		&model.ChannelMemberForExport{ChannelMember: model.ChannelMember{UserId: userID, ChannelId: model.NewId(), NotifyProps: map[string]string{"desktop": "default", "push": "default", "mark_unread": "all"}}, ChannelName: "other1"},
		&model.ChannelMemberForExport{ChannelMember: model.ChannelMember{UserId: userID, ChannelId: model.NewId(), NotifyProps: map[string]string{"desktop": "default", "push": "default", "mark_unread": "all"}}, ChannelName: "other2"},
	}, nil)
	storeMock.On("Channel").Return(channelStore)

	favPreference := model.Preference{
		UserId:   userID,
		Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
		Name:     channelID,
		Value:    "true",
	}
	appMock.On("GetPreferenceByCategoryForUser", userID, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL).Return(model.Preferences{favPreference}, nil)

	exportData, err := exporter.buildUserChannelMemberships(userID, teamID)
	require.Nil(t, err)
	assert.Equal(t, len(*exportData), 3)
	for _, data := range *exportData {
		if *data.Name == channelName {
			assert.Equal(t, *data.NotifyProps.Desktop, "all")
			assert.Equal(t, *data.NotifyProps.Mobile, "none")
			assert.Equal(t, *data.NotifyProps.MarkUnread, "all") // default value
			assert.True(t, *data.Favorite)
		} else { // default values
			assert.Equal(t, *data.NotifyProps.Desktop, "default")
			assert.Equal(t, *data.NotifyProps.Mobile, "default")
			assert.Equal(t, *data.NotifyProps.MarkUnread, "all")
			assert.False(t, *data.Favorite)
		}
	}
}

func TestDirCreationForEmoji(t *testing.T) {
	appMock := &importExportMocks.ExporterAppIface{}
	storeMock := &storeMocks.Store{}
	exporter := NewExporter(appMock, storeMock)

	pathToDir := exporter.createDirForEmoji("test.json", "exported_emoji_test")
	defer os.Remove(pathToDir)
	_, err := os.Stat(pathToDir)
	require.False(t, os.IsNotExist(err), "Directory exported_emoji_test should exist")
}

func TestCopyEmojiImages(t *testing.T) {
	appMock := &importExportMocks.ExporterAppIface{}
	storeMock := &storeMocks.Store{}
	exporter := NewExporter(appMock, storeMock)

	emoji := &model.Emoji{
		Id: model.NewId(),
	}

	// Creating a dir named `exported_emoji_test` in the root of the repo
	pathToDir := "../exported_emoji_test"

	os.Mkdir(pathToDir, 0777)
	defer os.RemoveAll(pathToDir)

	filePath := "../data/emoji/" + emoji.Id
	emojiImagePath := filePath + "/image"

	var _, err = os.Stat(filePath)
	if os.IsNotExist(err) {
		os.MkdirAll(filePath, 0777)
	}

	// Creating a file with the name `image` to copy it to `exported_emoji_test`
	os.OpenFile(filePath+"/image", os.O_RDONLY|os.O_CREATE, 0777)
	defer os.RemoveAll(filePath)

	copyError := exporter.copyEmojiImages(emoji.Id, emojiImagePath, pathToDir)
	require.Nil(t, copyError)

	_, err = os.Stat(pathToDir + "/" + emoji.Id + "/image")
	require.False(t, os.IsNotExist(err), "File should exist ")
}

func TestExportCustomEmoji(t *testing.T) {
	appMock := &importExportMocks.ExporterAppIface{}
	storeMock := &storeMocks.Store{}
	exporter := NewExporter(appMock, storeMock)
	appMock.On("GetEmojiList", 0, 100, "name").Return([]*model.Emoji{}, nil)

	filePath := "../demo.json"

	fileWriter, err := os.Create(filePath)
	require.Nil(t, err)
	defer os.Remove(filePath)

	pathToEmojiDir := "../data/emoji/"
	dirNameToExportEmoji := "exported_emoji_test"
	defer os.RemoveAll("../" + dirNameToExportEmoji)

	err = exporter.exportCustomEmoji(fileWriter, filePath, pathToEmojiDir, dirNameToExportEmoji)
	require.Nil(t, err, "should not have failed")
}
