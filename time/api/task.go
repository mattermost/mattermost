// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/time/app"
)

type TaskHandler struct {
	taskService app.TaskService
}

func (api *API) InitTask(taskService app.TaskService) {
	handler := &TaskHandler{
		taskService: taskService,
	}

	tasksRouter := api.BaseRoutes.Root.PathPrefix("/tasks").Subrouter()

	tasksRouter.Handle("", api.APISessionRequired(handler.createTask)).Methods(http.MethodPost)
}

func (h *TaskHandler) createTask(c *Context, w http.ResponseWriter, r *http.Request) {

}
