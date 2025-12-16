// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPagePublishWebSocketEvent(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki",
		Description: "Integration test wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("page_published event broadcasted to channel on publish", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id

		wsClient, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		defer wsClient.Close()

		wsClient.Listen()

		time.Sleep(100 * time.Millisecond)

		pageId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test page content"}]}]}`

		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, pageId, draftContent, "Test Page", 0, nil)
		require.Nil(t, appErr)

		publishedPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId: wiki.Id,
			PageId: pageId,
			Title:  "Test Page",
		})
		require.Nil(t, appErr)

		timeout := time.After(3 * time.Second)
		eventReceived := false

		for !eventReceived {
			select {
			case event := <-wsClient.EventChannel:
				t.Logf("Received WebSocket event: %s", event.EventType())
				if event.EventType() == model.WebsocketEventPagePublished {
					eventReceived = true

					assert.Equal(t, th.BasicChannel.Id, event.GetBroadcast().ChannelId)
					assert.Equal(t, publishedPage.Id, event.GetData()["page_id"])
					assert.Equal(t, wiki.Id, event.GetData()["wiki_id"])
					assert.Equal(t, pageId, event.GetData()["draft_id"])
					assert.Equal(t, th.BasicUser.Id, event.GetData()["user_id"])

					pageData, ok := event.GetData()["page"]
					require.True(t, ok, "page data should be present in event")
					require.NotEmpty(t, pageData, "page data should not be empty")
				}
			case <-timeout:
				require.Fail(t, "timeout waiting for page_published WebSocket event")
				return
			}
		}

		require.True(t, eventReceived, "page_published event should have been received")
	})

	t.Run("page_published event not received by non-channel-members", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id

		user2 := th.CreateUser(t)
		client2 := th.CreateClient()
		_, _, err := client2.Login(context.Background(), user2.Email, user2.Password)
		require.NoError(t, err)

		wsClient2, err := th.CreateWebSocketClientWithClient(client2)
		require.NoError(t, err)
		defer wsClient2.Close()

		wsClient2.Listen()

		time.Sleep(100 * time.Millisecond)

		pageId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test page content"}]}]}`

		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, pageId, draftContent, "Test Page", 0, nil)
		require.Nil(t, appErr)

		_, appErr = th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId: wiki.Id,
			PageId: pageId,
			Title:  "Test Page 2",
		})
		require.Nil(t, appErr)

		timeout := time.After(2 * time.Second)

		select {
		case event := <-wsClient2.EventChannel:
			if event.EventType() == model.WebsocketEventPagePublished {
				require.Fail(t, "non-channel-member should not receive page_published event")
			}
		case <-timeout:
		}
	})
}

func TestMultiUserPageEditing(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)

	th.LinkUserToTeam(t, th.BasicUser2, th.BasicTeam)
	th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Shared Wiki",
		Description: "Multi-user test wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("two users can create separate pages simultaneously", func(t *testing.T) {
		pageId1 := model.NewId()
		pageId2 := model.NewId()

		draftContent1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 1 content"}]}]}`
		draftContent2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 2 content"}]}]}`

		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, pageId1, draftContent1, "User 1 Page", 0, nil)
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser2.Id
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser2.Id, wiki.Id, pageId2, draftContent2, "User 2 Page", 0, nil)
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser.Id
		page1, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId: wiki.Id,
			PageId: pageId1,
			Title:  "User 1 Page",
		})
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser2.Id
		page2, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser2.Id, model.PublishPageDraftOptions{
			WikiId: wiki.Id,
			PageId: pageId2,
			Title:  "User 2 Page",
		})
		require.Nil(t, appErr)

		assert.NotEqual(t, page1.Id, page2.Id)
		assert.Equal(t, th.BasicUser.Id, page1.UserId)
		assert.Equal(t, th.BasicUser2.Id, page2.UserId)

		pages, appErr := th.App.GetWikiPages(th.Context, wiki.Id, 0, 10)
		require.Nil(t, appErr)
		require.Len(t, pages, 2)
	})

	t.Run("two users can create child pages under same parent", func(t *testing.T) {
		parentPageId := model.NewId()
		parentContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Parent page"}]}]}`

		th.Context.Session().UserId = th.BasicUser.Id
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, parentPageId, parentContent, "Parent Page", 0, nil)
		require.Nil(t, appErr)

		parentPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId: wiki.Id,
			PageId: parentPageId,
			Title:  "Parent Page",
		})
		require.Nil(t, appErr)

		child1PageId := model.NewId()
		child2PageId := model.NewId()

		childContent1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Child 1 content"}]}]}`
		childContent2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Child 2 content"}]}]}`

		th.Context.Session().UserId = th.BasicUser.Id
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, child1PageId, childContent1, "Child 1", 0, nil)
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser2.Id
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser2.Id, wiki.Id, child2PageId, childContent2, "Child 2", 0, nil)
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser.Id
		child1, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId:   wiki.Id,
			PageId:   child1PageId,
			ParentId: parentPage.Id,
			Title:    "Child 1",
		})
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser2.Id
		child2, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser2.Id, model.PublishPageDraftOptions{
			WikiId:   wiki.Id,
			PageId:   child2PageId,
			ParentId: parentPage.Id,
			Title:    "Child 2",
		})
		require.Nil(t, appErr)

		assert.Equal(t, parentPage.Id, child1.PageParentId)
		assert.Equal(t, parentPage.Id, child2.PageParentId)

		children, appErr := th.App.GetPageChildren(th.Context, parentPage.Id, model.GetPostsOptions{})
		require.Nil(t, appErr)
		require.Len(t, children.Posts, 2)
	})

	t.Run("user cannot edit another user's draft", func(t *testing.T) {
		pageId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 1 draft"}]}]}`

		th.Context.Session().UserId = th.BasicUser.Id
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, pageId, draftContent, "User 1 draft", 0, nil)
		require.Nil(t, appErr)
		require.Equal(t, th.BasicUser.Id, draft.UserId)

		th.Context.Session().UserId = th.BasicUser2.Id
		retrievedDraft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser2.Id, wiki.Id, pageId)
		require.NotNil(t, appErr)
		require.Nil(t, retrievedDraft)
		assert.Equal(t, "app.draft.get_page_draft.not_found", appErr.Id)
	})
}

func TestConcurrentPageHierarchyOperations(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Concurrent Test Wiki",
		Description: "Concurrent operations test",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("concurrent page moves do not corrupt hierarchy", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id

		parentPageId := model.NewId()
		parentContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Parent"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, parentPageId, parentContent, "Parent", 0, nil)
		require.Nil(t, appErr)
		parentPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId: wiki.Id,
			PageId: parentPageId,
			Title:  "Parent",
		})
		require.Nil(t, appErr)

		child1PageId := model.NewId()
		child1Content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Child 1"}]}]}`
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, child1PageId, child1Content, "Child 1", 0, nil)
		require.Nil(t, appErr)
		child1, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId: wiki.Id,
			PageId: child1PageId,
			Title:  "Child 1",
		})
		require.Nil(t, appErr)

		child2PageId := model.NewId()
		child2Content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Child 2"}]}]}`
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, child2PageId, child2Content, "Child 2", 0, nil)
		require.Nil(t, appErr)
		child2, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId: wiki.Id,
			PageId: child2PageId,
			Title:  "Child 2",
		})
		require.Nil(t, appErr)

		done := make(chan bool, 2)
		errors := make(chan *model.AppError, 2)

		go func() {
			err := th.App.ChangePageParent(th.Context, child1.Id, parentPage.Id)
			if err != nil {
				errors <- err
			}
			done <- true
		}()

		go func() {
			err := th.App.ChangePageParent(th.Context, child2.Id, parentPage.Id)
			if err != nil {
				errors <- err
			}
			done <- true
		}()

		<-done
		<-done
		close(errors)

		for err := range errors {
			require.Nil(t, err, "concurrent page moves should not fail")
		}

		children, appErr := th.App.GetPageChildren(th.Context, parentPage.Id, model.GetPostsOptions{})
		require.Nil(t, appErr)
		assert.Len(t, children.Posts, 2)

		updatedChild1, appErr := th.App.GetPageWithContent(th.Context, child1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, parentPage.Id, updatedChild1.PageParentId)

		updatedChild2, appErr := th.App.GetPageWithContent(th.Context, child2.Id)
		require.Nil(t, appErr)
		assert.Equal(t, parentPage.Id, updatedChild2.PageParentId)
	})

	t.Run("prevent circular references during concurrent moves", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser.Id

		parent1PageId := model.NewId()
		parent1Content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Parent 1"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, parent1PageId, parent1Content, "Parent 1", 0, nil)
		require.Nil(t, appErr)
		parent1, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId: wiki.Id,
			PageId: parent1PageId,
			Title:  "Parent 1",
		})
		require.Nil(t, appErr)

		parent2PageId := model.NewId()
		parent2Content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Parent 2"}]}]}`
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, parent2PageId, parent2Content, "Parent 2", 0, nil)
		require.Nil(t, appErr)
		parent2, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId:   wiki.Id,
			PageId:   parent2PageId,
			ParentId: parent1.Id,
			Title:    "Parent 2",
		})
		require.Nil(t, appErr)

		err1 := th.App.ChangePageParent(th.Context, parent1.Id, parent2.Id)
		require.NotNil(t, err1)
		assert.Contains(t, err1.Id, "circular_reference")
	})
}

func TestPagePermissionsMultiUser(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

	privateChannel := th.CreatePrivateChannel(t)
	th.AddUserToChannel(t, th.BasicUser, privateChannel)
	th.Context.Session().UserId = th.BasicUser.Id

	privateWiki := &model.Wiki{
		ChannelId:   privateChannel.Id,
		Title:       "Private Wiki",
		Description: "Private channel wiki",
	}
	privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	pageId := model.NewId()
	draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Private page"}]}]}`
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, privateWiki.Id, pageId, draftContent, "Private Page", 0, nil)
	require.Nil(t, appErr)

	privatePage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
		WikiId: privateWiki.Id,
		PageId: pageId,
		Title:  "Private Page",
	})
	require.Nil(t, appErr)

	t.Run("user2 cannot access private channel page", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser2.Id

		_, appErr := th.App.GetPageWithContent(th.Context, privatePage.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.context.permissions.app_error", appErr.Id)
	})

	t.Run("user2 can access after being added to private channel", func(t *testing.T) {
		th.AddUserToChannel(t, th.BasicUser2, privateChannel)

		th.Context.Session().UserId = th.BasicUser2.Id
		retrievedPage, appErr := th.App.GetPageWithContent(th.Context, privatePage.Id)
		require.Nil(t, appErr)
		assert.Equal(t, privatePage.Id, retrievedPage.Id)
	})

	t.Run("user2 loses access after being removed from private channel", func(t *testing.T) {
		appErr := th.App.RemoveUserFromChannel(th.Context, th.BasicUser2.Id, th.BasicUser.Id, privateChannel)
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser2.Id
		_, appErr = th.App.GetPageWithContent(th.Context, privatePage.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.context.permissions.app_error", appErr.Id)
	})
}

func TestPublishPageDraft_OptimisticLocking_Success(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki",
		Description: "Test wiki for optimistic locking",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	pageId := model.NewId()
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, pageId, validContent, "Original Title", 0, nil)
	require.Nil(t, appErr)

	createdPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
		WikiId:  wiki.Id,
		PageId:  pageId,
		Title:   "Original Title",
		Content: validContent,
	})
	require.Nil(t, appErr)
	baseEditAt := createdPage.EditAt

	newContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content"}]}]}`
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, pageId, newContent, "Updated Title", createdPage.EditAt, nil)
	require.Nil(t, appErr)

	updatedPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
		WikiId:     wiki.Id,
		PageId:     pageId,
		Title:      "Updated Title",
		Content:    newContent,
		BaseEditAt: baseEditAt,
	})

	require.Nil(t, appErr)
	require.NotNil(t, updatedPage)
	require.Equal(t, "Updated Title", updatedPage.Props["title"])
	require.Greater(t, updatedPage.EditAt, baseEditAt)
}

func TestPublishPageDraft_OptimisticLocking_Returns409(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki",
		Description: "Test wiki for optimistic locking conflict",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	pageId := model.NewId()
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, pageId, validContent, "Original Title", 0, nil)
	require.Nil(t, appErr)

	createdPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
		WikiId:  wiki.Id,
		PageId:  pageId,
		Title:   "Original Title",
		Content: validContent,
	})
	require.Nil(t, appErr)

	// With unified page ID model, use the actual created page ID for subsequent operations
	actualPageId := createdPage.Id

	// First update to establish a non-zero EditAt (newly published pages have EditAt=0)
	firstUpdateContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First update content"}]}]}`
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, actualPageId, firstUpdateContent, "First Update Title", createdPage.EditAt, nil)
	require.Nil(t, appErr)

	firstUpdate, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
		WikiId:     wiki.Id,
		PageId:     actualPageId,
		Title:      "First Update Title",
		Content:    firstUpdateContent,
		BaseEditAt: 0, // No conflict check for first edit
	})
	require.Nil(t, appErr)
	require.Greater(t, firstUpdate.EditAt, int64(0), "After first update, EditAt should be non-zero")

	// Both users start editing with the same baseline EditAt
	baseEditAt := firstUpdate.EditAt

	content1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 1 content"}]}]}`
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, actualPageId, content1, "User 1 Title", firstUpdate.EditAt, nil)
	require.Nil(t, appErr)

	updated1, appErr1 := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
		WikiId:     wiki.Id,
		PageId:     actualPageId,
		Title:      "User 1 Title",
		Content:    content1,
		BaseEditAt: baseEditAt,
	})
	require.Nil(t, appErr1)
	require.Greater(t, updated1.EditAt, baseEditAt)

	// User 2 tries to publish with the stale baseline - should get conflict
	// Note: In the unified page model, User 2 would create their own draft for the same page
	content2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 2 content"}]}]}`
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, actualPageId, content2, "User 2 Title", baseEditAt, nil)
	require.Nil(t, appErr)

	_, appErr2 := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
		WikiId:     wiki.Id,
		PageId:     actualPageId,
		Title:      "User 2 Title",
		Content:    content2,
		BaseEditAt: baseEditAt,
	})

	require.NotNil(t, appErr2)
	require.Equal(t, "app.page.update.conflict.app_error", appErr2.Id)
	require.Equal(t, 409, appErr2.StatusCode)
	require.Contains(t, appErr2.DetailedError, "modified_by=")
	require.Contains(t, appErr2.DetailedError, "edit_at=")
}

func TestPublishPageDraft_WrongBaseEditAtReturns409(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki",
		Description: "Test wiki for wrong baseEditAt",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	pageId := model.NewId()
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, pageId, validContent, "Original Title", 0, nil)
	require.Nil(t, appErr)

	createdPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
		WikiId:  wiki.Id,
		PageId:  pageId,
		Title:   "Original Title",
		Content: validContent,
	})
	require.Nil(t, appErr)

	newContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content"}]}]}`
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, pageId, newContent, "Updated Title", createdPage.EditAt, nil)
	require.Nil(t, appErr)

	_, appErr = th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
		WikiId:     wiki.Id,
		PageId:     pageId,
		Title:      "Updated Title",
		Content:    newContent,
		BaseEditAt: 1,
	})

	require.NotNil(t, appErr)
	require.Equal(t, "app.page.update.conflict.app_error", appErr.Id)
	require.Equal(t, 409, appErr.StatusCode)
}
