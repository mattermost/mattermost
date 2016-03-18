// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"crypto/tls"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type CommandProvider interface {
	GetTrigger() string
	GetCommand(c *Context) *model.Command
	DoCommand(c *Context, channelId string, message string) *model.CommandResponse
}

var commandProviders = make(map[string]CommandProvider)

func RegisterCommandProvider(newProvider CommandProvider) {
	commandProviders[newProvider.GetTrigger()] = newProvider
}

func GetCommandProvider(name string) CommandProvider {
	provider, ok := commandProviders[name]
	if ok {
		return provider
	}

	return nil
}

func InitCommand(r *mux.Router) {
	l4g.Debug(utils.T("api.command.init.debug"))

	sr := r.PathPrefix("/commands").Subrouter()

	sr.Handle("/execute", ApiUserRequired(executeCommand)).Methods("POST")
	sr.Handle("/list", ApiUserRequired(listCommands)).Methods("GET")

	sr.Handle("/create", ApiUserRequired(createCommand)).Methods("POST")
	sr.Handle("/list_team_commands", ApiUserRequired(listTeamCommands)).Methods("GET")
	sr.Handle("/regen_token", ApiUserRequired(regenCommandToken)).Methods("POST")
	sr.Handle("/delete", ApiUserRequired(deleteCommand)).Methods("POST")

	sr.Handle("/test", ApiAppHandler(testCommand)).Methods("POST")
	sr.Handle("/test", ApiAppHandler(testCommand)).Methods("GET")
	sr.Handle("/test_e", ApiAppHandler(testEphemeralCommand)).Methods("POST")
	sr.Handle("/test_e", ApiAppHandler(testEphemeralCommand)).Methods("GET")
}

func listCommands(c *Context, w http.ResponseWriter, r *http.Request) {
	commands := make([]*model.Command, 0, 32)
	seen := make(map[string]bool)
	for _, value := range commandProviders {
		cpy := *value.GetCommand(c)
		if cpy.AutoComplete && !seen[cpy.Id] {
			cpy.Sanitize()
			seen[cpy.Trigger] = true
			commands = append(commands, &cpy)
		}
	}

	if *utils.Cfg.ServiceSettings.EnableCommands {
		if result := <-Srv.Store.Command().GetByTeam(c.Session.TeamId); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			teamCmds := result.Data.([]*model.Command)
			for _, cmd := range teamCmds {
				if cmd.AutoComplete && !seen[cmd.Id] {
					cmd.Sanitize()
					seen[cmd.Trigger] = true
					commands = append(commands, cmd)
				}
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
		c.Err = model.NewLocAppError("executeCommand", "api.command.execute_command.start.app_error", nil, "")
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
	message := strings.Join(parts[1:], " ")
	provider := GetCommandProvider(trigger)

	if provider != nil {
		response := provider.DoCommand(c, channelId, message)
		handleResponse(c, w, response, channelId, provider.GetCommand(c), true)
		return
	} else {

		if !*utils.Cfg.ServiceSettings.EnableCommands {
			c.Err = model.NewLocAppError("executeCommand", "api.command.disabled.app_error", nil, "")
			c.Err.StatusCode = http.StatusNotImplemented
			return
		}

		chanChan := Srv.Store.Channel().Get(channelId)
		teamChan := Srv.Store.Team().Get(c.Session.TeamId)
		userChan := Srv.Store.User().Get(c.Session.UserId)

		if result := <-Srv.Store.Command().GetByTeam(c.Session.TeamId); result.Err != nil {
			c.Err = result.Err
			return
		} else {

			var team *model.Team
			if tr := <-teamChan; tr.Err != nil {
				c.Err = tr.Err
				return
			} else {
				team = tr.Data.(*model.Team)

			}

			var user *model.User
			if ur := <-userChan; ur.Err != nil {
				c.Err = ur.Err
				return
			} else {
				user = ur.Data.(*model.User)
			}

			var channel *model.Channel
			if cr := <-chanChan; cr.Err != nil {
				c.Err = cr.Err
				return
			} else {
				channel = cr.Data.(*model.Channel)
			}

			teamCmds := result.Data.([]*model.Command)
			for _, cmd := range teamCmds {
				if trigger == cmd.Trigger {
					l4g.Debug(fmt.Sprintf(utils.T("api.command.execute_command.debug"), trigger, c.Session.UserId))

					p := url.Values{}
					p.Set("token", cmd.Token)

					p.Set("team_id", cmd.TeamId)
					p.Set("team_domain", team.Name)

					p.Set("channel_id", channelId)
					p.Set("channel_name", channel.Name)

					p.Set("user_id", c.Session.UserId)
					p.Set("user_name", user.Username)

					p.Set("command", "/"+trigger)
					p.Set("text", message)
					p.Set("response_url", "not supported yet")

					method := "POST"
					if cmd.Method == model.COMMAND_METHOD_GET {
						method = "GET"
					}

					tr := &http.Transport{
						TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
					}
					client := &http.Client{Transport: tr}

					req, _ := http.NewRequest(method, cmd.URL, strings.NewReader(p.Encode()))
					req.Header.Set("Accept", "application/json")
					if cmd.Method == model.COMMAND_METHOD_POST {
						req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
					}

					if resp, err := client.Do(req); err != nil {
						c.Err = model.NewLocAppError("command", "api.command.execute_command.failed.app_error", map[string]interface{}{"Trigger": trigger}, err.Error())
					} else {
						if resp.StatusCode == http.StatusOK {
							response := model.CommandResponseFromJson(resp.Body)
							if response == nil {
								c.Err = model.NewLocAppError("command", "api.command.execute_command.failed_empty.app_error", map[string]interface{}{"Trigger": trigger}, "")
							} else {
								handleResponse(c, w, response, channelId, cmd, false)
							}
						} else {
							body, _ := ioutil.ReadAll(resp.Body)
							c.Err = model.NewLocAppError("command", "api.command.execute_command.failed_resp.app_error", map[string]interface{}{"Trigger": trigger, "Status": resp.Status}, string(body))
						}
					}

					return
				}
			}

		}
	}

	c.Err = model.NewLocAppError("command", "api.command.execute_command.not_found.app_error", map[string]interface{}{"Trigger": trigger}, "")
}

func handleResponse(c *Context, w http.ResponseWriter, response *model.CommandResponse, channelId string, cmd *model.Command, builtIn bool) {

	post := &model.Post{}
	post.ChannelId = channelId

	if !builtIn {
		post.AddProp("from_webhook", "true")
	}

	if utils.Cfg.ServiceSettings.EnablePostUsernameOverride {
		if len(cmd.Username) != 0 {
			post.AddProp("override_username", cmd.Username)
		} else {
			post.AddProp("override_username", model.DEFAULT_WEBHOOK_USERNAME)
		}
	}

	if utils.Cfg.ServiceSettings.EnablePostIconOverride {
		if len(cmd.IconURL) != 0 {
			post.AddProp("override_icon_url", cmd.IconURL)
		} else {
			post.AddProp("override_icon_url", model.DEFAULT_WEBHOOK_ICON)
		}
	}

	if response.ResponseType == model.COMMAND_RESPONSE_TYPE_IN_CHANNEL {
		post.Message = response.Text
		if _, err := CreatePost(c, post, true); err != nil {
			c.Err = model.NewLocAppError("command", "api.command.execute_command.save.app_error", nil, "")
		}
	} else if response.ResponseType == model.COMMAND_RESPONSE_TYPE_EPHEMERAL {
		post.Message = response.Text
		post.CreateAt = model.GetMillis()
		SendEphemeralPost(
			c.Session.TeamId,
			c.Session.UserId,
			post,
		)
	}

	w.Write([]byte(response.ToJson()))
}

func createCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		c.Err = model.NewLocAppError("createCommand", "api.command.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("createCommand", "api.command.admin_only.app_error", nil, "")
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
		c.Err = model.NewLocAppError("listTeamCommands", "api.command.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("listTeamCommands", "api.command.admin_only.app_error", nil, "")
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
		c.Err = model.NewLocAppError("regenCommandToken", "api.command.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("regenCommandToken", "api.command.admin_only.app_error", nil, "")
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

		if c.Session.TeamId != cmd.TeamId || (c.Session.UserId != cmd.CreatorId && !c.IsTeamAdmin()) {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewLocAppError("regenToken", "api.command.regen.app_error", nil, "user_id="+c.Session.UserId)
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
		c.Err = model.NewLocAppError("deleteCommand", "api.command.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("deleteCommand", "api.command.admin_only.app_error", nil, "")
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
		if c.Session.TeamId != result.Data.(*model.Command).TeamId || (c.Session.UserId != result.Data.(*model.Command).CreatorId && !c.IsTeamAdmin()) {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewLocAppError("deleteCommand", "api.command.delete.app_error", nil, "user_id="+c.Session.UserId)
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
