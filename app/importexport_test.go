package app

import (
	"bytes"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

func TestImportBulkImport(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	teamName := model.NewRandomTeamName()
	channelName := model.NewId()
	username := model.NewId()
	username2 := model.NewId()
	username3 := model.NewId()
	emojiName := model.NewId()
	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	teamTheme1 := `{\"awayIndicator\":\"#DBBD4E\",\"buttonBg\":\"#23A1FF\",\"buttonColor\":\"#FFFFFF\",\"centerChannelBg\":\"#ffffff\",\"centerChannelColor\":\"#333333\",\"codeTheme\":\"github\",\"image\":\"/static/files/a4a388b38b32678e83823ef1b3e17766.png\",\"linkColor\":\"#2389d7\",\"mentionBg\":\"#2389d7\",\"mentionColor\":\"#ffffff\",\"mentionHighlightBg\":\"#fff2bb\",\"mentionHighlightLink\":\"#2f81b7\",\"newMessageSeparator\":\"#FF8800\",\"onlineIndicator\":\"#7DBE00\",\"sidebarBg\":\"#fafafa\",\"sidebarHeaderBg\":\"#3481B9\",\"sidebarHeaderTextColor\":\"#ffffff\",\"sidebarText\":\"#333333\",\"sidebarTextActiveBorder\":\"#378FD2\",\"sidebarTextActiveColor\":\"#111111\",\"sidebarTextHoverBg\":\"#e6f2fa\",\"sidebarUnreadText\":\"#333333\",\"type\":\"Mattermost\"}`
	teamTheme2 := `{\"awayIndicator\":\"#DBBD4E\",\"buttonBg\":\"#23A100\",\"buttonColor\":\"#EEEEEE\",\"centerChannelBg\":\"#ffffff\",\"centerChannelColor\":\"#333333\",\"codeTheme\":\"github\",\"image\":\"/static/files/a4a388b38b32678e83823ef1b3e17766.png\",\"linkColor\":\"#2389d7\",\"mentionBg\":\"#2389d7\",\"mentionColor\":\"#ffffff\",\"mentionHighlightBg\":\"#fff2bb\",\"mentionHighlightLink\":\"#2f81b7\",\"newMessageSeparator\":\"#FF8800\",\"onlineIndicator\":\"#7DBE00\",\"sidebarBg\":\"#fafafa\",\"sidebarHeaderBg\":\"#3481B9\",\"sidebarHeaderTextColor\":\"#ffffff\",\"sidebarText\":\"#333333\",\"sidebarTextActiveBorder\":\"#378FD2\",\"sidebarTextActiveColor\":\"#222222\",\"sidebarTextHoverBg\":\"#e6f2fa\",\"sidebarUnreadText\":\"#444444\",\"type\":\"Mattermost\"}`

	// Run bulk import with a valid 1 of everything.
	data1 := `{"type": "version", "version": 1}
{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "` + username + `", "email": "` + username + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme1 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username2 + `", "email": "` + username2 + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme2 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username3 + `", "email": "` + username3 + `@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}], "delete_at": 123456789016}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username + `", "message": "Hello World", "create_at": 123456789012, "attachments":[{"path": "` + testImage + `"}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username3 + `", "message": "Hey Everyone!", "create_at": 123456789013, "attachments":[{"path": "` + testImage + `"}]}}
{"type": "direct_channel", "direct_channel": {"members": ["` + username + `", "` + username + `"]}}
{"type": "direct_channel", "direct_channel": {"members": ["` + username + `", "` + username2 + `"]}}
{"type": "direct_channel", "direct_channel": {"members": ["` + username + `", "` + username2 + `", "` + username3 + `"]}}
{"type": "direct_post", "direct_post": {"channel_members": ["` + username + `", "` + username + `"], "user": "` + username + `", "message": "Hello Direct Channel to myself", "create_at": 123456789014}}
{"type": "direct_post", "direct_post": {"channel_members": ["` + username + `", "` + username2 + `"], "user": "` + username + `", "message": "Hello Direct Channel", "create_at": 123456789014}}
{"type": "direct_post", "direct_post": {"channel_members": ["` + username + `", "` + username2 + `", "` + username3 + `"], "user": "` + username + `", "message": "Hello Group Channel", "create_at": 123456789015}}
{"type": "emoji", "emoji": {"name": "` + emojiName + `", "image": "` + testImage + `"}}`

	err, line := th.App.BulkImport(strings.NewReader(data1), false, 2)
	require.Nil(t, err, "BulkImport should have succeeded")
	require.Equal(t, 0, line, "BulkImport line should be 0")

	// Run bulk import using a string that contains a line with invalid json.
	data2 := `{"type": "version", "version": 1`
	err, line = th.App.BulkImport(strings.NewReader(data2), false, 2)
	require.NotNil(t, err, "Should have failed due to invalid JSON on line 1.")
	require.Equal(t, 1, line, "Should have failed due to invalid JSON on line 1.")

	// Run bulk import using valid JSON but missing version line at the start.
	data3 := `{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "kufjgnkxkrhhfgbrip6qxkfsaa", "email": "kufjgnkxkrhhfgbrip6qxkfsaa@example.com"}}
{"type": "user", "user": {"username": "bwshaim6qnc2ne7oqkd5b2s2rq", "email": "bwshaim6qnc2ne7oqkd5b2s2rq@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}]}]}}`
	err, line = th.App.BulkImport(strings.NewReader(data3), false, 2)
	require.NotNil(t, err, "Should have failed due to missing version line on line 1.")
	require.Equal(t, 1, line, "Should have failed due to missing version line on line 1.")

	// Run bulk import using a valid and large input and a \r\n line break.
	t.Run("", func(t *testing.T) {
		posts := `{"type": "post"` + strings.Repeat(`, "post": {"team": "`+teamName+`", "channel": "`+channelName+`", "user": "`+username+`", "message": "Repeat after me", "create_at": 193456789012}`, 1E4) + "}"
		data4 := `{"type": "version", "version": 1}
{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "` + username + `", "email": "` + username + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme1 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username + `", "message": "Hello World", "create_at": 123456789012}}`
		err, line = th.App.BulkImport(strings.NewReader(data4+"\r\n"+posts), false, 2)
		require.Nil(t, err, "BulkImport should have succeeded")
		require.Equal(t, 0, line, "BulkImport line should be 0")
	})

	t.Run("First item after version without type", func(t *testing.T) {
		data := `{"type": "version", "version": 1}
{"name": "custom-emoji-troll", "image": "bulkdata/emoji/trollolol.png"}`
		err, line := th.App.BulkImport(strings.NewReader(data), false, 2)
		require.NotNil(t, err, "Should have failed due to invalid type on line 2.")
		require.Equal(t, 2, line, "Should have failed due to invalid type on line 2.")
	})

	t.Run("Posts with prop information", func(t *testing.T) {
		data6 := `{"type": "version", "version": 1}
{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "` + username + `", "email": "` + username + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme1 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username + `", "message": "Hello World", "create_at": 123456789012, "attachments":[{"path": "` + testImage + `"}], "props":{"attachments":[{"id":0,"fallback":"[February 4th, 2020 2:46 PM] author: fallback","color":"D0D0D0","pretext":"","author_name":"author","author_link":"","title":"","title_link":"","text":"this post has props","fields":null,"image_url":"","thumb_url":"","footer":"Posted in #general","footer_icon":"","ts":"1580823992.000100"}]}}}
{"type": "direct_channel", "direct_channel": {"members": ["` + username + `", "` + username + `"]}}
{"type": "direct_post", "direct_post": {"channel_members": ["` + username + `", "` + username + `"], "user": "` + username + `", "message": "Hello Direct Channel to myself", "create_at": 123456789014, "props":{"attachments":[{"id":0,"fallback":"[February 4th, 2020 2:46 PM] author: fallback","color":"D0D0D0","pretext":"","author_name":"author","author_link":"","title":"","title_link":"","text":"this post has props","fields":null,"image_url":"","thumb_url":"","footer":"Posted in #general","footer_icon":"","ts":"1580823992.000100"}]}}}}`

		err, line := th.App.BulkImport(strings.NewReader(data6), false, 2)
		require.Nil(t, err, "BulkImport should have succeeded")
		require.Equal(t, 0, line, "BulkImport line should be 0")
	})
}

func TestExportAllUsers(t *testing.T) {
	th1 := Setup(t)
	defer th1.TearDown()

	// Adding a user and deactivating it to check whether it gets included in bulk export
	user := th1.CreateUser()
	_, err := th1.App.UpdateActive(user, false)
	require.Nil(t, err)

	var b bytes.Buffer
	err = th1.App.BulkExport(&b, "somefile", "somePath", "someDir")
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
	err := th1.App.BulkExport(&b, "somefile", "somePath", "someDir")
	require.Nil(t, err)

	channels, err := th1.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)
	assert.Equal(t, 1, len(channels))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	channels, err = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)
	assert.Equal(t, 0, len(channels))

	// import the exported channel
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	// Ensure the Members of the imported DM channel is the same was from the exported
	channels, err = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)
	assert.Equal(t, 1, len(channels))
	assert.ElementsMatch(t, []string{th1.BasicUser.Username, th1.BasicUser2.Username}, *channels[0].Members)
}

func TestExportDMChannelToSelf(t *testing.T) {
	th1 := Setup(t).InitBasic()
	defer th1.TearDown()

	// DM Channel with self (me channel)
	th1.CreateDmChannel(th1.BasicUser)

	var b bytes.Buffer
	err := th1.App.BulkExport(&b, "somefile", "somePath", "someDir")
	require.Nil(t, err)

	channels, err := th1.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)
	assert.Equal(t, 1, len(channels))

	th2 := Setup(t)
	defer th2.TearDown()

	channels, err = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)
	assert.Equal(t, 0, len(channels))

	// import the exported channel
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	channels, err = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)
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
	err := th1.App.BulkExport(&b, "somefile", "somePath", "someDir")
	require.Nil(t, err)

	channels, err := th1.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)
	assert.Equal(t, 1, len(channels))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	channels, err = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)
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
	err := th1.App.BulkExport(&b, "somefile", "somePath", "someDir")
	require.Nil(t, err)

	channels, err := th1.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)
	assert.Equal(t, 2, len(channels))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	channels, err = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)
	assert.Equal(t, 0, len(channels))

	// import the exported channel
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	// Ensure the Members of the imported GM channel is the same was from the exported
	channels, err = th2.App.Srv().Store.Channel().GetAllDirectChannelsForExportAfter(1000, "00000000")
	require.Nil(t, err)

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
	require.Nil(t, err)
	assert.Equal(t, 4, len(posts))

	var b bytes.Buffer
	err = th1.App.BulkExport(&b, "somefile", "somePath", "someDir")
	require.Nil(t, err)

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	posts, err = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.Nil(t, err)
	assert.Equal(t, 0, len(posts))

	// import the exported posts
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	posts, err = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.Nil(t, err)

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
	require.Nil(t, err)
	assert.Len(t, posts, 2)
	require.NotEmpty(t, posts[0].Props)
	require.NotEmpty(t, posts[1].Props)

	var b bytes.Buffer
	err = th1.App.BulkExport(&b, "somefile", "somePath", "someDir")
	require.Nil(t, err)

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	posts, err = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.Nil(t, err)
	assert.Len(t, posts, 0)

	// import the exported posts
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	posts, err = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.Nil(t, err)

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
	err := th1.App.BulkExport(&b, "somefile", "somePath", "someDir")
	require.Nil(t, err)

	posts, err := th1.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.Nil(t, err)
	assert.Equal(t, 1, len(posts))

	th1.TearDown()

	th2 := Setup(t)
	defer th2.TearDown()

	posts, err = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.Nil(t, err)
	assert.Equal(t, 0, len(posts))

	// import the exported posts
	err, i := th2.App.BulkImport(&b, false, 5)
	assert.Nil(t, err)
	assert.Equal(t, 0, i)

	posts, err = th2.App.Srv().Store.Post().GetDirectPostParentsForExportAfter(1000, "0000000")
	require.Nil(t, err)
	assert.Equal(t, 1, len(posts))
	assert.Equal(t, 1, len((*posts[0].ChannelMembers)))
	assert.Equal(t, th1.BasicUser.Username, (*posts[0].ChannelMembers)[0])
}
