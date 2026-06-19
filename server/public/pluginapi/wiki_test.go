package pluginapi

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
)

func TestGetFirstWikiForChannel(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := NewClient(api, &plugintest.Driver{})

		api.On("GetFirstWikiForChannel", "channel1").Return("wiki1", nil)

		wikiID, err := client.Wiki.GetFirstWikiForChannel("channel1")
		require.NoError(t, err)
		require.Equal(t, "wiki1", wikiID)
	})

	t.Run("failure", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("GetFirstWikiForChannel", "channel1").Return("", appErr)

		wikiID, err := client.Wiki.GetFirstWikiForChannel("channel1")
		require.Equal(t, appErr, err)
		require.Empty(t, wikiID)
	})
}

func TestCreatePage(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := NewClient(api, &plugintest.Driver{})

		expectedPage := &model.Page{Id: "post1", Title: "Test Page"}

		api.On("CreateWikiPage", "wiki1", "Test Page", "content", "user1").Return(expectedPage, nil)

		page, err := client.Wiki.CreatePage("wiki1", "Test Page", "content", "user1")
		require.NoError(t, err)
		require.Equal(t, expectedPage, page)
	})

	t.Run("failure", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("CreateWikiPage", "wiki1", "Test Page", "content", "user1").Return(nil, appErr)

		post, err := client.Wiki.CreatePage("wiki1", "Test Page", "content", "user1")
		require.Equal(t, appErr, err)
		require.Zero(t, post)
	})
}
