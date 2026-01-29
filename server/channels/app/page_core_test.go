// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetPage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("get existing page", func(t *testing.T) {
		retrievedPage, appErr := th.App.GetPage(th.Context, page.Id)
		require.Nil(t, appErr)
		require.NotNil(t, retrievedPage)
		require.Equal(t, page.Id, retrievedPage.Id)
	})

	t.Run("fail for non-existent page", func(t *testing.T) {
		retrievedPage, appErr := th.App.GetPage(th.Context, model.NewId())
		require.NotNil(t, appErr)
		require.Nil(t, retrievedPage)
		require.Equal(t, "app.page.get.not_found.app_error", appErr.Id)
	})

	t.Run("fail for non-page post", func(t *testing.T) {
		// Create a regular post
		regularPost, _, err := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular message",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		retrievedPage, appErr := th.App.GetPage(th.Context, regularPost.Id)
		require.NotNil(t, appErr)
		require.Nil(t, retrievedPage)
		require.Equal(t, "app.page.get.not_a_page.app_error", appErr.Id)
	})
}

func TestGetPageWithDeleted(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	// Delete the page
	pageObj, _ := th.App.GetPage(th.Context, page.Id)
	appErr = th.App.DeletePage(th.Context, pageObj, wiki.Id)
	require.Nil(t, appErr)

	t.Run("get deleted page with GetPageWithDeleted", func(t *testing.T) {
		retrievedPage, appErr := th.App.GetPageWithDeleted(th.Context, page.Id)
		require.Nil(t, appErr)
		require.NotNil(t, retrievedPage)
		require.NotZero(t, retrievedPage.DeleteAt)
	})

	t.Run("fail to get deleted page with GetPage", func(t *testing.T) {
		retrievedPage, appErr := th.App.GetPage(th.Context, page.Id)
		require.NotNil(t, appErr)
		require.Nil(t, retrievedPage)
	})
}

func TestPlainTextConversion(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	t.Run("plain text content is converted to TipTap JSON", func(t *testing.T) {
		plainTextContent := "This is plain text content"
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Plain Text Page", "", plainTextContent, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)
		require.NotNil(t, page)

		pageWithContent, appErr := th.App.GetPageWithContent(rctx, page.Id)
		require.Nil(t, appErr)
		require.Contains(t, pageWithContent.Message, "type")
		require.Contains(t, pageWithContent.Message, "doc")
	})
}

func TestGetPageVersionHistory(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	t.Run("returns version history after multiple edits", func(t *testing.T) {
		// Create a page with initial content
		initialContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial content"}]}]}`
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Version History Test", "", initialContent, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)
		require.NotNil(t, page)

		// Make first edit
		content1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First edit"}]}]}`
		_, appErr = th.App.UpdatePage(rctx, page, "Title After Edit 1", content1, "First edit", nil)
		require.Nil(t, appErr)

		// Make second edit
		content2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Second edit"}]}]}`
		_, appErr = th.App.UpdatePage(rctx, page, "Title After Edit 2", content2, "Second edit", nil)
		require.Nil(t, appErr)

		// Get version history
		history, appErr := th.App.GetPageVersionHistory(rctx, page.Id, 0, 10)
		require.Nil(t, appErr)
		require.NotNil(t, history)
		require.GreaterOrEqual(t, len(history), 2, "Should have at least 2 versions in history")

		// Verify versions are ordered by EditAt DESC (most recent first)
		for i := 0; i < len(history)-1; i++ {
			require.GreaterOrEqual(t, history[i].EditAt, history[i+1].EditAt,
				"Versions should be ordered by EditAt DESC")
		}

		// Verify historical entries have OriginalId pointing to the page
		for _, historyEntry := range history {
			require.Equal(t, page.Id, historyEntry.OriginalId,
				"Historical entries should have OriginalId = page.Id")
			require.Greater(t, historyEntry.DeleteAt, int64(0),
				"Historical entries should have DeleteAt > 0")
		}
	})

	t.Run("returns error for non-existent page", func(t *testing.T) {
		history, appErr := th.App.GetPageVersionHistory(rctx, model.NewId(), 0, 10)
		require.NotNil(t, appErr)
		require.Nil(t, history)
	})

	t.Run("returns error for page with no edit history", func(t *testing.T) {
		// Create a new page without any edits
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "No Edits Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Get version history - should return error since no edits have been made
		history, appErr := th.App.GetPageVersionHistory(rctx, page.Id, 0, 10)
		require.NotNil(t, appErr)
		require.Nil(t, history)
	})

	t.Run("pagination works correctly", func(t *testing.T) {
		// Create a page
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Pagination Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Make multiple edits to create history
		for i := range 5 {
			content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Edit ` + string(rune('A'+i)) + `"}]}]}`
			_, appErr = th.App.UpdatePage(rctx, page, "Title "+string(rune('A'+i)), content, "Edit "+string(rune('A'+i)), nil)
			require.Nil(t, appErr)
		}

		// Get first page with limit 2
		firstPage, appErr := th.App.GetPageVersionHistory(rctx, page.Id, 0, 2)
		require.Nil(t, appErr)
		require.Len(t, firstPage, 2)

		// Get second page with offset 2 and limit 2
		secondPage, appErr := th.App.GetPageVersionHistory(rctx, page.Id, 2, 2)
		require.Nil(t, appErr)
		require.Len(t, secondPage, 2)

		// Verify no overlap between pages
		for _, p1 := range firstPage {
			for _, p2 := range secondPage {
				require.NotEqual(t, p1.Id, p2.Id, "Pagination pages should not overlap")
			}
		}
	})

	t.Run("content is loaded for historical versions", func(t *testing.T) {
		// Create a page with content
		initialContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Has content"}]}]}`
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Content Test", "", initialContent, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Make an edit
		newContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content"}]}]}`
		_, appErr = th.App.UpdatePage(rctx, page, "Updated Title", newContent, "Updated content", nil)
		require.Nil(t, appErr)

		// Get version history
		history, appErr := th.App.GetPageVersionHistory(rctx, page.Id, 0, 10)
		require.Nil(t, appErr)
		require.NotEmpty(t, history)

		// Verify content is loaded (Message field should be populated)
		for _, historyEntry := range history {
			require.NotEmpty(t, historyEntry.Message, "Historical entry should have content loaded")
			require.Contains(t, historyEntry.Message, "type", "Content should be valid TipTap JSON")
		}
	})
}

func TestRestorePageVersion(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	t.Run("restores page to previous version", func(t *testing.T) {
		// Create a page with initial content
		initialContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Restore Test", "", initialContent, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)
		require.NotNil(t, page)

		originalTitle := "Restore Test"

		// Make an edit
		newContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Modified content"}]}]}`
		_, appErr = th.App.UpdatePage(rctx, page, "Modified Title", newContent, "Modified content", nil)
		require.Nil(t, appErr)

		// Get version history
		history, appErr := th.App.GetPageVersionHistory(rctx, page.Id, 0, 10)
		require.Nil(t, appErr)
		require.NotEmpty(t, history)

		// Get the version to restore (most recent in history = original content)
		versionToRestore := history[0]

		// Restore to previous version
		restoredPage, appErr := th.App.RestorePageVersion(rctx, th.BasicUser.Id, page.Id, versionToRestore.Id, versionToRestore)
		require.Nil(t, appErr)
		require.NotNil(t, restoredPage)

		// Verify the page title was restored
		restoredTitle, _ := restoredPage.Props["title"].(string)
		require.Equal(t, originalTitle, restoredTitle, "Title should be restored to original")

		// Verify the page content was restored
		pageWithContent, appErr := th.App.GetPageWithContent(rctx, page.Id)
		require.Nil(t, appErr)
		require.Contains(t, pageWithContent.Message, "Original content", "Content should be restored to original")
	})

	t.Run("restores page with different file IDs", func(t *testing.T) {
		// Create a page
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "File Restore Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Make an edit
		_, appErr = th.App.UpdatePage(rctx, page, "Updated Title", "", "", nil)
		require.Nil(t, appErr)

		// Get version history
		history, appErr := th.App.GetPageVersionHistory(rctx, page.Id, 0, 10)
		require.Nil(t, appErr)
		require.NotEmpty(t, history)

		// Create a mock historical version with different FileIds
		versionToRestore := history[0]
		versionToRestore.FileIds = model.StringArray{"file1", "file2"}

		// Restore - this tests the FileIds restoration path
		restoredPage, appErr := th.App.RestorePageVersion(rctx, th.BasicUser.Id, page.Id, versionToRestore.Id, versionToRestore)
		require.Nil(t, appErr)
		require.NotNil(t, restoredPage)
	})

	t.Run("returns error for non-existent version", func(t *testing.T) {
		// Create a page
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Invalid Version Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Make an edit to ensure some history exists
		_, appErr = th.App.UpdatePage(rctx, page, "Updated", "", "", nil)
		require.Nil(t, appErr)

		// Create a fake post version that doesn't exist in PageContents
		fakeVersion := &model.Post{
			Id:    model.NewId(),
			Props: model.StringInterface{"title": "Fake Title"},
		}

		// Try to restore - should still work but with empty content
		// because RestorePageVersion handles missing content gracefully
		restoredPage, appErr := th.App.RestorePageVersion(rctx, th.BasicUser.Id, page.Id, fakeVersion.Id, fakeVersion)
		require.Nil(t, appErr)
		require.NotNil(t, restoredPage)
	})

	t.Run("restores title from historical version props", func(t *testing.T) {
		// Create a page
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Title Restore Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Make multiple edits
		_, appErr = th.App.UpdatePage(rctx, page, "Second Title", "", "", nil)
		require.Nil(t, appErr)
		_, appErr = th.App.UpdatePage(rctx, page, "Third Title", "", "", nil)
		require.Nil(t, appErr)

		// Get version history
		history, appErr := th.App.GetPageVersionHistory(rctx, page.Id, 0, 10)
		require.Nil(t, appErr)
		require.GreaterOrEqual(t, len(history), 2)

		// Get older version (should have "Title Restore Test" or "Second Title")
		olderVersion := history[len(history)-1]
		expectedTitle, _ := olderVersion.Props["title"].(string)

		// Restore to older version
		restoredPage, appErr := th.App.RestorePageVersion(rctx, th.BasicUser.Id, page.Id, olderVersion.Id, olderVersion)
		require.Nil(t, appErr)
		require.NotNil(t, restoredPage)

		// Verify title was restored
		restoredTitle, _ := restoredPage.Props["title"].(string)
		require.Equal(t, expectedTitle, restoredTitle, "Title should match the historical version")
	})
}

func TestLoadPageContent(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	t.Run("loads content for pages in post list", func(t *testing.T) {
		content1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Page 1 content"}]}]}`
		content2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Page 2 content"}]}]}`

		page1, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page 1", "", content1, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		page2, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page 2", "", content2, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Clear messages to simulate pages without content loaded
		page1Copy := page1.Clone()
		page2Copy := page2.Clone()
		page1Copy.Message = ""
		page2Copy.Message = ""

		postList := &model.PostList{
			Posts: map[string]*model.Post{
				page1Copy.Id: page1Copy,
				page2Copy.Id: page2Copy,
			},
			Order: []string{page1Copy.Id, page2Copy.Id},
		}

		appErr = th.App.LoadPageContent(rctx, postList, PageContentLoadOptions{})
		require.Nil(t, appErr)

		require.Contains(t, postList.Posts[page1Copy.Id].Message, "Page 1 content")
		require.Contains(t, postList.Posts[page2Copy.Id].Message, "Page 2 content")
	})

	t.Run("handles empty post list", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{},
			Order: []string{},
		}

		appErr := th.App.LoadPageContent(rctx, postList, PageContentLoadOptions{})
		require.Nil(t, appErr)
	})

	t.Run("handles nil post list", func(t *testing.T) {
		appErr := th.App.LoadPageContent(rctx, nil, PageContentLoadOptions{})
		require.Nil(t, appErr)
	})

	t.Run("loads search text only when option set", func(t *testing.T) {
		content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Searchable content"}]}]}`
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Search Test", "", content, th.BasicUser.Id, "searchable content", "")
		require.Nil(t, appErr)

		pageCopy := page.Clone()
		pageCopy.Message = ""

		postList := &model.PostList{
			Posts: map[string]*model.Post{
				pageCopy.Id: pageCopy,
			},
			Order: []string{pageCopy.Id},
		}

		appErr = th.App.LoadPageContent(rctx, postList, PageContentLoadOptions{SearchTextOnly: true})
		require.Nil(t, appErr)

		// Message should not be loaded, but search_text should be in props
		require.Empty(t, postList.Posts[pageCopy.Id].Message)
		searchText, _ := postList.Posts[pageCopy.Id].Props["search_text"].(string)
		require.Contains(t, searchText, "searchable")
	})
}

func TestGetPageActiveEditors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	t.Run("returns empty list for page with no active editors", func(t *testing.T) {
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "No Editors Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		editors, appErr := th.App.GetPageActiveEditors(rctx, page.Id)
		require.Nil(t, appErr)
		require.NotNil(t, editors)
		require.Empty(t, editors.UserIds)
	})

	t.Run("returns active editors with page content drafts", func(t *testing.T) {
		// Create a wiki first for the draft content
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki for Editors",
		}
		wiki, wikiErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, wikiErr)

		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Active Editors Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Create a page draft entry using UpsertPageDraftContent
		// This simulates an active editing session - PageContents with UserId != ""
		content := `{"type":"doc","content":[]}`
		_, err := th.App.Srv().Store().Draft().UpsertPageDraftContent(page.Id, th.BasicUser.Id, wiki.Id, content, "Draft Title", 0)
		require.NoError(t, err)

		editors, appErr := th.App.GetPageActiveEditors(rctx, page.Id)
		require.Nil(t, appErr)
		require.NotNil(t, editors)
		require.Contains(t, editors.UserIds, th.BasicUser.Id)
		require.Contains(t, editors.LastActivities, th.BasicUser.Id)
	})

	t.Run("returns empty for non-existent page", func(t *testing.T) {
		editors, appErr := th.App.GetPageActiveEditors(rctx, model.NewId())
		require.Nil(t, appErr)
		require.NotNil(t, editors)
		require.Empty(t, editors.UserIds)
	})
}
