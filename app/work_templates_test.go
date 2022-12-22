// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app/worktemplates"
)

func TestGetWorkTemplateCategories(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()
	assert := require.New(t)

	worktemplates.OrderedWorkTemplateCategories = wtGetCategories()

	categories, appErr := th.App.GetWorkTemplateCategories(wtTranslationFunc)
	assert.Nil(appErr)
	assert.Len(categories, 2)
	assert.Equal("Translated test.1", categories[0].Name)
	assert.Equal("Translated test.2", categories[1].Name)
}

func TestGetWorkTemplatesByCategory(t *testing.T) {
	// Setup
	th := SetupWithStoreMock(t)
	defer th.TearDown()
	assert := require.New(t)

	existingFFkey := "test-feature-flag"
	existingFFvalue := "true"
	ff := map[string]string{
		existingFFkey: existingFFvalue,
	}

	worktemplates.OrderedWorkTemplateCategories = wtGetCategories()
	firstCat := worktemplates.OrderedWorkTemplateCategories[0]
	worktemplates.OrderedWorkTemplates = []*worktemplates.WorkTemplate{
		{
			ID:       "test-template",
			Category: firstCat.ID,
			UseCase:  "test use case",
			Description: worktemplates.Description{
				Channel: &worktemplates.TranslatableString{
					ID:             "test-template-channel-description",
					DefaultMessage: "test template channel description",
				},
			},
		},
		{ // this one should not be returned because of the FF
			ID:       "test-template-2",
			Category: firstCat.ID,
			UseCase:  "test use case 2",
			FeatureFlag: &worktemplates.FeatureFlag{
				Name:  "nonexistant-random-test-feature-flag",
				Value: "hi",
			},
			Description: worktemplates.Description{
				Channel: &worktemplates.TranslatableString{
					ID:             "test-template-2-channel-description",
					DefaultMessage: "test template 2 channel description",
				},
			},
		},
		{ // this one should be present and match the FF
			ID:       "test-template-3",
			Category: firstCat.ID,
			UseCase:  "test use case 3",
			FeatureFlag: &worktemplates.FeatureFlag{
				Name:  existingFFkey,
				Value: existingFFvalue,
			},
			Description: worktemplates.Description{
				Channel: &worktemplates.TranslatableString{
					ID:             "unknown", // simulating an unknown translation, we return the default message in this case
					DefaultMessage: "default message picked for unknown",
				},
			},
		},
		{ // this one should not be returned because of the category
			ID:       "test-template-4",
			Category: "cat-test2",
			UseCase:  "test use case 4",
		},
	}

	// Act
	worktemplates, appErr := th.App.GetWorkTemplates(firstCat.ID, ff, wtTranslationFunc)

	// Assert
	assert.Nil(appErr)
	assert.Len(worktemplates, 2)
	// assert the correct work templates have been returned
	assert.Equal("test-template", worktemplates[0].ID)
	assert.Equal("test-template-3", worktemplates[1].ID)
	// assert the descriptions have been translated
	assert.Equal("Translated test-template-channel-description", worktemplates[0].Description.Channel.Message)
	assert.Equal("default message picked for unknown", worktemplates[1].Description.Channel.Message)
}

// helpers
func wtTranslationFunc(id string, args ...interface{}) string {
	if id == "unknown" {
		return ""
	}

	return "Translated " + id
}

func wtGetCategories() []*worktemplates.WorkTemplateCategory {
	return []*worktemplates.WorkTemplateCategory{
		{
			ID:   "cat-test1",
			Name: "test.1",
		},
		{
			ID:   "cat-test2",
			Name: "test.2",
		},
	}
}
