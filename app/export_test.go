// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
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
		EmojiName: "emoji",
		CreateAt:  model.GetMillis(),
	}
	reactionObjectDeleted := model.Reaction{
		UserId:    th.BasicUser2.Id,
		PostId:    post.Id,
		EmojiName: "emoji",
		CreateAt:  model.GetMillis(),
	}

	th.App.SaveReactionForPost(&reactionObject)
	th.App.SaveReactionForPost(&reactionObjectDeleted)
	reactionsOfPost, err := th.App.BuildPostReactions(post.Id)
	require.Nil(t, err)

	assert.Equal(t, reactionObject.EmojiName, *(*reactionsOfPost)[0].EmojiName)
}

func TestExportUserNotifyProps(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

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

	exportNotifyProps := th.App.buildUserNotifyProps(userNotifyProps)

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
	th := Setup(t).InitBasic()
	defer th.TearDown()
	channel := th.BasicChannel
	user := th.BasicUser
	team := th.BasicTeam
	channelName := channel.Name
	notifyProps := model.StringMap{
		model.DESKTOP_NOTIFY_PROP: model.USER_NOTIFY_ALL,
		model.PUSH_NOTIFY_PROP:    model.USER_NOTIFY_NONE,
	}
	preference := model.Preference{
		UserId:   user.Id,
		Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
		Name:     channel.Id,
		Value:    "true",
	}
	var preferences model.Preferences
	preferences = append(preferences, preference)
	err := th.App.Srv().Store.Preference().Save(&preferences)
	require.NoError(t, err)

	th.App.UpdateChannelMemberNotifyProps(notifyProps, channel.Id, user.Id)
	exportData, appErr := th.App.buildUserChannelMemberships(user.Id, team.Id)
	require.Nil(t, appErr)
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

func TestCopyEmojiImages(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

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

	_, appErr := th.App.exportCustomEmoji(fileWriter, outPath, dirNameToExportEmoji, false)
	require.Nil(t, appErr, "should not have failed")
}

func TestExportAllUsers(t *testing.T) {
	th1 := Setup(t)
	defer th1.TearDown()

	// Adding a user and deactivating it to check whether it gets included in bulk export
	user := th1.CreateUser()
	_, err := th1.App.UpdateActive(user, false)
	require.Nil(t, err)

	var b bytes.Buffer
	err = th1.App.BulkExport(&b, "somePath", BulkExportOpts{})
	require.Nil(t, err)

	th2 := Setup(t)
	defer th2.TearDown()
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	users1, err := th1.App.GetUsers(&model.UserGetOptions{
		Page:    0,
		PerPage: 10,
	})
	assert.Nil(t, err)
	users2, err := th2.App.GetUsers(&model.UserGetOptions{
		Page:    0,
		PerPage: 10,
	})
	assert.Nil(t, err)
	assert.Equal(t, len(users1), len(users2))
	assert.ElementsMatch(t, users1, users2)

	// Checking whether deactivated users were included in bulk export
	deletedUsers1, err := th1.App.GetUsers(&model.UserGetOptions{
		Inactive: true,
		Page:     0,
		PerPage:  10,
	})
	assert.Nil(t, err)
	deletedUsers2, err := th1.App.GetUsers(&model.UserGetOptions{
		Inactive: true,
		Page:     0,
		PerPage:  10,
	})
	assert.Nil(t, err)
	assert.Equal(t, len(deletedUsers1), len(deletedUsers2))
	assert.ElementsMatch(t, deletedUsers1, deletedUsers2)
}

func TestExportDMChannel(t *testing.T) {
	th1 := Setup(t).InitBasic()

	// DM Channel
	th1.CreateDmChannel(th1.BasicUser2)

	var b bytes.Buffer
	err := th1.App.BulkExport(&b, "somePath", BulkExportOpts{})
	require.Nil(t, err)

	channels, nErr := th1.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(channels))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	channels, nErr = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.NoError(t, nErr)
	assert.Equal(t, 0, len(channels))

	// import the exported channel
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	// Ensure the Members of the imported DM channel is the same was from the exported
	channels, nErr = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(channels))
	assert.ElementsMatch(t, []string{th1.BasicUser.Username, th1.BasicUser2.Username}, *channels[0].Members)
}

func TestExportDMChannelToSelf(t *testing.T) {
	th1 := Setup(t).InitBasic()
	defer th1.TearDown()

	// DM Channel with self (me channel)
	th1.CreateDmChannel(th1.BasicUser)

	var b bytes.Buffer
	err := th1.App.BulkExport(&b, "somePath", BulkExportOpts{})
	require.Nil(t, err)

	channels, nErr := th1.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(channels))

	th2 := Setup(t)
	defer th2.TearDown()

	channels, nErr = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.NoError(t, nErr)
	assert.Equal(t, 0, len(channels))

	// import the exported channel
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	channels, nErr = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(channels))
	assert.Equal(t, 1, len((*channels[0].Members)))
	assert.Equal(t, th1.BasicUser.Username, (*channels[0].Members)[0])
}

func TestExportGMChannel(t *testing.T) {
	th1 := Setup(t).InitBasic()

	user1 := th1.CreateUser()
	th1.LinkUserToTeam(user1, th1.BasicTeam)
	user2 := th1.CreateUser()
	th1.LinkUserToTeam(user2, th1.BasicTeam)

	// GM Channel
	th1.CreateGroupChannel(user1, user2)

	var b bytes.Buffer
	err := th1.App.BulkExport(&b, "somePath", BulkExportOpts{})
	require.Nil(t, err)

	channels, nErr := th1.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(channels))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	channels, nErr = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
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
	th1.CreateGroupChannel(user1, user2)

	var b bytes.Buffer
	err := th1.App.BulkExport(&b, "somePath", BulkExportOpts{})
	require.Nil(t, err)

	channels, nErr := th1.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.NoError(t, nErr)
	assert.Equal(t, 2, len(channels))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	channels, nErr = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.NoError(t, nErr)
	assert.Equal(t, 0, len(channels))

	// import the exported channel
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	// Ensure the Members of the imported GM channel is the same was from the exported
	channels, nErr = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.NoError(t, nErr)

	// Adding some deteminism so its possible to assert on slice index
	sort.Slice(channels, func(i, j int) bool { return channels[i].Type > channels[j].Type })
	assert.Equal(t, 2, len(channels))
	assert.ElementsMatch(t, []string{th1.BasicUser.Username, user1.Username, user2.Username}, *channels[0].Members)
	assert.ElementsMatch(t, []string{th1.BasicUser.Username, th1.BasicUser2.Username}, *channels[1].Members)
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
	gmChannel := th1.CreateGroupChannel(user1, user2)
	gmMembers := []string{th1.BasicUser.Username, user1.Username, user2.Username}

	// DM posts
	p1 := &model.Post{
		ChannelId: dmChannel.Id,
		Message:   "aa" + model.NewId() + "a",
		UserId:    th1.BasicUser.Id,
	}
	th1.App.CreatePost(p1, dmChannel, false, true)

	p2 := &model.Post{
		ChannelId: dmChannel.Id,
		Message:   "bb" + model.NewId() + "a",
		UserId:    th1.BasicUser.Id,
	}
	th1.App.CreatePost(p2, dmChannel, false, true)

	// GM posts
	p3 := &model.Post{
		ChannelId: gmChannel.Id,
		Message:   "cc" + model.NewId() + "a",
		UserId:    th1.BasicUser.Id,
	}
	th1.App.CreatePost(p3, gmChannel, false, true)

	p4 := &model.Post{
		ChannelId: gmChannel.Id,
		Message:   "dd" + model.NewId() + "a",
		UserId:    th1.BasicUser.Id,
	}
	th1.App.CreatePost(p4, gmChannel, false, true)

	posts, err := th1.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.NoError(t, err)
	assert.Equal(t, 4, len(posts))

	var b bytes.Buffer
	appErr := th1.App.BulkExport(&b, "somePath", BulkExportOpts{})
	require.Nil(t, appErr)

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	posts, err = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.NoError(t, err)
	assert.Equal(t, 0, len(posts))

	// import the exported posts
	appErr, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, appErr)
	assert.Equal(t, 0, i)

	posts, err = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.NoError(t, err)

	// Adding some deteminism so its possible to assert on slice index
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
	gmChannel := th1.CreateGroupChannel(user1, user2)
	gmMembers := []string{th1.BasicUser.Username, user1.Username, user2.Username}

	// DM posts
	p1 := &model.Post{
		ChannelId: dmChannel.Id,
		Message:   "aa" + model.NewId() + "a",
		Props: map[string]interface{}{
			"attachments": attachments,
		},
		UserId: th1.BasicUser.Id,
	}
	th1.App.CreatePost(p1, dmChannel, false, true)

	p2 := &model.Post{
		ChannelId: gmChannel.Id,
		Message:   "dd" + model.NewId() + "a",
		Props: map[string]interface{}{
			"attachments": attachments,
		},
		UserId: th1.BasicUser.Id,
	}
	th1.App.CreatePost(p2, gmChannel, false, true)

	posts, err := th1.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.NoError(t, err)
	assert.Len(t, posts, 2)
	require.NotEmpty(t, posts[0].Props)
	require.NotEmpty(t, posts[1].Props)

	var b bytes.Buffer
	appErr := th1.App.BulkExport(&b, "somePath", BulkExportOpts{})
	require.Nil(t, appErr)

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	posts, err = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.NoError(t, err)
	assert.Len(t, posts, 0)

	// import the exported posts
	appErr, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, appErr)
	assert.Equal(t, 0, i)

	posts, err = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.NoError(t, err)

	// Adding some determinism so its possible to assert on slice index
	sort.Slice(posts, func(i, j int) bool { return posts[i].Message > posts[j].Message })
	assert.Len(t, posts, 2)
	assert.ElementsMatch(t, gmMembers, *posts[0].ChannelMembers)
	assert.ElementsMatch(t, dmMembers, *posts[1].ChannelMembers)
	assert.Contains(t, posts[0].Props["attachments"].([]interface{})[0], "footer")
	assert.Contains(t, posts[1].Props["attachments"].([]interface{})[0], "footer")
}

func TestExportDMPostWithSelf(t *testing.T) {
	th1 := Setup(t).InitBasic()

	// DM Channel with self (me channel)
	dmChannel := th1.CreateDmChannel(th1.BasicUser)

	th1.CreatePost(dmChannel)

	var b bytes.Buffer
	err := th1.App.BulkExport(&b, "somePath", BulkExportOpts{})
	require.Nil(t, err)

	posts, nErr := th1.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(posts))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	posts, nErr = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.NoError(t, nErr)
	assert.Equal(t, 0, len(posts))

	// import the exported posts
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	posts, nErr = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.NoError(t, nErr)
	assert.Equal(t, 1, len(posts))
	assert.Equal(t, 1, len((*posts[0].ChannelMembers)))
	assert.Equal(t, th1.BasicUser.Username, (*posts[0].ChannelMembers)[0])
}

func TestBulkExport(t *testing.T) {
	th := Setup(t)
	testsDir, _ := fileutils.FindDir("tests")

	dir, err := ioutil.TempDir("", "import_test")
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

	appErr, _ := th.App.BulkImportWithPath(jsonFile, false, 1, dir)
	require.Nil(t, appErr)

	exportFile, err := os.Create(filepath.Join(dir, "export.zip"))
	require.NoError(t, err)
	defer exportFile.Close()

	opts := BulkExportOpts{
		IncludeAttachments: true,
		CreateArchive:      true,
	}
	appErr = th.App.BulkExport(exportFile, dir, opts)
	require.Nil(t, appErr)

	th.TearDown()
	th = Setup(t)
	defer th.TearDown()

	jsonFile = extractImportFile(filepath.Join(dir, "export.zip"))
	defer jsonFile.Close()

	appErr, _ = th.App.BulkImportWithPath(jsonFile, false, 1, filepath.Join(dir, "data"))
	require.Nil(t, appErr)
}
