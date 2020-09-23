// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func TestSystemStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testSystemStore(t, ss) })
	t.Run("SaveOrUpdate", func(t *testing.T) { testSystemStoreSaveOrUpdate(t, ss) })
	t.Run("PermanentDeleteByName", func(t *testing.T) { testSystemStorePermanentDeleteByName(t, ss) })
	t.Run("InsertIfExists", func(t *testing.T) {
		testInsertIfExists(t, ss)
	})
}

func testSystemStore(t *testing.T, ss store.Store) {
	system := &model.System{Name: model.NewId(), Value: "value"}
	err := ss.System().Save(system)
	require.Nil(t, err)

	systems, _ := ss.System().Get()

	require.Equal(t, system.Value, systems[system.Name])

	system.Value = "value2"
	err = ss.System().Update(system)
	require.Nil(t, err)

	systems2, _ := ss.System().Get()
	require.Equal(t, system.Value, systems2[system.Name])

	rsystem, _ := ss.System().GetByName(system.Name)
	require.Equal(t, system.Value, rsystem.Value)
}

func testSystemStoreSaveOrUpdate(t *testing.T, ss store.Store) {
	system := &model.System{Name: model.NewId(), Value: "value"}

	err := ss.System().SaveOrUpdate(system)
	require.Nil(t, err)

	system.Value = "value2"

	err = ss.System().SaveOrUpdate(system)
	require.Nil(t, err)
}

func testSystemStorePermanentDeleteByName(t *testing.T, ss store.Store) {
	s1 := &model.System{Name: model.NewId(), Value: "value"}
	s2 := &model.System{Name: model.NewId(), Value: "value"}

	err := ss.System().Save(s1)
	require.Nil(t, err)
	err = ss.System().Save(s2)
	require.Nil(t, err)

	_, err = ss.System().GetByName(s1.Name)
	assert.Nil(t, err)

	_, err = ss.System().GetByName(s2.Name)
	assert.Nil(t, err)

	_, err = ss.System().PermanentDeleteByName(s1.Name)
	assert.Nil(t, err)

	_, err = ss.System().GetByName(s1.Name)
	assert.NotNil(t, err)

	_, err = ss.System().GetByName(s2.Name)
	assert.Nil(t, err)

	_, err = ss.System().PermanentDeleteByName(s2.Name)
	assert.Nil(t, err)

	_, err = ss.System().GetByName(s1.Name)
	assert.NotNil(t, err)

	_, err = ss.System().GetByName(s2.Name)
	assert.NotNil(t, err)
}

func testInsertIfExists(t *testing.T, ss store.Store) {
	t.Run("Serial", func(t *testing.T) {
		s1 := &model.System{Name: model.SYSTEM_CLUSTER_ENCRYPTION_KEY, Value: "somekey"}

		s2, err := ss.System().InsertIfExists(s1)
		require.Nil(t, err)
		assert.Equal(t, s1.Value, s2.Value)

		s1New := &model.System{Name: model.SYSTEM_CLUSTER_ENCRYPTION_KEY, Value: "anotherKey"}

		s3, err := ss.System().InsertIfExists(s1New)
		require.Nil(t, err)
		assert.Equal(t, s1.Value, s3.Value)
	})

	t.Run("Concurrent", func(t *testing.T) {
		var s2, s3 *model.System
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			s1 := &model.System{Name: model.SYSTEM_CLUSTER_ENCRYPTION_KEY, Value: "firstKey"}
			var err error
			s2, err = ss.System().InsertIfExists(s1)
			require.Nil(t, err)
		}()

		go func() {
			defer wg.Done()
			s1 := &model.System{Name: model.SYSTEM_CLUSTER_ENCRYPTION_KEY, Value: "secondKey"}
			var err error
			s3, err = ss.System().InsertIfExists(s1)
			require.Nil(t, err)
		}()
		wg.Wait()
		assert.Equal(t, s2.Value, s3.Value)
	})
}
