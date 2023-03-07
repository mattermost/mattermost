// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/server/v7/boards/model"
	"github.com/mattermost/mattermost-server/server/v7/boards/services/audit"

	mm_model "github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

func (a *API) registerChannelsRoutes(r *mux.Router) {
	r.HandleFunc("/teams/{teamID}/channels/{channelID}", a.sessionRequired(a.handleGetChannel)).Methods("GET")
}

func (a *API) handleGetChannel(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /teams/{teamID}/channels/{channelID} getChannel
	//
	// Returns the requested channel
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
	// - name: channelID
	//   in: path
	//   description: Channel ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/Channel"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	if !a.MattermostAuth {
		a.errorResponse(w, r, model.NewErrNotImplemented("not permitted in standalone mode"))
		return
	}

	teamID := mux.Vars(r)["teamID"]
	channelID := mux.Vars(r)["channelID"]
	userID := getUserID(r)

	if !a.permissions.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to team"))
		return
	}

	if !a.permissions.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to channel"))
		return
	}

	auditRec := a.makeAuditRecord(r, "getChannel", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)
	auditRec.AddMeta("teamID", teamID)
	auditRec.AddMeta("channelID", teamID)

	channel, err := a.app.GetChannel(teamID, channelID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("GetChannel",
		mlog.String("teamID", teamID),
		mlog.String("channelID", channelID),
	)

	if channel.TeamId != teamID {
		if channel.Type != mm_model.ChannelTypeDirect && channel.Type != mm_model.ChannelTypeGroup {
			message := fmt.Sprintf("channel ID=%s on TeamID=%s", channel.Id, teamID)
			a.errorResponse(w, r, model.NewErrNotFound(message))
			return
		}
	}

	data, err := json.Marshal(channel)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// response
	jsonBytesResponse(w, http.StatusOK, data)

	auditRec.Success()
}
