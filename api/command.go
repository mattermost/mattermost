// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"io/ioutil"
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitCommand() {
	l4g.Debug(utils.T("api.command.init.debug"))

	BaseRoutes.Commands.Handle("/execute", ApiUserRequired(executeCommand)).Methods("POST")
	BaseRoutes.Commands.Handle("/list", ApiUserRequired(listCommands)).Methods("GET")

	BaseRoutes.Commands.Handle("/create", ApiUserRequired(createCommand)).Methods("POST")
	BaseRoutes.Commands.Handle("/update", ApiUserRequired(updateCommand)).Methods("POST")
	BaseRoutes.Commands.Handle("/list_team_commands", ApiUserRequired(listTeamCommands)).Methods("GET")
	BaseRoutes.Commands.Handle("/regen_token", ApiUserRequired(regenCommandToken)).Methods("POST")
	BaseRoutes.Commands.Handle("/delete", ApiUserRequired(deleteCommand)).Methods("POST")

	BaseRoutes.Teams.Handle("/command_test", ApiAppHandler(testCommand)).Methods("POST")
	BaseRoutes.Teams.Handle("/command_test", ApiAppHandler(testCommand)).Methods("GET")
	BaseRoutes.Teams.Handle("/command_test_e", ApiAppHandler(testEphemeralCommand)).Methods("POST")
	BaseRoutes.Teams.Handle("/command_test_e", ApiAppHandler(testEphemeralCommand)).Methods("GET")
}

func listCommands(c *Context, w http.ResponseWriter, r *http.Request) {
	commands, err := app.ListAutocompleteCommands(c.TeamId, c.T)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.CommandListToJson(commands)))
}

func executeCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	commandArgs := model.CommandArgsFromJson(r.Body)
	if commandArgs == nil {
		c.SetInvalidParam("executeCommand", "command_args")
		return
	}

	if len(commandArgs.Command) <= 1 || strings.Index(commandArgs.Command, "/") != 0 {
		c.Err = model.NewAppError("executeCommand", "api.command.execute_command.start.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(commandArgs.ChannelId) > 0 {
		if !app.SessionHasPermissionToChannel(c.Session, commandArgs.ChannelId, model.PERMISSION_USE_SLASH_COMMANDS) {
			c.SetPermissionError(model.PERMISSION_USE_SLASH_COMMANDS)
			return
		}
	}

	commandArgs.TeamId = c.TeamId
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

func createCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	cmd := model.CommandFromJson(r.Body)

	if cmd == nil {
		c.SetInvalidParam("createCommand", "command")
		return
	}

	c.LogAudit("attempt")

	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_SLASH_COMMANDS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SLASH_COMMANDS)
		return
	}

	cmd.CreatorId = c.Session.UserId
	cmd.TeamId = c.TeamId

	rcmd, err := app.CreateCommand(cmd)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(rcmd.ToJson()))
}

func updateCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	cmd := model.CommandFromJson(r.Body)

	if cmd == nil {
		c.SetInvalidParam("updateCommand", "command")
		return
	}

	c.LogAudit("attempt")

	oldCmd, err := app.GetCommand(cmd.Id)
	if err != nil {
		c.Err = err
		return
	}

	if c.TeamId != oldCmd.TeamId {
		c.Err = model.NewAppError("updateCommand", "api.command.team_mismatch.app_error", nil, "user_id="+c.Session.UserId, http.StatusBadRequest)
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, oldCmd.TeamId, model.PERMISSION_MANAGE_SLASH_COMMANDS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_SLASH_COMMANDS)
		return
	}

	if c.Session.UserId != oldCmd.CreatorId && !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS) {
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

func listTeamCommands(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_SLASH_COMMANDS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SLASH_COMMANDS)
		return
	}

	cmds, err := app.ListTeamCommands(c.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.CommandListToJson(cmds)))
}

func regenCommandToken(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("regenCommandToken", "id")
		return
	}

	c.LogAudit("attempt")

	cmd, err := app.GetCommand(id)
	if err != nil {
		c.Err = err
		return
	}

	if c.TeamId != cmd.TeamId {
		c.Err = model.NewAppError("regenCommandToken", "api.command.team_mismatch.app_error", nil, "user_id="+c.Session.UserId, http.StatusBadRequest)
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

	w.Write([]byte(rcmd.ToJson()))
}

func deleteCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteCommand", "id")
		return
	}

	c.LogAudit("attempt")

	cmd, err := app.GetCommand(id)
	if err != nil {
		c.Err = err
		return
	}

	if c.TeamId != cmd.TeamId {
		c.Err = model.NewAppError("deleteCommand", "api.command.team_mismatch.app_error", nil, "user_id="+c.Session.UserId, http.StatusBadRequest)
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, cmd.TeamId, model.PERMISSION_MANAGE_SLASH_COMMANDS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SLASH_COMMANDS)
		c.LogAudit("fail - inappropriate permissions")
		return
	}

	if c.Session.UserId != cmd.CreatorId && !app.SessionHasPermissionToTeam(c.Session, cmd.TeamId, model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS)
		c.LogAudit("fail - inappropriate permissions")
		return
	}

	err = app.DeleteCommand(cmd.Id)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(props)))
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

func testEphemeralCommand(c *Context, w http.ResponseWriter, r *http.Request) {
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
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
	}

	w.Write([]byte(rc.ToJson()))
}
