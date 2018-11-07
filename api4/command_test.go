// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestCreateCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger"}

	_, resp := Client.CreateCommand(newCmd)
	CheckForbiddenStatus(t, resp)

	createdCmd, resp := th.SystemAdminClient.CreateCommand(newCmd)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)
	if createdCmd.CreatorId != th.SystemAdminUser.Id {
		t.Fatal("user ids didn't match")
	}
	if createdCmd.TeamId != th.BasicTeam.Id {
		t.Fatal("team ids didn't match")
	}

	_, resp = th.SystemAdminClient.CreateCommand(newCmd)
	CheckBadRequestStatus(t, resp)
	CheckErrorMessage(t, resp, "api.command.duplicate_trigger.app_error")

	newCmd.Method = "Wrong"
	newCmd.Trigger = "testcommand"
	_, resp = th.SystemAdminClient.CreateCommand(newCmd)
	CheckBadRequestStatus(t, resp)
	CheckErrorMessage(t, resp, "model.command.is_valid.method.app_error")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = false })
	newCmd.Method = "P"
	newCmd.Trigger = "testcommand"
	_, resp = th.SystemAdminClient.CreateCommand(newCmd)
	CheckNotImplementedStatus(t, resp)
	CheckErrorMessage(t, resp, "api.command.disabled.app_error")
}

func TestUpdateCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.BasicTeam

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	cmd1 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger1",
	}

	cmd1, _ = th.App.CreateCommand(cmd1)

	cmd2 := &model.Command{
		CreatorId: GenerateTestId(),
		TeamId:    team.Id,
		URL:       "http://nowhere.com/change",
		Method:    model.COMMAND_METHOD_GET,
		Trigger:   "trigger2",
		Id:        cmd1.Id,
		Token:     "tokenchange",
	}

	rcmd, resp := Client.UpdateCommand(cmd2)
	CheckNoError(t, resp)

	if rcmd.Trigger != cmd2.Trigger {
		t.Fatal("Trigger should have updated")
	}

	if rcmd.Method != cmd2.Method {
		t.Fatal("Method should have updated")
	}

	if rcmd.URL != cmd2.URL {
		t.Fatal("URL should have updated")
	}

	if rcmd.CreatorId != cmd1.CreatorId {
		t.Fatal("CreatorId should have not updated")
	}

	if rcmd.Token != cmd1.Token {
		t.Fatal("Token should have not updated")
	}

	cmd2.Id = GenerateTestId()

	rcmd, resp = Client.UpdateCommand(cmd2)
	CheckNotFoundStatus(t, resp)

	if rcmd != nil {
		t.Fatal("should be empty")
	}

	cmd2.Id = "junk"

	_, resp = Client.UpdateCommand(cmd2)
	CheckBadRequestStatus(t, resp)

	cmd2.Id = cmd1.Id
	cmd2.TeamId = GenerateTestId()

	_, resp = Client.UpdateCommand(cmd2)
	CheckBadRequestStatus(t, resp)

	cmd2.TeamId = team.Id

	_, resp = th.Client.UpdateCommand(cmd2)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.UpdateCommand(cmd2)
	CheckUnauthorizedStatus(t, resp)
}

func TestDeleteCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.BasicTeam

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	cmd1 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger1",
	}

	rcmd1, _ := th.App.CreateCommand(cmd1)

	ok, resp := Client.DeleteCommand(rcmd1.Id)
	CheckNoError(t, resp)

	if !ok {
		t.Fatal("should have returned true")
	}

	rcmd1, _ = th.App.GetCommand(rcmd1.Id)
	if rcmd1 != nil {
		t.Fatal("should be nil")
	}

	ok, resp = Client.DeleteCommand("junk")
	CheckBadRequestStatus(t, resp)

	if ok {
		t.Fatal("should have returned false")
	}

	_, resp = Client.DeleteCommand(GenerateTestId())
	CheckNotFoundStatus(t, resp)

	cmd2 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger2",
	}

	rcmd2, _ := th.App.CreateCommand(cmd2)

	_, resp = th.Client.DeleteCommand(rcmd2.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.DeleteCommand(rcmd2.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestListCommands(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "custom_command"}

	_, resp := th.SystemAdminClient.CreateCommand(newCmd)
	CheckNoError(t, resp)

	t.Run("ListSystemAndCustomCommands", func(t *testing.T) {
		listCommands, resp := th.SystemAdminClient.ListCommands(th.BasicTeam.Id, false)
		CheckNoError(t, resp)

		foundEcho := false
		foundCustom := false
		for _, command := range listCommands {
			if command.Trigger == "echo" {
				foundEcho = true
			}
			if command.Trigger == "custom_command" {
				foundCustom = true
			}
		}
		if !foundEcho {
			t.Fatal("Couldn't find echo command")
		}
		if !foundCustom {
			t.Fatal("Should list the custom command")
		}
	})

	t.Run("ListCustomOnlyCommands", func(t *testing.T) {
		listCommands, resp := th.SystemAdminClient.ListCommands(th.BasicTeam.Id, true)
		CheckNoError(t, resp)

		if len(listCommands) > 1 {
			t.Fatal("Should list just one custom command")
		}
		if listCommands[0].Trigger != "custom_command" {
			t.Fatal("Wrong custom command trigger")
		}
	})

	t.Run("UserWithNoPermissionForCustomCommands", func(t *testing.T) {
		_, resp := Client.ListCommands(th.BasicTeam.Id, true)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("RegularUserCanListOnlySystemCommands", func(t *testing.T) {
		listCommands, resp := Client.ListCommands(th.BasicTeam.Id, false)
		CheckNoError(t, resp)

		foundEcho := false
		foundCustom := false
		for _, command := range listCommands {
			if command.Trigger == "echo" {
				foundEcho = true
			}
			if command.Trigger == "custom_command" {
				foundCustom = true
			}
		}
		if !foundEcho {
			t.Fatal("Couldn't find echo command")
		}
		if foundCustom {
			t.Fatal("Should not list the custom command")
		}
	})
}

func TestListAutocompleteCommands(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "custom_command"}

	_, resp := th.SystemAdminClient.CreateCommand(newCmd)
	CheckNoError(t, resp)

	t.Run("ListAutocompleteCommandsOnly", func(t *testing.T) {
		listCommands, resp := th.SystemAdminClient.ListAutocompleteCommands(th.BasicTeam.Id)
		CheckNoError(t, resp)

		foundEcho := false
		foundCustom := false
		for _, command := range listCommands {
			if command.Trigger == "echo" {
				foundEcho = true
			}
			if command.Trigger == "custom_command" {
				foundCustom = true
			}
		}
		if !foundEcho {
			t.Fatal("Couldn't find echo command")
		}
		if foundCustom {
			t.Fatal("Should not list the custom command")
		}
	})

	t.Run("RegularUserCanListOnlySystemCommands", func(t *testing.T) {
		listCommands, resp := Client.ListAutocompleteCommands(th.BasicTeam.Id)
		CheckNoError(t, resp)

		foundEcho := false
		foundCustom := false
		for _, command := range listCommands {
			if command.Trigger == "echo" {
				foundEcho = true
			}
			if command.Trigger == "custom_command" {
				foundCustom = true
			}
		}
		if !foundEcho {
			t.Fatal("Couldn't find echo command")
		}
		if foundCustom {
			t.Fatal("Should not list the custom command")
		}
	})
}

func TestRegenToken(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger"}

	createdCmd, resp := th.SystemAdminClient.CreateCommand(newCmd)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	token, resp := th.SystemAdminClient.RegenCommandToken(createdCmd.Id)
	CheckNoError(t, resp)
	if token == createdCmd.Token {
		t.Fatal("should update the token")
	}

	token, resp = Client.RegenCommandToken(createdCmd.Id)
	CheckForbiddenStatus(t, resp)
	if token != "" {
		t.Fatal("should not return the token")
	}
}

func TestExecuteInvalidCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	allowedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = &allowedInternalConnections
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.0/8" })

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rc := &model.CommandResponse{}

		w.Write([]byte(rc.ToJson()))
	}))
	defer ts.Close()

	getCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       ts.URL,
		Method:    model.COMMAND_METHOD_GET,
		Trigger:   "getcommand",
	}

	if _, err := th.App.CreateCommand(getCmd); err != nil {
		t.Fatal("failed to create get command")
	}

	_, resp := Client.ExecuteCommand(channel.Id, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.ExecuteCommand(channel.Id, "/")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.ExecuteCommand(channel.Id, "getcommand")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.ExecuteCommand(channel.Id, "/junk")
	CheckNotFoundStatus(t, resp)

	otherUser := th.CreateUser()
	Client.Login(otherUser.Email, otherUser.Password)

	_, resp = Client.ExecuteCommand(channel.Id, "/getcommand")
	CheckForbiddenStatus(t, resp)

	Client.Logout()

	_, resp = Client.ExecuteCommand(channel.Id, "/getcommand")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.ExecuteCommand(channel.Id, "/getcommand")
	CheckNoError(t, resp)
}

func TestExecuteGetCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	allowedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = &allowedInternalConnections
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.0/8" })

	token := model.NewId()
	expectedCommandResponse := &model.CommandResponse{
		Text:         "test get command response",
		ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL,
		Type:         "custom_test",
		Props:        map[string]interface{}{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodGet, r.Method)

		values, err := url.ParseQuery(r.URL.RawQuery)
		require.NoError(t, err)

		require.Equal(t, token, values.Get("token"))
		require.Equal(t, th.BasicTeam.Name, values.Get("team_domain"))
		require.Equal(t, "ourCommand", values.Get("cmd"))

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(expectedCommandResponse.ToJson()))
	}))
	defer ts.Close()

	getCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       ts.URL + "/?cmd=ourCommand",
		Method:    model.COMMAND_METHOD_GET,
		Trigger:   "getcommand",
		Token:     token,
	}

	if _, err := th.App.CreateCommand(getCmd); err != nil {
		t.Fatal("failed to create get command")
	}

	commandResponse, resp := Client.ExecuteCommand(channel.Id, "/getcommand")
	CheckNoError(t, resp)
	assert.True(t, len(commandResponse.TriggerId) == 26)

	expectedCommandResponse.TriggerId = commandResponse.TriggerId
	expectedCommandResponse.Props["from_webhook"] = "true"
	require.Equal(t, expectedCommandResponse, commandResponse)
}

func TestExecutePostCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	allowedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = &allowedInternalConnections
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.0/8" })

	token := model.NewId()
	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL,
		Type:         "custom_test",
		Props:        map[string]interface{}{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)

		r.ParseForm()

		require.Equal(t, token, r.FormValue("token"))
		require.Equal(t, th.BasicTeam.Name, r.FormValue("team_domain"))

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(expectedCommandResponse.ToJson()))
	}))
	defer ts.Close()

	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       ts.URL,
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "postcommand",
		Token:     token,
	}

	if _, err := th.App.CreateCommand(postCmd); err != nil {
		t.Fatal("failed to create get command")
	}

	commandResponse, resp := Client.ExecuteCommand(channel.Id, "/postcommand")
	CheckNoError(t, resp)
	assert.True(t, len(commandResponse.TriggerId) == 26)

	expectedCommandResponse.TriggerId = commandResponse.TriggerId
	expectedCommandResponse.Props["from_webhook"] = "true"
	require.Equal(t, expectedCommandResponse, commandResponse)

}

func TestExecuteCommandAgainstChannelOnAnotherTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	allowedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = &allowedInternalConnections
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"
	})

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL,
		Type:         "custom_test",
		Props:        map[string]interface{}{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(expectedCommandResponse.ToJson()))
	}))
	defer ts.Close()

	// create a slash command on some other team where we have permission to do so
	team2 := th.CreateTeam()
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "postcommand",
	}
	if _, err := th.App.CreateCommand(postCmd); err != nil {
		t.Fatal("failed to create post command")
	}

	// the execute command endpoint will always search for the command by trigger and team id, inferring team id from the
	// channel id, so there is no way to use that slash command on a channel that belongs to some other team
	_, resp := Client.ExecuteCommand(channel.Id, "/postcommand")
	CheckNotFoundStatus(t, resp)
}

func TestExecuteCommandAgainstChannelUserIsNotIn(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	allowedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = &allowedInternalConnections
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"
	})

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL,
		Type:         "custom_test",
		Props:        map[string]interface{}{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(expectedCommandResponse.ToJson()))
	}))
	defer ts.Close()

	// create a slash command on some other team where we have permission to do so
	team2 := th.CreateTeam()
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "postcommand",
	}
	if _, err := th.App.CreateCommand(postCmd); err != nil {
		t.Fatal("failed to create post command")
	}

	// make a channel on that team, ensuring that our test user isn't in it
	channel2 := th.CreateChannelWithClientAndTeam(client, model.CHANNEL_OPEN, team2.Id)
	if success, _ := client.RemoveUserFromChannel(channel2.Id, th.BasicUser.Id); !success {
		t.Fatal("Failed to remove user from channel")
	}

	// we should not be able to run the slash command in channel2, because we aren't in it
	_, resp := client.ExecuteCommandWithTeam(channel2.Id, team2.Id, "/postcommand")
	CheckForbiddenStatus(t, resp)
}

func TestExecuteCommandInDirectMessageChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	allowedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = &allowedInternalConnections
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"
	})

	// create a team that the user isn't a part of
	team2 := th.CreateTeam()

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL,
		Type:         "custom_test",
		Props:        map[string]interface{}{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(expectedCommandResponse.ToJson()))
	}))
	defer ts.Close()

	// create a slash command on some other team where we have permission to do so
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "postcommand",
	}
	if _, err := th.App.CreateCommand(postCmd); err != nil {
		t.Fatal("failed to create post command")
	}

	// make a direct message channel
	dmChannel, response := client.CreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	CheckCreatedStatus(t, response)

	// we should be able to run the slash command in the DM channel
	_, resp := client.ExecuteCommandWithTeam(dmChannel.Id, team2.Id, "/postcommand")
	CheckOKStatus(t, resp)

	// but we can't run the slash command in the DM channel if we sub in some other team's id
	_, resp = client.ExecuteCommandWithTeam(dmChannel.Id, th.BasicTeam.Id, "/postcommand")
	CheckNotFoundStatus(t, resp)
}

func TestExecuteCommandInTeamUserIsNotOn(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	allowedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = &allowedInternalConnections
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"
	})

	// create a team that the user isn't a part of
	team2 := th.CreateTeam()

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL,
		Type:         "custom_test",
		Props:        map[string]interface{}{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		r.ParseForm()
		require.Equal(t, team2.Name, r.FormValue("team_domain"))

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(expectedCommandResponse.ToJson()))
	}))
	defer ts.Close()

	// create a slash command on that team
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "postcommand",
	}
	if _, err := th.App.CreateCommand(postCmd); err != nil {
		t.Fatal("failed to create post command")
	}

	// make a direct message channel
	dmChannel, response := client.CreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	CheckCreatedStatus(t, response)

	// we should be able to run the slash command in the DM channel
	_, resp := client.ExecuteCommandWithTeam(dmChannel.Id, team2.Id, "/postcommand")
	CheckOKStatus(t, resp)

	// if the user is removed from the team, they should NOT be able to run the slash command in the DM channel
	if success, _ := client.RemoveTeamMember(team2.Id, th.BasicUser.Id); !success {
		t.Fatal("Failed to remove user from team")
	}
	_, resp = client.ExecuteCommandWithTeam(dmChannel.Id, team2.Id, "/postcommand")
	CheckForbiddenStatus(t, resp)

	// if we omit the team id from the request, the slash command will fail because this is a DM channel, and the
	// team id can't be inherited from the channel
	_, resp = client.ExecuteCommand(dmChannel.Id, "/postcommand")
	CheckForbiddenStatus(t, resp)
}
