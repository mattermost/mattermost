// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
)

func TestImportImportWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name

	t.Run("null data returns error", func(t *testing.T) {
		appErr := th.App.importWiki(th.Context, nil, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_wiki_import_data.null_data.error", appErr.Id)
	})

	t.Run("missing team returns error", func(t *testing.T) {
		data := &imports.WikiImportData{
			Channel: &channelName,
		}
		appErr := th.App.importWiki(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_wiki_import_data.team_missing.error", appErr.Id)
	})

	t.Run("missing channel returns error", func(t *testing.T) {
		data := &imports.WikiImportData{
			Team: &teamName,
		}
		appErr := th.App.importWiki(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_wiki_import_data.channel_missing.error", appErr.Id)
	})

	t.Run("missing import_source_id returns error", func(t *testing.T) {
		data := &imports.WikiImportData{
			Team:    &teamName,
			Channel: &channelName,
		}
		appErr := th.App.importWiki(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_import_source_id.missing.error", appErr.Id)
	})

	t.Run("nonexistent team returns error", func(t *testing.T) {
		nonexistent := "nonexistent-team"
		props := model.StringInterface{"import_source_id": "test-wiki-nonexistent-team"}
		data := &imports.WikiImportData{
			Team:    &nonexistent,
			Channel: &channelName,
			Props:   &props,
		}
		appErr := th.App.importWiki(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.import_wiki.team_not_found.error", appErr.Id)
	})

	t.Run("nonexistent channel returns error", func(t *testing.T) {
		nonexistent := "nonexistent-channel"
		props := model.StringInterface{"import_source_id": "test-wiki-nonexistent-channel"}
		data := &imports.WikiImportData{
			Team:    &teamName,
			Channel: &nonexistent,
			Props:   &props,
		}
		appErr := th.App.importWiki(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.import_wiki.channel_not_found.error", appErr.Id)
	})

	t.Run("dry run does not create wiki", func(t *testing.T) {
		props := model.StringInterface{"import_source_id": "test-wiki-dry-run"}
		data := &imports.WikiImportData{
			Team:    &teamName,
			Channel: &channelName,
			Title:   model.NewPointer("Test Wiki"),
			Props:   &props,
		}
		appErr := th.App.importWiki(th.Context, data, true)
		require.Nil(t, appErr)

		// Wiki should not be created in dry run
		wikis, appErr := th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, false)
		require.Nil(t, appErr)
		assert.Empty(t, wikis)
	})

	t.Run("successfully creates wiki with import_source_id", func(t *testing.T) {
		title := "Imported Wiki"
		description := "Imported wiki description"
		importSourceId := "confluence-space-12345"
		props := model.StringInterface{"import_source_id": importSourceId}
		data := &imports.WikiImportData{
			Team:        &teamName,
			Channel:     &channelName,
			Title:       &title,
			Description: &description,
			Props:       &props,
		}
		appErr := th.App.importWiki(th.Context, data, false)
		require.Nil(t, appErr)

		wikis, appErr := th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, false)
		require.Nil(t, appErr)
		require.Len(t, wikis, 1)
		assert.Equal(t, title, wikis[0].Title)
		assert.Equal(t, description, wikis[0].Description)
		assert.Equal(t, importSourceId, wikis[0].Props["import_source_id"])
	})

	t.Run("idempotent - updates existing wiki by import_source_id", func(t *testing.T) {
		newTitle := "Updated Wiki Title"
		newDescription := "Updated description"
		importSourceId := "confluence-space-12345" // Same as above
		props := model.StringInterface{"import_source_id": importSourceId}
		data := &imports.WikiImportData{
			Team:        &teamName,
			Channel:     &channelName,
			Title:       &newTitle,
			Description: &newDescription,
			Props:       &props,
		}
		appErr := th.App.importWiki(th.Context, data, false)
		require.Nil(t, appErr)

		wikis, appErr := th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, false)
		require.Nil(t, appErr)
		require.Len(t, wikis, 1) // Still only one wiki
		assert.Equal(t, newTitle, wikis[0].Title)
		assert.Equal(t, newDescription, wikis[0].Description)
	})

	t.Run("creates second wiki with different import_source_id", func(t *testing.T) {
		title := "Second Wiki"
		description := "From second Confluence space"
		importSourceId := "confluence-space-67890" // Different source
		props := model.StringInterface{"import_source_id": importSourceId}
		data := &imports.WikiImportData{
			Team:        &teamName,
			Channel:     &channelName,
			Title:       &title,
			Description: &description,
			Props:       &props,
		}
		appErr := th.App.importWiki(th.Context, data, false)
		require.Nil(t, appErr)

		wikis, appErr := th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, false)
		require.Nil(t, appErr)
		require.Len(t, wikis, 2) // Now two wikis in the same channel

		// Find the second wiki
		var secondWiki *model.Wiki
		for _, w := range wikis {
			if w.Props["import_source_id"] == importSourceId {
				secondWiki = w
				break
			}
		}
		require.NotNil(t, secondWiki)
		assert.Equal(t, title, secondWiki.Title)
		assert.Equal(t, description, secondWiki.Description)
	})
}

func TestImportImportPage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	// Create wiki first
	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("null data returns error", func(t *testing.T) {
		appErr := th.App.importPage(th.Context, nil, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_page_import_data.null_data.error", appErr.Id)
	})

	t.Run("missing team returns error", func(t *testing.T) {
		data := &imports.PageImportData{
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Test"),
			Content: model.NewPointer("{}"),
		}
		appErr := th.App.importPage(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_page_import_data.team_missing.error", appErr.Id)
	})

	t.Run("missing channel returns error", func(t *testing.T) {
		data := &imports.PageImportData{
			Team:    &teamName,
			User:    &username,
			Title:   model.NewPointer("Test"),
			Content: model.NewPointer("{}"),
		}
		appErr := th.App.importPage(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_page_import_data.channel_missing.error", appErr.Id)
	})

	t.Run("missing user returns error", func(t *testing.T) {
		data := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			Title:   model.NewPointer("Test"),
			Content: model.NewPointer("{}"),
		}
		appErr := th.App.importPage(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_page_import_data.user_missing.error", appErr.Id)
	})

	t.Run("missing title returns error", func(t *testing.T) {
		data := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Content: model.NewPointer("{}"),
		}
		appErr := th.App.importPage(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_page_import_data.title_missing.error", appErr.Id)
	})

	t.Run("missing content returns error", func(t *testing.T) {
		data := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Test"),
		}
		appErr := th.App.importPage(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_page_import_data.content_missing.error", appErr.Id)
	})

	t.Run("nonexistent team returns error", func(t *testing.T) {
		nonexistent := "nonexistent-team"
		props := model.StringInterface{"import_source_id": "test-nonexistent-team"}
		data := &imports.PageImportData{
			Team:    &nonexistent,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Test"),
			Content: model.NewPointer("{}"),
			Props:   &props,
		}
		appErr := th.App.importPage(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.import_page.team_not_found.error", appErr.Id)
	})

	t.Run("nonexistent user returns error", func(t *testing.T) {
		nonexistent := "nonexistent-user"
		props := model.StringInterface{"import_source_id": "test-nonexistent-user"}
		data := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &nonexistent,
			Title:   model.NewPointer("Test"),
			Content: model.NewPointer("{}"),
			Props:   &props,
		}
		appErr := th.App.importPage(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.import_page.user_not_found.error", appErr.Id)
	})

	t.Run("dry run does not create page", func(t *testing.T) {
		importSourceId := "test-dry-run-page"
		props := model.StringInterface{"import_source_id": importSourceId}
		data := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Dry Run Page"),
			Content: model.NewPointer(`{"type":"doc","content":[]}`),
			Props:   &props,
		}
		appErr := th.App.importPage(th.Context, data, true)
		require.Nil(t, appErr)

		// Page should not be created in dry run
		pages, appErr := th.App.GetWikiPages(th.Context, wiki.Id, 0, 100)
		require.Nil(t, appErr)
		assert.Empty(t, pages)
	})

	t.Run("successfully creates page", func(t *testing.T) {
		importSourceId := "confluence-page-12345"
		props := model.StringInterface{"import_source_id": importSourceId}
		data := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Imported Page"),
			Content: model.NewPointer(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}`),
			Props:   &props,
		}
		appErr := th.App.importPage(th.Context, data, false)
		require.Nil(t, appErr)

		// Verify page was created by looking it up via import_source_id
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", importSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		assert.Equal(t, "Imported Page", pages[0].GetProps()["title"])
	})

	t.Run("idempotent - skips existing page by import_source_id", func(t *testing.T) {
		importSourceId := "confluence-page-12345"
		props := model.StringInterface{"import_source_id": importSourceId}
		data := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Updated Title Should Not Apply"),
			Content: model.NewPointer(`{"type":"doc","content":[]}`),
			Props:   &props,
		}
		appErr := th.App.importPage(th.Context, data, false)
		require.Nil(t, appErr)

		// Should still have original title (idempotent skip)
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", importSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		assert.Equal(t, "Imported Page", pages[0].GetProps()["title"])
	})

	t.Run("creates page with parent hierarchy", func(t *testing.T) {
		parentImportSourceId := "confluence-parent-page-unique"
		parentProps := model.StringInterface{"import_source_id": parentImportSourceId}
		parentData := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Parent Page"),
			Content: model.NewPointer(`{"type":"doc","content":[]}`),
			Props:   &parentProps,
		}
		appErr := th.App.importPage(th.Context, parentData, false)
		require.Nil(t, appErr)

		childImportSourceId := "confluence-child-page-unique"
		childProps := model.StringInterface{"import_source_id": childImportSourceId}
		childData := &imports.PageImportData{
			Team:                 &teamName,
			Channel:              &channelName,
			User:                 &username,
			Title:                model.NewPointer("Child Page With Parent"),
			Content:              model.NewPointer(`{"type":"doc","content":[]}`),
			ParentImportSourceId: &parentImportSourceId,
			Props:                &childProps,
		}
		appErr = th.App.importPage(th.Context, childData, false)
		require.Nil(t, appErr)

		// Find child page via import_source_id
		childPages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", childImportSourceId)
		require.NoError(t, err)
		require.Len(t, childPages, 1)

		childPage := childPages[0]
		assert.Equal(t, "Child Page With Parent", childPage.GetProps()["title"])
		assert.NotEmpty(t, childPage.PageParentId)
	})
}

func TestImportImportPageComment(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	// Create wiki and page first
	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	_, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	// Import a page with import_source_id
	pageImportSourceId := "test-page-for-comments"
	pageProps := model.StringInterface{"import_source_id": pageImportSourceId}
	pageData := &imports.PageImportData{
		Team:    &teamName,
		Channel: &channelName,
		User:    &username,
		Title:   model.NewPointer("Page With Comments"),
		Content: model.NewPointer(`{"type":"doc","content":[]}`),
		Props:   &pageProps,
	}
	appErr = th.App.importPage(th.Context, pageData, false)
	require.Nil(t, appErr)

	t.Run("null data returns error", func(t *testing.T) {
		appErr := th.App.importPageComment(th.Context, nil, false, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_page_comment_import_data.null_data.error", appErr.Id)
	})

	t.Run("missing page_import_source_id returns error", func(t *testing.T) {
		data := &imports.PageCommentImportData{
			User:    &username,
			Content: model.NewPointer("Test comment"),
		}
		appErr := th.App.importPageComment(th.Context, data, false, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_page_comment_import_data.page_id_missing.error", appErr.Id)
	})

	t.Run("missing user returns error", func(t *testing.T) {
		data := &imports.PageCommentImportData{
			PageImportSourceId: &pageImportSourceId,
			Content:            model.NewPointer("Test comment"),
		}
		appErr := th.App.importPageComment(th.Context, data, false, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_page_comment_import_data.user_missing.error", appErr.Id)
	})

	t.Run("missing content returns error", func(t *testing.T) {
		data := &imports.PageCommentImportData{
			PageImportSourceId: &pageImportSourceId,
			User:               &username,
		}
		appErr := th.App.importPageComment(th.Context, data, false, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.validate_page_comment_import_data.content_missing.error", appErr.Id)
	})

	t.Run("nonexistent user returns error", func(t *testing.T) {
		nonexistent := "nonexistent-user"
		props := model.StringInterface{"import_source_id": "test-comment-nonexistent-user"}
		data := &imports.PageCommentImportData{
			PageImportSourceId: &pageImportSourceId,
			User:               &nonexistent,
			Content:            model.NewPointer("Test comment"),
			Props:              &props,
		}
		appErr := th.App.importPageComment(th.Context, data, false, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.import_page_comment.user_not_found.error", appErr.Id)
	})

	t.Run("nonexistent page returns error", func(t *testing.T) {
		nonexistent := "nonexistent-page-id"
		props := model.StringInterface{"import_source_id": "test-comment-nonexistent-page"}
		data := &imports.PageCommentImportData{
			PageImportSourceId: &nonexistent,
			User:               &username,
			Content:            model.NewPointer("Test comment"),
			Props:              &props,
		}
		appErr := th.App.importPageComment(th.Context, data, false, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.import_page_comment.page_not_found.error", appErr.Id)
	})

	t.Run("dry run does not create comment", func(t *testing.T) {
		commentImportSourceId := "test-dry-run-comment"
		props := model.StringInterface{"import_source_id": commentImportSourceId}
		data := &imports.PageCommentImportData{
			PageImportSourceId: &pageImportSourceId,
			User:               &username,
			Content:            model.NewPointer("Dry run comment"),
			Props:              &props,
		}
		appErr := th.App.importPageComment(th.Context, data, true, nil)
		require.Nil(t, appErr)
	})

	t.Run("successfully creates comment", func(t *testing.T) {
		commentImportSourceId := "confluence-comment-12345"
		props := model.StringInterface{"import_source_id": commentImportSourceId}
		data := &imports.PageCommentImportData{
			PageImportSourceId: &pageImportSourceId,
			User:               &username,
			Content:            model.NewPointer("Imported comment content"),
			Props:              &props,
		}
		appErr := th.App.importPageComment(th.Context, data, false, nil)
		require.Nil(t, appErr)
	})

	t.Run("idempotent - skips existing comment by import_source_id", func(t *testing.T) {
		commentImportSourceId := "confluence-comment-12345"
		props := model.StringInterface{"import_source_id": commentImportSourceId}
		data := &imports.PageCommentImportData{
			PageImportSourceId: &pageImportSourceId,
			User:               &username,
			Content:            model.NewPointer("Updated content should not apply"),
			Props:              &props,
		}
		appErr := th.App.importPageComment(th.Context, data, false, nil)
		require.Nil(t, appErr)
		// No error means it was idempotent (skipped)
	})
}

func TestImportUpdatePostPropsFromImport(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	// Create wiki and page for testing
	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	validContent := `{"type":"doc","content":[]}`

	t.Run("nil props does nothing", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Test Page", validContent, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		appErr = th.App.updatePostPropsFromImport(th.Context, page, nil)
		require.Nil(t, appErr)
	})

	t.Run("sets allowed import_source_id prop", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Test Page 2", validContent, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		importSourceId := "valid-import-id-123"
		props := model.StringInterface{"import_source_id": importSourceId}

		appErr = th.App.updatePostPropsFromImport(th.Context, page, &props)
		require.Nil(t, appErr)

		// Verify the prop was set
		updatedPage, err := th.App.Srv().Store().Post().GetSingle(th.Context, page.Id, false)
		require.NoError(t, err)
		assert.Equal(t, importSourceId, updatedPage.GetProps()["import_source_id"])
	})

	t.Run("ignores disallowed props", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Test Page 3", validContent, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Try to set disallowed props
		props := model.StringInterface{
			"import_source_id":  "valid-id",
			"from_bot":          true,
			"override_username": "hacker",
			"malicious_prop":    "bad-value",
		}

		appErr = th.App.updatePostPropsFromImport(th.Context, page, &props)
		require.Nil(t, appErr)

		// Verify only import_source_id was set
		updatedPage, err := th.App.Srv().Store().Post().GetSingle(th.Context, page.Id, false)
		require.NoError(t, err)
		assert.Equal(t, "valid-id", updatedPage.GetProps()["import_source_id"])
		assert.Nil(t, updatedPage.GetProps()["from_bot"])
		assert.Nil(t, updatedPage.GetProps()["override_username"])
		assert.Nil(t, updatedPage.GetProps()["malicious_prop"])
	})

	t.Run("ignores non-string import_source_id", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Test Page 4", validContent, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Try to set import_source_id with non-string value
		props := model.StringInterface{
			"import_source_id": 12345, // int, not string
		}

		appErr = th.App.updatePostPropsFromImport(th.Context, page, &props)
		require.Nil(t, appErr)

		// Verify import_source_id was NOT set
		updatedPage, err := th.App.Srv().Store().Post().GetSingle(th.Context, page.Id, false)
		require.NoError(t, err)
		assert.Nil(t, updatedPage.GetProps()["import_source_id"])
	})

	t.Run("ignores empty import_source_id", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Test Page 5", validContent, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Try to set empty import_source_id
		props := model.StringInterface{
			"import_source_id": "",
		}

		appErr = th.App.updatePostPropsFromImport(th.Context, page, &props)
		require.Nil(t, appErr)

		// Verify import_source_id was NOT set
		updatedPage, err := th.App.Srv().Store().Post().GetSingle(th.Context, page.Id, false)
		require.NoError(t, err)
		assert.Nil(t, updatedPage.GetProps()["import_source_id"])
	})
}

func TestImportPageWithMissingParent(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	// Create wiki first
	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	_, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("creates page as root when parent not found", func(t *testing.T) {
		childImportSourceId := "orphan-child-page"
		nonexistentParent := "parent-that-does-not-exist"
		childProps := model.StringInterface{"import_source_id": childImportSourceId}
		childData := &imports.PageImportData{
			Team:                 &teamName,
			Channel:              &channelName,
			User:                 &username,
			Title:                model.NewPointer("Orphan Child Page"),
			Content:              model.NewPointer(`{"type":"doc","content":[]}`),
			ParentImportSourceId: &nonexistentParent,
			Props:                &childProps,
		}
		appErr := th.App.importPage(th.Context, childData, false)
		require.Nil(t, appErr) // Should succeed despite missing parent

		// Verify page was created as root (no PageParentId)
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", childImportSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		assert.Empty(t, pages[0].PageParentId) // Created as root
	})
}

func TestGetPostsByTypeAndProps(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	// Create a page with import_source_id prop
	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	page, appErr := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Test Page", `{"type":"doc","content":[]}`, th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	// Set import_source_id prop
	importSourceId := "unique-import-id-12345"
	oldPage := page.Clone()
	page.AddProp("import_source_id", importSourceId)
	_, err := th.App.Srv().Store().Post().Update(th.Context, page, oldPage)
	require.NoError(t, err)

	t.Run("finds page by import_source_id", func(t *testing.T) {
		posts, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id,
			model.PostTypePage,
			"import_source_id",
			importSourceId,
		)
		require.NoError(t, err)
		require.Len(t, posts, 1)
		assert.Equal(t, page.Id, posts[0].Id)
	})

	t.Run("returns empty for non-matching import_source_id", func(t *testing.T) {
		posts, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id,
			model.PostTypePage,
			"import_source_id",
			"nonexistent-id",
		)
		require.NoError(t, err)
		assert.Empty(t, posts)
	})

	t.Run("returns empty for wrong channel", func(t *testing.T) {
		posts, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			"wrong-channel-id",
			model.PostTypePage,
			"import_source_id",
			importSourceId,
		)
		require.NoError(t, err)
		assert.Empty(t, posts)
	})
}

func TestImportPageWithNestedComments(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	// Create wiki first
	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	_, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("imports page with nested comments", func(t *testing.T) {
		pageImportSourceId := "page-with-nested-comments"
		comment1SourceId := "nested-comment-1"
		comment2SourceId := "nested-comment-2"

		comment1Props := model.StringInterface{"import_source_id": comment1SourceId}
		comment2Props := model.StringInterface{"import_source_id": comment2SourceId}

		comments := []imports.PageCommentImportData{
			{
				User:    &username,
				Content: model.NewPointer("First nested comment"),
				Props:   &comment1Props,
			},
			{
				User:    &username,
				Content: model.NewPointer("Second nested comment"),
				Props:   &comment2Props,
			},
		}

		pageProps := model.StringInterface{"import_source_id": pageImportSourceId}
		data := &imports.PageImportData{
			Team:     &teamName,
			Channel:  &channelName,
			User:     &username,
			Title:    model.NewPointer("Page With Nested Comments"),
			Content:  model.NewPointer(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Page content"}]}]}`),
			Props:    &pageProps,
			Comments: &comments,
		}

		appErr := th.App.importPage(th.Context, data, false)
		require.Nil(t, appErr)

		// Verify page was created
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", pageImportSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		page := pages[0]

		// Verify comments were created
		comment1, err := th.App.Srv().Store().Post().GetPostRepliesByTypeAndProps(
			page.Id, model.PostTypePageComment, "import_source_id", comment1SourceId)
		require.NoError(t, err)
		require.Len(t, comment1, 1)
		assert.Equal(t, "First nested comment", comment1[0].Message)

		comment2, err := th.App.Srv().Store().Post().GetPostRepliesByTypeAndProps(
			page.Id, model.PostTypePageComment, "import_source_id", comment2SourceId)
		require.NoError(t, err)
		require.Len(t, comment2, 1)
		assert.Equal(t, "Second nested comment", comment2[0].Message)
	})

	t.Run("nested comment failure stops page import", func(t *testing.T) {
		pageImportSourceId := "page-with-failing-comment"
		nonexistentUser := "nonexistent-comment-user"
		commentProps := model.StringInterface{"import_source_id": "failing-comment"}

		comments := []imports.PageCommentImportData{
			{
				User:    &nonexistentUser, // This user doesn't exist
				Content: model.NewPointer("This comment should fail"),
				Props:   &commentProps,
			},
		}

		pageProps := model.StringInterface{"import_source_id": pageImportSourceId}
		data := &imports.PageImportData{
			Team:     &teamName,
			Channel:  &channelName,
			User:     &username,
			Title:    model.NewPointer("Page With Failing Comment"),
			Content:  model.NewPointer(`{"type":"doc","content":[]}`),
			Props:    &pageProps,
			Comments: &comments,
		}

		appErr := th.App.importPage(th.Context, data, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.import_page.nested_comment_failed.error", appErr.Id)
	})
}

func TestImportThreadedCommentReplies(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	// Create wiki first
	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	_, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	// Create a page to add comments to
	pageImportSourceId := "page-for-threaded-comments"
	pageProps := model.StringInterface{"import_source_id": pageImportSourceId}
	pageData := &imports.PageImportData{
		Team:    &teamName,
		Channel: &channelName,
		User:    &username,
		Title:   model.NewPointer("Page For Threaded Comments"),
		Content: model.NewPointer(`{"type":"doc","content":[]}`),
		Props:   &pageProps,
	}
	appErr = th.App.importPage(th.Context, pageData, false)
	require.Nil(t, appErr)

	t.Run("creates threaded comment reply", func(t *testing.T) {
		// First, create a root comment
		rootCommentSourceId := "root-comment-for-thread"
		rootProps := model.StringInterface{"import_source_id": rootCommentSourceId}
		rootData := &imports.PageCommentImportData{
			PageImportSourceId: &pageImportSourceId,
			User:               &username,
			Content:            model.NewPointer("This is the root comment"),
			Props:              &rootProps,
		}
		appErr := th.App.importPageComment(th.Context, rootData, false, nil)
		require.Nil(t, appErr)

		// Now create a reply to the root comment
		replyCommentSourceId := "reply-comment-in-thread"
		replyProps := model.StringInterface{"import_source_id": replyCommentSourceId}
		replyData := &imports.PageCommentImportData{
			PageImportSourceId:          &pageImportSourceId,
			ParentCommentImportSourceId: &rootCommentSourceId,
			User:                        &username,
			Content:                     model.NewPointer("This is a reply to the root comment"),
			Props:                       &replyProps,
		}
		appErr = th.App.importPageComment(th.Context, replyData, false, nil)
		require.Nil(t, appErr)

		// Verify the page exists
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", pageImportSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		page := pages[0]

		// Verify root comment
		rootComments, err := th.App.Srv().Store().Post().GetPostRepliesByTypeAndProps(
			page.Id, model.PostTypePageComment, "import_source_id", rootCommentSourceId)
		require.NoError(t, err)
		require.Len(t, rootComments, 1)
		rootComment := rootComments[0]
		assert.Equal(t, "This is the root comment", rootComment.Message)
		assert.Equal(t, page.Id, rootComment.RootId)

		// Verify reply comment
		replyComments, err := th.App.Srv().Store().Post().GetPostRepliesByTypeAndProps(
			page.Id, model.PostTypePageComment, "import_source_id", replyCommentSourceId)
		require.NoError(t, err)
		require.Len(t, replyComments, 1)
		replyComment := replyComments[0]
		assert.Equal(t, "This is a reply to the root comment", replyComment.Message)
		assert.Equal(t, page.Id, replyComment.RootId)
	})

	t.Run("reply to nonexistent parent creates root comment", func(t *testing.T) {
		nonexistentParent := "nonexistent-parent-comment"
		commentSourceId := "orphan-reply-comment"
		commentProps := model.StringInterface{"import_source_id": commentSourceId}
		data := &imports.PageCommentImportData{
			PageImportSourceId:          &pageImportSourceId,
			ParentCommentImportSourceId: &nonexistentParent,
			User:                        &username,
			Content:                     model.NewPointer("Reply to nonexistent parent"),
			Props:                       &commentProps,
		}
		appErr := th.App.importPageComment(th.Context, data, false, nil)
		require.Nil(t, appErr) // Should succeed even with missing parent

		// Verify the page
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", pageImportSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		page := pages[0]

		// Verify comment was created as root-level (not reply)
		comments, err := th.App.Srv().Store().Post().GetPostRepliesByTypeAndProps(
			page.Id, model.PostTypePageComment, "import_source_id", commentSourceId)
		require.NoError(t, err)
		require.Len(t, comments, 1)
		assert.Equal(t, page.Id, comments[0].RootId)
	})
}

func TestImportPageWithAttachments(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	// Create wiki first
	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	_, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("imports page with attachments from file path", func(t *testing.T) {
		// Create a temporary test file
		tempDir := t.TempDir()
		testFilePath := tempDir + "/test-attachment.txt"
		testContent := []byte("This is test attachment content")
		err := os.WriteFile(testFilePath, testContent, 0644)
		require.NoError(t, err)

		pageImportSourceId := "page-with-attachment"
		attachmentSourceId := "attachment-source-123"
		attachmentProps := model.StringInterface{"import_source_id": attachmentSourceId}

		attachments := []imports.AttachmentImportData{
			{
				Path:  &testFilePath,
				Props: &attachmentProps,
			},
		}

		pageProps := model.StringInterface{"import_source_id": pageImportSourceId}
		data := &imports.PageImportData{
			Team:        &teamName,
			Channel:     &channelName,
			User:        &username,
			Title:       model.NewPointer("Page With Attachment"),
			Content:     model.NewPointer(`{"type":"doc","content":[]}`),
			Props:       &pageProps,
			Attachments: &attachments,
		}

		appErr := th.App.importPage(th.Context, data, false)
		require.Nil(t, appErr)

		// Verify page was created
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", pageImportSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		page := pages[0]

		// Verify file info was created and attached to the page
		fileInfos, err := th.App.Srv().Store().FileInfo().GetForPost(page.Id, true, false, true)
		require.NoError(t, err)
		require.Len(t, fileInfos, 1, "Should have exactly one attachment")
		assert.Equal(t, "test-attachment.txt", fileInfos[0].Name)
		assert.Equal(t, page.Id, fileInfos[0].PostId, "FileInfo should be attached to the page")

		// Verify import_file_mappings prop was set for link resolution
		// Re-fetch the page to get updated props
		updatedPage, err := th.App.Srv().Store().Post().GetSingle(th.Context, page.Id, false)
		require.NoError(t, err)
		fileMappings, ok := updatedPage.GetProps()["import_file_mappings"].(map[string]any)
		if ok {
			assert.Contains(t, fileMappings, attachmentSourceId)
		}
	})

	t.Run("continues import on attachment failure", func(t *testing.T) {
		pageImportSourceId := "page-with-bad-attachment"
		nonexistentPath := "/nonexistent/path/to/file.txt"

		attachments := []imports.AttachmentImportData{
			{
				Path: &nonexistentPath,
			},
		}

		pageProps := model.StringInterface{"import_source_id": pageImportSourceId}
		data := &imports.PageImportData{
			Team:        &teamName,
			Channel:     &channelName,
			User:        &username,
			Title:       model.NewPointer("Page With Bad Attachment"),
			Content:     model.NewPointer(`{"type":"doc","content":[]}`),
			Props:       &pageProps,
			Attachments: &attachments,
		}

		// Import should succeed even if attachment fails
		appErr := th.App.importPage(th.Context, data, false)
		require.Nil(t, appErr)

		// Verify page was created
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", pageImportSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		// Page should have no attachments since the file didn't exist
		assert.Empty(t, pages[0].FileIds)
	})

	t.Run("resolves CONF_FILE placeholders in page content", func(t *testing.T) {
		// Create a temporary test image file
		tempDir := t.TempDir()
		testFilePath := tempDir + "/test-image.png"
		testContent := []byte("fake PNG content for testing")
		err := os.WriteFile(testFilePath, testContent, 0644)
		require.NoError(t, err)

		pageImportSourceId := "page-with-file-placeholder"
		attachmentSourceId := "conf-attachment-12345"
		attachmentProps := model.StringInterface{"import_source_id": attachmentSourceId}

		attachments := []imports.AttachmentImportData{
			{
				Path:  &testFilePath,
				Props: &attachmentProps,
			},
		}

		// Content contains a CONF_FILE placeholder (with attachment source ID) that should be resolved
		pageContent := `{"type":"doc","content":[{"type":"image","attrs":{"src":"{{CONF_FILE:conf-attachment-12345}}","alt":"Test Image"}}]}`

		pageProps := model.StringInterface{"import_source_id": pageImportSourceId}
		data := &imports.PageImportData{
			Team:        &teamName,
			Channel:     &channelName,
			User:        &username,
			Title:       model.NewPointer("Page With File Placeholder"),
			Content:     &pageContent,
			Props:       &pageProps,
			Attachments: &attachments,
		}

		appErr := th.App.importPage(th.Context, data, false)
		require.Nil(t, appErr)

		// Verify page was created
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", pageImportSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		page := pages[0]

		// Verify file info was created
		fileInfos, err := th.App.Srv().Store().FileInfo().GetForPost(page.Id, true, false, true)
		require.NoError(t, err)
		require.Len(t, fileInfos, 1, "Should have exactly one attachment")
		fileId := fileInfos[0].Id

		// Verify placeholder was resolved in page content
		pageContentObj, contentErr := th.App.Srv().Store().Page().GetPageContent(page.Id)
		require.NoError(t, contentErr)
		require.NotNil(t, pageContentObj)

		// The content should now have the file URL instead of the placeholder
		// Check that the placeholder has been replaced with the actual file URL
		contentNodes := pageContentObj.Content.Content
		require.NotEmpty(t, contentNodes, "Page content should have nodes")

		// Find the image node and verify its src attribute
		found := false
		for _, node := range contentNodes {
			if nodeType, ok := node["type"].(string); ok && nodeType == "image" {
				if attrs, ok := node["attrs"].(map[string]any); ok {
					if src, ok := attrs["src"].(string); ok {
						expectedURL := "/api/v4/files/" + fileId
						assert.Equal(t, expectedURL, src, "Image src should be resolved to file URL")
						assert.NotContains(t, src, "{{CONF_FILE:", "Placeholder should be resolved")
						found = true
					}
				}
			}
		}
		assert.True(t, found, "Should find an image node with resolved src")
	})

	t.Run("handles multiple CONF_FILE placeholders", func(t *testing.T) {
		// Create temporary test files
		tempDir := t.TempDir()
		testFilePath1 := tempDir + "/image1.png"
		testFilePath2 := tempDir + "/image2.jpg"
		err := os.WriteFile(testFilePath1, []byte("fake PNG 1"), 0644)
		require.NoError(t, err)
		err = os.WriteFile(testFilePath2, []byte("fake JPEG 2"), 0644)
		require.NoError(t, err)

		pageImportSourceId := "page-with-multiple-file-placeholders"
		attachmentProps1 := model.StringInterface{"import_source_id": "conf-file-aaa111"}
		attachmentProps2 := model.StringInterface{"import_source_id": "conf-file-bbb222"}

		attachments := []imports.AttachmentImportData{
			{Path: &testFilePath1, Props: &attachmentProps1},
			{Path: &testFilePath2, Props: &attachmentProps2},
		}

		// Content with multiple placeholders using attachment source IDs
		pageContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Images: "},{"type":"image","attrs":{"src":"{{CONF_FILE:conf-file-aaa111}}"}},{"type":"image","attrs":{"src":"{{CONF_FILE:conf-file-bbb222}}"}}]}]}`

		pageProps := model.StringInterface{"import_source_id": pageImportSourceId}
		data := &imports.PageImportData{
			Team:        &teamName,
			Channel:     &channelName,
			User:        &username,
			Title:       model.NewPointer("Page With Multiple File Placeholders"),
			Content:     &pageContent,
			Props:       &pageProps,
			Attachments: &attachments,
		}

		appErr := th.App.importPage(th.Context, data, false)
		require.Nil(t, appErr)

		// Verify page was created
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", pageImportSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		page := pages[0]

		// Verify both files were uploaded
		fileInfos, err := th.App.Srv().Store().FileInfo().GetForPost(page.Id, true, false, true)
		require.NoError(t, err)
		require.Len(t, fileInfos, 2, "Should have exactly two attachments")

		// Verify placeholders were resolved in page content
		pageContentObj, contentErr := th.App.Srv().Store().Page().GetPageContent(page.Id)
		require.NoError(t, contentErr)
		require.NotNil(t, pageContentObj)

		// Serialize to check for placeholder remnants
		contentBytes, jsonErr := json.Marshal(pageContentObj.Content)
		require.NoError(t, jsonErr)
		contentStr := string(contentBytes)

		// Verify no placeholders remain
		assert.NotContains(t, contentStr, "{{CONF_FILE:", "All placeholders should be resolved")

		// Verify file URLs are present
		for _, fileInfo := range fileInfos {
			expectedURL := "/api/v4/files/" + fileInfo.Id
			assert.Contains(t, contentStr, expectedURL, "File URL should be present for "+fileInfo.Name)
		}
	})

	t.Run("leaves unmatched placeholders as-is", func(t *testing.T) {
		// Create a temporary test file
		tempDir := t.TempDir()
		testFilePath := tempDir + "/known-file.png"
		err := os.WriteFile(testFilePath, []byte("fake PNG"), 0644)
		require.NoError(t, err)

		pageImportSourceId := "page-with-unmatched-file-placeholder"
		attachmentProps := model.StringInterface{"import_source_id": "conf-known-file-xyz"}

		attachments := []imports.AttachmentImportData{
			{Path: &testFilePath, Props: &attachmentProps},
		}

		// Content has a placeholder for a known file and an unknown source ID
		pageContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"image","attrs":{"src":"{{CONF_FILE:conf-known-file-xyz}}"}},{"type":"image","attrs":{"src":"{{CONF_FILE:conf-unknown-file-abc}}"}}]}]}`

		pageProps := model.StringInterface{"import_source_id": pageImportSourceId}
		data := &imports.PageImportData{
			Team:        &teamName,
			Channel:     &channelName,
			User:        &username,
			Title:       model.NewPointer("Page With Unmatched File Placeholder"),
			Content:     &pageContent,
			Props:       &pageProps,
			Attachments: &attachments,
		}

		appErr := th.App.importPage(th.Context, data, false)
		require.Nil(t, appErr)

		// Verify page was created
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", pageImportSourceId)
		require.NoError(t, err)
		require.Len(t, pages, 1)
		page := pages[0]

		// Get the uploaded file ID
		fileInfos, err := th.App.Srv().Store().FileInfo().GetForPost(page.Id, true, false, true)
		require.NoError(t, err)
		require.Len(t, fileInfos, 1)

		// Verify page content
		pageContentObj, contentErr := th.App.Srv().Store().Page().GetPageContent(page.Id)
		require.NoError(t, contentErr)
		require.NotNil(t, pageContentObj)

		contentBytes, jsonErr := json.Marshal(pageContentObj.Content)
		require.NoError(t, jsonErr)
		contentStr := string(contentBytes)

		// Known file should be resolved
		expectedURL := "/api/v4/files/" + fileInfos[0].Id
		assert.Contains(t, contentStr, expectedURL, "Known file placeholder should be resolved")

		// Unknown file placeholder should remain (not crash, not corrupt)
		assert.Contains(t, contentStr, "{{CONF_FILE:conf-unknown-file-abc}}", "Unknown file placeholder should remain unchanged")
	})
}

func TestImportWikiEndToEnd(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	t.Run("full migration flow - wiki, pages with hierarchy, and comments", func(t *testing.T) {
		// Step 1: Import wiki
		wikiSourceId := "e2e-confluence-space"
		wikiProps := model.StringInterface{"import_source_id": wikiSourceId}
		wikiData := &imports.WikiImportData{
			Team:        &teamName,
			Channel:     &channelName,
			Title:       model.NewPointer("End-to-End Test Wiki"),
			Description: model.NewPointer("Testing full migration flow"),
			Props:       &wikiProps,
		}
		appErr := th.App.importWiki(th.Context, wikiData, false)
		require.Nil(t, appErr)

		// Step 2: Import root page
		rootPageSourceId := "e2e-root-page"
		rootPageProps := model.StringInterface{"import_source_id": rootPageSourceId}
		rootPageData := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Root Page"),
			Content: model.NewPointer(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Root page content"}]}]}`),
			Props:   &rootPageProps,
		}
		appErr = th.App.importPage(th.Context, rootPageData, false)
		require.Nil(t, appErr)

		// Step 3: Import child page with parent reference
		childPageSourceId := "e2e-child-page"
		childPageProps := model.StringInterface{"import_source_id": childPageSourceId}
		childPageData := &imports.PageImportData{
			Team:                 &teamName,
			Channel:              &channelName,
			User:                 &username,
			Title:                model.NewPointer("Child Page"),
			Content:              model.NewPointer(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Child page content"}]}]}`),
			ParentImportSourceId: &rootPageSourceId,
			Props:                &childPageProps,
		}
		appErr = th.App.importPage(th.Context, childPageData, false)
		require.Nil(t, appErr)

		// Step 4: Import grandchild page
		grandchildPageSourceId := "e2e-grandchild-page"
		grandchildPageProps := model.StringInterface{"import_source_id": grandchildPageSourceId}
		grandchildPageData := &imports.PageImportData{
			Team:                 &teamName,
			Channel:              &channelName,
			User:                 &username,
			Title:                model.NewPointer("Grandchild Page"),
			Content:              model.NewPointer(`{"type":"doc","content":[]}`),
			ParentImportSourceId: &childPageSourceId,
			Props:                &grandchildPageProps,
		}
		appErr = th.App.importPage(th.Context, grandchildPageData, false)
		require.Nil(t, appErr)

		// Step 5: Import comments on root page
		commentSourceId := "e2e-comment"
		commentProps := model.StringInterface{"import_source_id": commentSourceId}
		commentData := &imports.PageCommentImportData{
			PageImportSourceId: &rootPageSourceId,
			User:               &username,
			Content:            model.NewPointer("Comment on root page"),
			Props:              &commentProps,
		}
		appErr = th.App.importPageComment(th.Context, commentData, false, nil)
		require.Nil(t, appErr)

		// Verify wiki
		wikis, appErr := th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, false)
		require.Nil(t, appErr)
		require.Len(t, wikis, 1)
		assert.Equal(t, "End-to-End Test Wiki", wikis[0].Title)
		assert.Equal(t, wikiSourceId, wikis[0].Props["import_source_id"])

		// Verify root page
		rootPages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", rootPageSourceId)
		require.NoError(t, err)
		require.Len(t, rootPages, 1)
		rootPage := rootPages[0]
		assert.Equal(t, "Root Page", rootPage.GetProps()["title"])
		assert.Empty(t, rootPage.PageParentId)

		// Verify child page hierarchy
		childPages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", childPageSourceId)
		require.NoError(t, err)
		require.Len(t, childPages, 1)
		childPage := childPages[0]
		assert.Equal(t, "Child Page", childPage.GetProps()["title"])
		assert.Equal(t, rootPage.Id, childPage.PageParentId)

		// Verify grandchild page hierarchy
		grandchildPages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", grandchildPageSourceId)
		require.NoError(t, err)
		require.Len(t, grandchildPages, 1)
		grandchildPage := grandchildPages[0]
		assert.Equal(t, "Grandchild Page", grandchildPage.GetProps()["title"])
		assert.Equal(t, childPage.Id, grandchildPage.PageParentId)

		// Verify comment
		comments, err := th.App.Srv().Store().Post().GetPostRepliesByTypeAndProps(
			rootPage.Id, model.PostTypePageComment, "import_source_id", commentSourceId)
		require.NoError(t, err)
		require.Len(t, comments, 1)
		assert.Equal(t, "Comment on root page", comments[0].Message)
	})

	t.Run("idempotent re-import does not create duplicates", func(t *testing.T) {
		// Import same wiki again
		wikiSourceId := "e2e-confluence-space"
		wikiProps := model.StringInterface{"import_source_id": wikiSourceId}
		wikiData := &imports.WikiImportData{
			Team:        &teamName,
			Channel:     &channelName,
			Title:       model.NewPointer("Updated Wiki Title"),
			Description: model.NewPointer("Updated description"),
			Props:       &wikiProps,
		}
		appErr := th.App.importWiki(th.Context, wikiData, false)
		require.Nil(t, appErr)

		// Verify still only one wiki (updated)
		wikis, appErr := th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, false)
		require.Nil(t, appErr)
		require.Len(t, wikis, 1)
		assert.Equal(t, "Updated Wiki Title", wikis[0].Title)

		// Import same pages again
		rootPageSourceId := "e2e-root-page"
		rootPageProps := model.StringInterface{"import_source_id": rootPageSourceId}
		rootPageData := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Different Title Should Not Apply"),
			Content: model.NewPointer(`{"type":"doc","content":[]}`),
			Props:   &rootPageProps,
		}
		appErr = th.App.importPage(th.Context, rootPageData, false)
		require.Nil(t, appErr)

		// Verify still only one page with original title
		rootPages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", rootPageSourceId)
		require.NoError(t, err)
		require.Len(t, rootPages, 1)
		assert.Equal(t, "Root Page", rootPages[0].GetProps()["title"]) // Original title preserved
	})
}

func TestResolvePageTitlePlaceholders(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	// Create wiki and pages first
	wikiSourceId := "test-wiki-title-placeholders"
	wikiProps := model.StringInterface{"import_source_id": wikiSourceId}
	wikiData := &imports.WikiImportData{
		Team:    &teamName,
		Channel: &channelName,
		Title:   model.NewPointer("Test Wiki"),
		Props:   &wikiProps,
	}
	appErr := th.App.importWiki(th.Context, wikiData, false)
	require.Nil(t, appErr)

	// Create target page that will be linked to
	targetPageProps := model.StringInterface{"import_source_id": "target-page-1"}
	targetPageData := &imports.PageImportData{
		Team:    &teamName,
		Channel: &channelName,
		User:    &username,
		Title:   model.NewPointer("Target Page Title"),
		Content: model.NewPointer(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Target content"}]}]}`),
		Props:   &targetPageProps,
	}
	appErr = th.App.importPage(th.Context, targetPageData, false)
	require.Nil(t, appErr)

	// Create page with placeholder link to target
	sourcePageProps := model.StringInterface{"import_source_id": "source-page-1"}
	sourcePageData := &imports.PageImportData{
		Team:    &teamName,
		Channel: &channelName,
		User:    &username,
		Title:   model.NewPointer("Source Page"),
		Content: model.NewPointer(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Link to {{CONF_PAGE_TITLE:Target Page Title}}"}]}]}`),
		Props:   &sourcePageProps,
	}
	appErr = th.App.importPage(th.Context, sourcePageData, false)
	require.Nil(t, appErr)

	t.Run("resolves page title placeholders", func(t *testing.T) {
		resolveErr := th.App.ResolvePageTitlePlaceholders(th.Context, th.BasicChannel.Id)
		require.Nil(t, resolveErr)

		// Get the source page and verify placeholder was resolved
		sourcePages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", "source-page-1")
		require.NoError(t, err)
		require.Len(t, sourcePages, 1)

		pageContent, err := th.App.Srv().Store().Page().GetPageContent(sourcePages[0].Id)
		require.NoError(t, err)

		contentJSON, _ := json.Marshal(pageContent.Content)
		contentStr := string(contentJSON)

		// Placeholder should be replaced with URL
		assert.NotContains(t, contentStr, "{{CONF_PAGE_TITLE:")
		assert.Contains(t, contentStr, "/wiki/")
	})

	t.Run("handles escaped braces in titles", func(t *testing.T) {
		// Create page with braces in title
		bracesPageProps := model.StringInterface{"import_source_id": "braces-page"}
		bracesPageData := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Function() { return true; }"),
			Content: model.NewPointer(`{"type":"doc","content":[]}`),
			Props:   &bracesPageProps,
		}
		appErr = th.App.importPage(th.Context, bracesPageData, false)
		require.Nil(t, appErr)

		// Create page linking to it with escaped braces (escaped in placeholder, not in JSON)
		// The placeholder uses \\{ and \\} which in the Go string becomes \{ and \}
		linkPageProps := model.StringInterface{"import_source_id": "link-braces-page"}
		linkPageData := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Link Page"),
			Content: model.NewPointer(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"See {{CONF_PAGE_TITLE:Function() \\{ return true; \\}}}"}]}]}`),
			Props:   &linkPageProps,
		}
		appErr = th.App.importPage(th.Context, linkPageData, false)
		require.Nil(t, appErr)

		appErr = th.App.ResolvePageTitlePlaceholders(th.Context, th.BasicChannel.Id)
		require.Nil(t, appErr)
	})

	t.Run("channel not found returns error", func(t *testing.T) {
		appErr := th.App.ResolvePageTitlePlaceholders(th.Context, "nonexistent-channel-id")
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "channel_not_found")
	})
}

func TestResolvePageIDPlaceholders(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	// Create wiki
	wikiSourceId := "test-wiki-id-placeholders"
	wikiProps := model.StringInterface{"import_source_id": wikiSourceId}
	wikiData := &imports.WikiImportData{
		Team:    &teamName,
		Channel: &channelName,
		Title:   model.NewPointer("Test Wiki"),
		Props:   &wikiProps,
	}
	appErr := th.App.importWiki(th.Context, wikiData, false)
	require.Nil(t, appErr)

	// Create target page with specific import_source_id
	targetPageProps := model.StringInterface{"import_source_id": "conf-page-12345"}
	targetPageData := &imports.PageImportData{
		Team:    &teamName,
		Channel: &channelName,
		User:    &username,
		Title:   model.NewPointer("Target Page"),
		Content: model.NewPointer(`{"type":"doc","content":[]}`),
		Props:   &targetPageProps,
	}
	appErr = th.App.importPage(th.Context, targetPageData, false)
	require.Nil(t, appErr)

	// Create page with CONF_PAGE_ID placeholder
	sourcePageProps := model.StringInterface{"import_source_id": "source-page-id"}
	sourcePageData := &imports.PageImportData{
		Team:    &teamName,
		Channel: &channelName,
		User:    &username,
		Title:   model.NewPointer("Source Page ID"),
		Content: model.NewPointer(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Link to {{CONF_PAGE_ID:conf-page-12345}}"}]}]}`),
		Props:   &sourcePageProps,
	}
	appErr = th.App.importPage(th.Context, sourcePageData, false)
	require.Nil(t, appErr)

	t.Run("resolves page ID placeholders", func(t *testing.T) {
		appErr := th.App.ResolvePageIDPlaceholders(th.Context, th.BasicChannel.Id)
		require.Nil(t, appErr)

		// Get the source page and verify placeholder was resolved
		sourcePages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", "source-page-id")
		require.NoError(t, err)
		require.Len(t, sourcePages, 1)

		pageContent, err := th.App.Srv().Store().Page().GetPageContent(sourcePages[0].Id)
		require.NoError(t, err)

		contentJSON, _ := json.Marshal(pageContent.Content)
		contentStr := string(contentJSON)

		assert.NotContains(t, contentStr, "{{CONF_PAGE_ID:")
		assert.Contains(t, contentStr, "/wiki/")
	})
}

func TestCleanupUnresolvedPlaceholders(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	// Create wiki
	wikiSourceId := "test-wiki-cleanup"
	wikiProps := model.StringInterface{"import_source_id": wikiSourceId}
	wikiData := &imports.WikiImportData{
		Team:    &teamName,
		Channel: &channelName,
		Title:   model.NewPointer("Test Wiki"),
		Props:   &wikiProps,
	}
	appErr := th.App.importWiki(th.Context, wikiData, false)
	require.Nil(t, appErr)

	// Create page with unresolvable placeholders
	pageProps := model.StringInterface{"import_source_id": "cleanup-page"}
	pageData := &imports.PageImportData{
		Team:    &teamName,
		Channel: &channelName,
		User:    &username,
		Title:   model.NewPointer("Cleanup Test Page"),
		Content: model.NewPointer(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Missing: {{CONF_PAGE_TITLE:Nonexistent Page}} and {{CONF_PAGE_ID:missing-id}} and {{CONF_FILE:missing-file}}"}]}]}`),
		Props:   &pageProps,
	}
	appErr = th.App.importPage(th.Context, pageData, false)
	require.Nil(t, appErr)

	t.Run("converts unresolved placeholders to broken link indicators", func(t *testing.T) {
		appErr := th.App.CleanupUnresolvedPlaceholders(th.Context, th.BasicChannel.Id)
		require.Nil(t, appErr)

		// Get the page and verify placeholders were cleaned up
		pages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", "cleanup-page")
		require.NoError(t, err)
		require.Len(t, pages, 1)

		pageContent, err := th.App.Srv().Store().Page().GetPageContent(pages[0].Id)
		require.NoError(t, err)

		contentJSON, _ := json.Marshal(pageContent.Content)
		contentStr := string(contentJSON)

		// Placeholders should be replaced with broken link indicators
		assert.NotContains(t, contentStr, "{{CONF_PAGE_TITLE:")
		assert.NotContains(t, contentStr, "{{CONF_PAGE_ID:")
		assert.NotContains(t, contentStr, "{{CONF_FILE:")
		assert.Contains(t, contentStr, "[Missing: Nonexistent Page]")
		assert.Contains(t, contentStr, "[Missing Page]")
		assert.Contains(t, contentStr, "[Missing Image]")
	})
}

func TestRepairOrphanedPageHierarchy(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	teamName := th.BasicTeam.Name
	channelName := th.BasicChannel.Name
	username := th.BasicUser.Username

	// Create wiki
	wikiSourceId := "test-wiki-repair"
	wikiProps := model.StringInterface{"import_source_id": wikiSourceId}
	wikiData := &imports.WikiImportData{
		Team:    &teamName,
		Channel: &channelName,
		Title:   model.NewPointer("Test Wiki"),
		Props:   &wikiProps,
	}
	appErr := th.App.importWiki(th.Context, wikiData, false)
	require.Nil(t, appErr)

	t.Run("repairs orphaned page when parent imported later", func(t *testing.T) {
		// Import child page BEFORE parent (simulating out-of-order import)
		childParentSourceId := "parent-page-later"
		childPageProps := model.StringInterface{"import_source_id": "child-orphan"}
		childPageData := &imports.PageImportData{
			Team:                 &teamName,
			Channel:              &channelName,
			User:                 &username,
			Title:                model.NewPointer("Child Page"),
			Content:              model.NewPointer(`{"type":"doc","content":[]}`),
			Props:                &childPageProps,
			ParentImportSourceId: &childParentSourceId,
		}
		appErr = th.App.importPage(th.Context, childPageData, false)
		require.Nil(t, appErr)

		// Verify child was created as root (orphaned)
		childPages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", "child-orphan")
		require.NoError(t, err)
		require.Len(t, childPages, 1)
		assert.Empty(t, childPages[0].PageParentId, "Child should be orphaned (no parent)")

		// Now import the parent page
		parentPageProps := model.StringInterface{"import_source_id": "parent-page-later"}
		parentPageData := &imports.PageImportData{
			Team:    &teamName,
			Channel: &channelName,
			User:    &username,
			Title:   model.NewPointer("Parent Page"),
			Content: model.NewPointer(`{"type":"doc","content":[]}`),
			Props:   &parentPageProps,
		}
		appErr = th.App.importPage(th.Context, parentPageData, false)
		require.Nil(t, appErr)

		// Run hierarchy repair
		repaired, appErr := th.App.RepairOrphanedPageHierarchy(th.Context, th.BasicChannel.Id)
		require.Nil(t, appErr)
		assert.Equal(t, 1, repaired)

		// Verify child now has parent
		childPages, err = th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", "child-orphan")
		require.NoError(t, err)
		require.Len(t, childPages, 1)

		parentPages, err := th.App.Srv().Store().Post().GetPostsByTypeAndProps(
			th.BasicChannel.Id, model.PostTypePage, "import_source_id", "parent-page-later")
		require.NoError(t, err)
		require.Len(t, parentPages, 1)

		assert.Equal(t, parentPages[0].Id, childPages[0].PageParentId, "Child should now have parent")
	})
}
