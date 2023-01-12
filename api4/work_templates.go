// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/worktemplates"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitWorkTemplate() {
	api.BaseRoutes.WorkTemplates.Handle("/categories", api.APISessionRequired(areWorkTemplatesEnabled(getWorkTemplateCategories))).Methods("GET")
	api.BaseRoutes.WorkTemplates.Handle("/categories/{category}/templates", api.APISessionRequired(areWorkTemplatesEnabled(getWorkTemplates))).Methods("GET")
	api.BaseRoutes.WorkTemplates.Handle("/execute", api.APIHandler(areWorkTemplatesEnabled(executeWorkTemplate))).Methods("POST")
}

func areWorkTemplatesEnabled(h handlerFunc) handlerFunc {
	return func(c *Context, w http.ResponseWriter, r *http.Request) {
		if !c.App.Config().FeatureFlags.WorkTemplate {
			c.Logger.Warn("trying to access work templates api while feature flag is disabled")
			http.NotFound(w, r)
			return
		}

		// we have to make sure that playbooks plugin is enabled and board is a product
		pbActive, err := c.App.IsPluginActive(model.PluginIdPlaybooks)
		if err != nil {
			c.Logger.Warn("trying to access work templates api but can't know if playbooks plugin is active", mlog.Err(err))
			http.NotFound(w, r)
			return
		}
		if !pbActive {
			c.Logger.Warn("trying to access work templates api while playbooks plugin is not active")
			http.NotFound(w, r)
			return
		}

		hasBoard, err := c.App.HasBoardProduct()
		if err != nil {
			c.Logger.Warn("trying to access work templates api but can't know if boards runs as a product", mlog.Err(err))
			http.NotFound(w, r)
			return
		}
		if !hasBoard {
			c.Logger.Warn("trying to access work templates api while while board product is not installed")
			http.NotFound(w, r)
			return
		}

		h(c, w, r)
	}
}

func getWorkTemplateCategories(c *Context, w http.ResponseWriter, r *http.Request) {
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
	canExecuteWorkTemplate, err := wtcr.CanBeExecuted(worktemplates.PermissionSet{
		CanCreatePublicChannel:   canCreatePublicChannel,
		CanCreatePrivateChannel:  canCreatePrivateChannel,
		CanCreatePublicBoard:     canCreatePublicBoard,
		CanCreatePrivateBoard:    canCreatePrivateBoard,
		CanCreatePublicPlaybook:  canCreatePublicPlaybook,
		CanCreatePrivatePlaybook: canCreatePrivatePlaybook,
		CanCreatePlaybookRun:     canCreateRun,
	})
	if err != nil {
		if canExecuteWorkTemplate == nil {
			c.Err = model.NewAppError("executeWorkTemplate", "api.execute_work_template.permission_error", nil, "", http.StatusForbidden).Wrap(err)
		}
		c.Err = model.NewAppError("executeWorkTemplate", "api.execute_work_template.error", nil, "", http.StatusForbidden).Wrap(err)
		return
	}

	canInstallPlugin := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWritePlugins)
	if !*c.App.Config().PluginSettings.Enable || !*c.App.Config().PluginSettings.EnableMarketplace {
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
