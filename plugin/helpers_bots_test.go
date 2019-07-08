// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin_test

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/mattermost/mattermost-server/plugin/plugintest/mock"
	"github.com/stretchr/testify/assert"
)

func TestEnsureBot(t *testing.T) {
	setupAPI := func() *plugintest.API {
		return &plugintest.API{}
	}

	testbot := &model.Bot{
		Username:    "testbot",
		DisplayName: "Test Bot",
		Description: "testbotdescription",
	}

	t.Run("bad parameters", func(t *testing.T) {
		t.Run("no bot", func(t *testing.T) {
			p := &plugin.HelpersImpl{}
			botId, err := p.EnsureBot(nil)
			assert.Equal(t, "", botId)
			assert.NotNil(t, err)
		})
		t.Run("bad username", func(t *testing.T) {
			p := &plugin.HelpersImpl{}
			botId, err := p.EnsureBot(&model.Bot{
				Username: "",
			})
			assert.Equal(t, "", botId)
			assert.NotNil(t, err)
		})
	})

	t.Run("if bot already exists", func(t *testing.T) {
		t.Run("should find and return the existing bot ID", func(t *testing.T) {
			expectedBotId := model.NewId()

			api := setupAPI()
			api.On("KVGet", plugin.BOT_USER_KEY).Return([]byte(expectedBotId), nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{}
			p.API = api

			botId, err := p.EnsureBot(testbot)

			assert.Equal(t, expectedBotId, botId)
			assert.Nil(t, err)
		})

		t.Run("should return an error if unable to get bot", func(t *testing.T) {
			api := setupAPI()
			api.On("KVGet", plugin.BOT_USER_KEY).Return(nil, &model.AppError{})
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{}
			p.API = api

			botId, err := p.EnsureBot(testbot)

			assert.Equal(t, "", botId)
			assert.NotNil(t, err)
		})
	})

	t.Run("if bot doesn't exist", func(t *testing.T) {
		t.Run("should create the bot and return the ID", func(t *testing.T) {
			expectedBotId := model.NewId()

			api := setupAPI()
			api.On("KVGet", plugin.BOT_USER_KEY).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(nil, nil)
			api.On("CreateBot", testbot).Return(&model.Bot{
				UserId: expectedBotId,
			}, nil)
			api.On("KVSet", plugin.BOT_USER_KEY, []byte(expectedBotId)).Return(nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{}
			p.API = api

			botId, err := p.EnsureBot(testbot)

			assert.Equal(t, expectedBotId, botId)
			assert.Nil(t, err)
		})

		t.Run("should claim existing bot and return the ID", func(t *testing.T) {
			expectedBotId := model.NewId()

			api := setupAPI()
			api.On("KVGet", plugin.BOT_USER_KEY).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(&model.User{
				Id:    expectedBotId,
				IsBot: true,
			}, nil)
			api.On("KVSet", plugin.BOT_USER_KEY, []byte(expectedBotId)).Return(nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{}
			p.API = api

			botId, err := p.EnsureBot(testbot)

			assert.Equal(t, expectedBotId, botId)
			assert.Nil(t, err)
		})

		t.Run("should return the non-bot account but log a message if user exists with the same name and is not a bot", func(t *testing.T) {
			expectedBotId := model.NewId()
			api := setupAPI()
			api.On("KVGet", plugin.BOT_USER_KEY).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(&model.User{
				Id:    expectedBotId,
				IsBot: false,
			}, nil)
			api.On("LogError", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{}
			p.API = api

			botId, err := p.EnsureBot(testbot)

			assert.Equal(t, expectedBotId, botId)
			assert.Nil(t, err)
		})

		t.Run("shoudl fail if create bot fails", func(t *testing.T) {
			api := setupAPI()
			api.On("KVGet", plugin.BOT_USER_KEY).Return(nil, nil)
			api.On("GetUserByUsername", testbot.Username).Return(nil, nil)
			api.On("CreateBot", testbot).Return(nil, &model.AppError{})
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{}
			p.API = api

			botId, err := p.EnsureBot(testbot)

			assert.Equal(t, "", botId)
			assert.NotNil(t, err)
		})
	})
}
