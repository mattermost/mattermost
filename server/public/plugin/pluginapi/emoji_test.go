package pluginapi_test

import (
	"io"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestGetEmoji(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetEmoji", "1").Return(&model.Emoji{Id: "2"}, nil)

		emoji, err := client.Emoji.Get("1")
		require.NoError(t, err)
		require.Equal(t, "2", emoji.Id)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("GetEmoji", "1").Return(nil, appErr)

		emoji, err := client.Emoji.Get("1")
		require.Equal(t, appErr, err)
		require.Zero(t, emoji)
	})
}

func TestGetEmojiByName(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetEmojiByName", "1").Return(&model.Emoji{Id: "2"}, nil)

		emoji, err := client.Emoji.GetByName("1")
		require.NoError(t, err)
		require.Equal(t, "2", emoji.Id)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("GetEmojiByName", "1").Return(nil, appErr)

		emoji, err := client.Emoji.GetByName("1")
		require.Equal(t, appErr, err)
		require.Zero(t, emoji)
	})
}

func TestGetEmojiImage(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetEmojiImage", "1").Return([]byte{1}, "jpg", nil)

		content, format, err := client.Emoji.GetImage("1")
		require.NoError(t, err)
		contentBytes, err := io.ReadAll(content)
		require.NoError(t, err)
		require.Equal(t, []byte{1}, contentBytes)
		require.Equal(t, "jpg", format)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("GetEmojiImage", "1").Return(nil, "", appErr)

		content, format, err := client.Emoji.GetImage("1")
		require.Equal(t, appErr, err)
		require.Zero(t, content)
		require.Zero(t, format)
	})
}

func TestListEmojis(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetEmojiList", "1", 2, 3).Return([]*model.Emoji{
			{Id: "4"},
		}, nil)

		emojis, err := client.Emoji.List("1", 2, 3)
		require.NoError(t, err)
		require.Len(t, emojis, 1)
		require.Equal(t, "4", emojis[0].Id)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("GetEmojiList", "1", 2, 3).Return(nil, appErr)

		emojis, err := client.Emoji.List("1", 2, 3)
		require.Equal(t, appErr, err)
		require.Zero(t, emojis)
	})
}
