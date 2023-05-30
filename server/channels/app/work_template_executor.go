// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost-server/server/public/plugin"
	pbclient "github.com/mattermost/mattermost-server/server/v8/playbooks/client"

	fb_model "github.com/mattermost/mattermost-server/server/v8/boards/model"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/worktemplates"
	"github.com/mattermost/mattermost-server/server/v8/channels/product"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
)

type WorkTemplateExecutor interface {
	CreatePlaybook(c *request.Context, wtcr *worktemplates.ExecutionRequest, playbook *model.WorkTemplatePlaybook, channel model.WorkTemplateChannel) (string, error)
	CreateChannel(c *request.Context, wtcr *worktemplates.ExecutionRequest, cChannel *model.WorkTemplateChannel) (string, error)
	CreateBoard(c *request.Context, wtcr *worktemplates.ExecutionRequest, cBoard *model.WorkTemplateBoard, linkToChannelID string) (string, error)
	InstallPlugin(c *request.Context, wtcr *worktemplates.ExecutionRequest, cIntegration *model.WorkTemplateIntegration, sendToChannelID string) error
}

type appWorkTemplateExecutor struct {
	app *App
}

func (e *appWorkTemplateExecutor) CreatePlaybook(
	c *request.Context,
	wtcr *worktemplates.ExecutionRequest,
	playbook *model.WorkTemplatePlaybook,
	channel model.WorkTemplateChannel) (string, error) {
	// determine playbook name
	name := playbook.Name
	if wtcr.Name != "" {
		name += " " + wtcr.Name
	}

	// get the correct playbook pbTemplate
	pbTemplate, err := wtcr.FindPlaybookTemplate(playbook.Template)
	if err != nil {
		return "", fmt.Errorf("unable to find playbook template: %w", err)
	}

	pbTemplate.TeamID = wtcr.TeamID
	pbTemplate.Title = name
	pbTemplate.Public = wtcr.Visibility == model.WorkTemplateVisibilityPublic
	pbTemplate.CreatePublicPlaybookRun = wtcr.Visibility == model.WorkTemplateVisibilityPublic
	data, err := json.Marshal(pbTemplate)
	if err != nil {
		return "", fmt.Errorf("unable to marshal playbook template: %w", err)
	}

	resp, appErr := e.app.doPluginRequest(c, http.MethodPost, "/plugins/playbooks/api/v0/playbooks", nil, data)
	if appErr != nil {
		return "", fmt.Errorf("unable to create playbook: %w", appErr)
	}
	defer resp.Body.Close()

	pbcResp := playbookCreateResponse{}
	err = json.NewDecoder(resp.Body).Decode(&pbcResp)
	if err != nil {
		return "", fmt.Errorf("unable to decode playbook create response: %w", err)
	}

	runName := channel.Name
	if wtcr.Name != "" {
		runName = wtcr.Name
	}
	data, err = json.Marshal(pbclient.PlaybookRunCreateOptions{
		Name:        runName,
		OwnerUserID: c.Session().UserId,
		TeamID:      wtcr.TeamID,
		PlaybookID:  pbcResp.ID,
	})
	if err != nil {
		return "", fmt.Errorf("unable to marshal playbook run create request: %w", err)
	}
	resp, appErr = e.app.doPluginRequest(c, http.MethodPost, "/plugins/playbooks/api/v0/runs", nil, data)
	if appErr != nil {
		return "", fmt.Errorf("unable to create playbook run: %w", appErr)
	}
	defer resp.Body.Close()
	pbrResp := playbookRunCreateResponse{}
	err = json.NewDecoder(resp.Body).Decode(&pbrResp)
	if err != nil {
		return "", fmt.Errorf("unable to decode playbook run create response: %w", err)
	}

	// using pbrResp.ChannelID, update the channel to add metadata
	dbChannel, err := e.app.Srv().Store().Channel().Get(pbrResp.ChannelID, false)
	if err != nil {
		return "", fmt.Errorf("unable to find channel: %w", err)
	}
	if dbChannel == nil {
		return "", fmt.Errorf("channel not found")
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
) (string, error) {
	channelID := ""
	channelDisplayName := cChannel.Name
	if wtcr.Name != "" {
		channelDisplayName = wtcr.Name
	}

	var channelCreationAppErr *model.AppError = &model.AppError{}
	cleanChannelName := cleanChannelName(channelDisplayName)
	channelName := cleanChannelName
	if len(channelName) > model.ChannelNameMaxLength {
		channelName = channelName[:model.ChannelNameMaxLength]
	}

	// Mostly because of the "quick use" feature, we might try to create channel that have the exact same "Name"
	// This loop ensures that if the original name is taken, we try again by adding a suffix to the Name
	for channelCreationAppErr != nil {
		// create channel
		var newChan *model.Channel
		newChan, channelCreationAppErr = e.app.CreateChannelWithUser(c, &model.Channel{
			TeamId:      wtcr.TeamID,
			Name:        channelName,
			DisplayName: channelDisplayName,
			Type:        model.ChannelTypeOpen,
			Purpose:     cChannel.Purpose,
			Props: map[string]any{
				model.WorkTemplateIDChannelProp: wtcr.WorkTemplate.ID,
			},
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

			return "", fmt.Errorf("error while creating channel: %w", channelCreationAppErr)
		}
		channelID = newChan.Id
	}

	return channelID, nil
}

func (e *appWorkTemplateExecutor) CreateBoard(
	c *request.Context,
	wtcr *worktemplates.ExecutionRequest,
	cBoard *model.WorkTemplateBoard,
	linkToChannelID string,
) (string, error) {
	boardService := e.app.Srv().services[product.BoardsKey].(product.BoardsService)
	templates, err := boardService.GetTemplates("0", c.Session().UserId)
	if err != nil {
		return "", fmt.Errorf("error while getting templates: %w", err)
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
		return "", fmt.Errorf("template not found")
	}

	title := cBoard.Name
	if wtcr.Name != "" {
		title += " " + wtcr.Name
	}

	// Duplicate board From template
	boardsAndBlocks, _, err := boardService.DuplicateBoard(template.ID, c.Session().UserId, wtcr.TeamID, false)
	if err != nil {
		return "", fmt.Errorf("failed to create new board from template: %w", err)
	}
	if len(boardsAndBlocks.Boards) != 1 {
		return "", fmt.Errorf("only one board was expected, found %d", len(boardsAndBlocks.Boards))
	}

	// Apply patch for the title and linked channel
	patchedBoard, err := boardService.PatchBoard(&fb_model.BoardPatch{
		Title:     &title,
		ChannelID: &linkToChannelID,
	}, boardsAndBlocks.Boards[0].ID, c.Session().UserId)
	if err != nil {
		return "", fmt.Errorf("failed to patch board: %w", err)
	}

	return patchedBoard.ID, nil
}

func (e *appWorkTemplateExecutor) InstallPlugin(
	c *request.Context,
	wtcr *worktemplates.ExecutionRequest,
	cIntegration *model.WorkTemplateIntegration,
	sendToChannelID string,
) error {
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
				return fmt.Errorf("unable to install plugin: %w", installAppErr)
			}
			if sendToChannelID != "" {
				e.app.SendEphemeralPost(c, c.Session().UserId, &model.Post{
					ChannelId: sendToChannelID,
					Message:   fmt.Sprintf("plugin %s has been installed", manifest.Name),
					CreateAt:  model.GetMillis(),
				})
			}
		} else {
			return fmt.Errorf("unable to get plugin status: %w", appErr)
		}
	}

	// get plugin state
	if err := e.app.EnablePlugin(pluginID); err != nil {
		return fmt.Errorf("unable to enable plugin: %w", err)
	}

	hooks, err := e.app.ch.HooksForPluginOrProduct(pluginID)
	if err != nil {
		mlog.Warn("Getting hooks for plugin failed", mlog.String("plugin_id", pluginID), mlog.Err(err))
		return nil
	}

	event := model.OnInstallEvent{
		UserId: c.Session().UserId,
	}

	if err = hooks.OnInstall(&plugin.Context{
		RequestId:      c.RequestId(),
		SessionId:      c.Session().Id,
		IPAddress:      c.IPAddress(),
		AcceptLanguage: c.AcceptLanguage(),
		UserAgent:      c.UserAgent(),
	}, event); err != nil {
		mlog.Error("Plugin OnInstall hook failed", mlog.String("plugin_id", pluginID), mlog.Err(err))
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

// cleaning channel name code bellow comes from the playbook repository.
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
