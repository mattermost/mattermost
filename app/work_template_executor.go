// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	fb_model "github.com/mattermost/focalboard/server/model"
	pbclient "github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/app/worktemplates"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

type WorkTemplateExecutor interface {
	CreatePlaybook(c *request.Context, wtcr *worktemplates.ExecutionRequest, playbook *model.WorkTemplatePlaybook, channel model.WorkTemplateChannel) (string, *model.AppError)
	CreateChannel(c *request.Context, wtcr *worktemplates.ExecutionRequest, cChannel *model.WorkTemplateChannel) (string, *model.AppError)
	CreateBoard(c *request.Context, wtcr *worktemplates.ExecutionRequest, cBoard *model.WorkTemplateBoard, linkToChannelID string) (string, *model.AppError)
	InstallPlugin(c *request.Context, wtcr *worktemplates.ExecutionRequest, cIntegration *model.WorkTemplateIntegration, sendToChannelID string) *model.AppError
}

type appWorkTemplateExecutor struct {
	app *App
}

func (e *appWorkTemplateExecutor) CreatePlaybook(
	c *request.Context,
	wtcr *worktemplates.ExecutionRequest,
	playbook *model.WorkTemplatePlaybook,
	channel model.WorkTemplateChannel) (string, *model.AppError) {
	// determine playbook name
	name := playbook.Name
	if wtcr.Name != "" {
		name = fmt.Sprintf("%s: %s", wtcr.Name, playbook.Name)
	}

	// get the correct playbook pbTemplate
	pbTemplate, err := wtcr.FindPlaybookTemplate(playbook.Template)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create_playbook_template_not_found.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	pbTemplate.TeamID = wtcr.TeamID
	pbTemplate.Title = name
	pbTemplate.Public = wtcr.Visibility == model.WorkTemplateVisibilityPublic
	data, err := json.Marshal(pbTemplate)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create_playbook_template_not_found.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	resp, appErr := e.app.doPluginRequest(c, http.MethodPost, "/plugins/playbooks/api/v0/playbooks", nil, data)
	if appErr != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}
	defer resp.Body.Close()

	pbcResp := playbookCreateResponse{}
	err = json.NewDecoder(resp.Body).Decode(&pbcResp)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	runName := channel.Name
	if wtcr.Name != "" {
		runName = fmt.Sprintf("%s: %s", wtcr.Name, channel.Name)
	}
	data, err = json.Marshal(pbclient.PlaybookRunCreateOptions{
		Name:        runName,
		OwnerUserID: c.Session().UserId,
		TeamID:      wtcr.TeamID,
		PlaybookID:  pbcResp.ID,
	})
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create_playbook_run.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	resp, appErr = e.app.doPluginRequest(c, http.MethodPost, "/plugins/playbooks/api/v0/runs", nil, data)
	if appErr != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	defer resp.Body.Close()
	pbrResp := playbookRunCreateResponse{}
	err = json.NewDecoder(resp.Body).Decode(&pbrResp)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// using pbrResp.ChannelID, update the channel to add metadata
	dbChannel, err := e.app.Srv().Store().Channel().Get(pbrResp.ChannelID, false)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if dbChannel == nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "channel not found", http.StatusInternalServerError)
	}
	dbChannel.AddProp(model.WorkTemplateIDChannelProp, wtcr.WorkTemplate.ID)
	_, err = e.app.Srv().Store().Channel().Update(dbChannel)
	if err != nil {
		e.app.Srv().Log().Error("Failed to update playbook channel metadata", mlog.Err(err))
	}

	return pbrResp.ChannelID, nil
}

func (e *appWorkTemplateExecutor) CreateChannel(
	c *request.Context,
	wtcr *worktemplates.ExecutionRequest,
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
			Props: map[string]any{
				model.WorkTemplateIDChannelProp: wtcr.WorkTemplate.ID,
			},
		}, c.Session().UserId)
		channelID = newChan.Id
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
		}
	}

	return channelID, nil
}

func (e *appWorkTemplateExecutor) CreateBoard(
	c *request.Context,
	wtcr *worktemplates.ExecutionRequest,
	cBoard *model.WorkTemplateBoard,
	linkToChannelID string,
) (string, *model.AppError) {
	boardService := e.app.Srv().services[product.BoardsKey].(product.BoardsService)
	templates, err := boardService.GetTemplates("0", c.Session().UserId)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var template *fb_model.Board = nil
	for _, t := range templates {
		v, ok := t.Properties["trackingTemplateId"]
		if ok && v == cBoard.Template {
			template = t
			break
		}
	}
	if template == nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "template not found", http.StatusInternalServerError)
	}

	title := cBoard.Name
	if wtcr.Name != "" {
		title = fmt.Sprintf("%s: %s", wtcr.Name, cBoard.Name)
	}

	// Duplicate board From template
	boardsAndBlocks, _, err := boardService.DuplicateBoard(template.ID, c.Session().UserId, wtcr.TeamID, false)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if len(boardsAndBlocks.Boards) != 1 {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "template not found", http.StatusInternalServerError)
	}

	// Apply patch for the title and linked channel
	_, err = boardService.PatchBoard(&fb_model.BoardPatch{
		Title:     &title,
		ChannelID: &linkToChannelID,
	}, boardsAndBlocks.Boards[0].ID, c.Session().UserId)
	if err != nil {
		return "", model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return boardsAndBlocks.Boards[0].ID, nil
}

func (e *appWorkTemplateExecutor) InstallPlugin(
	c *request.Context,
	wtcr *worktemplates.ExecutionRequest,
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
		return model.NewAppError("ExecuteWorkTemplate", "app.worktemplates.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
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
