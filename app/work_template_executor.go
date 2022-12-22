// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"

	pbclient "github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

type workTemplateExecutor interface {
	CreatePlaybook(c *request.Context, wtcr *WorkTemplateExecutionRequest, playbook *model.WorkTemplatePlaybook, channelsInRequest []model.WorkTemplateContent) (string, *model.AppError)
	CreateChannel(c *request.Context, wtcr *WorkTemplateExecutionRequest, cChannel *model.WorkTemplateChannel) (string, *model.AppError)
	CreateBoard(c *request.Context, wtcr *WorkTemplateExecutionRequest, cBoard *model.WorkTemplateBoard, linkToChannelID string) (string, *model.AppError)
	InstallPlugin(c *request.Context, wtcr *WorkTemplateExecutionRequest, cChannel *model.WorkTemplateIntegration, sendToChannelID string) *model.AppError
}

type appWorkTemplateExecutor struct {
	app *App
}

func (e *appWorkTemplateExecutor) CreatePlaybook(
	c *request.Context,
	wtcr *WorkTemplateExecutionRequest,
	playbook *model.WorkTemplatePlaybook,
	channelsInRequest []model.WorkTemplateContent) (string, *model.AppError) {
	// determine playbook name
	name := playbook.Name
	if wtcr.Name != "" {
		name = fmt.Sprintf("%s: %s", wtcr.Name, playbook.Name)
	}

	// get the correct playbook pbTemplate
	var pbTemplate *pbclient.PlaybookCreateOptions = nil
	for i := range wtcr.PlaybookTemplates {
		if wtcr.PlaybookTemplates[i].Title == playbook.Template {
			pbTemplate = &wtcr.PlaybookTemplates[i].Template
			break
		}
	}
	if pbTemplate == nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create_playbook_template_not_found.app_error", nil, "", http.StatusInternalServerError)
	}

	pbTemplate.TeamID = wtcr.TeamID
	pbTemplate.Title = name
	data, err := json.Marshal(pbTemplate)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create_playbook_template_not_found.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	resp, appErr := e.app.doPluginRequest(c, http.MethodPost, "/plugins/playbooks/api/v0/playbooks", nil, data)
	if appErr != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}
	defer resp.Body.Close()

	pbcResp := playbookCreateResponse{}
	err = json.NewDecoder(resp.Body).Decode(&pbcResp)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	runName := name
	for _, channelContent := range channelsInRequest {
		if channelContent.Channel.Playbook == playbook.ID {
			runName = channelContent.Channel.Name
			if wtcr.Name != "" {
				runName = fmt.Sprintf("%s: %s", wtcr.Name, channelContent.Channel.Name)
			}
			break
		}
	}
	data, err = json.Marshal(pbclient.PlaybookRunCreateOptions{
		Name:        runName,
		OwnerUserID: c.Session().UserId,
		TeamID:      wtcr.TeamID,
		PlaybookID:  pbcResp.ID,
	})
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create_playbook_run.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	resp, appErr = e.app.doPluginRequest(c, http.MethodPost, "/plugins/playbooks/api/v0/runs", nil, data)
	if appErr != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer resp.Body.Close()
	pbrResp := playbookRunCreateResponse{}
	err = json.NewDecoder(resp.Body).Decode(&pbrResp)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return pbrResp.ChannelID, nil
}

func (e *appWorkTemplateExecutor) CreateChannel(
	c *request.Context,
	wtcr *WorkTemplateExecutionRequest,
	cChannel *model.WorkTemplateChannel,
) (string, *model.AppError) {
	channelID := ""
	channelDisplayName := cChannel.Name
	if wtcr.Name != "" {
		channelDisplayName = fmt.Sprintf("%s: %s", wtcr.Name, cChannel.Name)
	}

	var channelCreationAppErr *model.AppError = &model.AppError{}
	cleanChannelName := cleanChannelName(channelDisplayName)
	channelName := cleanChannelName
	if len(channelName) > model.ChannelNameMaxLength {
		channelName = channelName[:model.ChannelNameMaxLength]
	}
	for channelCreationAppErr != nil {
		// create channel
		newChan, channelCreationAppErr := e.app.CreateChannelWithUser(c, &model.Channel{
			TeamId:      wtcr.TeamID,
			Name:        channelName,
			DisplayName: channelDisplayName,
			Type:        model.ChannelTypeOpen,
			Purpose:     cChannel.Purpose,
		}, c.Session().UserId)
		if channelCreationAppErr != nil {
			if channelCreationAppErr.Id == store.ChannelExistsError {
				// compute a new unique name
				suffix := fmt.Sprintf("-%s", model.NewId()[0:4])
				channelName = cleanChannelName
				if len(cleanChannelName)+len(suffix) > model.ChannelNameMaxLength {
					channelName = cleanChannelName[:model.ChannelNameMaxLength-len(suffix)]
				}
				channelName = channelName + suffix
				continue
			}

			return "", channelCreationAppErr
		} else {
			// the loop will break because the channelCreationAppErr is nil
			// se we can set our return value.
			// go compiler do not let us return directly from here
			channelID = newChan.Id
		}
	}

	return channelID, nil
}

func (e *appWorkTemplateExecutor) CreateBoard(
	c *request.Context,
	wtcr *WorkTemplateExecutionRequest,
	cBoard *model.WorkTemplateBoard,
	linkToChannelID string,
) (string, *model.AppError) {
	// @TODO
	e.app.Log().Debug("Skipping board as the product is not ready yet", mlog.String("board_name", wtcr.Name))
	return "", nil
}

func (e *appWorkTemplateExecutor) InstallPlugin(
	c *request.Context,
	wtcr *WorkTemplateExecutionRequest,
	cIntegration *model.WorkTemplateIntegration,
	sendToChannelID string,
) *model.AppError {
	// check if this plugin is already installed
	pluginID := cIntegration.ID
	_, appErr := e.app.GetPluginStatus(pluginID)
	if appErr != nil {
		if appErr.Id == "app.plugin.not_installed.app_error" {
			// we install them in the background as we don't want user to wait for this
			manifest, installAppErr := e.app.Channels().InstallMarketplacePlugin(&model.InstallMarketplacePluginRequest{
				Id:      pluginID,
				Version: "",
			})
			if installAppErr != nil {
				return installAppErr
			}
			if sendToChannelID != "" {
				// @TODO change message and make it translatable
				e.app.SendEphemeralPost(c, c.Session().UserId, &model.Post{
					ChannelId: sendToChannelID,
					Message:   fmt.Sprintf("plugin %s has been installed", manifest.Name),
					CreateAt:  model.GetMillis(),
				})
			}
		} else {
			return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}
	}

	// get plugin state
	if err := e.app.EnablePlugin(pluginID); err != nil {
		return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}
