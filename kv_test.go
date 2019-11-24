package pluginapi

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var appError = model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

func TestKVSet(t *testing.T) {
	tests := []struct {
		name            string
		key             string
		value           interface{}
		options         []KVSetOption
		expectedOptions model.PluginKVSetOptions
		upserted        bool
		err             error
	}{
		{
			"[]byte value",
			"1",
			[]byte{2},
			[]KVSetOption{},
			model.PluginKVSetOptions{},
			true,
			nil,
		},
		{
			"string value",
			"1",
			"2",
			[]KVSetOption{},
			model.PluginKVSetOptions{EncodeJSON: true},
			true,
			nil,
		},
		{
			"struct value", "1",
			struct{ a string }{"2"},
			[]KVSetOption{},
			model.PluginKVSetOptions{
				EncodeJSON: true,
			},
			true,
			nil,
		},
		{
			"compare and set []byte value",
			"1",
			[]byte{2},
			[]KVSetOption{
				SetAtomic([]byte{3}),
			},
			model.PluginKVSetOptions{
				Atomic:   true,
				OldValue: []byte{3},
			},
			true,
			nil,
		},
		{
			"compare and set string value",
			"1",
			"2",
			[]KVSetOption{
				SetAtomic("3"),
			},
			model.PluginKVSetOptions{
				EncodeJSON: true,
				Atomic:     true,
				OldValue:   "3",
			}, true,
			nil,
		},
		{
			"value is nil",
			"1",
			nil,
			[]KVSetOption{},
			model.PluginKVSetOptions{
				EncodeJSON: true,
			},
			true,
			nil,
		},
		{
			"current value is nil",
			"1",
			"2",
			[]KVSetOption{
				SetAtomic(nil),
			},
			model.PluginKVSetOptions{
				EncodeJSON: true,
				Atomic:     true,
				OldValue:   nil,
			},
			true,
			nil,
		},
		{
			"value is nil, current value is []byte",
			"1",
			nil,
			[]KVSetOption{
				SetAtomic([]byte{3}),
			},
			model.PluginKVSetOptions{
				Atomic:   true,
				OldValue: []byte{3},
			},
			true,
			nil,
		},
		{
			"error",
			"1",
			[]byte{2},
			[]KVSetOption{},
			model.PluginKVSetOptions{},
			false,
			appError,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			api := &plugintest.API{}

			client := NewClient(api)

			api.On("KVSetWithOptions", test.key, test.value, test.expectedOptions).Return(test.upserted, test.err)

			upserted, err := client.KV.Set(test.key, test.value, test.options...)
			if test.err != nil {
				require.Error(t, err, test.name)
				require.False(t, upserted, test.name)
			} else {
				require.NoError(t, err, test.name)
				assert.True(t, upserted, test.name)
			}
			api.AssertExpectations(t)
		})
	}
}

func TestSetWithExpiry(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	client := NewClient(api)

	api.On("KVSetWithOptions", "1", 2, model.PluginKVSetOptions{
		EncodeJSON:      true,
		ExpireInSeconds: 60,
	}).Return(true, nil)

	err := client.KV.SetWithExpiry("1", 2, time.Minute)
	require.NoError(t, err)
}

func TestCompareAndSet(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	client := NewClient(api)

	api.On("KVSetWithOptions", "1", 2, model.PluginKVSetOptions{
		EncodeJSON: true,
		Atomic:     true,
		OldValue:   3,
	}).Return(true, nil)

	upserted, err := client.KV.CompareAndSet("1", 3, 2)
	require.NoError(t, err)
	assert.True(t, upserted)
}

func TestCompareAndDelete(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	client := NewClient(api)

	api.On("KVSetWithOptions", "1", nil, model.PluginKVSetOptions{
		EncodeJSON: true,
		Atomic:     true,
		OldValue:   2,
	}).Return(true, nil)

	deleted, err := client.KV.CompareAndDelete("1", 2)
	require.NoError(t, err)
	assert.True(t, deleted)
}

func TestGet(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	client := NewClient(api)

	aStringJSON, _ := json.Marshal("2")

	api.On("KVGet", "1").Return(aStringJSON, nil)

	var out string
	err := client.KV.Get("1", &out)
	require.NoError(t, err)
	assert.Equal(t, "2", out)
}

func TestGetInBytes(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	client := NewClient(api)

	api.On("KVGet", "1").Return([]byte{2}, nil)

	var out []byte
	err := client.KV.Get("1", &out)
	require.NoError(t, err)
	assert.Equal(t, []byte{2}, out)
	api.AssertExpectations(t)
}

func TestDelete(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	client := NewClient(api)

	api.On("KVSetWithOptions", "1", nil, model.PluginKVSetOptions{
		EncodeJSON: true,
	}).Return(true, nil)

	err := client.KV.Delete("1")
	require.NoError(t, err)
}

func TestDeleteAll(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	client := NewClient(api)

	api.On("KVDeleteAll").Return(nil)

	err := client.KV.DeleteAll()
	require.NoError(t, err)
}

func TestListKeys(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	client := NewClient(api)

	api.On("KVList", 1, 2).Return([]string{"3", "4"}, nil)

	keys, err := client.KV.ListKeys(1, 2)
	require.NoError(t, err)
	require.Equal(t, []string{"3", "4"}, keys)
}
