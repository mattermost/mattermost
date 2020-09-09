// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package importexport

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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

func checkPreference(t *testing.T, s store.Store, userId string, category string, name string, value string) {
	preferences, err := s.Preference().GetCategory(userId, category)
	require.Nilf(t, err, "Failed to get preferences for user %v with category %v", userId, category)
	found := false
	for _, preference := range preferences {
		if preference.Name == name {
			found = true
			require.Equal(t, preference.Value, value, "Preference for user %v in category %v with name %v has value %v, expected %v", userId, category, name, preference.Value, value)
			break
		}
	}
	require.Truef(t, found, "Did not find preference for user %v in category %v with name %v", userId, category, name)
}

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

func AssertAllPostsCount(t *testing.T, s store.Store, initialCount int64, change int64, teamName string) {
	result, err := s.Post().AnalyticsPostCount(teamName, false, false)
	require.Nil(t, err)
	require.Equal(t, initialCount+change, result, "Did not find the expected number of posts.")
}

func AssertChannelCount(t *testing.T, s store.Store, channelType string, expectedCount int64) {
	count, err := s.Channel().AnalyticsTypeCount("", channelType)
	require.Equalf(t, expectedCount, count, "Channel count of type: %v. Expected: %v, Got: %v", channelType, expectedCount, count)
	require.Nil(t, err, "Failed to get channel count.")
}

// func TestImportImportLine(t *testing.T) {
// 	th := Setup(t)
// 	defer th.TearDown()

// 	// Try import line with an invalid type.
// 	line := LineImportData{
// 		Type: "gibberish",
// 	}

// 	importer := NewImporter(th.App, th.App.Srv().Store, th.Config())

// 	err := importer.importLine(line, false)
// 	require.NotNil(t, err, "Expected an error when importing a line with invalid type.")

// 	// Try import line with team type but nil team.
// 	line.Type = "team"
// 	err = importer.importLine(line, false)
// 	require.NotNil(t, err, "Expected an error when importing a line of type team with a nil team.")

// 	// Try import line with channel type but nil channel.
// 	line.Type = "channel"
// 	err = importer.importLine(line, false)
// 	require.NotNil(t, err, "Expected an error when importing a line with type channel with a nil channel.")

// 	// Try import line with user type but nil user.
// 	line.Type = "user"
// 	err = importer.importLine(line, false)
// 	require.NotNil(t, err, "Expected an error when importing a line with type user with a nil user.")

// 	// Try import line with post type but nil post.
// 	line.Type = "post"
// 	err = importer.importLine(line, false)
// 	require.NotNil(t, err, "Expected an error when importing a line with type post with a nil post.")

// 	// Try import line with direct_channel type but nil direct_channel.
// 	line.Type = "direct_channel"
// 	err = importer.importLine(line, false)
// 	require.NotNil(t, err, "Expected an error when importing a line with type direct_channel with a nil direct_channel.")

// 	// Try import line with direct_post type but nil direct_post.
// 	line.Type = "direct_post"
// 	err = importer.importLine(line, false)
// 	require.NotNil(t, err, "Expected an error when importing a line with type direct_post with a nil direct_post.")

// 	// Try import line with scheme type but nil scheme.
// 	line.Type = "scheme"
// 	err = importer.importLine(line, false)
// 	require.NotNil(t, err, "Expected an error when importing a line with type scheme with a nil scheme.")
// }

// func TestStopOnError(t *testing.T) {
// 	assert.True(t, stopOnError(LineImportWorkerError{
// 		model.NewAppError("test", "app.import.attachment.bad_file.error", nil, "", http.StatusBadRequest),
// 		1,
// 	}))

// 	assert.True(t, stopOnError(LineImportWorkerError{
// 		model.NewAppError("test", "app.import.attachment.file_upload.error", nil, "", http.StatusBadRequest),
// 		1,
// 	}))

// 	assert.False(t, stopOnError(LineImportWorkerError{
// 		model.NewAppError("test", "api.file.upload_file.large_image.app_error", nil, "", http.StatusBadRequest),
// 		1,
// 	}))
// }

func TestImportProcessImportDataFileVersionLine(t *testing.T) {
	data := LineImportData{
		Type:    "version",
		Version: ptrInt(1),
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

func GetAttachments(userId string, s store.Store, t *testing.T) []*model.FileInfo {
	fileInfos, err := s.FileInfo().GetForUser(userId)
	require.Nil(t, err)
	return fileInfos
}

func AssertFileIdsInPost(files []*model.FileInfo, s store.Store, t *testing.T) {
	postId := files[0].PostId
	require.NotNil(t, postId)

	posts, err := s.Post().GetPostsByIds([]string{postId})
	require.Nil(t, err)

	require.Len(t, posts, 1)
	for _, file := range files {
		assert.Contains(t, posts[0].FileIds, file.Id)
	}
}
