package pluginapi_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

func TestCache(t *testing.T) {
	t.Run("set json value with ttl", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("CacheSet", "k", []byte(`{"a":1}`), int64(30)).Return(nil)
		require.NoError(t, client.Cache.Set("k", map[string]int{"a": 1}, 30*time.Second))
	})

	t.Run("get hit and miss", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("CacheGet", "hit").Return([]byte(`{"a":1}`), nil)
		api.On("CacheGet", "miss").Return(nil, nil)

		var out map[string]int
		ok, err := client.Cache.Get("hit", &out)
		require.NoError(t, err)
		assert.True(t, ok)
		assert.Equal(t, map[string]int{"a": 1}, out)

		ok, err = client.Cache.Get("miss", &out)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("errors are propagated", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("CacheDelete", "k").Return(newAppError())
		assert.Error(t, client.Cache.Delete("k"))
	})
}
