// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFileInfoStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Cleanup(func() {
		s.GetMaster().Exec("TRUNCATE FileInfo")
	})
	t.Run("FileInfoSaveGet", func(t *testing.T) { testFileInfoSaveGet(t, rctx, ss) })
	t.Run("FileInfoSaveGetByPath", func(t *testing.T) { testFileInfoSaveGetByPath(t, rctx, ss) })
	t.Run("FileInfoGetForPost", func(t *testing.T) { testFileInfoGetForPost(t, rctx, ss) })
	t.Run("FileInfoGetForUser", func(t *testing.T) { testFileInfoGetForUser(t, rctx, ss) })
	t.Run("FileInfoGetWithOptions", func(t *testing.T) { testFileInfoGetWithOptions(t, rctx, ss) })
	t.Run("FileInfoAttachToPost", func(t *testing.T) { testFileInfoAttachToPost(t, rctx, ss) })
	t.Run("FileInfoDeleteForPost", func(t *testing.T) { testFileInfoDeleteForPost(t, rctx, ss) })
	t.Run("FileInfoPermanentDelete", func(t *testing.T) { testFileInfoPermanentDelete(t, rctx, ss) })
	t.Run("FileInfoPermanentDeleteBatch", func(t *testing.T) { testFileInfoPermanentDeleteBatch(t, rctx, ss) })
	t.Run("FileInfoPermanentDeleteByUser", func(t *testing.T) { testFileInfoPermanentDeleteByUser(t, rctx, ss) })
	t.Run("FileInfoUpdateMinipreview", func(t *testing.T) { testFileInfoUpdateMinipreview(t, rctx, ss) })
	t.Run("GetFilesBatchForIndexing", func(t *testing.T) { testFileInfoStoreGetFilesBatchForIndexing(t, rctx, ss) })
	t.Run("CountAll", func(t *testing.T) { testFileInfoStoreCountAll(t, rctx, ss) })
	t.Run("GetStorageUsage", func(t *testing.T) { testFileInfoGetStorageUsage(t, rctx, ss) })
	t.Run("GetUptoNSizeFileTime", func(t *testing.T) { testGetUptoNSizeFileTime(t, rctx, ss, s) })
	t.Run("FileInfoPermanentDeleteForPost", func(t *testing.T) { testPermanentDeleteForPost(t, rctx, ss) })
	t.Run("FileInfoGetByIds", func(t *testing.T) { testGetByIds(t, rctx, ss) })
	t.Run("FileInfoDeleteForPostByIds", func(t *testing.T) { testDeleteForPostByIds(t, rctx, ss) })
	t.Run("FileInfoRestoreForPostByIds", func(t *testing.T) { testRestoreUndeleteForPostByIds(t, rctx, ss) })
}

func testFileInfoSaveGet(t *testing.T, rctx request.CTX, ss store.Store) {
	info := &model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "file.txt",
	}

	info, err := ss.FileInfo().Save(rctx, info)
	require.NoError(t, err)
	require.NotEqual(t, len(info.Id), 0)

	defer func() {
		ss.FileInfo().PermanentDelete(rctx, info.Id)
	}()

	rinfo, err := ss.FileInfo().Get(info.Id)
	require.NoError(t, err)
	require.Equal(t, info.Id, rinfo.Id)

	info2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "file.txt",
		DeleteAt:  123,
	})
	require.NoError(t, err)

	_, err = ss.FileInfo().Get(info2.Id)
	assert.Error(t, err)

	defer func() {
		ss.FileInfo().PermanentDelete(rctx, info2.Id)
	}()
}

func testFileInfoSaveGetByPath(t *testing.T, rctx request.CTX, ss store.Store) {
	info := &model.FileInfo{
		CreatorId: model.NewId(),
		Path:      fmt.Sprintf("%v/file.txt", model.NewId()),
	}

	info, err := ss.FileInfo().Save(rctx, info)
	require.NoError(t, err)
	assert.NotEqual(t, len(info.Id), 0)
	defer func() {
		ss.FileInfo().PermanentDelete(rctx, info.Id)
	}()

	rinfo, err := ss.FileInfo().GetByPath(info.Path)
	require.NoError(t, err)
	assert.Equal(t, info.Id, rinfo.Id)

	info2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "file.txt",
		DeleteAt:  123,
	})
	require.NoError(t, err)

	_, err = ss.FileInfo().GetByPath(info2.Id)
	assert.Error(t, err)

	defer func() {
		ss.FileInfo().PermanentDelete(rctx, info2.Id)
	}()
}

func testFileInfoGetForPost(t *testing.T, rctx request.CTX, ss store.Store) {
	userID := model.NewId()
	postID := model.NewId()
	channelID := model.NewId()

	infos := []*model.FileInfo{
		{
			PostId:    postID,
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
		},
		{
			PostId:    postID,
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
		},
		{
			PostId:    postID,
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
			DeleteAt:  123,
		},
		{
			PostId:    model.NewId(),
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
		},
	}

	for i, info := range infos {
		newInfo, err := ss.FileInfo().Save(rctx, info)
		require.NoError(t, err)
		infos[i] = newInfo
		defer func(id string) {
			ss.FileInfo().PermanentDelete(rctx, id)
		}(newInfo.Id)
	}

	testCases := []struct {
		Name           string
		PostID         string
		ReadFromMaster bool
		IncludeDeleted bool
		AllowFromCache bool
		ExpectedPosts  int
	}{
		{
			Name:           "Fetch from master, without deleted and without cache",
			PostID:         postID,
			ReadFromMaster: true,
			IncludeDeleted: false,
			AllowFromCache: false,
			ExpectedPosts:  2,
		},
		{
			Name:           "Fetch from master, with deleted and without cache",
			PostID:         postID,
			ReadFromMaster: true,
			IncludeDeleted: true,
			AllowFromCache: false,
			ExpectedPosts:  3,
		},
		{
			Name:           "Fetch from master, with deleted and with cache",
			PostID:         postID,
			ReadFromMaster: true,
			IncludeDeleted: true,
			AllowFromCache: true,
			ExpectedPosts:  3,
		},
		{
			Name:           "Fetch from replica, without deleted and without cache",
			PostID:         postID,
			ReadFromMaster: false,
			IncludeDeleted: false,
			AllowFromCache: false,
			ExpectedPosts:  2,
		},
		{
			Name:           "Fetch from replica, with deleted and without cache",
			PostID:         postID,
			ReadFromMaster: false,
			IncludeDeleted: true,
			AllowFromCache: false,
			ExpectedPosts:  3,
		},
		{
			Name:           "Fetch from replica, with deleted and without cache",
			PostID:         postID,
			ReadFromMaster: false,
			IncludeDeleted: true,
			AllowFromCache: true,
			ExpectedPosts:  3,
		},
		{
			Name:           "Fetch from replica, without deleted and with cache",
			PostID:         postID,
			ReadFromMaster: true,
			IncludeDeleted: false,
			AllowFromCache: true,
			ExpectedPosts:  2,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			postInfos, err := ss.FileInfo().GetForPost(
				tc.PostID,
				tc.ReadFromMaster,
				tc.IncludeDeleted,
				tc.AllowFromCache,
			)
			require.NoError(t, err)
			assert.Len(t, postInfos, tc.ExpectedPosts)
		})
	}
}

func testFileInfoGetForUser(t *testing.T, rctx request.CTX, ss store.Store) {
	userID := model.NewId()
	userID2 := model.NewId()
	postID := model.NewId()
	channelID := model.NewId()

	infos := []*model.FileInfo{
		{
			PostId:    postID,
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
		},
		{
			PostId:    postID,
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
		},
		{
			PostId:    postID,
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
		},
		{
			PostId:    model.NewId(),
			ChannelId: channelID,
			CreatorId: userID2,
			Path:      "file.txt",
		},
	}

	for i, info := range infos {
		newInfo, err := ss.FileInfo().Save(rctx, info)
		require.NoError(t, err)
		infos[i] = newInfo
		defer func(id string) {
			ss.FileInfo().PermanentDelete(rctx, id)
		}(newInfo.Id)
	}

	userPosts, err := ss.FileInfo().GetForUser(userID)
	require.NoError(t, err)
	assert.Len(t, userPosts, 3)

	userPosts, err = ss.FileInfo().GetForUser(userID2)
	require.NoError(t, err)
	assert.Len(t, userPosts, 1)
}

func testFileInfoGetWithOptions(t *testing.T, rctx request.CTX, ss store.Store) {
	makePost := func(chId string, user string) *model.Post {
		post := model.Post{}
		post.ChannelId = chId
		post.UserId = user
		_, err := ss.Post().Save(rctx, &post)
		require.NoError(t, err)
		return &post
	}

	makeFile := func(post *model.Post, user string, createAt int64, idPrefix string) model.FileInfo {
		id := model.NewId()
		id = idPrefix + id[1:] // hacky way to get sortable Ids to confirm secondary Id sort works
		fileInfo := model.FileInfo{
			Id:        id,
			CreatorId: user,
			Path:      "file.txt",
			CreateAt:  createAt,
		}
		if post.Id != "" {
			fileInfo.PostId = post.Id
		}
		if post.ChannelId != "" {
			fileInfo.ChannelId = post.ChannelId
		}
		_, err := ss.FileInfo().Save(rctx, &fileInfo)
		require.NoError(t, err)
		return fileInfo
	}

	userID1 := model.NewId()
	userID2 := model.NewId()

	channelID1 := model.NewId()
	channelID2 := model.NewId()
	channelID3 := model.NewId()

	post1_1 := makePost(channelID1, userID1) // post 1 by user 1
	post1_2 := makePost(channelID3, userID1) // post 2 by user 1
	post2_1 := makePost(channelID2, userID2)
	post2_2 := makePost(channelID3, userID2)

	epoch := time.Date(2020, 1, 1, 1, 1, 1, 1, time.UTC)
	file1_1 := makeFile(post1_1, userID1, epoch.AddDate(0, 0, 1).Unix(), "a")       // file 1 by user 1
	file1_2 := makeFile(post1_2, userID1, epoch.AddDate(0, 0, 2).Unix(), "b")       // file 2 by user 1
	file1_3 := makeFile(&model.Post{}, userID1, epoch.AddDate(0, 0, 3).Unix(), "c") // file that is not attached to a post
	file2_1 := makeFile(post2_1, userID2, epoch.AddDate(0, 0, 4).Unix(), "d")       // file 2 by user 1
	file2_2 := makeFile(post2_2, userID2, epoch.AddDate(0, 0, 5).Unix(), "e")

	// delete a file
	_, err := ss.FileInfo().DeleteForPost(rctx, file2_2.PostId)
	require.NoError(t, err)

	testCases := []struct {
		Name            string
		Page, PerPage   int
		Opt             *model.GetFileInfosOptions
		ExpectedFileIds []string
	}{
		{
			Name:            "Get files with nil option",
			Page:            0,
			PerPage:         10,
			Opt:             nil,
			ExpectedFileIds: []string{file1_1.Id, file1_2.Id, file1_3.Id, file2_1.Id},
		},
		{
			Name:            "Get files including deleted",
			Page:            0,
			PerPage:         10,
			Opt:             &model.GetFileInfosOptions{IncludeDeleted: true},
			ExpectedFileIds: []string{file1_1.Id, file1_2.Id, file1_3.Id, file2_1.Id, file2_2.Id},
		},
		{
			Name:    "Get files including deleted filtered by channel",
			Page:    0,
			PerPage: 10,
			Opt: &model.GetFileInfosOptions{
				IncludeDeleted: true,
				ChannelIds:     []string{channelID3},
			},
			ExpectedFileIds: []string{file1_2.Id, file2_2.Id},
		},
		{
			Name:    "Get files including deleted filtered by channel and user",
			Page:    0,
			PerPage: 10,
			Opt: &model.GetFileInfosOptions{
				IncludeDeleted: true,
				UserIds:        []string{userID1},
				ChannelIds:     []string{channelID3},
			},
			ExpectedFileIds: []string{file1_2.Id},
		},
		{
			Name:    "Get files including deleted sorted by created at",
			Page:    0,
			PerPage: 10,
			Opt: &model.GetFileInfosOptions{
				IncludeDeleted: true,
				SortBy:         model.FileinfoSortByCreated,
			},
			ExpectedFileIds: []string{file1_1.Id, file1_2.Id, file1_3.Id, file2_1.Id, file2_2.Id},
		},
		{
			Name:    "Get files filtered by user ordered by created at descending",
			Page:    0,
			PerPage: 10,
			Opt: &model.GetFileInfosOptions{
				UserIds:        []string{userID1},
				SortBy:         model.FileinfoSortByCreated,
				SortDescending: true,
			},
			ExpectedFileIds: []string{file1_3.Id, file1_2.Id, file1_1.Id},
		},
		{
			Name:    "Get all files including deleted ordered by created descending 2nd page of 3 per page ",
			Page:    1,
			PerPage: 3,
			Opt: &model.GetFileInfosOptions{
				IncludeDeleted: true,
				SortBy:         model.FileinfoSortByCreated,
				SortDescending: true,
			},
			ExpectedFileIds: []string{file1_2.Id, file1_1.Id},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			fileInfos, err := ss.FileInfo().GetWithOptions(tc.Page, tc.PerPage, tc.Opt)
			require.NoError(t, err)
			require.Len(t, fileInfos, len(tc.ExpectedFileIds))
			for i := range tc.ExpectedFileIds {
				assert.Equal(t, tc.ExpectedFileIds[i], fileInfos[i].Id)
			}
		})
	}
}

type byFileInfoID []*model.FileInfo

func (a byFileInfoID) Len() int           { return len(a) }
func (a byFileInfoID) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a byFileInfoID) Less(i, j int) bool { return a[i].Id < a[j].Id }

func testFileInfoAttachToPost(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should attach files", func(t *testing.T) {
		userID := model.NewId()
		postID := model.NewId()
		channelID := model.NewId()

		info1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			CreatorId: userID,
			Path:      "file.txt",
		})
		require.NoError(t, err)
		info2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			CreatorId: userID,
			Path:      "file2.txt",
		})
		require.NoError(t, err)

		require.Equal(t, "", info1.PostId)
		require.Equal(t, "", info2.PostId)

		err = ss.FileInfo().AttachToPost(rctx, info1.Id, postID, channelID, userID)
		assert.NoError(t, err)
		info1.PostId = postID
		info1.ChannelId = channelID

		err = ss.FileInfo().AttachToPost(rctx, info2.Id, postID, channelID, userID)
		assert.NoError(t, err)
		info2.PostId = postID
		info2.ChannelId = channelID

		data, err := ss.FileInfo().GetForPost(postID, true, false, false)
		require.NoError(t, err)

		expected := []*model.FileInfo{info1, info2}
		sort.Sort(byFileInfoID(expected))
		sort.Sort(byFileInfoID(data))
		assert.EqualValues(t, expected, data)
	})

	t.Run("should not attach files to multiple posts", func(t *testing.T) {
		userID := model.NewId()
		postID := model.NewId()
		channelID := model.NewId()

		info, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			CreatorId: userID,
			Path:      "file.txt",
		})
		require.NoError(t, err)

		require.Equal(t, "", info.PostId)

		err = ss.FileInfo().AttachToPost(rctx, info.Id, model.NewId(), channelID, userID)
		require.NoError(t, err)

		err = ss.FileInfo().AttachToPost(rctx, info.Id, postID, channelID, userID)
		require.Error(t, err)
	})

	t.Run("should not attach files owned from a different user", func(t *testing.T) {
		userID := model.NewId()
		postID := model.NewId()
		channelID := model.NewId()

		info, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			CreatorId: model.NewId(),
			Path:      "file.txt",
		})
		require.NoError(t, err)

		require.Equal(t, "", info.PostId)

		err = ss.FileInfo().AttachToPost(rctx, info.Id, postID, channelID, userID)
		assert.Error(t, err)
	})

	t.Run("should attach files uploaded by nouser", func(t *testing.T) {
		postID := model.NewId()
		channelID := model.NewId()

		info, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			CreatorId: "nouser",
			Path:      "file.txt",
		})
		require.NoError(t, err)
		assert.Equal(t, "", info.PostId)

		err = ss.FileInfo().AttachToPost(rctx, info.Id, postID, channelID, model.NewId())
		require.NoError(t, err)

		data, err := ss.FileInfo().GetForPost(postID, true, false, false)
		require.NoError(t, err)
		info.PostId = postID
		info.ChannelId = channelID
		assert.EqualValues(t, []*model.FileInfo{info}, data)
	})
}

func testFileInfoDeleteForPost(t *testing.T, rctx request.CTX, ss store.Store) {
	userID := model.NewId()
	postID := model.NewId()
	channelID := model.NewId()

	infos := []*model.FileInfo{
		{
			PostId:    postID,
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
		},
		{
			PostId:    postID,
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
		},
		{
			PostId:    postID,
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
			DeleteAt:  123,
		},
		{
			PostId:    model.NewId(),
			ChannelId: channelID,
			CreatorId: userID,
			Path:      "file.txt",
		},
	}

	for i, info := range infos {
		newInfo, err := ss.FileInfo().Save(rctx, info)
		require.NoError(t, err)
		infos[i] = newInfo
		defer func(id string) {
			ss.FileInfo().PermanentDelete(rctx, id)
		}(newInfo.Id)
	}

	_, err := ss.FileInfo().DeleteForPost(rctx, postID)
	require.NoError(t, err)

	infos, err = ss.FileInfo().GetForPost(postID, true, false, false)
	require.NoError(t, err)
	assert.Empty(t, infos)
}

func testFileInfoPermanentDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	info, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		ChannelId: model.NewId(),
		CreatorId: model.NewId(),
		Path:      "file.txt",
	})
	require.NoError(t, err)

	err = ss.FileInfo().PermanentDelete(rctx, info.Id)
	require.NoError(t, err)
}

func testFileInfoPermanentDeleteBatch(t *testing.T, rctx request.CTX, ss store.Store) {
	postID := model.NewId()
	channelID := model.NewId()

	_, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    postID,
		ChannelId: channelID,
		CreatorId: model.NewId(),
		Path:      "file.txt",
		CreateAt:  1000,
	})
	require.NoError(t, err)

	_, err = ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    postID,
		ChannelId: channelID,
		CreatorId: model.NewId(),
		Path:      "file.txt",
		CreateAt:  1200,
	})
	require.NoError(t, err)

	_, err = ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    postID,
		ChannelId: channelID,
		CreatorId: model.NewId(),
		Path:      "file.txt",
		CreateAt:  2000,
	})
	require.NoError(t, err)

	bookmarkFile, err := ss.FileInfo().Save(rctx, &model.FileInfo{ // should not be deleted
		PostId:    postID,
		ChannelId: channelID,
		CreatorId: model.BookmarkFileOwner,
		Path:      "file.txt",
		CreateAt:  1000,
	})
	defer ss.FileInfo().PermanentDelete(rctx, bookmarkFile.Id)
	require.NoError(t, err)

	postFiles, err := ss.FileInfo().GetForPost(postID, true, false, false)
	require.NoError(t, err)
	assert.Len(t, postFiles, 4)

	_, err = ss.FileInfo().PermanentDeleteBatch(rctx, 1500, 1000)
	require.NoError(t, err)

	postFiles, err = ss.FileInfo().GetForPost(postID, true, false, false)
	require.NoError(t, err)
	assert.Len(t, postFiles, 2)
}

func testFileInfoPermanentDeleteByUser(t *testing.T, rctx request.CTX, ss store.Store) {
	userID := model.NewId()
	postID := model.NewId()
	channelID := model.NewId()

	_, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    postID,
		ChannelId: channelID,
		CreatorId: userID,
		Path:      "file.txt",
	})
	require.NoError(t, err)

	_, err = ss.FileInfo().PermanentDeleteByUser(rctx, userID)
	require.NoError(t, err)
}

func testFileInfoUpdateMinipreview(t *testing.T, rctx request.CTX, ss store.Store) {
	info := &model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "image.png",
	}

	info, err := ss.FileInfo().Save(rctx, info)
	require.NoError(t, err)
	require.NotEqual(t, len(info.Id), 0)

	defer func() {
		ss.FileInfo().PermanentDelete(rctx, info.Id)
	}()

	rinfo, err := ss.FileInfo().Get(info.Id)
	require.NoError(t, err)
	require.Equal(t, info.Id, rinfo.Id)
	require.Nil(t, rinfo.MiniPreview)

	miniPreview := []byte{0x0, 0x1, 0x2}

	rinfo.MiniPreview = &miniPreview

	rinfo, err = ss.FileInfo().Upsert(rctx, rinfo)
	require.NoError(t, err)
	require.Equal(t, info.Id, rinfo.Id)

	tinfo, err := ss.FileInfo().Get(info.Id)
	require.NoError(t, err)
	require.Equal(t, info.Id, tinfo.Id)
	require.Equal(t, *tinfo.MiniPreview, miniPreview)
}

func testFileInfoStoreGetFilesBatchForIndexing(t *testing.T, rctx request.CTX, ss store.Store) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.ChannelTypeOpen
	c1, _ = ss.Channel().Save(rctx, c1, -1)

	c2 := &model.Channel{}
	c2.TeamId = model.NewId()
	c2.DisplayName = "Channel2"
	c2.Name = "zz" + model.NewId() + "b"
	c2.Type = model.ChannelTypeOpen
	c2, _ = ss.Channel().Save(rctx, c2, -1)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1, err := ss.Post().Save(rctx, o1)
	require.NoError(t, err)
	f1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    o1.Id,
		ChannelId: o1.ChannelId,
		CreatorId: model.NewId(),
		Path:      "file1.txt",
	})
	require.NoError(t, err)
	defer func() {
		ss.FileInfo().PermanentDelete(rctx, f1.Id)
	}()
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = c2.Id
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "CCCCCCCCC"
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	f2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    o2.Id,
		ChannelId: o2.ChannelId,
		CreatorId: model.NewId(),
		Path:      "file2.txt",
	})
	require.NoError(t, err)
	defer func() {
		ss.FileInfo().PermanentDelete(rctx, f2.Id)
	}()
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = c1.Id
	o3.UserId = model.NewId()
	o3.RootId = o1.Id
	o3.Message = "zz" + model.NewId() + "QQQQQQQQQQ"
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	f3, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    o3.Id,
		ChannelId: o3.ChannelId,
		CreatorId: model.NewId(),
		Path:      "file3.txt",
	})
	require.NoError(t, err)
	defer func() {
		ss.FileInfo().PermanentDelete(rctx, f3.Id)
	}()

	// Soft-deleting one file info
	_, err = ss.FileInfo().DeleteForPost(rctx, f1.PostId)
	require.NoError(t, err)

	// Getting all
	r, err := ss.FileInfo().GetFilesBatchForIndexing(f1.CreateAt-1, "", true, 100)
	require.NoError(t, err)
	require.Len(t, r, 3, "Expected 3 posts in results. Got %v", len(r))

	r, err = ss.FileInfo().GetFilesBatchForIndexing(f1.CreateAt-1, "", false, 100)
	require.NoError(t, err)
	require.Len(t, r, 2, "Expected 2 posts in results. Got %v", len(r))

	// Testing pagination
	r, err = ss.FileInfo().GetFilesBatchForIndexing(f1.CreateAt-1, "", true, 2)
	require.NoError(t, err)
	require.Len(t, r, 2, "Expected 2 posts in results. Got %v", len(r))

	r, err = ss.FileInfo().GetFilesBatchForIndexing(r[1].CreateAt, r[1].Id, true, 2)
	require.NoError(t, err)
	require.Len(t, r, 1, "Expected 1 post in results. Got %v", len(r))

	r, err = ss.FileInfo().GetFilesBatchForIndexing(r[0].CreateAt, r[0].Id, true, 2)
	require.NoError(t, err)
	require.Len(t, r, 0, "Expected 0 posts in results. Got %v", len(r))
}

func testFileInfoStoreCountAll(t *testing.T, rctx request.CTX, ss store.Store) {
	_, err := ss.FileInfo().PermanentDeleteBatch(rctx, model.GetMillis(), 100000)
	require.NoError(t, err)
	f1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		ChannelId: model.NewId(),
		CreatorId: model.NewId(),
		Path:      "file1.txt",
	})
	require.NoError(t, err)

	_, err = ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		ChannelId: model.NewId(),
		CreatorId: model.NewId(),
		Path:      "file2.txt",
	})
	require.NoError(t, err)
	_, err = ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		ChannelId: model.NewId(),
		CreatorId: model.NewId(),
		Path:      "file3.txt",
	})
	require.NoError(t, err)

	require.NoError(t, ss.FileInfo().RefreshFileStats())
	count, err := ss.FileInfo().CountAll()
	require.NoError(t, err)
	require.Equal(t, int64(3), count)

	_, err = ss.FileInfo().DeleteForPost(rctx, f1.PostId)
	require.NoError(t, err)

	require.NoError(t, ss.FileInfo().RefreshFileStats())
	count, err = ss.FileInfo().CountAll()
	require.NoError(t, err)
	require.Equal(t, int64(2), count)
}

func testFileInfoGetStorageUsage(t *testing.T, rctx request.CTX, ss store.Store) {
	_, err := ss.FileInfo().PermanentDeleteBatch(rctx, model.GetMillis(), 100000)
	require.NoError(t, err)

	require.NoError(t, ss.FileInfo().RefreshFileStats())
	usage, err := ss.FileInfo().GetStorageUsage(false, false)
	require.NoError(t, err)
	require.Equal(t, int64(0), usage)

	f1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		CreatorId: model.NewId(),
		Size:      10,
		Path:      "file1.txt",
	})
	require.NoError(t, err)

	_, err = ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		CreatorId: model.NewId(),
		Size:      10,
		Path:      "file2.txt",
	})
	require.NoError(t, err)
	_, err = ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		CreatorId: model.NewId(),
		Size:      10,
		Path:      "file3.txt",
	})
	require.NoError(t, err)

	require.NoError(t, ss.FileInfo().RefreshFileStats())
	usage, err = ss.FileInfo().GetStorageUsage(false, false)
	require.NoError(t, err)
	require.Equal(t, int64(30), usage)

	_, err = ss.FileInfo().DeleteForPost(rctx, f1.PostId)
	require.NoError(t, err)
	require.NoError(t, ss.FileInfo().RefreshFileStats())
	usage, err = ss.FileInfo().GetStorageUsage(false, false)
	require.NoError(t, err)
	require.Equal(t, int64(20), usage)

	usage, err = ss.FileInfo().GetStorageUsage(false, true)
	require.NoError(t, err)
	require.Equal(t, int64(30), usage)
}

func testGetUptoNSizeFileTime(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Skip("MM-53905")

	_, err := ss.FileInfo().GetUptoNSizeFileTime(0)
	assert.Error(t, err)
	_, err = ss.FileInfo().GetUptoNSizeFileTime(-1)
	assert.Error(t, err)

	_, err = ss.FileInfo().PermanentDeleteBatch(rctx, model.GetMillis(), 100000)
	require.NoError(t, err)

	diff := int64(10000)
	now := utils.MillisFromTime(time.Now()) + diff

	f1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		CreatorId: model.NewId(),
		Size:      10,
		Path:      "file1.txt",
		CreateAt:  now,
	})
	require.NoError(t, err)
	defer ss.FileInfo().PermanentDelete(rctx, f1.Id)
	now = now + diff
	f2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		CreatorId: model.NewId(),
		Size:      10,
		Path:      "file2.txt",
		CreateAt:  now,
	})
	require.NoError(t, err)
	defer ss.FileInfo().PermanentDelete(rctx, f2.Id)
	now = now + diff
	f3, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		CreatorId: model.NewId(),
		Size:      10,
		Path:      "file3.txt",
		CreateAt:  now,
	})
	require.NoError(t, err)
	defer ss.FileInfo().PermanentDelete(rctx, f3.Id)
	now = now + diff
	tmp, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    model.NewId(),
		CreatorId: model.NewId(),
		Size:      10,
		Path:      "file4.txt",
		CreateAt:  now,
	})
	require.NoError(t, err)
	defer ss.FileInfo().PermanentDelete(rctx, tmp.Id)

	createAt, err := ss.FileInfo().GetUptoNSizeFileTime(20)
	require.NoError(t, err)
	assert.Equal(t, f3.CreateAt, createAt)

	_, err = ss.FileInfo().GetUptoNSizeFileTime(5)
	assert.Error(t, err)
	assert.IsType(t, &store.ErrNotFound{}, err)

	createAt, err = ss.FileInfo().GetUptoNSizeFileTime(1000)
	require.NoError(t, err)
	assert.Equal(t, f1.CreateAt, createAt)

	_, err = ss.FileInfo().DeleteForPost(rctx, f3.PostId)
	require.NoError(t, err)

	createAt, err = ss.FileInfo().GetUptoNSizeFileTime(20)
	require.NoError(t, err)
	assert.Equal(t, f2.CreateAt, createAt)
}

func testPermanentDeleteForPost(t *testing.T, rctx request.CTX, ss store.Store) {
	postId := model.NewId()

	_, err := ss.FileInfo().Save(rctx, &model.FileInfo{
		PostId:    postId,
		CreatorId: model.NewId(),
		Size:      10,
		Path:      "file1.txt",
		CreateAt:  utils.MillisFromTime(time.Now()),
	})
	require.NoError(t, err)

	err = ss.FileInfo().PermanentDeleteForPost(rctx, postId)
	require.NoError(t, err)

	postInfos, err := ss.FileInfo().GetForPost(
		postId,
		true,
		true,
		false,
	)
	require.NoError(t, err)
	assert.Len(t, postInfos, 0)
}

func testGetByIds(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Should get single file info", func(t *testing.T) {
		info, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			CreatorId: model.NewId(),
			Path:      "file.txt",
		})
		require.NoError(t, err)
		require.NotEqual(t, len(info.Id), 0)

		defer func() {
			ss.FileInfo().PermanentDelete(rctx, info.Id)
		}()

		fileInfos, err := ss.FileInfo().GetByIds([]string{info.Id}, false, true)
		require.NoError(t, err)
		require.Len(t, fileInfos, 1)
		require.Equal(t, info.Id, fileInfos[0].Id)
	})

	t.Run("Should get multiple file info", func(t *testing.T) {
		info1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			CreatorId: model.NewId(),
			Path:      "file.txt",
		})
		require.NoError(t, err)
		require.NotEqual(t, len(info1.Id), 0)

		// waiting 1 second to add deterministic difference between the two file info's CreateAt time
		time.Sleep(1 * time.Second)

		info2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			CreatorId: model.NewId(),
			Path:      "file.txt",
		})
		require.NoError(t, err)
		require.NotEqual(t, len(info2.Id), 0)

		defer func() {
			ss.FileInfo().PermanentDelete(rctx, info1.Id)
			ss.FileInfo().PermanentDelete(rctx, info2.Id)
		}()

		fileInfos, err := ss.FileInfo().GetByIds([]string{info1.Id, info2.Id}, false, true)
		require.NoError(t, err)
		require.Len(t, fileInfos, 2)
		require.Equal(t, info1.Id, fileInfos[1].Id)
		require.Equal(t, info2.Id, fileInfos[0].Id)
	})

	t.Run("Should get deleted file infos when specified", func(t *testing.T) {
		postId := model.NewId()

		info1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			CreatorId: model.NewId(),
			Path:      "file.txt",
			PostId:    postId,
		})
		require.NoError(t, err)
		require.NotEqual(t, len(info1.Id), 0)

		// waiting 1 second to add deterministic difference between the two file info's CreateAt time
		time.Sleep(1 * time.Second)

		info2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			CreatorId: model.NewId(),
			Path:      "file.txt",
			PostId:    postId,
		})
		require.NoError(t, err)
		require.NotEqual(t, len(info2.Id), 0)

		defer func() {
			ss.FileInfo().PermanentDelete(rctx, info1.Id)
			ss.FileInfo().PermanentDelete(rctx, info2.Id)
		}()

		// we'll delete the two file infos
		_, err = ss.FileInfo().DeleteForPost(rctx, postId)
		require.NoError(t, err)

		fileInfosIncludingDeleted, err := ss.FileInfo().GetByIds([]string{info1.Id, info2.Id}, true, true)
		require.NoError(t, err)
		require.Len(t, fileInfosIncludingDeleted, 2)
		require.Equal(t, info2.Id, fileInfosIncludingDeleted[0].Id)
		require.Greater(t, fileInfosIncludingDeleted[0].DeleteAt, int64(0))
		require.Equal(t, info1.Id, fileInfosIncludingDeleted[1].Id)
		require.Greater(t, fileInfosIncludingDeleted[1].DeleteAt, int64(0))

		// verifying that the file infos are not returned when IncludeDeleted is false
		fileInfosExcludingDeleted, err := ss.FileInfo().GetByIds([]string{info1.Id, info2.Id}, false, true)
		require.NoError(t, err)
		require.Len(t, fileInfosExcludingDeleted, 0)
	})
}

func testDeleteForPostByIds(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("base case", func(t *testing.T) {
		now := model.GetMillis()
		postId := model.NewId()

		fileInfo1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo1.Id)

		fileInfo2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file2.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo2.Id)

		fileInfo3, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo3.Id)

		err = ss.FileInfo().DeleteForPostByIds(rctx, postId, []string{fileInfo1.Id, fileInfo2.Id})
		require.NoError(t, err)

		fileInfos, err := ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			if fileInfo.Id == fileInfo1.Id || fileInfo.Id == fileInfo2.Id {
				require.Greater(t, fileInfo.DeleteAt, int64(0))
			} else {
				require.Equal(t, int64(0), fileInfo.DeleteAt)
			}
		}
	})

	t.Run("with empty array", func(t *testing.T) {
		now := model.GetMillis()
		postId := model.NewId()

		fileInfo1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo1.Id)

		fileInfo2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file2.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo2.Id)

		fileInfo3, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo3.Id)

		err = ss.FileInfo().DeleteForPostByIds(rctx, postId, []string{})
		require.NoError(t, err)

		fileInfos, err := ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			require.Equal(t, int64(0), fileInfo.DeleteAt)
		}
	})

	t.Run("duplicate fileInfo Ids specified", func(t *testing.T) {
		now := model.GetMillis()
		postId := model.NewId()

		fileInfo1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo1.Id)

		fileInfo2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file2.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo2.Id)

		fileInfo3, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo3.Id)

		err = ss.FileInfo().DeleteForPostByIds(rctx, postId, []string{fileInfo1.Id, fileInfo2.Id, fileInfo2.Id})
		require.NoError(t, err)

		fileInfos, err := ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			if fileInfo.Id == fileInfo1.Id || fileInfo.Id == fileInfo2.Id {
				require.Greater(t, fileInfo.DeleteAt, int64(0))
			} else {
				require.Equal(t, int64(0), fileInfo.DeleteAt)
			}
		}
	})

	t.Run("non existent fileInfo IDs specified", func(t *testing.T) {
		now := model.GetMillis()
		postId := model.NewId()

		fileInfo1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo1.Id)

		fileInfo2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file2.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo2.Id)

		fileInfo3, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo3.Id)

		err = ss.FileInfo().DeleteForPostByIds(rctx, postId, []string{model.NewId(), model.NewId()})
		require.NoError(t, err)

		fileInfos, err := ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			require.Equal(t, int64(0), fileInfo.DeleteAt)
		}
	})

	t.Run("non existent postID specified", func(t *testing.T) {
		err := ss.FileInfo().DeleteForPostByIds(rctx, model.NewId(), []string{model.NewId()})
		require.NoError(t, err)
	})

	t.Run("delete already deleted fileInfos", func(t *testing.T) {
		now := model.GetMillis()
		postId := model.NewId()

		fileInfo1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo1.Id)

		fileInfo2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file2.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo2.Id)

		fileInfo3, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo3.Id)

		err = ss.FileInfo().DeleteForPostByIds(rctx, postId, []string{fileInfo1.Id, fileInfo2.Id})
		require.NoError(t, err)

		fileInfos, err := ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			if fileInfo.Id == fileInfo1.Id || fileInfo.Id == fileInfo2.Id {
				require.Greater(t, fileInfo.DeleteAt, int64(0))
			} else {
				require.Equal(t, int64(0), fileInfo.DeleteAt)
			}
		}

		err = ss.FileInfo().DeleteForPostByIds(rctx, postId, []string{fileInfo1.Id, fileInfo2.Id})
		require.NoError(t, err)

		fileInfos, err = ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			if fileInfo.Id == fileInfo1.Id || fileInfo.Id == fileInfo2.Id {
				require.Greater(t, fileInfo.DeleteAt, int64(0))
			} else {
				require.Equal(t, int64(0), fileInfo.DeleteAt)
			}
		}
	})
}

func testRestoreUndeleteForPostByIds(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("base case", func(t *testing.T) {
		now := model.GetMillis()
		postId := model.NewId()

		fileInfo1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo1.Id)

		fileInfo2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file2.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo2.Id)

		fileInfo3, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo3.Id)

		err = ss.FileInfo().DeleteForPostByIds(rctx, postId, []string{fileInfo1.Id, fileInfo2.Id})
		require.NoError(t, err)

		fileInfos, err := ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			if fileInfo.Id == fileInfo1.Id || fileInfo.Id == fileInfo2.Id {
				require.Greater(t, fileInfo.DeleteAt, int64(0))
			} else {
				require.Equal(t, int64(0), fileInfo.DeleteAt)
			}
		}

		// now we'll un-delete the files
		err = ss.FileInfo().RestoreForPostByIds(rctx, postId, []string{fileInfo1.Id, fileInfo2.Id})
		require.NoError(t, err)

		fileInfos, err = ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			require.Equal(t, fileInfo.DeleteAt, int64(0))
		}
	})

	t.Run("with empty array it should not impact any post files", func(t *testing.T) {
		now := model.GetMillis()
		postId := model.NewId()

		fileInfo1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo1.Id)

		fileInfo2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file2.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo2.Id)

		err = ss.FileInfo().RestoreForPostByIds(rctx, postId, []string{})
		require.NoError(t, err)

		fileInfos, err := ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			require.Equal(t, int64(0), fileInfo.DeleteAt)
		}
	})

	t.Run("duplicate fileInfo Ids specified", func(t *testing.T) {
		now := model.GetMillis()
		postId := model.NewId()

		fileInfo1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo1.Id)

		fileInfo2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file2.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo2.Id)

		fileInfo3, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo3.Id)

		// delete file infos
		err = ss.FileInfo().DeleteForPostByIds(rctx, postId, []string{fileInfo1.Id, fileInfo2.Id, fileInfo3.Id})
		require.NoError(t, err)

		// verify file infos are deleted
		fileInfos, err := ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			require.Greater(t, fileInfo.DeleteAt, int64(0))
		}

		// undelete them specifying duplicate file info ids
		err = ss.FileInfo().RestoreForPostByIds(rctx, postId, []string{fileInfo1.Id, fileInfo2.Id, fileInfo2.Id, fileInfo2.Id})
		require.NoError(t, err)

		// verify file infos are deleted
		fileInfos, err = ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			if fileInfo.Id == fileInfo3.Id {
				require.Greater(t, fileInfo.DeleteAt, int64(0))
			} else {
				require.Equal(t, int64(0), fileInfo.DeleteAt)
			}
		}
	})

	t.Run("non existent fileInfo IDs  and postId specified", func(t *testing.T) {
		err := ss.FileInfo().RestoreForPostByIds(rctx, model.NewId(), []string{model.NewId(), model.NewId()})
		require.NoError(t, err)
	})

	t.Run("undelete already undeleted fileInfos", func(t *testing.T) {
		now := model.GetMillis()
		postId := model.NewId()

		fileInfo1, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo1.Id)

		fileInfo2, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file2.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo2.Id)

		fileInfo3, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			PostId:    postId,
			CreatorId: model.NewId(),
			Size:      10,
			Path:      "file1.txt",
			CreateAt:  now,
		})
		require.NoError(t, err)
		defer ss.FileInfo().PermanentDelete(rctx, fileInfo3.Id)

		err = ss.FileInfo().RestoreForPostByIds(rctx, postId, []string{fileInfo1.Id, fileInfo2.Id})
		require.NoError(t, err)

		fileInfos, err := ss.FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)

		for _, fileInfo := range fileInfos {
			require.Equal(t, int64(0), fileInfo.DeleteAt)
		}
	})
}
