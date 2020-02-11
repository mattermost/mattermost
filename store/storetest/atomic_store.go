// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func TestAtomicStore(t *testing.T, ss store.Store) {
	t.Run("CompareAndSet", func(t *testing.T) { testAtomicCompareAndSet(t, ss) })
	t.Run("AtomicSaveGet", func(t *testing.T) { testAtomicSaveGet(t, ss) })
	t.Run("AtomicSaveGetExpiry", func(t *testing.T) { testAtomicSaveGetExpiry(t, ss) })
	t.Run("AtomicDelete", func(t *testing.T) { testAtomicDelete(t, ss) })
	t.Run("AtomicDeleteExpired", func(t *testing.T) { testAtomicDeleteExpired(t, ss) })
}

func testAtomicCompareAndSet(t *testing.T, ss store.Store) {
	kv := &model.AtomicKeyValue{
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: 0,
	}
	defer func() {
		_ = ss.Atomic().Delete(kv.Key)
	}()

	t.Run("set non-existent key should succeed given nil old value", func(t *testing.T) {
		ok, err := ss.Atomic().CompareAndSet(kv, nil)
		require.Nil(t, err)
		assert.True(t, ok)
	})

	t.Run("set existing key with new value should succeed given same old value", func(t *testing.T) {
		_, err := ss.Atomic().SaveOrUpdate(kv)
		require.Nil(t, err)

		kvNew := &model.AtomicKeyValue{
			Key:      kv.Key,
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}

		ok, err := ss.Atomic().CompareAndSet(kvNew, kv.Value)
		require.Nil(t, err)
		assert.True(t, ok)
	})

	t.Run("set existing key with new value should fail given different old value", func(t *testing.T) {
		_, err := ss.Atomic().SaveOrUpdate(kv)
		require.Nil(t, err)

		kvNew := &model.AtomicKeyValue{
			Key:      kv.Key,
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}

		ok, err := ss.Atomic().CompareAndSet(kvNew, []byte(model.NewId()))
		require.Nil(t, err)
		assert.False(t, ok)
	})

	t.Run("set existing key with same value should succeed given same old value", func(t *testing.T) {
		_, err := ss.Atomic().SaveOrUpdate(kv)
		require.Nil(t, err)

		ok, err := ss.Atomic().CompareAndSet(kv, kv.Value)
		require.Nil(t, err)
		assert.True(t, ok)
	})

	t.Run("set existing key with same value should fail given different old value", func(t *testing.T) {
		_, err := ss.Atomic().SaveOrUpdate(kv)
		require.Nil(t, err)

		ok, err := ss.Atomic().CompareAndSet(kv, []byte(model.NewId()))
		require.Nil(t, err)
		assert.False(t, ok)
	})
}

func testAtomicSaveGet(t *testing.T, ss store.Store) {
	kv := &model.AtomicKeyValue{
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: 0,
	}

	_, err := ss.Atomic().SaveOrUpdate(kv)
	require.Nil(t, err)

	defer func() {
		_ = ss.Atomic().Delete(kv.Key)
	}()

	received, err := ss.Atomic().Get(kv.Key)
	require.Nil(t, err)
	assert.Equal(t, kv.Key, received.Key)
	assert.Equal(t, kv.Value, received.Value)
	assert.Equal(t, kv.ExpireAt, received.ExpireAt)

	// Try inserting when already exists
	kv.Value = []byte(model.NewId())
	_, err = ss.Atomic().SaveOrUpdate(kv)
	require.Nil(t, err)

	received, err = ss.Atomic().Get(kv.Key)
	require.Nil(t, err)
	assert.Equal(t, kv.Key, received.Key)
	assert.Equal(t, kv.Value, received.Value)
}

func testAtomicSaveGetExpiry(t *testing.T, ss store.Store) {
	kv := &model.AtomicKeyValue{
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: model.GetMillis() + 30000,
	}

	_, err := ss.Atomic().SaveOrUpdate(kv)
	require.Nil(t, err)

	defer func() {
		_ = ss.Atomic().Delete(kv.Key)
	}()

	received, err := ss.Atomic().Get(kv.Key)
	require.Nil(t, err)
	assert.Equal(t, kv.Key, received.Key)
	assert.Equal(t, kv.Value, received.Value)
	assert.Equal(t, kv.ExpireAt, received.ExpireAt)

	kv = &model.AtomicKeyValue{
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: model.GetMillis() - 5000,
	}

	_, err = ss.Atomic().SaveOrUpdate(kv)
	require.Nil(t, err)

	defer func() {
		_ = ss.Atomic().Delete(kv.Key)
	}()

	_, err = ss.Atomic().Get(kv.Key)
	require.NotNil(t, err)
}

func testAtomicDelete(t *testing.T, ss store.Store) {
	kv, err := ss.Atomic().SaveOrUpdate(&model.AtomicKeyValue{
		Key:   model.NewId(),
		Value: []byte(model.NewId()),
	})
	require.Nil(t, err)

	err = ss.Atomic().Delete(kv.Key)
	require.Nil(t, err)
}

func testAtomicDeleteExpired(t *testing.T, ss store.Store) {
	kv, err := ss.Atomic().SaveOrUpdate(&model.AtomicKeyValue{
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: model.GetMillis() - 6000,
	})
	require.Nil(t, err)

	kv2, err := ss.Atomic().SaveOrUpdate(&model.AtomicKeyValue{
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: 0,
	})
	require.Nil(t, err)

	err = ss.Atomic().DeleteAllExpired()
	require.Nil(t, err)

	_, err = ss.Atomic().Get(kv.Key)
	require.NotNil(t, err)

	received, err := ss.Atomic().Get(kv2.Key)
	require.Nil(t, err)
	assert.Equal(t, kv2.Key, received.Key)
	assert.Equal(t, kv2.Value, received.Value)
	assert.Equal(t, kv2.ExpireAt, received.ExpireAt)
}
