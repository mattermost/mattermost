// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitCommand() {
	l4g.Debug(utils.T("api.command.init.debug"))

	BaseRoutes.Commands.Handle("", ApiSessionRequired(createCommand)).Methods("POST")
	BaseRoutes.Commands.Handle("", ApiSessionRequired(listCommands)).Methods("GET")
	BaseRoutes.Commands.Handle("/execute", ApiSessionRequired(executeCommand)).Methods("POST")

	BaseRoutes.Command.Handle("", ApiSessionRequired(updateCommand)).Methods("PUT")
	BaseRoutes.Command.Handle("", ApiSessionRequired(deleteCommand)).Methods("DELETE")

	BaseRoutes.Team.Handle("/commands/autocomplete", ApiSessionRequired(listAutocompleteCommands)).Methods("GET")
	BaseRoutes.Command.Handle("/regen_token", ApiSessionRequired(regenCommandToken)).Methods("PUT")

	BaseRoutes.Teams.Handle("/command_test", ApiHandler(testCommand)).Methods("POST")
	BaseRoutes.Teams.Handle("/command_test", ApiHandler(testCommand)).Methods("GET")
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

func updateCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireCommandId()
	if c.Err != nil {
		return
	}

	cmd := model.CommandFromJson(r.Body)
	if cmd == nil || cmd.Id != c.Params.CommandId {
		c.SetInvalidParam("command")
		return
	}

	c.LogAudit("attempt")

	oldCmd, err := app.GetCommand(c.Params.CommandId)
	if err != nil {
		c.Err = err
		return
	}

	if cmd.TeamId != oldCmd.TeamId {
		c.Err = model.NewAppError("updateCommand", "api.command.team_mismatch.app_error", nil, "user_id="+c.Session.UserId, http.StatusBadRequest)
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, oldCmd.TeamId, model.PERMISSION_MANAGE_SLASH_COMMANDS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_SLASH_COMMANDS)
		return
	}

	if c.Session.UserId != oldCmd.CreatorId && !app.SessionHasPermissionToTeam(c.Session, oldCmd.TeamId, model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS)
		return
	}

	rcmd, err := app.UpdateCommand(oldCmd, cmd)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")

	w.Write([]byte(rcmd.ToJson()))
}

func deleteCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireCommandId()
	if c.Err != nil {
		return
	}

	c.LogAudit("attempt")

	cmd, err := app.GetCommand(c.Params.CommandId)
	if err != nil {
		c.Err = err
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, cmd.TeamId, model.PERMISSION_MANAGE_SLASH_COMMANDS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_SLASH_COMMANDS)
		return
	}

	if c.Session.UserId != cmd.CreatorId && !app.SessionHasPermissionToTeam(c.Session, cmd.TeamId, model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS)
		return
	}

	err = app.DeleteCommand(cmd.Id)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")

	ReturnStatusOK(w)
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

func executeCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	commandArgs := model.CommandArgsFromJson(r.Body)
	if commandArgs == nil {
		c.SetInvalidParam("command_args")
		return
	}

	if len(commandArgs.Command) <= 1 || strings.Index(commandArgs.Command, "/") != 0 || len(commandArgs.ChannelId) != 26 {
		c.Err = model.NewAppError("executeCommand", "api.command.execute_command.start.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, commandArgs.ChannelId, model.PERMISSION_USE_SLASH_COMMANDS) {
		c.SetPermissionError(model.PERMISSION_USE_SLASH_COMMANDS)
		return
	}

	channel, err := app.GetChannel(commandArgs.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if commandArgs.TeamId == "" {
		commandArgs.TeamId = channel.TeamId
	} else if c.Session.GetTeamByTeamId(commandArgs.TeamId) == nil {
		c.SetPermissionError(model.PERMISSION_USE_SLASH_COMMANDS)
		return
	}

	commandArgs.UserId = c.Session.UserId
	commandArgs.T = c.T
	commandArgs.Session = c.Session
	commandArgs.SiteURL = c.GetSiteURLHeader()

	response, err := app.ExecuteCommand(commandArgs)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(response.ToJson()))
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

func regenCommandToken(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireCommandId()
	if c.Err != nil {
		return
	}

	c.LogAudit("attempt")
	cmd, err := app.GetCommand(c.Params.CommandId)
	if err != nil {
		c.Err = err
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, cmd.TeamId, model.PERMISSION_MANAGE_SLASH_COMMANDS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_SLASH_COMMANDS)
		return
	}

	if c.Session.UserId != cmd.CreatorId && !app.SessionHasPermissionToTeam(c.Session, cmd.TeamId, model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS)
		return
	}

	rcmd, err := app.RegenCommandToken(cmd)
	if err != nil {
		c.Err = err
		return
	}

	resp := make(map[string]string)
	resp["token"] = rcmd.Token

	w.Write([]byte(model.MapToJson(resp)))
}

func testCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	r.ParseForm()

	msg := ""
	if r.Method == "POST" {
		msg = msg + "\ntoken=" + r.FormValue("token")
		msg = msg + "\nteam_domain=" + r.FormValue("team_domain")
	} else {
		body, _ := ioutil.ReadAll(r.Body)
		msg = string(body)
	}

	rc := &model.CommandResponse{
		Text:         "test command response " + msg,
		ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL,
	}

	w.Write([]byte(rc.ToJson()))
}
