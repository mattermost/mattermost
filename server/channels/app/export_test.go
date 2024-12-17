// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestReactionsOfPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := th.BasicPost
	post.HasReactions = true
	th.BasicUser2.DeleteAt = 1234
	reactionObject := model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    post.Id,
		EmojiName: "smile",
		CreateAt:  model.GetMillis(),
	}
	reactionObjectDeleted := model.Reaction{
		UserId:    th.BasicUser2.Id,
		PostId:    post.Id,
		EmojiName: "smile",
		CreateAt:  model.GetMillis(),
	}

	_, err := th.App.SaveReactionForPost(th.Context, &reactionObject)
	require.Nil(t, err)
	_, err = th.App.SaveReactionForPost(th.Context, &reactionObjectDeleted)
	require.Nil(t, err)
	reactionsOfPost, err := th.App.BuildPostReactions(th.Context, post.Id)
	require.Nil(t, err)

	assert.Equal(t, reactionObject.EmojiName, *(*reactionsOfPost)[0].EmojiName)
}

func TestExportUserNotifyProps(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	userNotifyProps := model.StringMap{
		model.DesktopNotifyProp:         model.UserNotifyAll,
		model.DesktopSoundNotifyProp:    "true",
		model.EmailNotifyProp:           "true",
		model.PushNotifyProp:            model.UserNotifyAll,
		model.PushStatusNotifyProp:      model.StatusOnline,
		model.ChannelMentionsNotifyProp: "true",
		model.CommentsNotifyProp:        model.CommentsNotifyRoot,
		model.MentionKeysNotifyProp:     "valid,misc",
	}

	exportNotifyProps := th.App.buildUserNotifyProps(userNotifyProps)

	require.Equal(t, userNotifyProps[model.DesktopNotifyProp], *exportNotifyProps.Desktop)
	require.Equal(t, userNotifyProps[model.DesktopSoundNotifyProp], *exportNotifyProps.DesktopSound)
	require.Equal(t, userNotifyProps[model.EmailNotifyProp], *exportNotifyProps.Email)
	require.Equal(t, userNotifyProps[model.PushNotifyProp], *exportNotifyProps.Mobile)
	require.Equal(t, userNotifyProps[model.PushStatusNotifyProp], *exportNotifyProps.MobilePushStatus)
	require.Equal(t, userNotifyProps[model.ChannelMentionsNotifyProp], *exportNotifyProps.ChannelTrigger)
	require.Equal(t, userNotifyProps[model.CommentsNotifyProp], *exportNotifyProps.CommentsTrigger)
	require.Equal(t, userNotifyProps[model.MentionKeysNotifyProp], *exportNotifyProps.MentionKeys)
}

func TestExportUserChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel
	user := th.BasicUser
	team := th.BasicTeam
	channelName := channel.Name
	notifyProps := model.StringMap{
		model.DesktopNotifyProp: model.UserNotifyAll,
		model.PushNotifyProp:    model.UserNotifyNone,
	}
	preference := model.Preference{
		UserId:   user.Id,
		Category: model.PreferenceCategoryFavoriteChannel,
		Name:     channel.Id,
		Value:    "true",
	}

	_, appErr := th.App.MarkChannelsAsViewed(th.Context, []string{th.BasicPost.ChannelId}, user.Id, "", true, th.App.IsCRTEnabledForUser(th.Context, user.Id))
	require.Nil(t, appErr)

	var preferences model.Preferences
	preferences = append(preferences, preference)
	err := th.App.Srv().Store().Preference().Save(preferences)
	require.NoError(t, err)

	_, appErr = th.App.UpdateChannelMemberNotifyProps(th.Context, notifyProps, channel.Id, user.Id)
	require.Nil(t, appErr)
	exportData, appErr := th.App.buildUserChannelMemberships(th.Context, user.Id, team.Id, false)
	require.Nil(t, appErr)
	assert.Equal(t, len(*exportData), 3)
	for _, data := range *exportData {
		if *data.Name == channelName {
			assert.Equal(t, "all", *data.NotifyProps.Desktop)
			assert.Equal(t, "none", *data.NotifyProps.Mobile)
			assert.Equal(t, "all", *data.NotifyProps.MarkUnread) // default value
			assert.True(t, *data.Favorite)
			assert.NotEqualValues(t, 0, *data.LastViewedAt)
			assert.NotEqualValues(t, 0, *data.MsgCount)
		} else { // default values
			assert.Equal(t, "default", *data.NotifyProps.Desktop)
			assert.Equal(t, "default", *data.NotifyProps.Mobile)
			assert.Equal(t, "all", *data.NotifyProps.MarkUnread)
			assert.False(t, *data.Favorite)
			assert.EqualValues(t, 0, *data.LastViewedAt)
			assert.EqualValues(t, 0, *data.MsgCount)
		}
	}
}

func TestCopyEmojiImages(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	emoji := &model.Emoji{
		Id: model.NewId(),
	}

	// Creating a dir named `exported_emoji_test` in the root of the repo
	pathToDir := "../exported_emoji_test"

	err := os.Mkdir(pathToDir, 0777)
	require.NoError(t, err)
	defer os.RemoveAll(pathToDir)

	filePath := "../data/emoji/" + emoji.Id
	emojiImagePath := filePath + "/image"

	_, err = os.Stat(filePath)
	if os.IsNotExist(err) {
		err = os.MkdirAll(filePath, 0777)
		require.NoError(t, err)
	}

	// Creating a file with the name `image` to copy it to `exported_emoji_test`
	_, err = os.OpenFile(filePath+"/image", os.O_RDONLY|os.O_CREATE, 0777)
	require.NoError(t, err)
	defer os.RemoveAll(filePath)

	copyError := th.App.copyEmojiImages(emoji.Id, emojiImagePath, pathToDir)
	require.NoError(t, copyError)

	_, err = os.Stat(pathToDir + "/" + emoji.Id + "/image")
	require.False(t, os.IsNotExist(err), "File should exist ")
}

func TestExportCustomEmoji(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	filePath := "../demo.json"

	fileWriter, err := os.Create(filePath)
	require.NoError(t, err)
	defer os.Remove(filePath)

	dirNameToExportEmoji := "exported_emoji_test"
	defer os.RemoveAll("../" + dirNameToExportEmoji)

	outPath, err := filepath.Abs(filePath)
	require.NoError(t, err)

	_, appErr := th.App.exportCustomEmoji(th.Context, nil, fileWriter, outPath, dirNameToExportEmoji, false)
	require.Nil(t, appErr, "should not have failed")
}

func TestExportAllUsers(t *testing.T) {
	th1 := Setup(t)
	defer th1.TearDown()

	// Adding a user and deactivating it to check whether it gets included in bulk export
	user := th1.CreateUser()
	_, err := th1.App.UpdateActive(th1.Context, user, false)
	require.Nil(t, err)

	var b bytes.Buffer
	err = th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
	require.Nil(t, err)

	th2 := Setup(t)
	defer th2.TearDown()
	err, i := th2.App.BulkImport(th2.Context, &b, nil, false, 5)
	assert.Nil(t, err)
	assert.EqualValues(t, 0, i)

	users1, err := th1.App.GetUsersFromProfiles(&model.UserGetOptions{
		Page:    0,
		PerPage: 10,
	})
	assert.Nil(t, err)
	users2, err := th2.App.GetUsersFromProfiles(&model.UserGetOptions{
		Page:    0,
		PerPage: 10,
	})
	assert.Nil(t, err)
	assert.Equal(t, len(users1), len(users2))
	assert.ElementsMatch(t, users1, users2)

	// Checking whether deactivated users were included in bulk export
	deletedUsers1, err := th1.App.GetUsersFromProfiles(&model.UserGetOptions{
		Inactive: true,
		Page:     0,
		PerPage:  10,
	})
	assert.Nil(t, err)
	deletedUsers2, err := th1.App.GetUsersFromProfiles(&model.UserGetOptions{
		Inactive: true,
		Page:     0,
		PerPage:  10,
	})
	assert.Nil(t, err)
	assert.Equal(t, len(deletedUsers1), len(deletedUsers2))
	assert.ElementsMatch(t, deletedUsers1, deletedUsers2)
}

func TestExportAllBots(t *testing.T) {
	th1 := Setup(t)
	defer th1.TearDown()

	u := th1.CreateUser()
	bot, err := th1.App.CreateBot(th1.Context, &model.Bot{
		Username:    "bot_1",
		DisplayName: model.NewId(),
		OwnerId:     u.Id,
	})
	require.Nil(t, err)

	var b bytes.Buffer
	err = th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
	require.Nil(t, err)

	th2 := Setup(t)
	defer th2.TearDown()
	err, i := th2.App.BulkImport(th2.Context, &b, nil, false, 5)
	require.Nil(t, err)
	assert.EqualValues(t, 0, i)

	u, err = th2.App.GetUserByUsername(u.Username)
	require.Nil(t, err)

	bots, err := th2.App.GetBots(th2.Context, &model.BotGetOptions{
		OwnerId: u.Id,
		Page:    0,
		PerPage: 10,
	})
	require.Nil(t, err)
	require.Len(t, bots, 1)
	assert.Equal(t, bot.Username, bots[0].Username)
}

func TestExportDMChannel(t *testing.T) {
	t.Run("Export a DM channel to another server", func(t *testing.T) {
		th1 := Setup(t).InitBasic()
		defer th1.TearDown()

		// DM Channel
		ch := th1.CreateDmChannel(th1.BasicUser2)

		err := th1.App.Srv().Store().Preference().Save(model.Preferences{
			{
				UserId:   th1.BasicUser2.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     ch.Id,
				Value:    "true",
			},
		})
		require.NoError(t, err)

		var b bytes.Buffer
		appErr := th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
		require.Nil(t, appErr)

		channels, nErr := th1.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
		require.NoError(t, nErr)
		assert.Equal(t, 1, len(channels))

		th2 := Setup(t).InitBasic()
		defer th2.TearDown()

		channels, nErr = th2.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
		require.NoError(t, nErr)
		assert.Equal(t, 0, len(channels))

		// import the exported channel
		var i int
		appErr, i = th2.App.BulkImport(th2.Context, &b, nil, false, 5)
		require.Nil(t, appErr)
		assert.Equal(t, 0, i)

		// Ensure the Members of the imported DM channel is the same was from the exported
		channels, nErr = th2.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
		require.NoError(t, nErr)
		require.Len(t, channels, 1)
		require.Len(t, channels[0].Members, 2)
		assert.ElementsMatch(t, []string{th1.BasicUser.Username, th1.BasicUser2.Username}, []string{channels[0].Members[0].Username, channels[0].Members[1].Username})

		// Ensure the favorited channel was retained
		fav, nErr := th2.App.Srv().Store().Preference().Get(th2.BasicUser2.Id, model.PreferenceCategoryFavoriteChannel, channels[0].Id)
		require.NoError(t, nErr)
		require.NotNil(t, fav)
		require.Equal(t, "true", fav.Value)
	})

	t.Run("Invalid DM channel export", func(t *testing.T) {
		th1 := Setup(t).InitBasic()
		defer th1.TearDown()

		// DM Channel
		th1.CreateDmChannel(th1.BasicUser2)

		channels, nErr := th1.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
		require.NoError(t, nErr)
		assert.Equal(t, 1, len(channels))

		appErr := th1.App.PermanentDeleteUser(th1.Context, th1.BasicUser2)
		require.Nil(t, appErr)
		appErr = th1.App.PermanentDeleteUser(th1.Context, th1.BasicUser)
		require.Nil(t, appErr)

		var b bytes.Buffer
		appErr = th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
		require.Nil(t, appErr)

		th2 := Setup(t).InitBasic()
		defer th2.TearDown()

		// import the exported channel
		appErr, _ = th2.App.BulkImport(th2.Context, &b, nil, true, 5)
		require.Nil(t, appErr)

		channels, nErr = th2.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
		require.NoError(t, nErr)
		assert.Empty(t, channels)
	})
}

func TestExportDMChannelToSelf(t *testing.T) {
	th1 := Setup(t).InitBasic()
	defer th1.TearDown()

	// DM Channel with self (me channel)
	th1.CreateDmChannel(th1.BasicUser)

	var b bytes.Buffer
	err := th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
	require.Nil(t, err)

	channels, nErr := th1.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(channels))

	th2 := Setup(t)
	defer th2.TearDown()

	channels, nErr = th2.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
	require.NoError(t, nErr)
	assert.Equal(t, 0, len(channels))

	// import the exported channel
	err, i := th2.App.BulkImport(th2.Context, &b, nil, false, 5)
	assert.Nil(t, err)
	assert.EqualValues(t, 0, i)

	channels, nErr = th2.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(channels))
	assert.Equal(t, 1, len((channels[0].Members)))
	assert.Equal(t, th1.BasicUser.Username, channels[0].Members[0].Username)
}

func TestExportGMChannel(t *testing.T) {
	th1 := Setup(t).InitBasic()

	user1 := th1.CreateUser()
	th1.LinkUserToTeam(user1, th1.BasicTeam)
	user2 := th1.CreateUser()
	th1.LinkUserToTeam(user2, th1.BasicTeam)

	// GM Channel
	th1.CreateGroupChannel(th1.Context, user1, user2)

	var b bytes.Buffer
	err := th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
	require.Nil(t, err)

	channels, nErr := th1.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(channels))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	channels, nErr = th2.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
	require.NoError(t, nErr)
	assert.Equal(t, 0, len(channels))
}

func TestExportGMandDMChannels(t *testing.T) {
	th1 := Setup(t).InitBasic()

	// DM Channel
	th1.CreateDmChannel(th1.BasicUser2)

	user1 := th1.CreateUser()
	th1.LinkUserToTeam(user1, th1.BasicTeam)
	user2 := th1.CreateUser()
	th1.LinkUserToTeam(user2, th1.BasicTeam)

	// GM Channel
	th1.CreateGroupChannel(th1.Context, user1, user2)

	var b bytes.Buffer
	err := th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
	require.Nil(t, err)

	channels, nErr := th1.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
	require.NoError(t, nErr)
	assert.Equal(t, 2, len(channels))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	channels, nErr = th2.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
	require.NoError(t, nErr)
	assert.Equal(t, 0, len(channels))

	// import the exported channel
	err, i := th2.App.BulkImport(th2.Context, &b, nil, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	// Ensure the Members of the imported GM channel is the same was from the exported
	channels, nErr = th2.App.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, "00000000", false)
	require.NoError(t, nErr)

	// Adding some determinism so its possible to assert on slice index
	sort.Slice(channels, func(i, j int) bool { return channels[i].Type > channels[j].Type })
	assert.Equal(t, 2, len(channels))
	assert.ElementsMatch(t, []string{th1.BasicUser.Username, user1.Username, user2.Username}, []string{channels[0].Members[0].Username, channels[0].Members[1].Username, channels[0].Members[2].Username})
	assert.ElementsMatch(t, []string{th1.BasicUser.Username, th1.BasicUser2.Username}, []string{channels[1].Members[0].Username, channels[1].Members[1].Username})
}

func TestExportDMandGMPost(t *testing.T) {
	th1 := Setup(t).InitBasic()

	// DM Channel
	dmChannel := th1.CreateDmChannel(th1.BasicUser2)
	dmMembers := []string{th1.BasicUser.Username, th1.BasicUser2.Username}

	user1 := th1.CreateUser()
	th1.LinkUserToTeam(user1, th1.BasicTeam)
	user2 := th1.CreateUser()
	th1.LinkUserToTeam(user2, th1.BasicTeam)

	// GM Channel
	gmChannel := th1.CreateGroupChannel(th1.Context, user1, user2)
	gmMembers := []string{th1.BasicUser.Username, user1.Username, user2.Username}

	// DM posts
	p1 := &model.Post{
		ChannelId: dmChannel.Id,
		Message:   "aa" + model.NewId() + "a",
		UserId:    th1.BasicUser.Id,
	}
	_, appErr := th1.App.CreatePost(th1.Context, p1, dmChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	p2 := &model.Post{
		ChannelId: dmChannel.Id,
		Message:   "bb" + model.NewId() + "a",
		UserId:    th1.BasicUser.Id,
	}
	_, appErr = th1.App.CreatePost(th1.Context, p2, dmChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	// GM posts
	p3 := &model.Post{
		ChannelId: gmChannel.Id,
		Message:   "cc" + model.NewId() + "a",
		UserId:    th1.BasicUser.Id,
	}
	_, appErr = th1.App.CreatePost(th1.Context, p3, gmChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	p4 := &model.Post{
		ChannelId: gmChannel.Id,
		Message:   "dd" + model.NewId() + "a",
		UserId:    th1.BasicUser.Id,
	}
	_, appErr = th1.App.CreatePost(th1.Context, p4, gmChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	posts, err := th1.App.Srv().Store().Post().GetDirectPostParentsForExportAfter(1000, "0000000", false)
	require.NoError(t, err)
	assert.Equal(t, 4, len(posts))

	var b bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
	require.Nil(t, appErr)

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	posts, err = th2.App.Srv().Store().Post().GetDirectPostParentsForExportAfter(1000, "0000000", false)
	require.NoError(t, err)
	assert.Equal(t, 0, len(posts))

	// import the exported posts
	appErr, i := th2.App.BulkImport(th2.Context, &b, nil, false, 5)
	assert.Nil(t, appErr)
	assert.Equal(t, 0, i)

	posts, err = th2.App.Srv().Store().Post().GetDirectPostParentsForExportAfter(1000, "0000000", false)
	require.NoError(t, err)

	// Adding some determinism so its possible to assert on slice index
	sort.Slice(posts, func(i, j int) bool { return posts[i].Message > posts[j].Message })
	assert.Equal(t, 4, len(posts))
	assert.ElementsMatch(t, gmMembers, *posts[0].ChannelMembers)
	assert.ElementsMatch(t, gmMembers, *posts[1].ChannelMembers)
	assert.ElementsMatch(t, dmMembers, *posts[2].ChannelMembers)
	assert.ElementsMatch(t, dmMembers, *posts[3].ChannelMembers)
}

func TestExportPostWithProps(t *testing.T) {
	th1 := Setup(t).InitBasic()

	attachments := []*model.SlackAttachment{{Footer: "footer"}}

	// DM Channel
	dmChannel := th1.CreateDmChannel(th1.BasicUser2)
	dmMembers := []string{th1.BasicUser.Username, th1.BasicUser2.Username}

	user1 := th1.CreateUser()
	th1.LinkUserToTeam(user1, th1.BasicTeam)
	user2 := th1.CreateUser()
	th1.LinkUserToTeam(user2, th1.BasicTeam)

	// GM Channel
	gmChannel := th1.CreateGroupChannel(th1.Context, user1, user2)
	gmMembers := []string{th1.BasicUser.Username, user1.Username, user2.Username}

	// DM posts
	p1 := &model.Post{
		ChannelId: dmChannel.Id,
		Message:   "aa" + model.NewId() + "a",
		Props: map[string]any{
			"attachments": attachments,
		},
		UserId: th1.BasicUser.Id,
	}
	_, appErr := th1.App.CreatePost(th1.Context, p1, dmChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	p2 := &model.Post{
		ChannelId: gmChannel.Id,
		Message:   "dd" + model.NewId() + "a",
		Props: map[string]any{
			"attachments": attachments,
		},
		UserId: th1.BasicUser.Id,
	}
	_, appErr = th1.App.CreatePost(th1.Context, p2, gmChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	posts, err := th1.App.Srv().Store().Post().GetDirectPostParentsForExportAfter(1000, "0000000", false)
	require.NoError(t, err)
	assert.Len(t, posts, 2)
	require.NotEmpty(t, posts[0].Props)
	require.NotEmpty(t, posts[1].Props)

	var b bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
	require.Nil(t, appErr)

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	posts, err = th2.App.Srv().Store().Post().GetDirectPostParentsForExportAfter(1000, "0000000", false)
	require.NoError(t, err)
	assert.Len(t, posts, 0)

	// import the exported posts
	appErr, i := th2.App.BulkImport(th2.Context, &b, nil, false, 5)
	assert.Nil(t, appErr)
	assert.Equal(t, 0, i)

	posts, err = th2.App.Srv().Store().Post().GetDirectPostParentsForExportAfter(1000, "0000000", false)
	require.NoError(t, err)

	// Adding some determinism so its possible to assert on slice index
	sort.Slice(posts, func(i, j int) bool { return posts[i].Message > posts[j].Message })
	assert.Len(t, posts, 2)
	assert.ElementsMatch(t, gmMembers, *posts[0].ChannelMembers)
	assert.ElementsMatch(t, dmMembers, *posts[1].ChannelMembers)
	assert.Contains(t, posts[0].Props["attachments"].([]any)[0], "footer")
	assert.Contains(t, posts[1].Props["attachments"].([]any)[0], "footer")
}

func TestExportUserCustomStatus(t *testing.T) {
	th1 := Setup(t).InitBasic()

	cs := &model.CustomStatus{
		Emoji:     "palm_tree",
		Text:      "on a vacation",
		Duration:  "this_week",
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	appErr := th1.App.SetCustomStatus(th1.Context, th1.BasicUser.Id, cs)
	require.Nil(t, appErr)

	uname := th1.BasicUser.Username

	var b bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
	require.Nil(t, appErr)

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	appErr, i := th2.App.BulkImport(th2.Context, &b, nil, false, 1)
	require.Nil(t, appErr)
	assert.Equal(t, 0, i)

	gotUser, err := th2.Server.Store().User().GetByUsername(uname)
	require.NoError(t, err)
	gotCs := gotUser.GetCustomStatus()
	require.Equal(t, cs.Emoji, gotCs.Emoji)
	require.Equal(t, cs.Text, gotCs.Text)
}

func TestExportDMPostWithSelf(t *testing.T) {
	th1 := Setup(t).InitBasic()

	// DM Channel with self (me channel)
	dmChannel := th1.CreateDmChannel(th1.BasicUser)

	th1.CreatePost(dmChannel)

	var b bytes.Buffer
	err := th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
	require.Nil(t, err)

	posts, nErr := th1.App.Srv().Store().Post().GetDirectPostParentsForExportAfter(1000, "0000000", false)
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(posts))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	posts, nErr = th2.App.Srv().Store().Post().GetDirectPostParentsForExportAfter(1000, "0000000", false)
	require.NoError(t, nErr)
	assert.Equal(t, 0, len(posts))

	// import the exported posts
	err, i := th2.App.BulkImport(th2.Context, &b, nil, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	posts, nErr = th2.App.Srv().Store().Post().GetDirectPostParentsForExportAfter(1000, "0000000", false)
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(posts))
	assert.Equal(t, 1, len((*posts[0].ChannelMembers)))
	assert.Equal(t, th1.BasicUser.Username, (*posts[0].ChannelMembers)[0])
}

func TestExportPostsWithThread(t *testing.T) {
	th1 := Setup(t).InitBasic()
	defer th1.TearDown()

	assertThreadFollowers := func(t *testing.T, b *bytes.Buffer, postCreateAt int64, userNames []string) {
		scanner := bufio.NewScanner(b)

		usersToAssert := make([]string, 0)

		for scanner.Scan() {
			var line imports.LineImportData
			err := json.Unmarshal(scanner.Bytes(), &line)
			require.NoError(t, err)

			switch line.Type {
			case "post":
				postLine := line.Post
				require.NotNil(t, postLine)

				if postLine.CreateAt != nil && *postLine.CreateAt != postCreateAt {
					continue
				}

				for _, follower := range *postLine.ThreadFollowers {
					if follower.User == nil {
						require.Fail(t, "follower.User is nil")
					}

					usersToAssert = append(usersToAssert, *follower.User)
				}
			case "direct_post":
				postLine := line.DirectPost
				require.NotNil(t, postLine)

				if postLine.CreateAt != nil && *postLine.CreateAt != postCreateAt {
					continue
				}

				for _, follower := range *postLine.ThreadFollowers {
					if follower.User == nil {
						require.Fail(t, "follower.User is nil")
					}

					usersToAssert = append(usersToAssert, *follower.User)
				}
			default:
				continue
			}
		}

		require.ElementsMatch(t, userNames, usersToAssert)
	}

	t.Run("Export thread followers for a thread (public channel)", func(t *testing.T) {
		thread := th1.CreatePost(th1.BasicChannel)
		_ = th1.CreatePostReply(thread)

		appErr := th1.App.UpdateThreadFollowForUser(th1.BasicUser2.Id, th1.BasicTeam.Id, thread.Id, true)
		require.Nil(t, appErr)

		member1, appErr := th1.App.GetThreadMembershipForUser(th1.BasicUser.Id, thread.Id)
		require.Nil(t, appErr)
		require.NotNil(t, member1)

		member2, appErr := th1.App.GetThreadMembershipForUser(th1.BasicUser2.Id, thread.Id)
		require.Nil(t, appErr)
		require.NotNil(t, member2)

		var b bytes.Buffer
		err := th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
		require.Nil(t, err)

		assertThreadFollowers(t, &b, thread.CreateAt, []string{th1.BasicUser.Username, th1.BasicUser2.Username})
	})

	t.Run("Export thread followers for a thread (direct messages)", func(t *testing.T) {
		dmc := th1.CreateDmChannel(th1.BasicUser2)

		thread := th1.CreatePost(dmc)
		_ = th1.CreatePostReply(thread)

		appErr := th1.App.UpdateThreadFollowForUser(th1.BasicUser2.Id, th1.BasicTeam.Id, thread.Id, true)
		require.Nil(t, appErr)

		member1, appErr := th1.App.GetThreadMembershipForUser(th1.BasicUser.Id, thread.Id)
		require.Nil(t, appErr)
		require.NotNil(t, member1)

		member2, appErr := th1.App.GetThreadMembershipForUser(th1.BasicUser2.Id, thread.Id)
		require.Nil(t, appErr)
		require.NotNil(t, member2)

		var b bytes.Buffer
		err := th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
		require.Nil(t, err)
		assertThreadFollowers(t, &b, thread.CreateAt, []string{th1.BasicUser.Username, th1.BasicUser2.Username})
	})
}

func TestBulkExport(t *testing.T) {
	th := Setup(t)
	testsDir, _ := fileutils.FindDir("tests")

	dir, err := os.MkdirTemp("", "import_test")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	extractImportFile := func(filePath string) *os.File {
		importFile, err2 := os.Open(filePath)
		require.NoError(t, err2)
		defer importFile.Close()

		info, err2 := importFile.Stat()
		require.NoError(t, err2)

		paths, err2 := utils.UnzipToPath(importFile, info.Size(), dir)
		require.NoError(t, err2)
		require.NotEmpty(t, paths)

		jsonFile, err2 := os.Open(filepath.Join(dir, "import.jsonl"))
		require.NoError(t, err2)

		return jsonFile
	}

	jsonFile := extractImportFile(filepath.Join(testsDir, "import_test.zip"))
	defer jsonFile.Close()

	appErr, _ := th.App.BulkImportWithPath(th.Context, jsonFile, nil, false, true, 1, dir)
	require.Nil(t, appErr)

	exportFile, err := os.Create(filepath.Join(dir, "export.zip"))
	require.NoError(t, err)
	defer exportFile.Close()

	opts := model.BulkExportOpts{
		IncludeAttachments: true,
		CreateArchive:      true,
	}
	appErr = th.App.BulkExport(th.Context, exportFile, dir, nil, opts)
	require.Nil(t, appErr)

	th.TearDown()
	th = Setup(t)
	defer th.TearDown()

	jsonFile = extractImportFile(filepath.Join(dir, "export.zip"))
	defer jsonFile.Close()

	appErr, _ = th.App.BulkImportWithPath(th.Context, jsonFile, nil, false, true, 1, filepath.Join(dir, "data"))
	require.Nil(t, appErr)
}

func TestBuildPostReplies(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	createPostWithAttachments := func(th *TestHelper, n int, rootID string) *model.Post {
		var fileIDs []string
		for i := 0; i < n; i++ {
			info, err := th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
				CreatorId: th.BasicUser.Id,
				Name:      fmt.Sprintf("file%d", i),
				Path:      fmt.Sprintf("/data/file%d", i),
			})
			require.NoError(t, err)
			fileIDs = append(fileIDs, info.Id)
		}

		post, err := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, RootId: rootID, FileIds: fileIDs}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		return post
	}

	t.Run("basic post", func(t *testing.T) {
		data, attachments, err := th.App.buildPostReplies(th.Context, th.BasicPost.Id, true)
		require.Nil(t, err)
		require.Empty(t, data)
		require.Empty(t, attachments)
	})

	t.Run("root post with attachments and no replies", func(t *testing.T) {
		post := createPostWithAttachments(th, 5, "")
		data, attachments, err := th.App.buildPostReplies(th.Context, post.Id, true)
		require.Nil(t, err)
		require.Empty(t, data)
		require.Empty(t, attachments)
	})

	t.Run("root post with attachments and a reply", func(t *testing.T) {
		post := createPostWithAttachments(th, 5, "")
		createPostWithAttachments(th, 0, post.Id)
		data, attachments, err := th.App.buildPostReplies(th.Context, post.Id, true)
		require.Nil(t, err)
		require.Len(t, data, 1)
		require.Empty(t, attachments)
	})

	t.Run("root post with attachments and multiple replies with attachments", func(t *testing.T) {
		post := createPostWithAttachments(th, 5, "")
		reply1 := createPostWithAttachments(th, 2, post.Id)
		reply2 := createPostWithAttachments(th, 3, post.Id)
		data, attachments, err := th.App.buildPostReplies(th.Context, post.Id, true)
		require.Nil(t, err)
		require.Len(t, data, 2)
		require.Len(t, attachments, 5)
		if reply1.Id < reply2.Id {
			require.Len(t, *data[0].Attachments, 2)
			require.Len(t, *data[1].Attachments, 3)
		} else {
			require.Len(t, *data[1].Attachments, 2)
			require.Len(t, *data[0].Attachments, 3)
		}
	})
}

func TestExportDeletedTeams(t *testing.T) {
	th1 := Setup(t).InitBasic()
	defer th1.TearDown()

	team1 := th1.CreateTeam()
	channel1 := th1.CreateChannel(th1.Context, team1)
	th1.CreatePost(channel1)

	// Delete the team to check that this is handled correctly on import.
	err := th1.App.SoftDeleteTeam(team1.Id)
	require.Nil(t, err)

	var b bytes.Buffer
	err = th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{})
	require.Nil(t, err)

	th2 := Setup(t)
	defer th2.TearDown()
	err, i := th2.App.BulkImport(th2.Context, &b, nil, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	teams1, err := th1.App.GetAllTeams()
	assert.Nil(t, err)
	teams2, err := th2.App.GetAllTeams()
	assert.Nil(t, err)
	assert.Equal(t, len(teams1), len(teams2))
	assert.ElementsMatch(t, teams1, teams2)

	channels1, err := th1.App.GetAllChannels(th1.Context, 0, 10, model.ChannelSearchOpts{})
	assert.Nil(t, err)
	channels2, err := th2.App.GetAllChannels(th1.Context, 0, 10, model.ChannelSearchOpts{})
	assert.Nil(t, err)
	assert.Equal(t, len(channels1), len(channels2))
	assert.ElementsMatch(t, channels1, channels2)
	for _, team := range teams2 {
		assert.NotContains(t, team.Name, team1.Name)
		assert.NotContains(t, team.Id, team1.Id)
	}
}

func TestExportArchivedChannels(t *testing.T) {
	th1 := Setup(t).InitBasic()
	defer th1.TearDown()

	archivedChannel := th1.CreateChannel(th1.Context, th1.BasicTeam)
	th1.CreatePost(archivedChannel)
	appErr := th1.App.DeleteChannel(th1.Context, archivedChannel, th1.SystemAdminUser.Id)
	require.Nil(t, appErr)

	var b bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &b, "somePath", nil, model.BulkExportOpts{
		IncludeArchivedChannels: true,
	})
	require.Nil(t, appErr)

	th2 := Setup(t)
	defer th2.TearDown()
	err, i := th2.App.BulkImport(th2.Context, &b, nil, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	channels2, err := th2.App.GetAllChannels(th1.Context, 0, 10, model.ChannelSearchOpts{
		IncludeDeleted: true,
	})
	assert.Nil(t, err)
	found := false
	for i := range channels2 {
		if channels2[i].Name == archivedChannel.Name {
			found = true
			break
		}
	}
	require.True(t, found, "archived channel not found after import")
}

func TestExportRoles(t *testing.T) {
	t.Run("defaults", func(t *testing.T) {
		th1 := Setup(t).InitBasic()
		defer th1.TearDown()

		var b bytes.Buffer
		appErr := th1.App.BulkExport(th1.Context, &b, "", nil, model.BulkExportOpts{})
		require.Nil(t, appErr)

		exportedRoles, appErr := th1.App.GetAllRoles()
		assert.Nil(t, appErr)
		assert.NotEmpty(t, exportedRoles)

		th2 := Setup(t)
		defer th2.TearDown()
		appErr, i := th2.App.BulkImport(th2.Context, &b, nil, false, 1)
		assert.Nil(t, appErr)
		assert.Equal(t, 0, i)

		importedRoles, appErr := th2.App.GetAllRoles()
		assert.Nil(t, appErr)
		assert.NotEmpty(t, importedRoles)

		require.Equal(t, len(exportedRoles), len(importedRoles))
	})

	t.Run("modified roles", func(t *testing.T) {
		th1 := Setup(t).InitBasic()
		defer th1.TearDown()

		exportedRole, appErr := th1.App.GetRoleByName(th1.Context.Context(), model.TeamUserRoleId)
		require.Nil(t, appErr)

		exportedRole.Permissions = exportedRole.Permissions[1:]

		_, appErr = th1.App.UpdateRole(exportedRole)
		require.Nil(t, appErr)

		var b bytes.Buffer
		appErr = th1.App.BulkExport(th1.Context, &b, "", nil, model.BulkExportOpts{
			IncludeRolesAndSchemes: true,
		})
		require.Nil(t, appErr)

		th2 := Setup(t)
		defer th2.TearDown()
		appErr, i := th2.App.BulkImport(th2.Context, &b, nil, false, 1)
		require.Nil(t, appErr)
		require.Equal(t, 0, i)

		importedRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), model.TeamUserRoleId)
		require.Nil(t, appErr)

		require.Equal(t, exportedRole.DisplayName, importedRole.DisplayName)
		require.Equal(t, exportedRole.Description, importedRole.Description)
		require.Equal(t, exportedRole.SchemeManaged, importedRole.SchemeManaged)
		require.Equal(t, exportedRole.BuiltIn, importedRole.BuiltIn)
		require.ElementsMatch(t, exportedRole.Permissions, importedRole.Permissions)
	})

	t.Run("custom roles", func(t *testing.T) {
		th1 := Setup(t).InitBasic()
		defer th1.TearDown()

		exportedRoles, appErr := th1.App.GetAllRoles()
		require.Nil(t, appErr)
		require.NotEmpty(t, exportedRoles)

		customRole, appErr := th1.App.CreateRole(&model.Role{
			Name:        "custom_role",
			DisplayName: "custom_role",
			Permissions: exportedRoles[0].Permissions,
		})
		require.Nil(t, appErr)

		var b bytes.Buffer
		appErr = th1.App.BulkExport(th1.Context, &b, "", nil, model.BulkExportOpts{
			IncludeRolesAndSchemes: true,
		})
		require.Nil(t, appErr)

		th2 := Setup(t)
		defer th2.TearDown()
		appErr, i := th2.App.BulkImport(th2.Context, &b, nil, false, 1)
		require.Nil(t, appErr)
		require.Equal(t, 0, i)

		importedCustomRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), customRole.Name)
		require.Nil(t, appErr)

		require.Equal(t, customRole.DisplayName, importedCustomRole.DisplayName)
		require.Equal(t, customRole.Description, importedCustomRole.Description)
		require.Equal(t, customRole.SchemeManaged, importedCustomRole.SchemeManaged)
		require.Equal(t, customRole.BuiltIn, importedCustomRole.BuiltIn)
		require.ElementsMatch(t, customRole.Permissions, importedCustomRole.Permissions)
	})
}

func TestExportSchemes(t *testing.T) {
	t.Run("no schemes", func(t *testing.T) {
		th1 := Setup(t).InitBasic()
		defer th1.TearDown()

		// Need to set this or working with schemes won't work until the job is
		// completed which is unnecessary for the purpose of this test.
		err := th1.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
		require.NoError(t, err)

		schemes, err := th1.App.Srv().Store().Scheme().GetAllPage(model.SchemeScopeChannel, 0, 1)
		require.NoError(t, err)
		require.Empty(t, schemes)

		schemes, err = th1.App.Srv().Store().Scheme().GetAllPage(model.SchemeScopeTeam, 0, 1)
		require.NoError(t, err)
		require.Empty(t, schemes)

		var b bytes.Buffer
		appErr := th1.App.BulkExport(th1.Context, &b, "", nil, model.BulkExportOpts{
			IncludeRolesAndSchemes: true,
		})
		require.Nil(t, appErr)

		// The following causes the original store to be wiped so from here on we are targeting the
		// second instance where the import will be loaded.
		th2 := Setup(t)
		defer th2.TearDown()
		err = th2.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
		require.NoError(t, err)

		appErr, i := th2.App.BulkImport(th2.Context, &b, nil, false, 1)
		require.Nil(t, appErr)
		require.Equal(t, 0, i)

		schemes, err = th2.App.Srv().Store().Scheme().GetAllPage(model.SchemeScopeChannel, 0, 1)
		require.NoError(t, err)
		require.Empty(t, schemes)

		schemes, err = th2.App.Srv().Store().Scheme().GetAllPage(model.SchemeScopeTeam, 0, 1)
		require.NoError(t, err)
		require.Empty(t, schemes)
	})

	t.Run("skip export", func(t *testing.T) {
		th1 := Setup(t).InitBasic()
		defer th1.TearDown()

		// Need to set this or working with schemes won't work until the job is
		// completed which is unnecessary for the purpose of this test.
		err := th1.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
		require.NoError(t, err)

		customScheme, appErr := th1.App.CreateScheme(&model.Scheme{
			Name:        "custom_scheme",
			DisplayName: "Custom Scheme",
			Scope:       model.SchemeScopeChannel,
		})
		require.Nil(t, appErr)

		var b bytes.Buffer
		appErr = th1.App.BulkExport(th1.Context, &b, "", nil, model.BulkExportOpts{})
		require.Nil(t, appErr)

		// The following causes the original store to be wiped so from here on we are targeting the
		// second instance where the import will be loaded.
		th2 := Setup(t)
		defer th2.TearDown()
		err = th2.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
		require.NoError(t, err)

		appErr, i := th2.App.BulkImport(th2.Context, &b, nil, false, 1)
		require.Nil(t, appErr)
		require.Equal(t, 0, i)

		// Verify the scheme doesn't exist which is the expectation as it wasn't exported.
		_, appErr = th2.App.GetScheme(customScheme.Name)
		require.NotNil(t, appErr)
	})

	t.Run("export channel scheme", func(t *testing.T) {
		th1 := Setup(t).InitBasic()
		defer th1.TearDown()

		// Need to set this or working with schemes won't work until the job is
		// completed which is unnecessary for the purpose of this test.
		err := th1.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
		require.NoError(t, err)

		builtInRoles := 23
		defaultChannelSchemeRoles := 3

		// Verify the roles count is expected prior to scheme creation.
		roles, appErr := th1.App.GetAllRoles()
		require.Nil(t, appErr)
		require.Len(t, roles, builtInRoles)

		customScheme, appErr := th1.App.CreateScheme(&model.Scheme{
			Name:        "custom_channel_scheme",
			DisplayName: "Custom Channel Scheme",
			Scope:       model.SchemeScopeChannel,
		})
		require.Nil(t, appErr)

		// Verify the roles count is expected after scheme creation.
		roles, appErr = th1.App.GetAllRoles()
		require.Nil(t, appErr)
		require.Len(t, roles, builtInRoles+defaultChannelSchemeRoles)

		// Fetch the scheme roles for later comparison
		customChannelAdminRole, appErr := th1.App.GetRoleByName(th1.Context.Context(), customScheme.DefaultChannelAdminRole)
		require.Nil(t, appErr)
		customChannelUserRole, appErr := th1.App.GetRoleByName(th1.Context.Context(), customScheme.DefaultChannelUserRole)
		require.Nil(t, appErr)
		customChannelGuestRole, appErr := th1.App.GetRoleByName(th1.Context.Context(), customScheme.DefaultChannelGuestRole)
		require.Nil(t, appErr)

		var b bytes.Buffer
		appErr = th1.App.BulkExport(th1.Context, &b, "", nil, model.BulkExportOpts{
			IncludeRolesAndSchemes: true,
		})
		require.Nil(t, appErr)

		// The following causes the original store to be wiped so from here on we are targeting the
		// second instance where the import will be loaded.
		th2 := Setup(t)
		defer th2.TearDown()
		err = th2.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
		require.NoError(t, err)

		// Verify roles count before importing is as expected.
		roles, appErr = th2.App.GetAllRoles()
		require.Nil(t, appErr)
		require.Len(t, roles, builtInRoles)

		appErr, i := th2.App.BulkImport(th2.Context, &b, nil, false, 1)
		require.Nil(t, appErr)
		require.Equal(t, 0, i)

		// Verify roles count after importing is as expected.
		roles, appErr = th2.App.GetAllRoles()
		require.Nil(t, appErr)
		require.Len(t, roles, builtInRoles+defaultChannelSchemeRoles)

		// Verify schemes match
		importedScheme, appErr := th2.App.GetSchemeByName(customScheme.Name)
		require.Nil(t, appErr)
		require.Equal(t, customScheme.Name, importedScheme.Name)
		require.Equal(t, customScheme.DisplayName, importedScheme.DisplayName)
		require.Equal(t, customScheme.Description, importedScheme.Description)
		require.Equal(t, customScheme.Scope, importedScheme.Scope)

		// Verify scheme roles match
		importedChannelAdminRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), importedScheme.DefaultChannelAdminRole)
		require.Nil(t, appErr)
		require.Equal(t, customChannelAdminRole.DisplayName, importedChannelAdminRole.DisplayName)
		require.Equal(t, customChannelAdminRole.Description, importedChannelAdminRole.Description)
		require.Equal(t, customChannelAdminRole.Permissions, importedChannelAdminRole.Permissions)
		require.Equal(t, customChannelAdminRole.SchemeManaged, importedChannelAdminRole.SchemeManaged)
		require.Equal(t, customChannelAdminRole.BuiltIn, importedChannelAdminRole.BuiltIn)

		importedChannelUserRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), importedScheme.DefaultChannelUserRole)
		require.Nil(t, appErr)
		require.Equal(t, customChannelUserRole.DisplayName, importedChannelUserRole.DisplayName)
		require.Equal(t, customChannelUserRole.Description, importedChannelUserRole.Description)
		require.Equal(t, customChannelUserRole.Permissions, importedChannelUserRole.Permissions)
		require.Equal(t, customChannelUserRole.SchemeManaged, importedChannelUserRole.SchemeManaged)
		require.Equal(t, customChannelUserRole.BuiltIn, importedChannelUserRole.BuiltIn)

		importedChannelGuestRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), importedScheme.DefaultChannelGuestRole)
		require.Nil(t, appErr)
		require.Equal(t, customChannelGuestRole.DisplayName, importedChannelGuestRole.DisplayName)
		require.Equal(t, customChannelGuestRole.Description, importedChannelGuestRole.Description)
		require.Equal(t, customChannelGuestRole.Permissions, importedChannelGuestRole.Permissions)
		require.Equal(t, customChannelGuestRole.SchemeManaged, importedChannelGuestRole.SchemeManaged)
		require.Equal(t, customChannelGuestRole.BuiltIn, importedChannelGuestRole.BuiltIn)
	})

	t.Run("export team scheme", func(t *testing.T) {
		th1 := Setup(t).InitBasic()
		defer th1.TearDown()

		// Need to set this or working with schemes won't work until the job is
		// completed which is unnecessary for the purpose of this test.
		err := th1.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
		require.NoError(t, err)

		builtInRoles := 23
		defaultTeamSchemeRoles := 10

		// Verify the roles count is expected prior to scheme creation.
		roles, appErr := th1.App.GetAllRoles()
		require.Nil(t, appErr)
		require.Len(t, roles, builtInRoles)

		customScheme, appErr := th1.App.CreateScheme(&model.Scheme{
			Name:        "custom_team_scheme",
			DisplayName: "Custom Team Scheme",
			Scope:       model.SchemeScopeTeam,
		})
		require.Nil(t, appErr)

		// Verify the roles count is expected after scheme creation.
		roles, appErr = th1.App.GetAllRoles()
		require.Nil(t, appErr)
		require.Len(t, roles, builtInRoles+defaultTeamSchemeRoles)

		customChannelAdminRole, appErr := th1.App.GetRoleByName(th1.Context.Context(), customScheme.DefaultChannelAdminRole)
		require.Nil(t, appErr)

		customChannelUserRole, appErr := th1.App.GetRoleByName(th1.Context.Context(), customScheme.DefaultChannelUserRole)
		require.Nil(t, appErr)

		customChannelGuestRole, appErr := th1.App.GetRoleByName(th1.Context.Context(), customScheme.DefaultChannelGuestRole)
		require.Nil(t, appErr)

		customTeamAdminRole, appErr := th1.App.GetRoleByName(th1.Context.Context(), customScheme.DefaultTeamAdminRole)
		require.Nil(t, appErr)

		customTeamUserRole, appErr := th1.App.GetRoleByName(th1.Context.Context(), customScheme.DefaultTeamUserRole)
		require.Nil(t, appErr)

		customTeamGuestRole, appErr := th1.App.GetRoleByName(th1.Context.Context(), customScheme.DefaultTeamGuestRole)
		require.Nil(t, appErr)

		var b bytes.Buffer
		appErr = th1.App.BulkExport(th1.Context, &b, "", nil, model.BulkExportOpts{
			IncludeRolesAndSchemes: true,
		})
		require.Nil(t, appErr)

		// The following causes the original store to be wiped so from here on we are targeting the
		// second instance where the import will be loaded.
		th2 := Setup(t)
		defer th2.TearDown()
		err = th2.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
		require.NoError(t, err)

		// Verify roles count before importing is as expected.
		roles, appErr = th2.App.GetAllRoles()
		require.Nil(t, appErr)
		require.Len(t, roles, builtInRoles)

		appErr, i := th2.App.BulkImport(th2.Context, &b, nil, false, 1)
		require.Nil(t, appErr)
		require.Equal(t, 0, i)

		// Verify roles count after importing is as expected.
		roles, appErr = th2.App.GetAllRoles()
		require.Nil(t, appErr)
		require.Len(t, roles, builtInRoles+defaultTeamSchemeRoles)

		// Verify schemes match
		importedScheme, appErr := th2.App.GetSchemeByName(customScheme.Name)
		require.Nil(t, appErr)
		require.Equal(t, customScheme.Name, importedScheme.Name)
		require.Equal(t, customScheme.DisplayName, importedScheme.DisplayName)
		require.Equal(t, customScheme.Description, importedScheme.Description)
		require.Equal(t, customScheme.Scope, importedScheme.Scope)

		// Verify scheme roles match
		importedChannelAdminRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), importedScheme.DefaultChannelAdminRole)
		require.Nil(t, appErr)
		require.Equal(t, customChannelAdminRole.DisplayName, importedChannelAdminRole.DisplayName)
		require.Equal(t, customChannelAdminRole.Description, importedChannelAdminRole.Description)
		require.Equal(t, customChannelAdminRole.Permissions, importedChannelAdminRole.Permissions)
		require.Equal(t, customChannelAdminRole.SchemeManaged, importedChannelAdminRole.SchemeManaged)
		require.Equal(t, customChannelAdminRole.BuiltIn, importedChannelAdminRole.BuiltIn)

		importedChannelUserRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), importedScheme.DefaultChannelUserRole)
		require.Nil(t, appErr)
		require.Equal(t, customChannelUserRole.DisplayName, importedChannelUserRole.DisplayName)
		require.Equal(t, customChannelUserRole.Description, importedChannelUserRole.Description)
		require.Equal(t, customChannelUserRole.Permissions, importedChannelUserRole.Permissions)
		require.Equal(t, customChannelUserRole.SchemeManaged, importedChannelUserRole.SchemeManaged)
		require.Equal(t, customChannelUserRole.BuiltIn, importedChannelUserRole.BuiltIn)

		importedChannelGuestRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), importedScheme.DefaultChannelGuestRole)
		require.Nil(t, appErr)
		require.Equal(t, customChannelGuestRole.DisplayName, importedChannelGuestRole.DisplayName)
		require.Equal(t, customChannelGuestRole.Description, importedChannelGuestRole.Description)
		require.Equal(t, customChannelGuestRole.Permissions, importedChannelGuestRole.Permissions)
		require.Equal(t, customChannelGuestRole.SchemeManaged, importedChannelGuestRole.SchemeManaged)
		require.Equal(t, customChannelGuestRole.BuiltIn, importedChannelGuestRole.BuiltIn)

		importedTeamAdminRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), importedScheme.DefaultTeamAdminRole)
		require.Nil(t, appErr)
		require.Equal(t, customTeamAdminRole.DisplayName, importedTeamAdminRole.DisplayName)
		require.Equal(t, customTeamAdminRole.Description, importedTeamAdminRole.Description)
		require.Equal(t, customTeamAdminRole.Permissions, importedTeamAdminRole.Permissions)
		require.Equal(t, customTeamAdminRole.SchemeManaged, importedTeamAdminRole.SchemeManaged)
		require.Equal(t, customTeamAdminRole.BuiltIn, importedTeamAdminRole.BuiltIn)

		importedTeamUserRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), importedScheme.DefaultTeamUserRole)
		require.Nil(t, appErr)
		require.Equal(t, customTeamUserRole.DisplayName, importedTeamUserRole.DisplayName)
		require.Equal(t, customTeamUserRole.Description, importedTeamUserRole.Description)
		require.Equal(t, customTeamUserRole.Permissions, importedTeamUserRole.Permissions)
		require.Equal(t, customTeamUserRole.SchemeManaged, importedTeamUserRole.SchemeManaged)
		require.Equal(t, customTeamUserRole.BuiltIn, importedTeamUserRole.BuiltIn)

		importedTeamGuestRole, appErr := th2.App.GetRoleByName(th2.Context.Context(), importedScheme.DefaultTeamGuestRole)
		require.Nil(t, appErr)
		require.Equal(t, customTeamGuestRole.DisplayName, importedTeamGuestRole.DisplayName)
		require.Equal(t, customTeamGuestRole.Description, importedTeamGuestRole.Description)
		require.Equal(t, customTeamGuestRole.Permissions, importedTeamGuestRole.Permissions)
		require.Equal(t, customTeamGuestRole.SchemeManaged, importedTeamGuestRole.SchemeManaged)
		require.Equal(t, customTeamGuestRole.BuiltIn, importedTeamGuestRole.BuiltIn)
	})
}
