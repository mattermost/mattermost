package app

import (
	"bytes"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestReactionsOfPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	post := th.BasicPost
	post.HasReactions = true

	reactionObject := model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    post.Id,
		EmojiName: "emoji",
		CreateAt:  model.GetMillis(),
	}

	th.App.SaveReactionForPost(&reactionObject)
	reactionsOfPost, err := th.App.BuildPostReactions(post.Id)
	require.Nil(t, err)

	assert.Equal(t, reactionObject.EmojiName, *(*reactionsOfPost)[0].EmojiName)
}

func TestExportUserNotifyProps(t *testing.T) {

	th := Setup().InitBasic()
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
	th := Setup().InitBasic()
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
	store.Must(th.App.Srv.Store.Preference().Save(&preferences))
	th.App.UpdateChannelMemberNotifyProps(notifyProps, channel.Id, user.Id)
	exportData, err := th.App.buildUserChannelMemberships(user.Id, team.Id)
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
	th := Setup().InitBasic()
	defer th.TearDown()

	pathToDir := th.App.createDirForEmoji("test.json", "exported_emoji_test")
	defer os.Remove(pathToDir)
	if _, err := os.Stat(pathToDir); os.IsNotExist(err) {
		t.Fatal("Directory exported_emoji_test should exist")
	}
}

func TestCopyEmojiImages(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	emoji := &model.Emoji{
		Id: th.BasicUser.Id,
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
	if copyError != nil {
		t.Fatal(copyError)
	}

	if _, err := os.Stat(pathToDir + "/" + emoji.Id + "/image"); os.IsNotExist(err) {
		t.Fatal("File should exist ", err)
	}
}

func TestExportCustomEmoji(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	filePath := "../demo.json"

	fileWriter, err := os.Create(filePath)
	require.Nil(t, err)
	defer os.Remove(filePath)

	pathToEmojiDir := "../data/emoji/"
	dirNameToExportEmoji := "exported_emoji_test"
	defer os.RemoveAll("../" + dirNameToExportEmoji)

	if err := th.App.ExportCustomEmoji(fileWriter, filePath, pathToEmojiDir, dirNameToExportEmoji); err != nil {
		t.Fatal(err)
	}
}

func TestExportAllUsers(t *testing.T) {
	th1 := Setup().InitBasic()
	defer th1.TearDown()

	var b bytes.Buffer
	err := th1.App.BulkExport(&b, "somefile", "somePath", "someDir")
	require.Nil(t, err)

	th2 := Setup()
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
}
