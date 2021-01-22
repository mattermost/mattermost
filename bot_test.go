package pluginapi_test

import (
	"bytes"
	"io/ioutil"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestCreateBot(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		api.On("CreateBot", &model.Bot{Username: "1"}).Return(&model.Bot{Username: "1", UserId: "2"}, nil)

		bot := &model.Bot{Username: "1"}
		err := client.Bot.Create(bot)
		require.NoError(t, err)
		require.Equal(t, &model.Bot{Username: "1", UserId: "2"}, bot)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		appErr := newAppError()

		api.On("CreateBot", &model.Bot{Username: "1"}).Return(nil, appErr)

		bot := &model.Bot{Username: "1"}
		err := client.Bot.Create(&model.Bot{Username: "1"})
		require.Equal(t, appErr, err)
		require.Equal(t, &model.Bot{Username: "1"}, bot)
	})
}

func TestUpdateBotStatus(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		api.On("UpdateBotActive", "1", true).Return(&model.Bot{UserId: "2"}, nil)

		bot, err := client.Bot.UpdateActive("1", true)
		require.NoError(t, err)
		require.Equal(t, &model.Bot{UserId: "2"}, bot)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		appErr := newAppError()

		api.On("UpdateBotActive", "1", true).Return(nil, appErr)

		bot, err := client.Bot.UpdateActive("1", true)
		require.Equal(t, appErr, err)
		require.Zero(t, bot)
	})
}

func TestSetBotIconImage(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		api.On("SetBotIconImage", "1", []byte{2}).Return(nil)

		err := client.Bot.SetIconImage("1", bytes.NewReader([]byte{2}))
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		appErr := newAppError()

		api.On("SetBotIconImage", "1", []byte{2}).Return(appErr)

		err := client.Bot.SetIconImage("1", bytes.NewReader([]byte{2}))
		require.Equal(t, appErr, err)
	})
}

func TestGetBot(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		api.On("GetBot", "1", true).Return(&model.Bot{UserId: "2"}, nil)

		bot, err := client.Bot.Get("1", true)
		require.NoError(t, err)
		require.Equal(t, &model.Bot{UserId: "2"}, bot)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		appErr := newAppError()

		api.On("GetBot", "1", true).Return(nil, appErr)

		bot, err := client.Bot.Get("1", true)
		require.Equal(t, appErr, err)
		require.Zero(t, bot)
	})
}

func TestGetBotIconImage(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		api.On("GetBotIconImage", "1").Return([]byte{2}, nil)

		content, err := client.Bot.GetIconImage("1")
		require.NoError(t, err)
		contentBytes, err := ioutil.ReadAll(content)
		require.NoError(t, err)
		require.Equal(t, []byte{2}, contentBytes)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		appErr := newAppError()

		api.On("GetBotIconImage", "1").Return(nil, appErr)

		content, err := client.Bot.GetIconImage("1")
		require.Equal(t, appErr, err)
		require.Zero(t, content)
	})
}

func TestListBot(t *testing.T) {
	tests := []struct {
		name            string
		page, count     int
		options         []pluginapi.BotListOption
		expectedOptions *model.BotGetOptions
		bots            []*model.Bot
		err             error
	}{
		{
			"owner filter",
			1,
			2,
			[]pluginapi.BotListOption{
				pluginapi.BotOwner("3"),
			},
			&model.BotGetOptions{
				Page:    1,
				PerPage: 2,
				OwnerId: "3",
			},
			[]*model.Bot{
				{UserId: "4"},
				{UserId: "5"},
			},
			nil,
		},
		{
			"all filter",
			1,
			2,
			[]pluginapi.BotListOption{
				pluginapi.BotOwner("3"),
				pluginapi.BotIncludeDeleted(),
				pluginapi.BotOnlyOrphans(),
			},
			&model.BotGetOptions{
				Page:           1,
				PerPage:        2,
				OwnerId:        "3",
				IncludeDeleted: true,
				OnlyOrphaned:   true,
			},
			[]*model.Bot{
				{UserId: "4"},
			},
			nil,
		},
		{
			"no filter",
			1,
			2,
			[]pluginapi.BotListOption{},
			&model.BotGetOptions{
				Page:    1,
				PerPage: 2,
			},
			[]*model.Bot{
				{UserId: "4"},
			},
			nil,
		},
		{
			"app error",
			1,
			2,
			[]pluginapi.BotListOption{
				pluginapi.BotOwner("3"),
			},
			&model.BotGetOptions{
				Page:    1,
				PerPage: 2,
				OwnerId: "3",
			},
			nil,
			newAppError(),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			api := &plugintest.API{}
			client := pluginapi.NewClient(api)

			api.On("GetBots", test.expectedOptions).Return(test.bots, test.err)

			bots, err := client.Bot.List(test.page, test.count, test.options...)
			if test.err != nil {
				require.Equal(t, test.err.Error(), err.Error(), test.name)
			} else {
				require.NoError(t, err, test.name)
			}
			require.Equal(t, test.bots, bots, test.name)

			api.AssertExpectations(t)
		})
	}
}

func TestDeleteBotIconImage(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		api.On("DeleteBotIconImage", "1").Return(nil)

		err := client.Bot.DeleteIconImage("1")
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		appErr := newAppError()

		api.On("DeleteBotIconImage", "1").Return(appErr)

		err := client.Bot.DeleteIconImage("1")
		require.Equal(t, appErr, err)
	})
}

func TestDeleteBotPermanently(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		api.On("PermanentDeleteBot", "1").Return(nil)

		err := client.Bot.DeletePermanently("1")
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		appErr := newAppError()

		api.On("PermanentDeleteBot", "1").Return(appErr)

		err := client.Bot.DeletePermanently("1")
		require.Equal(t, appErr, err)
	})
}

func TestEnsureBot(t *testing.T) {
	testbot := &model.Bot{
		Username:    "testbot",
		DisplayName: "Test Bot",
		Description: "testbotdescription",
	}

	t.Run("server version incompatible", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		api.On("GetServerVersion").Return("5.9.0")

		_, err := client.Bot.EnsureBot(nil)
		require.Error(t, err)
		assert.Equal(t,
			"failed to ensure bot: incompatible server version for plugin, minimum required version: 5.10.0, current version: 5.9.0",
			err.Error(),
		)
	})

	t.Run("bad parameters", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		api.On("GetServerVersion").Return("5.10.0")

		t.Run("no bot", func(t *testing.T) {
			botID, err := client.Bot.EnsureBot(nil)
			require.Error(t, err)
			assert.Equal(t, "", botID)
		})

		t.Run("bad username", func(t *testing.T) {
			botID, err := client.Bot.EnsureBot(&model.Bot{
				Username: "",
			})
			require.Error(t, err)
			assert.Equal(t, "", botID)
		})
	})

	t.Run("if bot already exists", func(t *testing.T) {
		t.Run("should find and return the existing bot ID", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()

			api.On("GetServerVersion").Return("5.10.0")
			api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
			api.On("PatchBot", expectedBotID, &model.BotPatch{
				Username:    &testbot.Username,
				DisplayName: &testbot.DisplayName,
				Description: &testbot.Description,
			}).Return(nil, nil)

			botID, err := client.Bot.EnsureBot(testbot)

			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should return an error if unable to get bot", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			api.On("GetServerVersion").Return("5.10.0")
			api.On("KVGet", plugin.BotUserKey).Return(nil, &model.AppError{})

			botID, err := client.Bot.EnsureBot(testbot)

			require.Error(t, err)
			assert.Equal(t, "", botID)
		})

		t.Run("should set the bot profile image when specified", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()

			profileImageFile, err := ioutil.TempFile("", "profile_image")
			require.NoError(t, err)

			profileImageBytes := []byte("profile image")
			err = ioutil.WriteFile(profileImageFile.Name(), profileImageBytes, 0600)
			require.NoError(t, err)

			api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
			api.On("GetBundlePath").Return("", nil)
			api.On("SetProfileImage", expectedBotID, profileImageBytes).Return(nil)
			api.On("GetServerVersion").Return("5.10.0")
			api.On("PatchBot", expectedBotID, &model.BotPatch{
				Username:    &testbot.Username,
				DisplayName: &testbot.DisplayName,
				Description: &testbot.Description,
			}).Return(nil, nil)

			botID, err := client.Bot.EnsureBot(testbot, pluginapi.ProfileImagePath(profileImageFile.Name()))
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should set the bot icon image when specified", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()

			iconImageFile, err := ioutil.TempFile("", "profile_image")
			require.NoError(t, err)

			iconImageBytes := []byte("icon image")
			err = ioutil.WriteFile(iconImageFile.Name(), iconImageBytes, 0600)
			require.NoError(t, err)

			api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
			api.On("GetBundlePath").Return("", nil)
			api.On("SetBotIconImage", expectedBotID, iconImageBytes).Return(nil)
			api.On("GetServerVersion").Return("5.10.0")
			api.On("PatchBot", expectedBotID, &model.BotPatch{
				Username:    &testbot.Username,
				DisplayName: &testbot.DisplayName,
				Description: &testbot.Description,
			}).Return(nil, nil)

			botID, err := client.Bot.EnsureBot(testbot, pluginapi.IconImagePath(iconImageFile.Name()))
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should set both the profile image and bot icon image when specified", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()

			profileImageFile, err := ioutil.TempFile("", "profile_image")
			require.NoError(t, err)

			profileImageBytes := []byte("profile image")
			err = ioutil.WriteFile(profileImageFile.Name(), profileImageBytes, 0600)
			require.NoError(t, err)

			iconImageFile, err := ioutil.TempFile("", "profile_image")
			require.NoError(t, err)

			iconImageBytes := []byte("icon image")
			err = ioutil.WriteFile(iconImageFile.Name(), iconImageBytes, 0600)
			require.NoError(t, err)

			api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
			api.On("GetBundlePath").Return("", nil)
			api.On("SetProfileImage", expectedBotID, profileImageBytes).Return(nil)
			api.On("SetBotIconImage", expectedBotID, iconImageBytes).Return(nil)
			api.On("GetServerVersion").Return("5.10.0")
			api.On("PatchBot", expectedBotID, &model.BotPatch{
				Username:    &testbot.Username,
				DisplayName: &testbot.DisplayName,
				Description: &testbot.Description,
			}).Return(nil, nil)

			botID, err := client.Bot.EnsureBot(
				testbot,
				pluginapi.ProfileImagePath(profileImageFile.Name()),
				pluginapi.IconImagePath(iconImageFile.Name()),
			)
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should find and update the bot with new bot details", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()
			expectedBotUsername := "updated_testbot"
			expectedBotDisplayName := "Updated Test Bot"
			expectedBotDescription := "updated testbotdescription"

			profileImageFile, err := ioutil.TempFile("", "profile_image")
			require.NoError(t, err)

			profileImageBytes := []byte("profile image")
			err = ioutil.WriteFile(profileImageFile.Name(), profileImageBytes, 0600)
			require.NoError(t, err)

			iconImageFile, err := ioutil.TempFile("", "profile_image")
			require.NoError(t, err)

			iconImageBytes := []byte("icon image")
			err = ioutil.WriteFile(iconImageFile.Name(), iconImageBytes, 0600)
			require.NoError(t, err)

			api.On("GetServerVersion").Return("5.10.0")
			api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
			api.On("GetBundlePath").Return("", nil)
			api.On("SetProfileImage", expectedBotID, profileImageBytes).Return(nil)
			api.On("SetBotIconImage", expectedBotID, iconImageBytes).Return(nil)
			api.On("PatchBot", expectedBotID, &model.BotPatch{
				Username:    &expectedBotUsername,
				DisplayName: &expectedBotDisplayName,
				Description: &expectedBotDescription,
			}).Return(nil, nil)

			updatedTestBot := &model.Bot{
				Username:    expectedBotUsername,
				DisplayName: expectedBotDisplayName,
				Description: expectedBotDescription,
			}
			botID, err := client.Bot.EnsureBot(
				updatedTestBot,
				pluginapi.ProfileImagePath(profileImageFile.Name()),
				pluginapi.IconImagePath(iconImageFile.Name()),
			)
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})
	})

	t.Run("if bot doesn't exist", func(t *testing.T) {
		t.Run("should create the bot and return the ID", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()

			api.On("GetServerVersion").Return("5.10.0")
			api.On("KVGet", plugin.BotUserKey).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(nil, nil)
			api.On("CreateBot", testbot).Return(&model.Bot{
				UserId: expectedBotID,
			}, nil)
			api.On("KVSet", plugin.BotUserKey, []byte(expectedBotID)).Return(nil)

			botID, err := client.Bot.EnsureBot(testbot)
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should claim existing bot and return the ID", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()

			api.On("GetServerVersion").Return("5.10.0")
			api.On("KVGet", plugin.BotUserKey).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(&model.User{
				Id:    expectedBotID,
				IsBot: true,
			}, nil)
			api.On("KVSet", plugin.BotUserKey, []byte(expectedBotID)).Return(nil)

			botID, err := client.Bot.EnsureBot(testbot)
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should return the non-bot account but log a message if user exists with the same name and is not a bot", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()

			api.On("GetServerVersion").Return("5.10.0")
			api.On("KVGet", plugin.BotUserKey).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(&model.User{
				Id:    expectedBotID,
				IsBot: false,
			}, nil)
			api.On("LogError", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()

			botID, err := client.Bot.EnsureBot(testbot)
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should fail if create bot fails", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			api.On("GetServerVersion").Return("5.10.0")
			api.On("KVGet", plugin.BotUserKey).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(nil, nil)
			api.On("CreateBot", testbot).Return(nil, &model.AppError{})

			botID, err := client.Bot.EnsureBot(testbot)
			require.Error(t, err)
			assert.Equal(t, "", botID)
		})

		t.Run("should create bot and set the bot profile image when specified", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()

			profileImageFile, err := ioutil.TempFile("", "profile_image")
			require.NoError(t, err)

			profileImageBytes := []byte("profile image")
			err = ioutil.WriteFile(profileImageFile.Name(), profileImageBytes, 0600)
			require.NoError(t, err)

			api.On("KVGet", plugin.BotUserKey).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(nil, nil)
			api.On("CreateBot", testbot).Return(&model.Bot{
				UserId: expectedBotID,
			}, nil)
			api.On("KVSet", plugin.BotUserKey, []byte(expectedBotID)).Return(nil)
			api.On("GetBundlePath").Return("", nil)
			api.On("SetProfileImage", expectedBotID, profileImageBytes).Return(nil)
			api.On("GetServerVersion").Return("5.10.0")

			botID, err := client.Bot.EnsureBot(testbot, pluginapi.ProfileImagePath(profileImageFile.Name()))
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should create bot and set the bot icon image when specified", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()

			iconImageFile, err := ioutil.TempFile("", "profile_image")
			require.NoError(t, err)

			iconImageBytes := []byte("icon image")
			err = ioutil.WriteFile(iconImageFile.Name(), iconImageBytes, 0600)
			require.NoError(t, err)

			api.On("KVGet", plugin.BotUserKey).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(nil, nil)
			api.On("CreateBot", testbot).Return(&model.Bot{
				UserId: expectedBotID,
			}, nil)
			api.On("KVSet", plugin.BotUserKey, []byte(expectedBotID)).Return(nil)
			api.On("GetBundlePath").Return("", nil)
			api.On("SetBotIconImage", expectedBotID, iconImageBytes).Return(nil)
			api.On("GetServerVersion").Return("5.10.0")

			botID, err := client.Bot.EnsureBot(testbot, pluginapi.IconImagePath(iconImageFile.Name()))
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should create bot and set both the profile image and bot icon image when specified", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api)

			expectedBotID := model.NewId()

			profileImageFile, err := ioutil.TempFile("", "profile_image")
			require.NoError(t, err)

			profileImageBytes := []byte("profile image")
			err = ioutil.WriteFile(profileImageFile.Name(), profileImageBytes, 0600)
			require.NoError(t, err)

			iconImageFile, err := ioutil.TempFile("", "profile_image")
			require.NoError(t, err)

			iconImageBytes := []byte("icon image")
			err = ioutil.WriteFile(iconImageFile.Name(), iconImageBytes, 0600)
			require.NoError(t, err)

			api.On("KVGet", plugin.BotUserKey).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(nil, nil)
			api.On("CreateBot", testbot).Return(&model.Bot{
				UserId: expectedBotID,
			}, nil)
			api.On("KVSet", plugin.BotUserKey, []byte(expectedBotID)).Return(nil)
			api.On("GetBundlePath").Return("", nil)
			api.On("SetProfileImage", expectedBotID, profileImageBytes).Return(nil)
			api.On("SetBotIconImage", expectedBotID, iconImageBytes).Return(nil)
			api.On("GetServerVersion").Return("5.10.0")

			botID, err := client.Bot.EnsureBot(
				testbot,
				pluginapi.ProfileImagePath(profileImageFile.Name()),
				pluginapi.IconImagePath(iconImageFile.Name()),
			)
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})
	})
}
