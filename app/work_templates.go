// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"regexp"
	"strings"

	pbclient "github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/app/worktemplates"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

func (a *App) GetWorkTemplateCategories(t i18n.TranslateFunc) ([]*model.WorkTemplateCategory, *model.AppError) {
	categories, err := worktemplates.ListCategories()
	if err != nil {
		return nil, model.NewAppError("GetWorkTemplateCategories", "app.worktemplates.get_categories.app_error", nil, err.Error(), http.StatusInternalServerError)
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
		return nil, model.NewAppError("GetWorkTemplates", "app.worktemplates.get_templates.app_error", nil, err.Error(), http.StatusInternalServerError)
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

func (a *App) ExecuteWorkTemplate(c *request.Context, wtcr *WorkTemplateExecutionRequest) (*WorkTemplateExecutionResult, *model.AppError) {
	e := &appWorkTemplateExecutor{app: a}
	return a.executeWorkTemplate(
		c,
		wtcr,
		e,
	)
}

func (a *App) executeWorkTemplate(
	c *request.Context,
	wtcr *WorkTemplateExecutionRequest,
	e workTemplateExecutor,
) (*WorkTemplateExecutionResult, *model.AppError) {
	res := &WorkTemplateExecutionResult{
		ChannelWithPlaybookIDs: []string{},
		ChannelIDs:             []string{},
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
	for _, pbContent := range contentByType["playbook"] {
		cPlaybook := pbContent.Playbook
		channelID, appErr := e.CreatePlaybook(c, wtcr, cPlaybook, contentByType["channel"])
		if appErr != nil {
			return res, appErr
		}

		if firstChannelId == "" {
			firstChannelId = channelID
		}
		res.ChannelWithPlaybookIDs = append(res.ChannelWithPlaybookIDs, channelID)
	}

	// loop through all channels
	for _, channelContent := range contentByType["channel"] {
		cChannel := channelContent.Channel
		// we only need to create a channel if there's no playbook
		if cChannel.Playbook == "" {
			chanID, appErr := e.CreateChannel(c, wtcr, cChannel)
			if appErr != nil {
				return res, appErr
			}

			if firstChannelId == "" {
				firstChannelId = chanID
			}
			res.ChannelIDs = append(res.ChannelIDs, chanID)
		}
	}

	for _, boardContent := range contentByType["board"] {
		cBoard := boardContent.Board
		_, appErr := e.CreateBoard(c, wtcr, cBoard, "TODO")
		if appErr != nil {
			return res, appErr
		}
	}

	for _, integrationContent := range contentByType["integration"] {
		cIntegration := integrationContent.Integration
		// this can take a long time so we just start those as background tasks
		go e.InstallPlugin(c, wtcr, cIntegration, firstChannelId)
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

type WorkTemplateExecutionRequest struct {
	TeamID            string             `json:"team_id"`
	Name              string             `json:"name"`
	Visibility        string             `json:"visibility"`
	WorkTemplate      model.WorkTemplate `json:"work_template"`
	PlaybookTemplates []playbookTemplate `json:"playbook_templates"`
}

type playbookTemplate struct {
	Title    string                         `json:"title"`
	Template pbclient.PlaybookCreateOptions `json:"template"`
}

type playbookCreateResponse struct {
	ID string `json:"id"`
}

type playbookRunCreateResponse struct {
	ID        string `json:"id"`
	ChannelID string `json:"channel_id"`
}

var allNonSpaceNonWordRegex = regexp.MustCompile(`[^\w\s]`)

func cleanChannelName(channelName string) string {
	// Lower case only
	channelName = strings.ToLower(channelName)
	// Trim spaces
	channelName = strings.TrimSpace(channelName)
	// Change all dashes to whitespace, remove everything that's not a word or whitespace, all space becomes dashes
	channelName = strings.ReplaceAll(channelName, "-", " ")
	channelName = allNonSpaceNonWordRegex.ReplaceAllString(channelName, "")
	channelName = strings.ReplaceAll(channelName, " ", "-")
	// Remove all leading and trailing dashes
	channelName = strings.Trim(channelName, "-")

	return channelName
}
