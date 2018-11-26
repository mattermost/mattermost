// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"path/filepath"
	"runtime/debug"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func ptrStr(s string) *string {
	return &s
}

func ptrInt64(i int64) *int64 {
	return &i
}

func ptrInt(i int) *int {
	return &i
}

func ptrBool(b bool) *bool {
	return &b
}

func checkPreference(t *testing.T, a *App, userId string, category string, name string, value string) {
	if res := <-a.Srv.Store.Preference().GetCategory(userId, category); res.Err != nil {
		debug.PrintStack()
		t.Fatalf("Failed to get preferences for user %v with category %v", userId, category)
	} else {
		preferences := res.Data.(model.Preferences)
		found := false
		for _, preference := range preferences {
			if preference.Name == name {
				found = true
				if preference.Value != value {
					debug.PrintStack()
					t.Fatalf("Preference for user %v in category %v with name %v has value %v, expected %v", userId, category, name, preference.Value, value)
				}
				break
			}
		}
		if !found {
			debug.PrintStack()
			t.Fatalf("Did not find preference for user %v in category %v with name %v", userId, category, name)
		}
	}
}

func checkNotifyProp(t *testing.T, user *model.User, key string, value string) {
	if actual, ok := user.NotifyProps[key]; !ok {
		debug.PrintStack()
		t.Fatalf("Notify prop %v not found. User: %v", key, user.Id)
	} else if actual != value {
		debug.PrintStack()
		t.Fatalf("Notify Prop %v was %v but expected %v. User: %v", key, actual, value, user.Id)
	}
}

func checkError(t *testing.T, err *model.AppError) {
	if err == nil {
		debug.PrintStack()
		t.Fatal("Should have returned an error.")
	}
}

func checkNoError(t *testing.T, err *model.AppError) {
	if err != nil {
		debug.PrintStack()
		t.Fatalf("Unexpected Error: %v", err.Error())
	}
}

func AssertAllPostsCount(t *testing.T, a *App, initialCount int64, change int64, teamName string) {
	if result := <-a.Srv.Store.Post().AnalyticsPostCount(teamName, false, false); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if initialCount+change != result.Data.(int64) {
			debug.PrintStack()
			t.Fatalf("Did not find the expected number of posts.")
		}
	}
}

func AssertChannelCount(t *testing.T, a *App, channelType string, expectedCount int64) {
	if r := <-a.Srv.Store.Channel().AnalyticsTypeCount("", channelType); r.Err == nil {
		count := r.Data.(int64)
		if count != expectedCount {
			debug.PrintStack()
			t.Fatalf("Channel count of type: %v. Expected: %v, Got: %v", channelType, expectedCount, count)
		}
	} else {
		debug.PrintStack()
		t.Fatalf("Failed to get channel count.")
	}
}

func TestImportImportLine(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	// Try import line with an invalid type.
	line := LineImportData{
		Type: "gibberish",
	}

	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with invalid type.")
	}

	// Try import line with team type but nil team.
	line.Type = "team"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line of type team with a nil team.")
	}

	// Try import line with channel type but nil channel.
	line.Type = "channel"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type channel with a nil channel.")
	}

	// Try import line with user type but nil user.
	line.Type = "user"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type uesr with a nil user.")
	}

	// Try import line with post type but nil post.
	line.Type = "post"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type post with a nil post.")
	}

	// Try import line with direct_channel type but nil direct_channel.
	line.Type = "direct_channel"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type direct_channel with a nil direct_channel.")
	}

	// Try import line with direct_post type but nil direct_post.
	line.Type = "direct_post"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type direct_post with a nil direct_post.")
	}

	// Try import line with scheme type but nil scheme.
	line.Type = "scheme"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type scheme with a nil scheme.")
	}
}

func TestImportBulkImport(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	teamName := model.NewId()
	channelName := model.NewId()
	username := model.NewId()
	username2 := model.NewId()
	username3 := model.NewId()
	emojiName := model.NewId()
	testsDir, _ := utils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	teamTheme1 := `{\"awayIndicator\":\"#DBBD4E\",\"buttonBg\":\"#23A1FF\",\"buttonColor\":\"#FFFFFF\",\"centerChannelBg\":\"#ffffff\",\"centerChannelColor\":\"#333333\",\"codeTheme\":\"github\",\"image\":\"/static/files/a4a388b38b32678e83823ef1b3e17766.png\",\"linkColor\":\"#2389d7\",\"mentionBg\":\"#2389d7\",\"mentionColor\":\"#ffffff\",\"mentionHighlightBg\":\"#fff2bb\",\"mentionHighlightLink\":\"#2f81b7\",\"newMessageSeparator\":\"#FF8800\",\"onlineIndicator\":\"#7DBE00\",\"sidebarBg\":\"#fafafa\",\"sidebarHeaderBg\":\"#3481B9\",\"sidebarHeaderTextColor\":\"#ffffff\",\"sidebarText\":\"#333333\",\"sidebarTextActiveBorder\":\"#378FD2\",\"sidebarTextActiveColor\":\"#111111\",\"sidebarTextHoverBg\":\"#e6f2fa\",\"sidebarUnreadText\":\"#333333\",\"type\":\"Mattermost\"}`
	teamTheme2 := `{\"awayIndicator\":\"#DBBD4E\",\"buttonBg\":\"#23A100\",\"buttonColor\":\"#EEEEEE\",\"centerChannelBg\":\"#ffffff\",\"centerChannelColor\":\"#333333\",\"codeTheme\":\"github\",\"image\":\"/static/files/a4a388b38b32678e83823ef1b3e17766.png\",\"linkColor\":\"#2389d7\",\"mentionBg\":\"#2389d7\",\"mentionColor\":\"#ffffff\",\"mentionHighlightBg\":\"#fff2bb\",\"mentionHighlightLink\":\"#2f81b7\",\"newMessageSeparator\":\"#FF8800\",\"onlineIndicator\":\"#7DBE00\",\"sidebarBg\":\"#fafafa\",\"sidebarHeaderBg\":\"#3481B9\",\"sidebarHeaderTextColor\":\"#ffffff\",\"sidebarText\":\"#333333\",\"sidebarTextActiveBorder\":\"#378FD2\",\"sidebarTextActiveColor\":\"#222222\",\"sidebarTextHoverBg\":\"#e6f2fa\",\"sidebarUnreadText\":\"#444444\",\"type\":\"Mattermost\"}`

	// Run bulk import with a valid 1 of everything.
	data1 := `{"type": "version", "version": 1}
{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "` + username + `", "email": "` + username + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme1 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username2 + `", "email": "` + username2 + `@example.com", "teams": [{"name": "` + teamName + `","theme": "` + teamTheme2 + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username3 + `", "email": "` + username3 + `@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username + `", "message": "Hello World", "create_at": 123456789012, "attachments":[{"path": "` + testImage + `"}]}}
{"type": "direct_channel", "direct_channel": {"members": ["` + username + `", "` + username2 + `"]}}
{"type": "direct_channel", "direct_channel": {"members": ["` + username + `", "` + username2 + `", "` + username3 + `"]}}
{"type": "direct_post", "direct_post": {"channel_members": ["` + username + `", "` + username2 + `"], "user": "` + username + `", "message": "Hello Direct Channel", "create_at": 123456789013}}
{"type": "direct_post", "direct_post": {"channel_members": ["` + username + `", "` + username2 + `", "` + username3 + `"], "user": "` + username + `", "message": "Hello Group Channel", "create_at": 123456789014}}
{"type": "emoji", "emoji": {"name": "` + emojiName + `", "image": "` + testImage + `"}}`

	if err, line := th.App.BulkImport(strings.NewReader(data1), false, 2); err != nil || line != 0 {
		t.Fatalf("BulkImport should have succeeded: %v, %v", err.Error(), line)
	}

	// Run bulk import using a string that contains a line with invalid json.
	data2 := `{"type": "version", "version": 1`
	if err, line := th.App.BulkImport(strings.NewReader(data2), false, 2); err == nil || line != 1 {
		t.Fatalf("Should have failed due to invalid JSON on line 1.")
	}

	// Run bulk import using valid JSON but missing version line at the start.
	data3 := `{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "kufjgnkxkrhhfgbrip6qxkfsaa", "email": "kufjgnkxkrhhfgbrip6qxkfsaa@example.com"}}
{"type": "user", "user": {"username": "bwshaim6qnc2ne7oqkd5b2s2rq", "email": "bwshaim6qnc2ne7oqkd5b2s2rq@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}]}]}}`
	if err, line := th.App.BulkImport(strings.NewReader(data3), false, 2); err == nil || line != 1 {
		t.Fatalf("Should have failed due to missing version line on line 1.")
	}
}

func TestImportProcessImportDataFileVersionLine(t *testing.T) {
	data := LineImportData{
		Type:    "version",
		Version: ptrInt(1),
	}
	if version, err := processImportDataFileVersionLine(data); err != nil || version != 1 {
		t.Fatalf("Expected no error and version 1.")
	}

	data.Type = "NotVersion"
	if _, err := processImportDataFileVersionLine(data); err == nil {
		t.Fatalf("Expected error on invalid version line.")
	}

	data.Type = "version"
	data.Version = nil
	if _, err := processImportDataFileVersionLine(data); err == nil {
		t.Fatalf("Expected error on invalid version line.")
	}
}

func GetAttachments(userId string, th *TestHelper, t *testing.T) []*model.FileInfo {
	if result := <-th.App.Srv.Store.FileInfo().GetForUser(userId); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		return result.Data.([]*model.FileInfo)
	}
	return nil
}

func AssertFileIdsInPost(files []*model.FileInfo, th *TestHelper, t *testing.T) {
	postId := files[0].PostId
	assert.NotNil(t, postId)

	if result := <-th.App.Srv.Store.Post().GetPostsByIds([]string{postId}); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		assert.Equal(t, len(posts), 1)
		for _, file := range files {
			assert.Contains(t, posts[0].FileIds, file.Id)
		}
	}
}
