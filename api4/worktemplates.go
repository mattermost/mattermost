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
	api.BaseRoutes.WorkTemplates.Handle("/categories", api.APISessionRequired(needsWorkTemplateFeatureFlag(getWorkTemplateCategories))).Methods("GET")
	api.BaseRoutes.WorkTemplates.Handle("/categories/{category}/templates", api.APISessionRequired(needsWorkTemplateFeatureFlag(getWorkTemplates))).Methods("GET")
	api.BaseRoutes.WorkTemplates.Handle("/execute", api.APIHandler(executeWorkTemplate)).Methods("POST")
}

func needsWorkTemplateFeatureFlag(h handlerFunc) handlerFunc {
	return func(c *Context, w http.ResponseWriter, r *http.Request) {
		if !c.App.Config().FeatureFlags.WorkTemplate {
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
		c.Err = model.NewAppError("getWorkTemplateCategories", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
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
		c.Err = model.NewAppError("getWorkTemplates", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func executeWorkTemplate(c *Context, w http.ResponseWriter, r *http.Request) {
	wtcr := &worktemplates.ExecutionRequest{}
	err := json.NewDecoder(r.Body).Decode(wtcr)
	if err != nil {
		c.Err = model.NewAppError("executeWorkTemplate", "api.unmarshal_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	// we have to make sure that playbooks plugin is enabled and board is a product
	pbActive, err := c.App.IsPluginActive(model.PluginIdPlaybooks)
	if err != nil {
		c.Err = model.NewAppError("executeWorkTemplate", "api.plugin_active_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
	if !pbActive {
		c.Err = model.NewAppError("executeWorkTemplate", "api.plugin_not_active", nil, model.PluginIdPlaybooks, http.StatusBadRequest)
		return
	}

	hasBoard, err := c.App.HasBoardProduct()
	if err != nil {
		c.Err = model.NewAppError("executeWorkTemplate", "api.has_board_product_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
	if !hasBoard {
		c.Err = model.NewAppError("executeWorkTemplate", "api.board_not_active", nil, "", http.StatusBadRequest)
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
			c.Err = model.NewAppError("executeWorkTemplate", "api.execute_work_template_error", nil, err.Error(), http.StatusForbidden)
		}
		c.Err = model.NewAppError("executeWorkTemplate", "api.execute_work_template_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	res, appErr := c.App.ExecuteWorkTemplate(c.AppContext, wtcr)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(res)
	if err != nil {
		c.Err = model.NewAppError("executeWorkTemplate", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}
