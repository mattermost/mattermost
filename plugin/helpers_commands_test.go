package plugin_test

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestEnsureBot(t *testing.T) {
	setupAPI := func() *plugintest.API {
		return &plugintest.API{}
	}

	buildCommandArgs := func(command string) *model.CommandArgs {
		return &model.CommandArgs{
			UserId:    "test_user",
			ChannelId: "test_channel",
			TeamId:    "test_team",
			RootId:    "test_root",
			ParentId:  "parent_id",
			TriggerId: "test_command",
			Command:   command,
			SiteURL:   "test_site",
			T:         nil,
			Session:   model.Session{},
		}
	}

	testCommand := &model.Command{
		Trigger:          "test_command",
		AutoComplete:     true,
		AutoCompleteDesc: "Test command.",
		DisplayName:      "Test command",
	}

	testContext := &plugin.Context{
		SessionId:      "test_session_id",
		RequestId:      "test_request_id",
		IpAddress:      "127.0.0.1",
		AcceptLanguage: "test",
		UserAgent:      "test",
	}

	t.Run("Register command", func(t *testing.T) {
		t.Run("should fail if no callback is provided", func(t *testing.T) {
			p := &plugin.HelpersImpl{}
			err := p.RegisterCommand(testCommand, nil)
			assert.NotNil(t, err)
			assert.Equal(t, err.Error(), "Cannot register a command without callback")
		})

		t.Run("should register and store the callback", func(t *testing.T) {
			api := setupAPI()
			api.On("RegisterCommand", mock.AnythingOfType("*model.Command")).Return(nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{}
			p.API = api
			testCallback := func(args *plugin.CommandArgs, originalArgs *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
				return nil, nil
			}
			err := p.RegisterCommand(testCommand, testCallback)
			assert.Nil(t, err)
			p.CommandCallbacks.Range(func(key interface{}, value interface{}) bool {
				assert.Equal(t, "test_command", key)
				assert.NotNil(t, value)
				return true
			})
		})
	})

	t.Run("Execute command", func(t *testing.T) {
		t.Run("should parse command arguments", func(t *testing.T) {
			api := setupAPI()
			api.On("RegisterCommand", mock.AnythingOfType("*model.Command")).Return(nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{}
			p.API = api
			testCallback := func(args *plugin.CommandArgs, originalArgs *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
				assert.Equal(t, args.Trigger, "test_command")
				assert.Equal(t, args.Args[0], "one")
				assert.Equal(t, len(args.Args), 3)
				assert.Equal(t, originalArgs.Command, "/test_command one two three")
				return nil, nil
			}
			err := p.RegisterCommand(testCommand, testCallback)
			testCommandArgs := buildCommandArgs("/test_command one two three")
			response, err := p.ExecuteCommand(testContext, testCommandArgs)
			assert.Nil(t, err)
			assert.Nil(t, response)
		})

		t.Run("should parse command even without arguments", func(t *testing.T) {
			api := setupAPI()
			api.On("RegisterCommand", mock.AnythingOfType("*model.Command")).Return(nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{}
			p.API = api
			testCallback := func(args *plugin.CommandArgs, originalArgs *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
				assert.Equal(t, args.Trigger, "test_command")
				assert.Equal(t, len(args.Args), 0)
				assert.Equal(t, originalArgs.Command, "/test_command")
				return nil, nil
			}
			err := p.RegisterCommand(testCommand, testCallback)
			testCommandArgs := buildCommandArgs("/test_command")
			response, err := p.ExecuteCommand(testContext, testCommandArgs)
			assert.Nil(t, err)
			assert.Nil(t, response)
		})

		t.Run("should execute the defined callback", func(t *testing.T) {
			api := setupAPI()
			api.On("RegisterCommand", mock.AnythingOfType("*model.Command")).Return(nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{}
			p.API = api
			testCallback := func(args *plugin.CommandArgs, originalArgs *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
				return &model.CommandResponse{}, nil
			}
			err := p.RegisterCommand(testCommand, testCallback)
			testCommandArgs := buildCommandArgs("/test_command one two three")
			response, err := p.ExecuteCommand(testContext, testCommandArgs)
			assert.Nil(t, err)
			assert.IsType(t, &model.CommandResponse{}, response)
		})
	})
}
