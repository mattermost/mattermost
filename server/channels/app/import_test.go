// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func checkPreference(t *testing.T, a *App, userID string, category string, name string, value string) {
	preferences, err := a.Srv().Store().Preference().GetCategory(userID, category)
	require.NoErrorf(t, err, "Failed to get preferences for user %v with category %v", userID, category)
	found := false
	for _, preference := range preferences {
		if preference.Name == name {
			found = true
			require.Equal(t, preference.Value, value, "Preference for user %v in category %v with name %v has value %v, expected %v", userID, category, name, preference.Value, value)
			break
		}
	}
	require.Truef(t, found, "Did not find preference for user %v in category %v with name %v", userID, category, name)
}

//nolint:unused
func checkNotifyProp(t *testing.T, user *model.User, key string, value string) {
	actual, ok := user.NotifyProps[key]
	require.True(t, ok, "Notify prop %v not found. User: %v", key, user.Id)
	require.Equalf(t, actual, value, "Notify Prop %v was %v but expected %v. User: %v", key, actual, value, user.Id)
}

func checkError(t *testing.T, err *model.AppError) {
	require.NotNil(t, err, "Should have returned an error.")
}

func checkNoError(t *testing.T, err *model.AppError) {
	require.Nil(t, err, "Unexpected Error: %v", err)
}

func AssertAllPostsCount(t *testing.T, a *App, initialCount int64, change int64, teamName string) {
	t.Helper()
	require.NoError(t, a.Srv().Store().Post().RefreshPostStats())
	result, err := a.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: teamName})
	require.NoError(t, err)
	require.Equal(t, initialCount+change, result, "Did not find the expected number of posts.")
}

func AssertChannelCount(t *testing.T, a *App, channelType model.ChannelType, expectedCount int64) {
	count, err := a.Srv().Store().Channel().AnalyticsTypeCount("", channelType)
	require.Equalf(t, expectedCount, count, "Channel count of type: %v. Expected: %v, Got: %v", channelType, expectedCount, count)
	require.NoError(t, err, "Failed to get channel count.")
}

func TestImportImportLine(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	// Try import line with an invalid type.
	line := imports.LineImportData{
		Type: "gibberish",
	}

	err := th.App.importLine(th.Context, line, false, false, &imports.ImportReport{})
	require.NotNil(t, err, "Expected an error when importing a line with invalid type.")

	// Try import line with team type but nil team.
	line.Type = "team"
	err = th.App.importLine(th.Context, line, false, false, &imports.ImportReport{})
	require.NotNil(t, err, "Expected an error when importing a line of type team with a nil team.")

	// Try import line with channel type but nil channel.
	line.Type = "channel"
	err = th.App.importLine(th.Context, line, false, false, &imports.ImportReport{})
	require.NotNil(t, err, "Expected an error when importing a line with type channel with a nil channel.")

	// Try import line with user type but nil user.
	line.Type = "user"
	err = th.App.importLine(th.Context, line, false, false, &imports.ImportReport{})
	require.NotNil(t, err, "Expected an error when importing a line with type user with a nil user.")

	// Try import line with post type but nil post.
	line.Type = "post"
	err = th.App.importLine(th.Context, line, false, false, &imports.ImportReport{})
	require.NotNil(t, err, "Expected an error when importing a line with type post with a nil post.")

	// Try import line with direct_channel type but nil direct_channel.
	line.Type = "direct_channel"
	err = th.App.importLine(th.Context, line, false, false, &imports.ImportReport{})
	require.NotNil(t, err, "Expected an error when importing a line with type direct_channel with a nil direct_channel.")

	// Try import line with direct_post type but nil direct_post.
	line.Type = "direct_post"
	err = th.App.importLine(th.Context, line, false, false, &imports.ImportReport{})
	require.NotNil(t, err, "Expected an error when importing a line with type direct_post with a nil direct_post.")

	// Try import line with scheme type but nil scheme.
	line.Type = "scheme"
	err = th.App.importLine(th.Context, line, false, false, &imports.ImportReport{})
	require.NotNil(t, err, "Expected an error when importing a line with type scheme with a nil scheme.")
}

func TestStopOnError(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	assert.True(t, stopOnError(th.Context, imports.LineImportWorkerError{
		Error:      model.NewAppError("test", "app.import.attachment.bad_file.error", nil, "", http.StatusBadRequest),
		LineNumber: 1,
	}))

	assert.True(t, stopOnError(th.Context, imports.LineImportWorkerError{
		Error:      model.NewAppError("test", "app.import.attachment.file_upload.error", nil, "", http.StatusBadRequest),
		LineNumber: 1,
	}))

	assert.False(t, stopOnError(th.Context, imports.LineImportWorkerError{
		Error:      model.NewAppError("test", "api.file.upload_file.large_image.app_error", nil, "", http.StatusBadRequest),
		LineNumber: 1,
	}))

	assert.False(t, stopOnError(th.Context, imports.LineImportWorkerError{
		Error:      model.NewAppError("test", "app.import.validate_direct_channel_import_data.members_too_few.error", nil, "", http.StatusBadRequest),
		LineNumber: 1,
	}))

	assert.False(t, stopOnError(th.Context, imports.LineImportWorkerError{
		Error:      model.NewAppError("test", "app.import.validate_direct_channel_import_data.members_too_many.error", nil, "", http.StatusBadRequest),
		LineNumber: 1,
	}))
}

func TestImportBulkImport(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	teamName := model.NewRandomTeamName()
	channelName := model.NewId()
	username := model.NewUsername()
	username2 := model.NewUsername()
	username3 := model.NewUsername()
	emojiName := model.NewId()
	testsDir, _ := fileutils.FindDir("tests")
	testImage := "test.png"
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

	line, err := th.App.BulkImportWithPath(th.Context, strings.NewReader(data1), nil, false, false, 2, testsDir)
	require.Nil(t, err, "BulkImport should have succeeded")
	require.Equal(t, 0, line, "BulkImport line should be 0")

	// Run bulk import using a string that contains a line with invalid json.
	data2 := `{"type": "version", "version": 1`
	line, err = th.App.BulkImportWithPath(th.Context, strings.NewReader(data2), nil, false, false, 2, testsDir)
	require.NotNil(t, err, "Should have failed due to invalid JSON on line 1.")
	require.Equal(t, 1, line, "Should have failed due to invalid JSON on line 1.")

	// Run bulk import using valid JSON but missing version line at the start.
	data3 := `{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "kufjgnkxkrhhfgbrip6qxkfsaa", "email": "kufjgnkxkrhhfgbrip6qxkfsaa@example.com"}}
{"type": "user", "user": {"username": "bwshaim6qnc2ne7oqkd5b2s2rq", "email": "bwshaim6qnc2ne7oqkd5b2s2rq@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}]}]}}`
	line, err = th.App.BulkImportWithPath(th.Context, strings.NewReader(data3), nil, false, false, 2, testsDir)
	require.NotNil(t, err, "Should have failed due to missing version line on line 1.")
	require.Equal(t, 1, line, "Should have failed due to missing version line on line 1.")

	// Run bulk import using a valid and large input and a \r\n line break.
	t.Run("", func(t *testing.T) {
		posts := `{"type": "post"` + strings.Repeat(`, "post": {"team": "`+teamName+`", "channel": "`+channelName+`", "user": "`+username+`", "message": "Repeat after me", "create_at": 193456789012}`, 1e4) + "}"
		data4 := `{"type": "version", "version": 1}
{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "` + username + `", "email": "` + username + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme1 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username + `", "message": "Hello World", "create_at": 123456789012}}`
		line, err = th.App.BulkImport(th.Context, strings.NewReader(data4+"\r\n"+posts), nil, false, 2)
		require.Nil(t, err, "BulkImport should have succeeded")
		require.Equal(t, 0, line, "BulkImport line should be 0")
	})

	t.Run("First item after version without type", func(t *testing.T) {
		data := `{"type": "version", "version": 1}
{"name": "custom-emoji-troll", "image": "bulkdata/emoji/trollolol.png"}`
		line, err := th.App.BulkImport(th.Context, strings.NewReader(data), nil, false, 2)
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
{"type": "direct_post", "direct_post": {"channel_members": ["` + username + `", "` + username + `"], "user": "` + username + `", "message": "Hello Direct Channel to myself", "create_at": 123456789014, "props":{"attachments":[{"id":0,"fallback":"[February 4th, 2020 2:46 PM] author: fallback","color":"D0D0D0","pretext":"","author_name":"author","author_link":"","title":"","title_link":"","text":"this post has props","fields":null,"image_url":"","thumb_url":"","footer":"Posted in #general","footer_icon":"","ts":"1580823992.000100"}]}}}`

		line, err := th.App.BulkImport(th.Context, strings.NewReader(data6), nil, false, 2)
		require.Nil(t, err, "BulkImport should have succeeded")
		require.Equal(t, 0, line, "BulkImport line should be 0")
	})

	t.Run("Invalid post attachment path", func(t *testing.T) {
		data7 := `{"type": "version", "version": 1}
{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "` + username + `", "email": "` + username + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme1 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username2 + `", "email": "` + username2 + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme2 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username3 + `", "email": "` + username3 + `@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}], "delete_at": 123456789016}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username + `", "message": "Hello World", "create_at": 123456789012, "attachments":[{"path": "test.png"}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username3 + `", "message": "Hey Everyone!", "create_at": 123456789013, "attachments":[{"path": "../test.png"}]}}`

		// Import should not fail for a single invalid attachment path.
		line, err := th.App.BulkImportWithPath(th.Context, strings.NewReader(data7), nil, false, false, 2, testsDir)
		require.Nil(t, err, "BulkImport should have succeeded")
		require.Equal(t, 0, line, "BulkImport line should be 0")
	})

	t.Run("Invalid reply attachment path", func(t *testing.T) {
		data8 := `{"type": "version", "version": 1}
{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "` + username + `", "email": "` + username + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme1 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username2 + `", "email": "` + username2 + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme2 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username3 + `", "email": "` + username3 + `@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}], "delete_at": 123456789016}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username + `", "message": "Hello World", "create_at": 123456789012, "attachments":[{"path": "test.png"}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username3 + `", "message": "Hey Everyone!", "create_at": 123456789013, "replies": [{"create_at": 123456789015, "user": "` + username + `", "message": "reply", "attachments":[{"path": "../test.png"}]}]}}`

		// Import should not fail for a single invalid attachment path.
		line, err := th.App.BulkImportWithPath(th.Context, strings.NewReader(data8), nil, false, false, 2, testsDir)
		require.Nil(t, err, "BulkImport should have succeeded")
		require.Equal(t, 0, line, "BulkImport line should be 0")
	})

	t.Run("Invalid direct post attachment path", func(t *testing.T) {
		data9 := `{"type": "version", "version": 1}
{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "` + username + `", "email": "` + username + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme1 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username2 + `", "email": "` + username2 + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme2 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username3 + `", "email": "` + username3 + `@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}], "delete_at": 123456789016}]}}
{"type": "direct_channel", "direct_channel": {"members": ["` + username + `", "` + username + `"]}}
{"type": "direct_post", "direct_post": {"channel_members": ["` + username + `", "` + username + `"], "user": "` + username + `", "message": "Hello Direct Channel to myself", "create_at": 123456789014, "attachments":[{"path": "../test.png"}]}}`

		// Import should not fail for a single invalid attachment path.
		line, err := th.App.BulkImportWithPath(th.Context, strings.NewReader(data9), nil, false, false, 2, testsDir)
		require.Nil(t, err, "BulkImport should have succeeded")
		require.Equal(t, 0, line, "BulkImport line should be 0")
	})
}

func TestImportProcessImportDataFileVersionLine(t *testing.T) {
	mainHelper.Parallel(t)
	data := imports.LineImportData{
		Type:    "version",
		Version: new(1),
	}
	version, err := processImportDataFileVersionLine(data)
	require.Nil(t, err, "Expected no error")
	require.Equal(t, 1, version, "Expected version 1")

	data.Type = "NotVersion"
	_, err = processImportDataFileVersionLine(data)
	require.NotNil(t, err, "Expected error on invalid version line.")

	data.Type = "version"
	data.Version = nil
	_, err = processImportDataFileVersionLine(data)
	require.NotNil(t, err, "Expected error on invalid version line.")
}

func GetAttachments(userID string, th *TestHelper, t *testing.T) []*model.FileInfo {
	t.Helper()

	fileInfos, err := th.App.Srv().Store().FileInfo().GetForUser(userID)
	require.NoError(t, err)
	return fileInfos
}

func AssertFileIdsInPost(files []*model.FileInfo, th *TestHelper, t *testing.T) {
	t.Helper()

	postID := files[0].PostId
	require.NotNil(t, postID)

	posts, err := th.App.Srv().Store().Post().GetPostsByIds([]string{postID})
	require.NoError(t, err)

	require.Len(t, posts, 1)
	for _, file := range files {
		assert.Contains(t, posts[0].FileIds, file.Id)
	}
}

func TestProcessAttachmentPaths(t *testing.T) {
	c := request.TestContext(t)

	t.Run("nil attachments", func(t *testing.T) {
		err := processAttachmentPaths(c, nil, "", nil)
		require.NoError(t, err)
	})

	t.Run("missing file in map", func(t *testing.T) {
		attachments := &[]imports.AttachmentImportData{
			{
				Path: new("file.jpg"),
			},
		}

		filesMap := map[string]*zip.File{
			"./import/other-file.jpg": nil,
		}

		err := processAttachmentPaths(c, attachments, "", filesMap)
		require.Error(t, err)
		require.EqualError(t, err, "attachment \"file.jpg\" not found in map")
	})

	t.Run("valid paths", func(t *testing.T) {
		attachments := &[]imports.AttachmentImportData{
			{
				Path: new("file.jpg"),
			},
			{
				Path: new("somedir/file.jpg"),
			},
			{
				Path: new("./someotherdir/file.jpg"),
			},
		}

		expected := &[]imports.AttachmentImportData{
			{
				Path: new("data/file.jpg"),
			},
			{
				Path: new("data/somedir/file.jpg"),
			},
			{
				Path: new("data/someotherdir/file.jpg"),
			},
		}

		err := processAttachmentPaths(c, attachments, model.ExportDataDir, nil)
		require.NoError(t, err)
		require.Equal(t, expected, attachments)
	})

	t.Run("uncleaned paths", func(t *testing.T) {
		attachments := &[]imports.AttachmentImportData{
			{
				Path: new("../dir/invalid.txt"),
			},
			{
				Path: new("somedir/./normal-file.jpg"),
			},
		}

		expected := &[]imports.AttachmentImportData{
			{
				Path: new("/path/to/import/dir/invalid.txt"),
			},
			{
				Path: new("/path/to/import/dir/somedir/normal-file.jpg"),
			},
		}

		err := processAttachmentPaths(c, attachments, "/path/to/import/dir", nil)
		require.NoError(t, err)
		require.Equal(t, expected, attachments)
	})

	t.Run("paths outside base path", func(t *testing.T) {
		attachments := &[]imports.AttachmentImportData{
			{
				Path: new("../../invalid.txt"),
			},
			{
				Path: new("../../../invalid.txt"),
			},
		}

		expected := &[]imports.AttachmentImportData{
			{
				Path: new(""),
			},
			{
				Path: new(""),
			},
		}

		err := processAttachmentPaths(c, attachments, "data", nil)
		require.EqualError(t, err, "invalid attachment path \"../../invalid.txt\"\ninvalid attachment path \"../../../invalid.txt\"")
		require.Equal(t, expected, attachments)
	})

	t.Run("mix of valid and invalid paths", func(t *testing.T) {
		attachments := &[]imports.AttachmentImportData{
			{
				Path: new("../../invalid.txt"),
			},
			{
				Path: new("valid/path/to/file"),
			},
		}

		expected := &[]imports.AttachmentImportData{
			{
				Path: new(""),
			},
			{
				Path: new("data/valid/path/to/file"),
			},
		}

		err := processAttachmentPaths(c, attachments, "data", nil)
		require.EqualError(t, err, "invalid attachment path \"../../invalid.txt\"")
		require.Equal(t, expected, attachments)
	})
}

func TestProcessAttachments(t *testing.T) {
	mainHelper.Parallel(t)
	c := request.TestContext(t)

	genAttachments := func() *[]imports.AttachmentImportData {
		return &[]imports.AttachmentImportData{
			{
				Path: new("file.jpg"),
			},
			{
				Path: new("somedir/file.jpg"),
			},
		}
	}

	line := imports.LineImportData{
		Type: "post",
		Post: &imports.PostImportData{
			Attachments: genAttachments(),
		},
	}

	line2 := imports.LineImportData{
		Type: "direct_post",
		DirectPost: &imports.DirectPostImportData{
			Attachments: genAttachments(),
		},
	}

	userLine := imports.LineImportData{
		Type: "user",
		User: &imports.UserImportData{
			Avatar: imports.Avatar{
				ProfileImage: new("profile.jpg"),
			},
		},
	}

	emojiLine := imports.LineImportData{
		Type: "emoji",
		Emoji: &imports.EmojiImportData{
			Image: new("emoji.png"),
		},
	}

	t.Run("empty path", func(t *testing.T) {
		expected := &[]imports.AttachmentImportData{
			{
				Path: new("file.jpg"),
			},
			{
				Path: new("somedir/file.jpg"),
			},
		}

		err := processAttachments(c, &line, "", nil)
		require.NoError(t, err)
		require.Equal(t, expected, line.Post.Attachments)
		err = processAttachments(c, &line2, "", nil)
		require.NoError(t, err)
		require.Equal(t, expected, line2.DirectPost.Attachments)
	})

	t.Run("valid path", func(t *testing.T) {
		expected := &[]imports.AttachmentImportData{
			{
				Path: new("tmp/file.jpg"),
			},
			{
				Path: new("tmp/somedir/file.jpg"),
			},
		}

		t.Run("post attachments", func(t *testing.T) {
			err := processAttachments(c, &line, "tmp", nil)
			require.NoError(t, err)
			require.Equal(t, expected, line.Post.Attachments)
		})

		t.Run("direct post attachments", func(t *testing.T) {
			err := processAttachments(c, &line2, "tmp", nil)
			require.NoError(t, err)
			require.Equal(t, expected, line2.DirectPost.Attachments)
		})

		t.Run("profile image", func(t *testing.T) {
			expected := "tmp/profile.jpg"
			err := processAttachments(c, &userLine, "tmp", nil)
			require.NoError(t, err)
			require.Equal(t, expected, *userLine.User.ProfileImage)
		})

		t.Run("emoji", func(t *testing.T) {
			expected := "tmp/emoji.png"
			err := processAttachments(c, &emojiLine, "tmp", nil)
			require.NoError(t, err)
			require.Equal(t, expected, *emojiLine.Emoji.Image)
		})
	})

	t.Run("with filesMap", func(t *testing.T) {
		t.Run("post attachments", func(t *testing.T) {
			filesMap := map[string]*zip.File{
				"tmp/file.jpg": nil,
			}
			err := processAttachments(c, &line, "", filesMap)
			require.Error(t, err)

			filesMap["tmp/somedir/file.jpg"] = nil
			err = processAttachments(c, &line, "", filesMap)
			require.NoError(t, err)
		})

		t.Run("direct post attachments", func(t *testing.T) {
			filesMap := map[string]*zip.File{
				"tmp/file.jpg": nil,
			}
			err := processAttachments(c, &line2, "", filesMap)
			require.Error(t, err)

			filesMap["tmp/somedir/file.jpg"] = nil
			err = processAttachments(c, &line2, "", filesMap)
			require.NoError(t, err)
		})

		t.Run("profile image", func(t *testing.T) {
			filesMap := map[string]*zip.File{
				"/tmp/file.jpg": nil,
			}
			err := processAttachments(c, &userLine, "", filesMap)
			require.Error(t, err)

			filesMap["tmp/profile.jpg"] = nil
			err = processAttachments(c, &userLine, "", filesMap)
			require.NoError(t, err)
		})

		t.Run("emoji", func(t *testing.T) {
			filesMap := map[string]*zip.File{
				"/tmp/file.jpg": nil,
			}
			err := processAttachments(c, &emojiLine, "", filesMap)
			require.Error(t, err)

			filesMap["tmp/emoji.png"] = nil
			err = processAttachments(c, &emojiLine, "", filesMap)
			require.NoError(t, err)
		})
	})
}

func BenchmarkBulkImport(b *testing.B) {
	th := Setup(b)

	testsDir, _ := fileutils.FindDir("tests")

	importFile, err := os.Open(testsDir + "/import_test.zip")
	require.NoError(b, err)
	defer importFile.Close()

	info, err := importFile.Stat()
	require.NoError(b, err)

	dir, err := os.MkdirTemp("", "testimport")
	require.NoError(b, err)
	defer os.RemoveAll(dir)

	_, err = utils.UnzipToPath(importFile, info.Size(), dir)
	require.NoError(b, err)

	jsonFile, err := os.Open(dir + "/import.jsonl")
	require.NoError(b, err)
	defer jsonFile.Close()

	for b.Loop() {
		err, _ := th.App.BulkImportWithPath(th.Context, jsonFile, nil, false, true, runtime.NumCPU(), dir)
		require.Nil(b, err)
	}
}

func TestImportBulkImportWithAttachments(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	testsDir, _ := fileutils.FindDir("tests")

	importFile, err := os.Open(testsDir + "/export_test.zip")
	require.NoError(t, err)
	defer importFile.Close()

	info, err := importFile.Stat()
	require.NoError(t, err)

	importZipReader, err := zip.NewReader(importFile, info.Size())
	require.NoError(t, err)
	require.NotNil(t, importZipReader)

	var jsonFile io.ReadCloser
	for _, f := range importZipReader.File {
		if !imports.IsRootJsonlFile(f.Name) {
			continue
		}

		jsonFile, err = f.Open()
		require.NoError(t, err)
		defer jsonFile.Close()
		break
	}
	require.NotNil(t, jsonFile)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.MaxUsersPerTeam = new(1000) })

	_, appErr := th.App.BulkImportWithPath(th.Context, jsonFile, importZipReader, false, true, 1, model.ExportDataDir)
	require.Nil(t, appErr)

	adminUser, appErr := th.App.GetUserByUsername("sysadmin")
	require.Nil(t, appErr)

	files := GetAttachments(adminUser.Id, th, t)
	require.Len(t, files, 11)
}

func TestImportBulkImportWithNestedJsonl(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	testsDir, _ := fileutils.FindDir("tests")

	importFile, err := os.Open(testsDir + "/export_test_with_nested_jsonl.zip")
	require.NoError(t, err)
	defer importFile.Close()

	info, err := importFile.Stat()
	require.NoError(t, err)

	importZipReader, err := zip.NewReader(importFile, info.Size())
	require.NoError(t, err)
	require.NotNil(t, importZipReader)

	var jsonFile io.ReadCloser
	for _, f := range importZipReader.File {
		if !imports.IsRootJsonlFile(f.Name) {
			continue
		}

		jsonFile, err = f.Open()
		require.NoError(t, err)
		defer jsonFile.Close()
		break
	}
	require.NotNil(t, jsonFile)

	_, appErr := th.App.BulkImportWithPath(th.Context, jsonFile, importZipReader, false, true, 1, model.ExportDataDir)
	require.Nil(t, appErr)
}

func TestRewriteTeamName(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	t.Run("rewrites team line name", func(t *testing.T) {
		line := imports.LineImportData{
			Type: "team",
			Team: &imports.TeamImportData{Name: strPtr("source-team")},
		}
		rewriteTeamName(&line, "source-team", "dest-team")
		assert.Equal(t, "dest-team", *line.Team.Name)
	})

	t.Run("does not rewrite non-matching team name", func(t *testing.T) {
		line := imports.LineImportData{
			Type: "team",
			Team: &imports.TeamImportData{Name: strPtr("other-team")},
		}
		rewriteTeamName(&line, "source-team", "dest-team")
		assert.Equal(t, "other-team", *line.Team.Name)
	})

	t.Run("rewrites channel line team reference", func(t *testing.T) {
		team := "source-team"
		line := imports.LineImportData{
			Type:    "channel",
			Channel: &imports.ChannelImportData{Team: &team},
		}
		rewriteTeamName(&line, "source-team", "dest-team")
		assert.Equal(t, "dest-team", *line.Channel.Team)
	})

	t.Run("rewrites user team membership", func(t *testing.T) {
		teamName := "source-team"
		teams := []imports.UserTeamImportData{{Name: &teamName}}
		line := imports.LineImportData{
			Type: "user",
			User: &imports.UserImportData{Teams: &teams},
		}
		rewriteTeamName(&line, "source-team", "dest-team")
		assert.Equal(t, "dest-team", *(*line.User.Teams)[0].Name)
	})

	t.Run("rewrites post team reference", func(t *testing.T) {
		team := "source-team"
		line := imports.LineImportData{
			Type: "post",
			Post: &imports.PostImportData{Team: &team},
		}
		rewriteTeamName(&line, "source-team", "dest-team")
		assert.Equal(t, "dest-team", *line.Post.Team)
	})
}

func TestDeactivateMissingUsersMode(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	// Create a user that exists on this server.
	existingUser := th.CreateUser(t)

	// Build a channel-scoped import JSONL — the additional field in the
	// version line triggers deactivateMissingUsers mode automatically.
	teamName := model.NewRandomTeamName()
	channelName := model.NewId()
	newUsername := model.NewUsername() // does not exist on this server

	data := `{"type":"version","version":1,"info":{"generator":"mattermost-server","version":"test","created":"2026-01-01T00:00:00Z","additional":{"team_name":"` + teamName + `","channel_name":"` + channelName + `"}}}
{"type":"team","team":{"type":"O","display_name":"Test Team","name":"` + teamName + `"}}
{"type":"channel","channel":{"type":"O","display_name":"Test Channel","team":"` + teamName + `","name":"` + channelName + `"}}
{"type":"user","user":{"username":"` + existingUser.Username + `","email":"` + existingUser.Email + `","teams":[{"name":"` + teamName + `","channels":[{"name":"` + channelName + `"}]}]}}
{"type":"user","user":{"username":"` + newUsername + `","email":"` + newUsername + `@example.com","teams":[{"name":"` + teamName + `","channels":[{"name":"` + channelName + `"}]}]}}`

	_, appErr := th.App.BulkImportWithPath(th.Context, strings.NewReader(data), nil, false, false, 1, "")
	require.Nil(t, appErr)

	// The existing user should still exist.
	_, err := th.App.Srv().Store().User().GetByUsername(existingUser.Username)
	require.NoError(t, err, "existing user should still be present")

	// The new user should have been created as a deactivated placeholder account.
	u, err := th.App.Srv().Store().User().GetByUsername(newUsername)
	require.NoError(t, err, "new user should have been created in deactivateMissingUsers mode")
	assert.NotZero(t, u.DeleteAt, "newly-created user should be deactivated")
}

func TestRewriteTeamNameEndToEnd(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	// Create the destination team on this server.
	destTeam := th.CreateTeam(t)

	// Build a channel-scoped import that names a different source team.
	// The --destination-team flag should remap all references to destTeam.
	srcTeamName := model.NewRandomTeamName()
	channelName := model.NewId()
	username := model.NewUsername()

	data := `{"type":"version","version":1,"info":{"generator":"mattermost-server","version":"test","created":"2026-01-01T00:00:00Z","additional":{"team_name":"` + srcTeamName + `","channel_name":"` + channelName + `"}}}
{"type":"team","team":{"type":"O","display_name":"Source Team","name":"` + srcTeamName + `"}}
{"type":"channel","channel":{"type":"O","display_name":"Test Channel","team":"` + srcTeamName + `","name":"` + channelName + `"}}
{"type":"user","user":{"username":"` + username + `","email":"` + username + `@example.com","teams":[{"name":"` + srcTeamName + `","channels":[{"name":"` + channelName + `"}]}]}}`

	opts := model.BulkImportOpts{DestinationTeamName: destTeam.Name}
	_, appErr := th.App.BulkImportWithPathAndOpts(th.Context, strings.NewReader(data), nil, false, false, 1, "", opts)
	require.Nil(t, appErr)

	// The channel should have been created under the destination team.
	_, appErr = th.App.GetChannelByName(th.Context, channelName, destTeam.Id, false)
	require.Nil(t, appErr, "channel should exist under the destination team after name remapping")
}

func TestDeleteImport(t *testing.T) {
	th := Setup(t)

	importDir := filepath.Join(th.tempWorkspace, "data", "import")
	err := os.MkdirAll(importDir, os.ModePerm)
	require.NoError(t, err)
	f, err := os.Create(filepath.Join(importDir, "import.zip"))
	require.NoError(t, err)
	f.Close()
	defer func() {
		err = os.RemoveAll(importDir)
		require.NoError(t, err)
	}()

	t.Run("delete import successful", func(t *testing.T) {
		imports, err := th.App.ListImports()
		require.Nil(t, err)
		require.Equal(t, 1, len(imports))
		require.Equal(t, "import.zip", imports[0])

		delErr := th.App.DeleteImport("import.zip")
		require.Nil(t, delErr)

		imports, err = th.App.ListImports()
		require.Nil(t, err)
		require.Equal(t, 0, len(imports))

		//idempotency check
		delErr = th.App.DeleteImport("import.zip")
		require.Nil(t, delErr)
	})
}

func TestCheckSSOProviderConfig(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	// Enterprise license required to enable LDAP/SAML via UpdateConfig validation.
	th.App.Srv().SetLicense(model.NewTestLicense())
	defer th.App.Srv().SetLicense(nil)

	versionLine := `{"type":"version","version":1,"info":{"generator":"mattermost-server","version":"test","created":"2026-01-01T00:00:00Z","additional":{"team_name":"acme"}}}`

	makeJSONL := func(authService string) string {
		userLine := `{"type":"user","user":{"username":"testuser","email":"test@example.com","auth_service":"` + authService + `","auth_data":"some-id"}}`
		return versionLine + "\n" + userLine
	}

	t.Run("LDAP enabled — no error", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.LdapSettings.Enable = model.NewPointer(true)
			cfg.LdapSettings.LdapServer = model.NewPointer("localhost")
			cfg.LdapSettings.BaseDN = model.NewPointer("dc=mm,dc=test,dc=com")
			cfg.LdapSettings.BindUsername = model.NewPointer("cn=admin,dc=mm,dc=test,dc=com")
			cfg.LdapSettings.BindPassword = model.NewPointer("mostest")
			cfg.LdapSettings.EmailAttribute = model.NewPointer("mail")
			cfg.LdapSettings.UsernameAttribute = model.NewPointer("uid")
			cfg.LdapSettings.IdAttribute = model.NewPointer("uid")
			cfg.LdapSettings.LoginIdAttribute = model.NewPointer("uid")
		})
		zr := makeZipWithJSONL(t, makeJSONL(model.UserAuthServiceLdap))
		appErr := th.App.checkSSOProviderConfig(th.Context, zr, false)
		require.Nil(t, appErr)
	})

	t.Run("LDAP disabled — error", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.LdapSettings.Enable = model.NewPointer(false)
		})
		zr := makeZipWithJSONL(t, makeJSONL(model.UserAuthServiceLdap))
		appErr := th.App.checkSSOProviderConfig(th.Context, zr, false)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("LDAP enabled but IdAttribute empty — error", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.LdapSettings.Enable = model.NewPointer(true)
			cfg.LdapSettings.IdAttribute = model.NewPointer("")
		})
		zr := makeZipWithJSONL(t, makeJSONL(model.UserAuthServiceLdap))
		appErr := th.App.checkSSOProviderConfig(th.Context, zr, false)
		require.NotNil(t, appErr)
	})

	t.Run("SAML enabled — no error", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.SamlSettings.Enable = model.NewPointer(true)
			cfg.SamlSettings.Verify = model.NewPointer(false)
			cfg.SamlSettings.Encrypt = model.NewPointer(false)
			cfg.SamlSettings.IdpURL = model.NewPointer("http://localhost:8484/realms/mattermost/protocol/saml")
			cfg.SamlSettings.IdpDescriptorURL = model.NewPointer("http://localhost:8484/realms/mattermost")
			cfg.SamlSettings.IdpMetadataURL = model.NewPointer("http://localhost:8484/realms/mattermost/protocol/saml/descriptor")
			cfg.SamlSettings.AssertionConsumerServiceURL = model.NewPointer("http://localhost:8065/login/sso/saml")
			cfg.SamlSettings.ServiceProviderIdentifier = model.NewPointer("mattermost")
			cfg.SamlSettings.EmailAttribute = model.NewPointer("email")
			cfg.SamlSettings.UsernameAttribute = model.NewPointer("username")
			cfg.SamlSettings.IdAttribute = model.NewPointer("id")
			cfg.SamlSettings.IdpCertificateFile = model.NewPointer("saml-idp.crt")
		})
		zr := makeZipWithJSONL(t, makeJSONL(model.UserAuthServiceSaml))
		appErr := th.App.checkSSOProviderConfig(th.Context, zr, false)
		require.Nil(t, appErr)
	})

	t.Run("SAML disabled — error", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.SamlSettings.Enable = model.NewPointer(false)
		})
		zr := makeZipWithJSONL(t, makeJSONL(model.UserAuthServiceSaml))
		appErr := th.App.checkSSOProviderConfig(th.Context, zr, false)
		require.NotNil(t, appErr)
	})

	t.Run("skip-preflight bypasses disabled provider check", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.LdapSettings.Enable = model.NewPointer(false)
		})
		zr := makeZipWithJSONL(t, makeJSONL(model.UserAuthServiceLdap))
		appErr := th.App.checkSSOProviderConfig(th.Context, zr, true)
		require.Nil(t, appErr, "skip-preflight should suppress the error")
	})

	t.Run("email-only export — no error regardless of SSO config", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.LdapSettings.Enable = model.NewPointer(false)
			cfg.SamlSettings.Enable = model.NewPointer(false)
		})
		emailOnlyJSONL := versionLine + "\n" +
			`{"type":"user","user":{"username":"alice","email":"alice@example.com"}}`
		zr := makeZipWithJSONL(t, emailOnlyJSONL)
		appErr := th.App.checkSSOProviderConfig(th.Context, zr, false)
		require.Nil(t, appErr, "email-only export should never trigger preflight failures")
	})

	t.Run("mixed SSO types — all checked, first failure returns error", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.LdapSettings.Enable = model.NewPointer(true)
			cfg.LdapSettings.IdAttribute = model.NewPointer("uid")
			cfg.SamlSettings.Enable = model.NewPointer(false)
		})
		mixed := versionLine + "\n" +
			`{"type":"user","user":{"username":"ldap-user","email":"ldap@example.com","auth_service":"ldap","auth_data":"uid1"}}` + "\n" +
			`{"type":"user","user":{"username":"saml-user","email":"saml@example.com","auth_service":"saml","auth_data":"saml-id"}}`
		zr := makeZipWithJSONL(t, mixed)
		appErr := th.App.checkSSOProviderConfig(th.Context, zr, false)
		require.NotNil(t, appErr, "should fail because SAML is disabled")
	})

	t.Run("no attachments reader (non-zip import) — preflight skipped silently", func(t *testing.T) {
		// When attachmentsReader is nil the call site skips checkSSOProviderConfig entirely.
		// This test documents that the function itself handles a nil-entry zip gracefully.
		emptyZR := makeZipWithJSONL(t, "")
		appErr := th.App.checkSSOProviderConfig(th.Context, emptyZR, false)
		require.Nil(t, appErr, "empty JSONL should not trigger any failure")
	})
}

func TestRewriteChannelName(t *testing.T) {
	strPtr := func(s string) *string { return &s }
	_ = strPtr

	t.Run("rewrites channel line name", func(t *testing.T) {
		name := "source-channel"
		line := imports.LineImportData{
			Type:    "channel",
			Channel: &imports.ChannelImportData{Name: &name},
		}
		rewriteChannelName(&line, "source-channel", "dest-channel")
		assert.Equal(t, "dest-channel", *line.Channel.Name)
	})

	t.Run("does not rewrite non-matching channel name", func(t *testing.T) {
		name := "other-channel"
		line := imports.LineImportData{
			Type:    "channel",
			Channel: &imports.ChannelImportData{Name: &name},
		}
		rewriteChannelName(&line, "source-channel", "dest-channel")
		assert.Equal(t, "other-channel", *line.Channel.Name)
	})

	t.Run("rewrites user channel membership", func(t *testing.T) {
		channelName := "source-channel"
		teamName := "some-team"
		channels := []imports.UserChannelImportData{{Name: &channelName}}
		teams := []imports.UserTeamImportData{{Name: &teamName, Channels: &channels}}
		line := imports.LineImportData{
			Type: "user",
			User: &imports.UserImportData{Teams: &teams},
		}
		rewriteChannelName(&line, "source-channel", "dest-channel")
		assert.Equal(t, "dest-channel", *(*(*line.User.Teams)[0].Channels)[0].Name)
	})

	t.Run("rewrites post channel reference", func(t *testing.T) {
		channel := "source-channel"
		line := imports.LineImportData{
			Type: "post",
			Post: &imports.PostImportData{Channel: &channel},
		}
		rewriteChannelName(&line, "source-channel", "dest-channel")
		assert.Equal(t, "dest-channel", *line.Post.Channel)
	})

	t.Run("nil user teams — no panic", func(t *testing.T) {
		line := imports.LineImportData{
			Type: "user",
			User: &imports.UserImportData{Teams: nil},
		}
		assert.NotPanics(t, func() {
			rewriteChannelName(&line, "source-channel", "dest-channel")
		})
	})

	t.Run("unrelated line type — no change", func(t *testing.T) {
		name := "source-team"
		line := imports.LineImportData{
			Type: "team",
			Team: &imports.TeamImportData{Name: &name},
		}
		rewriteChannelName(&line, "source-channel", "dest-channel")
		assert.Equal(t, "source-team", *line.Team.Name)
	})
}

func TestPreCreateSSOUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	authService := model.UserAuthServiceLdap
	authData := func(s string) *string { return &s }

	t.Run("no-op when user already exists by auth_data", func(t *testing.T) {
		user := th.CreateUser(t)
		ad := model.NewId()
		_, err := th.App.Srv().Store().User().UpdateAuthData(user.Id, authService, &ad, user.Email, false)
		require.NoError(t, err)

		data := &imports.UserImportData{
			Username:    &user.Username,
			Email:       &user.Email,
			AuthService: &authService,
			AuthData:    authData(ad),
		}
		appErr := th.App.preCreateSSOUser(th.Context, data)
		require.Nil(t, appErr)

		// Verify no duplicate was created.
		users, err := th.App.Srv().Store().User().GetAllUsingAuthService(authService)
		require.NoError(t, err)
		count := 0
		for _, u := range users {
			if u.AuthData != nil && *u.AuthData == ad {
				count++
			}
		}
		assert.Equal(t, 1, count, "should not have created a duplicate user")
	})

	t.Run("attaches auth_data to existing email user matched by username", func(t *testing.T) {
		user := th.CreateUser(t)
		ad := model.NewId()

		data := &imports.UserImportData{
			Username:    &user.Username,
			Email:       &user.Email,
			AuthService: &authService,
			AuthData:    authData(ad),
		}
		appErr := th.App.preCreateSSOUser(th.Context, data)
		require.Nil(t, appErr)

		updated, err := th.App.Srv().Store().User().GetByUsername(user.Username)
		require.NoError(t, err)
		assert.Equal(t, authService, updated.AuthService)
		require.NotNil(t, updated.AuthData)
		assert.Equal(t, ad, *updated.AuthData)
	})

	t.Run("creates new user when no match found", func(t *testing.T) {
		username := model.NewUsername()
		email := username + "@example.com"
		ad := model.NewId()

		data := &imports.UserImportData{
			Username:    &username,
			Email:       &email,
			AuthService: &authService,
			AuthData:    authData(ad),
		}
		appErr := th.App.preCreateSSOUser(th.Context, data)
		require.Nil(t, appErr)

		created, err := th.App.Srv().Store().User().GetByUsername(username)
		require.NoError(t, err)
		assert.Equal(t, authService, created.AuthService)
		require.NotNil(t, created.AuthData)
		assert.Equal(t, ad, *created.AuthData)
	})

	t.Run("leaves existing user with conflicting auth_service untouched", func(t *testing.T) {
		user := th.CreateUser(t)
		samlService := model.UserAuthServiceSaml
		samlData := model.NewId()
		_, err := th.App.Srv().Store().User().UpdateAuthData(user.Id, samlService, &samlData, user.Email, false)
		require.NoError(t, err)

		ldapData := model.NewId()
		data := &imports.UserImportData{
			Username:    &user.Username,
			Email:       &user.Email,
			AuthService: &authService, // ldap
			AuthData:    authData(ldapData),
		}
		appErr := th.App.preCreateSSOUser(th.Context, data)
		require.Nil(t, appErr)

		// Auth_service should still be saml, not ldap.
		unchanged, err := th.App.Srv().Store().User().GetByUsername(user.Username)
		require.NoError(t, err)
		assert.Equal(t, samlService, unchanged.AuthService)
		require.NotNil(t, unchanged.AuthData)
		assert.Equal(t, samlData, *unchanged.AuthData, "auth_data should not have been overwritten")
	})
}

func TestCheckpointResume(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	teamName := model.NewRandomTeamName()
	channelName := model.NewId()
	username := model.NewUsername()

	// JSONL line numbers:
	//  1: version
	//  2: team
	//  3: channel
	//  4: user
	//  5: post "before-checkpoint"  ← resumeFromLine=5 causes this to be skipped
	//  6: post "after-checkpoint"   ← lineNumber 6 > resumeFromLine, so imported
	data := strings.Join([]string{
		`{"type":"version","version":1}`,
		`{"type":"team","team":{"type":"O","display_name":"Resume Test","name":"` + teamName + `"}}`,
		`{"type":"channel","channel":{"type":"O","display_name":"Resume Chan","team":"` + teamName + `","name":"` + channelName + `"}}`,
		`{"type":"user","user":{"username":"` + username + `","email":"` + username + `@example.com","teams":[{"name":"` + teamName + `","channels":[{"name":"` + channelName + `"}]}]}}`,
		`{"type":"post","post":{"team":"` + teamName + `","channel":"` + channelName + `","user":"` + username + `","message":"before-checkpoint","create_at":100000000001}}`,
		`{"type":"post","post":{"team":"` + teamName + `","channel":"` + channelName + `","user":"` + username + `","message":"after-checkpoint","create_at":200000000002}}`,
	}, "\n")

	opts := model.BulkImportOpts{ResumeFromLine: 5}
	_, appErr := th.App.BulkImportWithPathAndOpts(th.Context, strings.NewReader(data), nil, false, false, 1, "", opts)
	require.Nil(t, appErr)

	// Non-post lines are always re-processed — team, channel, and user must exist.
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr)
	channel, appErr := th.App.GetChannelByName(th.Context, channelName, team.Id, false)
	require.Nil(t, appErr)
	_, err := th.App.Srv().Store().User().GetByUsername(username)
	require.NoError(t, err)

	// Only the post after the checkpoint should have been imported.
	pl, err := th.App.Srv().Store().Post().GetPosts(th.Context, model.GetPostsOptions{
		ChannelId: channel.Id,
		Page:      0,
		PerPage:   100,
	}, false, map[string]bool{})
	require.NoError(t, err)

	var messages []string
	for _, p := range pl.Posts {
		if p.Type == "" { // skip system posts
			messages = append(messages, p.Message)
		}
	}
	assert.NotContains(t, messages, "before-checkpoint", "post before checkpoint should have been skipped")
	assert.Contains(t, messages, "after-checkpoint", "post after checkpoint should have been imported")
}

// makeZipWithJSONL creates an in-memory zip containing a single import.jsonl
// entry with the provided content, returning a *zip.Reader over it.
func makeZipWithJSONL(t *testing.T, jsonl string) *zip.Reader {
	t.Helper()
	pr, pw := io.Pipe()
	zw := zip.NewWriter(pw)
	go func() {
		f, err := zw.Create("import.jsonl")
		if err != nil {
			pw.CloseWithError(err)
			return
		}
		if _, err := strings.NewReader(jsonl).WriteTo(f); err != nil {
			pw.CloseWithError(err)
			return
		}
		pw.CloseWithError(zw.Close())
	}()
	raw, err := io.ReadAll(pr)
	require.NoError(t, err)
	r, err := zip.NewReader(strings.NewReader(string(raw)), int64(len(raw)))
	require.NoError(t, err)
	return r
}
