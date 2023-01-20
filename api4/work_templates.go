// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/worktemplates"
	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitWorkTemplate() {
	api.BaseRoutes.WorkTemplates.Handle("/categories", api.APISessionRequired(getWorkTemplateCategories)).Methods("GET")
	api.BaseRoutes.WorkTemplates.Handle("/categories/{category}/templates", api.APISessionRequired(getWorkTemplates)).Methods("GET")
	api.BaseRoutes.WorkTemplates.Handle("/execute", api.APIHandler(executeWorkTemplate)).Methods("POST")
}

func areWorkTemplatesEnabled(c *Context) *model.AppError {
	if !c.App.Config().FeatureFlags.WorkTemplate {
		return model.NewAppError("areWorkTemplatesEnabled", "api.work_templates.disabled", nil, "feature flag is off", http.StatusNotFound)
	}

	// we have to make sure that playbooks plugin is enabled and board is a product
	pbActive, err := c.App.IsPluginActive(model.PluginIdPlaybooks)
	if err != nil {
		return model.NewAppError("areWorkTemplatesEnabled", "api.work_templates.disabled", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if !pbActive {
		return model.NewAppError("areWorkTemplatesEnabled", "api.work_templates.disabled", nil, "playbook plugin not active", http.StatusNotFound)
	}

	hasBoard, err := c.App.HasBoardProduct()
	if err != nil {
		return model.NewAppError("areWorkTemplatesEnabled", "api.work_templates.disabled", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if !hasBoard {
		return model.NewAppError("areWorkTemplatesEnabled", "api.work_templates.disabled", nil, "board product not found", http.StatusNotFound)
	}

	return nil
}

func getWorkTemplateCategories(c *Context, w http.ResponseWriter, r *http.Request) {
	appErr := areWorkTemplatesEnabled(c)
	if appErr != nil {
		c.Err = appErr
		return
	}

	t := c.AppContext.GetT()

	categories, appErr := c.App.GetWorkTemplateCategories(t)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(categories)
	if err != nil {
		c.Err = model.NewAppError("getWorkTemplateCategories", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(b)
}

func getWorkTemplates(c *Context, w http.ResponseWriter, r *http.Request) {
	appErr := areWorkTemplatesEnabled(c)
	if appErr != nil {
		c.Err = appErr
		return
	}

	c.RequireCategory()
	if c.Err != nil {
		return
	}
	t := c.AppContext.GetT()

	workTemplates, appErr := c.App.GetWorkTemplates(c.Params.Category, c.App.Config().FeatureFlags.ToMap(), t)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(workTemplates)
	if err != nil {
		c.Err = model.NewAppError("getWorkTemplates", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(b)
}

func executeWorkTemplate(c *Context, w http.ResponseWriter, r *http.Request) {
	appErr := areWorkTemplatesEnabled(c)
	if appErr != nil {
		c.Err = appErr
		return
	}

	wtcr := &worktemplates.ExecutionRequest{}
	err := json.NewDecoder(r.Body).Decode(wtcr)
	if err != nil {
		c.Err = model.NewAppError("executeWorkTemplate", "api.unmarshal_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	canCreatePublicChannel := c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), wtcr.TeamID, model.PermissionCreatePublicChannel)
	canCreatePrivateChannel := c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), wtcr.TeamID, model.PermissionCreatePrivateChannel)
	// focalboard uses channel permissions for board creation
	canCreatePublicBoard := canCreatePublicChannel
	canCreatePrivateBoard := canCreatePrivateChannel
	canCreatePublicPlaybook := c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), wtcr.TeamID, model.PermissionPublicPlaybookCreate)
	canCreatePrivatePlaybook := c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), wtcr.TeamID, model.PermissionPrivatePlaybookCreate)
	canCreateRun := c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), wtcr.TeamID, model.PermissionRunCreate)
	appErr = wtcr.CanBeExecuted(worktemplates.PermissionSet{
		CanCreatePublicChannel:   canCreatePublicChannel,
		CanCreatePrivateChannel:  canCreatePrivateChannel,
		CanCreatePublicBoard:     canCreatePublicBoard,
		CanCreatePrivateBoard:    canCreatePrivateBoard,
		CanCreatePublicPlaybook:  canCreatePublicPlaybook,
		CanCreatePrivatePlaybook: canCreatePrivatePlaybook,
		CanCreatePlaybookRun:     canCreateRun,
	})
	if appErr != nil {
		c.Err = appErr
		return
	}

	canInstallPlugin := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWritePlugins)
	if !*c.App.Config().PluginSettings.Enable || !*c.App.Config().PluginSettings.EnableMarketplace || *c.App.Config().PluginSettings.MarketplaceURL != model.PluginSettingsDefaultMarketplaceURL {
		canInstallPlugin = false
	}

	res, appErr := c.App.ExecuteWorkTemplate(c.AppContext, wtcr, canInstallPlugin)
	if appErr != nil {
		c.Err = appErr
		return
	}

	err = json.NewEncoder(w).Encode(res)
	if err != nil {
		c.Err = model.NewAppError("executeWorkTemplate", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
}
