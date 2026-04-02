// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitBoard() {
	if api.srv.Config().FeatureFlags.IntegratedBoards {
		api.BaseRoutes.Boards.Handle("", api.APISessionRequired(createBoard)).Methods(http.MethodPost)
	}
}

func createBoard(c *Context, w http.ResponseWriter, r *http.Request) {
	var channel model.Channel
	if err := json.NewDecoder(r.Body).Decode(&channel); err != nil {
		c.SetInvalidParamWithDetails("body", err.Error())
		return
	}

	if !channel.IsBoard() {
		c.SetInvalidParamWithDetails("type", "must be BO or BP")
		return
	}

	if channel.TeamId == "" {
		c.SetInvalidParam("team_id")
		return
	}

	// Permission check
	if channel.IsOpenBoard() {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePublicChannel) {
			c.SetPermissionError(model.PermissionCreatePublicChannel)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePrivateChannel) {
			c.SetPermissionError(model.PermissionCreatePrivateChannel)
			return
		}
	}

	channel.CreatorId = c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord(model.AuditEventCreateBoard, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "team_id", channel.TeamId)
	model.AddEventParameterToAuditRec(auditRec, "type", string(channel.Type))

	board, appErr := c.App.CreateBoardChannel(c.AppContext, &channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(board)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(board); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
