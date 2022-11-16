// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v6/app/worktemplates"
	"github.com/stretchr/testify/require"
)

func TestWorkTemplateCategories(t *testing.T) {
	// Setup
	cleanup := setupWorktemplateFeatureFlag(t)
	defer cleanup()

	th := Setup(t).InitBasic()
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

	// Act
	categories, _, clientErr := th.Client.GetWorktemplateCategories()

	// Assert
	require.NoError(t, clientErr)
	require.Len(t, categories, 2)
	assert.Equal("test-category", categories[0].ID)
	assert.Equal("test-category-2", categories[1].ID)
}

func TestGetWorkTemplatesByCategory(t *testing.T) {
	// Setup
	cleanup := setupWorktemplateFeatureFlag(t)
	defer cleanup()

	th := Setup(t).InitBasic()
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

	// Act
	workTemplates, _, clientErr := th.Client.GetWorkTemplatesByCategory("test-category")

	// Assert
	assert.NoError(clientErr, "error while retrieve worktemplates list")
	assert.Len(workTemplates, 2)
	assert.Equal("test-template", workTemplates[0].ID)
	assert.Equal("test-template-2", workTemplates[1].ID)
}

func setupWorktemplateFeatureFlag(t *testing.T) func() {
	t.Helper()

	oldFFValue := os.Getenv("MM_FEATUREFLAGS_WORKTEMPLATE")
	os.Setenv("MM_FEATUREFLAGS_WORKTEMPLATE", "true")

	return func() {
		os.Setenv("MM_FEATUREFLAGS_WORKTEMPLATE", oldFFValue)
	}
}
