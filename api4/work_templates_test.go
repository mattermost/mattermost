// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/app/worktemplates"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/web"
	"github.com/stretchr/testify/require"
)

func TestWorkTemplateCategories(t *testing.T) {
	assert := require.New(t)

	worktemplates.OrderedWorkTemplateCategories = []*worktemplates.WorkTemplateCategory{
		{
			ID:   "test-category",
			Name: "Test Category",
		},
		{
			ID:   "test-category-2",
			Name: "Test Category 2",
		},
	}

	appCtx := request.NewContext(context.Background(), "1234", "1.2.3.4", "/", "ua", "en", model.Session{}, func(translationID string, args ...any) string { return translationID })
	c := &web.Context{App: app.New(), AppContext: appCtx}
	recorder := httptest.NewRecorder()
	req := &http.Request{}

	getWorkTemplateCategories(c, recorder, req)

	categories := []model.WorkTemplateCategory{}
	err := json.NewDecoder(recorder.Body).Decode(&categories)
	require.NoError(t, err)
	require.Len(t, categories, 2)
	assert.Equal("test-category", categories[0].ID)
	assert.Equal("test-category-2", categories[1].ID)
}

func TestGetWorkTemplatesByCategory(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()
	assert := require.New(t)

	worktemplates.OrderedWorkTemplateCategories = []*worktemplates.WorkTemplateCategory{
		{
			ID:   "test-category",
			Name: "Test Category",
		},
		{
			ID:   "test-category-2",
			Name: "Test Category 2",
		},
	}

	worktemplates.OrderedWorkTemplates = []*worktemplates.WorkTemplate{
		{
			ID:       "test-template",
			Category: "test-category",
			UseCase:  "Test Template",
		},
		{
			ID:       "test-template-2",
			Category: "test-category",
			UseCase:  "Test Template 2",
		},
		{ // This one should not be returned because of the feature flag
			ID:       "test-template-3",
			Category: "test-category",
			UseCase:  "Test Template 3",
			FeatureFlag: &worktemplates.FeatureFlag{
				Name:  "random-nonexistant-feature-flag",
				Value: "true",
			},
		},
		{ // this one should not be returned because of the category
			ID:       "test-template-4",
			Category: "test-category-2",
			UseCase:  "Test Template 4",
		},
	}

	configStore := config.NewTestMemoryStore()
	memoryConfig := configStore.Get()
	memoryConfig.FeatureFlags = &model.FeatureFlags{}
	configStore.Set(memoryConfig)

	appCtx := request.NewContext(context.Background(), "1234", "1.2.3.4", "/", "ua", "en", model.Session{}, func(translationID string, args ...any) string { return translationID })
	c := &web.Context{App: th.App, AppContext: appCtx, Params: &web.Params{Category: "test-category"}}
	recorder := httptest.NewRecorder()
	req := &http.Request{}
	c.App.Config().FeatureFlags = &model.FeatureFlags{}

	getWorkTemplates(c, recorder, req)

	workTemplates := []model.WorkTemplate{}
	err := json.NewDecoder(recorder.Body).Decode(&workTemplates)
	assert.NoError(err, "error while retrieve worktemplates list")
	assert.Len(workTemplates, 2)
	assert.Equal("test-template", workTemplates[0].ID)
	assert.Equal("test-template-2", workTemplates[1].ID)
}
