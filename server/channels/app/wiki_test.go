// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetWikisForChannel_SoftDelete(t *testing.T) {
	th := Setup(t).InitBasic(t)

	wiki1 := &model.Wiki{
		TeamId:      th.BasicTeam.Id,
		Title:       "Test Wiki 1",
		Description: "Test description 1",
	}

	wiki2 := &model.Wiki{
		TeamId:      th.BasicTeam.Id,
		Title:       "Test Wiki 2",
		Description: "Test description 2",
	}

	createdWiki1, err := th.App.CreateWiki(th.Context, wiki1, th.BasicUser.Id)
	require.Nil(t, err)
	require.NotNil(t, createdWiki1)

	createdWiki2, err := th.App.CreateWiki(th.Context, wiki2, th.BasicUser.Id)
	require.Nil(t, err)
	require.NotNil(t, createdWiki2)

	_, err = th.App.LinkWikiToChannel(th.Context, createdWiki1.Id, th.BasicChannel.Id, th.BasicUser.Id)
	require.Nil(t, err)
	_, err = th.App.LinkWikiToChannel(th.Context, createdWiki2.Id, th.BasicChannel.Id, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("deleting a wiki removes it from channel wikis", func(t *testing.T) {
		wikis, err := th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, false)
		require.Nil(t, err)
		require.Len(t, wikis, 2)

		err = th.App.DeleteWiki(th.Context, createdWiki1.Id, th.BasicUser.Id, nil)
		require.Nil(t, err)

		wikis, err = th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, false)
		require.Nil(t, err)
		require.Len(t, wikis, 1)
		require.Equal(t, createdWiki2.Id, wikis[0].Id)
	})

	t.Run("deleted wiki is no longer accessible via channel even with includeDeleted", func(t *testing.T) {
		wikis, err := th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, true)
		require.Nil(t, err)
		require.Len(t, wikis, 1, "DeleteWiki removes links and backing channel, so deleted wiki is not accessible via channel")
		require.Equal(t, createdWiki2.Id, wikis[0].Id)
	})
}

func TestUpdateWiki(t *testing.T) {
	th := Setup(t).InitBasic(t)

	wiki := &model.Wiki{
		Title:       "Test Wiki",
		Description: "Test description",
		Icon:        ":book:",
	}

	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)
	require.NotNil(t, createdWiki)
	require.Equal(t, "Test Wiki", createdWiki.Title)

	t.Run("successfully updates wiki fields", func(t *testing.T) {
		createdWiki.Title = "Updated Wiki"
		createdWiki.Description = "Updated description"
		createdWiki.Icon = ":star:"

		updatedWiki, err := th.App.UpdateWiki(th.Context, createdWiki)
		require.Nil(t, err)
		require.Equal(t, "Updated Wiki", updatedWiki.Title)
		require.Equal(t, "Updated description", updatedWiki.Description)
		require.Equal(t, ":star:", updatedWiki.Icon)
		require.GreaterOrEqual(t, updatedWiki.UpdateAt, createdWiki.CreateAt)
	})
}

func TestCreateWikiWithDefaultPage(t *testing.T) {
	th := Setup(t).InitBasic(t)

	wiki := &model.Wiki{
		Title:       "Test Wiki",
		Description: "Test Description",
	}

	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)
	require.NotNil(t, createdWiki)
	require.NotEmpty(t, createdWiki.Id)

	t.Run("wiki has no pages initially", func(t *testing.T) {
		pages, pageErr := th.App.GetWikiPages(th.Context, createdWiki.Id, 0, 10)
		require.Nil(t, pageErr)
		require.Len(t, pages, 0, "Wiki should have no pages initially, only a draft")
	})

	t.Run("default draft exists for the wiki", func(t *testing.T) {
		drafts, err := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdWiki.Id, 0, 200, nil, nil)
		require.Nil(t, err)
		require.Len(t, drafts, 1, "Wiki should have exactly one default draft")

		defaultDraft := drafts[0]
		draftContent, _ := defaultDraft.GetDocumentJSON()
		require.JSONEq(t, `{"type":"doc","content":[]}`, draftContent, "Default draft should be empty")
		require.Equal(t, "Untitled page", defaultDraft.Title, "Default draft should have 'Untitled page' title")
		require.Equal(t, createdWiki.Id, defaultDraft.WikiId, "Draft WikiId should store wiki ID")
	})
}

func TestCreatePage(t *testing.T) {
	t.Run("creates page with no parent", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{

			Title:       "Test Wiki",
			Description: "Test Description",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "New Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)
		require.Equal(t, model.PageTypePage, page.Type)
		require.Equal(t, createdWiki.ChannelId, page.ChannelId)
		require.Empty(t, page.ParentId)
		require.Equal(t, "New Page", page.Title)

		pages, pageErr := th.App.Srv().Store().Page().GetChannelPages(createdWiki.ChannelId, 0, 10)
		require.NoError(t, pageErr)
		require.Len(t, pages, 1, "Wiki should have 1 page (default is a draft, not a page)")
	})

	t.Run("creates child page with parent", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{

			Title:       "Test Wiki",
			Description: "Test Description",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		parentPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, parentPage)

		childPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, parentPage.Id, "Child Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, childPage)
		require.Equal(t, parentPage.Id, childPage.ParentId, "Child page should reference parent")
		require.Equal(t, "Child Page", childPage.Title)
	})

	t.Run("fails when parent is not a page", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{

			Title:       "Test Wiki",
			Description: "Test Description",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		regularPost, _, postErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, postErr)

		_, pageErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, regularPost.Id, "Invalid Child", "", th.BasicUser.Id, "", "")
		require.NotNil(t, pageErr, "Should fail when parent is not a page")
		require.Equal(t, "app.page.create.invalid_parent.app_error", pageErr.Id)
	})

	t.Run("fails when parent is in different channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{

			Title:       "Test Wiki",
			Description: "Test Description",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		otherChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "other-channel",
			DisplayName: "Other Channel",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, chanErr)

		_, memberErr := th.App.AddUserToChannel(th.Context, th.BasicUser, otherChannel, false)
		require.Nil(t, memberErr)

		otherWiki := &model.Wiki{

			Title: "Other Wiki",
		}
		createdOtherWiki, wikiErr := th.App.CreateWiki(th.Context, otherWiki, th.BasicUser.Id)
		require.Nil(t, wikiErr)

		otherParentPage, err := th.App.CreateWikiPage(th.Context, createdOtherWiki.Id, "", "Other Parent", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, otherParentPage)

		_, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, otherParentPage.Id, "Cross-Channel Child", "", th.BasicUser.Id, "", "")
		require.NotNil(t, appErr, "Should fail when parent is in different channel")
		require.Equal(t, "app.page.create.parent_different_channel.app_error", appErr.Id)
	})
}

func TestMovePageToWiki(t *testing.T) {
	t.Run("successfully moves page to target wiki in same channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		sourceWiki := &model.Wiki{

			Title:       "Source Wiki",
			Description: "Source",
		}

		targetWiki := &model.Wiki{

			Title:       "Target Wiki",
			Description: "Target",
		}

		createdSourceWiki, err := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdTargetWiki, err := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, createdPage)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)
		appErr = th.App.MovePageToWiki(th.Context, page, createdTargetWiki.Id, nil, "", nil, nil)
		require.Nil(t, appErr)

		wikiId, wikiErr := th.App.GetWikiIdForPage(th.Context, createdPage.Id)
		require.Nil(t, wikiErr)
		require.Equal(t, createdTargetWiki.Id, wikiId)

		movedPage, pageErr := th.App.GetPage(th.Context, page.Id)
		require.Nil(t, pageErr)
		require.Empty(t, movedPage.ParentId, "Moved page should become root")
	})

	t.Run("successfully moves page with children (entire subtree)", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		sourceWiki := &model.Wiki{

			Title: "Source Wiki",
		}

		targetWiki := &model.Wiki{

			Title: "Target Wiki",
		}

		createdSourceWiki, err := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdTargetWiki, err := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, err)

		parentPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Parent Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		childPage1, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, parentPage.Id, "Child Page 1", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		childPage2, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, parentPage.Id, "Child Page 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		grandchildPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, childPage1.Id, "Grandchild Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		parentPageWrapper, appErr := th.App.GetPage(th.Context, parentPage.Id)
		require.Nil(t, appErr)

		appErr = th.App.MovePageToWiki(th.Context, parentPageWrapper, createdTargetWiki.Id, nil, "", nil, nil)
		require.Nil(t, appErr)

		parentWikiId, err := th.App.GetWikiIdForPage(th.Context, parentPage.Id)
		require.Nil(t, err)
		require.Equal(t, createdTargetWiki.Id, parentWikiId)

		child1WikiId, err := th.App.GetWikiIdForPage(th.Context, childPage1.Id)
		require.Nil(t, err)
		require.Equal(t, createdTargetWiki.Id, child1WikiId)

		child2WikiId, err := th.App.GetWikiIdForPage(th.Context, childPage2.Id)
		require.Nil(t, err)
		require.Equal(t, createdTargetWiki.Id, child2WikiId)

		grandchildWikiId, err := th.App.GetWikiIdForPage(th.Context, grandchildPage.Id)
		require.Nil(t, err)
		require.Equal(t, createdTargetWiki.Id, grandchildWikiId)

		movedParent, pageErr := th.App.GetPage(th.Context, parentPage.Id)
		require.Nil(t, pageErr)
		require.Empty(t, movedParent.ParentId, "Moved parent page should become root")

		movedChild1, pageErr := th.App.GetPage(th.Context, childPage1.Id)
		require.Nil(t, pageErr)
		require.Equal(t, parentPage.Id, movedChild1.ParentId, "Child1 should still reference parent")

		movedChild2, pageErr := th.App.GetPage(th.Context, childPage2.Id)
		require.Nil(t, pageErr)
		require.Equal(t, parentPage.Id, movedChild2.ParentId, "Child2 should still reference parent")

		movedGrandchild, pageErr := th.App.GetPage(th.Context, grandchildPage.Id)
		require.Nil(t, pageErr)
		require.Equal(t, childPage1.Id, movedGrandchild.ParentId, "Grandchild should still reference child1")
	})

	t.Run("fails when page does not exist", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		// GetPage validates the page exists - error happens at entry point
		_, appErr := th.App.GetPage(th.Context, model.NewId())
		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "page")
	})

	t.Run("fails when target wiki does not exist", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		sourceWiki := &model.Wiki{

			Title: "Source Wiki",
		}

		createdSourceWiki, err := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		appErr = th.App.MovePageToWiki(th.Context, page, model.NewId(), nil, "", nil, nil)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.move.target_wiki_not_found", appErr.Id)
	})

	t.Run("fails when source and target wiki are the same (idempotent check)", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{

			Title: "Test Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		appErr = th.App.MovePageToWiki(th.Context, page, createdWiki.Id, nil, "", nil, nil)
		require.Nil(t, appErr, "Moving to same wiki should succeed (idempotent)")
	})

	t.Run("updates comment wiki_id when page is moved to different wiki", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		sourceWiki := &model.Wiki{

			Title: "Source Wiki",
		}

		targetWiki := &model.Wiki{

			Title: "Target Wiki",
		}

		createdSourceWiki, err := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdTargetWiki, err := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, err)

		page, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page with Comments", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		// Create session context for comment creation
		rctx := th.CreateSessionContext()

		// Create a top-level comment
		topLevelComment, appErr := th.App.CreatePageComment(rctx, page.Id, "Top-level comment", nil, "", nil, nil)
		require.Nil(t, appErr)
		require.Equal(t, createdSourceWiki.Id, topLevelComment.GetProp(model.PagePropsWikiID))

		// Create an inline comment
		inlineAnchor := map[string]any{
			"from": 10,
			"to":   20,
		}
		inlineComment, appErr := th.App.CreatePageComment(rctx, page.Id, "Inline comment", inlineAnchor, "", nil, nil)
		require.Nil(t, appErr)
		require.Equal(t, createdSourceWiki.Id, inlineComment.GetProp(model.PagePropsWikiID))

		// Move page to target wiki
		th.Context.Session().UserId = th.BasicUser.Id
		pageWrapper, appErr := th.App.GetPage(th.Context, page.Id)
		require.Nil(t, appErr)

		appErr = th.App.MovePageToWiki(th.Context, pageWrapper, createdTargetWiki.Id, nil, "", nil, nil)
		require.Nil(t, appErr)

		// Verify top-level comment wiki_id was updated
		updatedTopLevelComment, getErr := th.App.GetPageCommentPost(th.Context, topLevelComment.Id, false)
		require.Nil(t, getErr)
		require.Equal(t, createdTargetWiki.Id, updatedTopLevelComment.GetProp(model.PagePropsWikiID),
			"Top-level comment wiki_id should be updated to target wiki")

		// Verify inline comment wiki_id was updated
		updatedInlineComment, getErr := th.App.GetPageCommentPost(th.Context, inlineComment.Id, false)
		require.Nil(t, getErr)
		require.Equal(t, createdTargetWiki.Id, updatedInlineComment.GetProp(model.PagePropsWikiID),
			"Inline comment wiki_id should be updated to target wiki")
	})
}

func TestDuplicatePage(t *testing.T) {
	t.Run("successfully duplicates page to target wiki", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		sourceWiki := &model.Wiki{

			Title:       "Source Wiki",
			Description: "Source",
		}

		targetWiki := &model.Wiki{

			Title:       "Target Wiki",
			Description: "Target",
		}

		createdSourceWiki, err := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdTargetWiki, err := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, err)

		originalContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`
		createdPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Original Page", originalContent, th.BasicUser.Id, "search text", "")
		require.Nil(t, err)
		require.NotNil(t, createdPage)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdTargetWiki.Id, nil, nil, th.BasicUser.Id, nil, nil)
		require.Nil(t, appErr)
		require.NotNil(t, duplicatedPage)

		require.NotEqual(t, page.Id, duplicatedPage.Id, "Duplicated page should have new ID")
		require.Equal(t, "Copy of Original Page", duplicatedPage.Title, "Should have default duplicate title")
		require.Equal(t, createdTargetWiki.ChannelId, duplicatedPage.ChannelId, "Should be in target wiki's channel")
		require.Empty(t, duplicatedPage.ParentId, "Should be root level")

		duplicatedPagePost, contentErr := th.App.Srv().Store().Page().GetPage(th.Context, duplicatedPage.Id, false)
		require.NoError(t, contentErr)
		require.NotEmpty(t, duplicatedPagePost.Body, "Content should exist")
		require.Contains(t, duplicatedPagePost.Body, "Original content", "Content should contain original text")
		require.Contains(t, duplicatedPagePost.Body, "\"type\":\"doc\"", "Content should be TipTap document")

		targetWikiId, wikiErr := th.App.GetWikiIdForPage(th.Context, duplicatedPage.Id)
		require.Nil(t, wikiErr)
		require.Equal(t, createdTargetWiki.Id, targetWikiId, "Should be in target wiki")
	})

	t.Run("successfully duplicates page within same wiki", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{

			Title: "Test Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page to Duplicate", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdWiki.Id, nil, nil, th.BasicUser.Id, nil, nil)
		require.Nil(t, appErr)
		require.NotNil(t, duplicatedPage)

		require.NotEqual(t, page.Id, duplicatedPage.Id)
		require.Equal(t, "Copy of Page to Duplicate", duplicatedPage.Title)

		wikiId, wikiErr := th.App.GetWikiIdForPage(th.Context, duplicatedPage.Id)
		require.Nil(t, wikiErr)
		require.Equal(t, createdWiki.Id, wikiId, "Should remain in same wiki")
	})

	t.Run("successfully duplicates page with custom title", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{

			Title: "Test Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Original", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		customTitle := "My Custom Title"
		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdWiki.Id, nil, &customTitle, th.BasicUser.Id, nil, nil)
		require.Nil(t, appErr)
		require.Equal(t, customTitle, duplicatedPage.Title, "Should use custom title")
	})

	t.Run("successfully duplicates page with parent", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{

			Title: "Test Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		parentPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, parentPage.Id, "Page to Duplicate", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdWiki.Id, nil, nil, th.BasicUser.Id, nil, nil)
		require.Nil(t, appErr)
		require.Equal(t, parentPage.Id, duplicatedPage.ParentId, "Should preserve parent from source page")
	})

	t.Run("fails when source page not found", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		// GetPage validates the page exists - error happens at entry point
		_, appErr := th.App.GetPage(th.Context, "nonexistent")
		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "page")
	})

	t.Run("fails when target wiki not found", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{

			Title: "Source Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, "nonexistent", nil, nil, th.BasicUser.Id, nil, nil)
		require.NotNil(t, appErr)
		require.Nil(t, duplicatedPage)
		require.Contains(t, appErr.Id, "target_wiki_not_found")
	})

	// Issue #14: DuplicatePage uses DeletePage (soft-delete) for rollback when the duplicate's
	// create fails, while CreateWikiPage uses PermanentDeletePage for the same path.
	//
	// The bug leaves a soft-deleted orphan row in the DB.  Verifying the orphan requires
	// querying rows with DeleteAt!=0, which the Page store interface does not expose.
	// This test therefore verifies the reachable invariant (no ACTIVE pages remain after
	// failed DuplicatePage) and documents the fix needed in the code comment.
	//
	// To expose the bug as a failing assertion, add a GetPage store method that accepts
	// includeDeleted=true with a channel scan, then assert the orphan count == 0.
	t.Run("DuplicatePage returns error and leaves no active pages when the target wiki is gone", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		sourceWiki := &model.Wiki{Title: "Source Wiki"}
		createdSourceWiki, err := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, err)

		// Pre-fetch targetWiki + backing channel, then delete the wiki row so the duplicate's
		// CreatePage fails while the in-memory objects remain valid.
		targetWiki := &model.Wiki{Title: "Target Wiki"}
		createdTargetWiki, err := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, err)

		backingChannel, chanErr := th.App.GetWikiBackingChannel(th.Context, createdTargetWiki.ChannelId)
		require.Nil(t, chanErr)

		err = th.App.DeleteWiki(th.Context, createdTargetWiki.Id, th.BasicUser.Id, nil)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Original Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id
		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		// DuplicatePage: the duplicate's CreatePage fails because the target wiki row is gone.
		// BUG (#14): rollback calls DeletePage (soft-delete) — orphan row remains in DB.
		// Fix: call PermanentDeletePage (like CreateWikiPage does) so no row survives.
		_, appErr = th.App.DuplicatePage(th.Context, page, createdTargetWiki.Id, nil, nil, th.BasicUser.Id, createdTargetWiki, backingChannel)
		require.NotNil(t, appErr, "DuplicatePage must return an error when the target wiki is gone")

		// No active page should be visible — this passes for both soft-delete and
		// permanent-delete, so it does NOT distinguish the bug from the fix.
		// The stronger assertion (zero soft-deleted rows in backing channel) requires
		// a store method with includeDeleted support; add it as part of fix #14.
		activePagesAfter, storeErr := th.App.Srv().Store().Page().GetChannelPages(backingChannel.Id, 0, 0)
		require.NoError(t, storeErr)
		require.Empty(t, activePagesAfter, "no active pages should remain in backing channel after failed DuplicatePage")
	})

	t.Run("truncates title when exceeding max length", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{

			Title: "Test Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		var longTitle strings.Builder
		for range 300 {
			longTitle.WriteString("A")
		}

		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", longTitle.String()[:255], "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdWiki.Id, nil, nil, th.BasicUser.Id, nil, nil)
		require.Nil(t, appErr)

		require.LessOrEqual(t, len(duplicatedPage.Title), 255, "Title should not exceed max length")
	})
}

func TestSystemMessages_WikiAdded(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("creates system message when wiki is added to channel", func(t *testing.T) {
		wiki := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "New Wiki",
			Description: "Test wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		_, err = th.App.LinkWikiToChannel(th.Context, createdWiki.Id, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: th.BasicChannel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)
		require.NotNil(t, postList)

		var systemPost *model.Post
		for _, post := range postList.Posts {
			if post.Type == model.PostTypeWikiAdded {
				systemPost = post
				break
			}
		}

		require.NotNil(t, systemPost, "Should have created a system_wiki_added post")
		require.Equal(t, th.BasicChannel.Id, systemPost.ChannelId)
		require.Equal(t, th.BasicUser.Id, systemPost.UserId)
		require.Equal(t, createdWiki.Id, systemPost.Props["wiki_id"])
		require.Equal(t, createdWiki.Title, systemPost.Props["wiki_title"])
		require.Equal(t, th.BasicChannel.Id, systemPost.Props["channel_id"])
		require.Equal(t, th.BasicUser.Id, systemPost.Props["added_user_id"])
		require.Equal(t, th.BasicUser.Username, systemPost.Props["username"])
	})

	t.Run("creates system message when wiki is deleted", func(t *testing.T) {
		wiki := &model.Wiki{
			TeamId:      th.BasicTeam.Id,
			Title:       "Wiki to Delete",
			Description: "Test wiki deletion",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		_, err = th.App.LinkWikiToChannel(th.Context, createdWiki.Id, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)

		err = th.App.DeleteWiki(th.Context, createdWiki.Id, th.BasicUser.Id, nil)
		require.Nil(t, err)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: th.BasicChannel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)
		require.NotNil(t, postList)

		var systemPost *model.Post
		for _, post := range postList.Posts {
			if post.Type == model.PostTypeWikiDeleted {
				systemPost = post
				break
			}
		}

		require.NotNil(t, systemPost, "Should have created a system_wiki_deleted post")
		require.Equal(t, th.BasicChannel.Id, systemPost.ChannelId)
		require.Equal(t, th.BasicUser.Id, systemPost.UserId)
		require.Equal(t, createdWiki.Id, systemPost.Props["wiki_id"])
		require.Equal(t, createdWiki.Title, systemPost.Props["wiki_title"])
		require.Equal(t, th.BasicUser.Id, systemPost.Props["deleted_user_id"])
		require.Equal(t, th.BasicUser.Username, systemPost.Props["username"])
	})
}

func TestSystemMessages_PageAdded(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		TeamId:      th.BasicTeam.Id,
		Title:       "Test Wiki",
		Description: "Test description",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	_, err = th.App.LinkWikiToChannel(th.Context, createdWiki.Id, th.BasicChannel.Id, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("creates system message when page is added to wiki", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "New Page", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}`, th.BasicUser.Id, "Hello", "")
		require.Nil(t, appErr)
		require.NotNil(t, page)

		// The page_added notification goes to the source channel (not the backing channel)
		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: th.BasicChannel.Id,
			Page:      0,
			PerPage:   20,
		})
		require.Nil(t, appErr)
		require.NotNil(t, postList)

		var systemPost *model.Post
		for _, post := range postList.Posts {
			if post.Type == model.PostTypePageAdded {
				systemPost = post
				break
			}
		}

		require.NotNil(t, systemPost, "Should have created a system_page_added post")
		require.Equal(t, th.BasicChannel.Id, systemPost.ChannelId)
		require.Equal(t, th.BasicUser.Id, systemPost.UserId)
		require.Equal(t, page.Id, systemPost.Props["page_id"])
		require.Equal(t, "New Page", systemPost.Props["page_title"])
		require.Equal(t, createdWiki.Id, systemPost.Props["wiki_id"])
		require.Equal(t, createdWiki.Title, systemPost.Props["wiki_title"])
		require.Equal(t, th.BasicUser.Id, systemPost.Props["added_user_id"])
		require.Equal(t, th.BasicUser.Username, systemPost.Props["username"])
	})
}

func TestSystemMessages_PageUpdated(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		TeamId:      th.BasicTeam.Id,
		Title:       "Test Wiki",
		Description: "Test description",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	_, err = th.App.LinkWikiToChannel(th.Context, createdWiki.Id, th.BasicChannel.Id, th.BasicUser.Id)
	require.Nil(t, err)

	createdPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original"}]}]}`, th.BasicUser.Id, "Original", "")
	require.Nil(t, appErr)
	require.NotNil(t, createdPage)

	page, appErr := th.App.GetPage(th.Context, createdPage.Id)
	require.Nil(t, appErr)

	t.Run("creates system message on first page update", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id
		_, appErr := th.App.UpdatePage(th.Context, page, "Updated Title", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated"}]}]}`, "Updated", nil)
		require.Nil(t, appErr)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: createdWiki.ChannelId,
			Page:      0,
			PerPage:   20,
		})
		require.Nil(t, appErr)
		require.NotNil(t, postList)

		var systemPost *model.Post
		for _, post := range postList.Posts {
			if post.Type == model.PostTypePageUpdated {
				systemPost = post
				break
			}
		}

		require.NotNil(t, systemPost, "Should have created a system_page_updated post")
		require.Equal(t, createdWiki.ChannelId, systemPost.ChannelId)
		require.Equal(t, th.BasicUser.Id, systemPost.UserId)
		require.Equal(t, page.Id, systemPost.Props["page_id"])
		require.Equal(t, "Updated Title", systemPost.Props["page_title"])
		require.Equal(t, createdWiki.Id, systemPost.Props["wiki_id"])
		require.Equal(t, createdWiki.Title, systemPost.Props["wiki_title"])
		require.Equal(t, 1, int(systemPost.Props["update_count"].(float64)))

		updaterIds, ok := systemPost.Props["updater_ids"].([]any)
		require.True(t, ok, "updater_ids should be an array")
		require.Len(t, updaterIds, 1, "Should have one updater")
		require.Equal(t, th.BasicUser.Id, updaterIds[0])
		require.Equal(t, th.BasicUser.Username, systemPost.Props["username_"+th.BasicUser.Id])
	})

	t.Run("consolidates multiple updates within 2 hours", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id

		_, appErr := th.App.UpdatePage(th.Context, page, "First Update", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First update"}]}]}`, "First update", nil)
		require.Nil(t, appErr)

		_, appErr = th.App.UpdatePage(th.Context, page, "", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Second update"}]}]}`, "Second update", nil)
		require.Nil(t, appErr)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: createdWiki.ChannelId,
			Page:      0,
			PerPage:   20,
		})
		require.Nil(t, appErr)

		updateNotificationCount := 0
		var latestUpdatePost *model.Post
		for _, post := range postList.Posts {
			if post.Type == model.PostTypePageUpdated {
				updateNotificationCount++
				if latestUpdatePost == nil || post.CreateAt > latestUpdatePost.CreateAt {
					latestUpdatePost = post
				}
			}
		}

		require.Equal(t, 1, updateNotificationCount, "Should only have one system_page_updated post (consolidated)")
		require.NotNil(t, latestUpdatePost)
		require.Equal(t, 3, int(latestUpdatePost.Props["update_count"].(float64)), "Update count should be 3 (first subtest + 2 updates)")

		_, appErr = th.App.UpdatePage(th.Context, page, "", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Third update"}]}]}`, "Third update", nil)
		require.Nil(t, appErr)

		postList, appErr = th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: createdWiki.ChannelId,
			Page:      0,
			PerPage:   20,
		})
		require.Nil(t, appErr)

		updateNotificationCount = 0
		latestUpdatePost = nil
		for _, post := range postList.Posts {
			if post.Type == model.PostTypePageUpdated {
				updateNotificationCount++
				if latestUpdatePost == nil || post.CreateAt > latestUpdatePost.CreateAt {
					latestUpdatePost = post
				}
			}
		}

		require.Equal(t, 1, updateNotificationCount, "Should still have only one system_page_updated post")
		require.NotNil(t, latestUpdatePost)
		require.Equal(t, 4, int(latestUpdatePost.Props["update_count"].(float64)), "Update count should be 4 (first subtest + 3 updates)")
	})

	t.Run("tracks multiple updaters in consolidated notification", func(t *testing.T) {
		session1, err := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id})
		require.Nil(t, err)
		_, appErr := th.App.UpdatePage(th.Context.WithSession(session1), page, "Update by User1", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User1 update"}]}]}`, "User1 update", nil)
		require.Nil(t, appErr)

		session2, err := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser2.Id})
		require.Nil(t, err)
		_, appErr = th.App.UpdatePage(th.Context.WithSession(session2), page, "Update by User2", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User2 update"}]}]}`, "User2 update", nil)
		require.Nil(t, appErr)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: createdWiki.ChannelId,
			Page:      0,
			PerPage:   20,
		})
		require.Nil(t, appErr)

		var latestUpdatePost *model.Post
		for _, post := range postList.Posts {
			if post.Type == model.PostTypePageUpdated {
				if latestUpdatePost == nil || post.CreateAt > latestUpdatePost.CreateAt {
					latestUpdatePost = post
				}
			}
		}

		require.NotNil(t, latestUpdatePost)
		updaterIds, ok := latestUpdatePost.Props["updater_ids"].([]any)
		require.True(t, ok, "updater_ids should be an array")
		require.Len(t, updaterIds, 2, "Should have two unique updaters")

		updaterIdMap := make(map[string]bool)
		for _, id := range updaterIds {
			idStr, ok := id.(string)
			require.True(t, ok)
			updaterIdMap[idStr] = true
			require.Contains(t, latestUpdatePost.Props, "username_"+idStr, "Should have username for updater")
		}

		require.True(t, updaterIdMap[th.BasicUser.Id], "Should include BasicUser in updaters")
		require.True(t, updaterIdMap[th.BasicUser2.Id], "Should include BasicUser2 in updaters")
		require.Equal(t, th.BasicUser.Username, latestUpdatePost.Props["username_"+th.BasicUser.Id])
		require.Equal(t, th.BasicUser2.Username, latestUpdatePost.Props["username_"+th.BasicUser2.Id])
	})
}

func TestGetWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	wiki := &model.Wiki{

		Title:       "Test Wiki",
		Description: "Test wiki description",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("returns wiki by ID", func(t *testing.T) {
		retrievedWiki, appErr := th.App.GetWiki(rctx, createdWiki.Id)
		require.Nil(t, appErr)
		require.NotNil(t, retrievedWiki)
		require.Equal(t, createdWiki.Id, retrievedWiki.Id)
		require.Equal(t, "Test Wiki", retrievedWiki.Title)
		require.Equal(t, createdWiki.ChannelId, retrievedWiki.ChannelId)
	})

	t.Run("returns error for non-existent wiki", func(t *testing.T) {
		retrievedWiki, appErr := th.App.GetWiki(rctx, model.NewId())
		require.NotNil(t, appErr)
		require.Nil(t, retrievedWiki)
	})

	t.Run("returns error for invalid wiki ID", func(t *testing.T) {
		retrievedWiki, appErr := th.App.GetWiki(rctx, "invalid-id")
		require.NotNil(t, appErr)
		require.Nil(t, retrievedWiki)
	})
}

func TestGetWikiPages(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	wiki := &model.Wiki{

		Title: "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("returns pages for wiki", func(t *testing.T) {
		// Create pages in the wiki
		page1, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page 1", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		page2, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		pages, appErr := th.App.GetWikiPages(rctx, createdWiki.Id, 0, 10)
		require.Nil(t, appErr)
		require.NotNil(t, pages)
		require.GreaterOrEqual(t, len(pages), 2)

		pageIds := make([]string, len(pages))
		for i, p := range pages {
			pageIds[i] = p.Id
		}
		require.Contains(t, pageIds, page1.Id)
		require.Contains(t, pageIds, page2.Id)
	})

	t.Run("respects pagination", func(t *testing.T) {
		pages, appErr := th.App.GetWikiPages(rctx, createdWiki.Id, 0, 1)
		require.Nil(t, appErr)
		require.Len(t, pages, 1)

		pages2, appErr := th.App.GetWikiPages(rctx, createdWiki.Id, 1, 1)
		require.Nil(t, appErr)
		require.NotEmpty(t, pages2)
		require.NotEqual(t, pages[0].Id, pages2[0].Id)
	})

	t.Run("returns not found for non-existent wiki", func(t *testing.T) {
		pages, appErr := th.App.GetWikiPages(rctx, model.NewId(), 0, 10)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)
		require.Nil(t, pages)
	})
}

func TestDeleteWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	t.Run("deletes wiki and its backing channel", func(t *testing.T) {
		wiki := &model.Wiki{

			Title: "Wiki to Delete",
		}
		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		backingChannelId := createdWiki.ChannelId

		appErr := th.App.DeleteWiki(rctx, createdWiki.Id, th.BasicUser.Id, nil)
		require.Nil(t, appErr)

		// Wiki should no longer be retrievable
		_, appErr = th.App.GetWiki(rctx, createdWiki.Id)
		require.NotNil(t, appErr)

		// Backing channel should be deleted
		_, appErr = th.App.GetChannel(rctx, backingChannelId)
		require.NotNil(t, appErr)

		// Links should be removed - wiki should not appear in linked wikis for the original channel
		wikis, appErr := th.App.GetWikisLinkedToChannel(rctx, th.BasicChannel.Id)
		require.Nil(t, appErr)
		for _, w := range wikis {
			require.NotEqual(t, createdWiki.Id, w.Id, "Deleted wiki should not appear in linked list")
		}
	})

	t.Run("returns error for non-existent wiki", func(t *testing.T) {
		appErr := th.App.DeleteWiki(rctx, model.NewId(), th.BasicUser.Id, nil)
		require.NotNil(t, appErr)
	})
}

func TestGetWikiIdForPage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	wiki := &model.Wiki{

		Title: "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("returns wiki ID for page", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		wikiId, appErr := th.App.GetWikiIdForPage(rctx, page.Id)
		require.Nil(t, appErr)
		require.Equal(t, createdWiki.Id, wikiId)
	})

	t.Run("returns error for non-existent page", func(t *testing.T) {
		wikiId, appErr := th.App.GetWikiIdForPage(rctx, model.NewId())
		require.NotNil(t, appErr)
		require.Empty(t, wikiId)
	})
}

// TestDeleteWikiAtomicity documents issue #1: DeleteWiki runs three sequential
// non-transactional store calls. If PermanentDeleteChannel (step 3) fails after
// the pages and wiki row are already gone (steps 1 and 2), the backing channel
// survives as a zombie with no wiki record pointing to it.
//
// This test verifies the happy path and records the invariant that after a
// successful DeleteWiki the wiki record, all its pages, and the backing channel
// are all gone. A full atomicity test (step-3 injection failure) would require
// a mock store; that is left for a follow-up.
func TestDeleteWikiAtomicity(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	wiki, err := th.App.CreateWiki(th.Context, &model.Wiki{Title: "Delete Atomicity Wiki"}, th.BasicUser.Id)
	require.Nil(t, err)

	// Create a page so there is something to clean up.
	page, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Page To Delete", "", th.BasicUser.Id, "", "")
	require.Nil(t, err)

	backingChannelId := wiki.ChannelId

	// Delete the wiki — all three steps must succeed.
	delErr := th.App.DeleteWiki(rctx, wiki.Id, th.BasicUser.Id, wiki)
	require.Nil(t, delErr, "DeleteWiki must succeed in the happy path")

	// Step 1: pages must be gone.
	_, pageErr := th.App.GetPage(rctx, page.Id)
	require.NotNil(t, pageErr, "page must be deleted after DeleteWiki")

	// Step 2: wiki record must be gone.
	_, wikiErr := th.App.GetWiki(rctx, wiki.Id)
	require.NotNil(t, wikiErr, "wiki record must be deleted after DeleteWiki")

	// Step 3: backing channel must be gone.
	// BUG #1: if PermanentDeleteChannel failed (e.g., crash), this channel
	// would still exist as a zombie. No recovery path exists in current code.
	_, chanErr := th.App.GetChannel(rctx, backingChannelId)
	require.NotNil(t, chanErr,
		"BUG #1 guard: backing channel must be permanently deleted; "+
			"if step 3 fails the channel becomes a zombie with no recovery path")
}
