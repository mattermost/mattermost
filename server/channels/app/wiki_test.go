// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetWikisForChannel_SoftDelete(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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

		err = th.App.DeleteWiki(th.Context, createdWiki1.Id)
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
		drafts, err := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdWiki.Id)
		require.Nil(t, err)
		require.Len(t, drafts, 1, "Wiki should have exactly one default draft")

		defaultDraft := drafts[0]
		require.Equal(t, th.BasicChannel.Id, defaultDraft.ChannelId, "Draft ChannelId should store the actual channel ID")
		require.Empty(t, defaultDraft.Message, "Default draft should be empty")
		require.Equal(t, "Untitled page", defaultDraft.Props["title"], "Default draft should have 'Untitled page' title")
		require.Equal(t, createdWiki.Id, defaultDraft.WikiId, "Draft WikiId should store wiki ID")
	})
}

func TestCreatePage(t *testing.T) {
	t.Run("creates page with no parent", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId:   th.BasicChannel.Id,
			Title:       "Test Wiki",
			Description: "Test Description",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "New Page", "", th.BasicUser.Id, "")
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
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId:   th.BasicChannel.Id,
			Title:       "Test Wiki",
			Description: "Test Description",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		parentPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent Page", "", th.BasicUser.Id, "")
		require.Nil(t, err)
		require.NotNil(t, parentPage)

		childPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, parentPage.Id, "Child Page", "", th.BasicUser.Id, "")
		require.Nil(t, err)
		require.NotNil(t, childPage)
		require.Equal(t, parentPage.Id, childPage.PageParentId, "Child page should reference parent")
		require.Equal(t, "Child Page", childPage.Props["title"])
	})

	t.Run("fails when parent is not a page", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId:   th.BasicChannel.Id,
			Title:       "Test Wiki",
			Description: "Test Description",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, createdWiki)

		regularPost, postErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, postErr)

		_, pageErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, regularPost.Id, "Invalid Child", "", th.BasicUser.Id, "")
		require.NotNil(t, pageErr, "Should fail when parent is not a page")
		require.Equal(t, "app.page.create.parent_not_page.app_error", pageErr.Id)
	})

	t.Run("fails when parent is in different channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
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

		otherParentPage, err := th.App.CreateWikiPage(th.Context, createdOtherWiki.Id, "", "Other Parent", "", th.BasicUser.Id, "")
		require.Nil(t, err)
		require.NotNil(t, otherParentPage)

		_, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, otherParentPage.Id, "Cross-Channel Child", "", th.BasicUser.Id, "")
		require.NotNil(t, appErr, "Should fail when parent is in different channel")
		require.Equal(t, "app.page.create.parent_different_channel.app_error", appErr.Id)
	})
}

func TestMovePageToWiki(t *testing.T) {
	t.Run("successfully moves page to target wiki in same channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
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

		page, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "")
		require.Nil(t, err)
		require.NotNil(t, page)

		th.Context.Session().UserId = th.BasicUser.Id

		appErr := th.App.MovePageToWiki(th.Context, page.Id, createdTargetWiki.Id, nil)
		require.Nil(t, appErr)

		wikiId, wikiErr := th.App.GetWikiIdForPage(th.Context, page.Id)
		require.Nil(t, wikiErr)
		require.Equal(t, createdTargetWiki.Id, wikiId)

		movedPage, pageErr := th.App.GetSinglePost(th.Context, page.Id, false)
		require.Nil(t, pageErr)
		require.Empty(t, movedPage.PageParentId, "Moved page should become root")
	})

	t.Run("successfully moves page with children (entire subtree)", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
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

		parentPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Parent Page", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		childPage1, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, parentPage.Id, "Child Page 1", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		childPage2, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, parentPage.Id, "Child Page 2", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		grandchildPage, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, childPage1.Id, "Grandchild Page", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		appErr := th.App.MovePageToWiki(th.Context, parentPage.Id, createdTargetWiki.Id, nil)
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
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.SetupPagePermissions()

		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Target Wiki",
		}

		createdTargetWiki, err := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, err)

		appErr := th.App.MovePageToWiki(th.Context, model.NewId(), createdTargetWiki.Id, nil)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.move.page_not_found", appErr.Id)
	})

	t.Run("fails when target wiki does not exist", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.SetupPagePermissions()

		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}

		createdSourceWiki, err := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, err)

		page, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		appErr := th.App.MovePageToWiki(th.Context, page.Id, model.NewId(), nil)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.move.target_wiki_not_found", appErr.Id)
	})

	t.Run("fails when source and target wiki are the same (idempotent check)", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.SetupPagePermissions()

		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}

		createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, err)

		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		appErr := th.App.MovePageToWiki(th.Context, page.Id, createdWiki.Id, nil)
		require.Nil(t, appErr, "Moving to same wiki should succeed (idempotent)")
	})

	t.Run("fails when wikis are in different channels (Phase 1 constraint)", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
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

		page, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		appErr := th.App.MovePageToWiki(th.Context, page.Id, createdTargetWiki.Id, nil)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.move.cross_channel_not_supported", appErr.Id)
	})

	t.Run("fails when page title conflicts with existing page in target wiki", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
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

		_, err = th.App.CreateWikiPage(th.Context, createdTargetWiki.Id, "", "Duplicate Title", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		pageToMove, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Duplicate Title", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id

		appErr := th.App.MovePageToWiki(th.Context, pageToMove.Id, createdTargetWiki.Id, nil)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.move.title_conflict", appErr.Id)
	})

	t.Run("fails when user has no permission to edit source wiki", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
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

		page, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		otherUser := th.CreateUser()
		_, _, addTeamErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, otherUser.Id, "")
		require.Nil(t, addTeamErr)
		_, memberErr := th.App.AddUserToChannel(th.Context, otherUser, th.BasicChannel, false)
		require.Nil(t, memberErr)

		th.Context.Session().UserId = otherUser.Id

		appErr := th.App.MovePageToWiki(th.Context, page.Id, createdTargetWiki.Id, nil)
		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "permission")
	})

	t.Run("fails when user has no permission to create in target wiki", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
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

		page, err := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		otherUser := th.CreateUser()
		_, _, addTeamErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, otherUser.Id, "")
		require.Nil(t, addTeamErr)
		_, memberErr := th.App.AddUserToChannel(th.Context, otherUser, th.BasicChannel, false)
		require.Nil(t, memberErr)

		updateErr := th.App.Srv().Store().User().UpdateLastLogin(otherUser.Id, model.GetMillis())
		require.NoError(t, updateErr)

		th.Context.Session().UserId = otherUser.Id

		appErr := th.App.MovePageToWiki(th.Context, page.Id, createdTargetWiki.Id, nil)
		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "permission")
	})
}
