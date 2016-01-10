// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"strings"

	l4g "code.google.com/p/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type CommandProvider interface {
	GetCommand() *model.Command
	DoCommand(c *Context, channelId string, message string) *model.CommandResponse
}

var commandProviders = make(map[string]CommandProvider)

func RegisterCommandProvider(newProvider CommandProvider) {
	commandProviders[newProvider.GetCommand().Trigger] = newProvider
}

func GetCommandProvidersProvider(name string) CommandProvider {
	provider, ok := commandProviders[name]
	if ok {
		return provider
	}

	return nil
}

func InitCommand(r *mux.Router) {
	l4g.Debug("Initializing command api routes")

	sr := r.PathPrefix("/commands").Subrouter()

	sr.Handle("/execute", ApiUserRequired(executeCommand)).Methods("POST")
	sr.Handle("/list", ApiUserRequired(listCommands)).Methods("GET")

	sr.Handle("/create", ApiUserRequired(createCommand)).Methods("POST")
	sr.Handle("/list_team_commands", ApiUserRequired(listTeamCommands)).Methods("GET")
	sr.Handle("/regen_token", ApiUserRequired(regenCommandToken)).Methods("POST")
	sr.Handle("/delete", ApiUserRequired(deleteCommand)).Methods("POST")
}

func listCommands(c *Context, w http.ResponseWriter, r *http.Request) {
	commands := make([]*model.Command, 0, 32)
	seen := make(map[string]bool)
	for _, value := range commandProviders {
		cpy := *value.GetCommand()
		if cpy.AutoComplete && !seen[cpy.Id] {
			cpy.Sanatize()
			seen[cpy.Trigger] = true
			commands = append(commands, &cpy)
		}
	}

	if result := <-Srv.Store.Command().GetByTeam(c.Session.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		teamCmds := result.Data.([]*model.Command)
		for _, cmd := range teamCmds {
			if cmd.AutoComplete && !seen[cmd.Id] {
				cmd.Sanatize()
				seen[cmd.Trigger] = true
				commands = append(commands, cmd)
			}
		}
	}

	w.Write([]byte(model.CommandListToJson(commands)))
}

func executeCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)
	command := strings.TrimSpace(props["command"])
	channelId := strings.TrimSpace(props["channelId"])

	if len(command) <= 1 || strings.Index(command, "/") != 0 {
		c.Err = model.NewAppError("command", "Command must start with /", "")
		return
	}

	if len(channelId) > 0 {
		cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, channelId, c.Session.UserId)

		if !c.HasPermissionsToChannel(cchan, "checkCommand") {
			return
		}
	}

	parts := strings.Split(command, " ")
	trigger := parts[0][1:]
	provider := GetCommandProvidersProvider(trigger)

	if provider != nil {
		message := strings.Join(parts[1:], " ")
		response := provider.DoCommand(c, channelId, message)

		if response.ResponseType == model.COMMAND_RESPONSE_TYPE_IN_CHANNEL {
			post := &model.Post{}
			post.ChannelId = channelId
			post.Message = response.Text
			if _, err := CreatePost(c, post, true); err != nil {
				c.Err = model.NewAppError("command", "An error while saving the command response to the channel", "")
			}
		} else if response.ResponseType == model.COMMAND_RESPONSE_TYPE_EPHEMERAL {
			post := &model.Post{}
			post.ChannelId = channelId
			post.Message = "TODO_EPHEMERAL: " + response.Text
			if _, err := CreatePost(c, post, true); err != nil {
				c.Err = model.NewAppError("command", "An error while saving the command response to the channel", "")
			}
		}

		w.Write([]byte(response.ToJson()))
	} else {
		c.Err = model.NewAppError("command", "Command with a trigger of '"+trigger+"' not found", "")
	}
}

func createCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		c.Err = model.NewAppError("createCommand", "Commands have been disabled by the system admin.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewAppError("createCommand", "Integrations have been limited to admins only.", "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	c.LogAudit("attempt")

	cmd := model.CommandFromJson(r.Body)

	if cmd == nil {
		c.SetInvalidParam("createCommand", "command")
		return
	}

	cmd.CreatorId = c.Session.UserId
	cmd.TeamId = c.Session.TeamId

	if result := <-Srv.Store.Command().Save(cmd); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAudit("success")
		rcmd := result.Data.(*model.Command)
		w.Write([]byte(rcmd.ToJson()))
	}
}

func listTeamCommands(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		c.Err = model.NewAppError("createCommand", "Commands have been disabled by the system admin.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewAppError("createCommand", "Integrations have been limited to admins only.", "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	if result := <-Srv.Store.Command().GetByTeam(c.Session.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		cmds := result.Data.([]*model.Command)
		w.Write([]byte(model.CommandListToJson(cmds)))
	}
}

func regenCommandToken(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		c.Err = model.NewAppError("createCommand", "Commands have been disabled by the system admin.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewAppError("createCommand", "Integrations have been limited to admins only.", "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	c.LogAudit("attempt")

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("regenCommandToken", "id")
		return
	}

	var cmd *model.Command
	if result := <-Srv.Store.Command().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		cmd = result.Data.(*model.Command)

		if c.Session.TeamId != cmd.TeamId && c.Session.UserId != cmd.CreatorId && !c.IsTeamAdmin() {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewAppError("regenToken", "Inappropriate permissions to regenerate command token", "user_id="+c.Session.UserId)
			return
		}
	}

	cmd.Token = model.NewId()

	if result := <-Srv.Store.Command().Update(cmd); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		w.Write([]byte(result.Data.(*model.Command).ToJson()))
	}
}

func deleteCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		c.Err = model.NewAppError("createCommand", "Commands have been disabled by the system admin.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewAppError("createCommand", "Integrations have been limited to admins only.", "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	c.LogAudit("attempt")

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteCommand", "id")
		return
	}

	if result := <-Srv.Store.Command().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		if c.Session.TeamId != result.Data.(*model.Command).TeamId && c.Session.UserId != result.Data.(*model.Command).CreatorId && !c.IsTeamAdmin() {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewAppError("deleteCommand", "Inappropriate permissions to delete command", "user_id="+c.Session.UserId)
			return
		}
	}

	if err := (<-Srv.Store.Command().Delete(id, model.GetMillis())).Err; err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(props)))
}
