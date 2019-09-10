package plugin_test

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/stretchr/testify/assert"
)

func TestKVGetJSON(t *testing.T) {
	t.Run("KVGet error", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("KVGet", "test-key").Return(nil, &model.AppError{})
		p.API = api

		var dat map[string]interface{}

		ok, err := p.KVGetJSON("test-key", dat)
		api.AssertExpectations(t)
		assert.False(t, ok)
		assert.Error(t, err)
		assert.Nil(t, dat)
	})

	t.Run("unknown key", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("KVGet", "test-key").Return(nil, nil)
		p.API = api

		var dat map[string]interface{}

		ok, err := p.KVGetJSON("test-key", dat)
		api.AssertExpectations(t)
		assert.False(t, ok)
		assert.NoError(t, err)
		assert.Nil(t, dat)
	})

	t.Run("malformed JSON", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("KVGet", "test-key").Return([]byte(`{{:}"val-a": 10}`), nil)
		p.API = api

		var dat map[string]interface{}

		ok, err := p.KVGetJSON("test-key", &dat)
		api.AssertExpectations(t)
		assert.False(t, ok)
		assert.Error(t, err)
		assert.Nil(t, dat)
	})

	t.Run("wellformed JSON", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("KVGet", "test-key").Return([]byte(`{"val-a": 10}`), nil)
		p.API = api

		var dat map[string]interface{}

		ok, err := p.KVGetJSON("test-key", &dat)
		assert.True(t, ok)
		api.AssertExpectations(t)
		assert.NoError(t, err)
		assert.Equal(t, map[string]interface{}{
			"val-a": float64(10),
		}, dat)
	})
}

func TestKVSetJSON(t *testing.T) {
	t.Run("JSON marshal error", func(t *testing.T) {
		api := &plugintest.API{}
		api.AssertNotCalled(t, "KVSet")

		p := &plugin.HelpersImpl{API: api}

		err := p.KVSetJSON("test-key", func() { return })
		api.AssertExpectations(t)
		assert.Error(t, err)
	})

	t.Run("KVSet error", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVSet", "test-key", []byte(`{"val-a":10}`)).Return(&model.AppError{})

		p := &plugin.HelpersImpl{API: api}

		err := p.KVSetJSON("test-key", map[string]interface{}{
			"val-a": float64(10),
		})

		api.AssertExpectations(t)
		assert.Error(t, err)
	})

	t.Run("marshallable struct", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVSet", "test-key", []byte(`{"val-a":10}`)).Return(nil)

		p := &plugin.HelpersImpl{API: api}

		err := p.KVSetJSON("test-key", map[string]interface{}{
			"val-a": float64(10),
		})

		api.AssertExpectations(t)
		assert.NoError(t, err)
	})
}

func TestKVCompareAndSetJSON(t *testing.T) {
	t.Run("old value JSON marshal error", func(t *testing.T) {
		api := &plugintest.API{}
		api.AssertNotCalled(t, "KVCompareAndSet")
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndSetJSON("test-key", func() { return }, map[string]interface{}{})

		api.AssertExpectations(t)
		assert.Equal(t, false, ok)
		assert.Error(t, err)
	})

	t.Run("new value JSON marshal error", func(t *testing.T) {
		api := &plugintest.API{}
		api.AssertNotCalled(t, "KVCompareAndSet")

		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndSetJSON("test-key", map[string]interface{}{}, func() { return })

		api.AssertExpectations(t)
		assert.False(t, ok)
		assert.Error(t, err)
	})

	t.Run("KVCompareAndSet error", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVCompareAndSet", "test-key", []byte(`{"val-a":10}`), []byte(`{"val-b":20}`)).Return(false, &model.AppError{})
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndSetJSON("test-key", map[string]interface{}{
			"val-a": 10,
		}, map[string]interface{}{
			"val-b": 20,
		})

		api.AssertExpectations(t)
		assert.False(t, ok)
		assert.Error(t, err)
	})

	t.Run("old value nil", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVCompareAndSet", "test-key", []byte(nil), []byte(`{"val-b":20}`)).Return(true, nil)
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndSetJSON("test-key", nil, map[string]interface{}{
			"val-b": 20,
		})

		api.AssertExpectations(t)
		assert.True(t, ok)
		assert.NoError(t, err)
	})

	t.Run("old value non-nil", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVCompareAndSet", "test-key", []byte(`{"val-a":10}`), []byte(`{"val-b":20}`)).Return(true, nil)
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndSetJSON("test-key", map[string]interface{}{
			"val-a": 10,
		}, map[string]interface{}{
			"val-b": 20,
		})

		api.AssertExpectations(t)
		assert.True(t, ok)
		assert.NoError(t, err)
	})

	t.Run("new value nil", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVCompareAndSet", "test-key", []byte(`{"val-a":10}`), []byte(nil)).Return(true, nil)
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndSetJSON("test-key", map[string]interface{}{
			"val-a": 10,
		}, nil)

		api.AssertExpectations(t)
		assert.True(t, ok)
		assert.NoError(t, err)
	})
}

func TestKVCompareAndDeleteJSON(t *testing.T) {
	t.Run("old value JSON marshal error", func(t *testing.T) {
		api := &plugintest.API{}
		api.AssertNotCalled(t, "KVCompareAndDelete")
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndDeleteJSON("test-key", func() { return })

		api.AssertExpectations(t)
		assert.Equal(t, false, ok)
		assert.Error(t, err)
	})

	t.Run("KVCompareAndDelete error", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVCompareAndDelete", "test-key", []byte(`{"val-a":10}`)).Return(false, &model.AppError{})
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndDeleteJSON("test-key", map[string]interface{}{
			"val-a": 10,
		})

		api.AssertExpectations(t)
		assert.False(t, ok)
		assert.Error(t, err)
	})

	t.Run("old value nil", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVCompareAndDelete", "test-key", []byte(nil)).Return(true, nil)
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndDeleteJSON("test-key", nil)

		api.AssertExpectations(t)
		assert.True(t, ok)
		assert.NoError(t, err)
	})

	t.Run("old value non-nil", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVCompareAndDelete", "test-key", []byte(`{"val-a":10}`)).Return(true, nil)
		p := &plugin.HelpersImpl{API: api}

		ok, err := p.KVCompareAndDeleteJSON("test-key", map[string]interface{}{
			"val-a": 10,
		})

		api.AssertExpectations(t)
		assert.True(t, ok)
		assert.NoError(t, err)
	})
}

func TestKVSetWithExpiryJSON(t *testing.T) {
	t.Run("JSON marshal error", func(t *testing.T) {
		api := &plugintest.API{}
		api.AssertNotCalled(t, "KVSetWithExpiry")

		p := &plugin.HelpersImpl{API: api}

		err := p.KVSetWithExpiryJSON("test-key", func() { return }, 100)

		api.AssertExpectations(t)
		assert.Error(t, err)
	})

	t.Run("KVSetWithExpiry error", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVSetWithExpiry", "test-key", []byte(`{"val-a":10}`), int64(100)).Return(&model.AppError{})
		p := &plugin.HelpersImpl{API: api}

		err := p.KVSetWithExpiryJSON("test-key", map[string]interface{}{
			"val-a": float64(10),
		}, 100)

		api.AssertExpectations(t)
		assert.Error(t, err)
	})

	t.Run("wellformed JSON", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("KVSetWithExpiry", "test-key", []byte(`{"val-a":10}`), int64(100)).Return(nil)

		p := &plugin.HelpersImpl{API: api}

		err := p.KVSetWithExpiryJSON("test-key", map[string]interface{}{
			"val-a": float64(10),
		}, 100)

		api.AssertExpectations(t)
		assert.NoError(t, err)
	})
}
