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

	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki",
		Description: "Integration test wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("page_published event broadcasted to channel on publish", func(t *testing.T) {
		wsClient, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		defer wsClient.Close()

		wsClient.Listen()

		draftId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test page content"}]}]}`

		_, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, draftId, draftContent)
		require.Nil(t, appErr)

		publishedPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, wiki.Id, draftId, "", "Test Page", "", "")
		require.Nil(t, appErr)

		timeout := time.After(3 * time.Second)
		eventReceived := false

		for !eventReceived {
			select {
			case event := <-wsClient.EventChannel:
				if event.EventType() == model.WebsocketEventPagePublished {
					eventReceived = true

					assert.Equal(t, th.BasicChannel.Id, event.GetBroadcast().ChannelId)
					assert.Equal(t, publishedPage.Id, event.GetData()["page_id"])
					assert.Equal(t, wiki.Id, event.GetData()["wiki_id"])
					assert.Equal(t, draftId, event.GetData()["draft_id"])
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
		user2 := th.CreateUser()
		client2 := th.CreateClient()
		_, _, err := client2.Login(context.Background(), user2.Email, user2.Password)
		require.NoError(t, err)

		wsClient2, err := th.CreateWebSocketClientWithClient(client2)
		require.NoError(t, err)
		defer wsClient2.Close()

		wsClient2.Listen()

		draftId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test page content"}]}]}`

		_, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, draftId, draftContent)
		require.Nil(t, appErr)

		_, appErr = th.App.PublishPageDraft(th.Context, th.BasicUser.Id, wiki.Id, draftId, "", "Test Page 2", "", "")
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

	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)

	th.LinkUserToTeam(th.BasicUser2, th.BasicTeam)
	th.AddUserToChannel(th.BasicUser2, th.BasicChannel)

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Shared Wiki",
		Description: "Multi-user test wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("two users can create separate pages simultaneously", func(t *testing.T) {
		draftId1 := model.NewId()
		draftId2 := model.NewId()

		draftContent1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 1 content"}]}]}`
		draftContent2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 2 content"}]}]}`

		_, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, draftId1, draftContent1)
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser2.Id
		_, appErr = th.App.SavePageDraft(th.Context, th.BasicUser2.Id, wiki.Id, draftId2, draftContent2)
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser.Id
		page1, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, wiki.Id, draftId1, "", "User 1 Page", "", "")
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser2.Id
		page2, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser2.Id, wiki.Id, draftId2, "", "User 2 Page", "", "")
		require.Nil(t, appErr)

		assert.NotEqual(t, page1.Id, page2.Id)
		assert.Equal(t, th.BasicUser.Id, page1.UserId)
		assert.Equal(t, th.BasicUser2.Id, page2.UserId)

		pages, appErr := th.App.GetWikiPages(th.Context, wiki.Id, 0, 10)
		require.Nil(t, appErr)
		require.Len(t, pages, 2)
	})

	t.Run("two users can create child pages under same parent", func(t *testing.T) {
		parentDraftId := model.NewId()
		parentContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Parent page"}]}]}`

		th.Context.Session().UserId = th.BasicUser.Id
		_, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, parentDraftId, parentContent)
		require.Nil(t, appErr)

		parentPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, wiki.Id, parentDraftId, "", "Parent Page", "", "")
		require.Nil(t, appErr)

		child1DraftId := model.NewId()
		child2DraftId := model.NewId()

		childContent1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Child 1 content"}]}]}`
		childContent2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Child 2 content"}]}]}`

		th.Context.Session().UserId = th.BasicUser.Id
		_, appErr = th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, child1DraftId, childContent1)
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser2.Id
		_, appErr = th.App.SavePageDraft(th.Context, th.BasicUser2.Id, wiki.Id, child2DraftId, childContent2)
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser.Id
		child1, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, wiki.Id, child1DraftId, parentPage.Id, "Child 1", "", "")
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser2.Id
		child2, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser2.Id, wiki.Id, child2DraftId, parentPage.Id, "Child 2", "", "")
		require.Nil(t, appErr)

		assert.Equal(t, parentPage.Id, child1.PageParentId)
		assert.Equal(t, parentPage.Id, child2.PageParentId)

		children, appErr := th.App.GetPageChildren(th.Context, parentPage.Id, model.GetPostsOptions{})
		require.Nil(t, appErr)
		require.Len(t, children.Posts, 2)
	})

	t.Run("user cannot edit another user's draft", func(t *testing.T) {
		draftId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 1 draft"}]}]}`

		th.Context.Session().UserId = th.BasicUser.Id
		draft, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, draftId, draftContent)
		require.Nil(t, appErr)
		require.Equal(t, th.BasicUser.Id, draft.UserId)

		th.Context.Session().UserId = th.BasicUser2.Id
		retrievedDraft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser2.Id, wiki.Id, draftId)
		require.NotNil(t, appErr)
		require.Nil(t, retrievedDraft)
		assert.Equal(t, "app.draft.get_page_draft.not_found", appErr.Id)
	})
}

func TestConcurrentPageHierarchyOperations(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Concurrent Test Wiki",
		Description: "Concurrent operations test",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("concurrent page moves do not corrupt hierarchy", func(t *testing.T) {
		parentDraftId := model.NewId()
		parentContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Parent"}]}]}`
		_, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, parentDraftId, parentContent)
		require.Nil(t, appErr)
		parentPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, wiki.Id, parentDraftId, "", "Parent", "", "")
		require.Nil(t, appErr)

		child1DraftId := model.NewId()
		child1Content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Child 1"}]}]}`
		_, appErr = th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, child1DraftId, child1Content)
		require.Nil(t, appErr)
		child1, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, wiki.Id, child1DraftId, "", "Child 1", "", "")
		require.Nil(t, appErr)

		child2DraftId := model.NewId()
		child2Content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Child 2"}]}]}`
		_, appErr = th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, child2DraftId, child2Content)
		require.Nil(t, appErr)
		child2, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, wiki.Id, child2DraftId, "", "Child 2", "", "")
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

		updatedChild1, appErr := th.App.GetPage(th.Context, child1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, parentPage.Id, updatedChild1.PageParentId)

		updatedChild2, appErr := th.App.GetPage(th.Context, child2.Id)
		require.Nil(t, appErr)
		assert.Equal(t, parentPage.Id, updatedChild2.PageParentId)
	})

	t.Run("prevent circular references during concurrent moves", func(t *testing.T) {
		parent1DraftId := model.NewId()
		parent1Content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Parent 1"}]}]}`
		_, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, parent1DraftId, parent1Content)
		require.Nil(t, appErr)
		parent1, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, wiki.Id, parent1DraftId, "", "Parent 1", "", "")
		require.Nil(t, appErr)

		parent2DraftId := model.NewId()
		parent2Content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Parent 2"}]}]}`
		_, appErr = th.App.SavePageDraft(th.Context, th.BasicUser.Id, wiki.Id, parent2DraftId, parent2Content)
		require.Nil(t, appErr)
		parent2, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, wiki.Id, parent2DraftId, parent1.Id, "Parent 2", "", "")
		require.Nil(t, appErr)

		err1 := th.App.ChangePageParent(th.Context, parent1.Id, parent2.Id)
		require.NotNil(t, err1)
		assert.Contains(t, err1.Id, "circular_reference")
	})
}

func TestPagePermissionsMultiUser(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreateWikiPrivateChannel.Id, model.ChannelUserRoleId)

	privateChannel := th.CreatePrivateChannel()
	th.AddUserToChannel(th.BasicUser, privateChannel)

	privateWiki := &model.Wiki{
		ChannelId:   privateChannel.Id,
		Title:       "Private Wiki",
		Description: "Private channel wiki",
	}
	privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	draftId := model.NewId()
	draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Private page"}]}]}`
	_, appErr = th.App.SavePageDraft(th.Context, th.BasicUser.Id, privateWiki.Id, draftId, draftContent)
	require.Nil(t, appErr)

	privatePage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, privateWiki.Id, draftId, "", "Private Page", "", "")
	require.Nil(t, appErr)

	t.Run("user2 cannot access private channel page", func(t *testing.T) {
		th.Context.Session().UserId = th.BasicUser2.Id

		_, appErr := th.App.GetPage(th.Context, privatePage.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.page.get_page.permissions.app_error", appErr.Id)
	})

	t.Run("user2 can access after being added to private channel", func(t *testing.T) {
		th.AddUserToChannel(th.BasicUser2, privateChannel)

		th.Context.Session().UserId = th.BasicUser2.Id
		retrievedPage, appErr := th.App.GetPage(th.Context, privatePage.Id)
		require.Nil(t, appErr)
		assert.Equal(t, privatePage.Id, retrievedPage.Id)
	})

	t.Run("user2 loses access after being removed from private channel", func(t *testing.T) {
		appErr := th.App.RemoveUserFromChannel(th.Context, th.BasicUser2.Id, th.BasicUser.Id, privateChannel)
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser2.Id
		_, appErr = th.App.GetPage(th.Context, privatePage.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.page.get_page.permissions.app_error", appErr.Id)
	})
}
