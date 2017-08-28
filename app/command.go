// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type CommandProvider interface {
	GetTrigger() string
	GetCommand(T goi18n.TranslateFunc) *model.Command
	DoCommand(args *model.CommandArgs, message string) *model.CommandResponse
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

func CreateCommandPost(post *model.Post, teamId string, response *model.CommandResponse) (*model.Post, *model.AppError) {
	post.Message = parseSlackLinksToMarkdown(response.Text)
	post.CreateAt = model.GetMillis()

	if response.Attachments != nil {
		parseSlackAttachment(post, response.Attachments)
	}

	if response.ResponseType == model.COMMAND_RESPONSE_TYPE_IN_CHANNEL {
		return CreatePostMissingChannel(post, true)
	} else if response.ResponseType == "" || response.ResponseType == model.COMMAND_RESPONSE_TYPE_EPHEMERAL {
		if response.Text == "" {
			return post, nil
		}

		post.ParentId = ""
		SendEphemeralPost(teamId, post.UserId, post)
	}

	return post, nil
}

// previous ListCommands now ListAutocompleteCommands
func ListAutocompleteCommands(teamId string, T goi18n.TranslateFunc) ([]*model.Command, *model.AppError) {
	commands := make([]*model.Command, 0, 32)
	seen := make(map[string]bool)
	for _, value := range commandProviders {
		cpy := *value.GetCommand(T)
		if cpy.AutoComplete && !seen[cpy.Id] {
			cpy.Sanitize()
			seen[cpy.Trigger] = true
			commands = append(commands, &cpy)
		}
	}

	if *utils.Cfg.ServiceSettings.EnableCommands {
		if result := <-Srv.Store.Command().GetByTeam(teamId); result.Err != nil {
			return nil, result.Err
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

	return commands, nil
}

func ListTeamCommands(teamId string) ([]*model.Command, *model.AppError) {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		return nil, model.NewAppError("ListTeamCommands", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Command().GetByTeam(teamId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Command), nil
	}
}

func ListAllCommands(teamId string, T goi18n.TranslateFunc) ([]*model.Command, *model.AppError) {
	commands := make([]*model.Command, 0, 32)
	seen := make(map[string]bool)
	for _, value := range commandProviders {
		cpy := *value.GetCommand(T)
		if cpy.AutoComplete && !seen[cpy.Id] {
			cpy.Sanitize()
			seen[cpy.Trigger] = true
			commands = append(commands, &cpy)
		}
	}

	if *utils.Cfg.ServiceSettings.EnableCommands {
		if result := <-Srv.Store.Command().GetByTeam(teamId); result.Err != nil {
			return nil, result.Err
		} else {
			teamCmds := result.Data.([]*model.Command)
			for _, cmd := range teamCmds {
				if !seen[cmd.Id] {
					cmd.Sanitize()
					seen[cmd.Trigger] = true
					commands = append(commands, cmd)
				}
			}
		}
	}

	return commands, nil
}

func ExecuteCommand(args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	parts := strings.Split(args.Command, " ")
	trigger := parts[0][1:]
	trigger = strings.ToLower(trigger)
	message := strings.Join(parts[1:], " ")
	provider := GetCommandProvider(trigger)

	if provider != nil {
		response := provider.DoCommand(args, message)
		return HandleCommandResponse(provider.GetCommand(args.T), args, response, true)
	} else {
		if !*utils.Cfg.ServiceSettings.EnableCommands {
			return nil, model.NewAppError("ExecuteCommand", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
		}

		chanChan := Srv.Store.Channel().Get(args.ChannelId, true)
		teamChan := Srv.Store.Team().Get(args.TeamId)
		userChan := Srv.Store.User().Get(args.UserId)

		if result := <-Srv.Store.Command().GetByTeam(args.TeamId); result.Err != nil {
			return nil, result.Err
		} else {

			var team *model.Team
			if tr := <-teamChan; tr.Err != nil {
				return nil, tr.Err
			} else {
				team = tr.Data.(*model.Team)
			}

			var user *model.User
			if ur := <-userChan; ur.Err != nil {
				return nil, ur.Err
			} else {
				user = ur.Data.(*model.User)
			}

			var channel *model.Channel
			if cr := <-chanChan; cr.Err != nil {
				return nil, cr.Err
			} else {
				channel = cr.Data.(*model.Channel)
			}

			teamCmds := result.Data.([]*model.Command)
			for _, cmd := range teamCmds {
				if trigger == cmd.Trigger {
					l4g.Debug(fmt.Sprintf(utils.T("api.command.execute_command.debug"), trigger, args.UserId))

					p := url.Values{}
					p.Set("token", cmd.Token)

					p.Set("team_id", cmd.TeamId)
					p.Set("team_domain", team.Name)

					p.Set("channel_id", args.ChannelId)
					p.Set("channel_name", channel.Name)

					p.Set("user_id", args.UserId)
					p.Set("user_name", user.Username)

					p.Set("command", "/"+trigger)
					p.Set("text", message)

					if hook, err := CreateCommandWebhook(cmd.Id, args); err != nil {
						return nil, model.NewAppError("command", "api.command.execute_command.failed.app_error", map[string]interface{}{"Trigger": trigger}, err.Error(), http.StatusInternalServerError)
					} else {
						p.Set("response_url", args.SiteURL+"/hooks/commands/"+hook.Id)
					}

					method := "POST"
					if cmd.Method == model.COMMAND_METHOD_GET {
						method = "GET"
					}

					req, _ := http.NewRequest(method, cmd.URL, strings.NewReader(p.Encode()))
					req.Header.Set("Accept", "application/json")
					if cmd.Method == model.COMMAND_METHOD_POST {
						req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
					}

					if resp, err := utils.HttpClient(false).Do(req); err != nil {
						return nil, model.NewAppError("command", "api.command.execute_command.failed.app_error", map[string]interface{}{"Trigger": trigger}, err.Error(), http.StatusInternalServerError)
					} else {
						if resp.StatusCode == http.StatusOK {
							response := model.CommandResponseFromHTTPBody(resp.Header.Get("Content-Type"), resp.Body)
							if response == nil {
								return nil, model.NewAppError("command", "api.command.execute_command.failed_empty.app_error", map[string]interface{}{"Trigger": trigger}, "", http.StatusInternalServerError)
							} else {
								return HandleCommandResponse(cmd, args, response, false)
							}
						} else {
							defer resp.Body.Close()
							body, _ := ioutil.ReadAll(resp.Body)
							return nil, model.NewAppError("command", "api.command.execute_command.failed_resp.app_error", map[string]interface{}{"Trigger": trigger, "Status": resp.Status}, string(body), http.StatusInternalServerError)
						}
					}
				}
			}
		}
	}

	return nil, model.NewAppError("command", "api.command.execute_command.not_found.app_error", map[string]interface{}{"Trigger": trigger}, "", http.StatusNotFound)
}

func HandleCommandResponse(command *model.Command, args *model.CommandArgs, response *model.CommandResponse, builtIn bool) (*model.CommandResponse, *model.AppError) {
	post := &model.Post{}
	post.ChannelId = args.ChannelId
	post.RootId = args.RootId
	post.ParentId = args.ParentId
	post.UserId = args.UserId

	if !builtIn {
		post.AddProp("from_webhook", "true")
	}

	if utils.Cfg.ServiceSettings.EnablePostUsernameOverride {
		if len(command.Username) != 0 {
			post.AddProp("override_username", command.Username)
		} else if len(response.Username) != 0 {
			post.AddProp("override_username", response.Username)
		}
	}

	if utils.Cfg.ServiceSettings.EnablePostIconOverride {
		if len(command.IconURL) != 0 {
			post.AddProp("override_icon_url", command.IconURL)
		} else if len(response.IconURL) != 0 {
			post.AddProp("override_icon_url", response.IconURL)
		} else {
			post.AddProp("override_icon_url", "")
		}
	}

	if _, err := CreateCommandPost(post, args.TeamId, response); err != nil {
		l4g.Error(err.Error())
	}

	return response, nil
}

func CreateCommand(cmd *model.Command) (*model.Command, *model.AppError) {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		return nil, model.NewAppError("CreateCommand", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	cmd.Trigger = strings.ToLower(cmd.Trigger)

	if result := <-Srv.Store.Command().GetByTeam(cmd.TeamId); result.Err != nil {
		return nil, result.Err
	} else {
		teamCmds := result.Data.([]*model.Command)
		for _, existingCommand := range teamCmds {
			if cmd.Trigger == existingCommand.Trigger {
				return nil, model.NewAppError("CreateCommand", "api.command.duplicate_trigger.app_error", nil, "", http.StatusBadRequest)
			}
		}
		for _, builtInProvider := range commandProviders {
			builtInCommand := *builtInProvider.GetCommand(utils.T)
			if cmd.Trigger == builtInCommand.Trigger {
				return nil, model.NewAppError("CreateCommand", "api.command.duplicate_trigger.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	if result := <-Srv.Store.Command().Save(cmd); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Command), nil
	}
}

func GetCommand(commandId string) (*model.Command, *model.AppError) {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		return nil, model.NewAppError("GetCommand", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Command().Get(commandId); result.Err != nil {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else {
		return result.Data.(*model.Command), nil
	}
}

func UpdateCommand(oldCmd, updatedCmd *model.Command) (*model.Command, *model.AppError) {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		return nil, model.NewAppError("UpdateCommand", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	updatedCmd.Trigger = strings.ToLower(updatedCmd.Trigger)
	updatedCmd.Id = oldCmd.Id
	updatedCmd.Token = oldCmd.Token
	updatedCmd.CreateAt = oldCmd.CreateAt
	updatedCmd.UpdateAt = model.GetMillis()
	updatedCmd.DeleteAt = oldCmd.DeleteAt
	updatedCmd.CreatorId = oldCmd.CreatorId
	updatedCmd.TeamId = oldCmd.TeamId

	if result := <-Srv.Store.Command().Update(updatedCmd); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Command), nil
	}
}

func RegenCommandToken(cmd *model.Command) (*model.Command, *model.AppError) {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		return nil, model.NewAppError("RegenCommandToken", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	cmd.Token = model.NewId()

	if result := <-Srv.Store.Command().Update(cmd); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Command), nil
	}
}

func DeleteCommand(commandId string) *model.AppError {
	if !*utils.Cfg.ServiceSettings.EnableCommands {
		return model.NewAppError("DeleteCommand", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := (<-Srv.Store.Command().Delete(commandId, model.GetMillis())).Err; err != nil {
		return err
	}

	return nil
}
