// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFileInfoStore(t *testing.T, ss store.Store) {
	t.Run("FileInfoSaveGet", func(t *testing.T) { testFileInfoSaveGet(t, ss) })
	t.Run("FileInfoSaveGetByPath", func(t *testing.T) { testFileInfoSaveGetByPath(t, ss) })
	t.Run("FileInfoGetForPost", func(t *testing.T) { testFileInfoGetForPost(t, ss) })
	t.Run("FileInfoGetForUser", func(t *testing.T) { testFileInfoGetForUser(t, ss) })
	t.Run("FileInfoGetWithOptions", func(t *testing.T) { testFileInfoGetWithOptions(t, ss) })
	t.Run("FileInfoAttachToPost", func(t *testing.T) { testFileInfoAttachToPost(t, ss) })
	t.Run("FileInfoDeleteForPost", func(t *testing.T) { testFileInfoDeleteForPost(t, ss) })
	t.Run("FileInfoPermanentDelete", func(t *testing.T) { testFileInfoPermanentDelete(t, ss) })
	t.Run("FileInfoPermanentDeleteBatch", func(t *testing.T) { testFileInfoPermanentDeleteBatch(t, ss) })
	t.Run("FileInfoPermanentDeleteByUser", func(t *testing.T) { testFileInfoPermanentDeleteByUser(t, ss) })
}

func testFileInfoSaveGet(t *testing.T, ss store.Store) {
	info := &model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "file.txt",
	}

	info, err := ss.FileInfo().Save(info)
	require.Nil(t, err)
	require.NotEqual(t, len(info.Id), 0)

	defer func() {
		ss.FileInfo().PermanentDelete(info.Id)
	}()

	rinfo, err := ss.FileInfo().Get(info.Id)
	require.Nil(t, err)
	require.Equal(t, info.Id, rinfo.Id)

	info2, err := ss.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "file.txt",
		DeleteAt:  123,
	})
	require.Nil(t, err)

	_, err = ss.FileInfo().Get(info2.Id)
	assert.NotNil(t, err)

	defer func() {
		ss.FileInfo().PermanentDelete(info2.Id)
	}()
}

func testFileInfoSaveGetByPath(t *testing.T, ss store.Store) {
	info := &model.FileInfo{
		CreatorId: model.NewId(),
		Path:      fmt.Sprintf("%v/file.txt", model.NewId()),
	}

	info, err := ss.FileInfo().Save(info)
	require.Nil(t, err)
	assert.NotEqual(t, len(info.Id), 0)
	defer func() {
		ss.FileInfo().PermanentDelete(info.Id)
	}()

	rinfo, err := ss.FileInfo().GetByPath(info.Path)
	require.Nil(t, err)
	assert.Equal(t, info.Id, rinfo.Id)

	info2, err := ss.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "file.txt",
		DeleteAt:  123,
	})
	require.Nil(t, err)

	_, err = ss.FileInfo().GetByPath(info2.Id)
	assert.NotNil(t, err)

	defer func() {
		ss.FileInfo().PermanentDelete(info2.Id)
	}()
}

func testFileInfoGetForPost(t *testing.T, ss store.Store) {
	userId := model.NewId()
	postId := model.NewId()

	infos := []*model.FileInfo{
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
			DeleteAt:  123,
		},
		{
			PostId:    model.NewId(),
			CreatorId: userId,
			Path:      "file.txt",
		},
	}

	for i, info := range infos {
		newInfo, err := ss.FileInfo().Save(info)
		require.Nil(t, err)
		infos[i] = newInfo
		defer func(id string) {
			ss.FileInfo().PermanentDelete(id)
		}(newInfo.Id)
	}

	testCases := []struct {
		Name           string
		PostId         string
		ReadFromMaster bool
		IncludeDeleted bool
		AllowFromCache bool
		ExpectedPosts  int
	}{
		{
			Name:           "Fetch from master, without deleted and without cache",
			PostId:         postId,
			ReadFromMaster: true,
			IncludeDeleted: false,
			AllowFromCache: false,
			ExpectedPosts:  2,
		},
		{
			Name:           "Fetch from master, with deleted and without cache",
			PostId:         postId,
			ReadFromMaster: true,
			IncludeDeleted: true,
			AllowFromCache: false,
			ExpectedPosts:  3,
		},
		{
			Name:           "Fetch from master, with deleted and with cache",
			PostId:         postId,
			ReadFromMaster: true,
			IncludeDeleted: true,
			AllowFromCache: true,
			ExpectedPosts:  3,
		},
		{
			Name:           "Fetch from replica, without deleted and without cache",
			PostId:         postId,
			ReadFromMaster: false,
			IncludeDeleted: false,
			AllowFromCache: false,
			ExpectedPosts:  2,
		},
		{
			Name:           "Fetch from replica, with deleted and without cache",
			PostId:         postId,
			ReadFromMaster: false,
			IncludeDeleted: true,
			AllowFromCache: false,
			ExpectedPosts:  3,
		},
		{
			Name:           "Fetch from replica, with deleted and without cache",
			PostId:         postId,
			ReadFromMaster: false,
			IncludeDeleted: true,
			AllowFromCache: true,
			ExpectedPosts:  3,
		},
		{
			Name:           "Fetch from replica, without deleted and with cache",
			PostId:         postId,
			ReadFromMaster: true,
			IncludeDeleted: false,
			AllowFromCache: true,
			ExpectedPosts:  2,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			postInfos, err := ss.FileInfo().GetForPost(
				tc.PostId,
				tc.ReadFromMaster,
				tc.IncludeDeleted,
				tc.AllowFromCache,
			)
			require.Nil(t, err)
			assert.Len(t, postInfos, tc.ExpectedPosts)

		})
	}
}

func testFileInfoGetForUser(t *testing.T, ss store.Store) {
	userId := model.NewId()
	userId2 := model.NewId()
	postId := model.NewId()

	infos := []*model.FileInfo{
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    model.NewId(),
			CreatorId: userId2,
			Path:      "file.txt",
		},
	}

	for i, info := range infos {
		newInfo, err := ss.FileInfo().Save(info)
		require.Nil(t, err)
		infos[i] = newInfo
		defer func(id string) {
			ss.FileInfo().PermanentDelete(id)
		}(newInfo.Id)
	}

	userPosts, err := ss.FileInfo().GetForUser(userId)
	require.Nil(t, err)
	assert.Len(t, userPosts, 3)

	userPosts, err = ss.FileInfo().GetForUser(userId2)
	require.Nil(t, err)
	assert.Len(t, userPosts, 1)
}

func testFileInfoGetWithOptions(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	makeUser := func(username string) model.User {
		user := model.User{
			Email:    MakeEmail(),
			Username: username,
		}
		_, err := ss.User().Save(&user)
		require.Nil(t, err)
		return user
	}

	makeChannel := func(prefix string) model.Channel {
		channel := model.Channel{
			DisplayName: prefix + "channel",
			Name:        prefix + "channel",
			TeamId:      teamId,
			Type:        model.CHANNEL_GROUP,
		}
		_, err := ss.Channel().Save(&channel, -1)
		require.Nil(t, err)
		return channel
	}

	addUsersToChannel := func(ch model.Channel, users ...string) {
		for _, user := range users {
			m := model.ChannelMember{}
			m.ChannelId = ch.Id
			m.UserId = user
			m.NotifyProps = model.GetDefaultChannelNotifyProps()
			_, err := ss.Channel().SaveMember(&m)
			require.Nil(t, err)
		}
	}

	makePost := func(ch model.Channel, user string) model.Post {
		post := model.Post{}
		post.ChannelId = ch.Id
		post.UserId = user
		_, err := ss.Post().Save(&post)
		require.Nil(t, err)
		return post
	}

	makeFile := func(post model.Post, user string, createAt int64) model.FileInfo {
		fileInfo := model.FileInfo{
			CreatorId: user,
			Path:      "file.txt",
			CreateAt:  createAt,
		}
		if post.Id != "" {
			fileInfo.PostId = post.Id
		}
		_, err := ss.FileInfo().Save(&fileInfo)
		require.Nil(t, err)
		return fileInfo
	}

	user1 := makeUser("user1")
	user2 := makeUser("user2")

	channel1 := makeChannel("ch-for-user1")
	channel2 := makeChannel("ch-for-user2")
	channel1and2 := makeChannel("ch-for-user1-and-user2")

	addUsersToChannel(channel1, user1.Id)
	addUsersToChannel(channel2, user2.Id)
	addUsersToChannel(channel1and2, user1.Id, user2.Id)

	post1_1 := makePost(channel1, user1.Id)     // post 1 by user 1
	post1_2 := makePost(channel1and2, user1.Id) // post 2 by user 1
	post2_1 := makePost(channel2, user2.Id)
	post2_2 := makePost(channel1and2, user2.Id)

	epoch := time.Date(2020, 1, 1, 1, 1, 1, 1, time.UTC)
	file1_1 := makeFile(post1_1, user1.Id, epoch.AddDate(0, 0, 1).Unix())      // file 1 by user 1
	file1_2 := makeFile(post1_2, user1.Id, epoch.AddDate(0, 0, 2).Unix())      // file 2 by user 1
	file1_3 := makeFile(model.Post{}, user1.Id, epoch.AddDate(0, 0, 3).Unix()) // file that is not attached to a post
	file2_1 := makeFile(post2_1, user2.Id, epoch.AddDate(0, 0, 4).Unix())      // file 2 by user 1
	file2_2 := makeFile(post2_2, user2.Id, epoch.AddDate(0, 0, 5).Unix())

	// delete a file
	_, err := ss.FileInfo().DeleteForPost(file2_2.PostId)
	require.Nil(t, err)

	testCases := []struct {
		Name              string
		Opt               *model.GetFilesOptions
		ExpectedFileCount int
		ExpectedFileIds   []string
	}{
		{
			Name:              "Get files with nil option",
			Opt:               nil,
			ExpectedFileCount: 4,
		},
		{
			Name:              "Get files including deleted",
			Opt:               &model.GetFilesOptions{IncludeDeleted: true},
			ExpectedFileCount: 5,
		},
		{
			Name: "Get files including deleted filtered by channel",
			Opt: &model.GetFilesOptions{
				IncludeDeleted: true,
				ChannelIds:     []string{channel1and2.Id},
			},
			ExpectedFileCount: 2,
		},
		{
			Name: "Get files including deleted sorted by created at",
			Opt: &model.GetFilesOptions{
				IncludeDeleted: true,
				SortBy:         model.FILE_SORT_BY_CREATED,
			},
			ExpectedFileCount: 5,
			ExpectedFileIds:   []string{file1_1.Id, file1_2.Id, file1_3.Id, file2_1.Id, file2_2.Id},
		},
		{
			Name: "Get files filtered by user ordered by created at descending",
			Opt: &model.GetFilesOptions{
				UserIds:       []string{user1.Id},
				SortBy:        model.FILE_SORT_BY_CREATED,
				SortDirection: model.FILE_SORT_ORDER_DESCENDING,
			},
			ExpectedFileCount: 3,
			ExpectedFileIds:   []string{file1_3.Id, file1_2.Id, file1_1.Id},
		},
		{
			Name: "Get all files including deleted filtered by channel id and sorted by channel name",
			Opt: &model.GetFilesOptions{
				ChannelIds:     []string{channel1.Id, channel2.Id},
				IncludeDeleted: true,
				SortBy:         model.FILE_SORT_BY_CHANNEL_NAME,
			},
			ExpectedFileCount: 2,
			ExpectedFileIds:   []string{file1_1.Id, file2_1.Id},
		},
		{
			Name: "Get all files including deleted filtered by channel id and sorted by username descending",
			Opt: &model.GetFilesOptions{
				ChannelIds:     []string{channel1and2.Id},
				IncludeDeleted: true,
				SortBy:         model.FILE_SORT_BY_USERNAME,
				SortDirection:  model.FILE_SORT_ORDER_DESCENDING,
			},
			ExpectedFileCount: 2,
			ExpectedFileIds:   []string{file2_2.Id, file1_2.Id},
		},
		{
			Name: "Get all files including deleted paginated",
			Opt: &model.GetFilesOptions{
				Page:           2,
				PerPage:        3,
				IncludeDeleted: true,
				SortBy:         model.FILE_SORT_BY_CREATED,
				SortDirection:  model.FILE_SORT_ORDER_DESCENDING,
			},
			ExpectedFileCount: 2,
			ExpectedFileIds:   []string{file1_2.Id, file1_1.Id},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			fileInfos, err := ss.FileInfo().GetWithOptions(tc.Opt)
			require.Nil(t, err)
			assert.Len(t, fileInfos, tc.ExpectedFileCount)
			if len(tc.ExpectedFileIds) > 0 {
				for i := range tc.ExpectedFileIds {
					assert.Equal(t, tc.ExpectedFileIds[i], fileInfos[i].Id)
				}
			}
		})
	}
}

type byFileInfoId []*model.FileInfo

func (a byFileInfoId) Len() int           { return len(a) }
func (a byFileInfoId) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a byFileInfoId) Less(i, j int) bool { return a[i].Id < a[j].Id }

func testFileInfoAttachToPost(t *testing.T, ss store.Store) {
	t.Run("should attach files", func(t *testing.T) {
		userId := model.NewId()
		postId := model.NewId()

		info1, err := ss.FileInfo().Save(&model.FileInfo{
			CreatorId: userId,
			Path:      "file.txt",
		})
		require.Nil(t, err)
		info2, err := ss.FileInfo().Save(&model.FileInfo{
			CreatorId: userId,
			Path:      "file2.txt",
		})
		require.Nil(t, err)

		require.Equal(t, "", info1.PostId)
		require.Equal(t, "", info2.PostId)

		err = ss.FileInfo().AttachToPost(info1.Id, postId, userId)
		assert.Nil(t, err)
		info1.PostId = postId

		err = ss.FileInfo().AttachToPost(info2.Id, postId, userId)
		assert.Nil(t, err)
		info2.PostId = postId

		data, err := ss.FileInfo().GetForPost(postId, true, false, false)
		require.Nil(t, err)

		expected := []*model.FileInfo{info1, info2}
		sort.Sort(byFileInfoId(expected))
		sort.Sort(byFileInfoId(data))
		assert.Equal(t, expected, data)
	})

	t.Run("should not attach files to multiple posts", func(t *testing.T) {
		userId := model.NewId()
		postId := model.NewId()

		info, err := ss.FileInfo().Save(&model.FileInfo{
			CreatorId: userId,
			Path:      "file.txt",
		})
		require.Nil(t, err)

		require.Equal(t, "", info.PostId)

		err = ss.FileInfo().AttachToPost(info.Id, model.NewId(), userId)
		require.Nil(t, err)

		err = ss.FileInfo().AttachToPost(info.Id, postId, userId)
		require.NotNil(t, err)
	})

	t.Run("should not attach files owned from a different user", func(t *testing.T) {
		userId := model.NewId()
		postId := model.NewId()

		info, err := ss.FileInfo().Save(&model.FileInfo{
			CreatorId: model.NewId(),
			Path:      "file.txt",
		})
		require.Nil(t, err)

		require.Equal(t, "", info.PostId)

		err = ss.FileInfo().AttachToPost(info.Id, postId, userId)
		assert.NotNil(t, err)
	})

	t.Run("should attach files uploaded by nouser", func(t *testing.T) {
		postId := model.NewId()

		info, err := ss.FileInfo().Save(&model.FileInfo{
			CreatorId: "nouser",
			Path:      "file.txt",
		})
		require.Nil(t, err)
		assert.Equal(t, "", info.PostId)

		err = ss.FileInfo().AttachToPost(info.Id, postId, model.NewId())
		require.Nil(t, err)

		data, err := ss.FileInfo().GetForPost(postId, true, false, false)
		require.Nil(t, err)
		info.PostId = postId
		assert.Equal(t, []*model.FileInfo{info}, data)
	})
}

func testFileInfoDeleteForPost(t *testing.T, ss store.Store) {
	userId := model.NewId()
	postId := model.NewId()

	infos := []*model.FileInfo{
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
			DeleteAt:  123,
		},
		{
			PostId:    model.NewId(),
			CreatorId: userId,
			Path:      "file.txt",
		},
	}

	for i, info := range infos {
		newInfo, err := ss.FileInfo().Save(info)
		require.Nil(t, err)
		infos[i] = newInfo
		defer func(id string) {
			ss.FileInfo().PermanentDelete(id)
		}(newInfo.Id)
	}

	_, err := ss.FileInfo().DeleteForPost(postId)
	require.Nil(t, err)

	infos, err = ss.FileInfo().GetForPost(postId, true, false, false)
	require.Nil(t, err)
	assert.Empty(t, infos)
}

func testFileInfoPermanentDelete(t *testing.T, ss store.Store) {
	info, err := ss.FileInfo().Save(&model.FileInfo{
		PostId:    model.NewId(),
		CreatorId: model.NewId(),
		Path:      "file.txt",
	})
	require.Nil(t, err)

	err = ss.FileInfo().PermanentDelete(info.Id)
	require.Nil(t, err)
}

func testFileInfoPermanentDeleteBatch(t *testing.T, ss store.Store) {
	postId := model.NewId()

	_, err := ss.FileInfo().Save(&model.FileInfo{
		PostId:    postId,
		CreatorId: model.NewId(),
		Path:      "file.txt",
		CreateAt:  1000,
	})
	require.Nil(t, err)

	_, err = ss.FileInfo().Save(&model.FileInfo{
		PostId:    postId,
		CreatorId: model.NewId(),
		Path:      "file.txt",
		CreateAt:  1200,
	})
	require.Nil(t, err)

	_, err = ss.FileInfo().Save(&model.FileInfo{
		PostId:    postId,
		CreatorId: model.NewId(),
		Path:      "file.txt",
		CreateAt:  2000,
	})
	require.Nil(t, err)

	postFiles, err := ss.FileInfo().GetForPost(postId, true, false, false)
	require.Nil(t, err)
	assert.Len(t, postFiles, 3)

	_, err = ss.FileInfo().PermanentDeleteBatch(1500, 1000)
	require.Nil(t, err)

	postFiles, err = ss.FileInfo().GetForPost(postId, true, false, false)
	require.Nil(t, err)
	assert.Len(t, postFiles, 1)
}

func testFileInfoPermanentDeleteByUser(t *testing.T, ss store.Store) {
	userId := model.NewId()
	postId := model.NewId()

	_, err := ss.FileInfo().Save(&model.FileInfo{
		PostId:    postId,
		CreatorId: userId,
		Path:      "file.txt",
	})
	require.Nil(t, err)

	_, err = ss.FileInfo().PermanentDeleteByUser(userId)
	require.Nil(t, err)
}
