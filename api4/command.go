// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitCommand() {
	l4g.Debug(utils.T("api.command.init.debug"))

	BaseRoutes.Commands.Handle("", ApiSessionRequired(createCommand)).Methods("POST")
}

func createCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	cmd := model.CommandFromJson(r.Body)
	if cmd == nil {
		c.SetInvalidParam("command")
		return
	}

	c.LogAudit("attempt")

	if !app.SessionHasPermissionToTeam(c.Session, cmd.TeamId, model.PERMISSION_MANAGE_SLASH_COMMANDS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SLASH_COMMANDS)
		return
	}

	cmd.CreatorId = c.Session.UserId

	rcmd, err := app.CreateCommand(cmd)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(rcmd.ToJson()))
}
