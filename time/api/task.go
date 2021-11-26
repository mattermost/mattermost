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

func (api *API) InitTask() {
	handler := &TaskHandler{}

	tasksRouter := api.BaseRoutes.Root.PathPrefix("/tasks").Subrouter()

	tasksRouter.HandleFunc("", handler.createTask).Methods(http.MethodPost)
}

func (h *TaskHandler) createTask(w http.ResponseWriter, r *http.Request) {

}
