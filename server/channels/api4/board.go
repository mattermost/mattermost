// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
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
	model.AddEventParameterAuditableToAuditRec(auditRec, "channel", &channel)

	// CreateBoardChannel reads the boards group's status and assignee fields to
	// build the channel's kanban view, and the access control hook gates that
	// group now. An untagged context names nobody, which hides the status
	// field's options and leaves buildBoardKanbanView with nothing to build
	// from. Tagged with the session's user, not a system identity: a person
	// creating a board channel is a human caller and is judged as one.
	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	board, appErr := c.App.CreateBoardChannel(rctx, &channel)
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
