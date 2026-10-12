// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	einterfacesmocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func find_bookmark(slice []*model.ChannelBookmarkWithFileInfo, id string) *model.ChannelBookmarkWithFileInfo {
	for _, element := range slice {
		if element.Id == id {
			return element
		}
	}
	return nil
}

func createBookmark(name string, bookmarkType model.ChannelBookmarkType, channelId string, fileId string) *model.ChannelBookmark {
	bookmark := &model.ChannelBookmark{
		ChannelId:   channelId,
		DisplayName: name,
		Type:        bookmarkType,
		Emoji:       ":smile:",
	}
	if bookmarkType == model.ChannelBookmarkLink {
		bookmark.LinkUrl = "https://mattermost.com"
	}
	if bookmarkType == model.ChannelBookmarkFile {
		bookmark.FileId = fileId
	}

	return bookmark
}

func TestCreateBookmark(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("create a channel bookmark", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

		bookmark1 := createBookmark("Link bookmark test", model.ChannelBookmarkLink, th.BasicChannel.Id, "")
		bookmarkResp, err := th.App.CreateChannelBookmark(th.Context, bookmark1, "")
		require.Nil(t, err)
		require.NotNil(t, bookmarkResp)

		assert.Equal(t, bookmarkResp.ChannelId, th.BasicChannel.Id)
		assert.NotEmpty(t, bookmarkResp.Id)

		bookmark2 := createBookmark("File bookmark test", model.ChannelBookmarkFile, th.BasicChannel.Id, "")

		bookmarkResp, err = th.App.CreateChannelBookmark(th.Context, bookmark2, "")
		assert.Nil(t, bookmarkResp)
		assert.NotNil(t, err)
	})

	t.Run("Cannot create more than MaxBookmarksPerChannel", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

		for i := 1; i < model.MaxBookmarksPerChannel; i++ {
			bookmark := createBookmark(fmt.Sprintf("Link bookmark test %d", i), model.ChannelBookmarkLink, th.BasicChannel.Id, "")
			bookmarkResp, err := th.App.CreateChannelBookmark(th.Context, bookmark, "")
			require.Nil(t, err)
			require.NotNil(t, bookmarkResp)
			assert.Equal(t, bookmarkResp.ChannelId, th.BasicChannel.Id)
			assert.NotEmpty(t, bookmarkResp.Id)
		}

		bookmark := createBookmark("Bookmark that should not be added", model.ChannelBookmarkLink, th.BasicChannel.Id, "")
		bookmarkResp, err := th.App.CreateChannelBookmark(th.Context, bookmark, "")
		assert.Nil(t, bookmarkResp)
		assert.NotNil(t, err)
	})
}

func TestUpdateBookmark(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	var updateBookmark *model.ChannelBookmarkWithFileInfo

	testUpdateAnotherFile := func(th *TestHelper, t *testing.T) {
		file := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       th.BasicChannel.Id,
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

		_, err := th.App.Srv().Store().FileInfo().Save(th.Context, file)
		assert.NoError(t, err)
		defer func() {
			err = th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, file.Id)
			assert.NoError(t, err)
		}()

		bookmark2 := createBookmark("File to be updated", model.ChannelBookmarkFile, th.BasicChannel.Id, file.Id)
		bookmarkResp, appErr := th.App.CreateChannelBookmark(th.Context, bookmark2, "")
		require.Nil(t, appErr)
		require.NotNil(t, bookmarkResp)

		file2 := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       th.BasicChannel.Id,
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

		_, err = th.App.Srv().Store().FileInfo().Save(th.Context, file2)
		assert.NoError(t, err)
		err = th.App.Srv().Store().FileInfo().AttachToPost(th.Context, file2.Id, model.NewId(), th.BasicChannel.Id, model.BookmarkFileOwner)
		assert.NoError(t, err)
		defer func() {
			err = th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, file2.Id)
			require.NoError(t, err)
		}()

		bookmark2.FileId = file2.Id
		bookmarkResp, appErr = th.App.CreateChannelBookmark(th.Context, bookmark2, "")
		require.NotNil(t, appErr)
		require.Nil(t, bookmarkResp)
	}

	var testUpdateInvalidFiles = func(th *TestHelper, t *testing.T, creatingUserId string, updatingUserId string) {
		file := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       th.BasicChannel.Id,
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

		_, err := th.App.Srv().Store().FileInfo().Save(th.Context, file)
		assert.NoError(t, err)
		defer func() {
			err = th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, file.Id)
			assert.NoError(t, err)
		}()

		th.Context.Session().UserId = creatingUserId

		bookmark := createBookmark("File to be updated", model.ChannelBookmarkFile, th.BasicChannel.Id, file.Id)
		bookmarkToEdit, appErr := th.App.CreateChannelBookmark(th.Context, bookmark, "")
		require.Nil(t, appErr)
		require.NotNil(t, bookmarkToEdit)

		otherChannel := th.CreateChannel(t, th.BasicTeam)

		createAt := time.Now().Add(-1 * time.Minute)
		deleteAt := createAt.Add(1 * time.Second)

		deletedFile := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       th.BasicChannel.Id,
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

		_, err = th.App.Srv().Store().FileInfo().Save(th.Context, deletedFile)
		assert.NoError(t, err)
		defer func() {
			err = th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, deletedFile.Id)
			assert.NoError(t, err)
		}()

		th.Context.Session().UserId = updatingUserId

		updateBookmarkPending := bookmarkToEdit.Clone()
		updateBookmarkPending.FileId = deletedFile.Id
		bookmarkEdited, appErr := th.App.UpdateChannelBookmark(th.Context, updateBookmarkPending, "")
		assert.NotNil(t, appErr)
		require.Nil(t, bookmarkEdited)

		anotherChannelFile := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       otherChannel.Id,
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

		_, err = th.App.Srv().Store().FileInfo().Save(th.Context, anotherChannelFile)
		assert.NoError(t, err)
		defer func() {
			err = th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, anotherChannelFile.Id)
			require.NoError(t, err)
		}()

		updateBookmarkPending = bookmarkToEdit.Clone()
		updateBookmarkPending.FileId = anotherChannelFile.Id
		bookmarkEdited, appErr = th.App.UpdateChannelBookmark(th.Context, updateBookmarkPending, "")
		assert.NotNil(t, appErr)
		require.Nil(t, bookmarkEdited)
	}

	t.Run("same user update a channel bookmark", func(t *testing.T) {
		bookmark1 := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		th.Context.Session().UserId = th.BasicUser.Id // set the user for the session
		bookmarkResp, err := th.App.CreateChannelBookmark(th.Context, bookmark1, "")
		require.Nil(t, err)
		require.NotNil(t, bookmarkResp)

		updateBookmark = bookmarkResp.Clone()
		updateBookmark.DisplayName = "New name"
		time.Sleep(1 * time.Millisecond) // to avoid collisions
		response, _ := th.App.UpdateChannelBookmark(th.Context, updateBookmark, "")
		require.NotNil(t, response)
		assert.Greater(t, response.Updated.UpdateAt, response.Updated.CreateAt)

		testUpdateAnotherFile(th, t)

		testUpdateInvalidFiles(th, t, th.BasicUser.Id, th.BasicUser.Id)
	})

	t.Run("another user update a channel bookmark", func(t *testing.T) {
		updateBookmark2 := updateBookmark.Clone()
		updateBookmark2.DisplayName = "Another new name"
		th.Context.Session().UserId = th.BasicUser2.Id
		response, _ := th.App.UpdateChannelBookmark(th.Context, updateBookmark2, "")
		require.NotNil(t, response)
		assert.Equal(t, response.Updated.OriginalId, response.Deleted.Id)
		assert.Equal(t, response.Updated.DeleteAt, int64(0))
		assert.Greater(t, response.Deleted.DeleteAt, int64(0))
		assert.Equal(t, "Another new name", response.Updated.DisplayName)
		assert.Equal(t, "New name", response.Deleted.DisplayName)

		testUpdateAnotherFile(th, t)

		testUpdateInvalidFiles(th, t, th.BasicUser.Id, th.BasicUser.Id)
	})

	t.Run("update an already deleted channel bookmark", func(t *testing.T) {
		bookmark1 := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		th.Context.Session().UserId = th.BasicUser.Id // set the user for the session
		bookmarkResp, err := th.App.CreateChannelBookmark(th.Context, bookmark1, "")
		require.Nil(t, err)
		require.NotNil(t, bookmarkResp)

		updateBookmark = bookmarkResp.Clone()
		_, err = th.App.DeleteChannelBookmark(updateBookmark.Id, "")
		assert.Nil(t, err)

		updateBookmark.DisplayName = "New name"
		_, err = th.App.UpdateChannelBookmark(th.Context, updateBookmark, "")
		assert.NotNil(t, err)
	})

	t.Run("update a nonexisting channel bookmark", func(t *testing.T) {
		updateBookmark := &model.ChannelBookmark{
			Id:          model.NewId(),
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}
		_, err := th.App.UpdateChannelBookmark(th.Context, updateBookmark.ToBookmarkWithFileInfo(nil), "")
		assert.NotNil(t, err)
		assert.Equal(t, "app.channel.bookmark.get_existing.app_err", err.Id)
	})
}

func TestDeleteBookmark(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("delete a channel bookmark", func(t *testing.T) {
		bookmark1 := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		th.Context.Session().UserId = th.BasicUser.Id // set the user for the session
		bookmarkResp, err := th.App.CreateChannelBookmark(th.Context, bookmark1, "")
		require.Nil(t, err)
		require.NotNil(t, bookmarkResp)

		bookmarkResp, err = th.App.DeleteChannelBookmark(bookmarkResp.Id, "")
		require.Nil(t, err)
		require.NotNil(t, bookmarkResp)
		assert.Greater(t, bookmarkResp.DeleteAt, int64(0))
	})
}

func TestGetChannelBookmarks(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	bookmark1 := &model.ChannelBookmark{
		ChannelId:   th.BasicChannel.Id,
		DisplayName: "Bookmark 1",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
		Emoji:       ":smile:",
	}

	_, appErr := th.App.CreateChannelBookmark(th.Context, bookmark1, "")
	assert.Nil(t, appErr)

	file := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       th.BasicChannel.Id,
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

	_, err := th.App.Srv().Store().FileInfo().Save(th.Context, file)
	assert.NoError(t, err)
	defer func() {
		err := th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, file.Id)
		assert.NoError(t, err)
	}()

	bookmark2 := &model.ChannelBookmark{
		ChannelId:   th.BasicChannel.Id,
		DisplayName: "Bookmark 2",
		FileId:      file.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	_, appErr = th.App.CreateChannelBookmark(th.Context, bookmark2, "")
	assert.Nil(t, appErr)

	t.Run("get bookmarks of a channel", func(t *testing.T) {
		bookmarks, err := th.App.GetChannelBookmarks(th.BasicChannel.Id, 0)
		require.Nil(t, err)
		require.NotNil(t, bookmarks)
		assert.Len(t, bookmarks, 2)
	})

	t.Run("get bookmarks of a channel after one is deleted (aka only return the changed bookmarks)", func(t *testing.T) {
		now := model.GetMillis()
		_, appErr := th.App.DeleteChannelBookmark(bookmark1.Id, "")
		assert.Nil(t, appErr)

		bookmarks, err := th.App.GetChannelBookmarks(th.BasicChannel.Id, 0)
		require.Nil(t, err)
		require.NotNil(t, bookmarks)
		assert.Len(t, bookmarks, 1)

		bookmarks, err = th.App.GetChannelBookmarks(th.BasicChannel.Id, now)
		require.Nil(t, err)
		require.NotNil(t, bookmarks)
		assert.Len(t, bookmarks, 1)

		deleted := false
		for _, b := range bookmarks {
			if b.DeleteAt > 0 {
				deleted = true
				break
			}
		}
		assert.Equal(t, deleted, true)
	})
}

func TestUpdateChannelBookmarkSortOrder(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channelId := th.BasicChannel.Id
	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	bookmark0 := &model.ChannelBookmark{
		ChannelId:   channelId,
		DisplayName: "Bookmark 0",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
		Emoji:       ":smile:",
	}

	file := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       th.BasicChannel.Id,
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
		ChannelId:   channelId,
		DisplayName: "Bookmark 1",
		FileId:      file.Id,
		Type:        model.ChannelBookmarkFile,
		Emoji:       ":smile:",
	}

	_, err := th.App.Srv().Store().FileInfo().Save(th.Context, file)
	require.NoError(t, err)
	defer func() {
		err = th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, file.Id)
		require.NoError(t, err)
	}()

	bookmark2 := &model.ChannelBookmark{
		ChannelId:   channelId,
		DisplayName: "Bookmark 2",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	bookmark3 := &model.ChannelBookmark{
		ChannelId:   channelId,
		DisplayName: "Bookmark 3",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	bookmark4 := &model.ChannelBookmark{
		ChannelId:   channelId,
		DisplayName: "Bookmark 4",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelBookmarkLink,
	}

	bookmarkResp, appErr := th.App.CreateChannelBookmark(th.Context, bookmark0, "")
	require.Nil(t, appErr)
	require.NotNil(t, bookmarkResp)
	bookmark0 = bookmarkResp.ChannelBookmark.Clone()

	bookmarkResp, appErr = th.App.CreateChannelBookmark(th.Context, bookmark1, "")
	require.Nil(t, appErr)
	require.NotNil(t, bookmarkResp)
	bookmark1 = bookmarkResp.ChannelBookmark.Clone()

	bookmarkResp, appErr = th.App.CreateChannelBookmark(th.Context, bookmark2, "")
	require.Nil(t, appErr)
	require.NotNil(t, bookmarkResp)
	bookmark2 = bookmarkResp.ChannelBookmark.Clone()

	bookmarkResp, appErr = th.App.CreateChannelBookmark(th.Context, bookmark3, "")
	require.Nil(t, appErr)
	require.NotNil(t, bookmarkResp)
	bookmark3 = bookmarkResp.ChannelBookmark.Clone()

	bookmarkResp, appErr = th.App.CreateChannelBookmark(th.Context, bookmark4, "")
	require.Nil(t, appErr)
	require.NotNil(t, bookmarkResp)
	bookmark4 = bookmarkResp.ChannelBookmark.Clone()

	t.Run("change order of bookmarks first to last", func(t *testing.T) {
		bookmarks, sortErr := th.App.UpdateChannelBookmarkSortOrder(bookmark0.Id, channelId, int64(4), "")
		require.Nil(t, sortErr)
		require.NotNil(t, bookmarks)

		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks last to first", func(t *testing.T) {
		bookmarks, sortErr := th.App.UpdateChannelBookmarkSortOrder(bookmark0.Id, channelId, int64(0), "")
		require.Nil(t, sortErr)
		require.NotNil(t, bookmarks)

		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks first to third", func(t *testing.T) {
		bookmarks, sortErr := th.App.UpdateChannelBookmarkSortOrder(bookmark0.Id, channelId, int64(2), "")
		require.Nil(t, sortErr)
		require.NotNil(t, bookmarks)

		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(4))

		// now reset order
		_, appErr = th.App.UpdateChannelBookmarkSortOrder(bookmark0.Id, channelId, int64(0), "")
		assert.Nil(t, appErr)
	})

	t.Run("change order of bookmarks second to third", func(t *testing.T) {
		bookmarks, sortErr := th.App.UpdateChannelBookmarkSortOrder(bookmark1.Id, channelId, int64(2), "")
		require.Nil(t, sortErr)
		require.NotNil(t, bookmarks)

		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks third to second", func(t *testing.T) {
		bookmarks, sortErr := th.App.UpdateChannelBookmarkSortOrder(bookmark1.Id, channelId, int64(1), "")
		require.Nil(t, sortErr)
		require.NotNil(t, bookmarks)

		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks last to previous last", func(t *testing.T) {
		bookmarks, sortErr := th.App.UpdateChannelBookmarkSortOrder(bookmark4.Id, channelId, int64(3), "")
		require.Nil(t, sortErr)
		require.NotNil(t, bookmarks)

		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks last to second", func(t *testing.T) {
		bookmarks, sortErr := th.App.UpdateChannelBookmarkSortOrder(bookmark3.Id, channelId, int64(1), "")
		require.Nil(t, sortErr)
		require.NotNil(t, bookmarks)

		assert.Equal(t, find_bookmark(bookmarks, bookmark0.Id).SortOrder, int64(0))
		assert.Equal(t, find_bookmark(bookmarks, bookmark3.Id).SortOrder, int64(1))
		assert.Equal(t, find_bookmark(bookmarks, bookmark1.Id).SortOrder, int64(2))
		assert.Equal(t, find_bookmark(bookmarks, bookmark2.Id).SortOrder, int64(3))
		assert.Equal(t, find_bookmark(bookmarks, bookmark4.Id).SortOrder, int64(4))
	})

	t.Run("change order of bookmarks error when new index is out of bounds", func(t *testing.T) {
		_, appErr = th.App.UpdateChannelBookmarkSortOrder(bookmark3.Id, channelId, int64(-1), "")
		assert.NotNil(t, appErr)
		_, appErr = th.App.UpdateChannelBookmarkSortOrder(bookmark3.Id, channelId, int64(5), "")
		assert.NotNil(t, appErr)
	})

	t.Run("change order of bookmarks error when bookmark not found", func(t *testing.T) {
		_, appErr = th.App.UpdateChannelBookmarkSortOrder(model.NewId(), channelId, int64(0), "")
		assert.NotNil(t, appErr)
	})
}

func TestChannelBookmarkBroadcastsFileInfoABAC(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	})

	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
	require.Nil(t, appErr)

	th.Context.Session().UserId = th.BasicUser.Id

	mockDownloadDecision := func(t *testing.T, allowed bool) {
		t.Helper()

		mockACS := &einterfacesmocks.AccessControlServiceInterface{}
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Action == model.AccessControlPolicyActionDownloadFileAttachment
		})).Return(model.AccessDecision{Decision: allowed}, (*model.AppError)(nil))

		original := th.App.Srv().Channels().AccessControl
		th.App.Srv().Channels().AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().Channels().AccessControl = original
		})
	}

	createFile := func(t *testing.T) *model.FileInfo {
		t.Helper()

		miniPreview := []byte{1, 2, 3, 4}
		file := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       th.BasicChannel.Id,
			CreatorId:       model.BookmarkFileOwner,
			Path:            "somepath",
			ThumbnailPath:   "thumbpath",
			PreviewPath:     "prevPath",
			Name:            "bookmark-secret.png",
			Extension:       "png",
			MimeType:        "image/png",
			Size:            873182,
			Width:           3076,
			Height:          2200,
			HasPreviewImage: true,
			MiniPreview:     &miniPreview,
		}
		_, err := th.App.Srv().Store().FileInfo().Save(th.Context, file)
		require.NoError(t, err)
		t.Cleanup(func() {
			require.NoError(t, th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, file.Id))
		})
		return file
	}

	nextEvent := func(t *testing.T, messages chan *model.WebSocketEvent, eventType model.WebsocketEventType) *model.WebSocketEvent {
		t.Helper()

		for {
			select {
			case msg := <-messages:
				if msg.EventType() == eventType {
					return msg
				}
			case <-time.After(10 * time.Second):
				t.Fatalf("timed out waiting for %s event", eventType)
				return nil
			}
		}
	}

	// hasFileInfo reports whether any bookmark in the event payload still carries file info.
	hasFileInfo := func(t *testing.T, msg *model.WebSocketEvent, field string) bool {
		t.Helper()

		raw, ok := msg.GetData()[field].(string)
		require.True(t, ok, "event should carry a %s payload", field)

		var decoded any
		require.NoError(t, json.Unmarshal([]byte(raw), &decoded))

		var walk func(value any) bool
		walk = func(value any) bool {
			switch typed := value.(type) {
			case map[string]any:
				if file, found := typed["file"]; found && file != nil {
					return true
				}
				for key, nested := range typed {
					if key == "file" {
						continue
					}
					if walk(nested) {
						return true
					}
				}
			case []any:
				return slices.ContainsFunc(typed, walk)
			}
			return false
		}

		return walk(decoded)
	}

	bookmarkEvents := []model.WebsocketEventType{
		model.WebsocketEventChannelBookmarkCreated,
		model.WebsocketEventChannelBookmarkUpdated,
		model.WebsocketEventChannelBookmarkDeleted,
		model.WebsocketEventChannelBookmarkSorted,
	}

	// exerciseBookmarkLifecycle drives the four bookmark broadcasts and reports, per event,
	// whether the recipient received file info.
	exerciseBookmarkLifecycle := func(t *testing.T) map[model.WebsocketEventType]bool {
		t.Helper()

		messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", bookmarkEvents)
		defer closeWS()

		file := createFile(t)
		created, appErr := th.App.CreateChannelBookmark(th.Context, createBookmark("File bookmark", model.ChannelBookmarkFile, th.BasicChannel.Id, file.Id), "")
		require.Nil(t, appErr)

		result := map[model.WebsocketEventType]bool{}
		result[model.WebsocketEventChannelBookmarkCreated] = hasFileInfo(t, nextEvent(t, messages, model.WebsocketEventChannelBookmarkCreated), "bookmark")

		toUpdate := created.Clone()
		toUpdate.DisplayName = "File bookmark renamed"
		_, appErr = th.App.UpdateChannelBookmark(th.Context, toUpdate, "")
		require.Nil(t, appErr)
		result[model.WebsocketEventChannelBookmarkUpdated] = hasFileInfo(t, nextEvent(t, messages, model.WebsocketEventChannelBookmarkUpdated), "bookmarks")

		otherFile := createFile(t)
		_, appErr = th.App.CreateChannelBookmark(th.Context, createBookmark("Second file bookmark", model.ChannelBookmarkFile, th.BasicChannel.Id, otherFile.Id), "")
		require.Nil(t, appErr)
		nextEvent(t, messages, model.WebsocketEventChannelBookmarkCreated)

		_, appErr = th.App.UpdateChannelBookmarkSortOrder(created.Id, th.BasicChannel.Id, 1, "")
		require.Nil(t, appErr)
		result[model.WebsocketEventChannelBookmarkSorted] = hasFileInfo(t, nextEvent(t, messages, model.WebsocketEventChannelBookmarkSorted), "bookmarks")

		_, appErr = th.App.DeleteChannelBookmark(created.Id, "")
		require.Nil(t, appErr)
		result[model.WebsocketEventChannelBookmarkDeleted] = hasFileInfo(t, nextEvent(t, messages, model.WebsocketEventChannelBookmarkDeleted), "bookmark")

		return result
	}

	t.Run("denied recipient receives no bookmark file info on any broadcast", func(t *testing.T) {
		mockDownloadDecision(t, false)

		for event, hasFile := range exerciseBookmarkLifecycle(t) {
			assert.False(t, hasFile, "%s should not carry file info for a denied recipient", event)
		}
	})

	t.Run("allowed recipient still receives bookmark file info on every broadcast", func(t *testing.T) {
		mockDownloadDecision(t, true)

		for event, hasFile := range exerciseBookmarkLifecycle(t) {
			assert.True(t, hasFile, "%s should carry file info for an allowed recipient", event)
		}
	})

	t.Run("link bookmarks are broadcast unchanged to a denied recipient", func(t *testing.T) {
		mockDownloadDecision(t, false)

		messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", bookmarkEvents)
		defer closeWS()

		created, appErr := th.App.CreateChannelBookmark(th.Context, createBookmark("Link bookmark", model.ChannelBookmarkLink, th.BasicChannel.Id, ""), "")
		require.Nil(t, appErr)

		msg := nextEvent(t, messages, model.WebsocketEventChannelBookmarkCreated)
		raw, ok := msg.GetData()["bookmark"].(string)
		require.True(t, ok)
		assert.Contains(t, raw, created.Id)
		assert.Contains(t, raw, "https://mattermost.com")
		assert.False(t, hasFileInfo(t, msg, "bookmark"))
	})
}
