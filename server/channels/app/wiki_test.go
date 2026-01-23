// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetWikisForChannel_SoftDelete(t *testing.T) {
	th := Setup(t).InitBasic(t)

	wiki1 := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki 1",
		Description: "Test description 1",
	}

	wiki2 := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki 2",
		Description: "Test description 2",
	}

	createdWiki1, err := th.App.CreateWiki(th.Context, wiki1, th.BasicUser.Id)
	require.Nil(t, err)
	require.NotNil(t, createdWiki1)

	createdWiki2, err := th.App.CreateWiki(th.Context, wiki2, th.BasicUser.Id)
	require.Nil(t, err)
	require.NotNil(t, createdWiki2)

	t.Run("includeDeleted=false hides soft-deleted wikis", func(t *testing.T) {
		wikis, err := th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, false)
		require.Nil(t, err)
		require.Len(t, wikis, 2)

		err = th.App.DeleteWiki(th.Context, createdWiki1.Id, th.BasicUser.Id)
		require.Nil(t, err)

		wikis, err = th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, false)
		require.Nil(t, err)
		require.Len(t, wikis, 1)
		require.Equal(t, createdWiki2.Id, wikis[0].Id)
	})

	t.Run("includeDeleted=true shows soft-deleted wikis", func(t *testing.T) {
		wikis, err := th.App.GetWikisForChannel(th.Context, th.BasicChannel.Id, true)
		require.Nil(t, err)
		require.Len(t, wikis, 2)

		var deletedWiki *model.Wiki
		for _, w := range wikis {
			if w.Id == createdWiki1.Id {
				deletedWiki = w
				break
			}
		}
		require.NotNil(t, deletedWiki)
		require.NotEqual(t, int64(0), deletedWiki.DeleteAt)
	})
}

func TestUpdateWiki(t *testing.T) {
	th := Setup(t).InitBasic(t)

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
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
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki",
		Description: "Test Description",
	}

	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)
	require.NotNil(t, createdWiki)
	require.NotEmpty(t, createdWiki.Id)

	t.Run("wiki has no pages initially", func(t *testing.T) {
		pages, pageErr := th.App.Srv().Store().Wiki().GetPages(createdWiki.Id, 0, 10)
		require.NoError(t, pageErr)
		require.Len(t, pages, 0, "Wiki should have no pages initially, only a draft")
	})

	t.Run("default draft exists for the wiki", func(t *testing.T) {
		drafts, err := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdWiki.Id, 0, 200)
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
			ChannelId:   th.BasicChannel.Id,
			Title:       "Test Wiki",
			Description: "Test Description",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "New Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)
		require.Equal(t, model.PostTypePage, page.Type)
		require.Equal(t, th.BasicChannel.Id, page.ChannelId)
		require.Empty(t, page.PageParentId)
		require.Equal(t, "New Page", page.Props["title"])

		pages, pageErr := th.App.Srv().Store().Wiki().GetPages(createdWiki.Id, 0, 10)
		require.NoError(t, pageErr)
		require.Len(t, pages, 1, "Wiki should have 1 page (default is a draft, not a page)")
	})

	t.Run("creates child page with parent", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId:   th.BasicChannel.Id,
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
		require.Equal(t, parentPage.Id, childPage.PageParentId, "Child page should reference parent")
		require.Equal(t, "Child Page", childPage.Props["title"])
	})

	t.Run("fails when parent is not a page", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId:   th.BasicChannel.Id,
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
			ChannelId:   th.BasicChannel.Id,
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
			ChannelId: otherChannel.Id,
			Title:     "Other Wiki",
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
			ChannelId:   th.BasicChannel.Id,
			Title:       "Source Wiki",
			Description: "Source",
		}

		targetWiki := &model.Wiki{
			ChannelId:   th.BasicChannel.Id,
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
		appErr = th.App.MovePageToWiki(th.Context, page, createdTargetWiki.Id, nil)
		require.Nil(t, appErr)

		wikiId, wikiErr := th.App.GetWikiIdForPage(th.Context, createdPage.Id)
		require.Nil(t, wikiErr)
		require.Equal(t, createdTargetWiki.Id, wikiId)

		movedPage, pageErr := th.App.GetSinglePost(th.Context, page.Id, false)
		require.Nil(t, pageErr)
		require.Empty(t, movedPage.PageParentId, "Moved page should become root")
	})

	t.Run("successfully moves page with children (entire subtree)", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}

		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Target Wiki",
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

		appErr = th.App.MovePageToWiki(th.Context, parentPageWrapper, createdTargetWiki.Id, nil)
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

		movedParent, pageErr := th.App.GetSinglePost(th.Context, parentPage.Id, false)
		require.Nil(t, pageErr)
		require.Empty(t, movedParent.PageParentId, "Moved parent page should become root")

		movedChild1, pageErr := th.App.GetSinglePost(th.Context, childPage1.Id, false)
		require.Nil(t, pageErr)
		require.Equal(t, parentPage.Id, movedChild1.PageParentId, "Child1 should still reference parent")

		movedChild2, pageErr := th.App.GetSinglePost(th.Context, childPage2.Id, false)
		require.Nil(t, pageErr)
		require.Equal(t, parentPage.Id, movedChild2.PageParentId, "Child2 should still reference parent")

		movedGrandchild, pageErr := th.App.GetSinglePost(th.Context, grandchildPage.Id, false)
		require.Nil(t, pageErr)
		require.Equal(t, childPage1.Id, movedGrandchild.PageParentId, "Grandchild should still reference child1")
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
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}

		createdSourceWiki, err := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		appErr = th.App.MovePageToWiki(th.Context, page, model.NewId(), nil)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.move.target_wiki_not_found", appErr.Id)
	})

	t.Run("fails when source and target wiki are the same (idempotent check)", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		appErr = th.App.MovePageToWiki(th.Context, page, createdWiki.Id, nil)
		require.Nil(t, appErr, "Moving to same wiki should succeed (idempotent)")
	})

	t.Run("fails when wikis are in different channels (Phase 1 constraint)", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}

		createdSourceWiki, err := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, err)

		otherChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "other-channel",
			DisplayName: "Other Channel",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, chanErr)

		_, memberErr := th.App.AddUserToChannel(th.Context, th.BasicUser, otherChannel, false)
		require.Nil(t, memberErr)

		targetWiki := &model.Wiki{
			ChannelId: otherChannel.Id,
			Title:     "Target Wiki",
		}

		createdTargetWiki, err := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		appErr = th.App.MovePageToWiki(th.Context, page, createdTargetWiki.Id, nil)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.move.cross_channel_not_supported", appErr.Id)
	})

	t.Run("updates comment wiki_id when page is moved to different wiki", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}

		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Target Wiki",
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
		topLevelComment, appErr := th.App.CreatePageComment(rctx, page.Id, "Top-level comment", nil)
		require.Nil(t, appErr)
		require.Equal(t, createdSourceWiki.Id, topLevelComment.GetProp(model.PagePropsWikiID))

		// Create an inline comment
		inlineAnchor := map[string]any{
			"from": 10,
			"to":   20,
		}
		inlineComment, appErr := th.App.CreatePageComment(rctx, page.Id, "Inline comment", inlineAnchor)
		require.Nil(t, appErr)
		require.Equal(t, createdSourceWiki.Id, inlineComment.GetProp(model.PagePropsWikiID))

		// Move page to target wiki
		th.Context.Session().UserId = th.BasicUser.Id
		pageWrapper, appErr := th.App.GetPage(th.Context, page.Id)
		require.Nil(t, appErr)

		appErr = th.App.MovePageToWiki(th.Context, pageWrapper, createdTargetWiki.Id, nil)
		require.Nil(t, appErr)

		// Verify top-level comment wiki_id was updated
		updatedTopLevelComment, getErr := th.App.GetSinglePost(th.Context, topLevelComment.Id, false)
		require.Nil(t, getErr)
		require.Equal(t, createdTargetWiki.Id, updatedTopLevelComment.GetProp(model.PagePropsWikiID),
			"Top-level comment wiki_id should be updated to target wiki")

		// Verify inline comment wiki_id was updated
		updatedInlineComment, getErr := th.App.GetSinglePost(th.Context, inlineComment.Id, false)
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
			ChannelId:   th.BasicChannel.Id,
			Title:       "Source Wiki",
			Description: "Source",
		}

		targetWiki := &model.Wiki{
			ChannelId:   th.BasicChannel.Id,
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

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdTargetWiki.Id, nil, nil, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, duplicatedPage)

		require.NotEqual(t, page.Id, duplicatedPage.Id, "Duplicated page should have new ID")
		require.Equal(t, "Copy of Original Page", duplicatedPage.Props["title"], "Should have default duplicate title")
		require.Equal(t, th.BasicChannel.Id, duplicatedPage.ChannelId, "Should be in same channel")
		require.Empty(t, duplicatedPage.PageParentId, "Should be root level")

		duplicatedContent, contentErr := th.App.Srv().Store().Page().GetPageContent(duplicatedPage.Id)
		require.NoError(t, contentErr)
		duplicatedContentJSON, jsonErr := duplicatedContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.NotEmpty(t, duplicatedContentJSON, "Content should exist")
		require.Contains(t, duplicatedContentJSON, "Original content", "Content should contain original text")
		require.Contains(t, duplicatedContentJSON, "\"type\":\"doc\"", "Content should be TipTap document")

		targetWikiId, wikiErr := th.App.GetWikiIdForPage(th.Context, duplicatedPage.Id)
		require.Nil(t, wikiErr)
		require.Equal(t, createdTargetWiki.Id, targetWikiId, "Should be in target wiki")
	})

	t.Run("successfully duplicates page within same wiki", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page to Duplicate", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdWiki.Id, nil, nil, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, duplicatedPage)

		require.NotEqual(t, page.Id, duplicatedPage.Id)
		require.Equal(t, "Copy of Page to Duplicate", duplicatedPage.Props["title"])

		wikiId, wikiErr := th.App.GetWikiIdForPage(th.Context, duplicatedPage.Id)
		require.Nil(t, wikiErr)
		require.Equal(t, createdWiki.Id, wikiId, "Should remain in same wiki")
	})

	t.Run("successfully duplicates page with custom title", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Original", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		customTitle := "My Custom Title"
		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdWiki.Id, nil, &customTitle, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.Equal(t, customTitle, duplicatedPage.Props["title"], "Should use custom title")
	})

	t.Run("successfully duplicates page with parent", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
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

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdWiki.Id, nil, nil, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.Equal(t, parentPage.Id, duplicatedPage.PageParentId, "Should preserve parent from source page")
	})

	t.Run("fails when duplicating across channels", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		channel1 := th.BasicChannel
		channel2 := th.CreateChannel(t, th.BasicTeam)

		sourceWiki := &model.Wiki{
			ChannelId: channel1.Id,
			Title:     "Source Wiki",
		}

		targetWiki := &model.Wiki{
			ChannelId: channel2.Id,
			Title:     "Target Wiki",
		}

		createdSourceWiki, err := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdTargetWiki, err := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdTargetWiki.Id, nil, nil, th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Nil(t, duplicatedPage)
		require.Contains(t, appErr.Id, "cross_channel_not_supported")
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
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		page, appErr := th.App.GetPage(th.Context, createdPage.Id)
		require.Nil(t, appErr)

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, "nonexistent", nil, nil, th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Nil(t, duplicatedPage)
		require.Contains(t, appErr.Id, "target_wiki_not_found")
	})

	t.Run("truncates title when exceeding max length", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
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

		duplicatedPage, appErr := th.App.DuplicatePage(th.Context, page, createdWiki.Id, nil, nil, th.BasicUser.Id)
		require.Nil(t, appErr)

		duplicateTitle := duplicatedPage.GetPageTitle()
		require.LessOrEqual(t, len(duplicateTitle), 255, "Title should not exceed max length")
		require.True(t, len(duplicateTitle) <= 255)
	})
}

func TestSystemMessages_WikiAdded(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("creates system message when wiki is added to channel", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId:   th.BasicChannel.Id,
			Title:       "New Wiki",
			Description: "Test wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

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
			ChannelId:   th.BasicChannel.Id,
			Title:       "Wiki to Delete",
			Description: "Test wiki deletion",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		err = th.App.DeleteWiki(th.Context, createdWiki.Id, th.BasicUser.Id)
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
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki",
		Description: "Test description",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("creates system message when page is added to wiki", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "New Page", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}`, th.BasicUser.Id, "Hello", "")
		require.Nil(t, appErr)
		require.NotNil(t, page)

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
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki",
		Description: "Test description",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	createdPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original"}]}]}`, th.BasicUser.Id, "Original", "")
	require.Nil(t, appErr)
	require.NotNil(t, createdPage)

	page, appErr := th.App.GetPage(th.Context, createdPage.Id)
	require.Nil(t, appErr)

	t.Run("creates system message on first page update", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id
		_, appErr := th.App.UpdatePage(th.Context, page, "Updated Title", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated"}]}]}`, "Updated")
		require.Nil(t, appErr)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: th.BasicChannel.Id,
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
		require.Equal(t, th.BasicChannel.Id, systemPost.ChannelId)
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

		_, appErr := th.App.UpdatePage(th.Context, page, "First Update", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First update"}]}]}`, "First update")
		require.Nil(t, appErr)

		_, appErr = th.App.UpdatePage(th.Context, page, "", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Second update"}]}]}`, "Second update")
		require.Nil(t, appErr)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: th.BasicChannel.Id,
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

		_, appErr = th.App.UpdatePage(th.Context, page, "", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Third update"}]}]}`, "Third update")
		require.Nil(t, appErr)

		postList, appErr = th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: th.BasicChannel.Id,
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
		th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)
		_, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.BasicUser2.Id, model.ChannelUserRoleId+" "+model.ChannelAdminRoleId)
		require.Nil(t, appErr)

		session1, err := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id})
		require.Nil(t, err)
		_, appErr = th.App.UpdatePage(th.Context.WithSession(session1), page, "Update by User1", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User1 update"}]}]}`, "User1 update")
		require.Nil(t, appErr)

		session2, err := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser2.Id})
		require.Nil(t, err)
		_, appErr = th.App.UpdatePage(th.Context.WithSession(session2), page, "Update by User2", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User2 update"}]}]}`, "User2 update")
		require.Nil(t, appErr)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: th.BasicChannel.Id,
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

func TestMoveWikiToChannel(t *testing.T) {
	th := Setup(t).InitBasic(t)

	sourceChannel := th.CreateChannel(t, th.BasicTeam)
	targetChannel := th.CreateChannel(t, th.BasicTeam)

	wiki := &model.Wiki{
		ChannelId:   sourceChannel.Id,
		Title:       "Test Wiki",
		Description: "Test wiki to move",
	}

	originalWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)
	require.NotNil(t, originalWiki)
	require.Equal(t, sourceChannel.Id, originalWiki.ChannelId)

	var movedWiki *model.Wiki

	t.Run("successfully moves wiki to target channel", func(t *testing.T) {
		var appErr *model.AppError
		movedWiki, appErr = th.App.MoveWikiToChannel(th.Context, originalWiki, targetChannel, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, movedWiki)
		require.Equal(t, targetChannel.Id, movedWiki.ChannelId)

		retrievedWiki, getErr := th.App.GetWiki(th.Context, originalWiki.Id)
		require.Nil(t, getErr)
		require.Equal(t, targetChannel.Id, retrievedWiki.ChannelId)

		sourceWikis, appErr := th.App.GetWikisForChannel(th.Context, sourceChannel.Id, false)
		require.Nil(t, appErr)
		require.Empty(t, sourceWikis, "Wiki should be removed from source channel")

		targetWikis, appErr := th.App.GetWikisForChannel(th.Context, targetChannel.Id, false)
		require.Nil(t, appErr)
		require.Len(t, targetWikis, 1, "Wiki should appear in target channel")
		require.Equal(t, originalWiki.Id, targetWikis[0].Id)
	})

	t.Run("fails when moving to same channel", func(t *testing.T) {
		_, appErr := th.App.MoveWikiToChannel(th.Context, movedWiki, targetChannel, th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "app.wiki.move_wiki_to_channel.same_channel.app_error", appErr.Id)
	})

	t.Run("fails when moving to different team", func(t *testing.T) {
		differentTeam := th.CreateTeam(t)
		differentChannel := th.CreateChannel(t, differentTeam)

		_, appErr := th.App.MoveWikiToChannel(th.Context, movedWiki, differentChannel, th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "app.wiki.move_wiki_to_channel.cross_team_not_supported.app_error", appErr.Id)
	})
}

func TestGetWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
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
		require.Equal(t, th.BasicChannel.Id, retrievedWiki.ChannelId)
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
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
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

	t.Run("returns empty list for non-existent wiki", func(t *testing.T) {
		pages, appErr := th.App.GetWikiPages(rctx, model.NewId(), 0, 10)
		require.Nil(t, appErr)
		require.Empty(t, pages)
	})
}

func TestDeleteWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	t.Run("soft deletes wiki", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Wiki to Delete",
		}
		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		appErr := th.App.DeleteWiki(rctx, createdWiki.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Wiki should not be retrievable with default query
		wikis, appErr := th.App.GetWikisForChannel(rctx, th.BasicChannel.Id, false)
		require.Nil(t, appErr)
		for _, w := range wikis {
			require.NotEqual(t, createdWiki.Id, w.Id, "Deleted wiki should not appear in active list")
		}

		// Wiki should be retrievable with includeDeleted=true
		wikisWithDeleted, appErr := th.App.GetWikisForChannel(rctx, th.BasicChannel.Id, true)
		require.Nil(t, appErr)
		found := false
		for _, w := range wikisWithDeleted {
			if w.Id == createdWiki.Id {
				found = true
				require.Greater(t, w.DeleteAt, int64(0))
			}
		}
		require.True(t, found, "Deleted wiki should be in list with includeDeleted=true")
	})

	t.Run("returns error for non-existent wiki", func(t *testing.T) {
		appErr := th.App.DeleteWiki(rctx, model.NewId(), th.BasicUser.Id)
		require.NotNil(t, appErr)
	})
}

func TestGetWikiIdForPage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
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

func TestAddPageToWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("adds page to wiki", func(t *testing.T) {
		// Create a page not initially in the wiki
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Standalone Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		appErr = th.App.AddPageToWiki(rctx, page.Id, createdWiki.Id)
		require.Nil(t, appErr)

		// Verify the page is now associated with the wiki
		wikiId, appErr := th.App.GetWikiIdForPage(rctx, page.Id)
		require.Nil(t, appErr)
		require.Equal(t, createdWiki.Id, wikiId)
	})

	t.Run("returns error for non-existent wiki", func(t *testing.T) {
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Another Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		appErr = th.App.AddPageToWiki(rctx, page.Id, model.NewId())
		require.NotNil(t, appErr)
	})
}
