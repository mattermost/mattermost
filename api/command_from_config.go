// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"io/ioutil"
	"net/url"
	"net/http"
	"fmt"
	"strings"
	"crypto/tls"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type ConfigCommandProvider struct {
	model.CommandSetting
}

func InitCommandFromConfig() {
	for _, command := range utils.Cfg.CommandsSettings {
		RegisterCommandProvider(&ConfigCommandProvider{command})
	}
}

func (me *ConfigCommandProvider) GetTrigger() string {
	return me.Trigger
}

func (me *ConfigCommandProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          me.Trigger,
		AutoComplete:     me.AutoComplete,
		AutoCompleteDesc: me.AutoCompleteDesc,
		AutoCompleteHint: me.AutoCompleteHint,
		DisplayName:      me.DisplayName,
	}
}

func (me *ConfigCommandProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	chanChan := Srv.Store.Channel().Get(channelId)
	teamChan := Srv.Store.Team().Get(c.TeamId)
	userChan := Srv.Store.User().Get(c.Session.UserId)

	var team *model.Team
	if tr := <-teamChan; tr.Err != nil {
		c.Err = tr.Err
		return nil
	} else {
		team = tr.Data.(*model.Team)
	}

	var user *model.User
	if ur := <-userChan; ur.Err != nil {
		c.Err = ur.Err
		return nil
	} else {
		user = ur.Data.(*model.User)
	}

	var channel *model.Channel
	if cr := <-chanChan; cr.Err != nil {
		c.Err = cr.Err
		return nil
	} else {
		channel = cr.Data.(*model.Channel)
	}

	l4g.Debug(fmt.Sprintf(utils.T("api.command.execute_command.debug"), me.Trigger, c.Session.UserId))

	p := url.Values{}
	p.Set("token", me.Token)

	p.Set("team_id", c.TeamId)
	p.Set("team_domain", team.Name)

	p.Set("channel_id", channel.Id)
	p.Set("channel_name", channel.Name)

	p.Set("user_id", c.Session.UserId)
	p.Set("user_name", user.Username)

	p.Set("command", "/"+me.Trigger)
	p.Set("text", message)
	p.Set("response_url", "not supported yet")

	method := "POST"
	if me.Method == model.COMMAND_METHOD_GET {
		method = "GET"
	}

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
	}
	client := &http.Client{Transport: tr}

	req, _ := http.NewRequest(method, me.URL, strings.NewReader(p.Encode()))
	req.Header.Set("Accept", "application/json")
	if me.Method == model.COMMAND_METHOD_POST {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}

	if resp, err := client.Do(req); err != nil {
		c.Err = model.NewLocAppError("command", "api.command.execute_command.failed.app_error", map[string]interface{}{"Trigger": me.Trigger}, err.Error())
		return nil
	} else {
		if resp.StatusCode == http.StatusOK {
			response := model.CommandResponseFromJson(resp.Body)
			if response == nil {
				c.Err = model.NewLocAppError("command", "api.command.execute_command.failed_empty.app_error", map[string]interface{}{"Trigger": me.Trigger}, "")
			} else {
				return response
			}
		} else {
			defer resp.Body.Close()
			body, _ := ioutil.ReadAll(resp.Body)
			c.Err = model.NewLocAppError("command", "api.command.execute_command.failed_resp.app_error", map[string]interface{}{"Trigger": me.Trigger, "Status": resp.Status}, string(body))
		}
	}
	return nil
}
