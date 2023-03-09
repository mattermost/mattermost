// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/platform/shared/mlog"
)

func TestCreateCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	LocalClient := th.LocalClient

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "trigger"}

	_, resp, err := client.CreateCommand(newCmd)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	createdCmd, resp, err := th.SystemAdminClient.CreateCommand(newCmd)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.Equal(t, th.SystemAdminUser.Id, createdCmd.CreatorId, "user ids didn't match")
	require.Equal(t, th.BasicTeam.Id, createdCmd.TeamId, "team ids didn't match")

	_, resp, err = th.SystemAdminClient.CreateCommand(newCmd)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	CheckErrorID(t, err, "api.command.duplicate_trigger.app_error")

	newCmd.Trigger = "Local"
	localCreatedCmd, resp, err := LocalClient.CreateCommand(newCmd)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.Equal(t, th.BasicUser.Id, localCreatedCmd.CreatorId, "local client: user ids didn't match")
	require.Equal(t, th.BasicTeam.Id, localCreatedCmd.TeamId, "local client: team ids didn't match")

	newCmd.Method = "Wrong"
	newCmd.Trigger = "testcommand"
	_, resp, err = th.SystemAdminClient.CreateCommand(newCmd)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	CheckErrorID(t, err, "model.command.is_valid.method.app_error")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = false })
	newCmd.Method = "P"
	newCmd.Trigger = "testcommand"
	_, resp, err = th.SystemAdminClient.CreateCommand(newCmd)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
	CheckErrorID(t, err, "api.command.disabled.app_error")

	// Confirm that local clients can't override disable command setting
	newCmd.Trigger = "LocalOverride"
	_, _, err = LocalClient.CreateCommand(newCmd)
	CheckErrorID(t, err, "api.command.disabled.app_error")
}

func TestUpdateCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
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
		Method:    model.CommandMethodPost,
		Trigger:   "trigger1",
	}

	cmd1, _ = th.App.CreateCommand(cmd1)

	cmd2 := &model.Command{
		CreatorId: GenerateTestId(),
		TeamId:    team.Id,
		URL:       "http://nowhere.com/change",
		Method:    model.CommandMethodGet,
		Trigger:   "trigger2",
		Id:        cmd1.Id,
		Token:     "tokenchange",
	}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcmd, _, err := client.UpdateCommand(cmd2)
		require.NoError(t, err)

		require.Equal(t, cmd2.Trigger, rcmd.Trigger, "Trigger should have updated")

		require.Equal(t, cmd2.Method, rcmd.Method, "Method should have updated")

		require.Equal(t, cmd2.URL, rcmd.URL, "URL should have updated")

		require.Equal(t, cmd1.CreatorId, rcmd.CreatorId, "CreatorId should have not updated")

		require.Equal(t, cmd1.Token, rcmd.Token, "Token should have not updated")

		cmd2.Id = GenerateTestId()

		rcmd, resp, err := client.UpdateCommand(cmd2)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		require.Nil(t, rcmd, "should be empty")

		cmd2.Id = "junk"

		_, resp, err = client.UpdateCommand(cmd2)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		cmd2.Id = cmd1.Id
		cmd2.TeamId = GenerateTestId()

		_, resp, err = client.UpdateCommand(cmd2)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		cmd2.TeamId = team.Id

		_, resp, err = th.Client.UpdateCommand(cmd2)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
	th.SystemAdminClient.Logout()
	_, resp, err := th.SystemAdminClient.UpdateCommand(cmd2)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestMoveCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	user := th.SystemAdminUser
	team := th.BasicTeam
	newTeam := th.CreateTeam()

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	cmd1 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "trigger1",
	}

	rcmd1, _ := th.App.CreateCommand(cmd1)
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, err := client.MoveCommand(newTeam.Id, rcmd1.Id)
		require.NoError(t, err)

		rcmd1, _ = th.App.GetCommand(rcmd1.Id)
		require.NotNil(t, rcmd1)
		require.Equal(t, newTeam.Id, rcmd1.TeamId)

		resp, err := client.MoveCommand(newTeam.Id, "bogus")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		resp, err = client.MoveCommand(GenerateTestId(), rcmd1.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
	cmd2 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "trigger2",
	}

	rcmd2, _ := th.App.CreateCommand(cmd2)

	resp, err := th.Client.MoveCommand(newTeam.Id, rcmd2.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	th.SystemAdminClient.Logout()
	resp, err = th.SystemAdminClient.MoveCommand(newTeam.Id, rcmd2.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestDeleteCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
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
		Method:    model.CommandMethodPost,
		Trigger:   "trigger1",
	}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		cmd1.Id = ""
		rcmd1, appErr := th.App.CreateCommand(cmd1)
		require.Nil(t, appErr)
		_, err := client.DeleteCommand(rcmd1.Id)
		require.NoError(t, err)

		rcmd1, _ = th.App.GetCommand(rcmd1.Id)
		require.Nil(t, rcmd1)

		resp, err := client.DeleteCommand("junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		resp, err = client.DeleteCommand(GenerateTestId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
	cmd2 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "trigger2",
	}

	rcmd2, _ := th.App.CreateCommand(cmd2)

	resp, err := th.Client.DeleteCommand(rcmd2.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	th.SystemAdminClient.Logout()
	resp, err = th.SystemAdminClient.DeleteCommand(rcmd2.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestListCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "custom_command"}

	_, _, err := th.SystemAdminClient.CreateCommand(newCmd)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		listCommands, _, err := c.ListCommands(th.BasicTeam.Id, false)
		require.NoError(t, err)

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
		require.True(t, foundEcho, "Couldn't find echo command")
		require.True(t, foundCustom, "Should list the custom command")
	}, "ListSystemAndCustomCommands")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		listCommands, _, err := c.ListCommands(th.BasicTeam.Id, true)
		require.NoError(t, err)

		require.Len(t, listCommands, 1, "Should list just one custom command")
		require.Equal(t, listCommands[0].Trigger, "custom_command", "Wrong custom command trigger")
	}, "ListCustomOnlyCommands")

	t.Run("UserWithNoPermissionForCustomCommands", func(t *testing.T) {
		_, resp, err := client.ListCommands(th.BasicTeam.Id, true)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("RegularUserCanListOnlySystemCommands", func(t *testing.T) {
		listCommands, _, err := client.ListCommands(th.BasicTeam.Id, false)
		require.NoError(t, err)

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
		require.True(t, foundEcho, "Couldn't find echo command")
		require.False(t, foundCustom, "Should not list the custom command")
	})

	t.Run("NoMember", func(t *testing.T) {
		client.Logout()
		user := th.CreateUser()
		th.SystemAdminClient.RemoveTeamMember(th.BasicTeam.Id, user.Id)
		client.Login(user.Email, user.Password)
		_, resp, err := client.ListCommands(th.BasicTeam.Id, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		_, resp, err = client.ListCommands(th.BasicTeam.Id, true)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		client.Logout()
		_, resp, err := client.ListCommands(th.BasicTeam.Id, false)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		_, resp, err = client.ListCommands(th.BasicTeam.Id, true)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestListAutocompleteCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "custom_command"}

	_, _, err := th.SystemAdminClient.CreateCommand(newCmd)
	require.NoError(t, err)

	t.Run("ListAutocompleteCommandsOnly", func(t *testing.T) {
		listCommands, _, err := th.SystemAdminClient.ListAutocompleteCommands(th.BasicTeam.Id)
		require.NoError(t, err)

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
		require.True(t, foundEcho, "Couldn't find echo command")
		require.False(t, foundCustom, "Should not list the custom command")
	})

	t.Run("RegularUserCanListOnlySystemCommands", func(t *testing.T) {
		listCommands, _, err := client.ListAutocompleteCommands(th.BasicTeam.Id)
		require.NoError(t, err)

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
		require.True(t, foundEcho, "Couldn't find echo command")
		require.False(t, foundCustom, "Should not list the custom command")
	})

	t.Run("NoMember", func(t *testing.T) {
		client.Logout()
		user := th.CreateUser()
		th.SystemAdminClient.RemoveTeamMember(th.BasicTeam.Id, user.Id)
		client.Login(user.Email, user.Password)
		_, resp, err := client.ListAutocompleteCommands(th.BasicTeam.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		client.Logout()
		_, resp, err := client.ListAutocompleteCommands(th.BasicTeam.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestListCommandAutocompleteSuggestions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "custom_command"}

	_, _, err := th.SystemAdminClient.CreateCommand(newCmd)
	require.NoError(t, err)

	t.Run("ListAutocompleteSuggestionsOnly", func(t *testing.T) {
		suggestions, _, err := th.SystemAdminClient.ListCommandAutocompleteSuggestions("/", th.BasicTeam.Id)
		require.NoError(t, err)

		foundEcho := false
		foundShrug := false
		foundCustom := false
		for _, command := range suggestions {
			if command.Suggestion == "echo" {
				foundEcho = true
			}
			if command.Suggestion == "shrug" {
				foundShrug = true
			}
			if command.Suggestion == "custom_command" {
				foundCustom = true
			}
		}
		require.True(t, foundEcho, "Couldn't find echo command")
		require.True(t, foundShrug, "Couldn't find shrug command")
		require.False(t, foundCustom, "Should not list the custom command")
	})

	t.Run("ListAutocompleteSuggestionsOnlyWithInput", func(t *testing.T) {
		suggestions, _, err := th.SystemAdminClient.ListCommandAutocompleteSuggestions("/e", th.BasicTeam.Id)
		require.NoError(t, err)

		foundEcho := false
		foundShrug := false
		for _, command := range suggestions {
			if command.Suggestion == "echo" {
				foundEcho = true
			}
			if command.Suggestion == "shrug" {
				foundShrug = true
			}
		}
		require.True(t, foundEcho, "Couldn't find echo command")
		require.False(t, foundShrug, "Should not list the shrug command")
	})

	t.Run("RegularUserCanListOnlySystemCommands", func(t *testing.T) {
		suggestions, _, err := client.ListCommandAutocompleteSuggestions("/", th.BasicTeam.Id)
		require.NoError(t, err)

		foundEcho := false
		foundCustom := false
		for _, suggestion := range suggestions {
			if suggestion.Suggestion == "echo" {
				foundEcho = true
			}
			if suggestion.Suggestion == "custom_command" {
				foundCustom = true
			}
		}
		require.True(t, foundEcho, "Couldn't find echo command")
		require.False(t, foundCustom, "Should not list the custom command")
	})

	t.Run("NoMember", func(t *testing.T) {
		client.Logout()
		user := th.CreateUser()
		th.SystemAdminClient.RemoveTeamMember(th.BasicTeam.Id, user.Id)
		client.Login(user.Email, user.Password)
		_, resp, err := client.ListCommandAutocompleteSuggestions("/", th.BasicTeam.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		client.Logout()
		_, resp, err := client.ListCommandAutocompleteSuggestions("/", th.BasicTeam.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "roger"}

	newCmd, _, err := th.SystemAdminClient.CreateCommand(newCmd)
	require.NoError(t, err)
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {

		t.Run("ValidId", func(t *testing.T) {
			cmd, _, err := client.GetCommandById(newCmd.Id)
			require.NoError(t, err)

			require.Equal(t, newCmd.Id, cmd.Id)
			require.Equal(t, newCmd.CreatorId, cmd.CreatorId)
			require.Equal(t, newCmd.TeamId, cmd.TeamId)
			require.Equal(t, newCmd.URL, cmd.URL)
			require.Equal(t, newCmd.Method, cmd.Method)
			require.Equal(t, newCmd.Trigger, cmd.Trigger)
		})

		t.Run("InvalidId", func(t *testing.T) {
			_, _, err := client.GetCommandById(strings.Repeat("z", len(newCmd.Id)))
			require.Error(t, err)
		})
	})
	t.Run("UserWithNoPermissionForCustomCommands", func(t *testing.T) {
		_, resp, err := th.Client.GetCommandById(newCmd.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("NoMember", func(t *testing.T) {
		th.Client.Logout()
		user := th.CreateUser()
		th.SystemAdminClient.RemoveTeamMember(th.BasicTeam.Id, user.Id)
		th.Client.Login(user.Email, user.Password)
		_, resp, err := th.Client.GetCommandById(newCmd.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		th.Client.Logout()
		_, resp, err := th.Client.GetCommandById(newCmd.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestRegenToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "trigger"}

	createdCmd, resp, err := th.SystemAdminClient.CreateCommand(newCmd)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	token, _, err := th.SystemAdminClient.RegenCommandToken(createdCmd.Id)
	require.NoError(t, err)
	require.NotEqual(t, createdCmd.Token, token, "should update the token")

	token, resp, err = client.RegenCommandToken(createdCmd.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
	require.Empty(t, token, "should not return the token")
}

func TestExecuteInvalidCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
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

		if err := json.NewEncoder(w).Encode(rc); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	getCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodGet,
		Trigger:   "getcommand",
	}

	_, appErr := th.App.CreateCommand(getCmd)
	require.Nil(t, appErr, "failed to create get command")

	_, resp, err := client.ExecuteCommand(channel.Id, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.ExecuteCommand(channel.Id, "/")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.ExecuteCommand(channel.Id, "getcommand")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.ExecuteCommand(channel.Id, "/junk")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	otherUser := th.CreateUser()
	client.Login(otherUser.Email, otherUser.Password)

	_, resp, err = client.ExecuteCommand(channel.Id, "/getcommand")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	client.Logout()

	_, resp, err = client.ExecuteCommand(channel.Id, "/getcommand")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.ExecuteCommand(channel.Id, "/getcommand")
	require.NoError(t, err)
}

func TestExecuteGetCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
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
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodGet, r.Method)

		values, err := url.ParseQuery(r.URL.RawQuery)
		require.NoError(t, err)

		require.Equal(t, token, values.Get("token"))
		require.Equal(t, th.BasicTeam.Name, values.Get("team_domain"))
		require.Equal(t, "ourCommand", values.Get("cmd"))

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	getCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       ts.URL + "/?cmd=ourCommand",
		Method:    model.CommandMethodGet,
		Trigger:   "getcommand",
		Token:     token,
	}

	_, appErr := th.App.CreateCommand(getCmd)
	require.Nil(t, appErr, "failed to create get command")

	commandResponse, _, err := client.ExecuteCommand(channel.Id, "/getcommand")
	require.NoError(t, err)
	assert.True(t, len(commandResponse.TriggerId) == 26)

	expectedCommandResponse.TriggerId = commandResponse.TriggerId
	require.Equal(t, expectedCommandResponse, commandResponse)
}

func TestExecutePostCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
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
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)

		r.ParseForm()

		require.Equal(t, token, r.FormValue("token"))
		require.Equal(t, th.BasicTeam.Name, r.FormValue("team_domain"))

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
		Token:     token,
	}

	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create get command")

	commandResponse, _, err := client.ExecuteCommand(channel.Id, "/postcommand")
	require.NoError(t, err)
	assert.True(t, len(commandResponse.TriggerId) == 26)

	expectedCommandResponse.TriggerId = commandResponse.TriggerId
	require.Equal(t, expectedCommandResponse, commandResponse)
}

func TestExecuteCommandAgainstChannelOnAnotherTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
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
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	// create a slash command on some other team where we have permission to do so
	team2 := th.CreateTeam()
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
	}
	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create post command")

	// the execute command endpoint will always search for the command by trigger and team id, inferring team id from the
	// channel id, so there is no way to use that slash command on a channel that belongs to some other team
	_, resp, err := client.ExecuteCommand(channel.Id, "/postcommand")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestExecuteCommandAgainstChannelUserIsNotIn(t *testing.T) {
	th := Setup(t).InitBasic()
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
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	// create a slash command on some other team where we have permission to do so
	team2 := th.CreateTeam()
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
	}
	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create post command")

	// make a channel on that team, ensuring that our test user isn't in it
	channel2 := th.CreateChannelWithClientAndTeam(client, model.ChannelTypeOpen, team2.Id)
	_, err := th.Client.RemoveUserFromChannel(channel2.Id, th.BasicUser.Id)
	require.NoError(t, err, "Failed to remove user from channel")

	// we should not be able to run the slash command in channel2, because we aren't in it
	_, resp, err := client.ExecuteCommandWithTeam(channel2.Id, team2.Id, "/postcommand")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestExecuteCommandInDirectMessageChannel(t *testing.T) {
	th := Setup(t).InitBasic()
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
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	// create a team that the user isn't a part of
	team2 := th.CreateTeam()

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	// create a slash command on some other team where we have permission to do so
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
	}
	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create post command")

	// make a direct message channel
	dmChannel, response, err := client.CreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)

	// we should be able to run the slash command in the DM channel
	_, resp, err := client.ExecuteCommandWithTeam(dmChannel.Id, team2.Id, "/postcommand")
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	// but we can't run the slash command in the DM channel if we sub in some other team's id
	_, resp, err = client.ExecuteCommandWithTeam(dmChannel.Id, th.BasicTeam.Id, "/postcommand")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestExecuteCommandInTeamUserIsNotOn(t *testing.T) {
	th := Setup(t).InitBasic()
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
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	// create a team that the user isn't a part of
	team2 := th.CreateTeam()

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		r.ParseForm()
		require.Equal(t, team2.Name, r.FormValue("team_domain"))

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	// create a slash command on that team
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
	}
	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create post command")

	// make a direct message channel
	dmChannel, response, err := client.CreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)

	// we should be able to run the slash command in the DM channel
	_, resp, err := client.ExecuteCommandWithTeam(dmChannel.Id, team2.Id, "/postcommand")
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	// if the user is removed from the team, they should NOT be able to run the slash command in the DM channel
	_, err = th.Client.RemoveTeamMember(team2.Id, th.BasicUser.Id)
	require.NoError(t, err, "Failed to remove user from team")

	_, resp, err = client.ExecuteCommandWithTeam(dmChannel.Id, team2.Id, "/postcommand")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// if we omit the team id from the request, the slash command will fail because this is a DM channel, and the
	// team id can't be inherited from the channel
	_, resp, err = client.ExecuteCommand(dmChannel.Id, "/postcommand")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}
