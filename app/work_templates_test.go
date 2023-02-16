// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app/mocks"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/app/worktemplates"
	"github.com/mattermost/mattermost-server/v6/model"

	pbclient "github.com/mattermost/mattermost-plugin-playbooks/client"
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

func TestExecuteWorkTemplate(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	c := request.EmptyContext(th.App.Log())
	c.SetSession(&model.Session{UserId: model.NewId()})

	req := &worktemplates.ExecutionRequest{
		TeamID: "team-1",
		Name:   "test",
		WorkTemplate: model.WorkTemplate{
			ID: "test-template",
			Content: []model.WorkTemplateContent{
				{
					Playbook: &model.WorkTemplatePlaybook{
						Name:     "test playbook",
						Template: "test template pb",
						ID:       "test-playbook",
					},
				},
				{
					Channel: &model.WorkTemplateChannel{
						// this will not create a channel directly
						// playbooks will do it
						Name:     "test channel",
						Playbook: "test-playbook",
					},
				},
				{
					Channel: &model.WorkTemplateChannel{
						Name: "test channel 2 that will be created",
						ID:   "channel-2",
					},
				},
				{
					Board: &model.WorkTemplateBoard{
						Name:     "test board",
						Template: "test template board",
						Channel:  "channel-2",
					},
				},
				{
					Board: &model.WorkTemplateBoard{
						Name:     "test board with no channel linked",
						Template: "test template board",
					},
				},
				{
					Integration: &model.WorkTemplateIntegration{
						ID: "test-plugin",
					},
				},
			},
		},
		PlaybookTemplates: []*worktemplates.PlaybookTemplate{
			{
				Title: "test template pb",
				Template: pbclient.PlaybookCreateOptions{
					Title: "test playbook",
				},
			},
		},
	}
	t.Run("with install plugin enabled", func(t *testing.T) {
		executorMock := &mocks.WorkTemplateExecutor{}
		executorMock.On("CreatePlaybook", c, req, req.WorkTemplate.Content[0].Playbook, *req.WorkTemplate.Content[1].Channel).Return("channel-1", nil)
		executorMock.On("CreateChannel", c, req, req.WorkTemplate.Content[2].Channel).Return("channel-2", nil)
		executorMock.On("CreateBoard", c, req, req.WorkTemplate.Content[3].Board, "channel-2").Return("", nil)
		executorMock.On("CreateBoard", c, req, req.WorkTemplate.Content[4].Board, "").Return("", nil)
		executorMock.On("InstallPlugin", c, req, req.WorkTemplate.Content[5].Integration, "channel-1").Return(nil)

		res, appErr := th.App.executeWorkTemplate(c, req, executorMock, true)
		assert.Nil(t, appErr)
		assert.Equal(t, "channel-1", res.ChannelWithPlaybookIDs[0])
		assert.Equal(t, "channel-2", res.ChannelIDs[0])
		// give some time as plugin are called in a gorouting
		time.Sleep(100 * time.Millisecond)

		executorMock.AssertExpectations(t)
	})
	t.Run("with install plugin disabled", func(t *testing.T) {
		executorMock := &mocks.WorkTemplateExecutor{}
		executorMock.On("CreatePlaybook", c, req, req.WorkTemplate.Content[0].Playbook, *req.WorkTemplate.Content[1].Channel).Return("channel-1", nil)
		executorMock.On("CreateChannel", c, req, req.WorkTemplate.Content[2].Channel).Return("channel-2", nil)
		executorMock.On("CreateBoard", c, req, req.WorkTemplate.Content[3].Board, "channel-2").Return("", nil)
		executorMock.On("CreateBoard", c, req, req.WorkTemplate.Content[4].Board, "").Return("", nil)
		// the lack of call to InstallPlugin is the difference with the previous test

		res, appErr := th.App.executeWorkTemplate(c, req, executorMock, false)
		assert.Nil(t, appErr)
		assert.Equal(t, "channel-1", res.ChannelWithPlaybookIDs[0])
		assert.Equal(t, "channel-2", res.ChannelIDs[0])
		// give some time as plugin are called in a gorouting
		time.Sleep(100 * time.Millisecond)

		executorMock.AssertExpectations(t)
	})
	t.Run("with name too long", func(t *testing.T) {
		req.Name = strings.Repeat("a", model.ChannelNameMaxLength+1)
		_, appErr := th.App.executeWorkTemplate(c, req, nil, false)
		assert.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}
