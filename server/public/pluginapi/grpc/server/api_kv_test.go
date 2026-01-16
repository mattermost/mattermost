// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// KV Store API Tests
// =============================================================================

func TestKVSetAndGet(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	key := "test_key"
	value := []byte("test_value")

	// Test Set
	h.mockAPI.On("KVSet", key, value).Return(nil)

	setResp, err := h.client.KVSet(context.Background(), &pb.KVSetRequest{
		Key:   key,
		Value: value,
	})

	require.NoError(t, err)
	assert.Nil(t, setResp.Error)

	// Test Get
	h.mockAPI.On("KVGet", key).Return(value, nil)

	getResp, err := h.client.KVGet(context.Background(), &pb.KVGetRequest{
		Key: key,
	})

	require.NoError(t, err)
	assert.Nil(t, getResp.Error)
	assert.Equal(t, value, getResp.Value)
	h.mockAPI.AssertExpectations(t)
}

func TestKVGet_NotFound(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	// When a key is not found, KVGet returns nil value and nil error
	// (as per the plugin API convention)
	h.mockAPI.On("KVGet", "nonexistent").Return(nil, nil)

	resp, err := h.client.KVGet(context.Background(), &pb.KVGetRequest{
		Key: "nonexistent",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.Nil(t, resp.Value)
	h.mockAPI.AssertExpectations(t)
}

func TestKVDelete(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("KVDelete", "test_key").Return(nil)

	resp, err := h.client.KVDelete(context.Background(), &pb.KVDeleteRequest{
		Key: "test_key",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	h.mockAPI.AssertExpectations(t)
}

func TestKVDeleteAll(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("KVDeleteAll").Return(nil)

	resp, err := h.client.KVDeleteAll(context.Background(), &pb.KVDeleteAllRequest{})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	h.mockAPI.AssertExpectations(t)
}

func TestKVList(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedKeys := []string{"key1", "key2", "key3"}

	h.mockAPI.On("KVList", 0, 100).Return(expectedKeys, nil)

	resp, err := h.client.KVList(context.Background(), &pb.KVListRequest{
		Page:    0,
		PerPage: 100,
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.Equal(t, expectedKeys, resp.Keys)
	h.mockAPI.AssertExpectations(t)
}

func TestKVCompareAndSet(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	key := "test_key"
	oldValue := []byte("old_value")
	newValue := []byte("new_value")

	h.mockAPI.On("KVCompareAndSet", key, oldValue, newValue).Return(true, nil)

	resp, err := h.client.KVCompareAndSet(context.Background(), &pb.KVCompareAndSetRequest{
		Key:      key,
		OldValue: oldValue,
		NewValue: newValue,
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.True(t, resp.Success)
	h.mockAPI.AssertExpectations(t)
}

func TestKVCompareAndSet_Mismatch(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	key := "test_key"
	oldValue := []byte("wrong_old_value")
	newValue := []byte("new_value")

	h.mockAPI.On("KVCompareAndSet", key, oldValue, newValue).Return(false, nil)

	resp, err := h.client.KVCompareAndSet(context.Background(), &pb.KVCompareAndSetRequest{
		Key:      key,
		OldValue: oldValue,
		NewValue: newValue,
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.False(t, resp.Success)
	h.mockAPI.AssertExpectations(t)
}

func TestKVCompareAndDelete(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	key := "test_key"
	oldValue := []byte("expected_value")

	h.mockAPI.On("KVCompareAndDelete", key, oldValue).Return(true, nil)

	resp, err := h.client.KVCompareAndDelete(context.Background(), &pb.KVCompareAndDeleteRequest{
		Key:      key,
		OldValue: oldValue,
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.True(t, resp.Success)
	h.mockAPI.AssertExpectations(t)
}

func TestKVSetWithExpiry(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	key := "expiring_key"
	value := []byte("value")
	expireInSeconds := int64(3600) // 1 hour

	h.mockAPI.On("KVSetWithExpiry", key, value, expireInSeconds).Return(nil)

	resp, err := h.client.KVSetWithExpiry(context.Background(), &pb.KVSetWithExpiryRequest{
		Key:             key,
		Value:           value,
		ExpireInSeconds: expireInSeconds,
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	h.mockAPI.AssertExpectations(t)
}

func TestKVSetWithOptions(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	key := "atomic_key"
	value := []byte("new_value")
	oldValue := []byte("old_value")

	h.mockAPI.On("KVSetWithOptions", key, value, mock.MatchedBy(func(opts model.PluginKVSetOptions) bool {
		return opts.Atomic && string(opts.OldValue) == string(oldValue) && opts.ExpireInSeconds == 3600
	})).Return(true, nil)

	resp, err := h.client.KVSetWithOptions(context.Background(), &pb.KVSetWithOptionsRequest{
		Key:   key,
		Value: value,
		Options: &pb.PluginKVSetOptions{
			Atomic:          true,
			OldValue:        oldValue,
			ExpireInSeconds: 3600,
		},
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.True(t, resp.Success)
	h.mockAPI.AssertExpectations(t)
}

func TestKVSet_Error(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("KVSet", "key", []byte("value")).Return(model.NewAppError("KVSet", "app.kv.set.error", nil, "", http.StatusInternalServerError))

	resp, err := h.client.KVSet(context.Background(), &pb.KVSetRequest{
		Key:   "key",
		Value: []byte("value"),
	})

	require.NoError(t, err)
	assert.NotNil(t, resp.Error)
	assert.Equal(t, int32(http.StatusInternalServerError), resp.Error.StatusCode)
	h.mockAPI.AssertExpectations(t)
}
