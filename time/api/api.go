// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
)

type Routes struct {
	Root *mux.Router // 'api/v1'
}

type API struct {
	BaseRoutes *Routes
}

func Init(router *mux.Router) *API {
	api := &API{
		BaseRoutes: &Routes{},
	}

	api.BaseRoutes.Root = router.PathPrefix("/api/v1").Subrouter()

	return api
}

// HandleErrorWithCode logs the internal error and sends the public facing error
// message as JSON in a response with the provided code.
func HandleErrorWithCode(logger bot.Logger, w http.ResponseWriter, code int, publicErrorMsg string, internalErr error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	details := ""
	if internalErr != nil {
		details = internalErr.Error()
	}

	logger.Warnf("public error message: %v; internal details: %v", publicErrorMsg, details)

	responseMsg, _ := json.Marshal(struct {
		Error string `json:"error"` // A public facing message providing details about the error.
	}{
		Error: publicErrorMsg,
	})
	_, _ = w.Write(responseMsg)
}
