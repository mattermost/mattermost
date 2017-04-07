// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitCommand() {
	l4g.Debug(utils.T("api.command.init.debug"))

	BaseRoutes.Commands.Handle("", ApiSessionRequired(createCommand)).Methods("POST")
	BaseRoutes.Commands.Handle("", ApiSessionRequired(listCommands)).Methods("GET")

	BaseRoutes.Team.Handle("/commands/autocomplete", ApiSessionRequired(listAutocompleteCommands)).Methods("GET")
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

func listCommands(c *Context, w http.ResponseWriter, r *http.Request) {
	customOnly, failConv := strconv.ParseBool(r.URL.Query().Get("custom_only"))
	if failConv != nil {
		customOnly = false
	}

	teamId := r.URL.Query().Get("team_id")

	if len(teamId) == 0 {
		c.SetInvalidParam("team_id")
		return
	}

	commands := []*model.Command{}
	err := &model.AppError{}
	if customOnly {
		if !app.SessionHasPermissionToTeam(c.Session, teamId, model.PERMISSION_MANAGE_SLASH_COMMANDS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SLASH_COMMANDS)
			return
		}
		commands, err = app.ListTeamCommands(teamId)
		if err != nil {
			c.Err = err
			return
		}
	} else {
		//User with no permission should see only system commands
		if !app.SessionHasPermissionToTeam(c.Session, teamId, model.PERMISSION_MANAGE_SLASH_COMMANDS) {
			commands, err = app.ListAutocompleteCommands(teamId, c.T)
			if err != nil {
				c.Err = err
				return
			}
		} else {
			commands, err = app.ListAllCommands(teamId, c.T)
			if err != nil {
				c.Err = err
				return
			}
		}
	}

	w.Write([]byte(model.CommandListToJson(commands)))
}

func listAutocompleteCommands(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	commands, err := app.ListAutocompleteCommands(c.Params.TeamId, c.T)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.CommandListToJson(commands)))
}
