// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/server/v7/boards/model"
)

func (a *API) registerLimitsRoutes(r *mux.Router) {
	// limits
	r.HandleFunc("/limits", a.sessionRequired(a.handleCloudLimits)).Methods("GET")
	r.HandleFunc("/teams/{teamID}/notifyadminupgrade", a.sessionRequired(a.handleNotifyAdminUpgrade)).Methods(http.MethodPost)
}

func (a *API) handleCloudLimits(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /limits cloudLimits
	//
	// Fetches the cloud limits of the server.
	//
	// ---
	// produces:
	// - application/json
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//         "$ref": "#/definitions/BoardsCloudLimits"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	boardsCloudLimits, err := a.app.GetBoardsCloudLimits()
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	data, err := json.Marshal(boardsCloudLimits)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
}

func (a *API) handleNotifyAdminUpgrade(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /api/v2/teams/{teamID}/notifyadminupgrade handleNotifyAdminUpgrade
	//
	// Notifies admins for upgrade request.
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: teamID
	//   in: path
	//   description: Team ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	if !a.MattermostAuth {
		a.errorResponse(w, r, model.NewErrNotImplemented("not permitted in standalone mode"))
		return
	}

	vars := mux.Vars(r)
	teamID := vars["teamID"]

	if err := a.app.NotifyPortalAdminsUpgradeRequest(teamID); err != nil {
		jsonStringResponse(w, http.StatusOK, "{}")
	}
}
