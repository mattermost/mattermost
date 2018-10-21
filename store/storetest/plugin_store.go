// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

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

	if result := <-ss.Plugin().SaveOrUpdate(kv); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().Delete(kv.PluginId, kv.Key)
	}()

	if result := <-ss.Plugin().Get(kv.PluginId, kv.Key); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.(*model.PluginKeyValue)
		assert.Equal(t, kv.PluginId, received.PluginId)
		assert.Equal(t, kv.Key, received.Key)
		assert.Equal(t, kv.Value, received.Value)
		assert.Equal(t, kv.ExpireAt, received.ExpireAt)
	}

	// Try inserting when already exists
	kv.Value = []byte(model.NewId())
	if result := <-ss.Plugin().SaveOrUpdate(kv); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-ss.Plugin().Get(kv.PluginId, kv.Key); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.(*model.PluginKeyValue)
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

	if result := <-ss.Plugin().SaveOrUpdate(kv); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().Delete(kv.PluginId, kv.Key)
	}()

	if result := <-ss.Plugin().Get(kv.PluginId, kv.Key); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.(*model.PluginKeyValue)
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

	if result := <-ss.Plugin().SaveOrUpdate(kv); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().Delete(kv.PluginId, kv.Key)
	}()

	if result := <-ss.Plugin().Get(kv.PluginId, kv.Key); result.Err == nil {
		t.Fatal("result.Err should not be nil")
	}
}

func testPluginDelete(t *testing.T, ss store.Store) {
	kv := store.Must(ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: model.NewId(),
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
	})).(*model.PluginKeyValue)

	if result := <-ss.Plugin().Delete(kv.PluginId, kv.Key); result.Err != nil {
		t.Fatal(result.Err)
	}
}

func testPluginDeleteAll(t *testing.T, ss store.Store) {
	pluginId := model.NewId()

	kv := store.Must(ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: pluginId,
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
	})).(*model.PluginKeyValue)

	kv2 := store.Must(ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: pluginId,
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
	})).(*model.PluginKeyValue)

	if result := <-ss.Plugin().DeleteAllForPlugin(pluginId); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-ss.Plugin().Get(pluginId, kv.Key); result.Err == nil {
		t.Fatal("result.Err should not be nil")
	}

	if result := <-ss.Plugin().Get(pluginId, kv2.Key); result.Err == nil {
		t.Fatal("result.Err should not be nil")
	}
}

func testPluginDeleteExpired(t *testing.T, ss store.Store) {
	pluginId := model.NewId()

	kv := store.Must(ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: pluginId,
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: model.GetMillis() - 6000,
	})).(*model.PluginKeyValue)

	kv2 := store.Must(ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: pluginId,
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: 0,
	})).(*model.PluginKeyValue)

	if result := <-ss.Plugin().DeleteAllExpired(); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-ss.Plugin().Get(pluginId, kv.Key); result.Err == nil {
		t.Fatal("result.Err should not be nil")
	}

	if result := <-ss.Plugin().Get(kv2.PluginId, kv2.Key); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.(*model.PluginKeyValue)
		assert.Equal(t, kv2.PluginId, received.PluginId)
		assert.Equal(t, kv2.Key, received.Key)
		assert.Equal(t, kv2.Value, received.Value)
		assert.Equal(t, kv2.ExpireAt, received.ExpireAt)
	}
}
