// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
)

func TestPluginStore(t *testing.T, ss store.Store) {
	t.Run("PluginSaveGet", func(t *testing.T) { testPluginSaveGet(t, ss) })
	t.Run("PluginSaveGetExpiry", func(t *testing.T) { testPluginSaveGetExpiry(t, ss) })
	t.Run("PluginDelete", func(t *testing.T) { testPluginDelete(t, ss) })
	t.Run("PluginDeleteAll", func(t *testing.T) { testPluginDeleteAll(t, ss) })
	t.Run("PluginDeleteExpired", func(t *testing.T) { testPluginDeleteExpired(t, ss) })
}

func testPluginSaveGet(t *testing.T, ss store.Store) {
	kv := &model.PluginKeyValue{
		PluginId: model.NewId(),
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: 0,
	}

	if _, err := ss.Plugin().SaveOrUpdate(kv); err != nil {
		t.Fatal(err)
	}

	defer func() {
		_ = ss.Plugin().Delete(kv.PluginId, kv.Key)
	}()

	if received, err := ss.Plugin().Get(kv.PluginId, kv.Key); err != nil {
		t.Fatal(err)
	} else {
		assert.Equal(t, kv.PluginId, received.PluginId)
		assert.Equal(t, kv.Key, received.Key)
		assert.Equal(t, kv.Value, received.Value)
		assert.Equal(t, kv.ExpireAt, received.ExpireAt)
	}

	// Try inserting when already exists
	kv.Value = []byte(model.NewId())
	if _, err := ss.Plugin().SaveOrUpdate(kv); err != nil {
		t.Fatal(err)
	}

	if received, err := ss.Plugin().Get(kv.PluginId, kv.Key); err != nil {
		t.Fatal(err)
	} else {
		assert.Equal(t, kv.PluginId, received.PluginId)
		assert.Equal(t, kv.Key, received.Key)
		assert.Equal(t, kv.Value, received.Value)
	}
}

func testPluginSaveGetExpiry(t *testing.T, ss store.Store) {
	kv := &model.PluginKeyValue{
		PluginId: model.NewId(),
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: model.GetMillis() + 30000,
	}

	if _, err := ss.Plugin().SaveOrUpdate(kv); err != nil {
		t.Fatal(err)
	}

	defer func() {
		_ = ss.Plugin().Delete(kv.PluginId, kv.Key)
	}()

	if received, err := ss.Plugin().Get(kv.PluginId, kv.Key); err != nil {
		t.Fatal(err)
	} else {
		assert.Equal(t, kv.PluginId, received.PluginId)
		assert.Equal(t, kv.Key, received.Key)
		assert.Equal(t, kv.Value, received.Value)
		assert.Equal(t, kv.ExpireAt, received.ExpireAt)
	}

	kv = &model.PluginKeyValue{
		PluginId: model.NewId(),
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: model.GetMillis() - 5000,
	}

	if _, err := ss.Plugin().SaveOrUpdate(kv); err != nil {
		t.Fatal(err)
	}

	defer func() {
		_ = ss.Plugin().Delete(kv.PluginId, kv.Key)
	}()

	if _, err := ss.Plugin().Get(kv.PluginId, kv.Key); err == nil {
		t.Fatal("result.Err should not be nil")
	}
}

func testPluginDelete(t *testing.T, ss store.Store) {
	kv, err := ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: model.NewId(),
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
	})
	require.Nil(t, err)

	if err := ss.Plugin().Delete(kv.PluginId, kv.Key); err != nil {
		t.Fatal(err)
	}
}

func testPluginDeleteAll(t *testing.T, ss store.Store) {
	pluginId := model.NewId()

	kv, err := ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: pluginId,
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
	})
	require.Nil(t, err)

	kv2, err := ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: pluginId,
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
	})
	require.Nil(t, err)

	if err := ss.Plugin().DeleteAllForPlugin(pluginId); err != nil {
		t.Fatal(err)
	}

	if _, err := ss.Plugin().Get(pluginId, kv.Key); err == nil {
		t.Fatal("result.Err should not be nil")
	}

	if _, err := ss.Plugin().Get(pluginId, kv2.Key); err == nil {
		t.Fatal("result.Err should not be nil")
	}
}

func testPluginDeleteExpired(t *testing.T, ss store.Store) {
	pluginId := model.NewId()

	kv, err := ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: pluginId,
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: model.GetMillis() - 6000,
	})
	require.Nil(t, err)

	kv2, err := ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: pluginId,
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: 0,
	})
	require.Nil(t, err)

	if err := ss.Plugin().DeleteAllExpired(); err != nil {
		t.Fatal(err)
	}

	if _, err := ss.Plugin().Get(pluginId, kv.Key); err == nil {
		t.Fatal("result.Err should not be nil")
	}

	if received, err := ss.Plugin().Get(kv2.PluginId, kv2.Key); err != nil {
		t.Fatal(err)
	} else {
		assert.Equal(t, kv2.PluginId, received.PluginId)
		assert.Equal(t, kv2.Key, received.Key)
		assert.Equal(t, kv2.Value, received.Value)
		assert.Equal(t, kv2.ExpireAt, received.ExpireAt)
	}
}
