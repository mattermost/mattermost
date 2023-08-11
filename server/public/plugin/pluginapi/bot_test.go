package pluginapi

import (
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
)

func TestCreateBot(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := NewClient(api, &plugintest.Driver{})

		api.On("CreateBot", &model.Bot{Username: "1"}).Return(&model.Bot{Username: "1", UserId: "2"}, nil)

		bot := &model.Bot{Username: "1"}
		err := client.Bot.Create(bot)
		require.NoError(t, err)
		require.Equal(t, &model.Bot{Username: "1", UserId: "2"}, bot)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := NewClient(api, &plugintest.Driver{})

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
		client := NewClient(api, &plugintest.Driver{})

		api.On("UpdateBotActive", "1", true).Return(&model.Bot{UserId: "2"}, nil)

		bot, err := client.Bot.UpdateActive("1", true)
		require.NoError(t, err)
		require.Equal(t, &model.Bot{UserId: "2"}, bot)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("UpdateBotActive", "1", true).Return(nil, appErr)

		bot, err := client.Bot.UpdateActive("1", true)
		require.Equal(t, appErr, err)
		require.Zero(t, bot)
	})
}

func TestGetBot(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := NewClient(api, &plugintest.Driver{})

		api.On("GetBot", "1", true).Return(&model.Bot{UserId: "2"}, nil)

		bot, err := client.Bot.Get("1", true)
		require.NoError(t, err)
		require.Equal(t, &model.Bot{UserId: "2"}, bot)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("GetBot", "1", true).Return(nil, appErr)

		bot, err := client.Bot.Get("1", true)
		require.Equal(t, appErr, err)
		require.Zero(t, bot)
	})
}

func TestListBot(t *testing.T) {
	tests := []struct {
		name            string
		page, count     int
		options         []BotListOption
		expectedOptions *model.BotGetOptions
		bots            []*model.Bot
		err             error
	}{
		{
			"owner filter",
			1,
			2,
			[]BotListOption{
				BotOwner("3"),
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
			[]BotListOption{
				BotOwner("3"),
				BotIncludeDeleted(),
				BotOnlyOrphans(),
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
			[]BotListOption{},
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
			[]BotListOption{
				BotOwner("3"),
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
			client := NewClient(api, &plugintest.Driver{})

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

func TestDeleteBotPermanently(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := NewClient(api, &plugintest.Driver{})

		api.On("PermanentDeleteBot", "1").Return(nil)

		err := client.Bot.DeletePermanently("1")
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := NewClient(api, &plugintest.Driver{})

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

	m := testMutex{}

	t.Run("server version incompatible", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := NewClient(api, &plugintest.Driver{})

		api.On("GetServerVersion").Return("5.9.0")

		_, err := client.Bot.ensureBot(m, nil)
		require.Error(t, err)
		assert.Equal(t,
			"failed to ensure bot: incompatible server version for plugin, minimum required version: 5.10.0, current version: 5.9.0",
			err.Error(),
		)
	})

	t.Run("if bot already exists", func(t *testing.T) {
		t.Run("should find and return the existing bot ID", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := NewClient(api, &plugintest.Driver{})

			expectedBotID := model.NewId()

			api.On("GetServerVersion").Return("5.10.0")
			api.On("EnsureBotUser", testbot).Return(expectedBotID, nil)
			botID, err := client.Bot.ensureBot(m, testbot)

			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should set the bot profile image when specified", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := NewClient(api, &plugintest.Driver{})

			expectedBotID := model.NewId()

			profileImageFile, err := os.CreateTemp("", "profile_image")
			require.NoError(t, err)

			profileImageBytes := []byte("profile image")
			err = os.WriteFile(profileImageFile.Name(), profileImageBytes, 0o600)
			require.NoError(t, err)

			api.On("GetBundlePath").Return("", nil)
			api.On("EnsureBotUser", testbot).Return(expectedBotID, nil)
			api.On("SetProfileImage", expectedBotID, profileImageBytes).Return(nil)
			api.On("GetServerVersion").Return("5.10.0")

			botID, err := client.Bot.ensureBot(m, testbot, ProfileImagePath(profileImageFile.Name()))
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})

		t.Run("should find and update the bot with new bot details", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := NewClient(api, &plugintest.Driver{})

			expectedBotID := model.NewId()
			expectedBotUsername := "updated_testbot"
			expectedBotDisplayName := "Updated Test Bot"
			expectedBotDescription := "updated testbotdescription"

			profileImageFile, err := os.CreateTemp("", "profile_image")
			require.NoError(t, err)

			profileImageBytes := []byte("profile image")
			err = os.WriteFile(profileImageFile.Name(), profileImageBytes, 0o600)
			require.NoError(t, err)

			iconImageFile, err := os.CreateTemp("", "profile_image")
			require.NoError(t, err)

			iconImageBytes := []byte("icon image")
			err = os.WriteFile(iconImageFile.Name(), iconImageBytes, 0o600)
			require.NoError(t, err)

			updatedTestBot := &model.Bot{
				Username:    expectedBotUsername,
				DisplayName: expectedBotDisplayName,
				Description: expectedBotDescription,
			}
			api.On("GetServerVersion").Return("5.10.0")
			api.On("EnsureBotUser", updatedTestBot).Return(expectedBotID, nil)
			api.On("GetBundlePath").Return("", nil)
			api.On("SetProfileImage", expectedBotID, profileImageBytes).Return(nil)

			botID, err := client.Bot.ensureBot(m,
				updatedTestBot,
				ProfileImagePath(profileImageFile.Name()),
			)
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})
	})

	t.Run("if bot doesn't exist", func(t *testing.T) {
		t.Run("should create bot and set the bot profile image when specified", func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := NewClient(api, &plugintest.Driver{})

			expectedBotID := model.NewId()

			profileImageFile, err := os.CreateTemp("", "profile_image")
			require.NoError(t, err)

			profileImageBytes := []byte("profile image")
			err = os.WriteFile(profileImageFile.Name(), profileImageBytes, 0o600)
			require.NoError(t, err)

			api.On("EnsureBotUser", testbot).Return(expectedBotID, nil)
			api.On("GetBundlePath").Return("", nil)
			api.On("SetProfileImage", expectedBotID, profileImageBytes).Return(nil)
			api.On("GetServerVersion").Return("5.10.0")

			botID, err := client.Bot.ensureBot(m, testbot, ProfileImagePath(profileImageFile.Name()))
			require.NoError(t, err)
			assert.Equal(t, expectedBotID, botID)
		})
	})
}

func newAppError() *model.AppError {
	return model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)
}

type testMutex struct {
}

func (m testMutex) Lock()   {}
func (m testMutex) Unlock() {}
