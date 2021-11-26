// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/api4"
	mmApp "github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/time/app"
	"github.com/mattermost/mattermost-server/v6/web"
)

type Context = web.Context

type Routes struct {
	Root *mux.Router // 'api/v1'
}

type API struct {
	BaseRoutes *Routes
	srv        *mmApp.Server
}

func Init(router *mux.Router, srv *mmApp.Server) *API {
	api := &API{
		BaseRoutes: &Routes{},
		srv:        srv,
	}

	api.BaseRoutes.Root = router.PathPrefix("/api/v1").Subrouter()

	taskService := app.NewTaskService()

	api.InitTask(taskService)

	return api
}

func (api *API) APISessionRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return api4.APISessionRequired(api.srv, h)
}
