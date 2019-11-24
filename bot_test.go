package pluginapi

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestCreateBot(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("CreateBot", &model.Bot{Username: "1"}).Return(&model.Bot{Username: "1", UserId: "2"}, nil)

		bot := &model.Bot{Username: "1"}
		err := client.Bot.Create(bot)
		require.NoError(t, err)
		require.Equal(t, &model.Bot{Username: "1", UserId: "2"}, bot)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("CreateBot", &model.Bot{Username: "1"}).Return(nil, appErr)

		bot := &model.Bot{Username: "1"}
		err := client.Bot.Create(&model.Bot{Username: "1"})
		require.Equal(t, appErr, err)
		require.Equal(t, &model.Bot{Username: "1"}, bot)
	})
}

func TestUpdateBot(t *testing.T) {
	userName := "userName"
	displayName := "displayName"
	description := "description"
	tests := []struct {
		name            string
		botUserID       string
		options         []BotUpdateOption
		expectedOptions *model.BotPatch
		bot             *model.Bot
		err             error
	}{
		{
			"user name update",
			"1",
			[]BotUpdateOption{
				BotUserNameUpdate(userName),
			},
			&model.BotPatch{
				Username: &userName,
			},
			&model.Bot{
				UserId: "2",
			},
			nil,
		},
		{
			"update all",
			"1",
			[]BotUpdateOption{
				BotUserNameUpdate(userName),
				BotDisplayNameUpdate(displayName),
				BotDescriptionUpdate(description),
			},
			&model.BotPatch{
				Username:    &userName,
				DisplayName: &displayName,
				Description: &description,
			},
			&model.Bot{
				UserId: "2",
			},
			nil,
		},
		{
			"no update options error",
			"1",
			nil,
			nil,
			nil,
			errors.New("no update options provided"),
		},
		{
			"app error",
			"1",
			[]BotUpdateOption{
				BotUserNameUpdate(userName),
			},
			&model.BotPatch{
				Username: &userName,
			},
			nil,
			model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			api := &plugintest.API{}

			client := NewClient(api)

			if len(test.options) > 0 {
				api.On("PatchBot", test.botUserID, test.expectedOptions).Return(test.bot, test.err)
			}

			bot, err := client.Bot.Update(test.botUserID, test.options...)
			if test.err != nil {
				require.Equal(t, test.err.Error(), err.Error(), test.name)
			} else {
				require.NoError(t, err, test.name)
			}
			require.Equal(t, test.bot, bot, test.name)

			api.AssertExpectations(t)
		})
	}
}

func TestUpdateBotStatus(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("UpdateBotActive", "1", true).Return(&model.Bot{UserId: "2"}, nil)

		bot, err := client.Bot.UpdateStatus("1", true)
		require.NoError(t, err)
		require.Equal(t, &model.Bot{UserId: "2"}, bot)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("UpdateBotActive", "1", true).Return(nil, appErr)

		bot, err := client.Bot.UpdateStatus("1", true)
		require.Equal(t, appErr, err)
		require.Zero(t, bot)
	})
}

func TestSetBotIconImage(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("SetBotIconImage", "1", []byte{2}).Return(nil)

		err := client.Bot.SetIconImage("1", bytes.NewReader([]byte{2}))
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("SetBotIconImage", "1", []byte{2}).Return(appErr)

		err := client.Bot.SetIconImage("1", bytes.NewReader([]byte{2}))
		require.Equal(t, appErr, err)
	})
}

func TestGetBot(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("GetBot", "1", true).Return(&model.Bot{UserId: "2"}, nil)

		bot, err := client.Bot.Get("1", true)
		require.NoError(t, err)
		require.Equal(t, &model.Bot{UserId: "2"}, bot)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

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

		client := NewClient(api)

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

		client := NewClient(api)

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

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
			model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			api := &plugintest.API{}

			client := NewClient(api)

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

		client := NewClient(api)

		api.On("DeleteBotIconImage", "1").Return(nil)

		err := client.Bot.DeleteIconImage("1")
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("DeleteBotIconImage", "1").Return(appErr)

		err := client.Bot.DeleteIconImage("1")
		require.Equal(t, appErr, err)
	})
}

func TestDeleteBotPermanently(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("PermanentDeleteBot", "1").Return(nil)

		err := client.Bot.DeletePermanently("1")
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("PermanentDeleteBot", "1").Return(appErr)

		err := client.Bot.DeletePermanently("1")
		require.Equal(t, appErr, err)
	})
}
