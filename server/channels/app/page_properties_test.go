// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestEnrichPageWithProperties(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		Title:       "Test Wiki",
		Description: "Test description",
	}

	createdWiki, wikiErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, wikiErr)
	require.NotNil(t, createdWiki)

	t.Run("enriches page with status property", func(t *testing.T) {
		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Status Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)

		setErr := th.App.SetPageStatus(th.Context, page, model.PageStatusInProgress)
		require.Nil(t, setErr)

		th.App.EnrichPageWithProperties(th.Context, page)

		props := page.GetProps()
		require.Equal(t, model.PageStatusInProgress, props[model.PagePropsPageStatus])
	})

	t.Run("handles page without properties set", func(t *testing.T) {
		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "No Props Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)

		th.App.EnrichPageWithProperties(th.Context, page)

		props := page.GetProps()
		require.Equal(t, model.PageStatusInProgress, props[model.PagePropsPageStatus], "should default to InProgress when no status is set")
	})

	t.Run("does not enrich non-page posts", func(t *testing.T) {
		regularPost, _, postErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, postErr)

		th.App.EnrichPageWithProperties(th.Context, regularPost)

		props := regularPost.GetProps()
		_, hasStatus := props[model.PagePropsPageStatus]
		require.False(t, hasStatus, "non-page posts should not be enriched with status")
	})
}

func TestEnrichPagesWithProperties(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		Title:       "Test Wiki",
		Description: "Test description",
	}

	createdWiki, wikiErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, wikiErr)
	require.NotNil(t, createdWiki)

	t.Run("enriches multiple pages", func(t *testing.T) {
		page1, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page One", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page2, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page Two", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		setErr := th.App.SetPageStatus(th.Context, page1, model.PageStatusInProgress)
		require.Nil(t, setErr)

		postList := &model.PostList{
			Posts: map[string]*model.Post{
				page1.Id: page1,
				page2.Id: page2,
			},
			Order: []string{page1.Id, page2.Id},
		}

		th.App.EnrichPagesWithProperties(th.Context, postList)

		props1 := page1.GetProps()
		require.Equal(t, model.PageStatusInProgress, props1[model.PagePropsPageStatus])

		props2 := page2.GetProps()
		require.Equal(t, model.PageStatusInProgress, props2[model.PagePropsPageStatus], "should default to InProgress")
	})

	t.Run("handles empty post list", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{},
			Order: []string{},
		}

		th.App.EnrichPagesWithProperties(th.Context, postList)
	})

	t.Run("handles nil post list", func(t *testing.T) {
		th.App.EnrichPagesWithProperties(th.Context, nil)
	})

	t.Run("skips non-page posts in mixed list", func(t *testing.T) {
		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Mixed List Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		regularPost, _, postErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, postErr)

		postList := &model.PostList{
			Posts: map[string]*model.Post{
				page.Id:        page,
				regularPost.Id: regularPost,
			},
			Order: []string{page.Id, regularPost.Id},
		}

		th.App.EnrichPagesWithProperties(th.Context, postList)

		pageProps := page.GetProps()
		require.Equal(t, model.PageStatusInProgress, pageProps[model.PagePropsPageStatus])

		regularProps := regularPost.GetProps()
		_, hasStatus := regularProps[model.PagePropsPageStatus]
		require.False(t, hasStatus, "regular post should not get page status")
	})
}

func TestGetPagePropertyFieldByName(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	t.Run("retrieves status field", func(t *testing.T) {
		field, err := th.App.GetPagePropertyFieldByName("status")
		require.Nil(t, err)
		require.NotNil(t, field)
		require.Equal(t, "status", field.Name)
	})

	t.Run("status field has correct ObjectType and Protected", func(t *testing.T) {
		field, err := th.App.GetPagePropertyFieldByName("status")
		require.Nil(t, err)
		require.NotNil(t, field)
		require.Equal(t, model.PropertyFieldObjectTypePost, field.ObjectType, "status field must target post objects for Property System v2 filtering")
		require.True(t, field.Protected, "status field must be protected to prevent deletion via the generic property API")
	})

	t.Run("retrieves wiki field", func(t *testing.T) {
		field, err := th.App.GetPagePropertyFieldByName("wiki")
		require.Nil(t, err)
		require.NotNil(t, field)
		require.Equal(t, "wiki", field.Name)
	})

	t.Run("wiki field has correct ObjectType and Protected", func(t *testing.T) {
		field, err := th.App.GetPagePropertyFieldByName("wiki")
		require.Nil(t, err)
		require.NotNil(t, field)
		require.Equal(t, model.PropertyFieldObjectTypePost, field.ObjectType, "wiki field must target post objects for Property System v2 filtering")
		require.True(t, field.Protected, "wiki field must be protected to prevent deletion via the generic property API")
	})

	t.Run("returns error for nonexistent field", func(t *testing.T) {
		field, err := th.App.GetPagePropertyFieldByName("nonexistent_field")
		require.NotNil(t, err)
		require.Nil(t, field)
		require.Equal(t, "app.page.get_field.app_error", err.Id)
	})
}
