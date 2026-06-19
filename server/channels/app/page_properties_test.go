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

		setErr := th.App.SetPageStatus(th.Context, page.Id, model.PageStatusInProgress)
		require.Nil(t, setErr)

		th.App.EnrichPageWithProperties(th.Context, page)

		require.Equal(t, model.PageStatusInProgress, page.Properties[model.PagePropsPageStatus])
	})

	t.Run("handles page without properties set", func(t *testing.T) {
		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "No Props Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)

		th.App.EnrichPageWithProperties(th.Context, page)

		require.Equal(t, "", page.Properties[model.PagePropsPageStatus], "should default to empty string when no status is set")
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

		setErr := th.App.SetPageStatus(th.Context, page1.Id, model.PageStatusInProgress)
		require.Nil(t, setErr)

		pages := []*model.Page{page1, page2}
		th.App.EnrichPagesWithProperties(th.Context, pages)

		require.Equal(t, model.PageStatusInProgress, page1.Properties[model.PagePropsPageStatus])
		require.Equal(t, "", page2.Properties[model.PagePropsPageStatus], "should default to empty string when no status is set")
	})

	t.Run("handles empty page slice", func(t *testing.T) {
		th.App.EnrichPagesWithProperties(th.Context, []*model.Page{})
	})

	t.Run("handles nil page slice", func(t *testing.T) {
		th.App.EnrichPagesWithProperties(th.Context, nil)
	})

	t.Run("enriches pages in a mixed slice", func(t *testing.T) {
		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Mixed List Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		pages := []*model.Page{page}
		th.App.EnrichPagesWithProperties(th.Context, pages)

		require.Equal(t, "", page.Properties[model.PagePropsPageStatus])
	})
}

func TestPatchPageProps(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{Title: "Props Wiki"}
	createdWiki, wikiErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, wikiErr)

	page, pageErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Translation Page", "", th.BasicUser.Id, "", "")
	require.Nil(t, pageErr)

	t.Run("sets allowlisted translation props and drops non-allowlisted keys", func(t *testing.T) {
		sourceId := model.NewId()
		updated, err := th.App.PatchPageProps(th.Context, page, map[string]any{
			model.PostPropsPageTranslatedFrom:      sourceId,
			model.PostPropsPageTranslationLanguage: "fr",
			"arbitrary_key":                        "dropped",
		}, nil)
		require.Nil(t, err)
		require.Equal(t, sourceId, updated.Properties[model.PostPropsPageTranslatedFrom])
		require.Equal(t, "fr", updated.Properties[model.PostPropsPageTranslationLanguage])
		_, hasArbitrary := updated.Properties["arbitrary_key"]
		require.False(t, hasArbitrary, "non-allowlisted keys must be dropped")

		// The allowlisted keys are persisted in the page's Props blob.
		require.Equal(t, "fr", updated.Props[model.PostPropsPageTranslationLanguage])
		_, persistedArbitrary := updated.Props["arbitrary_key"]
		require.False(t, persistedArbitrary)
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
		require.Equal(t, model.PropertyFieldObjectTypePage, field.ObjectType, "status field must target page objects for Property System v2 filtering")
		require.True(t, field.Protected, "status field must be protected to prevent deletion via the generic property API")
	})

	t.Run("returns error for nonexistent field", func(t *testing.T) {
		field, err := th.App.GetPagePropertyFieldByName("nonexistent_field")
		require.NotNil(t, err)
		require.Nil(t, field)
		require.Equal(t, "app.page.get_field.app_error", err.Id)
	})
}
