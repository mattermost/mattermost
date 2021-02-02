// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"image"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest/mock"
	"github.com/mattermost/mattermost-server/v5/services/filesstore/mocks"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

func TestGeneratePublicLinkHash(t *testing.T) {
	filename1 := model.NewId() + "/" + model.NewRandomString(16) + ".txt"
	filename2 := model.NewId() + "/" + model.NewRandomString(16) + ".txt"
	salt1 := model.NewRandomString(32)
	salt2 := model.NewRandomString(32)

	hash1 := GeneratePublicLinkHash(filename1, salt1)
	hash2 := GeneratePublicLinkHash(filename2, salt1)
	hash3 := GeneratePublicLinkHash(filename1, salt2)

	hash := GeneratePublicLinkHash(filename1, salt1)
	assert.Equal(t, hash, hash1, "hash should be equal for the same file name and salt")

	assert.NotEqual(t, hash1, hash2, "hashes for different files should not be equal")

	assert.NotEqual(t, hash1, hash3, "hashes for the same file with different salts should not be equal")
}

func TestDoUploadFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	teamId := model.NewId()
	channelId := model.NewId()
	userId := model.NewId()
	filename := "test"
	data := []byte("abcd")

	info1, err := th.App.DoUploadFile(time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamId, channelId, userId, filename, data)
	require.Nil(t, err, "DoUploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store.FileInfo().PermanentDelete(info1.Id)
		th.App.RemoveFile(info1.Path)
	}()

	value := fmt.Sprintf("20070204/teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info1.Id, filename)
	assert.Equal(t, value, info1.Path, "stored file at incorrect path")

	info2, err := th.App.DoUploadFile(time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamId, channelId, userId, filename, data)
	require.Nil(t, err, "DoUploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store.FileInfo().PermanentDelete(info2.Id)
		th.App.RemoveFile(info2.Path)
	}()

	value = fmt.Sprintf("20070204/teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info2.Id, filename)
	assert.Equal(t, value, info2.Path, "stored file at incorrect path")

	info3, err := th.App.DoUploadFile(time.Date(2008, 3, 5, 1, 2, 3, 4, time.Local), teamId, channelId, userId, filename, data)
	require.Nil(t, err, "DoUploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store.FileInfo().PermanentDelete(info3.Id)
		th.App.RemoveFile(info3.Path)
	}()

	value = fmt.Sprintf("20080305/teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info3.Id, filename)
	assert.Equal(t, value, info3.Path, "stored file at incorrect path")

	info4, err := th.App.DoUploadFile(time.Date(2009, 3, 5, 1, 2, 3, 4, time.Local), "../../"+teamId, "../../"+channelId, "../../"+userId, "../../"+filename, data)
	require.Nil(t, err, "DoUploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store.FileInfo().PermanentDelete(info4.Id)
		th.App.RemoveFile(info4.Path)
	}()

	value = fmt.Sprintf("20090305/teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info4.Id, filename)
	assert.Equal(t, value, info4.Path, "stored file at incorrect path")
}

func TestUploadFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channelId := th.BasicChannel.Id
	filename := "test"
	data := []byte("abcd")

	info1, err := th.App.UploadFile(data, "wrong", filename)
	require.Error(t, err, "Wrong Channel ID.")
	require.Nil(t, info1, "Channel ID does not exist.")

	info1, err = th.App.UploadFile(data, "", filename)
	require.Nil(t, err, "empty channel IDs should be valid")

	info1, err = th.App.UploadFile(data, channelId, filename)
	require.Nil(t, err, "UploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store.FileInfo().PermanentDelete(info1.Id)
		th.App.RemoveFile(info1.Path)
	}()

	value := fmt.Sprintf("%v/teams/noteam/channels/%v/users/nouser/%v/%v",
		time.Now().Format("20060102"), channelId, info1.Id, filename)
	assert.Equal(t, value, info1.Path, "Stored file at incorrect path")
}

func TestParseOldFilenames(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	fileId := model.NewId()

	tests := []struct {
		description string
		filenames   []string
		channelId   string
		userId      string
		expected    [][]string
	}{
		{
			description: "Empty input should result in empty output",
			filenames:   []string{},
			channelId:   th.BasicChannel.Id,
			userId:      th.BasicUser.Id,
			expected:    [][]string{},
		},
		{
			description: "Filename with invalid format should not parse",
			filenames:   []string{"/path/to/some/file.png"},
			channelId:   th.BasicChannel.Id,
			userId:      th.BasicUser.Id,
			expected:    [][]string{},
		},
		{
			description: "ChannelId in Filename should not match",
			filenames: []string{
				fmt.Sprintf("/%v/%v/%v/file.png", model.NewId(), th.BasicUser.Id, fileId),
			},
			channelId: th.BasicChannel.Id,
			userId:    th.BasicUser.Id,
			expected:  [][]string{},
		},
		{
			description: "UserId in Filename should not match",
			filenames: []string{
				fmt.Sprintf("/%v/%v/%v/file.png", th.BasicChannel.Id, model.NewId(), fileId),
			},
			channelId: th.BasicChannel.Id,
			userId:    th.BasicUser.Id,
			expected:  [][]string{},
		},
		{
			description: "../ in filename should not parse",
			filenames: []string{
				fmt.Sprintf("/%v/%v/%v/../../../file.png", th.BasicChannel.Id, th.BasicUser.Id, fileId),
			},
			channelId: th.BasicChannel.Id,
			userId:    th.BasicUser.Id,
			expected:  [][]string{},
		},
		{
			description: "Should only parse valid filenames",
			filenames: []string{
				fmt.Sprintf("/%v/%v/%v/../otherfile.png", th.BasicChannel.Id, th.BasicUser.Id, fileId),
				fmt.Sprintf("/%v/%v/%v/file.png", th.BasicChannel.Id, th.BasicUser.Id, fileId),
			},
			channelId: th.BasicChannel.Id,
			userId:    th.BasicUser.Id,
			expected: [][]string{
				{
					th.BasicChannel.Id,
					th.BasicUser.Id,
					fileId,
					"file.png",
				},
			},
		},
		{
			description: "Valid Filename should parse",
			filenames: []string{
				fmt.Sprintf("/%v/%v/%v/file.png", th.BasicChannel.Id, th.BasicUser.Id, fileId),
			},
			channelId: th.BasicChannel.Id,
			userId:    th.BasicUser.Id,
			expected: [][]string{
				{
					th.BasicChannel.Id,
					th.BasicUser.Id,
					fileId,
					"file.png",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.description, func(tt *testing.T) {
			result := parseOldFilenames(test.filenames, test.channelId, test.userId)
			require.Equal(tt, result, test.expected)
		})
	}
}

func TestGetInfoForFilename(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := th.BasicPost
	teamId := th.BasicTeam.Id

	info := th.App.getInfoForFilename(post, teamId, post.ChannelId, post.UserId, "someid", "somefile.png")
	assert.Nil(t, info, "Test non-existent file")
}

func TestFindTeamIdForFilename(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	teamId := th.App.findTeamIdForFilename(th.BasicPost, "someid", "somefile.png")
	assert.Equal(t, th.BasicTeam.Id, teamId)

	_, err := th.App.CreateTeamWithUser(&model.Team{Email: th.BasicUser.Email, Name: "zz" + model.NewId(), DisplayName: "Joram's Test Team", Type: model.TEAM_OPEN}, th.BasicUser.Id)
	require.Nil(t, err)

	teamId = th.App.findTeamIdForFilename(th.BasicPost, "someid", "somefile.png")
	assert.Equal(t, "", teamId)
}

func TestMigrateFilenamesToFileInfos(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := th.BasicPost
	infos := th.App.MigrateFilenamesToFileInfos(post)
	assert.Equal(t, 0, len(infos))

	post.Filenames = []string{fmt.Sprintf("/%v/%v/%v/blargh.png", th.BasicChannel.Id, th.BasicUser.Id, "someid")}
	infos = th.App.MigrateFilenamesToFileInfos(post)
	assert.Equal(t, 0, len(infos))

	path, _ := fileutils.FindDir("tests")
	file, fileErr := os.Open(filepath.Join(path, "test.png"))
	require.Nil(t, fileErr)
	defer file.Close()

	fileId := model.NewId()
	fpath := fmt.Sprintf("/teams/%v/channels/%v/users/%v/%v/test.png", th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, fileId)
	_, err := th.App.WriteFile(file, fpath)
	require.Nil(t, err)
	rpost, err := th.App.CreatePost(&model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Filenames: []string{fmt.Sprintf("/%v/%v/%v/test.png", th.BasicChannel.Id, th.BasicUser.Id, fileId)}}, th.BasicChannel, false, true)
	require.Nil(t, err)

	infos = th.App.MigrateFilenamesToFileInfos(rpost)
	assert.Equal(t, 1, len(infos))

	rpost, err = th.App.CreatePost(&model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Filenames: []string{fmt.Sprintf("/%v/%v/%v/../../test.png", th.BasicChannel.Id, th.BasicUser.Id, fileId)}}, th.BasicChannel, false, true)
	require.Nil(t, err)

	infos = th.App.MigrateFilenamesToFileInfos(rpost)
	assert.Equal(t, 0, len(infos))
}

func TestCreateZipFileAndAddFiles(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	mockBackend := mocks.FileBackend{}
	mockBackend.On("WriteFile", mock.Anything, "directory-to-heaven/zip-file-name-to-heaven.zip").Return(int64(666), errors.New("Only those who dare to fail greatly can ever achieve greatly"))

	err := th.App.CreateZipFileAndAddFiles(&mockBackend, []model.FileData{}, "zip-file-name-to-heaven.zip", "directory-to-heaven")
	require.NotNil(t, err)
	require.Equal(t, err.Error(), "Only those who dare to fail greatly can ever achieve greatly")

	mockBackend = mocks.FileBackend{}
	mockBackend.On("WriteFile", mock.Anything, "directory-to-heaven/zip-file-name-to-heaven.zip").Return(int64(666), nil)
	err = th.App.CreateZipFileAndAddFiles(&mockBackend, []model.FileData{}, "zip-file-name-to-heaven.zip", "directory-to-heaven")
	require.Nil(t, err)
}

func TestCopyFileInfos(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	teamId := model.NewId()
	channelId := model.NewId()
	userId := model.NewId()
	filename := "test"
	data := []byte("abcd")

	info1, err := th.App.DoUploadFile(time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamId, channelId, userId, filename, data)
	require.Nil(t, err)
	defer func() {
		th.App.Srv().Store.FileInfo().PermanentDelete(info1.Id)
		th.App.RemoveFile(info1.Path)
	}()

	infoIds, err := th.App.CopyFileInfos(userId, []string{info1.Id})
	require.Nil(t, err)

	info2, err := th.App.GetFileInfo(infoIds[0])
	require.Nil(t, err)
	defer func() {
		th.App.Srv().Store.FileInfo().PermanentDelete(info2.Id)
		th.App.RemoveFile(info2.Path)
	}()

	assert.NotEqual(t, info1.Id, info2.Id, "should not be equal")
	assert.Equal(t, info2.PostId, "", "should be empty string")
}

func TestGenerateThumbnailImage(t *testing.T) {
	t.Run("test generating thumbnail image", func(t *testing.T) {
		// given
		th := Setup(t)
		defer th.TearDown()
		img := createDummyImage()
		dataPath, _ := fileutils.FindDir("data")
		thumbailName := "thumb.jpg"
		thumbnailPath := filepath.Join(dataPath, thumbailName)

		// when
		th.App.generateThumbnailImage(img, thumbailName)
		defer os.Remove(thumbnailPath)

		// then
		outputImage, err := os.Stat(thumbnailPath)
		assert.NoError(t, err)
		assert.Equal(t, int64(957), outputImage.Size())
	})
}

func createDummyImage() *image.RGBA {
	width := 200
	height := 100
	upperLeftCorner := image.Point{0, 0}
	lowerRightCorner := image.Point{width, height}
	return image.NewRGBA(image.Rectangle{upperLeftCorner, lowerRightCorner})
}
