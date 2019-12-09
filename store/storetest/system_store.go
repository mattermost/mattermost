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

func TestSystemStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testSystemStore(t, ss) })
	t.Run("SaveOrUpdate", func(t *testing.T) { testSystemStoreSaveOrUpdate(t, ss) })
	t.Run("PermanentDeleteByName", func(t *testing.T) { testSystemStorePermanentDeleteByName(t, ss) })
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
