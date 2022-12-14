// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	bmodel "github.com/mattermost/focalboard/server/model"
	pbclient "github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/app/worktemplates"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
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

type WorkTemplateBoardsProduct interface {
	GetTemplateIDFromCustomField(customFieldID string) (string, error)
	CreateBoardFromTemplate(templateID string, teamID string, name string) (bmodel.Board, error)
	LinkBoardToChannel(boardID string, channelID string) error
}

func (a *App) ExecuteWorkTemplate(c *request.Context, wtcr *WorkTemplateCreationRequest) *model.AppError {
	// @TODO: dev - override team
	t, appErr := a.GetTeamByName("ad-1")
	if appErr != nil {
		return appErr
	}
	wtcr.TeamID = t.Id
	// end dev

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

	newChannelIds := []string{}
	channelsByID := map[string]string{}
	for _, pbContent := range contentByType["playbook"] {
		playbook := pbContent.Playbook

		name := playbook.Name
		if wtcr.Name != "" {
			name = fmt.Sprintf("%s: %s", wtcr.Name, playbook.Name)
		}

		// get the correct playbook template
		var template *playbookTemplate = nil
		for i := range wtcr.PlaybookTemplates {
			if wtcr.PlaybookTemplates[i].Title == playbook.Template {
				template = &wtcr.PlaybookTemplates[i]
				break
			}
		}
		if template == nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create_playbook_template_not_found.app_error", nil, "", http.StatusInternalServerError)
		}

		template.Template.TeamID = wtcr.TeamID
		template.Template.Title = name
		data, err := json.Marshal(template.Template)
		if err != nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create_playbook_template_not_found.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		resp, appErr := a.doPluginRequest(c, http.MethodPost, "/plugins/playbooks/api/v0/playbooks", nil, data)
		if appErr != nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}
		defer resp.Body.Close()
		pbcResp := playbookCreateResponse{}
		err = json.NewDecoder(resp.Body).Decode(&pbcResp)
		if err != nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		runName := name
		// find associated channel
		for _, channelContent := range contentByType["channel"] {
			if channelContent.Channel.Playbook == playbook.ID {
				runName = channelContent.Channel.Name
				if wtcr.Name != "" {
					runName = fmt.Sprintf("%s: %s", wtcr.Name, channelContent.Channel.Name)
				}

				if channelContent.Channel.ID != "" {
					channelsByID[channelContent.Channel.ID] = pbcResp.ID
				}
				break
			}
		}
		// create run

		run := pbclient.PlaybookRunCreateOptions{
			Name:        runName,
			OwnerUserID: c.Session().UserId,
			TeamID:      wtcr.TeamID,
			PlaybookID:  pbcResp.ID,
		}
		data, err = json.Marshal(run)
		if err != nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create_playbook_run.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		resp, appErr = a.doPluginRequest(c, http.MethodPost, "/plugins/playbooks/api/v0/runs", nil, data)
		if appErr != nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		defer resp.Body.Close()
		pbrResp := playbookRunCreateResponse{}
		err = json.NewDecoder(resp.Body).Decode(&pbrResp)
		if err != nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		c.Logger().Debug("adding channel to newChannelIds", mlog.String("channel_id", pbrResp.ChannelID))
		newChannelIds = append(newChannelIds, pbrResp.ChannelID)
	}

	// loop through all channels
	for _, channelContent := range contentByType["channel"] {
		contentnChannel := channelContent.Channel
		if contentnChannel.Playbook == "" {
			channelDisplayName := contentnChannel.Name
			if wtcr.Name != "" {
				channelDisplayName = fmt.Sprintf("%s: %s", wtcr.Name, contentnChannel.Name)
			}

			// The next block ensures that the channel creation does not fail
			// because the "Name" field (use in the URL) is already taken or too big.
			// Instead we trim it to the correct size, and if needed we append a random string to it
			// to ensure uniqueness.
			var ch *model.Channel
			// start with a dummy value to enter the retry loop
			var channelCreationAppErr *model.AppError = &model.AppError{}
			channelName := cleanChannelName(channelDisplayName)
			if len(channelName) > model.ChannelNameMaxLength {
				channelName = channelName[:model.ChannelNameMaxLength]
			}
			for channelCreationAppErr != nil {
				// create channel
				channelCreateRequest := &model.Channel{
					TeamId:      wtcr.TeamID,
					Name:        channelName,
					DisplayName: channelDisplayName,
					Type:        model.ChannelTypeOpen,
					Purpose:     contentnChannel.Purpose,
				}

				// We don't add this channel to newChannelIds because CreateChannelWithUser already send a websocket event
				ch, channelCreationAppErr = a.CreateChannelWithUser(c, channelCreateRequest, c.Session().UserId)
				if channelCreationAppErr != nil {
					if channelCreationAppErr.Id == store.ChannelExistsError {
						suffix := fmt.Sprintf("-%s", model.NewId()[0:4])
						if len(channelName)+len(suffix) > model.ChannelNameMaxLength {
							channelName = channelName[:model.ChannelNameMaxLength-len(suffix)]
						}

						channelName = channelName + suffix
						continue
					}

					return channelCreationAppErr
				}
			}
			if channelContent.Channel.ID != "" {
				channelsByID[channelContent.Channel.ID] = ch.Id
			}
		}
		// @TODO: add metadata to the channel about which work template has been used.
	}

	// tests with boards
	// loop through all boards
	a.Log().Debug("Skipping board as the product is not ready yet")
	for _, boardContent := range contentByType["board"] {
		contentBoard := boardContent.Board

		boardProduct, ok := a.Srv().products["boards"].(WorkTemplateBoardsProduct)
		if !ok {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "board product does not match interface", http.StatusInternalServerError)
		}
		if boardProduct == nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "boards product not found", http.StatusInternalServerError)
		}

		// Get templateID
		templateID, err := boardProduct.GetTemplateIDFromCustomField(contentBoard.Template)
		if err != nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		// CreateBoardFrom TemplateID
		board, err := boardProduct.CreateBoardFromTemplate(templateID, wtcr.TeamID, contentBoard.Name)
		if err != nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		// Link Board to channel if needed
		if contentBoard.Channel != "" {
			// Get channelID
			channelID := channelsByID[contentBoard.Channel]
			// Link board to channel
			boardProduct.LinkBoardToChannel(board.ID, channelID)
		}
	}

	for _, integrationContent := range contentByType["integration"] {
		contentIntegration := integrationContent.Integration

		// check if this plugin is already installed
		pluginID := contentIntegration.ID
		_, appErr := a.GetPluginStatus(pluginID)
		if appErr != nil {
			// plugin is not installed, add it to the list of plugin to install
			a.Log().Debug("Plugin not installed", mlog.String("plugin_id", pluginID))
			if appErr.Id == "app.plugin.not_installed.app_error" {
				c := a.Channels()
				a.Log().Debug(fmt.Sprintf("c = %#v", c))
				_, installAppErr := a.Channels().InstallMarketplacePlugin(&model.InstallMarketplacePluginRequest{
					Id:      pluginID,
					Version: "",
				})
				if installAppErr != nil {
					return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, appErr.Error(), http.StatusInternalServerError)
				}
			} else {
				return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, appErr.Error(), http.StatusInternalServerError)
			}
		}

		// get plugin state
		if err := a.EnablePlugin(pluginID); err != nil {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	for i := range newChannelIds {
		c.Logger().Debug("new channel id", mlog.String("channel_id", newChannelIds[i]))
		message := model.NewWebSocketEvent(model.WebsocketEventChannelCreated, "", "", c.Session().UserId, nil, "")
		message.Add("channel_id", newChannelIds[i])
		message.Add("team_id", wtcr.TeamID)
		a.Publish(message)
	}

	return nil
}

type WorkTemplateCreationRequest struct {
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
