// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/channels/app/request"
	"github.com/mattermost/mattermost-server/v6/channels/app/worktemplates"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/i18n"
)

func (a *App) GetWorkTemplateCategories(t i18n.TranslateFunc) ([]*model.WorkTemplateCategory, *model.AppError) {
	categories, err := worktemplates.ListCategories()
	if err != nil {
		return nil, model.NewAppError("GetWorkTemplateCategories", "app.worktemplates.get_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	modelCategories := make([]*model.WorkTemplateCategory, len(categories))
	for i := range categories {
		modelCategories[i] = &model.WorkTemplateCategory{
			ID:   categories[i].ID,
			Name: t(categories[i].Name),
		}
	}

	return modelCategories, nil
}

func (a *App) GetWorkTemplates(category string, featureFlags map[string]string, t i18n.TranslateFunc) ([]*model.WorkTemplate, *model.AppError) {
	templates, err := worktemplates.ListByCategory(category)
	if err != nil {
		return nil, model.NewAppError("GetWorkTemplates", "app.worktemplates.get_templates.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// filter out templates that are not enabled by feature Flag
	enabledTemplates := []*model.WorkTemplate{}
	for _, template := range templates {
		mTemplate := template.ToModelWorkTemplate(t)
		if template.FeatureFlag == nil {
			enabledTemplates = append(enabledTemplates, mTemplate)
			continue
		}

		if featureFlags[template.FeatureFlag.Name] == template.FeatureFlag.Value {
			enabledTemplates = append(enabledTemplates, mTemplate)
		}
	}

	return enabledTemplates, nil
}

func (a *App) ExecuteWorkTemplate(c *request.Context, wtcr *worktemplates.ExecutionRequest, installPlugins bool) (*WorkTemplateExecutionResult, *model.AppError) {
	e := &appWorkTemplateExecutor{app: a}
	return a.executeWorkTemplate(c, wtcr, e, installPlugins)
}

func (a *App) executeWorkTemplate(
	c *request.Context,
	wtcr *worktemplates.ExecutionRequest,
	e WorkTemplateExecutor,
	installPlugins bool,
) (*WorkTemplateExecutionResult, *model.AppError) {
	res := &WorkTemplateExecutionResult{
		ChannelWithPlaybookIDs: []string{},
		ChannelIDs:             []string{},
	}

	if wtcr.Name != "" {
		if len(wtcr.Name) > model.ChannelNameMaxLength {
			return res, model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.execute_work_template.name_too_long", nil, "", http.StatusBadRequest)
		}
	}

	contentByType := map[string][]model.WorkTemplateContent{
		"channel":     {},
		"board":       {},
		"playbook":    {},
		"integration": {},
	}
	for _, content := range wtcr.WorkTemplate.Content {
		if content.Channel != nil {
			contentByType["channel"] = append(contentByType["channel"], content)
		}
		if content.Board != nil {
			contentByType["board"] = append(contentByType["board"], content)
		}
		if content.Playbook != nil {
			contentByType["playbook"] = append(contentByType["playbook"], content)
		}
		if content.Integration != nil {
			contentByType["integration"] = append(contentByType["integration"], content)
		}
	}

	firstChannelId := ""
	channelIDByWorkTemplateID := map[string]string{}
	for _, pbContent := range contentByType["playbook"] {
		cPlaybook := pbContent.Playbook

		// find associated channel
		var associatedChannel *model.WorkTemplateChannel
		for _, channelContent := range contentByType["channel"] {
			if channelContent.Channel.Playbook == cPlaybook.ID {
				associatedChannel = channelContent.Channel
				break
			}
		}
		if associatedChannel == nil {
			return res, model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.execute_work_template.playbooks.find_channel_error", nil, "no associated channel found for playbook", http.StatusInternalServerError)
		}

		channelID, err := e.CreatePlaybook(c, wtcr, cPlaybook, *associatedChannel)
		if err != nil {
			return res, model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.execute_work_template.playbooks.create_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if firstChannelId == "" {
			firstChannelId = channelID
		}
		res.ChannelWithPlaybookIDs = append(res.ChannelWithPlaybookIDs, channelID)
		channelIDByWorkTemplateID[associatedChannel.ID] = channelID
	}

	// loop through all channels
	for _, channelContent := range contentByType["channel"] {
		cChannel := channelContent.Channel
		// we only need to create a channel if there's no playbook
		if cChannel.Playbook == "" {
			chanID, err := e.CreateChannel(c, wtcr, cChannel)
			if err != nil {
				return res, model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.execute_work_template.channels.create_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			if firstChannelId == "" {
				firstChannelId = chanID
			}
			res.ChannelIDs = append(res.ChannelIDs, chanID)
			channelIDByWorkTemplateID[cChannel.ID] = chanID
		}
	}

	for _, boardContent := range contentByType["board"] {
		cBoard := boardContent.Board
		channelID := ""
		if cBoard.Channel != "" {
			channel, ok := channelIDByWorkTemplateID[cBoard.Channel]
			if !ok {
				return res, model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.execute_work_template.app_error", nil, "no associated channel found for board", http.StatusInternalServerError)
			}
			channelID = channel
		}

		_, err := e.CreateBoard(c, wtcr, cBoard, channelID)
		if err != nil {
			return res, model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.execute_work_template.boards.create_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if installPlugins {
		for _, integrationContent := range contentByType["integration"] {
			cIntegration := integrationContent.Integration
			// this can take a long time so we just start those as background tasks
			go e.InstallPlugin(c, wtcr, cIntegration, firstChannelId)
		}
	}

	for _, ch := range res.ChannelWithPlaybookIDs {
		message := model.NewWebSocketEvent(model.WebsocketEventChannelCreated, "", "", c.Session().UserId, nil, "")
		message.Add("channel_id", ch)
		message.Add("team_id", wtcr.TeamID)
		a.Publish(message)
	}
	for _, ch := range res.ChannelIDs {
		message := model.NewWebSocketEvent(model.WebsocketEventChannelCreated, "", "", c.Session().UserId, nil, "")
		message.Add("channel_id", ch)
		message.Add("team_id", wtcr.TeamID)
		a.Publish(message)
	}

	return res, nil
}

type WorkTemplateExecutionResult struct {
	ChannelWithPlaybookIDs []string `json:"channel_with_playbook_ids"`
	ChannelIDs             []string `json:"channel_ids"`
}
