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

func TestKVGetJSON(t *testing.T) {
	setupAPI := func() *plugintest.API {
		return &plugintest.API{}
	}

	t.Run("KVGet error", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := setupAPI()
		api.On("KVGet", plugin.BOT_USER_KEY).Return(nil, &model.AppError{})
		p.API = api

		var dat map[string]interface{}

		err := p.KVGetJSON(plugin.BOT_USER_KEY, dat)

		api.AssertExpectations(t)
		assert.NotNil(t, err)
		assert.Nil(t, dat)
	})

	t.Run("Malformed JSON", func(t *testing.T) {
		key := "test-key"

		p := &plugin.HelpersImpl{}

		api := setupAPI()
		api.On("KVGet", key).Return([]byte(`{{:}"val-a": 10}`), nil)
		p.API = api

		var dat map[string]interface{}

		err := p.KVGetJSON(key, &dat)

		api.AssertExpectations(t)
		assert.NotNil(t, err)
		assert.Nil(t, dat)
	})

	t.Run("Valid parameters passed (happy-path)", func(t *testing.T) {
		key := "test-key"

		p := &plugin.HelpersImpl{}

		api := setupAPI()
		api.On("KVGet", key).Return([]byte(`{"val-a": 10}`), nil)
		p.API = api

		var dat map[string]interface{}

		err := p.KVGetJSON(key, &dat)

		api.AssertExpectations(t)
		assert.Nil(t, err)
		assert.Equal(t, map[string]interface{}{
			"val-a": float64(10),
		}, dat)
	})
}

func TestKVSetJSON(t *testing.T) {
	key := "test-key"

	setupAPI := func() *plugintest.API {
		return &plugintest.API{}
	}

	t.Run("JSON Marshal error", func(t *testing.T) {
		api := setupAPI()
		api.AssertNotCalled(t, "KVSet")

		p := &plugin.HelpersImpl{API: api}

		err := p.KVSetJSON(key, func() { return })

		api.AssertExpectations(t)
		assert.NotNil(t, err)
	})

	t.Run("Valid parameters passed (Happy-path)", func(t *testing.T) {
		api := setupAPI()
		api.On("KVSet", key, []byte(`{"val-a":10}`)).Return(nil)

		p := &plugin.HelpersImpl{API: api}

		err := p.KVSetJSON(key, map[string]interface{}{
			"val-a": float64(10),
		})

		api.AssertExpectations(t)
		assert.Nil(t, err)
	})
}

func TestKVCompareAndSetJSON(t *testing.T) {
	key := "test-key"
	setupAPI := func() *plugintest.API {
		return &plugintest.API{}
	}

	t.Run("old value JSON marshal error", func(t *testing.T) {
		api := setupAPI()
		api.AssertNotCalled(t, "KVCompareAndSet")
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndSetJSON(key, func() { return }, map[string]interface{}{})

		api.AssertExpectations(t)
		assert.Equal(t, false, ok)
		assert.NotNil(t, err)
	})

	t.Run("new value JSON marshal error", func(t *testing.T) {
		api := setupAPI()
		api.AssertNotCalled(t, "KVCompareAndSet")

		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndSetJSON(key, map[string]interface{}{}, func() { return })

		api.AssertExpectations(t)
		assert.Equal(t, false, ok)
		assert.NotNil(t, err)
	})

	t.Run("Valid parameters passed (happy-path)", func(t *testing.T) {
		api := setupAPI()
		api.On("KVCompareAndSet", key, []byte(`{"val-a":10}`), []byte(`{"val-b":20}`)).Return(false, nil)
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndSetJSON(key, map[string]interface{}{
			"val-a": 10,
		}, map[string]interface{}{
			"val-b": 20,
		})

		api.AssertExpectations(t)
		assert.Equal(t, false, ok)
		assert.Nil(t, err)
	})
}

func TestKVSetWithExpiryJSON(t *testing.T) {
	key := "test-key"

	setupAPI := func() *plugintest.API {
		return &plugintest.API{}
	}

	t.Run("JSON Marshal error", func(t *testing.T) {
		api := setupAPI()
		api.AssertNotCalled(t, "KVSetWithExpiry")

		p := &plugin.HelpersImpl{API: api}

		err := p.KVSetWithExpiryJSON(key, func() { return }, 100)

		api.AssertExpectations(t)
		assert.NotNil(t, err)
	})

	t.Run("valid parameters passed (happy-path)", func(t *testing.T) {
		api := setupAPI()
		api.On("KVSetWithExpiry", key, []byte(`{"val-a":10}`), int64(100)).Return(nil)

		p := &plugin.HelpersImpl{API: api}

		err := p.KVSetWithExpiryJSON(key, map[string]interface{}{
			"val-a": float64(10),
		}, 100)

		api.AssertExpectations(t)
		assert.Nil(t, err)
	})
}
