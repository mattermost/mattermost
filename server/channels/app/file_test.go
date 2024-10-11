// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"errors"
	"fmt"
	"image"
	"io"
	"os"
	"path"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"
	filesStoreMocks "github.com/mattermost/mattermost/server/v8/platform/shared/filestore/mocks"
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

	teamID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()
	filename := "test"
	data := []byte("abcd")

	info1, err := th.App.DoUploadFile(th.Context, time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamID, channelID, userID, filename, data, true)
	require.Nil(t, err, "DoUploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info1.Id)
		th.App.RemoveFile(info1.Path)
	}()

	value := fmt.Sprintf("20070204/teams/%v/channels/%v/users/%v/%v/%v", teamID, channelID, userID, info1.Id, filename)
	assert.Equal(t, value, info1.Path, "stored file at incorrect path")

	info2, err := th.App.DoUploadFile(th.Context, time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamID, channelID, userID, filename, data, true)
	require.Nil(t, err, "DoUploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info2.Id)
		th.App.RemoveFile(info2.Path)
	}()

	value = fmt.Sprintf("20070204/teams/%v/channels/%v/users/%v/%v/%v", teamID, channelID, userID, info2.Id, filename)
	assert.Equal(t, value, info2.Path, "stored file at incorrect path")

	info3, err := th.App.DoUploadFile(th.Context, time.Date(2008, 3, 5, 1, 2, 3, 4, time.Local), teamID, channelID, userID, filename, data, true)
	require.Nil(t, err, "DoUploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info3.Id)
		th.App.RemoveFile(info3.Path)
	}()

	value = fmt.Sprintf("20080305/teams/%v/channels/%v/users/%v/%v/%v", teamID, channelID, userID, info3.Id, filename)
	assert.Equal(t, value, info3.Path, "stored file at incorrect path")

	info4, err := th.App.DoUploadFile(th.Context, time.Date(2009, 3, 5, 1, 2, 3, 4, time.Local), "../../"+teamID, "../../"+channelID, "../../"+userID, "../../"+filename, data, true)
	require.Nil(t, err, "DoUploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info4.Id)
		th.App.RemoveFile(info4.Path)
	}()

	value = fmt.Sprintf("20090305/teams/%v/channels/%v/users/%v/%v/%v", teamID, channelID, userID, info4.Id, filename)
	assert.Equal(t, value, info4.Path, "stored file at incorrect path")

	info5, err := th.App.DoUploadFile(th.Context, time.Date(2008, 3, 5, 1, 2, 3, 4, time.Local), teamID, channelID, model.BookmarkFileOwner, filename, data, true)
	require.Nil(t, err, "DoUploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info5.Id)
		th.App.RemoveFile(info3.Path)
	}()

	value = fmt.Sprintf("%v/teams/%v/channels/%v/%v/%v", model.BookmarkFileOwner, teamID, channelID, info5.Id, filename)
	assert.Equal(t, value, info5.Path, "stored file at incorrect path")
}

func TestUploadFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channelID := th.BasicChannel.Id
	filename := "test"
	data := []byte("abcd")

	info1, err := th.App.UploadFile(th.Context, data, "wrong", filename)
	require.NotNil(t, err, "Wrong Channel ID.")
	require.Nil(t, info1, "Channel ID does not exist.")

	info1, err = th.App.UploadFile(th.Context, data, "", filename)
	require.Nil(t, err, "empty channel IDs should be valid")
	require.NotNil(t, info1)

	info1, err = th.App.UploadFile(th.Context, data, channelID, filename)
	require.Nil(t, err, "UploadFile should succeed with valid data")
	defer func() {
		th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info1.Id)
		th.App.RemoveFile(info1.Path)
	}()

	value := fmt.Sprintf("%v/teams/noteam/channels/%v/users/nouser/%v/%v",
		time.Now().Format("20060102"), channelID, info1.Id, filename)
	assert.Equal(t, value, info1.Path, "Stored file at incorrect path")
}

func TestParseOldFilenames(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	fileID := model.NewId()

	tests := []struct {
		description string
		filenames   []string
		channelID   string
		userID      string
		expected    [][]string
	}{
		{
			description: "Empty input should result in empty output",
			filenames:   []string{},
			channelID:   th.BasicChannel.Id,
			userID:      th.BasicUser.Id,
			expected:    [][]string{},
		},
		{
			description: "Filename with invalid format should not parse",
			filenames:   []string{"/path/to/some/file.png"},
			channelID:   th.BasicChannel.Id,
			userID:      th.BasicUser.Id,
			expected:    [][]string{},
		},
		{
			description: "ChannelId in Filename should not match",
			filenames: []string{
				fmt.Sprintf("/%v/%v/%v/file.png", model.NewId(), th.BasicUser.Id, fileID),
			},
			channelID: th.BasicChannel.Id,
			userID:    th.BasicUser.Id,
			expected:  [][]string{},
		},
		{
			description: "UserId in Filename should not match",
			filenames: []string{
				fmt.Sprintf("/%v/%v/%v/file.png", th.BasicChannel.Id, model.NewId(), fileID),
			},
			channelID: th.BasicChannel.Id,
			userID:    th.BasicUser.Id,
			expected:  [][]string{},
		},
		{
			description: "../ in filename should not parse",
			filenames: []string{
				fmt.Sprintf("/%v/%v/%v/../../../file.png", th.BasicChannel.Id, th.BasicUser.Id, fileID),
			},
			channelID: th.BasicChannel.Id,
			userID:    th.BasicUser.Id,
			expected:  [][]string{},
		},
		{
			description: "Should only parse valid filenames",
			filenames: []string{
				fmt.Sprintf("/%v/%v/%v/../otherfile.png", th.BasicChannel.Id, th.BasicUser.Id, fileID),
				fmt.Sprintf("/%v/%v/%v/file.png", th.BasicChannel.Id, th.BasicUser.Id, fileID),
			},
			channelID: th.BasicChannel.Id,
			userID:    th.BasicUser.Id,
			expected: [][]string{
				{
					th.BasicChannel.Id,
					th.BasicUser.Id,
					fileID,
					"file.png",
				},
			},
		},
		{
			description: "Valid Filename should parse",
			filenames: []string{
				fmt.Sprintf("/%v/%v/%v/file.png", th.BasicChannel.Id, th.BasicUser.Id, fileID),
			},
			channelID: th.BasicChannel.Id,
			userID:    th.BasicUser.Id,
			expected: [][]string{
				{
					th.BasicChannel.Id,
					th.BasicUser.Id,
					fileID,
					"file.png",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.description, func(tt *testing.T) {
			result := parseOldFilenames(th.Context, test.filenames, test.channelID, test.userID)
			require.Equal(tt, result, test.expected)
		})
	}
}

func TestGetInfoForFilename(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := th.BasicPost
	teamID := th.BasicTeam.Id

	info := th.App.getInfoForFilename(th.Context, post, teamID, post.ChannelId, post.UserId, "someid", "somefile.png")
	assert.Nil(t, info, "Test non-existent file")
}

func TestFindTeamIdForFilename(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	teamID := th.App.findTeamIdForFilename(th.Context, th.BasicPost, "someid", "somefile.png")
	assert.Equal(t, th.BasicTeam.Id, teamID)

	_, err := th.App.CreateTeamWithUser(th.Context, &model.Team{Email: th.BasicUser.Email, Name: "zz" + model.NewId(), DisplayName: "Joram's Test Team", Type: model.TeamOpen}, th.BasicUser.Id)
	require.Nil(t, err)

	teamID = th.App.findTeamIdForFilename(th.Context, th.BasicPost, "someid", "somefile.png")
	assert.Equal(t, "", teamID)
}

func TestMigrateFilenamesToFileInfos(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := th.BasicPost
	infos := th.App.MigrateFilenamesToFileInfos(th.Context, post)
	assert.Equal(t, 0, len(infos))

	post.Filenames = []string{fmt.Sprintf("/%v/%v/%v/blargh.png", th.BasicChannel.Id, th.BasicUser.Id, "someid")}
	infos = th.App.MigrateFilenamesToFileInfos(th.Context, post)
	assert.Equal(t, 0, len(infos))

	path, _ := fileutils.FindDir("tests")
	file, fileErr := os.Open(filepath.Join(path, "test.png"))
	require.NoError(t, fileErr)
	defer file.Close()

	fileID := model.NewId()
	fpath := fmt.Sprintf("/teams/%v/channels/%v/users/%v/%v/test.png", th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, fileID)
	_, err := th.App.WriteFile(file, fpath)
	require.Nil(t, err)
	rpost, err := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Filenames: []string{fmt.Sprintf("/%v/%v/%v/test.png", th.BasicChannel.Id, th.BasicUser.Id, fileID)}}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)

	infos = th.App.MigrateFilenamesToFileInfos(th.Context, rpost)
	assert.Equal(t, 1, len(infos))

	rpost, err = th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Filenames: []string{fmt.Sprintf("/%v/%v/%v/../../test.png", th.BasicChannel.Id, th.BasicUser.Id, fileID)}}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)

	infos = th.App.MigrateFilenamesToFileInfos(th.Context, rpost)
	assert.Equal(t, 0, len(infos))
}

func TestCreateZipFileAndAddFiles(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	const (
		zipName   = "zip-file-name-to-heaven.zip"
		directory = "directory-to-heaven"
	)

	t.Run("write file fails", func(t *testing.T) {
		mockBackend := filesStoreMocks.FileBackend{}
		mockBackend.On("WriteFile", mock.Anything, path.Join(directory, zipName)).Return(int64(666), errors.New("only those who dare to fail greatly can ever achieve greatly"))

		err := th.App.CreateZipFileAndAddFiles(&mockBackend, []model.FileData{}, zipName, directory)

		require.Error(t, err)
		require.Equal(t, err.Error(), "only those who dare to fail greatly can ever achieve greatly")
	})

	t.Run("write no file", func(t *testing.T) {
		mockBackend := filesStoreMocks.FileBackend{}
		mockBackend.On("WriteFile", mock.Anything, path.Join(directory, zipName)).Return(int64(666), nil)
		err := th.App.CreateZipFileAndAddFiles(&mockBackend, []model.FileData{}, zipName, directory)
		require.NoError(t, err)
	})

	t.Run("write one file", func(t *testing.T) {
		mockBackend := filesStoreMocks.FileBackend{}
		mockBackend.On("WriteFile", mock.Anything, path.Join(directory, zipName)).Return(int64(666), nil).Run(func(args mock.Arguments) {
			r, err := zip.OpenReader(zipName)
			require.NoError(t, err)
			require.Len(t, r.File, 1)

			file := r.File[0]
			assert.Equal(t, "file1", file.Name)
			now := time.Now().Truncate(time.Second) // Files are stored with a second precision
			// Confirm that the file was created in the last 10 seconds
			assert.GreaterOrEqual(t, file.Modified, now.Add(-10*time.Second))
			assert.GreaterOrEqual(t, now, file.Modified)

			fr, err := file.Open()
			require.NoError(t, err)
			b, err := io.ReadAll(fr)
			require.NoError(t, err)
			assert.Equal(t, []byte("content1"), b)
		})
		err := th.App.CreateZipFileAndAddFiles(&mockBackend, []model.FileData{
			{
				Filename: "file1",
				Body:     []byte("content1"),
			},
		}, zipName, directory)
		require.NoError(t, err)
	})
}

func TestCopyFileInfos(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	teamID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()
	filename := "test"
	data := []byte("abcd")

	info1, err := th.App.DoUploadFile(th.Context, time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamID, channelID, userID, filename, data, true)
	require.Nil(t, err)
	defer func() {
		th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info1.Id)
		th.App.RemoveFile(info1.Path)
	}()

	infoIds, err := th.App.CopyFileInfos(th.Context, userID, []string{info1.Id})
	require.Nil(t, err)

	info2, err := th.App.GetFileInfo(th.Context, infoIds[0])
	require.Nil(t, err)
	defer func() {
		th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info2.Id)
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
		thumbnailName := "thumb.jpg"
		thumbnailPath := filepath.Join(dataPath, thumbnailName)

		// when
		th.App.generateThumbnailImage(th.Context, img, "jpg", thumbnailName)
		defer os.Remove(thumbnailPath)

		// then
		outputImage, err := os.Stat(thumbnailPath)
		assert.NoError(t, err)
		assert.Equal(t, int64(721), outputImage.Size())
	})
}

func createDummyImage() *image.RGBA {
	width := 200
	height := 100
	upperLeftCorner := image.Point{0, 0}
	lowerRightCorner := image.Point{width, height}
	return image.NewRGBA(image.Rectangle{upperLeftCorner, lowerRightCorner})
}

func TestSearchFilesInTeamForUser(t *testing.T) {
	perPage := 5
	searchTerm := "searchTerm"

	setup := func(t *testing.T, enableElasticsearch bool) (*TestHelper, []*model.FileInfo) {
		th := Setup(t).InitBasic()

		fileInfos := make([]*model.FileInfo, 7)
		for i := 0; i < cap(fileInfos); i++ {
			fileInfo, err := th.App.Srv().Store().FileInfo().Save(th.Context,
				&model.FileInfo{
					CreatorId: th.BasicUser.Id,
					PostId:    th.BasicPost.Id,
					ChannelId: th.BasicPost.ChannelId,
					Name:      searchTerm,
					Path:      searchTerm,
					Extension: "jpg",
					MimeType:  "image/jpeg",
				})
			time.Sleep(1 * time.Millisecond)

			require.NoError(t, err)

			fileInfos[i] = fileInfo
		}

		if enableElasticsearch {
			th.App.Srv().SetLicense(model.NewTestLicense("elastic_search"))

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ElasticsearchSettings.EnableIndexing = true
				*cfg.ElasticsearchSettings.EnableSearching = true
			})
		} else {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ElasticsearchSettings.EnableSearching = false
			})
		}

		return th, fileInfos
	}

	t.Run("should return everything as first page of fileInfos from database", func(t *testing.T) {
		th, fileInfos := setup(t, false)
		defer th.TearDown()

		page := 0

		results, err := th.App.SearchFilesInTeamForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

		require.Nil(t, err)
		require.NotNil(t, results)
		assert.Equal(t, []string{
			fileInfos[6].Id,
			fileInfos[5].Id,
			fileInfos[4].Id,
			fileInfos[3].Id,
			fileInfos[2].Id,
			fileInfos[1].Id,
			fileInfos[0].Id,
		}, results.Order)
	})

	t.Run("should not return later pages of fileInfos from database", func(t *testing.T) {
		th, _ := setup(t, false)
		defer th.TearDown()

		page := 1

		results, err := th.App.SearchFilesInTeamForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

		require.Nil(t, err)
		require.NotNil(t, results)
		assert.Equal(t, []string{}, results.Order)
	})

	t.Run("should return first page of fileInfos from ElasticSearch", func(t *testing.T) {
		th, fileInfos := setup(t, true)
		defer th.TearDown()

		page := 0
		resultsPage := []string{
			fileInfos[6].Id,
			fileInfos[5].Id,
			fileInfos[4].Id,
			fileInfos[3].Id,
			fileInfos[2].Id,
		}

		es := &mocks.SearchEngineInterface{}
		es.On("SearchFiles", mock.Anything, mock.Anything, page, perPage).Return(resultsPage, nil)
		es.On("Start").Return(nil).Maybe()
		es.On("IsActive").Return(true)
		es.On("IsSearchEnabled").Return(true)
		th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = es
		defer func() {
			th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = nil
		}()

		results, err := th.App.SearchFilesInTeamForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

		require.Nil(t, err)
		require.NotNil(t, results)
		assert.Equal(t, resultsPage, results.Order)
		es.AssertExpectations(t)
	})

	t.Run("should return later pages of fileInfos from ElasticSearch", func(t *testing.T) {
		th, fileInfos := setup(t, true)
		defer th.TearDown()

		page := 1
		resultsPage := []string{
			fileInfos[1].Id,
			fileInfos[0].Id,
		}

		es := &mocks.SearchEngineInterface{}
		es.On("SearchFiles", mock.Anything, mock.Anything, page, perPage).Return(resultsPage, nil)
		es.On("Start").Return(nil).Maybe()
		es.On("IsActive").Return(true)
		es.On("IsSearchEnabled").Return(true)
		th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = es
		defer func() {
			th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = nil
		}()

		results, err := th.App.SearchFilesInTeamForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

		require.Nil(t, err)
		require.NotNil(t, results)
		assert.Equal(t, resultsPage, results.Order)
		es.AssertExpectations(t)
	})

	t.Run("should fall back to database if ElasticSearch fails on first page", func(t *testing.T) {
		th, fileInfos := setup(t, true)
		defer th.TearDown()

		page := 0

		es := &mocks.SearchEngineInterface{}
		es.On("SearchFiles", mock.Anything, mock.Anything, page, perPage).Return(nil, &model.AppError{})
		es.On("GetName").Return("mock")
		es.On("Start").Return(nil).Maybe()
		es.On("IsActive").Return(true)
		es.On("IsSearchEnabled").Return(true)
		th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = es
		defer func() {
			th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = nil
		}()

		results, err := th.App.SearchFilesInTeamForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

		require.Nil(t, err)
		require.NotNil(t, results)
		assert.Equal(t, []string{
			fileInfos[6].Id,
			fileInfos[5].Id,
			fileInfos[4].Id,
			fileInfos[3].Id,
			fileInfos[2].Id,
			fileInfos[1].Id,
			fileInfos[0].Id,
		}, results.Order)
		es.AssertExpectations(t)
	})

	t.Run("should return nothing if ElasticSearch fails on later pages", func(t *testing.T) {
		th, _ := setup(t, true)
		defer th.TearDown()

		page := 1

		es := &mocks.SearchEngineInterface{}
		es.On("SearchFiles", mock.Anything, mock.Anything, page, perPage).Return(nil, &model.AppError{})
		es.On("GetName").Return("mock")
		es.On("Start").Return(nil).Maybe()
		es.On("IsActive").Return(true)
		es.On("IsSearchEnabled").Return(true)
		th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = es
		defer func() {
			th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = nil
		}()

		results, err := th.App.SearchFilesInTeamForUser(th.Context, searchTerm, th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, page, perPage)

		require.Nil(t, err)
		assert.Equal(t, []string{}, results.Order)
		es.AssertExpectations(t)
	})
}

func TestExtractContentFromFileInfo(t *testing.T) {
	app := &App{}
	fi := &model.FileInfo{
		MimeType: "image/jpeg",
	}

	// Test that we don't process images.
	require.NoError(t, app.ExtractContentFromFileInfo(request.TestContext(t), fi))
}

func TestGetLastAccessibleFileTime(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	r, err := th.App.GetLastAccessibleFileTime()
	require.Nil(t, err)
	assert.Equal(t, int64(0), r)

	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

	mockStore := th.App.Srv().Store().(*storemocks.Store)

	mockSystemStore := storemocks.SystemStore{}
	mockStore.On("System").Return(&mockSystemStore)
	mockSystemStore.On("GetByName", mock.Anything).Return(nil, store.NewErrNotFound("", ""))
	r, err = th.App.GetLastAccessibleFileTime()
	require.Nil(t, err)
	assert.Equal(t, int64(0), r)

	mockSystemStore = storemocks.SystemStore{}
	mockStore.On("System").Return(&mockSystemStore)
	mockSystemStore.On("GetByName", mock.Anything).Return(nil, errors.New("test"))
	_, err = th.App.GetLastAccessibleFileTime()
	require.NotNil(t, err)

	mockSystemStore = storemocks.SystemStore{}
	mockStore.On("System").Return(&mockSystemStore)
	mockSystemStore.On("GetByName", mock.Anything).Return(&model.System{Name: model.SystemLastAccessibleFileTime, Value: "10"}, nil)
	r, err = th.App.GetLastAccessibleFileTime()
	require.Nil(t, err)
	assert.Equal(t, int64(10), r)
}

func TestComputeLastAccessibleFileTime(t *testing.T) {
	t.Run("Updates the time, if cloud limit is applicable", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &eMocks.CloudInterface{}
		th.App.Srv().Cloud = cloud

		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(&model.ProductLimits{
			Files: &model.FilesLimits{
				TotalStorage: model.NewPointer(int64(1)),
			},
		}, nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockFileStore := storemocks.FileInfoStore{}
		mockFileStore.On("GetUptoNSizeFileTime", mock.Anything).Return(int64(1), nil)
		mockSystemStore := storemocks.SystemStore{}
		mockSystemStore.On("SaveOrUpdate", mock.Anything).Return(nil)
		mockStore.On("FileInfo").Return(&mockFileStore)
		mockStore.On("System").Return(&mockSystemStore)

		err := th.App.ComputeLastAccessibleFileTime()
		require.NoError(t, err)

		mockSystemStore.AssertCalled(t, "SaveOrUpdate", mock.Anything)
	})

	t.Run("Removes the time, if cloud limit is not applicable", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &eMocks.CloudInterface{}
		th.App.Srv().Cloud = cloud

		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(nil, nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockFileStore := storemocks.FileInfoStore{}
		mockFileStore.On("GetUptoNSizeFileTime", mock.Anything).Return(int64(1), nil)
		mockSystemStore := storemocks.SystemStore{}
		mockSystemStore.On("GetByName", mock.Anything).Return(&model.System{Name: model.SystemLastAccessibleFileTime, Value: "10"}, nil)
		mockSystemStore.On("PermanentDeleteByName", mock.Anything).Return(nil, nil)
		mockSystemStore.On("SaveOrUpdate", mock.Anything).Return(nil)
		mockStore.On("FileInfo").Return(&mockFileStore)
		mockStore.On("System").Return(&mockSystemStore)

		err := th.App.ComputeLastAccessibleFileTime()
		require.NoError(t, err)

		mockSystemStore.AssertNotCalled(t, "SaveOrUpdate", mock.Anything)
		mockSystemStore.AssertCalled(t, "PermanentDeleteByName", mock.Anything)
	})
}

func TestSetFileSearchableContent(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	fileInfo, err := th.App.Srv().Store().FileInfo().Save(th.Context,
		&model.FileInfo{
			CreatorId: th.BasicUser.Id,
			PostId:    th.BasicPost.Id,
			ChannelId: th.BasicPost.ChannelId,
			Name:      "test",
			Path:      "test",
			Extension: "jpg",
			MimeType:  "image/jpeg",
		})
	require.NoError(t, err)

	result, appErr := th.App.SearchFilesInTeamForUser(th.Context, "searchable", th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, 0, 60)
	require.Nil(t, appErr)
	assert.Equal(t, 0, len(result.Order))

	appErr = th.App.SetFileSearchableContent(th.Context, fileInfo.Id, "searchable")
	require.Nil(t, appErr)

	result, appErr = th.App.SearchFilesInTeamForUser(th.Context, "searchable", th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, 0, 60)
	require.Nil(t, appErr)
	assert.Equal(t, 1, len(result.Order))
}

func TestPermanentDeleteFilesByPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should delete files for post", func(t *testing.T) {
		// Create a post with a file attachment.
		teamID := th.BasicTeam.Id
		channelID := th.BasicChannel.Id
		userID := th.BasicUser.Id
		filename := "test"
		data := []byte("abcd")

		info1, err := th.App.DoUploadFile(th.Context, time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamID, channelID, userID, filename, data, true)
		require.Nil(t, err)

		post := &model.Post{
			Message:       "asd",
			ChannelId:     channelID,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        userID,
			CreateAt:      0,
			FileIds:       []string{info1.Id},
		}

		post, err = th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		assert.Nil(t, err)

		err = th.App.PermanentDeleteFilesByPost(th.Context, post.Id)
		require.Nil(t, err)

		_, err = th.App.GetFileInfo(th.Context, info1.Id)
		require.NotNil(t, err)
	})

	t.Run("should not delete files for post that doesn't exist", func(t *testing.T) {
		err := th.App.PermanentDeleteFilesByPost(th.Context, "postId1")
		assert.Nil(t, err)
	})

	t.Run("should handle empty file list", func(t *testing.T) {
		post := &model.Post{
			Message:       "asd",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			CreateAt:      0,
		}

		post, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		assert.Nil(t, err)

		err = th.App.PermanentDeleteFilesByPost(th.Context, post.Id)
		assert.Nil(t, err)
	})
}
