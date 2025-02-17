// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
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

func TestChannelBookmarkStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveChannelBookmark", func(t *testing.T) { testSaveChannelBookmark(t, rctx, ss) })
	t.Run("UpdateChannelBookmark", func(t *testing.T) { testUpdateChannelBookmark(t, rctx, ss) })
	t.Run("UpdateSortOrderChannelBookmark", func(t *testing.T) { testUpdateSortOrderChannelBookmark(t, rctx, ss) })
	t.Run("DeleteChannelBookmark", func(t *testing.T) { testDeleteChannelBookmark(t, rctx, ss) })
	t.Run("GetChannelBookmark", func(t *testing.T) { testGetChannelBookmark(t, rctx, ss) })
}

func testSaveChannelBookmark(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	otherChannelID := model.NewId()
	userID := model.NewId()

	createAt := time.Now().Add(-1 * time.Minute)
	deleteAt := createAt.Add(1 * time.Second)

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "Link bookmark test",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
		Emoji:       ":smile:",
	}

	file := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       channelID,
		CreatorId:       model.BookmarkFileOwner,
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
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "file bookmark test",
		FileId:      file.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	bookmark3 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "file already attached",
		FileId:      file.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	file2 := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       channelID,
		CreatorId:       userID,
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

	bookmark4 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "file already attached to a post",
		FileId:      file2.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	deletedFile := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       channelID,
		CreatorId:       model.BookmarkFileOwner,
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
		CreateAt:        createAt.UnixMilli(),
		UpdateAt:        createAt.UnixMilli(),
		DeleteAt:        deleteAt.UnixMilli(),
	}

	bookmarkFileDeleted := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "file deleted",
		FileId:      deletedFile.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	// another channel
	anotherChannelFile := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       otherChannelID,
		CreatorId:       model.BookmarkFileOwner,
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

	bookmarkFileAnotherChannel := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "file another channel",
		FileId:      anotherChannelFile.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	_, err := ss.FileInfo().Save(rctx, file)
	require.NoError(t, err)
	defer ss.FileInfo().PermanentDelete(rctx, file.Id)

	_, err = ss.FileInfo().Save(rctx, file2)
	require.NoError(t, err)
	defer ss.FileInfo().PermanentDelete(rctx, file2.Id)

	err = ss.FileInfo().AttachToPost(rctx, file2.Id, model.NewId(), channelID, userID)
	require.NoError(t, err)

	_, err = ss.FileInfo().Save(rctx, deletedFile)
	require.NoError(t, err)
	defer ss.FileInfo().PermanentDelete(rctx, deletedFile.Id)

	_, err = ss.FileInfo().Save(rctx, anotherChannelFile)
	require.NoError(t, err)
	defer ss.FileInfo().PermanentDelete(rctx, anotherChannelFile.Id)

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

		bookmarks, err := ss.ChannelBookmark().GetBookmarksForChannelSince(channelID, 0)
		assert.NoError(t, err)
		assert.Len(t, bookmarks, 2)

		_, err = ss.ChannelBookmark().Save(bookmark3.Clone(), true)
		assert.Error(t, err) // Error as the file is attached to a bookmark

		_, err = ss.ChannelBookmark().Save(bookmark4.Clone(), true)
		assert.Error(t, err) // Error as the file is attached to a post

		_, err = ss.ChannelBookmark().Save(bookmarkFileDeleted.Clone(), true)
		assert.Error(t, err) // Error as the file is deleted

		_, err = ss.ChannelBookmark().Save(bookmarkFileAnotherChannel.Clone(), true)
		assert.Error(t, err) // Error as the file is from another channel
	})
}

func testUpdateChannelBookmark(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	userID := model.NewId()

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
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

		bookmarks, err := ss.ChannelBookmark().GetBookmarksForChannelSince(channelID, now)
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

func testUpdateSortOrderChannelBookmark(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	userID := model.NewId()

	bookmark0 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "Bookmark 0",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
		Emoji:       ":smile:",
	}

	file := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       channelID,
		CreatorId:       model.BookmarkFileOwner,
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

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "Bookmark 1",
		FileId:      file.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	_, err := ss.FileInfo().Save(rctx, file)
	require.NoError(t, err)
	defer ss.FileInfo().PermanentDelete(rctx, file.Id)

	bookmark2 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "Bookmark 2",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	bookmark3 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "Bookmark 3",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	bookmark4 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "Bookmark 4",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	bookmarkResp, err := ss.ChannelBookmark().Save(bookmark0.Clone(), true)
	assert.NoError(t, err)
	bookmark0 = bookmarkResp.ChannelBookmark.Clone()

	assert.NotEmpty(t, bookmarkResp.Id)
	assert.Equal(t, bookmark0.ChannelId, bookmarkResp.ChannelId)
	assert.Nil(t, bookmarkResp.FileInfo)

	bookmarkResp, err = ss.ChannelBookmark().Save(bookmark1.Clone(), true)
	assert.NoError(t, err)
	bookmark1 = bookmarkResp.ChannelBookmark.Clone()

	bookmarkResp, err = ss.ChannelBookmark().Save(bookmark2.Clone(), true)
	assert.NoError(t, err)
	bookmark2 = bookmarkResp.ChannelBookmark.Clone()

	bookmarkResp, err = ss.ChannelBookmark().Save(bookmark3.Clone(), true)
	assert.NoError(t, err)
	bookmark3 = bookmarkResp.ChannelBookmark.Clone()

	bookmarkResp, err = ss.ChannelBookmark().Save(bookmark4.Clone(), true)
	assert.NoError(t, err)
	bookmark4 = bookmarkResp.ChannelBookmark.Clone()

	t.Run("change order of bookmarks first to last", func(t *testing.T) {
		bookmarks, sortError := ss.ChannelBookmark().UpdateSortOrder(bookmark0.Id, channelID, 4)
		assert.NoError(t, sortError)

		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks last to first", func(t *testing.T) {
		bookmarks, sortError := ss.ChannelBookmark().UpdateSortOrder(bookmark0.Id, channelID, 0)
		assert.NoError(t, sortError)

		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks first to third", func(t *testing.T) {
		bookmarks, sortError := ss.ChannelBookmark().UpdateSortOrder(bookmark0.Id, channelID, 2)
		assert.NoError(t, sortError)

		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(4))

		// now reset order
		ss.ChannelBookmark().UpdateSortOrder(bookmark0.Id, channelID, 0)
	})

	t.Run("change order of bookmarks second to third", func(t *testing.T) {
		bookmarks, sortError := ss.ChannelBookmark().UpdateSortOrder(bookmark1.Id, channelID, 2)
		assert.NoError(t, sortError)

		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks third to second", func(t *testing.T) {
		bookmarks, sortError := ss.ChannelBookmark().UpdateSortOrder(bookmark1.Id, channelID, 1)
		assert.NoError(t, sortError)

		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks last to previous last", func(t *testing.T) {
		bookmarks, sortError := ss.ChannelBookmark().UpdateSortOrder(bookmark4.Id, channelID, 3)
		assert.NoError(t, sortError)

		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks last to second", func(t *testing.T) {
		bookmarks, sortError := ss.ChannelBookmark().UpdateSortOrder(bookmark3.Id, channelID, 1)
		assert.NoError(t, sortError)

		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks error when new index is out of bounds", func(t *testing.T) {
		var iiErr *store.ErrInvalidInput
		_, err = ss.ChannelBookmark().UpdateSortOrder(bookmark3.Id, channelID, -1)
		assert.Error(t, err)
		assert.ErrorAs(t, err, &iiErr)
		_, err = ss.ChannelBookmark().UpdateSortOrder(bookmark3.Id, channelID, 5)
		assert.Error(t, err)
		assert.ErrorAs(t, err, &iiErr)
	})

	t.Run("change order of bookmarks error when bookmark not found", func(t *testing.T) {
		_, err = ss.ChannelBookmark().UpdateSortOrder(model.NewId(), channelID, 0)
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testDeleteChannelBookmark(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	userID := model.NewId()

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "Link bookmark test",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
		Emoji:       ":smile:",
	}

	file := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       channelID,
		CreatorId:       model.BookmarkFileOwner,
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
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "file bookmark test",
		FileId:      file.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	_, err := ss.FileInfo().Save(rctx, file)
	require.NoError(t, err)
	defer ss.FileInfo().PermanentDelete(rctx, file.Id)

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

		err = ss.ChannelBookmark().Delete(bookmark2.Id, true)
		assert.NoError(t, err)

		_, err = ss.FileInfo().Get(file.Id)
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)

		bookmarks, err := ss.ChannelBookmark().GetBookmarksForChannelSince(channelID, now)
		assert.NoError(t, err)
		assert.Len(t, bookmarks, 2) // we have two as the deleted record also gets returned for sync'ing purposes

		b := find_bookmark(bookmarks, bookmark2.Id)
		assert.NotNil(t, b)
		assert.Equal(t, bookmarks[0].Type, model.ChannelBookmarkLink)
	})
}

func testGetChannelBookmark(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	userID := model.NewId()

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
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

		err = ss.ChannelBookmark().Delete(bookmark1.Id, true)
		assert.NoError(t, err)

		bookmarkResp, err = ss.ChannelBookmark().Get(bookmark1.Id, false)
		assert.Error(t, err)
		assert.Nil(t, bookmarkResp)

		bookmarkResp, err = ss.ChannelBookmark().Get(bookmark1.Id, true)
		assert.NoError(t, err)
		assert.NotNil(t, bookmarkResp)
	})
}
