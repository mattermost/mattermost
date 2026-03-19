// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func find_tab(slice []*model.ChannelTabWithFileInfo, id string) *model.ChannelTabWithFileInfo {
	for _, element := range slice {
		if element.Id == id {
			return element
		}
	}
	return nil
}

func createTab(name string, tabType model.ChannelTabType, channelId string, fileId string) *model.ChannelTab {
	tab := &model.ChannelTab{
		ChannelId:   channelId,
		DisplayName: name,
		Type:        tabType,
		Emoji:       ":smile:",
	}
	if tabType == model.ChannelTabLink {
		tab.LinkUrl = "https://mattermost.com"
	}
	if tabType == model.ChannelTabFile {
		tab.FileId = fileId
	}

	return tab
}

func TestCreateTab(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("create a channel tab", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

		tab1 := createTab("Link tab test", model.ChannelTabLink, th.BasicChannel.Id, "")
		tabResp, err := th.App.CreateChannelTab(th.Context, tab1, "")
		require.Nil(t, err)
		require.NotNil(t, tabResp)

		assert.Equal(t, tabResp.ChannelId, th.BasicChannel.Id)
		assert.NotEmpty(t, tabResp.Id)

		tab2 := createTab("File tab test", model.ChannelTabFile, th.BasicChannel.Id, "")

		tabResp, err = th.App.CreateChannelTab(th.Context, tab2, "")
		assert.Nil(t, tabResp)
		assert.NotNil(t, err)
	})

	t.Run("Cannot create more than MaxTabsPerChannel", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

		for i := 1; i < model.MaxTabsPerChannel; i++ {
			tab := createTab(fmt.Sprintf("Link tab test %d", i), model.ChannelTabLink, th.BasicChannel.Id, "")
			tabResp, err := th.App.CreateChannelTab(th.Context, tab, "")
			require.Nil(t, err)
			require.NotNil(t, tabResp)
			assert.Equal(t, tabResp.ChannelId, th.BasicChannel.Id)
			assert.NotEmpty(t, tabResp.Id)
		}

		tab := createTab("Tab that should not be added", model.ChannelTabLink, th.BasicChannel.Id, "")
		tabResp, err := th.App.CreateChannelTab(th.Context, tab, "")
		assert.Nil(t, tabResp)
		assert.NotNil(t, err)
	})
}

func TestUpdateTab(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	var updateTab *model.ChannelTabWithFileInfo

	testUpdateAnotherFile := func(th *TestHelper, t *testing.T) {
		file := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       th.BasicChannel.Id,
			CreatorId:       model.TabFileOwner,
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

		tab2 := createTab("File to be updated", model.ChannelTabFile, th.BasicChannel.Id, file.Id)
		tabResp, appErr := th.App.CreateChannelTab(th.Context, tab2, "")
		require.Nil(t, appErr)
		require.NotNil(t, tabResp)

		file2 := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       th.BasicChannel.Id,
			CreatorId:       model.TabFileOwner,
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
		err = th.App.Srv().Store().FileInfo().AttachToPost(th.Context, file2.Id, model.NewId(), th.BasicChannel.Id, model.TabFileOwner)
		assert.NoError(t, err)
		defer func() {
			err = th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, file2.Id)
			require.NoError(t, err)
		}()

		tab2.FileId = file2.Id
		tabResp, appErr = th.App.CreateChannelTab(th.Context, tab2, "")
		require.NotNil(t, appErr)
		require.Nil(t, tabResp)
	}

	var testUpdateInvalidFiles = func(th *TestHelper, t *testing.T, creatingUserId string, updatingUserId string) {
		file := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       th.BasicChannel.Id,
			CreatorId:       model.TabFileOwner,
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

		tab := createTab("File to be updated", model.ChannelTabFile, th.BasicChannel.Id, file.Id)
		tabToEdit, appErr := th.App.CreateChannelTab(th.Context, tab, "")
		require.Nil(t, appErr)
		require.NotNil(t, tabToEdit)

		otherChannel := th.CreateChannel(t, th.BasicTeam)

		createAt := time.Now().Add(-1 * time.Minute)
		deleteAt := createAt.Add(1 * time.Second)

		deletedFile := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       th.BasicChannel.Id,
			CreatorId:       model.TabFileOwner,
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

		updateTabPending := tabToEdit.Clone()
		updateTabPending.FileId = deletedFile.Id
		tabEdited, appErr := th.App.UpdateChannelTab(th.Context, updateTabPending, "")
		assert.NotNil(t, appErr)
		require.Nil(t, tabEdited)

		anotherChannelFile := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       otherChannel.Id,
			CreatorId:       model.TabFileOwner,
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

		updateTabPending = tabToEdit.Clone()
		updateTabPending.FileId = anotherChannelFile.Id
		tabEdited, appErr = th.App.UpdateChannelTab(th.Context, updateTabPending, "")
		assert.NotNil(t, appErr)
		require.Nil(t, tabEdited)
	}

	t.Run("same user update a channel tab", func(t *testing.T) {
		tab1 := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link tab test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		th.Context.Session().UserId = th.BasicUser.Id // set the user for the session
		tabResp, err := th.App.CreateChannelTab(th.Context, tab1, "")
		require.Nil(t, err)
		require.NotNil(t, tabResp)

		updateTab = tabResp.Clone()
		updateTab.DisplayName = "New name"
		time.Sleep(1 * time.Millisecond) // to avoid collisions
		response, _ := th.App.UpdateChannelTab(th.Context, updateTab, "")
		require.NotNil(t, response)
		assert.Greater(t, response.Updated.UpdateAt, response.Updated.CreateAt)

		testUpdateAnotherFile(th, t)

		testUpdateInvalidFiles(th, t, th.BasicUser.Id, th.BasicUser.Id)
	})

	t.Run("another user update a channel tab", func(t *testing.T) {
		updateTab2 := updateTab.Clone()
		updateTab2.DisplayName = "Another new name"
		th.Context.Session().UserId = th.BasicUser2.Id
		response, _ := th.App.UpdateChannelTab(th.Context, updateTab2, "")
		require.NotNil(t, response)
		assert.Equal(t, response.Updated.OriginalId, response.Deleted.Id)
		assert.Equal(t, response.Updated.DeleteAt, int64(0))
		assert.Greater(t, response.Deleted.DeleteAt, int64(0))
		assert.Equal(t, "Another new name", response.Updated.DisplayName)
		assert.Equal(t, "New name", response.Deleted.DisplayName)

		testUpdateAnotherFile(th, t)

		testUpdateInvalidFiles(th, t, th.BasicUser.Id, th.BasicUser.Id)
	})

	t.Run("update an already deleted channel tab", func(t *testing.T) {
		tab1 := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link tab test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		th.Context.Session().UserId = th.BasicUser.Id // set the user for the session
		tabResp, err := th.App.CreateChannelTab(th.Context, tab1, "")
		require.Nil(t, err)
		require.NotNil(t, tabResp)

		updateTab = tabResp.Clone()
		_, err = th.App.DeleteChannelTab(updateTab.Id, "")
		assert.Nil(t, err)

		updateTab.DisplayName = "New name"
		_, err = th.App.UpdateChannelTab(th.Context, updateTab, "")
		assert.NotNil(t, err)
	})

	t.Run("update a nonexisting channel tab", func(t *testing.T) {
		updateTab := &model.ChannelTab{
			Id:          model.NewId(),
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link tab test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}
		_, err := th.App.UpdateChannelTab(th.Context, updateTab.ToTabWithFileInfo(nil), "")
		assert.NotNil(t, err)
		assert.Equal(t, "app.channel.bookmark.get_existing.app_err", err.Id)
	})
}

func TestDeleteTab(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("delete a channel tab", func(t *testing.T) {
		tab1 := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link tab test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		th.Context.Session().UserId = th.BasicUser.Id // set the user for the session
		tabResp, err := th.App.CreateChannelTab(th.Context, tab1, "")
		require.Nil(t, err)
		require.NotNil(t, tabResp)

		tabResp, err = th.App.DeleteChannelTab(tabResp.Id, "")
		require.Nil(t, err)
		require.NotNil(t, tabResp)
		assert.Greater(t, tabResp.DeleteAt, int64(0))
	})
}

func TestGetChannelTabs(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	tab1 := &model.ChannelTab{
		ChannelId:   th.BasicChannel.Id,
		DisplayName: "Tab 1",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelTabLink,
		Emoji:       ":smile:",
	}

	_, appErr := th.App.CreateChannelTab(th.Context, tab1, "")
	assert.Nil(t, appErr)

	file := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       th.BasicChannel.Id,
		CreatorId:       model.TabFileOwner,
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

	tab2 := &model.ChannelTab{
		ChannelId:   th.BasicChannel.Id,
		DisplayName: "Tab 2",
		FileId:      file.Id,
		Type:        model.ChannelTabFile,
		Emoji:       ":smile:",
	}

	_, appErr = th.App.CreateChannelTab(th.Context, tab2, "")
	assert.Nil(t, appErr)

	t.Run("get tabs of a channel", func(t *testing.T) {
		tabs, err := th.App.GetChannelTabs(th.BasicChannel.Id, 0)
		require.Nil(t, err)
		require.NotNil(t, tabs)
		assert.Len(t, tabs, 2)
	})

	t.Run("get tabs of a channel after one is deleted (aka only return the changed tabs)", func(t *testing.T) {
		now := model.GetMillis()
		_, appErr := th.App.DeleteChannelTab(tab1.Id, "")
		assert.Nil(t, appErr)

		tabs, err := th.App.GetChannelTabs(th.BasicChannel.Id, 0)
		require.Nil(t, err)
		require.NotNil(t, tabs)
		assert.Len(t, tabs, 1)

		tabs, err = th.App.GetChannelTabs(th.BasicChannel.Id, now)
		require.Nil(t, err)
		require.NotNil(t, tabs)
		assert.Len(t, tabs, 1)

		deleted := false
		for _, b := range tabs {
			if b.DeleteAt > 0 {
				deleted = true
				break
			}
		}
		assert.Equal(t, deleted, true)
	})
}

func TestUpdateChannelTabSortOrder(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channelId := th.BasicChannel.Id
	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	tab0 := &model.ChannelTab{
		ChannelId:   channelId,
		DisplayName: "Tab 0",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelTabLink,
		Emoji:       ":smile:",
	}

	file := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       th.BasicChannel.Id,
		CreatorId:       model.TabFileOwner,
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

	tab1 := &model.ChannelTab{
		ChannelId:   channelId,
		DisplayName: "Tab 1",
		FileId:      file.Id,
		Type:        model.ChannelTabFile,
		Emoji:       ":smile:",
	}

	_, err := th.App.Srv().Store().FileInfo().Save(th.Context, file)
	require.NoError(t, err)
	defer func() {
		err = th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, file.Id)
		require.NoError(t, err)
	}()

	tab2 := &model.ChannelTab{
		ChannelId:   channelId,
		DisplayName: "Tab 2",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelTabLink,
	}

	tab3 := &model.ChannelTab{
		ChannelId:   channelId,
		DisplayName: "Tab 3",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelTabLink,
	}

	tab4 := &model.ChannelTab{
		ChannelId:   channelId,
		DisplayName: "Tab 4",
		LinkUrl:     "https://mattermost.com",
		Type:        model.ChannelTabLink,
	}

	tabResp, appErr := th.App.CreateChannelTab(th.Context, tab0, "")
	require.Nil(t, appErr)
	require.NotNil(t, tabResp)
	tab0 = tabResp.ChannelTab.Clone()

	tabResp, appErr = th.App.CreateChannelTab(th.Context, tab1, "")
	require.Nil(t, appErr)
	require.NotNil(t, tabResp)
	tab1 = tabResp.ChannelTab.Clone()

	tabResp, appErr = th.App.CreateChannelTab(th.Context, tab2, "")
	require.Nil(t, appErr)
	require.NotNil(t, tabResp)
	tab2 = tabResp.ChannelTab.Clone()

	tabResp, appErr = th.App.CreateChannelTab(th.Context, tab3, "")
	require.Nil(t, appErr)
	require.NotNil(t, tabResp)
	tab3 = tabResp.ChannelTab.Clone()

	tabResp, appErr = th.App.CreateChannelTab(th.Context, tab4, "")
	require.Nil(t, appErr)
	require.NotNil(t, tabResp)
	tab4 = tabResp.ChannelTab.Clone()

	t.Run("change order of tabs first to last", func(t *testing.T) {
		tabs, sortErr := th.App.UpdateChannelTabSortOrder(tab0.Id, channelId, int64(4), "")
		require.Nil(t, sortErr)
		require.NotNil(t, tabs)

		assert.Equal(t, find_tab(tabs, tab1.Id).SortOrder, int64(0))
		assert.Equal(t, find_tab(tabs, tab2.Id).SortOrder, int64(1))
		assert.Equal(t, find_tab(tabs, tab3.Id).SortOrder, int64(2))
		assert.Equal(t, find_tab(tabs, tab4.Id).SortOrder, int64(3))
		assert.Equal(t, find_tab(tabs, tab0.Id).SortOrder, int64(4))
	})

	t.Run("change order of tabs last to first", func(t *testing.T) {
		tabs, sortErr := th.App.UpdateChannelTabSortOrder(tab0.Id, channelId, int64(0), "")
		require.Nil(t, sortErr)
		require.NotNil(t, tabs)

		assert.Equal(t, find_tab(tabs, tab0.Id).SortOrder, int64(0))
		assert.Equal(t, find_tab(tabs, tab1.Id).SortOrder, int64(1))
		assert.Equal(t, find_tab(tabs, tab2.Id).SortOrder, int64(2))
		assert.Equal(t, find_tab(tabs, tab3.Id).SortOrder, int64(3))
		assert.Equal(t, find_tab(tabs, tab4.Id).SortOrder, int64(4))
	})

	t.Run("change order of tabs first to third", func(t *testing.T) {
		tabs, sortErr := th.App.UpdateChannelTabSortOrder(tab0.Id, channelId, int64(2), "")
		require.Nil(t, sortErr)
		require.NotNil(t, tabs)

		assert.Equal(t, find_tab(tabs, tab1.Id).SortOrder, int64(0))
		assert.Equal(t, find_tab(tabs, tab2.Id).SortOrder, int64(1))
		assert.Equal(t, find_tab(tabs, tab0.Id).SortOrder, int64(2))
		assert.Equal(t, find_tab(tabs, tab3.Id).SortOrder, int64(3))
		assert.Equal(t, find_tab(tabs, tab4.Id).SortOrder, int64(4))

		// now reset order
		_, appErr = th.App.UpdateChannelTabSortOrder(tab0.Id, channelId, int64(0), "")
		assert.Nil(t, appErr)
	})

	t.Run("change order of tabs second to third", func(t *testing.T) {
		tabs, sortErr := th.App.UpdateChannelTabSortOrder(tab1.Id, channelId, int64(2), "")
		require.Nil(t, sortErr)
		require.NotNil(t, tabs)

		assert.Equal(t, find_tab(tabs, tab0.Id).SortOrder, int64(0))
		assert.Equal(t, find_tab(tabs, tab2.Id).SortOrder, int64(1))
		assert.Equal(t, find_tab(tabs, tab1.Id).SortOrder, int64(2))
		assert.Equal(t, find_tab(tabs, tab3.Id).SortOrder, int64(3))
		assert.Equal(t, find_tab(tabs, tab4.Id).SortOrder, int64(4))
	})

	t.Run("change order of tabs third to second", func(t *testing.T) {
		tabs, sortErr := th.App.UpdateChannelTabSortOrder(tab1.Id, channelId, int64(1), "")
		require.Nil(t, sortErr)
		require.NotNil(t, tabs)

		assert.Equal(t, find_tab(tabs, tab0.Id).SortOrder, int64(0))
		assert.Equal(t, find_tab(tabs, tab1.Id).SortOrder, int64(1))
		assert.Equal(t, find_tab(tabs, tab2.Id).SortOrder, int64(2))
		assert.Equal(t, find_tab(tabs, tab3.Id).SortOrder, int64(3))
		assert.Equal(t, find_tab(tabs, tab4.Id).SortOrder, int64(4))
	})

	t.Run("change order of tabs last to previous last", func(t *testing.T) {
		tabs, sortErr := th.App.UpdateChannelTabSortOrder(tab4.Id, channelId, int64(3), "")
		require.Nil(t, sortErr)
		require.NotNil(t, tabs)

		assert.Equal(t, find_tab(tabs, tab0.Id).SortOrder, int64(0))
		assert.Equal(t, find_tab(tabs, tab1.Id).SortOrder, int64(1))
		assert.Equal(t, find_tab(tabs, tab2.Id).SortOrder, int64(2))
		assert.Equal(t, find_tab(tabs, tab4.Id).SortOrder, int64(3))
		assert.Equal(t, find_tab(tabs, tab3.Id).SortOrder, int64(4))
	})

	t.Run("change order of tabs last to second", func(t *testing.T) {
		tabs, sortErr := th.App.UpdateChannelTabSortOrder(tab3.Id, channelId, int64(1), "")
		require.Nil(t, sortErr)
		require.NotNil(t, tabs)

		assert.Equal(t, find_tab(tabs, tab0.Id).SortOrder, int64(0))
		assert.Equal(t, find_tab(tabs, tab3.Id).SortOrder, int64(1))
		assert.Equal(t, find_tab(tabs, tab1.Id).SortOrder, int64(2))
		assert.Equal(t, find_tab(tabs, tab2.Id).SortOrder, int64(3))
		assert.Equal(t, find_tab(tabs, tab4.Id).SortOrder, int64(4))
	})

	t.Run("change order of tabs error when new index is out of bounds", func(t *testing.T) {
		_, appErr = th.App.UpdateChannelTabSortOrder(tab3.Id, channelId, int64(-1), "")
		assert.NotNil(t, appErr)
		_, appErr = th.App.UpdateChannelTabSortOrder(tab3.Id, channelId, int64(5), "")
		assert.NotNil(t, appErr)
	})

	t.Run("change order of tabs error when tab not found", func(t *testing.T) {
		_, appErr = th.App.UpdateChannelTabSortOrder(model.NewId(), channelId, int64(0), "")
		assert.NotNil(t, appErr)
	})
}
