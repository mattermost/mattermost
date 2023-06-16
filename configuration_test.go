package pluginapi_test

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestCheckRequiredServerConfiguration(t *testing.T) {
	for name, test := range map[string]struct {
		SetupAPI     func(*plugintest.API) *plugintest.API
		Input        *model.Config
		ShouldReturn bool
		ShouldError  bool
	}{
		"no required config therefore it should be compatible": {
			SetupAPI: func(api *plugintest.API) *plugintest.API {
				return api
			},
			Input:        nil,
			ShouldReturn: true,
			ShouldError:  false,
		},
		"contains required configuration": {
			SetupAPI: func(api *plugintest.API) *plugintest.API {
				api.On("GetConfig").Return(&model.Config{
					ServiceSettings: model.ServiceSettings{
						EnableCommands: model.NewBool(true),
					},
					TeamSettings: model.TeamSettings{
						EnableUserCreation: model.NewBool(true),
					},
				})

				return api
			},
			Input: &model.Config{
				ServiceSettings: model.ServiceSettings{
					EnableCommands: model.NewBool(true),
				},
			},
			ShouldReturn: true,
			ShouldError:  false,
		},
		"does not contain required configuration": {
			SetupAPI: func(api *plugintest.API) *plugintest.API {
				api.On("GetConfig").Return(&model.Config{
					ServiceSettings: model.ServiceSettings{
						EnableCommands: model.NewBool(true),
					},
				})

				return api
			},
			Input: &model.Config{
				ServiceSettings: model.ServiceSettings{
					EnableCommands: model.NewBool(true),
				},
				TeamSettings: model.TeamSettings{
					EnableUserCreation: model.NewBool(true),
				},
			},
			ShouldReturn: false,
			ShouldError:  false,
		},
		"different configurations": {
			SetupAPI: func(api *plugintest.API) *plugintest.API {
				api.On("GetConfig").Return(&model.Config{
					ServiceSettings: model.ServiceSettings{
						EnableCommands: model.NewBool(false),
					},
				})

				return api
			},
			Input: &model.Config{
				ServiceSettings: model.ServiceSettings{
					EnableCommands: model.NewBool(true),
				},
			},
			ShouldReturn: false,
			ShouldError:  false,
		},
		"non-existent configuration": {
			SetupAPI: func(api *plugintest.API) *plugintest.API {
				api.On("GetConfig").Return(&model.Config{})

				return api
			},
			Input: &model.Config{
				ServiceSettings: model.ServiceSettings{
					EnableCommands: model.NewBool(true),
				},
			},
			ShouldReturn: false,
			ShouldError:  false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			api := test.SetupAPI(&plugintest.API{})
			defer api.AssertExpectations(t)

			client := pluginapi.NewClient(api, &plugintest.Driver{})

			ok, err := client.Configuration.CheckRequiredServerConfiguration(test.Input)

			assert.Equal(t, test.ShouldReturn, ok)
			if test.ShouldError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
