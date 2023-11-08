// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func find_bookmark(slice []*model.ChannelBookmarkWithFileInfo, id string) *model.ChannelBookmarkWithFileInfo {
	for _, element := range slice {
		if element.Id == id {
			return element
		}
	}
	return nil
}

func TestChannelBookmarkStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("SaveChannelBookmark", func(t *testing.T) { testSaveChannelBookmark(t, ss) })
	t.Run("UpdateChannelBookmark", func(t *testing.T) { testUpdateChannelBookmark(t, ss) })
	t.Run("UpdateSortOrderChannelBookmark", func(t *testing.T) { testUpdateSortOrderChannelBookmark(t, ss) })
	// t.Run("DeleteChannelBookmark", func(t *testing.T) { testDeleteChannelBookmark(t, ss) })
	t.Run("GetChannelBookmark", func(t *testing.T) { testGetChannelBookmark(t, ss) })
	t.Run("GetBookmarksForAllChannelByIdSince", func(t *testing.T) { testGetBookmarksForAllChannelByIdSince(t, ss) })
}

func testSaveChannelBookmark(t *testing.T, ss store.Store) {
	channelId := model.NewId()
	userId := model.NewId()

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     userId,
		DisplayName: "Link bookmark test",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
		Emoji:       ":smile:",
	}

	file := &model.FileInfo{
		Id:              model.NewId(),
		CreatorId:       userId,
		Path:            "somepath",
		ThumbnailPath:   "thumbpath",
		PreviewPath:     "prevPath",
		Name:            "test file",
		Extension:       "png",
		MimeType:        "images/png",
		Size:            873182,
		Width:           3076,
		Height:          2200,
		HasPreviewImage: true,
	}

	bookmark2 := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     userId,
		DisplayName: "file bookmark test",
		FileId:      file.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	_, err := ss.FileInfo().Save(file)
	require.NoError(t, err)

	t.Run("save bookmarks", func(t *testing.T) {
		bookmarkResp, err := ss.ChannelBookmark().Save(bookmark1.Clone(), true)
		assert.NoError(t, err)

		assert.NotEmpty(t, bookmarkResp.Id)
		assert.Equal(t, bookmark1.ChannelId, bookmarkResp.ChannelId)
		assert.Nil(t, bookmarkResp.FileInfo)

		bookmarkResp, err = ss.ChannelBookmark().Save(bookmark2.Clone(), true)
		assert.NoError(t, err)

		assert.NotEmpty(t, bookmarkResp.Id)
		assert.Equal(t, bookmark2.ChannelId, bookmarkResp.ChannelId)
		assert.NotNil(t, bookmarkResp.FileInfo)

		bookmarks, err := ss.ChannelBookmark().GetBookmarksForChannelSince(channelId, 0)
		assert.NoError(t, err)
		assert.Len(t, bookmarks, 2)
	})
}

func testUpdateChannelBookmark(t *testing.T, ss store.Store) {
	channelId := model.NewId()
	userId := model.NewId()

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     userId,
		DisplayName: "Link bookmark test",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	t.Run("update bookmark", func(t *testing.T) {
		bookmarkResp, err := ss.ChannelBookmark().Save(bookmark1.Clone(), true)
		assert.NoError(t, err)

		now := model.GetMillis()
		bookmark2 := bookmarkResp.ChannelBookmark.Clone()
		bookmark2.DisplayName = "Updated display name"
		bookmark2.Emoji = ":smile:"
		bookmark2.LinkUrl = "https://mattermost.com/about"

		time.Sleep(time.Millisecond * 250)

		err = ss.ChannelBookmark().Update(bookmark2.Clone())
		assert.NoError(t, err)

		bookmarks, err := ss.ChannelBookmark().GetBookmarksForChannelSince(channelId, now)
		assert.NoError(t, err)
		assert.Len(t, bookmarks, 1)

		b := find_bookmark(bookmarks, bookmark2.Id)
		assert.NotNil(t, b)
		assert.Equal(t, b.DisplayName, bookmark2.DisplayName)
		assert.Equal(t, b.Type, model.ChannelBookmarkLink)
		assert.NotEmpty(t, b.Emoji)
		assert.Equal(t, b.CreateAt, bookmark2.CreateAt)
		assert.Greater(t, b.UpdateAt, bookmark2.UpdateAt)

		err = ss.ChannelBookmark().Update(bookmark1.Clone())
		assert.Error(t, err)

		bookmark3 := bookmark2.Clone()
		bookmark3.Type = model.ChannelBookmarkFile
		err = ss.ChannelBookmark().Update(bookmark3)
		assert.Error(t, err)
	})
}

func testUpdateSortOrderChannelBookmark(t *testing.T, ss store.Store) {
	channelId := model.NewId()
	userId := model.NewId()

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     userId,
		DisplayName: "Link bookmark test",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
		Emoji:       ":smile:",
	}

	file := &model.FileInfo{
		Id:              model.NewId(),
		CreatorId:       userId,
		Path:            "somepath",
		ThumbnailPath:   "thumbpath",
		PreviewPath:     "prevPath",
		Name:            "test file",
		Extension:       "png",
		MimeType:        "images/png",
		Size:            873182,
		Width:           3076,
		Height:          2200,
		HasPreviewImage: true,
	}

	bookmark2 := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     userId,
		DisplayName: "file bookmark test",
		FileId:      file.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	_, err := ss.FileInfo().Save(file)
	require.NoError(t, err)

	bookmark3 := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     userId,
		DisplayName: "Bookmark 3",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	bookmark4 := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     userId,
		DisplayName: "Bookmark 4",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	t.Run("update bookmarks sort order", func(t *testing.T) {
		now := model.GetMillis()
		bookmarkResp, err := ss.ChannelBookmark().Save(bookmark1.Clone(), true)
		assert.NoError(t, err)
		bookmark1 = bookmarkResp.ChannelBookmark.Clone()

		assert.NotEmpty(t, bookmarkResp.Id)
		assert.Equal(t, bookmark1.ChannelId, bookmarkResp.ChannelId)
		assert.Nil(t, bookmarkResp.FileInfo)

		bookmarkResp, err = ss.ChannelBookmark().Save(bookmark2.Clone(), true)
		assert.NoError(t, err)
		bookmark2 = bookmarkResp.ChannelBookmark.Clone()

		bookmarkResp, err = ss.ChannelBookmark().Save(bookmark3.Clone(), true)
		assert.NoError(t, err)
		bookmark3 = bookmarkResp.ChannelBookmark.Clone()

		bookmarkResp, err = ss.ChannelBookmark().Save(bookmark4.Clone(), true)
		assert.NoError(t, err)
		bookmark4 = bookmarkResp.ChannelBookmark.Clone()

		bookmarks, err := ss.ChannelBookmark().GetBookmarksForChannelSince(channelId, now)
		assert.NoError(t, err)
		assert.Len(t, bookmarks, 4)

		// Initial order as the where added
		assert.Equal(t, bookmarks[0].Id, bookmark1.Id)
		assert.Equal(t, bookmarks[0].SortOrder, int64(0))
		assert.Equal(t, bookmarks[1].Id, bookmark2.Id)
		assert.Equal(t, bookmarks[1].SortOrder, int64(1))
		assert.Equal(t, bookmarks[2].Id, bookmark3.Id)
		assert.Equal(t, bookmarks[2].SortOrder, int64(2))
		assert.Equal(t, bookmarks[3].Id, bookmark4.Id)
		assert.Equal(t, bookmarks[3].SortOrder, int64(3))

		err = ss.ChannelBookmark().UpdateSortOrder(bookmark2.Id, channelId, 0)
		assert.NoError(t, err)

		// Move the second bookmark replaces the order of all of them
		bookmarks, err = ss.ChannelBookmark().GetBookmarksForChannelSince(channelId, now)
		assert.NoError(t, err)
		assert.Len(t, bookmarks, 4)

		assert.Equal(t, bookmarks[0].Id, bookmark2.Id)
		assert.Equal(t, bookmarks[0].SortOrder, int64(0))

		assert.Equal(t, bookmarks[1].Id, bookmark1.Id)
		assert.Equal(t, bookmarks[1].SortOrder, int64(1))

		assert.Equal(t, bookmarks[2].Id, bookmark3.Id)
		assert.Equal(t, bookmarks[2].SortOrder, int64(2))

		assert.Equal(t, bookmarks[3].Id, bookmark4.Id)
		assert.Equal(t, bookmarks[3].SortOrder, int64(3))
	})
}

func testDeleteChannelBookmark(t *testing.T, ss store.Store) {
	channelId := model.NewId()
	userId := model.NewId()

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     userId,
		DisplayName: "Link bookmark test",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
		Emoji:       ":smile:",
	}

	file := &model.FileInfo{
		Id:              model.NewId(),
		CreatorId:       userId,
		Path:            "somepath",
		ThumbnailPath:   "thumbpath",
		PreviewPath:     "prevPath",
		Name:            "test file",
		Extension:       "png",
		MimeType:        "images/png",
		Size:            873182,
		Width:           3076,
		Height:          2200,
		HasPreviewImage: true,
	}

	bookmark2 := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     userId,
		DisplayName: "file bookmark test",
		FileId:      file.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	_, err := ss.FileInfo().Save(file)
	require.NoError(t, err)

	t.Run("delete bookmark", func(t *testing.T) {
		now := model.GetMillis()
		bookmarkResp, err := ss.ChannelBookmark().Save(bookmark1.Clone(), true)
		assert.NoError(t, err)
		bookmark1 = bookmarkResp.ChannelBookmark.Clone()

		assert.NotEmpty(t, bookmarkResp.Id)
		assert.Equal(t, bookmark1.ChannelId, bookmarkResp.ChannelId)
		assert.Nil(t, bookmarkResp.FileInfo)

		bookmarkResp, err = ss.ChannelBookmark().Save(bookmark2.Clone(), true)
		assert.NoError(t, err)
		bookmark2 = bookmarkResp.ChannelBookmark.Clone()

		err = ss.ChannelBookmark().Delete(bookmark2.Id)
		assert.NoError(t, err)

		bookmarks, err := ss.ChannelBookmark().GetBookmarksForChannelSince(channelId, now)
		assert.NoError(t, err)
		assert.Len(t, bookmarks, 2) // we have two as the deleted record also gets returned for sync'ing purposes

		b := find_bookmark(bookmarks, bookmark2.Id)
		assert.NotNil(t, b)
		assert.Equal(t, bookmarks[0].Type, model.ChannelBookmarkLink)
	})
}

func testGetChannelBookmark(t *testing.T, ss store.Store) {
	channelId := model.NewId()
	userId := model.NewId()

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     userId,
		DisplayName: "Link bookmark test",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
		Emoji:       ":smile:",
	}

	t.Run("get bookmark", func(t *testing.T) {
		bookmarkResp, err := ss.ChannelBookmark().Save(bookmark1.Clone(), true)
		assert.NoError(t, err)
		bookmark1 = bookmarkResp.ChannelBookmark.Clone()

		bookmarkResp, err = ss.ChannelBookmark().Get(bookmark1.Id, false)
		assert.NoError(t, err)

		assert.NotEmpty(t, bookmarkResp.Id)
		assert.Equal(t, bookmark1.ChannelId, bookmarkResp.ChannelId)
		assert.Nil(t, bookmarkResp.FileInfo)

		err = ss.ChannelBookmark().Delete(bookmark1.Id)
		assert.NoError(t, err)

		bookmarkResp, err = ss.ChannelBookmark().Get(bookmark1.Id, false)
		assert.Error(t, err)
		assert.Nil(t, bookmarkResp)

		bookmarkResp, err = ss.ChannelBookmark().Get(bookmark1.Id, true)
		assert.NoError(t, err)
		assert.NotNil(t, bookmarkResp)
	})
}

func testGetBookmarksForAllChannelByIdSince(t *testing.T, ss store.Store) {
	channel1Id := model.NewId()
	channel2Id := model.NewId()
	userId := model.NewId()

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channel1Id,
		OwnerId:     userId,
		DisplayName: "Link bookmark test",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
		Emoji:       ":smile:",
	}

	file := &model.FileInfo{
		Id:              model.NewId(),
		CreatorId:       userId,
		Path:            "somepath",
		ThumbnailPath:   "thumbpath",
		PreviewPath:     "prevPath",
		Name:            "test file",
		Extension:       "png",
		MimeType:        "images/png",
		Size:            873182,
		Width:           3076,
		Height:          2200,
		HasPreviewImage: true,
	}

	bookmark2 := &model.ChannelBookmark{
		ChannelId:   channel1Id,
		OwnerId:     userId,
		DisplayName: "file bookmark test",
		FileId:      file.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	_, err := ss.FileInfo().Save(file)
	require.NoError(t, err)

	bookmark3 := &model.ChannelBookmark{
		ChannelId:   channel2Id,
		OwnerId:     userId,
		DisplayName: "Bookmark 3",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	bookmark4 := &model.ChannelBookmark{
		ChannelId:   channel2Id,
		OwnerId:     userId,
		DisplayName: "Bookmark 4",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	t.Run("Get all bookmarks from channels since now", func(t *testing.T) {
		now := model.GetMillis()
		ss.ChannelBookmark().Save(bookmark1.Clone(), true)
		ss.ChannelBookmark().Save(bookmark2.Clone(), true)
		ss.ChannelBookmark().Save(bookmark3.Clone(), true)
		resp, err := ss.ChannelBookmark().Save(bookmark4.Clone(), true)
		assert.NoError(t, err)
		bookmark4 = resp.ChannelBookmark.Clone()

		bookmarks, err := ss.ChannelBookmark().GetBookmarksForAllChannelByIdSince([]string{channel1Id, channel2Id}, now)
		assert.NoError(t, err)
		assert.Len(t, bookmarks, 2)
		assert.Len(t, bookmarks[channel1Id], 2)
		assert.Len(t, bookmarks[channel2Id], 2)
	})

	t.Run("Get all bookmarks from channels since now after one was deleted", func(t *testing.T) {
		now := model.GetMillis()
		channelWithoutBookmarks := model.NewId()

		ss.ChannelBookmark().Delete(bookmark4.Id)
		time.Sleep(time.Millisecond * 250)

		bookmarks, err := ss.ChannelBookmark().GetBookmarksForAllChannelByIdSince([]string{channel1Id, channelWithoutBookmarks, channel2Id}, now)
		assert.NoError(t, err)
		assert.Len(t, bookmarks, 1)
		assert.Len(t, bookmarks[channel1Id], 0)              // none has been modified since
		assert.Len(t, bookmarks[channel2Id], 1)              // only one deleted
		assert.Len(t, bookmarks[channelWithoutBookmarks], 0) // does not have bookmarks

		bookmarks, err = ss.ChannelBookmark().GetBookmarksForAllChannelByIdSince([]string{channel1Id, channelWithoutBookmarks, channel2Id}, 0)
		assert.NoError(t, err)
		assert.Len(t, bookmarks, 2)
		assert.Len(t, bookmarks[channel1Id], 2)              // none has been modified since
		assert.Len(t, bookmarks[channel2Id], 1)              // only one not deleted
		assert.Len(t, bookmarks[channelWithoutBookmarks], 0) // does not have bookmarks
	})
}
