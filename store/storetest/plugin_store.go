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
	t.Run("PluginDelete", func(t *testing.T) { testPluginDelete(t, ss) })
}

func testPluginSaveGet(t *testing.T, ss store.Store) {
	kv := &model.PluginKeyValue{
		PluginId: model.NewId(),
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
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
